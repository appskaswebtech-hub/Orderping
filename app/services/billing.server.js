import { redirect } from "react-router";
import db from "../db.server";
import { PAID_PLANS, PLAN_MESSAGE_LIMITS } from "../shopify.server";

/**
 * Shopify's Billing API has no real concept of a free plan — an AppSubscription
 * line item needs a positive amount. So "free for development stores" is modeled
 * by skipping the billing gate entirely for dev stores, rather than creating a
 * $0 subscription. Only real (live) stores are required to subscribe to one of
 * PAID_PLANS.
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
 * active subscription to one of PAID_PLANS are redirected to our own Billing
 * page instead of straight to Shopify's external confirmation screen, so they
 * see the plans and their features before being asked to pay.
 *
 * Also persists the active plan's message limit onto the shop's AppSetting
 * row (MESSAGE_LIMIT), since webhooks enforcing the quota run outside any
 * request's billing context and need a cheap way to read it.
 */
export async function requireActivePlan({ admin, billing, shop }) {
  const isDevStore = await isDevelopmentStore(admin);
  if (isDevStore) return;

  const result = await billing.require({
    plans: PAID_PLANS,
    onFailure: async () => redirect("/app/billing"),
  });

  if (shop) {
    const activePlanName = result?.appSubscriptions?.[0]?.name;
    const limit = PLAN_MESSAGE_LIMITS[activePlanName];
    const value = limit == null ? "" : String(limit);
    await db.appSetting
      .upsert({
        where: { shop_key: { shop, key: "MESSAGE_LIMIT" } },
        update: { value },
        create: { shop, key: "MESSAGE_LIMIT", value },
      })
      .catch(() => null);
  }
}
