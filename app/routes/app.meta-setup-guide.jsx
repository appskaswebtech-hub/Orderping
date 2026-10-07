import { Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

const COLORS = { sent: "#1FA97B", gold: "#B4791E", goldSoft: "#FBF0DC", goldBorder: "#EED9AE" };
const pageBg = { background: "linear-gradient(180deg, #FDFAF4 0%, #F8F1E4 100%)", minHeight: "100%", padding: "4px 0" };
const cardBase = {
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 12px rgba(16,24,40,0.05)",
  border: "1px solid rgba(16,24,40,0.04)",
  padding: "24px 28px",
};

function Step({ number, title, children }) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: COLORS.goldSoft,
          border: `1px solid ${COLORS.goldBorder}`,
          color: COLORS.gold,
          fontWeight: 800,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1, paddingBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#4a4f57", lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  );
}

export default function MetaSetupGuide() {
  return (
    <s-page heading="Get your WhatsApp credentials">
      <div style={pageBg}>
        <s-stack direction="block" gap="loose">
          <div style={{ ...cardBase, background: "linear-gradient(90deg, #FEFCF7 0%, #FDF8ED 100%)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#14181f" }}>Get your WhatsApp credentials</div>
            <div style={{ fontSize: 13, color: "#6d7175", marginTop: 6 }}>
              Follow these steps in Meta Business Manager to get the Access Token, Phone Number ID, and
              WhatsApp Business Account ID needed in Settings.
            </div>
          </div>

          <div style={cardBase}>
            <Step number={1} title="Create a Meta app">
              Go to{" "}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" style={{ color: COLORS.gold, fontWeight: 700 }}>
                developers.facebook.com/apps
              </a>{" "}
              and click <strong>Create App</strong>. Choose the "Connect with customers through WhatsApp" use
              case, and link it to your business portfolio when prompted.
            </Step>

            <Step number={2} title="Open WhatsApp API Setup">
              Inside your new app, go to <strong>WhatsApp &gt; API Setup</strong>. Your{" "}
              <strong>Phone Number ID</strong> is shown right there under "From" — copy it into Settings.
              You can also find your <strong>WhatsApp Business Account ID</strong> on this same page.
            </Step>

            <Step number={3} title="Create a System User for a permanent token">
              Temporary tokens from API Setup expire in 24 hours. For a token that doesn't expire, go to{" "}
              <strong>business.facebook.com</strong> → Business Settings → Users → System Users → create one
              (Admin role), then assign it access to both your new app and your WhatsApp Business Account
              (Full control on each).
            </Step>

            <Step number={4} title="Generate the token">
              Back on the System User, click <strong>Generate token</strong>, select your app, set expiration
              to <strong>Never</strong>, and check the <code>whatsapp_business_messaging</code> and{" "}
              <code>whatsapp_business_management</code> permissions. Copy the token shown — it's only
              displayed once — and paste it into the <strong>Access token</strong> field in Settings.
            </Step>

            <Step number={5} title="API version">
              Leave this as the default unless Meta has told you otherwise — it matches the Graph API version
              your WhatsApp Business Account is using.
            </Step>

            <Step number={6} title="Create your message templates">
              Finally, go to <strong>WhatsApp Manager &gt; Message templates</strong> and create each
              template listed in the "Required WhatsApp templates" table back on the Settings page, using
              the exact names and languages shown there.
            </Step>
          </div>

          <div style={{ ...cardBase, background: COLORS.goldSoft, border: `1px solid ${COLORS.goldBorder}` }}>
            <div style={{ fontSize: 13, color: "#6d5520", lineHeight: 1.6 }}>
              Prefer not to do this yourself? Email{" "}
              <a href="mailto:apps.kaswebtech@gmail.com" style={{ color: COLORS.gold, fontWeight: 700 }}>
                apps.kaswebtech@gmail.com
              </a>{" "}
              for a paid, done-for-you setup.
            </div>
          </div>

          <Link to="/app/settings" style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13 }}>
            ← Back to Settings
          </Link>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
