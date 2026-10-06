import { useLoaderData, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, PRO_PLAN } from "../shopify.server";
import { isDevelopmentStore } from "../services/billing.server";

export const loader = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);
  const isDevStore = await isDevelopmentStore(admin);

  if (isDevStore) {
    return { isDevStore: true, subscription: null };
  }

  const { appSubscriptions } = await billing.check({ plans: [PRO_PLAN] });
  return { isDevStore: false, subscription: appSubscriptions[0] || null };
};

export const action = async ({ request }) => {
  const { billing } = await authenticate.admin(request);
  // Only reachable from this page's own form, which only renders the
  // subscribe button for non-dev stores, but billing.request() would reject
  // the wrong plan name anyway if that ever changed.
  await billing.request({ plan: PRO_PLAN });
};

const COLORS = { sent: "#1FA97B", gold: "#B4791E", goldSoft: "#FBF0DC", goldBorder: "#EED9AE" };
const cardBase = {
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 12px rgba(16,24,40,0.05)",
  border: "1px solid rgba(16,24,40,0.04)",
  padding: "24px 28px",
};

export default function Billing() {
  const { isDevStore, subscription } = useLoaderData();
  const submit = useSubmit();

  const onSubscribe = () => submit(null, { method: "post" });

  return (
    <s-page heading="Billing">
      <div style={{ background: "linear-gradient(180deg, #FDFAF4 0%, #F8F1E4 100%)", minHeight: "100%", padding: "4px 0" }}>
        <s-stack direction="block" gap="loose">
          <div style={cardBase}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginBottom: 16 }}>Current plan</div>

            {isDevStore ? (
              <s-stack direction="block" gap="base">
                <s-badge tone="success" size="large">Free — development store</s-badge>
                <div style={{ fontSize: 13, color: "#8a8f98" }}>
                  Development stores aren't charged. This store will be billed ${"4.99"}/month only once it
                  becomes a live store.
                </div>
              </s-stack>
            ) : subscription ? (
              <s-stack direction="block" gap="base">
                <s-badge tone="success" size="large">Subscribed — {subscription.name}</s-badge>
                <div style={{ fontSize: 13, color: "#8a8f98" }}>
                  Status: {subscription.status}
                </div>
              </s-stack>
            ) : (
              <s-stack direction="block" gap="base">
                <s-badge tone="warning" size="large">Not subscribed</s-badge>
                <div style={{ fontSize: 13, color: "#8a8f98" }}>
                  OrderPing is $4.99/month for live stores. Subscribe to keep sending WhatsApp order
                  notifications.
                </div>
                <div>
                  <button
                    type="button"
                    onClick={onSubscribe}
                    style={{
                      padding: "12px 22px",
                      borderRadius: 10,
                      border: "none",
                      background: COLORS.sent,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Subscribe — $4.99/month
                  </button>
                </div>
              </s-stack>
            )}
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
