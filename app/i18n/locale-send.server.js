import db from "../db.server";
import { SUPPORTED_LOCALES } from "./translations";

function mapShopLocaleToSupported(primaryLocale) {
  if (!primaryLocale) return "en";
  const base = primaryLocale.split("-")[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(base) ? base : "en";
}

// Resolves the shop's active language for both the embedded admin UI and
// outbound WhatsApp sends, via the REST Admin API rather than GraphQL —
// `Shop.primaryLocale` was removed from the GraphQL schema, and its
// replacement (the `shopLocales` query) needs the `read_locales` scope,
// which would force every merchant to re-consent to a new permission just
// for this. REST's `shop.json` exposes `primary_locale` with no extra scope,
// and webhook handlers have no authenticated `admin` GraphQL client anyway
// (only the shop's stored offline access token), so this one implementation
// covers both callers.
//
// `settings` is optional — pass it when the caller already loaded
// db.appSetting rows (avoids a redundant query); omitted, it's fetched here.
export async function resolveSendLocale(shop, settings) {
  let uiLanguageSetting = settings?.UI_LANGUAGE;
  if (uiLanguageSetting === undefined) {
    try {
      const row = await db.appSetting.findUnique({ where: { shop_key: { shop, key: "UI_LANGUAGE" } } });
      uiLanguageSetting = row?.value || null;
    } catch (err) {
      console.error(`[order-ping] failed to read UI_LANGUAGE setting for shop=${shop}`, err);
    }
  }
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
