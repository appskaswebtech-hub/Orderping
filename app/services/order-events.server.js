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
 * Enforces the monthly WhatsApp message cap for the shop's billing plan
 * (MESSAGE_LIMIT is written by requireActivePlan() in billing.server.js after
 * confirming an active subscription — empty/missing means unlimited, e.g.
 * dev stores or the Advanced plan). Returns false and leaves the counter
 * untouched if the shop is already at its cap for the current calendar month;
 * otherwise increments the counter and returns true. Shared across all 8
 * notification types since the cap is a total, not per-event-type.
 */
export async function checkAndConsumeMessageQuota(shop, settings) {
  const limit = settings.MESSAGE_LIMIT;
  if (!limit) return true;

  const period = new Date().toISOString().slice(0, 7);
  const count = settings.USAGE_PERIOD === period ? Number(settings.USAGE_COUNT || 0) : 0;
  if (count >= Number(limit)) return false;

  const nextCount = String(count + 1);
  await db.appSetting.upsert({
    where: { shop_key: { shop, key: "USAGE_PERIOD" } },
    update: { value: period },
    create: { shop, key: "USAGE_PERIOD", value: period },
  });
  await db.appSetting.upsert({
    where: { shop_key: { shop, key: "USAGE_COUNT" } },
    update: { value: nextCount },
    create: { shop, key: "USAGE_COUNT", value: nextCount },
  });
  return true;
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

// Every merchant must create a template with this exact name (category
// Utility, language English (US)) in their own Meta Business Account for
// each event type to be sent — we can't approve templates on their behalf,
// so the name has to be a fixed, documented contract rather than something
// configurable per shop. See REQUIRED_TEMPLATES below for the full list.
// `settingKey` is the AppSetting key a shop can set to "false" to turn that
// specific notification type off, independent of the master ENABLED toggle —
// see the "Notification types" section on the Settings page.
export const REQUIRED_TEMPLATES = {
  orderConfirmation: { name: "order_confirmation_image", language: "en_US", settingKey: "NOTIFY_ORDER_CONFIRMATION" },
  // These 7 are approved in Meta under "English" (en), not "English (US)"
  // (en_US) like order_confirmation_image — must match exactly or Meta
  // rejects the send with "Template name does not exist in the translation".
  shipped: { name: "order_shipped", language: "en", settingKey: "NOTIFY_SHIPPED" },
  outForDelivery: { name: "order_out_for_delivery", language: "en", settingKey: "NOTIFY_OUT_FOR_DELIVERY" },
  delivered: { name: "order_delivered", language: "en", settingKey: "NOTIFY_DELIVERED" },
  refundInitiated: { name: "order_refund_initiated", language: "en", settingKey: "NOTIFY_REFUND_INITIATED" },
  cancelled: { name: "order_cancelled", language: "en", settingKey: "NOTIFY_CANCELLED" },
  paid: { name: "order_paid", language: "en", settingKey: "NOTIFY_PAID" },
  partiallyFulfilled: { name: "order_partially_fulfilled", language: "en", settingKey: "NOTIFY_PARTIALLY_FULFILLED" },
};

/**
 * Sends a WhatsApp status-update message (shipped, out for delivery, delivered,
 * refund initiated, etc.) for an order-related webhook.
 *
 * `notificationType` must be unique per event kind (e.g. "whatsapp_shipped") so it
 * doesn't collide with the order-confirmation log entry or other event types for
 * the same order, and so idempotency/dedup works per event kind.
 *
 * `template` is one of the entries from REQUIRED_TEMPLATES above — fixed per
 * event kind, not configurable per shop (see its comment for why).
 *
 * `buildVariables(order)` returns the ordered array of body text values the
 * template's {{1}}, {{2}}, ... placeholders expect.
 */
export async function sendOrderStatusNotification({
  shop,
  order,
  notificationType,
  template,
  buildVariables,
}) {
  const shopifyOrderId = String(order.id ?? order.order_id ?? "");
  const orderNumber = String(order.order_number ?? order.name ?? "");
  const customerName = getCustomerNameFromOrder(order);
  const rawPhone = getPhoneFromOrder(order);

  // upsert, not create: Shopify retries webhook deliveries, and a retry hitting
  // this same failure path again would violate the unique constraint on
  // (shop, shopifyOrderId, notificationType) if this were a plain create().
  const logFailure = (errorMessage, customerPhone = null) =>
    db.notificationLog
      .upsert({
        where: { shop_shopifyOrderId_notificationType: { shop, shopifyOrderId, notificationType } },
        update: { customerName, customerPhone, status: "failed", errorMessage },
        create: { shop, shopifyOrderId, orderNumber, customerName, customerPhone, notificationType, status: "failed", errorMessage },
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

  if (template.settingKey && settings[template.settingKey] === "false") {
    await logFailure("event_disabled_by_shop");
    return;
  }

  const templateName = template.name;
  const templateLanguage = template.language;

  // Falls back to the developer's own WhatsApp credentials (env vars) only for
  // stores that haven't entered their own yet in Settings.
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

  if (!(await checkAndConsumeMessageQuota(shop, settings))) {
    await logFailure("message_limit_reached", phone);
    return;
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
