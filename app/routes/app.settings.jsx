import { useRef, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../services/billing.server";
import db from "../db.server";
import PreferencesIcon from "../components/PreferencesIcon";
import { testConnection } from "../services/whatsapp.server";
import { useTranslation } from "../i18n/LanguageContext";
import { SUPPORTED_LOCALES, LOCALE_LABELS } from "../i18n/translations";
import { MESSAGE_TEMPLATES } from "../i18n/messageTemplates";

// Meta's own template-language picker lists these in English regardless of
// the merchant's own language (same reasoning as the setup guide) — a
// merchant creating "order_confirmation_image" in their own Meta account
// needs to pick exactly this from Meta's dropdown, so it stays untranslated.
const META_LANGUAGE_NAMES = { en: "English", fr: "French", es: "Spanish", de: "German", it: "Italian" };

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const shop = session?.shop || admin?.shop || "";
  await requireActivePlan({ admin, billing, request, shop });

  if (!shop) return { settings: {} };

  const rows = await db.appSetting.findMany({ where: { shop } });
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Do NOT expose access token value. Only indicate presence.
  const masked = { ...settings };
  if (masked.META_ACCESS_TOKEN) masked.META_ACCESS_TOKEN = "*****";

  return { settings: masked };
};

// Must match the settingKey values in REQUIRED_TEMPLATES further down this
// file (and in order-events.server.js) — kept as a plain list here since
// it's needed before that array is defined below.
const NOTIFICATION_TYPE_SETTING_KEYS = [
  "NOTIFY_ORDER_CONFIRMATION",
  "NOTIFY_SHIPPED",
  "NOTIFY_OUT_FOR_DELIVERY",
  "NOTIFY_DELIVERED",
  "NOTIFY_REFUND_INITIATED",
  "NOTIFY_CANCELLED",
  "NOTIFY_PAID",
  "NOTIFY_PARTIALLY_FULFILLED",
];

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || admin?.shop || "";
  const form = await request.formData();

  const accessToken = form.get("META_ACCESS_TOKEN");
  const phoneNumberId = form.get("META_PHONE_NUMBER_ID");
  const wabaId = form.get("META_WABA_ID");
  const apiVersion = form.get("META_API_VERSION");
  const enabled = form.get("ENABLED") === "on" ? "true" : "false";
  const requireOptIn =
    form.get("REQUIRE_CUSTOMER_OPT_IN") === "on" ? "true" : "false";
  const actionType = form.get("actionType");

  if (!shop) return new Response(null, { status: 400 });

  // Save provided values (only save access token if provided; it may be masked in loader)
  const upsert = async (key, value) => {
    if (value == null) return;
    await db.appSetting.upsert({
      where: { shop_key: { shop, key } },
      update: { value },
      create: { shop, key, value },
    });
  };

  if (actionType === "setMode") {
    const mode = form.get("MESSAGING_MODE") === "custom" ? "custom" : "managed";
    await upsert("MESSAGING_MODE", mode);
    return new Response(JSON.stringify({ modeSaved: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (actionType === "setLanguage") {
    const language = form.get("UI_LANGUAGE") || "auto";
    await upsert("UI_LANGUAGE", language);
    return new Response(JSON.stringify({ languageSaved: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (actionType === "test") {
    try {
      const tokenToTest =
        accessToken && accessToken !== "*****" ? accessToken : undefined;
      await testConnection({
        accessToken: tokenToTest,
        phoneNumberId,
        apiVersion,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err?.body || err?.message || String(err),
        }),
        { status: 400 },
      );
    }
  }

  // Save settings
  await upsert("META_PHONE_NUMBER_ID", phoneNumberId);
  await upsert("META_WABA_ID", wabaId);
  await upsert("META_API_VERSION", apiVersion);
  await upsert("ENABLED", enabled);
  await upsert("ENABLED_OPT_IN_CONFIRMED", "true");
  await upsert("REQUIRE_CUSTOMER_OPT_IN", requireOptIn);
  if (accessToken && accessToken !== "*****") {
    await upsert("META_ACCESS_TOKEN", accessToken);
  }
  for (const key of NOTIFICATION_TYPE_SETTING_KEYS) {
    await upsert(key, form.get(key) === "on" ? "true" : "false");
  }

  return new Response(JSON.stringify({ saved: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// Body text is looked up from MESSAGE_TEMPLATES per the admin's selected
// language at render time (see the Message templates section below) — these
// entries just carry the fixed Meta template name and UI copy keys.
const REQUIRED_TEMPLATES = [
  {
    labelKey: "settings.templates.orderConfirmation",
    name: "order_confirmation_image",
    settingKey: "NOTIFY_ORDER_CONFIRMATION",
    helpKey: "settings.notifyHelp.orderConfirmation",
  },
  {
    labelKey: "settings.templates.shipped",
    name: "order_shipped",
    settingKey: "NOTIFY_SHIPPED",
    helpKey: "settings.notifyHelp.shipped",
  },
  {
    labelKey: "settings.templates.outForDelivery",
    name: "order_out_for_delivery",
    settingKey: "NOTIFY_OUT_FOR_DELIVERY",
    helpKey: "settings.notifyHelp.outForDelivery",
  },
  {
    labelKey: "settings.templates.delivered",
    name: "order_delivered",
    settingKey: "NOTIFY_DELIVERED",
    helpKey: "settings.notifyHelp.delivered",
  },
  {
    labelKey: "settings.templates.refundInitiated",
    name: "order_refund_initiated",
    settingKey: "NOTIFY_REFUND_INITIATED",
    helpKey: "settings.notifyHelp.refundInitiated",
  },
  {
    labelKey: "settings.templates.cancelled",
    name: "order_cancelled",
    settingKey: "NOTIFY_CANCELLED",
    helpKey: "settings.notifyHelp.cancelled",
  },
  {
    labelKey: "settings.templates.paid",
    name: "order_paid",
    settingKey: "NOTIFY_PAID",
    helpKey: "settings.notifyHelp.paid",
  },
  {
    labelKey: "settings.templates.partiallyFulfilled",
    name: "order_partially_fulfilled",
    settingKey: "NOTIFY_PARTIALLY_FULFILLED",
    helpKey: "settings.notifyHelp.partiallyFulfilled",
  },
];

// eslint-disable-next-line react/prop-types
function Toggle({ label, help, ...inputProps }) {
  return (
    <label className="op-toggle-row">
      <span className="op-toggle-copy">
        <strong>{label}</strong>
        {help && <span>{help}</span>}
      </span>
      <span className="op-switch">
        <input type="checkbox" {...inputProps} />
        <span className="op-switch-track" />
      </span>
    </label>
  );
}

// eslint-disable-next-line react/prop-types
function Field({ label, help, ...inputProps }) {
  return (
    <label className="op-field">
      <span>{label}</span>
      <input {...inputProps} />
      {help && <small>{help}</small>}
    </label>
  );
}

export default function Settings() {
  const { t, locale } = useTranslation();
  const fetcher = useFetcher();
  const modeFetcher = useFetcher();
  const languageFetcher = useFetcher();
  const { settings } = useLoaderData();
  const formRef = useRef(null);
  const [mode, setMode] = useState(
    settings.MESSAGING_MODE === "custom" ? "custom" : "managed",
  );
  const [language, setLanguage] = useState(settings.UI_LANGUAGE || "auto");
  const [copiedName, setCopiedName] = useState(null);
  const [copyError, setCopyError] = useState("");
  const isEnabled =
    settings.ENABLED === "true" && settings.ENABLED_OPT_IN_CONFIRMED === "true";
  const hasOwnCredentials = !!(
    settings.META_ACCESS_TOKEN && settings.META_PHONE_NUMBER_ID
  );
  const isConfigured = mode === "managed" || hasOwnCredentials;
  const isWorking = fetcher.state !== "idle";
  const isBusy = isWorking || modeFetcher.state !== "idle";

  const buildFormData = () => new FormData(formRef.current);
  const onSave = (event) => {
    event.preventDefault();
    fetcher.submit(buildFormData(), { method: "post" });
  };
  const onSelectMode = (next) => {
    setMode(next);
    modeFetcher.submit(
      { MESSAGING_MODE: next, actionType: "setMode" },
      { method: "post" },
    );
  };
  const onSelectLanguage = (event) => {
    const next = event.target.value;
    setLanguage(next);
    languageFetcher.submit(
      { UI_LANGUAGE: next, actionType: "setLanguage" },
      { method: "post" },
    );
  };
  const onTest = () => {
    const form = buildFormData();
    form.append("actionType", "test");
    fetcher.submit(form, { method: "post" });
  };
  const onCopyBody = async (template) => {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopyError("");
      setCopiedName(template.name);
      setTimeout(
        () =>
          setCopiedName((current) =>
            current === template.name ? null : current,
          ),
        2000,
      );
    } catch {
      setCopyError(t("settings.templates.copyError"));
    }
  };

  return (
    <s-page heading={t("settings.heading")}>
      <div className="op-preferences">
        <header className="op-page-header">
          <div>
            <div className="op-kicker">{t("settings.kicker")}</div>
            <h1>{t("settings.heading")}</h1>
            <p>{t("settings.subheading")}</p>
          </div>
          <Link
            className="op-button op-button-secondary"
            to="/app/meta-setup-guide"
          >
            <PreferencesIcon name="book" size={16} />
            {t("settings.setupGuide")}
          </Link>
        </header>

        <div className="op-connection-banner">
          <span className="op-connection-icon">
            <PreferencesIcon name="chat" size={26} />
          </span>
          <div className="op-connection-copy">
            <h2>{t("settings.workspace.heading")}</h2>
            <p>
              {mode === "managed"
                ? t("settings.workspace.managed")
                : t("settings.workspace.custom")}
            </p>
          </div>
          <div className="op-status-stack">
            <span
              className={`op-pill ${isConfigured ? "op-pill-success" : "op-pill-warning"}`}
            >
              <span className="op-status-dot" />
              {mode === "managed"
                ? t("settings.workspace.pillManaged")
                : hasOwnCredentials
                  ? t("settings.workspace.pillCredentialsSaved")
                  : t("settings.workspace.pillSetupNeeded")}
            </span>
            <span className="op-connection-caption">
              {isEnabled
                ? t("settings.workspace.notificationsEnabled")
                : t("settings.workspace.notificationsDisabled")}
            </span>
          </div>
        </div>

        <form ref={formRef} onSubmit={onSave} className="op-settings-layout">
          <div className="op-settings-main">
            <section className="op-settings-panel op-language-panel">
              <div className="op-section-heading">
                <span className="op-section-icon">
                  <PreferencesIcon name="globe" />
                </span>
                <div>
                  <h2>{t("settings.language.heading")}</h2>
                  <p>{t("settings.language.description")}</p>
                </div>
              </div>
              <div className="op-fields-grid">
                <label className="op-field">
                  <span>{t("settings.language.heading")}</span>
                  <select value={language} onChange={onSelectLanguage}>
                    <option value="auto">{t("settings.language.auto")}</option>
                    {SUPPORTED_LOCALES.map((code) => (
                      <option key={code} value={code}>
                        {LOCALE_LABELS[code]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="op-inline-note" role="status">
                <PreferencesIcon name="shield" size={15} />
                {languageFetcher.state !== "idle"
                  ? t("settings.language.saving")
                  : t("settings.language.saved")}
              </p>
            </section>

            <section className="op-settings-panel">
              <div className="op-section-heading">
                <span className="op-section-icon">
                  <PreferencesIcon name="bolt" />
                </span>
                <div>
                  <h2>{t("settings.mode.heading")}</h2>
                  <p>{t("settings.mode.subheading")}</p>
                </div>
              </div>
              <div
                className="op-mode-grid"
                role="group"
                aria-label={t("settings.mode.heading")}
              >
                {[
                  {
                    value: "managed",
                    icon: "bolt",
                    title: t("settings.mode.managedTitle"),
                    description: t("settings.mode.managedDescription"),
                    tag: t("settings.mode.managedTag"),
                  },
                  {
                    value: "custom",
                    icon: "key",
                    title: t("settings.mode.customTitle"),
                    description: t("settings.mode.customDescription"),
                    tag: t("settings.mode.customTag"),
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`op-mode-card ${mode === option.value ? "is-selected" : ""}`}
                    aria-pressed={mode === option.value}
                    disabled={isBusy}
                    onClick={() => onSelectMode(option.value)}
                  >
                    <span className="op-mode-top">
                      <span className="op-mode-icon">
                        <PreferencesIcon name={option.icon} />
                      </span>
                      <span className="op-choice-indicator">
                        {mode === option.value && (
                          <PreferencesIcon name="check" size={12} />
                        )}
                      </span>
                    </span>
                    <span className="op-mode-tag">{option.tag}</span>
                    <strong>{option.title}</strong>
                    <span className="op-mode-description">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
              <p className="op-inline-note" role="status">
                <PreferencesIcon name="shield" size={15} />
                {modeFetcher.state !== "idle"
                  ? t("settings.mode.savingNote")
                  : t("settings.mode.savedNote")}
              </p>
            </section>

            <div hidden={mode !== "custom"} className="op-custom-settings">
              <section className="op-settings-panel">
                <div className="op-section-heading">
                  <span className="op-section-icon">
                    <PreferencesIcon name="key" />
                  </span>
                  <div>
                    <h2>{t("settings.credentials.heading")}</h2>
                    <p>{t("settings.credentials.subheading")}</p>
                  </div>
                </div>
                <div className="op-fields-grid">
                  <Field
                    label={t("settings.credentials.accessToken")}
                    name="META_ACCESS_TOKEN"
                    type="password"
                    autoComplete="off"
                    defaultValue={settings.META_ACCESS_TOKEN || ""}
                    help={t("settings.credentials.accessTokenHelp")}
                  />
                  <Field
                    label={t("settings.credentials.phoneNumberId")}
                    name="META_PHONE_NUMBER_ID"
                    defaultValue={settings.META_PHONE_NUMBER_ID || ""}
                    placeholder={t("settings.credentials.phoneNumberIdPlaceholder")}
                    help={t("settings.credentials.phoneNumberIdHelp")}
                  />
                  <Field
                    label={t("settings.credentials.wabaId")}
                    name="META_WABA_ID"
                    defaultValue={settings.META_WABA_ID || ""}
                    placeholder={t("settings.credentials.wabaIdPlaceholder")}
                  />
                  <Field
                    label={t("settings.credentials.apiVersion")}
                    name="META_API_VERSION"
                    defaultValue={settings.META_API_VERSION || "v17.0"}
                  />
                </div>
                <Link className="op-text-link" to="/app/meta-setup-guide">
                  {t("settings.credentials.whereToFind")}{" "}
                  <PreferencesIcon name="arrow" size={15} />
                </Link>
              </section>
              <section className="op-settings-panel">
                <div className="op-section-heading">
                  <span className="op-section-icon">
                    <PreferencesIcon name="chat" />
                  </span>
                  <div>
                    <h2>{t("settings.templates.heading")}</h2>
                    <p>{t("settings.templates.subheading")}</p>
                  </div>
                </div>
                <p className="op-section-description">
                  {t("settings.templates.description")}
                </p>
                {copyError && (
                  <p className="op-feedback op-feedback-error" role="alert">
                    {copyError}
                  </p>
                )}
                <div className="op-template-list">
                  {REQUIRED_TEMPLATES.map((template) => {
                    const body = MESSAGE_TEMPLATES[template.name]?.[locale] || MESSAGE_TEMPLATES[template.name]?.en;
                    const languageLabel =
                      locale === "en"
                        ? template.name === "order_confirmation_image"
                          ? "English (US)"
                          : "English"
                        : META_LANGUAGE_NAMES[locale];
                    return (
                    <details key={template.name} className="op-template">
                      <summary>
                        <span>
                          <strong>{t(template.labelKey)}</strong>
                          <code>{template.name}</code>
                        </span>
                        <span className="op-template-language">
                          {languageLabel}
                        </span>
                      </summary>
                      <div className="op-template-body">
                        <p>{body}</p>
                        <button
                          type="button"
                          className="op-button op-button-secondary"
                          onClick={() => onCopyBody({ name: template.name, body })}
                        >
                          <PreferencesIcon
                            name={
                              copiedName === template.name ? "check" : "copy"
                            }
                            size={14}
                          />
                          {copiedName === template.name
                            ? t("settings.templates.copied")
                            : t("settings.templates.copy")}
                        </button>
                      </div>
                    </details>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="op-settings-panel">
              <div className="op-section-heading">
                <span className="op-section-icon">
                  <PreferencesIcon name="bell" />
                </span>
                <div>
                  <h2>{t("settings.notifications.heading")}</h2>
                  <p>{t("settings.notifications.subheading")}</p>
                </div>
              </div>
              <div className="op-master-toggle">
                <Toggle
                  label={t("settings.notifications.enable")}
                  help={t("settings.notifications.enableHelp")}
                  name="ENABLED"
                  defaultChecked={isEnabled}
                />
              </div>
              {/* Keep the existing opt-in preference while this control is hidden during app review. */}
              <input
                type="hidden"
                name="REQUIRE_CUSTOMER_OPT_IN"
                value={
                  settings.REQUIRE_CUSTOMER_OPT_IN === "true" ? "on" : "off"
                }
              />
              <div className="op-subsection-heading">
                <h3>{t("settings.notifications.orderEvents")}</h3>
                <span>{t("settings.notifications.eventCount")}</span>
              </div>
              <div className="op-notification-grid">
                {REQUIRED_TEMPLATES.map((template) => (
                  <Toggle
                    key={template.settingKey}
                    label={t(template.labelKey)}
                    help={t(template.helpKey)}
                    name={template.settingKey}
                    defaultChecked={settings[template.settingKey] !== "false"}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="op-settings-aside">
            <section className="op-aside-card">
              <span className="op-section-icon">
                <PreferencesIcon name="check" />
              </span>
              <h2>{t("settings.aside.title")}</h2>
              <p>{t("settings.aside.subtitle")}</p>
              <ol className="op-setup-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>{t("settings.aside.step1Title")}</strong>
                    <p>{t("settings.aside.step1Body")}</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>{t("settings.aside.step2Title")}</strong>
                    <p>{t("settings.aside.step2Body")}</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>{t("settings.aside.step3Title")}</strong>
                    <p>{t("settings.aside.step3Body")}</p>
                  </div>
                </li>
              </ol>
            </section>
            <section className="op-aside-card op-help-card">
              <PreferencesIcon name="book" size={24} />
              <h2>{t("settings.help.title")}</h2>
              <p>{t("settings.help.body")}</p>
              <Link className="op-text-link" to="/app/meta-setup-guide">
                {t("settings.help.openGuide")} <PreferencesIcon name="arrow" size={15} />
              </Link>
              {mode === "custom" && (
                <p className="op-setup-service">
                  {t("settings.help.doneForYouPre")}{" "}
                  <a href="mailto:apps.kaswebtech@gmail.com">{t("settings.help.emailTeam")}</a>{" "}
                  {t("settings.help.doneForYouPost")}
                </p>
              )}
            </section>
          </aside>

          <div className="op-save-bar">
            <div className="op-save-copy">
              <span className="op-section-icon">
                <PreferencesIcon name="shield" size={18} />
              </span>
              <div>
                <strong>{t("settings.saveBar.title")}</strong>
                <p>{t("settings.saveBar.subtitle")}</p>
              </div>
            </div>
            <div className="op-save-actions">
              {mode === "custom" && (
                <button
                  type="button"
                  className="op-button op-button-secondary"
                  onClick={onTest}
                  disabled={isBusy}
                >
                  <PreferencesIcon name="bolt" size={15} />
                  {t("settings.saveBar.testConnection")}
                </button>
              )}
              <button
                type="submit"
                className="op-button op-button-primary"
                disabled={isBusy}
              >
                <PreferencesIcon name="save" size={15} />
                {isWorking && fetcher.formData?.get("actionType") !== "test"
                  ? t("settings.saveBar.saving")
                  : t("settings.saveBar.saveChanges")}
              </button>
            </div>
            <div className="op-save-feedback" role="status" aria-live="polite">
              {isWorking && fetcher.formData?.get("actionType") === "test" && (
                <span>{t("settings.saveBar.testing")}</span>
              )}
              {!isWorking && fetcher.data?.saved && (
                <span className="op-feedback-success">
                  {t("settings.saveBar.saved")}
                </span>
              )}
              {!isWorking && fetcher.data?.ok === true && (
                <span className="op-feedback-success">
                  {t("settings.saveBar.testSucceeded")}
                </span>
              )}
              {!isWorking && fetcher.data?.ok === false && (
                <span className="op-feedback-error">
                  {t("settings.saveBar.testFailed")}{" "}
                  {typeof fetcher.data.error === "string"
                    ? fetcher.data.error
                    : JSON.stringify(fetcher.data.error)}
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
