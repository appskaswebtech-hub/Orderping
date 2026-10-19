import { authenticate } from "../shopify.server";
import db from "../db.server";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Reached only via Shopify's App Proxy at https://{shop}/apps/notify/collect_optin,
// which Shopify signs with an HMAC using our app secret. authenticate.public.appProxy
// rejects any request whose signature doesn't check out, so this can't be hit directly
// (curl/scripts) the way the old /public/collect_optin endpoint could.

// Small in-memory throttle: max 5 opt-in writes per phone+shop per minute.
// Not durable across restarts/instances, but stops trivial single-process abuse.
const recentAttempts = new Map();
function isRateLimited(key) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 5;
  const attempts = (recentAttempts.get(key) || []).filter((t) => now - t < windowMs);
  attempts.push(now);
  recentAttempts.set(key, attempts);
  return attempts.length > max;
}

export const action = async ({ request }) => {
  try {
    const { shop } = await authenticate.public.appProxy(request);
    if (!shop) {
      // Signature was valid but the shop has no offline session (app not installed / uninstalled).
      return new Response(JSON.stringify({ error: "unknown shop" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const body = await request.json().catch(() => null);
    const { name, phone, country } = body || {};

    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ error: "missing phone" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (isRateLimited(`${shop}:${phone}`)) {
      return new Response(JSON.stringify({ error: "too_many_requests" }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    const pn = parsePhoneNumberFromString(phone, typeof country === "string" ? country : undefined);
    if (!pn || !pn.isValid()) {
      return new Response(JSON.stringify({ error: "invalid_phone" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const normalized = pn.number; // E.164, e.g. +14155552671

    const safeName = typeof name === "string" ? name.slice(0, 120) : null;
    const safeCountry = typeof country === "string" ? country.slice(0, 5) : null;

    await db.customerOptIn.upsert({
      where: { shop_phone: { shop, phone: normalized } },
      update: { name: safeName, country: safeCountry, optedIn: true },
      create: { shop, phone: normalized, country: safeCountry, name: safeName, optedIn: true },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("collect_optin error", err?.message || err);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const loader = async () => new Response(null, { status: 405 });
