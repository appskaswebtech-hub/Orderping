import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../services/billing.server";
import db from "../db.server";
import { testConnection } from "../services/whatsapp.server";

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const shop = session?.shop || admin?.shop || "";
  await requireActivePlan({ admin, billing, shop });

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
  const requireOptIn = form.get("REQUIRE_CUSTOMER_OPT_IN") === "on" ? "true" : "false";
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
    return new Response(JSON.stringify({ modeSaved: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (actionType === "test") {
    try {
      const tokenToTest = accessToken && accessToken !== "*****" ? accessToken : undefined;
      await testConnection({ accessToken: tokenToTest, phoneNumberId, apiVersion });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err?.body || err?.message || String(err) }), { status: 400 });
    }
  }

  // Save settings
  await upsert("META_PHONE_NUMBER_ID", phoneNumberId);
  await upsert("META_WABA_ID", wabaId);
  await upsert("META_API_VERSION", apiVersion);
  await upsert("ENABLED", enabled);
  await upsert("REQUIRE_CUSTOMER_OPT_IN", requireOptIn);
  if (accessToken && accessToken !== "*****") {
    await upsert("META_ACCESS_TOKEN", accessToken);
  }
  for (const key of NOTIFICATION_TYPE_SETTING_KEYS) {
    await upsert(key, form.get(key) === "on" ? "true" : "false");
  }

  return new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const COLORS = {
  sent: "#1FA97B",
  sentSoft: "#E6F6EF",
  gold: "#B4791E",
  goldSoft: "#FBF0DC",
  goldBorder: "#EED9AE",
};

const pageBg = { background: "linear-gradient(180deg, #FDFAF4 0%, #F8F1E4 100%)", minHeight: "100%", padding: "4px 0" };

const cardBase = {
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 12px rgba(16,24,40,0.05)",
  border: "1px solid rgba(16,24,40,0.04)",
  position: "relative",
  overflow: "hidden",
};

function Icon({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const KeyIcon = (p) => (
  <Icon {...p}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.6 12.4 20 3" />
    <path d="M16 7 20 11" />
    <path d="M12.5 10.5 16 14" />
  </Icon>
);
const ChatIcon = (p) => (
  <Icon {...p}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </Icon>
);
const GearIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
  </Icon>
);
const DocIcon = (p) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h6" />
  </Icon>
);
const ShieldCheckIcon = (p) => (
  <Icon {...p}>
    <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);
const SaveIcon = (p) => (
  <Icon {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </Icon>
);
const BoltIcon = (p) => (
  <Icon {...p}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
  </Icon>
);
const WhatsAppIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.86 9.86 0 0 0 4.62 1.14h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.79 14.02c-.24.68-1.4 1.3-1.93 1.34-.53.04-1.02.24-3.42-.72-2.9-1.16-4.75-4.1-4.9-4.3-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.19.01.42-.07.66.5.24.58.83 2 .9 2.15.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.44.51-.15.15-.31.31-.13.6.18.29.79 1.31 1.7 2.12 1.17 1.05 2.16 1.37 2.45 1.53.29.15.46.13.63-.08.17-.2.72-.84.91-1.13.19-.29.38-.24.63-.14.26.1 1.66.78 1.94.92.29.15.48.22.55.34.07.13.07.71-.17 1.39Z" />
  </svg>
);
const CopyIcon = (p) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);
const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

// Suggested body text for each required template, matching the order of
// variables buildVariables() sends for that event (see order-events.server.js
// and webhooks.app.orders_create.jsx). Merchants can paste this as-is into
// Meta, or write their own body as long as the variable count/order matches.
// `language` must match REQUIRED_TEMPLATES in order-events.server.js exactly —
// Meta treats "English" (en) and "English (US)" (en_US) as different
// languages, so a template approved under the wrong one will fail to send.
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

const SparkleIcon = ({ size = 14, color = COLORS.goldBorder }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10Z" />
  </svg>
);

const sectionIconWrap = (bg, fg, border) => ({
  width: 42,
  height: 42,
  borderRadius: "50%",
  background: bg,
  color: fg,
  border: border ? `1px solid ${border}` : "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

const fieldWrap = { display: "flex", flexDirection: "column", gap: 6, maxWidth: 480 };
const labelStyle = { fontSize: 13, fontWeight: 700, color: "#14181f" };
const helpStyle = { fontSize: 12, color: "#8a8f98" };
const inputStyle = {
  padding: "10px 14px",
  border: `1px solid ${COLORS.goldBorder}`,
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  background: "#FFFDF8",
  color: "#202223",
};
const checkboxRow = { display: "flex", alignItems: "flex-start", gap: 10 };

function Field({ label, help, ...inputProps }) {
  return (
    <div style={fieldWrap}>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} {...inputProps} />
      {help && <span style={helpStyle}>{help}</span>}
    </div>
  );
}

function Toggle({ label, help, ...inputProps }) {
  return (
    <div style={checkboxRow}>
      <input
        type="checkbox"
        style={{ width: 20, height: 20, marginTop: 1, accentColor: COLORS.gold }}
        {...inputProps}
      />
      <div style={fieldWrap}>
        <span style={labelStyle}>{label}</span>
        {help && <span style={helpStyle}>{help}</span>}
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, paddingBottom: 16, borderBottom: `1px solid ${COLORS.goldBorder}` }}>
      <div style={sectionIconWrap(COLORS.goldSoft, COLORS.gold, COLORS.goldBorder)}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#14181f" }}>{title}</div>
    </div>
  );
}

export default function Settings() {
  const fetcher = useFetcher();
  const { settings } = useLoaderData();

  const fieldNames = ["META_ACCESS_TOKEN", "META_PHONE_NUMBER_ID", "META_WABA_ID", "META_API_VERSION"];

  const buildFormData = () => {
    const form = new FormData();
    for (const name of fieldNames) {
      form.append(name, document.querySelector(`input[name="${name}"]`)?.value || "");
    }
    form.append("ENABLED", document.querySelector('input[name="ENABLED"]')?.checked ? "on" : "off");
    form.append(
      "REQUIRE_CUSTOMER_OPT_IN",
      document.querySelector('input[name="REQUIRE_CUSTOMER_OPT_IN"]')?.checked ? "on" : "off",
    );
    for (const key of NOTIFICATION_TYPE_SETTING_KEYS) {
      form.append(key, document.querySelector(`input[name="${key}"]`)?.checked ? "on" : "off");
    }
    return form;
  };

  const onSave = () => {
    fetcher.submit(buildFormData(), { method: "post" });
  };

  const [mode, setMode] = useState(settings.MESSAGING_MODE === "custom" ? "custom" : "managed");
  const onSelectMode = (next) => {
    setMode(next);
    const form = new FormData();
    form.append("MESSAGING_MODE", next);
    form.append("actionType", "setMode");
    fetcher.submit(form, { method: "post" });
  };

  const onTest = () => {
    const form = buildFormData();
    form.append("actionType", "test");
    fetcher.submit(form, { method: "post" });
  };

  const isEnabled = settings.ENABLED !== "false";
  // In "managed" mode, credentials aren't expected — OrderPing's own are used
  // via the .env fallback, so there's nothing to warn the merchant about here.
  const hasOwnCredentials = !!(settings.META_ACCESS_TOKEN && settings.META_PHONE_NUMBER_ID);
  const isConfigured = mode === "managed" || hasOwnCredentials;
  const isWorking = fetcher.state !== "idle";

  const [copiedName, setCopiedName] = useState(null);
  const onCopyBody = (template) => {
    navigator.clipboard?.writeText(template.body).then(() => {
      setCopiedName(template.name);
      setTimeout(() => setCopiedName((cur) => (cur === template.name ? null : cur)), 2000);
    });
  };

  return (
    <s-page heading="WhatsApp settings">
      <div style={pageBg}>
        <s-stack direction="block" gap="loose">
          <div
            style={{
              ...cardBase,
              borderBottom: `2px solid ${COLORS.goldBorder}`,
              padding: "22px 28px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "linear-gradient(90deg, #FEFCF7 0%, #FDF8ED 100%)",
            }}
          >
            <div style={sectionIconWrap(COLORS.goldSoft, COLORS.gold, COLORS.goldBorder)}>
              <WhatsAppIcon size={20} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#14181f", letterSpacing: -0.5 }}>WhatsApp settings</div>
          </div>

          <div
            style={{
              ...cardBase,
              padding: "24px 28px",
              background: "linear-gradient(90deg, #F1FAF5 0%, #ffffff 60%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginBottom: 10 }}>Status</div>
              <s-stack direction="inline" gap="base">
                <s-badge tone={isConfigured ? "success" : "warning"} size="large">
                  {mode === "managed"
                    ? "● Using OrderPing's default setup"
                    : hasOwnCredentials
                      ? "● Credentials configured"
                      : "● Not configured"}
                </s-badge>
                <s-badge tone={isEnabled ? "success" : "neutral"} size="large">
                  {isEnabled ? "● Notifications enabled" : "● Notifications disabled"}
                </s-badge>
              </s-stack>
            </div>
            <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
              <span style={{ position: "absolute", top: -4, right: -2 }}>
                <SparkleIcon size={16} color={COLORS.sent} />
              </span>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#fff",
                  color: COLORS.sent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(31,169,123,0.25)",
                }}
              >
                <WhatsAppIcon size={30} />
              </div>
            </div>
          </div>

          <div style={{ ...cardBase, padding: "24px 28px" }}>
            <SectionHeading icon={<BoltIcon size={18} />} title="Messaging setup" />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => onSelectMode("managed")}
                style={{
                  flex: 1,
                  minWidth: 240,
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: mode === "managed" ? `2px solid ${COLORS.sent}` : `1px solid ${COLORS.goldBorder}`,
                  background: mode === "managed" ? COLORS.sentSoft : "#FFFDF8",
                  position: "relative",
                }}
              >
                {mode === "managed" && (
                  <div style={{ position: "absolute", top: 14, right: 14 }}>
                    <s-badge tone="success">Selected</s-badge>
                  </div>
                )}
                <div style={sectionIconWrap(mode === "managed" ? COLORS.sent : COLORS.goldSoft, mode === "managed" ? "#fff" : COLORS.gold)}>
                  <BoltIcon size={18} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginTop: 12 }}>Use OrderPing's default setup</div>
                <div style={{ fontSize: 13, color: "#6d7175", marginTop: 4 }}>
                  No setup needed. Messages send through OrderPing's own WhatsApp number and templates.
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSelectMode("custom")}
                style={{
                  flex: 1,
                  minWidth: 240,
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: mode === "custom" ? `2px solid ${COLORS.sent}` : `1px solid ${COLORS.goldBorder}`,
                  background: mode === "custom" ? COLORS.sentSoft : "#FFFDF8",
                  position: "relative",
                }}
              >
                {mode === "custom" && (
                  <div style={{ position: "absolute", top: 14, right: 14 }}>
                    <s-badge tone="success">Selected</s-badge>
                  </div>
                )}
                <div style={sectionIconWrap(mode === "custom" ? COLORS.sent : COLORS.goldSoft, mode === "custom" ? "#fff" : COLORS.gold)}>
                  <KeyIcon size={18} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginTop: 12 }}>Connect my own WhatsApp Business account</div>
                <div style={{ fontSize: 13, color: "#6d7175", marginTop: 4 }}>
                  Send from your own phone number using your own Meta credentials and approved templates.
                </div>
              </button>
            </div>
          </div>

          {mode === "custom" && (
          <>
          <div style={{ ...cardBase, padding: "24px 28px" }}>
            <SectionHeading icon={<KeyIcon size={18} />} title="Meta WhatsApp credentials" />
            <div
              style={{
                background: COLORS.goldSoft,
                border: `1px solid ${COLORS.goldBorder}`,
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 20,
                fontSize: 15,
                color: "#6d5520",
                lineHeight: 1.6,
              }}
            >
              Prefer not to set this up yourself? Our team offers a paid, done-for-you setup service to
              configure your WhatsApp Business credentials and message templates on your behalf. Email{" "}
              <a href="mailto:apps.kaswebtech@gmail.com" style={{ color: COLORS.gold, fontWeight: 700 }}>
                apps.kaswebtech@gmail.com
              </a>{" "}
              to request a quote and get started.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
              <Field
                label="Access token"
                name="META_ACCESS_TOKEN"
                defaultValue={settings.META_ACCESS_TOKEN || ""}
                help="From Meta Business Manager. Won't be shown again after saving."
              />
              <Field
                label="Phone number ID"
                name="META_PHONE_NUMBER_ID"
                defaultValue={settings.META_PHONE_NUMBER_ID || ""}
                help="The Cloud API phone number ID that sends the messages."
              />
              <Field
                label="WhatsApp Business Account ID (optional)"
                name="META_WABA_ID"
                defaultValue={settings.META_WABA_ID || ""}
              />
              <Field
                label="API version"
                name="META_API_VERSION"
                defaultValue={settings.META_API_VERSION || "v17.0"}
              />
            </div>
          </div>

          <div style={{ ...cardBase, padding: "24px 28px" }}>
            <SectionHeading icon={<ChatIcon size={18} />} title="Required WhatsApp templates" />
            <div style={{ fontSize: 13, color: "#6d7175", marginBottom: 16 }}>
              In your Meta Business Manager, create each of these as an approved Utility template, using the
              exact name and language shown (Meta treats "English" and "English (US)" as different
              languages — using the wrong one will make sends fail even if the name matches). You can copy
              the suggested body text below as-is, or write your own, as long as it keeps the same number
              and order of variables ({"{{1}}"}, {"{{2}}"}, ...).
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: COLORS.gold, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `2px solid ${COLORS.goldBorder}` }}>Event</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: COLORS.gold, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `2px solid ${COLORS.goldBorder}` }}>Template name</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: COLORS.gold, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `2px solid ${COLORS.goldBorder}` }}>Language</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: COLORS.gold, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `2px solid ${COLORS.goldBorder}` }}>Suggested body</th>
                    <th style={{ borderBottom: `2px solid ${COLORS.goldBorder}` }}></th>
                  </tr>
                </thead>
                <tbody>
                  {REQUIRED_TEMPLATES.map((t) => (
                    <tr key={t.name} style={{ borderBottom: `1px solid ${COLORS.goldBorder}` }}>
                      <td style={{ padding: "10px", color: "#4a4f57", verticalAlign: "top", whiteSpace: "nowrap" }}>{t.label}</td>
                      <td style={{ padding: "10px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                        <code style={{ color: COLORS.gold, fontWeight: 700 }}>{t.name}</code>
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top", color: "#4a4f57", whiteSpace: "nowrap" }}>{t.language}</td>
                      <td style={{ padding: "10px", verticalAlign: "top", color: "#6d7175", whiteSpace: "pre-wrap", maxWidth: 360 }}>{t.body}</td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <button
                          type="button"
                          onClick={() => onCopyBody(t)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: `1px solid ${COLORS.goldBorder}`,
                            background: copiedName === t.name ? COLORS.sentSoft : "#FFFDF8",
                            color: copiedName === t.name ? COLORS.sent : COLORS.gold,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {copiedName === t.name ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                          {copiedName === t.name ? "Copied" : "Copy body"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}

          <div style={{ ...cardBase, padding: "18px 28px" }}>
            <SectionHeading icon={<GearIcon size={18} />} title="Behavior" />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Toggle label="Enable WhatsApp notifications" name="ENABLED" defaultChecked={isEnabled} />
              {/*
                TEMPORARILY DISABLED while the app is pending Shopify review.
                Re-enable once approved.

              <Toggle
                label="Require customer opt-in"
                help="Block sending unless the customer accepted marketing, has a whatsapp_opt_in note attribute, or is in the opt-in list."
                name="REQUIRE_CUSTOMER_OPT_IN"
                defaultChecked={settings.REQUIRE_CUSTOMER_OPT_IN === "true"}
              />
              */}
            </div>
          </div>

          <div style={{ ...cardBase, padding: "24px 28px" }}>
            <SectionHeading icon={<DocIcon size={18} />} title="Notification types" />
            <div style={{ fontSize: 13, color: "#6d7175", marginBottom: 16 }}>
              Choose which order events send a WhatsApp message. All are on by default.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {REQUIRED_TEMPLATES.map((t) => (
                <Toggle
                  key={t.settingKey}
                  label={t.label}
                  name={t.settingKey}
                  defaultChecked={settings[t.settingKey] !== "false"}
                />
              ))}
            </div>
          </div>

          <div style={{ ...cardBase, padding: "20px 28px", display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={onSave}
              disabled={isWorking}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: 10,
                border: "none",
                background: COLORS.sent,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: isWorking ? "default" : "pointer",
                opacity: isWorking ? 0.7 : 1,
              }}
            >
              <SaveIcon size={16} /> Save
            </button>
            <button
              type="button"
              onClick={onTest}
              disabled={isWorking}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: 10,
                border: `1px solid ${COLORS.goldBorder}`,
                background: "#fff",
                color: COLORS.gold,
                fontSize: 14,
                fontWeight: 700,
                cursor: isWorking ? "default" : "pointer",
                opacity: isWorking ? 0.7 : 1,
              }}
            >
              <BoltIcon size={16} /> Test connection
            </button>

            <div style={{ marginLeft: 8 }}>
              {isWorking && <s-badge tone="info">Working…</s-badge>}
              {!isWorking && fetcher.data?.saved === true && <s-badge tone="success">Settings saved</s-badge>}
              {!isWorking && fetcher.data?.ok === true && <s-badge tone="success">Test succeeded</s-badge>}
              {!isWorking && fetcher.data?.ok === false && (
                <s-badge tone="critical">Test failed: {JSON.stringify(fetcher.data.error)}</s-badge>
              )}
            </div>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
