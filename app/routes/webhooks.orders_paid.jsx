import { authenticate } from "../shopify.server";
import { sendOrderStatusNotification, getCustomerNameFromOrder } from "../services/order-events.server";

function buildTotal(order) {
  const total = order?.total_price ?? order?.current_total_price;
  if (total == null) return "N/A";
  const currency = order?.currency || "";
  return currency ? `${currency} ${total}` : String(total);
}

export const action = async ({ request }) => {
  try {
    const requestClone = request.clone();
    const { shop, topic } = await authenticate.webhook(request);
    console.log(`[order-ping] webhook_authenticated shop=${shop} topic=${topic}`);

    const order = await requestClone.json();

    sendOrderStatusNotification({
      shop,
      order,
      notificationType: "whatsapp_paid",
      templateEnvKey: "META_TEMPLATE_NAME_PAID",
      templateLanguageEnvKey: "META_TEMPLATE_LANGUAGE_PAID",
      buildVariables: () => [
        getCustomerNameFromOrder(order) || "Customer",
        String(order.order_number ?? order.name ?? order.id),
        buildTotal(order),
      ],
    }).catch((err) => console.error("[order-ping] whatsapp_paid unhandled error", err));

    return new Response();
  } catch (err) {
    console.error("[order-ping] UNHANDLED_ERROR in orders_paid webhook:", err?.stack || err);
    return new Response(null, { status: 500 });
  }
};
