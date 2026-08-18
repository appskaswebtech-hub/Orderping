import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { testConnection } from "../services/whatsapp.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
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
      await testConnection({});
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err?.body || err?.message || String(err) }), { status: 400 });
    }
  }

  // Save settings
  await upsert("META_TEMPLATE_NAME", templateName);
  await upsert("META_TEMPLATE_LANGUAGE", templateLanguage);
  await upsert("ENABLED", enabled);
  await upsert("REQUIRE_CUSTOMER_OPT_IN", requireOptIn);

  return new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const fieldWrap = { display: "flex", flexDirection: "column", gap: 4 };
const labelStyle = { fontSize: 13, fontWeight: 600, color: "#202223" };
const helpStyle = { fontSize: 12, color: "#6d7175" };
const inputStyle = {
  padding: "8px 10px",
  border: "1px solid #c9cccf",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: "#202223",
};
const cardStyle = {
  border: "1px solid #e3e5e7",
  borderRadius: 12,
  padding: 20,
  background: "#fff",
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
      <input type="checkbox" style={{ width: 18, height: 18, marginTop: 2 }} {...inputProps} />
      <div style={fieldWrap}>
        <span style={labelStyle}>{label}</span>
        {help && <span style={helpStyle}>{help}</span>}
      </div>
    </div>
  );
}

export default function Settings() {
  const fetcher = useFetcher();
  const { settings } = useLoaderData();

  const fieldNames = ["META_TEMPLATE_NAME", "META_TEMPLATE_LANGUAGE"];

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

  const isEnabled = settings.ENABLED === "true";
  const isWorking = fetcher.state !== "idle";

  return (
    <s-page heading="WhatsApp settings">
      <s-section heading="Status">
        <s-stack direction="inline" gap="base">
          <s-badge tone={isEnabled ? "success" : "neutral"}>
            {isEnabled ? "Notifications enabled" : "Notifications disabled"}
          </s-badge>
        </s-stack>
      </s-section>

      <s-section heading="Message template">
        <div style={cardStyle}>
          <s-stack direction="block" gap="loose">
            <Field
              label="Template name"
              name="META_TEMPLATE_NAME"
              defaultValue={settings.META_TEMPLATE_NAME || "order_confirmation_link"}
              help="Must exactly match an approved template in Meta Business Manager."
            />
            <Field
              label="Template language code"
              name="META_TEMPLATE_LANGUAGE"
              defaultValue={settings.META_TEMPLATE_LANGUAGE || "en_US"}
              help="e.g. en, en_US — must match the template's language exactly."
            />
          </s-stack>
        </div>
      </s-section>

      <s-section heading="Behavior">
        <div style={cardStyle}>
          <s-stack direction="block" gap="loose">
            <Toggle
              label="Enable WhatsApp notifications"
              name="ENABLED"
              defaultChecked={isEnabled}
            />
            <Toggle
              label="Require customer opt-in"
              help="Block sending unless the customer accepted marketing, has a whatsapp_opt_in note attribute, or is in the opt-in list."
              name="REQUIRE_CUSTOMER_OPT_IN"
              defaultChecked={settings.REQUIRE_CUSTOMER_OPT_IN === "true"}
            />
          </s-stack>
        </div>
      </s-section>

      <s-section>
        <s-stack direction="inline" gap="base">
          <s-button type="button" onClick={onSave} variant="primary" disabled={isWorking}>
            Save
          </s-button>
          <s-button type="button" onClick={onTest} variant="secondary" disabled={isWorking}>
            Test connection
          </s-button>
        </s-stack>

        <div style={{ marginTop: 12 }}>
          {isWorking && <s-badge tone="info">Working…</s-badge>}
          {!isWorking && fetcher.data?.saved === true && <s-badge tone="success">Settings saved</s-badge>}
          {!isWorking && fetcher.data?.ok === true && <s-badge tone="success">Test succeeded</s-badge>}
          {!isWorking && fetcher.data?.ok === false && (
            <s-badge tone="critical">Test failed: {JSON.stringify(fetcher.data.error)}</s-badge>
          )}
        </div>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
