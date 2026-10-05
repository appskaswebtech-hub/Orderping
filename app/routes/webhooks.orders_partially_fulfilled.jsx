import { authenticate } from "../shopify.server";
import { sendOrderStatusNotification, getCustomerNameFromOrder } from "../services/order-events.server";

export const action = async ({ request }) => {
  try {
    const requestClone = request.clone();
    const { shop, topic } = await authenticate.webhook(request);
    console.log(`[order-ping] webhook_authenticated shop=${shop} topic=${topic}`);

    const order = await requestClone.json();

    sendOrderStatusNotification({
      shop,
      order,
      notificationType: "whatsapp_partially_fulfilled",
      templateEnvKey: "META_TEMPLATE_NAME_PARTIALLY_FULFILLED",
      templateLanguageEnvKey: "META_TEMPLATE_LANGUAGE_PARTIALLY_FULFILLED",
      buildVariables: () => [getCustomerNameFromOrder(order) || "Customer", String(order.order_number ?? order.name ?? order.id)],
    }).catch((err) => console.error("[order-ping] whatsapp_partially_fulfilled unhandled error", err));

    return new Response();
  } catch (err) {
    console.error("[order-ping] UNHANDLED_ERROR in orders_partially_fulfilled webhook:", err?.stack || err);
    return new Response(null, { status: 500 });
  }
};
