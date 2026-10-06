import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Only charged on live (non-development) stores — see isDevelopmentStore() in
// app/routes/app.jsx, which skips the billing gate entirely for dev stores
// rather than trying to model a $0 plan through Shopify's billing API.
export const BASIC_PLAN = "Basic Plan";
export const PRO_PLAN = "Pro Plan";
export const ADVANCED_PLAN = "Advanced Plan";
export const PAID_PLANS = [BASIC_PLAN, PRO_PLAN, ADVANCED_PLAN];

// Monthly WhatsApp message cap per plan. `null` means unlimited. Enforced in
// order-events.server.js's checkAndConsumeMessageQuota() against the
// MESSAGE_LIMIT value stored per shop (see services/billing.server.js, which
// writes it after confirming an active subscription).
export const PLAN_MESSAGE_LIMITS = {
  [BASIC_PLAN]: 500,
  [PRO_PLAN]: 1000,
  [ADVANCED_PLAN]: null,
};

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  billing: {
    [BASIC_PLAN]: {
      lineItems: [{ amount: 3.99, currencyCode: "USD", interval: BillingInterval.Every30Days }],
    },
    [PRO_PLAN]: {
      lineItems: [{ amount: 5.99, currencyCode: "USD", interval: BillingInterval.Every30Days }],
    },
    [ADVANCED_PLAN]: {
      lineItems: [{ amount: 9.99, currencyCode: "USD", interval: BillingInterval.Every30Days }],
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
