import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory GDPR webhook: 48 hours after uninstall, erase all shop data.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[order-ping] gdpr webhook received topic=${topic} shop=${shop}`);

  await Promise.all([
    db.notificationLog.deleteMany({ where: { shop } }).catch(() => null),
    db.customerOptIn.deleteMany({ where: { shop } }).catch(() => null),
    db.appSetting.deleteMany({ where: { shop } }).catch(() => null),
    db.session.deleteMany({ where: { shop } }).catch(() => null),
  ]);

  return new Response();
};
