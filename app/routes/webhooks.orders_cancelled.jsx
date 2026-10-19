import { authenticate } from "../shopify.server";
import { sendOrderStatusNotification, getCustomerNameFromOrder, REQUIRED_TEMPLATES } from "../services/order-events.server";

export const action = async ({ request }) => {
  try {
    const requestClone = request.clone();
    const { shop, topic } = await authenticate.webhook(request);
    console.log(`[order-ping] webhook_authenticated shop=${shop} topic=${topic}`);

    const order = await requestClone.json();

    sendOrderStatusNotification({
      shop,
      order,
      notificationType: "whatsapp_cancelled",
      template: REQUIRED_TEMPLATES.cancelled,
      buildVariables: () => [
        getCustomerNameFromOrder(order) || "Customer",
        String(order.order_number ?? order.name ?? order.id),
        order.cancel_reason || "N/A",
      ],
    }).catch((err) => console.error("[order-ping] whatsapp_cancelled unhandled error", err));

    return new Response();
  } catch (err) {
    console.error("[order-ping] UNHANDLED_ERROR in orders_cancelled webhook:", err?.stack || err);
    return new Response(null, { status: 500 });
  }
};
