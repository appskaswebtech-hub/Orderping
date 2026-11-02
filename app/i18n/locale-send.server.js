import db from "../db.server";
import { SUPPORTED_LOCALES } from "./translations";

function mapShopLocaleToSupported(primaryLocale) {
  if (!primaryLocale) return "en";
  const base = primaryLocale.split("-")[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(base) ? base : "en";
}

// Webhook handlers have no authenticated `admin` GraphQL client (unlike
// embedded app routes), only the shop's stored offline access token — so
// this resolves the send language via the REST Admin API instead of
// `resolveLocale` in locale.server.js, which is for the embedded UI only.
export async function resolveSendLocale(shop, settings) {
  const uiLanguageSetting = settings?.UI_LANGUAGE;
  if (uiLanguageSetting && SUPPORTED_LOCALES.includes(uiLanguageSetting)) {
    return uiLanguageSetting;
  }

  try {
    const session = await db.session.findFirst({ where: { shop } });
    if (!session?.accessToken) return "en";
    const res = await fetch(`https://${shop}/admin/api/2024-10/shop.json?fields=primary_locale`, {
      headers: { "X-Shopify-Access-Token": session.accessToken },
    });
    if (!res.ok) return "en";
    const data = await res.json();
    return mapShopLocaleToSupported(data?.shop?.primary_locale);
  } catch (err) {
    console.error(`[order-ping] failed to resolve send locale for shop=${shop}`, err);
    return "en";
  }
}
