import { authenticate } from "../shopify.server";
import { fetchOrderById, sendOrderStatusNotification, getCustomerNameFromOrder } from "../services/order-events.server";

export const action = async ({ request }) => {
  try {
    const requestClone = request.clone();
    const { shop, topic } = await authenticate.webhook(request);
    console.log(`[order-ping] webhook_authenticated shop=${shop} topic=${topic}`);

    const fulfillment = await requestClone.json();
    const orderId = fulfillment?.order_id;
    if (!orderId) return new Response();

    const order = await fetchOrderById(shop, orderId);
    if (!order) return new Response();

    const trackingNumber = fulfillment?.tracking_number || "";
    const trackingCompany = fulfillment?.tracking_company || "";
    const trackingUrl = fulfillment?.tracking_url || fulfillment?.tracking_urls?.[0] || "";
    const trackingInfo =
      [trackingCompany, trackingNumber].filter(Boolean).join(" - ") || trackingUrl || "Tracking details to follow";

    sendOrderStatusNotification({
      shop,
      order,
      notificationType: "whatsapp_shipped",
      templateEnvKey: "META_TEMPLATE_NAME_SHIPPED",
      templateLanguageEnvKey: "META_TEMPLATE_LANGUAGE_SHIPPED",
      buildVariables: () => [
        getCustomerNameFromOrder(order) || "Customer",
        String(order.order_number ?? order.name ?? orderId),
        trackingInfo,
      ],
    }).catch((err) => console.error("[order-ping] whatsapp_shipped unhandled error", err));

    return new Response();
  } catch (err) {
    console.error("[order-ping] UNHANDLED_ERROR in fulfillments_create webhook:", err?.stack || err);
    return new Response(null, { status: 500 });
  }
};
