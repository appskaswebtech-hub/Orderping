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
  const { admin, billing } = await authenticate.admin(request);
  const isDevStore = await isDevelopmentStore(admin);
  // Dev stores are free and never reach the Subscribe button, but guard the
  // action itself too, in case of a direct/replayed POST.
  if (isDevStore) return new Response(null, { status: 400 });

  await billing.request({ plan: PRO_PLAN });
};

const COLORS = { sent: "#1FA97B", gold: "#B4791E", goldSoft: "#FBF0DC", goldBorder: "#EED9AE" };
const pageBg = { background: "linear-gradient(180deg, #FDFAF4 0%, #F8F1E4 100%)", minHeight: "100%", padding: "4px 0" };
const cardBase = {
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 12px rgba(16,24,40,0.05)",
  border: "1px solid rgba(16,24,40,0.04)",
  padding: "28px 32px",
};

const FEATURES = [
  "Automatic WhatsApp order confirmations, with a product image and order link",
  "Shipped, out for delivery, and delivered status updates",
  "Refund initiated, order cancelled, and payment confirmed notifications",
  "Customizable message template and language",
  "Full notification history log — every send attempt and its status",
  "Customer opt-in controls",
];

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.sent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function FeatureList() {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
      {FEATURES.map((f) => (
        <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#202223" }}>
          <span style={{ marginTop: 2, flexShrink: 0 }}>
            <CheckIcon />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}

export default function Billing() {
  const { isDevStore, subscription } = useLoaderData();
  const submit = useSubmit();

  const onSubscribe = () => submit(null, { method: "post" });

  return (
    <s-page heading="Billing">
      <div style={pageBg}>
        <s-stack direction="block" gap="loose">
          {isDevStore ? (
            <div style={cardBase}>
              <s-badge tone="success" size="large">Free — development store</s-badge>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#14181f", marginTop: 14 }}>$0 / month</div>
              <div style={{ fontSize: 13, color: "#8a8f98", marginTop: 4 }}>
                Development stores are never charged. This store moves to the $4.99/month Pro Plan
                automatically only once it becomes a live store — all features are available right
                now at no cost for testing.
              </div>
              <FeatureList />
            </div>
          ) : (
            <div style={cardBase}>
              {subscription ? (
                <>
                  <s-badge tone="success" size="large">Subscribed — {subscription.name}</s-badge>
                  <div style={{ fontSize: 13, color: "#8a8f98", marginTop: 8 }}>Status: {subscription.status}</div>
                </>
              ) : (
                <>
                  <s-badge tone="warning" size="large">Not subscribed</s-badge>
                  <div style={{ fontSize: 13, color: "#8a8f98", marginTop: 8 }}>
                    Subscribe to unlock OrderPing for this store.
                  </div>
                </>
              )}

              <div style={{ fontSize: 24, fontWeight: 800, color: "#14181f", marginTop: 18 }}>$4.99 / month</div>
              <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600 }}>Pro Plan</div>

              <FeatureList />

              {!subscription && (
                <div style={{ marginTop: 22 }}>
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
              )}
            </div>
          )}
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
