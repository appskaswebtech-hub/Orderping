import { useRef, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../services/billing.server";
import db from "../db.server";
import PreferencesIcon from "../components/PreferencesIcon";
import { testConnection } from "../services/whatsapp.server";

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

const REQUIRED_TEMPLATES = [
  {
    label: "Order confirmation",
    name: "order_confirmation_image",
    language: "English (US)",
    settingKey: "NOTIFY_ORDER_CONFIRMATION",
    body: "Hi {{1}}, your order #{{2}} has been confirmed!\n\nItem(s): {{3}}\nTotal: {{4}}\n\nThank you for shopping with us!",
  },
  {
    label: "Shipped",
    name: "order_shipped",
    language: "English",
    settingKey: "NOTIFY_SHIPPED",
    body: "Hi {{1}}, good news! Your order #{{2}} has shipped.\nTracking: {{3}}",
  },
  {
    label: "Out for delivery",
    name: "order_out_for_delivery",
    language: "English",
    settingKey: "NOTIFY_OUT_FOR_DELIVERY",
    body: "Hi {{1}}, your order #{{2}} is out for delivery and should arrive today.",
  },
  {
    label: "Delivered",
    name: "order_delivered",
    language: "English",
    settingKey: "NOTIFY_DELIVERED",
    body: "Hi {{1}}, your order #{{2}} has been delivered. Thank you for shopping with us!",
  },
  {
    label: "Refund initiated",
    name: "order_refund_initiated",
    language: "English",
    settingKey: "NOTIFY_REFUND_INITIATED",
    body: "Hi {{1}}, a refund of {{3}} has been initiated for your order #{{2}}. It should reflect in 5-10 business days.",
  },
  {
    label: "Order cancelled",
    name: "order_cancelled",
    language: "English",
    settingKey: "NOTIFY_CANCELLED",
    body: "Hi {{1}}, your order #{{2}} has been cancelled. Reason: {{3}}",
  },
  {
    label: "Payment confirmed",
    name: "order_paid",
    language: "English",
    settingKey: "NOTIFY_PAID",
    body: "Hi {{1}}, we've received your payment of {{3}} for order #{{2}}. Thank you!",
  },
  {
    label: "Partially fulfilled",
    name: "order_partially_fulfilled",
    language: "English",
    settingKey: "NOTIFY_PARTIALLY_FULFILLED",
    body: "Hi {{1}}, part of your order #{{2}} has shipped. The rest is on its way soon.",
  },
];

const NOTIFICATION_HELP = [
  "When a new order is placed",
  "When an order is shipped",
  "When a delivery is on its way",
  "When an order reaches the customer",
  "When a refund is initiated",
  "When an order is cancelled",
  "When a payment is received",
  "When part of an order is shipped",
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
  const fetcher = useFetcher();
  const modeFetcher = useFetcher();
  const { settings } = useLoaderData();
  const formRef = useRef(null);
  const [mode, setMode] = useState(
    settings.MESSAGING_MODE === "custom" ? "custom" : "managed",
  );
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
      setCopyError(
        "Couldn't copy automatically. Select and copy the template text below.",
      );
    }
  };

  return (
    <s-page heading="WhatsApp settings">
      <div className="op-preferences">
        <header className="op-page-header">
          <div>
            <div className="op-kicker">MAKE IT YOURS</div>
            <h1>WhatsApp settings</h1>
            <p>A little setup. A better experience for every customer.</p>
          </div>
          <Link
            className="op-button op-button-secondary"
            to="/app/meta-setup-guide"
          >
            <PreferencesIcon name="book" size={16} />
            Setup guide
          </Link>
        </header>

        <div className="op-connection-banner">
          <span className="op-connection-icon">
            <PreferencesIcon name="chat" size={26} />
          </span>
          <div className="op-connection-copy">
            <h2>Your WhatsApp workspace</h2>
            <p>
              {mode === "managed"
                ? "Messages are sent using OrderPing's number and ready-to-use templates."
                : "Connect your business number for a messaging experience that feels like you."}
            </p>
          </div>
          <div className="op-status-stack">
            <span
              className={`op-pill ${isConfigured ? "op-pill-success" : "op-pill-warning"}`}
            >
              <span className="op-status-dot" />
              {mode === "managed"
                ? "OrderPing setup"
                : hasOwnCredentials
                  ? "Credentials saved"
                  : "Setup needed"}
            </span>
            <span className="op-connection-caption">
              Notifications {isEnabled ? "enabled" : "disabled"}
            </span>
          </div>
        </div>

        <form ref={formRef} onSubmit={onSave} className="op-settings-layout">
          <div className="op-settings-main">
            <section className="op-settings-panel">
              <div className="op-section-heading">
                <span className="op-section-icon">
                  <PreferencesIcon name="bolt" />
                </span>
                <div>
                  <h2>Messaging setup</h2>
                  <p>Choose how you connect with your customers.</p>
                </div>
              </div>
              <div
                className="op-mode-grid"
                role="group"
                aria-label="Messaging setup"
              >
                {[
                  {
                    value: "managed",
                    icon: "bolt",
                    title: "Let OrderPing handle it",
                    description:
                      "Use our WhatsApp number and approved templates. No extra setup needed.",
                    tag: "QUICK START",
                  },
                  {
                    value: "custom",
                    icon: "key",
                    title: "Use your own account",
                    description:
                      "Connect your WhatsApp Business number with your own Meta credentials.",
                    tag: "YOUR BRAND",
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
                  ? "Saving messaging setup..."
                  : "Your messaging setup is saved automatically."}
              </p>
            </section>

            <div hidden={mode !== "custom"} className="op-custom-settings">
              <section className="op-settings-panel">
                <div className="op-section-heading">
                  <span className="op-section-icon">
                    <PreferencesIcon name="key" />
                  </span>
                  <div>
                    <h2>Meta credentials</h2>
                    <p>Connect your WhatsApp Business account securely.</p>
                  </div>
                </div>
                <div className="op-fields-grid">
                  <Field
                    label="Access token"
                    name="META_ACCESS_TOKEN"
                    type="password"
                    autoComplete="off"
                    defaultValue={settings.META_ACCESS_TOKEN || ""}
                    help="Your saved token stays hidden for security."
                  />
                  <Field
                    label="Phone number ID"
                    name="META_PHONE_NUMBER_ID"
                    defaultValue={settings.META_PHONE_NUMBER_ID || ""}
                    placeholder="Enter your phone number ID"
                    help="The Cloud API number used to send messages."
                  />
                  <Field
                    label="Business Account ID (optional)"
                    name="META_WABA_ID"
                    defaultValue={settings.META_WABA_ID || ""}
                    placeholder="Enter your WhatsApp Business Account ID"
                  />
                  <Field
                    label="API version"
                    name="META_API_VERSION"
                    defaultValue={settings.META_API_VERSION || "v17.0"}
                  />
                </div>
                <Link className="op-text-link" to="/app/meta-setup-guide">
                  Where do I find these details?{" "}
                  <PreferencesIcon name="arrow" size={15} />
                </Link>
              </section>
              <section className="op-settings-panel">
                <div className="op-section-heading">
                  <span className="op-section-icon">
                    <PreferencesIcon name="chat" />
                  </span>
                  <div>
                    <h2>Message templates</h2>
                    <p>Your starting point for every order update.</p>
                  </div>
                </div>
                <p className="op-section-description">
                  Create these as approved Utility templates in Meta. Use the
                  exact name, language, and variable order shown. English and
                  English (US) are different template languages.
                </p>
                {copyError && (
                  <p className="op-feedback op-feedback-error" role="alert">
                    {copyError}
                  </p>
                )}
                <div className="op-template-list">
                  {REQUIRED_TEMPLATES.map((template) => (
                    <details key={template.name} className="op-template">
                      <summary>
                        <span>
                          <strong>{template.label}</strong>
                          <code>{template.name}</code>
                        </span>
                        <span className="op-template-language">
                          {template.language}
                        </span>
                      </summary>
                      <div className="op-template-body">
                        <p>{template.body}</p>
                        <button
                          type="button"
                          className="op-button op-button-secondary"
                          onClick={() => onCopyBody(template)}
                        >
                          <PreferencesIcon
                            name={
                              copiedName === template.name ? "check" : "copy"
                            }
                            size={14}
                          />
                          {copiedName === template.name
                            ? "Copied!"
                            : "Copy template"}
                        </button>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            </div>

            <section className="op-settings-panel">
              <div className="op-section-heading">
                <span className="op-section-icon">
                  <PreferencesIcon name="bell" />
                </span>
                <div>
                  <h2>Notification preferences</h2>
                  <p>Choose when your customers hear from you.</p>
                </div>
              </div>
              <div className="op-master-toggle">
                <Toggle
                  label="Enable WhatsApp notifications"
                  help="Send automatic order updates to your customers."
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
                <h3>Order events</h3>
                <span>8 notification types</span>
              </div>
              <div className="op-notification-grid">
                {REQUIRED_TEMPLATES.map((template, index) => (
                  <Toggle
                    key={template.settingKey}
                    label={template.label}
                    help={NOTIFICATION_HELP[index]}
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
              <h2>A smooth start</h2>
              <p>Three small steps to keep your customers in the loop.</p>
              <ol className="op-setup-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Choose your setup</strong>
                    <p>Use OrderPing or your own account.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Pick your order events</strong>
                    <p>Send the updates that matter.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Save your preferences</strong>
                    <p>Enable notifications when you are ready.</p>
                  </div>
                </li>
              </ol>
            </section>
            <section className="op-aside-card op-help-card">
              <PreferencesIcon name="book" size={24} />
              <h2>A hand with setup?</h2>
              <p>
                Follow our step-by-step guide to connect your WhatsApp Business
                account.
              </p>
              <Link className="op-text-link" to="/app/meta-setup-guide">
                Open setup guide <PreferencesIcon name="arrow" size={15} />
              </Link>
              {mode === "custom" && (
                <p className="op-setup-service">
                  Prefer a done-for-you setup?{" "}
                  <a href="mailto:apps.kaswebtech@gmail.com">Email our team</a>{" "}
                  for a paid setup quote.
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
                <strong>Make it official</strong>
                <p>Save your notification preferences to apply changes.</p>
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
                  Test connection
                </button>
              )}
              <button
                type="submit"
                className="op-button op-button-primary"
                disabled={isBusy}
              >
                <PreferencesIcon name="save" size={15} />
                {isWorking && fetcher.formData?.get("actionType") !== "test"
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
            <div className="op-save-feedback" role="status" aria-live="polite">
              {isWorking && fetcher.formData?.get("actionType") === "test" && (
                <span>Testing connection...</span>
              )}
              {!isWorking && fetcher.data?.saved && (
                <span className="op-feedback-success">
                  Settings saved successfully.
                </span>
              )}
              {!isWorking && fetcher.data?.ok === true && (
                <span className="op-feedback-success">
                  Connection test succeeded.
                </span>
              )}
              {!isWorking && fetcher.data?.ok === false && (
                <span className="op-feedback-error">
                  Test failed:{" "}
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
