import { authenticate } from "../shopify.server";

// Mandatory GDPR webhook: a customer has requested a copy of their data.
// This app stores order/customer phone numbers and names in NotificationLog
// and CustomerOptIn. Fulfilling the actual data export is a manual/support
// process; this handler just acknowledges receipt so Shopify stops retrying.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[order-ping] gdpr webhook received topic=${topic} shop=${shop} customer=${payload?.customer?.id}`);
  return new Response();
};
