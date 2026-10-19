import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory GDPR webhook: erase this customer's personal data.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[order-ping] gdpr webhook received topic=${topic} shop=${shop} customer=${payload?.customer?.id}`);

  const phone = payload?.customer?.phone;
  if (phone) {
    await db.customerOptIn.deleteMany({ where: { shop, phone } }).catch(() => null);
  }

  const ordersToRedact = payload?.orders_to_redact || [];
  if (ordersToRedact.length > 0) {
    await db.notificationLog
      .updateMany({
        where: { shop, shopifyOrderId: { in: ordersToRedact.map(String) } },
        data: { customerName: null, customerPhone: null },
      })
      .catch(() => null);
  }

  return new Response();
};
