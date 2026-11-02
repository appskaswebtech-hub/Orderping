import db from "../db.server";
import { SUPPORTED_LOCALES } from "./translations";

// Shopify's shop.primaryLocale is a full locale tag (e.g. "fr-CA", "de",
// "en-US"); we only ship base-language translations, so match on the
// language subtag and fall back to English for anything unsupported.
function mapShopLocaleToSupported(primaryLocale) {
  if (!primaryLocale) return "en";
  const base = primaryLocale.split("-")[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(base) ? base : "en";
}

async function getShopPrimaryLocale(admin) {
  try {
    const response = await admin.graphql(`#graphql
      query ShopLocale {
        shop {
          primaryLocale
        }
      }
    `);
    const data = await response.json();
    return data?.data?.shop?.primaryLocale || null;
  } catch (err) {
    console.error("[order-ping] failed to fetch shop primaryLocale", err);
    return null;
  }
}

// Resolves the effective admin-UI locale for a shop: an explicit UI_LANGUAGE
// setting wins, otherwise it's auto-detected from the store's own language.
export async function resolveLocale({ admin, shop }) {
  if (!shop) return "en";

  let uiLanguageSetting = null;
  try {
    const row = await db.appSetting.findUnique({
      where: { shop_key: { shop, key: "UI_LANGUAGE" } },
    });
    uiLanguageSetting = row?.value || null;
  } catch (err) {
    console.error("[order-ping] failed to read UI_LANGUAGE setting", err);
  }

  if (uiLanguageSetting && SUPPORTED_LOCALES.includes(uiLanguageSetting)) {
    return uiLanguageSetting;
  }

  // No explicit choice (or explicitly "auto") -> detect from the store.
  const primaryLocale = await getShopPrimaryLocale(admin);
  return mapShopLocaleToSupported(primaryLocale);
}
