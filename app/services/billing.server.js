import { redirect } from "react-router";
import { PAID_PLANS } from "../shopify.server";
import db from "../db.server";

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

export async function hasNotificationPlan(shop) {
  try {
    const session = await db.session.findFirst({ where: { shop, isOnline: false } });
    if (!session?.accessToken) return false;

    const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({
        query: `#graphql
          query NotificationPlanEligibility {
            shop {
              plan {
                partnerDevelopment
              }
            }
            currentAppInstallation {
              activeSubscriptions {
                name
                status
                test
              }
            }
          }
        `,
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify subscription check failed with status ${response.status}`);
    }

    const result = await response.json();
    if (result.errors?.length) {
      throw new Error(`Shopify subscription check failed: ${JSON.stringify(result.errors)}`);
    }

    if (result.data?.shop?.plan?.partnerDevelopment === true) return true;

    return result.data?.currentAppInstallation?.activeSubscriptions?.some(
      (subscription) =>
        PAID_PLANS.includes(subscription.name) &&
        subscription.status === "ACTIVE" &&
        subscription.test === false,
    ) ?? false;
  } catch (error) {
    console.error(`[order-ping] notification_plan_check_error shop=${shop}`, error);
    return false;
  }
}

/**
 * Call this at the top of every page's loader except /app/billing itself
 * (calling it there too would redirect a live, unsubscribed store to itself in
 * a loop). Development stores pass through for free; live stores without an
 * active PRO_PLAN subscription are redirected to our own Billing page instead
 * of straight to Shopify's external confirmation screen, so they see the plan
 * and its features before being asked to pay.
 */
export async function requireActivePlan({ admin, billing, request, shop }) {
  const isDevStore = await isDevelopmentStore(admin);
  if (isDevStore) return;

  const requestUrl = new URL(request.url);
  const billingUrl = new URL("/app/billing", requestUrl);
  const shopDomain = shop || requestUrl.searchParams.get("shop");
  if (shopDomain) billingUrl.searchParams.set("shop", shopDomain);
  for (const key of ["host", "embedded", "locale"]) {
    const value = requestUrl.searchParams.get(key);
    if (value) billingUrl.searchParams.set(key, value);
  }

  await billing.require({
    plans: PAID_PLANS,
    isTest: false,
    onFailure: async () => redirect(`${billingUrl.pathname}${billingUrl.search}`),
  });
}
