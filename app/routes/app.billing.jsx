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
import { useTranslation } from "../i18n/LanguageContext";

const FREE_FEATURE_KEYS = [
  "billing.freeFeature1",
  "billing.freeFeature2",
  "billing.freeFeature3",
  "billing.freeFeature4",
  "billing.freeFeature5",
];

const PRO_FEATURE_KEYS = [
  "billing.proFeature1",
  "billing.proFeature2",
  "billing.proFeature3",
  "billing.proFeature4",
  "billing.proFeature5",
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
  const { t } = useTranslation();
  const { isDevStore, subscription } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubscribedToPro = !isDevStore && !!subscription;
  const isSubscribing = navigation.state !== "idle";
  const onSubscribe = () => submit(null, { method: "post" });
  const freeFeatures = FREE_FEATURE_KEYS.map((key) => t(key));
  const proFeatures = PRO_FEATURE_KEYS.map((key) => t(key));

  return (
    <s-page heading={t("billing.heading")}>
      <div className="op-preferences op-billing">
        <header className="op-page-header">
          <div>
            <div className="op-kicker">{t("billing.kicker")}</div>
            <h1>{t("billing.heading")}</h1>
            <p>{t("billing.subheading")}</p>
          </div>
          <span className="op-billing-trust">
            <PreferencesIcon name="shield" size={16} />
            {t("billing.billedThroughShopify")}
          </span>
        </header>

        <section className="op-billing-overview">
          <span className="op-connection-icon">
            <PreferencesIcon name="card" size={25} />
          </span>
          <div className="op-connection-copy">
            <span className="op-kicker">{t("billing.yourSubscription")}</span>
            <h2>
              {isDevStore
                ? t("billing.devPlanTitle")
                : isSubscribedToPro
                  ? t("billing.proTitle")
                  : t("billing.readyTitle")}
            </h2>
            <p>
              {isDevStore
                ? t("billing.devPlanBody")
                : isSubscribedToPro
                  ? t("billing.proBody")
                  : t("billing.readyBody")}
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
                    ? t("billing.freeForDev")
                    : t("billing.statusLabel", { status: subscription.status })}
                </span>
              </>
            ) : (
              <span className="op-pill op-pill-warning">
                {t("billing.noActiveSubscription")}
              </span>
            )}
          </div>
        </section>

        <div className="op-plans-heading">
          <h2>{t("billing.plansHeading")}</h2>
          <p>{t("billing.plansSubheading")}</p>
        </div>
        <div className="op-plans-grid">
          <section
            className={`op-plan-card ${isDevStore ? "op-plan-current" : ""}`}
          >
            <div className="op-plan-top">
              <span className="op-plan-icon">
                <PreferencesIcon name="key" size={22} />
              </span>
              <span className="op-pill">{t("billing.devStoresPill")}</span>
            </div>
            <h2>{t("billing.free")}</h2>
            <p className="op-plan-description">{t("billing.freeDescription")}</p>
            <div className="op-plan-price">
              $0<span> USD / month</span>
            </div>
            <p className="op-plan-caption">{t("billing.freeCaption")}</p>
            <div className="op-plan-divider" />
            <h3>{t("billing.freeFeaturesHeading")}</h3>
            <FeatureList features={freeFeatures} />
            <div className="op-plan-footer">
              {isDevStore ? (
                <div className="op-plan-current-label">
                  <PreferencesIcon name="check" size={17} />
                  {t("billing.currentPlan")}
                </div>
              ) : (
                <div className="op-plan-availability">
                  {t("billing.devOnlyAvailability")}
                </div>
              )}
              <p>
                {isDevStore
                  ? t("billing.freeWhileBuilding")
                  : t("billing.liveStoreCovered")}
              </p>
            </div>
          </section>

          <section
            className={`op-plan-card op-plan-pro ${isSubscribedToPro ? "op-plan-current" : ""}`}
          >
            <div className="op-plan-ribbon">
              <PreferencesIcon name="bolt" size={14} />
              {t("billing.madeForLiveStores")}
            </div>
            <div className="op-plan-top">
              <span className="op-plan-icon">
                <PreferencesIcon name="bolt" size={22} />
              </span>
              <span className="op-pill op-pill-success">
                {t("billing.allFeaturesIncluded")}
              </span>
            </div>
            <h2>{t("billing.pro")}</h2>
            <p className="op-plan-description">{t("billing.proDescription")}</p>
            <div className="op-plan-price">
              $15.99<span> USD / month</span>
            </div>
            <p className="op-plan-caption">{t("billing.proCaption")}</p>
            <div className="op-plan-divider" />
            <h3>{t("billing.proFeaturesHeading")}</h3>
            <FeatureList features={proFeatures} />
            <div className="op-plan-footer">
              {isSubscribedToPro ? (
                <div className="op-plan-current-label">
                  <PreferencesIcon name="check" size={17} />
                  {t("billing.currentPlan")}
                </div>
              ) : isDevStore ? (
                <div className="op-plan-availability">
                  {t("billing.availableWhenLive")}
                </div>
              ) : (
                <button
                  type="button"
                  className="op-button op-button-primary op-subscribe-button"
                  onClick={onSubscribe}
                  disabled={isSubscribing}
                >
                  {isSubscribing
                    ? t("billing.openingShopify")
                    : t("billing.subscribeToPro")}
                  <PreferencesIcon name="arrow" size={17} />
                </button>
              )}
              <p>
                {isSubscribedToPro
                  ? t("billing.allSetKeepLoop")
                  : isDevStore
                    ? t("billing.keepTestingFree")
                    : t("billing.reviewApproveCharge")}
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
              <h3>{t("billing.simpleSecureBilling")}</h3>
              <p>{t("billing.subscriptionHandled")}</p>
            </div>
          </div>
          <div>
            <span className="op-section-icon">
              <PreferencesIcon name="chat" />
            </span>
            <div>
              <h3>{t("billing.needHand")}</h3>
              <p>
                {t("billing.billingQuestion")}{" "}
                <a href="mailto:apps.kaswebtech@gmail.com">
                  {t("billing.getInTouch")}
                </a>
              </p>
            </div>
          </div>
        </div>
        <div className="op-billing-bottom">
          <PreferencesIcon name="chat" size={16} />
          <span>{t("billing.makeItPersonal")}</span>
          <Link to="/app/settings" className="op-text-link">
            {t("billing.goToSettings")} <PreferencesIcon name="arrow" size={15} />
          </Link>
        </div>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
