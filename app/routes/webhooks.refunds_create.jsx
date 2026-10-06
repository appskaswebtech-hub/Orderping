import { authenticate } from "../shopify.server";
import { fetchOrderById, sendOrderStatusNotification, getCustomerNameFromOrder, REQUIRED_TEMPLATES } from "../services/order-events.server";

function refundAmount(refund) {
  const total = (refund?.transactions || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const currency = refund?.transactions?.[0]?.currency || "";
  return currency ? `${currency} ${total.toFixed(2)}` : total.toFixed(2);
}

export const action = async ({ request }) => {
  try {
    const requestClone = request.clone();
    const { shop, topic } = await authenticate.webhook(request);
    console.log(`[order-ping] webhook_authenticated shop=${shop} topic=${topic}`);

    const refund = await requestClone.json();
    const orderId = refund?.order_id;
    if (!orderId) return new Response();

    const order = await fetchOrderById(shop, orderId);
    if (!order) return new Response();

    sendOrderStatusNotification({
      shop,
      order,
      notificationType: "whatsapp_refund",
      template: REQUIRED_TEMPLATES.refundInitiated,
      buildVariables: () => [
        getCustomerNameFromOrder(order) || "Customer",
        String(order.order_number ?? order.name ?? orderId),
        refundAmount(refund),
      ],
    }).catch((err) => console.error("[order-ping] whatsapp_refund unhandled error", err));

    return new Response();
  } catch (err) {
    console.error("[order-ping] UNHANDLED_ERROR in refunds_create webhook:", err?.stack || err);
    return new Response(null, { status: 500 });
  }
};
