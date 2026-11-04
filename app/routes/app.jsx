import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import '../style/design.css';
import SupportChatWidget from "../components/SupportChatWidget.jsx";
import { resolveSendLocale } from "../i18n/locale-send.server";
import { LanguageProvider, useTranslation } from "../i18n/LanguageContext";

// No billing gate here — it's per-page (see requireActivePlan in
// services/billing.server.js) so the Billing page itself doesn't redirect to
// itself in a loop.
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const locale = await resolveSendLocale(session?.shop);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", locale };
};

function Nav() {
  const { t } = useTranslation();
  return (
    <s-app-nav>
      <s-link href="/app" rel="home">{t("nav.home")}</s-link>
      <s-link href="/app/notifications">{t("nav.notifications")}</s-link>
      <s-link href="/app/settings">{t("nav.settings")}</s-link>
      <s-link href="/app/billing">{t("nav.billing")}</s-link>
    </s-app-nav>
  );
}

export default function App() {
  const { apiKey, locale } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <LanguageProvider locale={locale}>
        <Nav />
        <Outlet />
        <SupportChatWidget />
      </LanguageProvider>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
