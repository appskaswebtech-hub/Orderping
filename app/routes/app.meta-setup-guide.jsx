import { Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { useTranslation } from "../i18n/LanguageContext";

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
  const { t } = useTranslation();
  return (
    <s-page heading={t("guide.heading")}>
      <div style={pageBg}>
        <s-stack direction="block" gap="loose">
          <div style={{ ...cardBase, background: "linear-gradient(90deg, #FEFCF7 0%, #FDF8ED 100%)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#14181f" }}>{t("guide.heading")}</div>
            <div style={{ fontSize: 13, color: "#6d7175", marginTop: 6, marginBottom: 16 }}>
              {t("guide.intro")}
            </div>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 10,
                background: COLORS.sent,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("guide.openMetaGuide")}
            </a>

            <div style={{ fontSize: 13, color: "#6d7175", marginTop: 20, marginBottom: 10 }}>
              {t("guide.verifyIntro")}
            </div>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 10,
                border: `1px solid ${COLORS.goldBorder}`,
                background: "#fff",
                color: COLORS.gold,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("guide.verifyGuide")}
            </a>
          </div>

          <div style={cardBase}>
            <Step number={1} title={t("guide.step1Title")}>
              {t("guide.step1Body1")}{" "}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" style={{ color: COLORS.gold, fontWeight: 700 }}>
                developers.facebook.com/apps
              </a>{" "}
              {t("guide.step1Body2")} <strong>Create App</strong>{t("guide.step1Body3")}
            </Step>

            <Step number={2} title={t("guide.step2Title")}>
              {t("guide.step2Body1")} <strong>WhatsApp &gt; API Setup</strong>{t("guide.step2Body2")}{" "}
              <strong>Phone Number ID</strong> {t("guide.step2Body3")} <strong>WhatsApp Business Account ID</strong> {t("guide.step2Body4")}
            </Step>

            <Step number={3} title={t("guide.step3Title")}>
              {t("guide.step3Body1")}{" "}
              <strong>business.facebook.com</strong> {t("guide.step3Body2")}
            </Step>

            <Step number={4} title={t("guide.step4Title")}>
              {t("guide.step4Body1")} <strong>Generate token</strong>{t("guide.step4Body2")}{" "}
              <strong>Never</strong>{t("guide.step4Body3")} <code>whatsapp_business_messaging</code> {t("guide.step4Body4")}{" "}
              <code>whatsapp_business_management</code> {t("guide.step4Body5")} <strong>Access token</strong> {t("guide.step4Body6")}
            </Step>

            <Step number={5} title={t("guide.step5Title")}>
              {t("guide.step5Body")}
            </Step>

            <Step number={6} title={t("guide.step6Title")}>
              {t("guide.step6Body1")} <strong>WhatsApp Manager &gt; Message templates</strong> {t("guide.step6Body2")}
            </Step>
          </div>

          <div style={{ ...cardBase, background: COLORS.goldSoft, border: `1px solid ${COLORS.goldBorder}` }}>
            <div style={{ fontSize: 13, color: "#6d5520", lineHeight: 1.6 }}>
              {t("guide.doneForYou")}{" "}
              <a href="mailto:apps.kaswebtech@gmail.com" style={{ color: COLORS.gold, fontWeight: 700 }}>
                apps.kaswebtech@gmail.com
              </a>{" "}
              {t("guide.doneForYouEnd")}
            </div>
          </div>

          <Link to="/app/settings" style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13 }}>
            {t("guide.backToSettings")}
          </Link>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
