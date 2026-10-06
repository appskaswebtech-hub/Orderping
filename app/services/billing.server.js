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
