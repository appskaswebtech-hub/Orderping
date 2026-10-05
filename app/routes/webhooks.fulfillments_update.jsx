import { authenticate } from "../shopify.server";
import { fetchOrderById, sendOrderStatusNotification, getCustomerNameFromOrder } from "../services/order-events.server";

// Carrier-reported shipment_status values we care about. Everything else
// (label_printed, in_transit, confirmed, etc.) is ignored — not every status
// update is worth a WhatsApp message.
const STATUS_MAP = {
  out_for_delivery: {
    notificationType: "whatsapp_out_for_delivery",
    templateEnvKey: "META_TEMPLATE_NAME_OUT_FOR_DELIVERY",
    templateLanguageEnvKey: "META_TEMPLATE_LANGUAGE_OUT_FOR_DELIVERY",
  },
  delivered: {
    notificationType: "whatsapp_delivered",
    templateEnvKey: "META_TEMPLATE_NAME_DELIVERED",
    templateLanguageEnvKey: "META_TEMPLATE_LANGUAGE_DELIVERED",
  },
};

export const action = async ({ request }) => {
  try {
    const requestClone = request.clone();
    const { shop, topic } = await authenticate.webhook(request);
    console.log(`[order-ping] webhook_authenticated shop=${shop} topic=${topic}`);

    const fulfillment = await requestClone.json();
    const mapping = STATUS_MAP[fulfillment?.shipment_status];
    if (!mapping) return new Response();

    const orderId = fulfillment?.order_id;
    if (!orderId) return new Response();

    const order = await fetchOrderById(shop, orderId);
    if (!order) return new Response();

    sendOrderStatusNotification({
      shop,
      order,
      ...mapping,
      buildVariables: () => [getCustomerNameFromOrder(order) || "Customer", String(order.order_number ?? order.name ?? orderId)],
    }).catch((err) => console.error(`[order-ping] ${mapping.notificationType} unhandled error`, err));

    return new Response();
  } catch (err) {
    console.error("[order-ping] UNHANDLED_ERROR in fulfillments_update webhook:", err?.stack || err);
    return new Response(null, { status: 500 });
  }
};
