import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../services/billing.server";
import db from "../db.server";
import { testConnection } from "../services/whatsapp.server";

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  await requireActivePlan({ admin, billing });
  const shop = session?.shop || admin?.shop || "";

  if (!shop) return { settings: {} };

  const rows = await db.appSetting.findMany({ where: { shop } });
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Do NOT expose access token value. Only indicate presence.
  const masked = { ...settings };
  if (masked.META_ACCESS_TOKEN) masked.META_ACCESS_TOKEN = "*****";

  return { settings: masked };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || admin?.shop || "";
  const form = await request.formData();

  const accessToken = form.get("META_ACCESS_TOKEN");
  const phoneNumberId = form.get("META_PHONE_NUMBER_ID");
  const wabaId = form.get("META_WABA_ID");
  const apiVersion = form.get("META_API_VERSION");
  const templateName = form.get("META_TEMPLATE_NAME");
  const templateLanguage = form.get("META_TEMPLATE_LANGUAGE");
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
  await upsert("META_TEMPLATE_NAME", templateName);
  await upsert("META_TEMPLATE_LANGUAGE", templateLanguage);
  await upsert("ENABLED", enabled);
  await upsert("REQUIRE_CUSTOMER_OPT_IN", requireOptIn);
  if (accessToken && accessToken !== "*****") {
    await upsert("META_ACCESS_TOKEN", accessToken);
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

  const fieldNames = [
    "META_ACCESS_TOKEN",
    "META_PHONE_NUMBER_ID",
    "META_WABA_ID",
    "META_API_VERSION",
    "META_TEMPLATE_NAME",
    "META_TEMPLATE_LANGUAGE",
  ];

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
    return form;
  };

  const onSave = () => {
    fetcher.submit(buildFormData(), { method: "post" });
  };

  const onTest = () => {
    const form = buildFormData();
    form.append("actionType", "test");
    fetcher.submit(form, { method: "post" });
  };

  const isEnabled = settings.ENABLED !== "false";
  const isConfigured = !!(settings.META_ACCESS_TOKEN && settings.META_PHONE_NUMBER_ID);
  const isWorking = fetcher.state !== "idle";

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
                  {isConfigured ? "● Credentials configured" : "● Not configured"}
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
            <SectionHeading icon={<KeyIcon size={18} />} title="Meta WhatsApp credentials" />
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
            <SectionHeading icon={<ChatIcon size={18} />} title="Message template" />
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 20 }}>
                <Field
                  label="Template name"
                  name="META_TEMPLATE_NAME"
                  defaultValue={settings.META_TEMPLATE_NAME || "order_confirmation_image"}
                  help="Must exactly match an approved template in Meta Business Manager."
                />
                <Field
                  label="Template language code"
                  name="META_TEMPLATE_LANGUAGE"
                  defaultValue={settings.META_TEMPLATE_LANGUAGE || "en_US"}
                  help="e.g. en, en_US — must match the template's language exactly."
                />
              </div>
              <div style={{ position: "relative", width: 140, height: 130, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ position: "absolute", top: 0, right: 10 }}>
                  <SparkleIcon size={14} />
                </span>
                <span style={{ position: "absolute", bottom: 8, left: 0 }}>
                  <SparkleIcon size={12} />
                </span>
                <div
                  style={{
                    width: 90,
                    height: 100,
                    borderRadius: 12,
                    background: COLORS.goldSoft,
                    border: `1px solid ${COLORS.goldBorder}`,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ width: "60%", height: 6, borderRadius: 3, background: COLORS.goldBorder }} />
                  <div style={{ width: "90%", height: 4, borderRadius: 2, background: COLORS.goldBorder }} />
                  <div style={{ width: "80%", height: 4, borderRadius: 2, background: COLORS.goldBorder }} />
                  <div style={{ width: "70%", height: 4, borderRadius: 2, background: COLORS.goldBorder }} />
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 4,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: COLORS.sent,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(31,169,123,0.35)",
                  }}
                >
                  <WhatsAppIcon size={20} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...cardBase, padding: "24px 28px" }}>
            <SectionHeading icon={<GearIcon size={18} />} title="Behavior" />
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 18 }}>
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
              <div style={{ position: "relative", width: 100, height: 110, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ position: "absolute", top: -2, right: 0 }}>
                  <SparkleIcon size={14} />
                </span>
                <span style={{ position: "absolute", bottom: 4, left: -4 }}>
                  <SparkleIcon size={12} />
                </span>
                <div style={{ color: COLORS.goldSoft }}>
                  <svg width="80" height="90" viewBox="0 0 24 24" fill={COLORS.goldSoft} stroke={COLORS.goldBorder} strokeWidth="1">
                    <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
                  </svg>
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 8,
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: COLORS.sent,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(31,169,123,0.35)",
                  }}
                >
                  <ShieldCheckIcon size={18} />
                </div>
              </div>
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
