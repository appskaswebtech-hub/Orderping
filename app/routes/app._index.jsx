  import { Link, useLoaderData } from "react-router";
  import { boundary } from "@shopify/shopify-app-react-router/server";
  import { authenticate } from "../shopify.server";
  import { requireActivePlan } from "../services/billing.server";
  import db from "../db.server";

  export const loader = async ({ request }) => {
    const { admin, billing, session } = await authenticate.admin(request);
    const shop = session?.shop;
    await requireActivePlan({ admin, billing, shop });

    const stats = { totalNotifications: 0, sent: 0, failed: 0, pending: 0 };
    const settings = {};
    try {
      if (shop && db && db.notificationLog && typeof db.notificationLog.count === "function") {
        const where = { shop };
        stats.totalNotifications = await db.notificationLog.count({ where });
        stats.sent = await db.notificationLog.count({ where: { ...where, status: "sent" } });
        stats.failed = await db.notificationLog.count({ where: { ...where, status: "failed" } });
        stats.pending = await db.notificationLog.count({ where: { ...where, status: "pending" } });

        const rows = await db.appSetting.findMany({ where: { shop, key: { in: ["ENABLED", "META_ACCESS_TOKEN", "META_PHONE_NUMBER_ID"] } } });
        for (const r of rows) settings[r.key] = r.value;
      }
    } catch (err) {
      console.error("Failed to load notification analytics", err);
    }

    return { stats, settings };
  };

  const COLORS = {
    sent: "#1FA97B",
    failed: "#E5484D",
    pending: "#2B66FF",
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

  const statCard = (accent) => ({
    ...cardBase,
    flex: 1,
    minWidth: 200,
    padding: "20px 22px",
  });
  const accentBar = (color) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: color,
  });
  const iconBadge = (bg, fg) => ({
    position: "absolute",
    top: 18,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 12,
    background: bg,
    color: fg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  const statLabel = { fontSize: 11, fontWeight: 700, color: "#B4791E", textTransform: "uppercase", letterSpacing: 0.6 };
  const statValue = { fontSize: 34, fontWeight: 800, color: "#14181f", marginTop: 8, letterSpacing: -0.5 };

  function Icon({ children, size = 20 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    );
  }
  // TEMPORARILY UNUSED — belongs to the "Set up WhatsApp" banner below, which is
  // commented out while the app is pending Shopify review. Re-enable together.
  const BellIcon = (p) => (
    <Icon {...p}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  );
  const ChartIcon = (p) => (
    <Icon {...p}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </Icon>
  );
  const ShieldIcon = (p) => (
    <Icon {...p}>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
    </Icon>
  );
  const DocIcon = (p) => (
    <Icon {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </Icon>
  );
  const GearIcon = (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </Icon>
  );
  const ArrowIcon = (p) => (
    <Icon {...p}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Icon>
  );
  // TEMPORARILY UNUSED — see BellIcon comment above.
  const WhatsAppIcon = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.86 9.86 0 0 0 4.62 1.14h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.79 14.02c-.24.68-1.4 1.3-1.93 1.34-.53.04-1.02.24-3.42-.72-2.9-1.16-4.75-4.1-4.9-4.3-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.19.01.42-.07.66.5.24.58.83 2 .9 2.15.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.44.51-.15.15-.31.31-.13.6.18.29.79 1.31 1.7 2.12 1.17 1.05 2.16 1.37 2.45 1.53.29.15.46.13.63-.08.17-.2.72-.84.91-1.13.19-.29.38-.24.63-.14.26.1 1.66.78 1.94.92.29.15.48.22.55.34.07.13.07.71-.17 1.39Z" />
    </svg>
  );

  function DonutChart({ sent, failed, pending }) {
    const total = sent + failed + pending;
    const size = 168;
    const stroke = 22;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const segments = total === 0
      ? [{ key: "empty", value: 1, color: "#F1E8D6" }]
      : [
          { key: "sent", value: sent, color: COLORS.sent },
          { key: "failed", value: failed, color: COLORS.failed },
          { key: "pending", value: pending, color: COLORS.pending },
        ];

    let offset = 0;
    const arcs = segments.map((seg) => {
      const fraction = seg.value / (total || 1);
      const dash = fraction * circumference;
      const arc = (
        <circle
          key={seg.key}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-offset}
          strokeLinecap={segments.length > 1 ? "butt" : "round"}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      );
      offset += dash;
      return arc;
    });

    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size}>
          {arcs}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: "#14181f", letterSpacing: -0.5 }}>{total}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8f98", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Total
          </div>
        </div>
      </div>
    );
  }

  function LegendRow({ color, label, value, total }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: "#4a4f57", flex: 1 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#14181f" }}>{value}</span>
        <span style={{ fontSize: 12, color: "#8a8f98", width: 36, textAlign: "right" }}>{pct}%</span>
      </div>
    );
  }

  const quickLinkCard = {
    ...cardBase,
    flex: 1,
    minWidth: 220,
    padding: "18px 20px",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: 14,
  };
  const quickLinkIcon = (bg, fg) => ({
    width: 42,
    height: 42,
    borderRadius: 12,
    background: bg,
    color: fg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  });
  const quickLinkArrow = {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: COLORS.goldSoft,
    color: COLORS.gold,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  export default function Index() {
    const { stats, settings } = useLoaderData();
    const analytics = stats || { totalNotifications: 0, sent: 0, failed: 0, pending: 0 };
    // TEMPORARILY UNUSED — see the commented-out banner below.
    const isConfigured = !!(settings?.META_ACCESS_TOKEN && settings?.META_PHONE_NUMBER_ID);
    const isEnabled = settings?.ENABLED !== "false";

    return (
      <s-page heading="OrderPing">
        <div style={pageBg}>
          <s-stack direction="block" gap="loose">
            {/*
              TEMPORARILY DISABLED while the app is pending Shopify review — WhatsApp
              credentials are currently managed via the server's .env fallback instead
              of per-merchant Settings entry, so this banner would send reviewers to a
              Settings page with nothing to fill in. Re-enable once approved.

            {!isConfigured && (
              <div
                style={{
                  ...cardBase,
                  border: `1px solid ${COLORS.goldBorder}`,
                  background: `linear-gradient(90deg, ${COLORS.goldSoft} 0%, #FEFCF7 100%)`,
                  padding: "22px 26px",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <div style={{ ...quickLinkIcon(COLORS.goldSoft, COLORS.gold), border: `1px solid ${COLORS.goldBorder}` }}>
                  <BellIcon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#7A5310" }}>Set up WhatsApp to start sending</div>
                  <div style={{ fontSize: 13, color: "#8a7452", marginTop: 4 }}>
                    Add your Meta access token and phone number ID in Settings before order notifications can go out.
                  </div>
                  <Link to="/app/settings" style={{ fontSize: 13, fontWeight: 700, color: COLORS.gold, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                    Go to Settings <ArrowIcon size={14} />
                  </Link>
                </div>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#7A5310", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <WhatsAppIcon size={26} />
                </div>
              </div>
            )}
            */}

            <s-stack direction="inline" gap="base">
              <div style={statCard()}>
                <div style={accentBar(COLORS.sent)} />
                <div style={iconBadge("#E6F6EF", COLORS.sent)}>
                  <ChartIcon size={20} />
                </div>
                <div style={statLabel}>Total notifications</div>
                <div style={statValue}>{analytics.totalNotifications}</div>
              </div>
              <div style={statCard()}>
                <div style={accentBar(isEnabled ? COLORS.sent : COLORS.gold)} />
                <div style={iconBadge(COLORS.goldSoft, COLORS.gold)}>
                  <ShieldIcon size={20} />
                </div>
                <div style={statLabel}>Status</div>
                <div style={{ marginTop: 10 }}>
                  <s-badge tone={isEnabled ? "success" : "neutral"} size="large">
                    {isEnabled ? "● Enabled" : "○ Disabled"}
                  </s-badge>
                </div>
              </div>
            </s-stack>

            <div
              style={{
                ...cardBase,
                borderLeft: `4px solid ${COLORS.gold}`,
                padding: "26px 28px",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginBottom: 18 }}>
                Delivery breakdown
              </div>
              <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
                <DonutChart sent={analytics.sent} failed={analytics.failed} pending={analytics.pending} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <LegendRow color={COLORS.sent} label="Sent" value={analytics.sent} total={analytics.totalNotifications} />
                  <LegendRow color={COLORS.failed} label="Failed" value={analytics.failed} total={analytics.totalNotifications} />
                  <LegendRow color={COLORS.pending} label="Pending" value={analytics.pending} total={analytics.totalNotifications} />
                </div>
              </div>
            </div>

            <s-stack direction="inline" gap="base">
              <Link to="/app/notifications" style={quickLinkCard}>
                <div style={quickLinkIcon("#E6F6EF", COLORS.sent)}>
                  <DocIcon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#14181f" }}>Notification log</div>
                  <div style={{ fontSize: 12, color: "#8a8f98", marginTop: 2 }}>View every send attempt and status</div>
                </div>
                <div style={quickLinkArrow}>
                  <ArrowIcon size={16} />
                </div>
              </Link>
              <Link to="/app/settings" style={quickLinkCard}>
                <div style={quickLinkIcon(COLORS.goldSoft, COLORS.gold)}>
                  <GearIcon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#14181f" }}>WhatsApp settings</div>
                  <div style={{ fontSize: 12, color: "#8a8f98", marginTop: 2 }}>Credentials, template, and behavior</div>
                </div>
                <div style={quickLinkArrow}>
                  <ArrowIcon size={16} />
                </div>
              </Link>
            </s-stack>
          </s-stack>
        </div>
      </s-page>
    );
  }

  export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
  };
