import db from "../db.server";
import { sendTemplateMessage } from "./whatsapp.server";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function getPhoneFromOrder(order) {
  if (order?.phone) return order.phone;
  if (order?.customer?.phone) return order.customer.phone;
  if (order?.customer?.default_address?.phone) return order.customer.default_address.phone;
  if (order?.shipping_address?.phone) return order.shipping_address.phone;
  if (order?.billing_address?.phone) return order.billing_address.phone;
  return null;
}

export function getCustomerNameFromOrder(order) {
  const nameFrom = (obj) => (obj && `${obj.first_name || ""} ${obj.last_name || ""}`.trim()) || "";
  return nameFrom(order?.billing_address) || nameFrom(order?.shipping_address) || nameFrom(order?.customer) || null;
}

/**
 * Fulfillment/refund webhooks don't include the customer or phone number, only
 * the order_id — fetch the full order via the Admin REST API so the same
 * phone/name extraction used for order-confirmation can be reused.
 */
export async function fetchOrderById(shop, orderId) {
  try {
    const session = await db.session.findFirst({ where: { shop } });
    if (!session?.accessToken || !orderId) return null;
    const res = await fetch(`https://${shop}/admin/api/2024-10/orders/${orderId}.json`, {
      headers: { "X-Shopify-Access-Token": session.accessToken },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.order || null;
  } catch (err) {
    console.error(`[order-ping] fetch_order_error shop=${shop} orderId=${orderId}`, err);
    return null;
  }
}

export function normalizePhone(raw, defaultCountry) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const pn = parsePhoneNumberFromString(raw, defaultCountry || undefined);
    if (!pn || !pn.isValid()) return null;
    return pn.number.replace(/^\+/, "");
  } catch (e) {
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length < 8) return null;
    return digits;
  }
}

/**
 * Sends a WhatsApp status-update message (shipped, out for delivery, delivered,
 * refund initiated, etc.) for an order-related webhook.
 *
 * `notificationType` must be unique per event kind (e.g. "whatsapp_shipped") so it
 * doesn't collide with the order-confirmation log entry or other event types for
 * the same order, and so idempotency/dedup works per event kind.
 *
 * `templateEnvKey` is the env var holding the Meta template name to use for this
 * event (e.g. "META_TEMPLATE_NAME_SHIPPED"). Per-shop override uses the same key
 * name in AppSetting. If neither is configured, the send is skipped (logged as
 * "template_not_configured") rather than guessing a template name — an unapproved
 * template name would just fail at Meta anyway.
 *
 * `buildVariables(order)` returns the ordered array of body text values the
 * template's {{1}}, {{2}}, ... placeholders expect.
 */
export async function sendOrderStatusNotification({
  shop,
  order,
  notificationType,
  templateEnvKey,
  templateLanguageEnvKey,
  buildVariables,
}) {
  const shopifyOrderId = String(order.id ?? order.order_id ?? "");
  const orderNumber = String(order.order_number ?? order.name ?? "");
  const customerName = getCustomerNameFromOrder(order);
  const rawPhone = getPhoneFromOrder(order);

  const logFailure = (errorMessage, customerPhone = null) =>
    db.notificationLog
      .create({
        data: { shop, shopifyOrderId, orderNumber, customerName, customerPhone, notificationType, status: "failed", errorMessage },
      })
      .catch(() => null);

  let settings = {};
  try {
    const rows = await db.appSetting.findMany({ where: { shop } });
    settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (err) {
    console.error(`[order-ping] settings_load_error shop=${shop} order=${shopifyOrderId}`, err);
    await logFailure("eligibility_check_error");
    return;
  }

  if (settings.ENABLED === "false") {
    await logFailure("disabled_by_shop");
    return;
  }

  const templateName = settings[templateEnvKey] || process.env[templateEnvKey];
  if (!templateName) {
    await logFailure("template_not_configured");
    return;
  }
  const templateLanguage = settings[templateLanguageEnvKey] || process.env[templateLanguageEnvKey] || "en_US";

  // TEMPORARY: falls back to the developer's own WhatsApp credentials while the
  // app is pending Shopify review. Remove once approved — see
  // webhooks.app.orders_create.jsx for the matching note.
  const credentials = {
    accessToken: settings.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || undefined,
    phoneNumberId: settings.META_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || undefined,
    apiVersion: settings.META_API_VERSION || process.env.META_API_VERSION || undefined,
  };

  if (!rawPhone) {
    await logFailure("no_customer_phone");
    return;
  }
  const phone = normalizePhone(rawPhone, settings.DEFAULT_COUNTRY || undefined);
  if (!phone) {
    await logFailure("invalid_phone_format", rawPhone);
    return;
  }

  try {
    const existing = await db.notificationLog.findUnique({
      where: { shop_shopifyOrderId_notificationType: { shop, shopifyOrderId, notificationType } },
    });
    if (existing) return;
  } catch (err) {
    console.error("[order-ping] idempotency_check_error (continuing)", err);
  }

  let record;
  try {
    record = await db.notificationLog.create({
      data: { shop, shopifyOrderId, orderNumber, customerName, customerPhone: phone, notificationType, status: "pending" },
    });
  } catch (err) {
    console.error("[order-ping] failed to create notification log", err);
    return;
  }

  try {
    const result = await sendTemplateMessage({
      to: phone,
      templateName,
      language: templateLanguage,
      accessToken: credentials.accessToken,
      phoneNumberId: credentials.phoneNumberId,
      apiVersion: credentials.apiVersion,
      components: [
        {
          type: "body",
          parameters: buildVariables(order).map((text) => ({ type: "text", text })),
        },
      ],
    });
    const metaId = result?.messages?.[0]?.id || null;
    await db.notificationLog.update({ where: { id: record.id }, data: { status: "sent", metaMessageId: metaId } });
    console.log(`[order-ping] notification_sent type=${notificationType} shop=${shop} order=${shopifyOrderId} metaId=${metaId}`);
  } catch (err) {
    console.error(`[order-ping] send_failed type=${notificationType} shop=${shop} order=${shopifyOrderId}`, err?.body || err?.message || err);
    await db.notificationLog
      .update({ where: { id: record.id }, data: { status: "failed", errorMessage: JSON.stringify(err?.body || err?.message || String(err)) } })
      .catch(() => null);
  }
}
