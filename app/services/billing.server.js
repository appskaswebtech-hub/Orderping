import { redirect } from "react-router";
import { PRO_PLAN } from "../shopify.server";

/**
 * Shopify's Billing API has no real concept of a free plan — an AppSubscription
 * line item needs a positive amount. So "free for development stores" is modeled
 * by skipping the billing gate entirely for dev stores, rather than creating a
 * $0 subscription. Only real (live) stores are required to subscribe to PRO_PLAN.
 */
export async function isDevelopmentStore(admin) {
  const response = await admin.graphql(`#graphql
    query ShopPlan {
      shop {
        plan {
          partnerDevelopment
        }
      }
    }
  `);
  const data = await response.json();
  return data?.data?.shop?.plan?.partnerDevelopment === true;
}

/**
 * Call this at the top of every page's loader except /app/billing itself
 * (calling it there too would redirect a live, unsubscribed store to itself in
 * a loop). Development stores pass through for free; live stores without an
 * active PRO_PLAN subscription are redirected to our own Billing page instead
 * of straight to Shopify's external confirmation screen, so they see the plan
 * and its features before being asked to pay.
 */
export async function requireActivePlan({ admin, billing }) {
  const isDevStore = await isDevelopmentStore(admin);
  if (isDevStore) return;

  await billing.require({
    plans: [PRO_PLAN],
    onFailure: async () => redirect("/app/billing"),
  });
}
