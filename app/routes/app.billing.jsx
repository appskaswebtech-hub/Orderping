import { Link, useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, PAID_PLANS } from "../shopify.server";
import { isDevelopmentStore } from "../services/billing.server";

export const loader = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);
  const isDevStore = await isDevelopmentStore(admin);

  if (isDevStore) {
    return { isDevStore: true, subscription: null };
  }

  const { appSubscriptions } = await billing.check({
    plans: PAID_PLANS,
    isTest: false,
  });
  return { isDevStore: false, subscription: appSubscriptions[0] || null };
};

export const action = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);
  const isDevStore = await isDevelopmentStore(admin);
  // Dev stores are free and never reach the Subscribe button, but guard the
  // action itself too, in case of a direct/replayed POST.
  if (isDevStore) return new Response(null, { status: 400 });

  await billing.request({ plan: PAID_PLANS[0], isTest: false });
};

import PreferencesIcon from "../components/PreferencesIcon";

const FREE_FEATURES = [
  "Automatic WhatsApp order confirmations, with a product image and order link",
  "Shipped, out for delivery, and delivered status updates",
  "Refund initiated, order cancelled, and payment confirmed notifications",
  "Full notification history log",
  "Unlimited messages while testing, free for development stores",
];

const PRO_FEATURES = [
  "8 Order & Shipment WhatsApp Notifications",
  "Unlimited messages",
  "Full notification history log",
  "Customer opt-in controls",
  "Priority support",
];

/* eslint-disable react/prop-types -- Receives the local plan feature arrays. */
function FeatureList({ features }) {
  return (
    <ul className="op-plan-features">
      {features.map((feature) => (
        <li key={feature}>
          <span>
            <PreferencesIcon name="check" size={15} />
          </span>
          {feature}
        </li>
      ))}
    </ul>
  );
}
/* eslint-enable react/prop-types */

export default function Billing() {
  const { isDevStore, subscription } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubscribedToPro = !isDevStore && !!subscription;
  const isSubscribing = navigation.state !== "idle";
  const onSubscribe = () => submit(null, { method: "post" });

  return (
    <s-page heading="Billing">
      <div className="op-preferences op-billing">
        <header className="op-page-header">
          <div>
            <div className="op-kicker">BUILT TO GROW WITH YOU</div>
            <h1>Plans & billing</h1>
            <p>
              Keep customers connected, from your first order to your next
              milestone.
            </p>
          </div>
          <span className="op-billing-trust">
            <PreferencesIcon name="shield" size={16} />
            Billed through Shopify
          </span>
        </header>

        <section className="op-billing-overview">
          <span className="op-connection-icon">
            <PreferencesIcon name="card" size={25} />
          </span>
          <div className="op-connection-copy">
            <span className="op-kicker">YOUR SUBSCRIPTION</span>
            <h2>
              {isDevStore
                ? "Development plan"
                : isSubscribedToPro
                  ? "You're on Pro"
                  : "Ready for your next chapter?"}
            </h2>
            <p>
              {isDevStore
                ? "Build, test, and get everything ready. Your development store is covered."
                : isSubscribedToPro
                  ? "Your store has access to all Pro features and unlimited messages."
                  : "Activate Pro to start sending WhatsApp order updates on your live store."}
            </p>
          </div>
          <div className="op-overview-price">
            {isDevStore || isSubscribedToPro ? (
              <>
                <strong>
                  {isDevStore ? "$0" : "$15.99"}
                  <small> USD / month</small>
                </strong>
                <span className="op-pill op-pill-success">
                  <span className="op-status-dot" />
                  {isDevStore
                    ? "Free for development"
                    : `Status: ${subscription.status}`}
                </span>
              </>
            ) : (
              <span className="op-pill op-pill-warning">
                No active subscription
              </span>
            )}
          </div>
        </section>

        <div className="op-plans-heading">
          <h2>A simple plan for every stage</h2>
          <p>
            All the order updates your customers need. One place to manage them.
          </p>
        </div>
        <div className="op-plans-grid">
          <section
            className={`op-plan-card ${isDevStore ? "op-plan-current" : ""}`}
          >
            <div className="op-plan-top">
              <span className="op-plan-icon">
                <PreferencesIcon name="key" size={22} />
              </span>
              <span className="op-pill">Development stores</span>
            </div>
            <h2>Free</h2>
            <p className="op-plan-description">
              A little room to build something great.
            </p>
            <div className="op-plan-price">
              $0<span> USD / month</span>
            </div>
            <p className="op-plan-caption">
              For development and test stores only
            </p>
            <div className="op-plan-divider" />
            <h3>Everything you need to get started</h3>
            <FeatureList features={FREE_FEATURES} />
            <div className="op-plan-footer">
              {isDevStore ? (
                <div className="op-plan-current-label">
                  <PreferencesIcon name="check" size={17} />
                  Your current plan
                </div>
              ) : (
                <div className="op-plan-availability">
                  Available on development stores only
                </div>
              )}
              <p>
                {isDevStore
                  ? "Free while you build and test your store."
                  : "Running a live store? Pro has you covered."}
              </p>
            </div>
          </section>

          <section
            className={`op-plan-card op-plan-pro ${isSubscribedToPro ? "op-plan-current" : ""}`}
          >
            <div className="op-plan-ribbon">
              <PreferencesIcon name="bolt" size={14} />
              MADE FOR LIVE STORES
            </div>
            <div className="op-plan-top">
              <span className="op-plan-icon">
                <PreferencesIcon name="bolt" size={22} />
              </span>
              <span className="op-pill op-pill-success">
                All features included
              </span>
            </div>
            <h2>Pro</h2>
            <p className="op-plan-description">
              Better updates. Happier customers.
            </p>
            <div className="op-plan-price">
              $15.99<span> USD / month</span>
            </div>
            <p className="op-plan-caption">One plan. Unlimited messages.</p>
            <div className="op-plan-divider" />
            <h3>Your customer communication toolkit</h3>
            <FeatureList features={PRO_FEATURES} />
            <div className="op-plan-footer">
              {isSubscribedToPro ? (
                <div className="op-plan-current-label">
                  <PreferencesIcon name="check" size={17} />
                  Your current plan
                </div>
              ) : isDevStore ? (
                <div className="op-plan-availability">
                  Available when your store goes live
                </div>
              ) : (
                <button
                  type="button"
                  className="op-button op-button-primary op-subscribe-button"
                  onClick={onSubscribe}
                  disabled={isSubscribing}
                >
                  {isSubscribing ? "Opening Shopify..." : "Subscribe to Pro"}
                  <PreferencesIcon name="arrow" size={17} />
                </button>
              )}
              <p>
                {isSubscribedToPro
                  ? "You're all set. Keep your customers in the loop."
                  : isDevStore
                    ? "Keep testing for free on your development plan."
                    : "You'll review and approve the charge in Shopify."}
              </p>
            </div>
          </section>
        </div>

        <div className="op-billing-notes">
          <div>
            <span className="op-section-icon">
              <PreferencesIcon name="shield" />
            </span>
            <div>
              <h3>Simple, secure billing</h3>
              <p>
                Your subscription is handled through Shopify, so you can easily
                keep track of your app charges.
              </p>
            </div>
          </div>
          <div>
            <span className="op-section-icon">
              <PreferencesIcon name="chat" />
            </span>
            <div>
              <h3>Need a hand?</h3>
              <p>
                Have a billing question?{" "}
                <a href="mailto:apps.kaswebtech@gmail.com">
                  Get in touch with our team.
                </a>
              </p>
            </div>
          </div>
        </div>
        <div className="op-billing-bottom">
          <PreferencesIcon name="chat" size={16} />
          <span>Make every order feel personal.</span>
          <Link to="/app/settings" className="op-text-link">
            Go to settings <PreferencesIcon name="arrow" size={15} />
          </Link>
        </div>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
