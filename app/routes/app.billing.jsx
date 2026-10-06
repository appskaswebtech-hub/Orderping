import { useLoaderData, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, PAID_PLANS } from "../shopify.server";
import { isDevelopmentStore } from "../services/billing.server";

export const loader = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);
  const isDevStore = await isDevelopmentStore(admin);

  if (isDevStore) {
    return { isDevStore: true, subscription: null };
  }

  const { appSubscriptions } = await billing.check({ plans: PAID_PLANS });
  return { isDevStore: false, subscription: appSubscriptions[0] || null };
};

export const action = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);
  const isDevStore = await isDevelopmentStore(admin);
  // Dev stores are free and never reach a Subscribe button, but guard the
  // action itself too, in case of a direct/replayed POST.
  if (isDevStore) return new Response(null, { status: 400 });

  const form = await request.formData();
  const plan = form.get("plan");
  if (!PAID_PLANS.includes(plan)) return new Response(null, { status: 400 });

  // Switching plans: cancel the current subscription first, Shopify doesn't
  // let a shop hold two active AppSubscriptions from the same app at once.
  const { appSubscriptions } = await billing.check({ plans: PAID_PLANS });
  const existing = appSubscriptions[0];
  if (existing && existing.name !== plan) {
    await billing.cancel({ subscriptionId: existing.id });
  }

  await billing.request({ plan });
};

const COLORS = { sent: "#1FA97B", gold: "#B4791E", goldSoft: "#FBF0DC", goldBorder: "#EED9AE" };
const pageBg = { background: "linear-gradient(180deg, #FDFAF4 0%, #F8F1E4 100%)", minHeight: "100%", padding: "4px 0" };

function planCard({ isCurrent }) {
  return {
    flex: 1,
    minWidth: 250,
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 12px rgba(16,24,40,0.05)",
    border: isCurrent ? `2px solid ${COLORS.sent}` : "1px solid rgba(16,24,40,0.04)",
    padding: "28px 28px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  };
}

const FREE_FEATURES = [
  "Automatic WhatsApp order confirmations, with a product image and order link",
  "Shipped, out for delivery, and delivered status updates",
  "Refund initiated, order cancelled, and payment confirmed notifications",
  "Full notification history log",
  "Unlimited messages while testing, free for development stores",
];

const SHARED_PAID_FEATURES = [
  "All 8 order and shipment WhatsApp notification types",
  "Full notification history log",
  "Customer opt-in controls",
];

// Plain string literals, not the BASIC_PLAN/PRO_PLAN/ADVANCED_PLAN constants
// from shopify.server.js — that module is server-only, and importing it for
// use in this component (not just loader/action) would pull server code
// into the client bundle. These values must stay in sync with that file.
const PLAN_DEFS = [
  {
    plan: "Basic Plan",
    price: "$3.99",
    tagline: "Basic Plan",
    features: ["Up to 500 messages per month", ...SHARED_PAID_FEATURES],
  },
  {
    plan: "Pro Plan",
    price: "$5.99",
    tagline: "Pro Plan",
    features: ["Up to 1,000 messages per month", ...SHARED_PAID_FEATURES],
  },
  {
    plan: "Advanced Plan",
    price: "$9.99",
    tagline: "Advanced Plan",
    features: ["Unlimited messages", ...SHARED_PAID_FEATURES, "Priority support"],
  },
];

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.sent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function FeatureList({ features }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
      {features.map((f) => (
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

function CurrentBadge() {
  return (
    <div style={{ position: "absolute", top: 20, right: 24 }}>
      <s-badge tone="success">Current plan</s-badge>
    </div>
  );
}

export default function Billing() {
  const { isDevStore, subscription } = useLoaderData();
  const submit = useSubmit();

  const onSelectPlan = (plan) => {
    const form = new FormData();
    form.append("plan", plan);
    submit(form, { method: "post" });
  };

  return (
    <s-page heading="Billing">
      <div style={pageBg}>
        <s-stack direction="block" gap="loose">
          <s-stack direction="inline" gap="base">
            <div style={planCard({ isCurrent: isDevStore })}>
              {isDevStore && <CurrentBadge />}
              <s-badge tone="neutral">Development stores</s-badge>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#14181f", marginTop: 14 }}>$0 / month</div>
              <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600, marginTop: 2 }}>Free Plan</div>
              <FeatureList features={FREE_FEATURES} />
              {!isDevStore && (
                <div style={{ fontSize: 12, color: "#8a8f98", marginTop: 18 }}>
                  Only available on development/test stores. This store is live, so pick a plan on the right.
                </div>
              )}
            </div>

            {PLAN_DEFS.map((def) => {
              const isCurrent = !isDevStore && subscription?.name === def.plan;
              return (
                <div key={def.plan} style={planCard({ isCurrent })}>
                  {isCurrent && <CurrentBadge />}
                  <s-badge tone="neutral">Live stores</s-badge>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#14181f", marginTop: 14 }}>{def.price} / month</div>
                  <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600, marginTop: 2 }}>{def.tagline}</div>
                  <FeatureList features={def.features} />

                  {!isDevStore && !isCurrent && (
                    <div style={{ marginTop: 22 }}>
                      <button
                        type="button"
                        onClick={() => onSelectPlan(def.plan)}
                        style={{
                          width: "100%",
                          padding: "12px 18px",
                          borderRadius: 10,
                          border: "none",
                          background: COLORS.sent,
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {subscription ? "Switch to this plan" : `Subscribe for ${def.price}/month`}
                      </button>
                    </div>
                  )}
                  {isCurrent && (
                    <div style={{ fontSize: 12, color: "#8a8f98", marginTop: 18 }}>Status: {subscription.status}</div>
                  )}
                </div>
              );
            })}
          </s-stack>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
