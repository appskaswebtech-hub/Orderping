import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendTemplateMessage } from "../services/whatsapp.server";
import { parsePhoneNumberFromString } from "libphonenumber-js";

function getPhoneFromOrder(order) {
  // Try common locations for a phone number, in priority order
  if (order?.phone) return order.phone;
  if (order?.customer?.phone) return order.customer.phone;
  if (order?.customer?.default_address?.phone) return order.customer.default_address.phone;
  if (order?.shipping_address?.phone) return order.shipping_address.phone;
  if (order?.billing_address?.phone) return order.billing_address.phone;
  return null;
}

function buildItemsSummary(order) {
  const items = order?.line_items || [];
  if (items.length === 0) return "N/A";
  const summary = items.map((li) => `${li.title || li.name || "Item"} x${li.quantity || 1}`).join(", ");
  return summary.length > 300 ? `${summary.slice(0, 297)}...` : summary;
}

function buildTotal(order) {
  const total = order?.total_price ?? order?.current_total_price;
  if (total == null) return "N/A";
  const currency = order?.currency || "";
  return currency ? `${currency} ${total}` : String(total);
}

async function getFirstLineItemImageUrl(shop, order) {
  try {
    const productId = order?.line_items?.[0]?.product_id;
    if (!productId) return null;
    const session = await db.session.findFirst({ where: { shop } });
    if (!session?.accessToken) return null;
    const res = await fetch(`https://${shop}/admin/api/2024-10/products/${productId}.json?fields=image`, {
      headers: { "X-Shopify-Access-Token": session.accessToken },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.product?.image?.src || null;
  } catch (err) {
    console.error("[order-ping] failed to fetch product image", err);
    return null;
  }
}

function buildOrderStatusUrlSuffix(order, shop) {
  const url = order?.order_status_url;
  if (!url) return null;
  const prefix = `https://${shop}/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  // Fall back to stripping just the scheme if the domain doesn't match exactly
  // (e.g. custom domain vs myshopify.com).
  return url.replace(/^https?:\/\//, "");
}

async function buildTemplateComponents(template, { customerName, orderNumber, shopifyOrderId, order, shop }) {
  if (template.name === "order_confirmation_link") {
    const FALLBACK_IMAGE_URL = "https://cdn.shopify.com/s/files/1/0805/2437/8361/files/gift_card.png?v=1774602792";
    const imageUrl = (await getFirstLineItemImageUrl(shop, order)) || FALLBACK_IMAGE_URL;
    // The template's URL button requires a value on every send.
    const urlSuffix = buildOrderStatusUrlSuffix(order, shop) || "account";
    const components = [
      {
        type: "header",
        parameters: [{ type: "image", image: { link: imageUrl } }],
      },
      {
        type: "body",
        parameters: [
          { type: "text", text: customerName || "Customer" },
          { type: "text", text: orderNumber || String(shopifyOrderId) },
          { type: "text", text: buildItemsSummary(order) },
          { type: "text", text: buildTotal(order) },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: urlSuffix }],
      },
    ];
    return components;
  }
  if (template.name === "order_confirmation_image") {
    // The template requires an image header on every send; fall back to a generic
    // placeholder if this order's product has none, rather than omitting it.
    const FALLBACK_IMAGE_URL = "https://cdn.shopify.com/s/files/1/0805/2437/8361/files/gift_card.png?v=1774602792";
    const imageUrl = (await getFirstLineItemImageUrl(shop, order)) || FALLBACK_IMAGE_URL;
    const components = [
      {
        type: "header",
        parameters: [{ type: "image", image: { link: imageUrl } }],
      },
    ];
    components.push({
      type: "body",
      parameters: [
        { type: "text", text: customerName || "Customer" },
        { type: "text", text: orderNumber || String(shopifyOrderId) },
        { type: "text", text: buildItemsSummary(order) },
        { type: "text", text: buildTotal(order) },
      ],
    });
    return components;
  }
  if (template.name === "order_confirmation_details") {
    return [
      {
        type: "body",
        parameters: [
          { type: "text", text: customerName || "Customer" },
          { type: "text", text: orderNumber || String(shopifyOrderId) },
          { type: "text", text: buildItemsSummary(order) },
          { type: "text", text: buildTotal(order) },
        ],
      },
    ];
  }
  // Fallback: legacy 2-variable template (e.g. "order_status")
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: customerName || "Customer" },
        { type: "text", text: orderNumber || String(shopifyOrderId) },
      ],
    },
  ];
}

function normalizePhone(raw, defaultCountry) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const pn = parsePhoneNumberFromString(raw, defaultCountry || undefined);
    if (!pn || !pn.isValid()) return null;
    // return digits only international (no +)
    return pn.number.replace(/^\+/, "");
  } catch (e) {
    // fallback to digits-only with basic checks
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length < 8) return null;
    return digits;
  }
}

export const action = async ({ request }) => {
  try {
    return await handleOrderCreate(request);
  } catch (err) {
    console.error(`[order-ping] UNHANDLED_ERROR in orders_create webhook:`, err?.stack || err);
    return new Response(null, { status: 500 });
  }
};

async function handleOrderCreate(request) {
  // Clone the request before webhook authentication consumes the body
  const requestClone = request.clone();
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[order-ping] webhook_authenticated shop=${shop} topic=${topic}`);

  let payload;
  try {
    payload = await requestClone.json();
  } catch (err) {
    console.error("Failed to parse webhook payload", err);
    return new Response(null, { status: 400 });
  }
  console.log(`[order-ping] checkpoint payload_parsed order_id=${payload?.id}`);

  const order = payload;
  const shopifyOrderId = String(order.id ?? order.order_id ?? "");
  const orderNumber = String(order.order_number ?? order.name ?? "");
  const customerName = (order.customer && `${order.customer.first_name || ""} ${order.customer.last_name || ""}`).trim() || null;
  const rawPhone = getPhoneFromOrder(order);
  let defaultCountry;
  let credentials = {};
  let template = { name: "order_status", language: "en" };

  // Check shop settings: enabled flag, opt-in requirement, credentials, template.
  // Any failure here must block sending (fail closed), not fall through to a send.
  let enabled;
  let requireOptIn;
  try {
    const rows = await db.appSetting.findMany({ where: { shop } });
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    enabled = settings.ENABLED === "true";
    requireOptIn = settings.REQUIRE_CUSTOMER_OPT_IN === "true";
    defaultCountry = settings.DEFAULT_COUNTRY || undefined;
    credentials = {
      accessToken: settings.META_ACCESS_TOKEN || undefined,
      phoneNumberId: settings.META_PHONE_NUMBER_ID || undefined,
      apiVersion: settings.META_API_VERSION || undefined,
    };
    template = {
      name: settings.META_TEMPLATE_NAME || "order_status",
      language: settings.META_TEMPLATE_LANGUAGE || "en",
    };
    console.log(`[order-ping] checkpoint settings_loaded enabled=${enabled} requireOptIn=${requireOptIn}`);

    if (!enabled) {
      await db.notificationLog.create({
        data: {
          shop,
          shopifyOrderId,
          orderNumber,
          customerName,
          customerPhone: null,
          notificationType: "whatsapp",
          status: "failed",
          errorMessage: "disabled_by_shop",
        },
      }).catch(() => null);

      return new Response();
    }

    if (requireOptIn) {
        // Check common opt-in signals: customer.accepts_marketing, note_attributes 'whatsapp_opt_in', or CustomerOptIn table
        const acceptedMarketing = order?.customer?.accepts_marketing === true;
        const noteAttrs = order?.note_attributes || [];
        const whatsappOptIn = noteAttrs.some((n) => (n.name || n.key || "").toLowerCase() === "whatsapp_opt_in" && String(n.value || "").toLowerCase() !== "false");

        let customerOptInFound = false;
        try {
          const normalizedPhone = normalizePhone(getPhoneFromOrder(order), defaultCountry);
          if (normalizedPhone) {
            // try both variants (with and without +) to match stored opt-ins
            const variants = [normalizedPhone, `+${normalizedPhone}`];
            for (const p of variants) {
              const opt = await db.customerOptIn.findUnique({ where: { shop_phone: { shop, phone: p } } }).catch(() => null);
              if (opt && opt.optedIn) {
                customerOptInFound = true;
                break;
              }
            }
          }
        } catch (e) {
          // ignore
        }

        if (!acceptedMarketing && !whatsappOptIn && !customerOptInFound) {
        await db.notificationLog.create({
          data: {
            shop,
            shopifyOrderId,
            orderNumber,
            customerName,
            customerPhone: rawPhone || null,
            notificationType: "whatsapp",
            status: "failed",
            errorMessage: "customer_no_opt_in",
          },
        }).catch(() => null);

        return new Response();
      }
    }
  } catch (err) {
    // Settings/opt-in lookup failed: fail closed rather than sending with unknown eligibility.
    console.error(`[order-ping] eligibility_check_error shop=${shop} order=${shopifyOrderId}`, err);
    await db.notificationLog.create({
      data: {
        shop,
        shopifyOrderId,
        orderNumber,
        customerName,
        customerPhone: null,
        notificationType: "whatsapp",
        status: "failed",
        errorMessage: "eligibility_check_error",
      },
    }).catch(() => null);
    return new Response(null, { status: 500 });
  }

  console.log(`[order-ping] checkpoint phone_extracted rawPhone_present=${!!rawPhone}`);

  if (!rawPhone) {
    await db.notificationLog.create({
      data: {
        shop,
        shopifyOrderId,
        orderNumber,
        customerName,
        customerPhone: null,
        notificationType: "whatsapp",
        status: "failed",
        errorMessage: "no_customer_phone",
      },
    }).catch((e) => console.error("[order-ping] failed to write no_customer_phone log", e));

    return new Response();
  }

  const phone = normalizePhone(rawPhone, defaultCountry);
  console.log(`[order-ping] checkpoint phone_normalized ok=${!!phone}`);
  if (!phone) {
    await db.notificationLog.create({
      data: {
        shop,
        shopifyOrderId,
        orderNumber,
        customerName,
        customerPhone: rawPhone,
        notificationType: "whatsapp",
        status: "failed",
        errorMessage: "invalid_phone_format",
      },
    }).catch((e) => console.error("[order-ping] failed to write invalid_phone_format log", e));

    return new Response();
  }

  // Idempotency: avoid duplicate notifications
  try {
    const existing = await db.notificationLog.findUnique({
      where: {
        shop_shopifyOrderId_notificationType: {
          shop,
          shopifyOrderId,
          notificationType: "whatsapp",
        },
      },
    });

    if (existing) {
      console.log(`[order-ping] checkpoint duplicate_skip order=${shopifyOrderId}`);
      return new Response();
    }
  } catch (err) {
    console.error("[order-ping] idempotency_check_error (continuing)", err);
  }
  console.log(`[order-ping] checkpoint idempotency_passed`);

  // Create pending record
  let record;
  try {
    record = await db.notificationLog.create({
      data: {
        shop,
        shopifyOrderId,
        orderNumber,
        customerName,
        customerPhone: phone,
        notificationType: "whatsapp",
        status: "pending",
      },
    });
  } catch (err) {
    console.error("Failed to create notification log", err);
    return new Response(null, { status: 500 });
  }
  console.log(`[order-ping] checkpoint pending_record_created id=${record.id} template=${template.name}/${template.language} phoneNumberId=${credentials.phoneNumberId}`);

  // Process sending asynchronously so we return quickly.
  (async () => {
    try {
      const templateResult = await sendTemplateMessage({
        to: phone,
        templateName: template.name,
        language: template.language,
        accessToken: credentials.accessToken,
        phoneNumberId: credentials.phoneNumberId,
        apiVersion: credentials.apiVersion,
        components: await buildTemplateComponents(template, { customerName, orderNumber, shopifyOrderId, order, shop }),
      });

      const metaId = templateResult?.messages?.[0]?.id || null;
      await db.notificationLog.update({ where: { id: record.id }, data: { status: "sent", metaMessageId: metaId } });
      console.log(`[order-ping] notification_sent shop=${shop} order=${shopifyOrderId} metaId=${metaId}`);
    } catch (err) {
      console.error(`[order-ping] send_failed shop=${shop} order=${shopifyOrderId}`, err?.body || err?.message || err);
      await db.notificationLog.update({ where: { id: record.id }, data: { status: "failed", errorMessage: JSON.stringify(err?.body || err?.message || String(err)) } }).catch(() => null);
    }
  })();

  return new Response();
}
