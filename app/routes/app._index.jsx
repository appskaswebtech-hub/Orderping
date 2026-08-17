import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;

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

const COLORS = { sent: "#00A878", failed: "#E5484D", pending: "#2B66FF" };

const pageBg = { background: "linear-gradient(180deg, #f6f7f9 0%, #eef0f3 100%)", minHeight: "100%", padding: "4px 0" };

const statCard = (accent) => ({
  flex: 1,
  minWidth: 180,
  borderRadius: 16,
  padding: "20px 22px",
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 12px rgba(16,24,40,0.06)",
  border: "1px solid rgba(16,24,40,0.04)",
  position: "relative",
  overflow: "hidden",
});
const accentBar = (color) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 4,
  background: color,
});
const statLabel = { fontSize: 12, fontWeight: 700, color: "#8a8f98", textTransform: "uppercase", letterSpacing: 0.6 };
const statValue = { fontSize: 32, fontWeight: 800, color: "#14181f", marginTop: 6, letterSpacing: -0.5 };

function DonutChart({ sent, failed, pending }) {
  const total = sent + failed + pending;
  const size = 168;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = total === 0
    ? [{ key: "empty", value: 1, color: "#eef0f3" }]
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
  flex: 1,
  minWidth: 180,
  borderRadius: 14,
  padding: "18px 20px",
  background: "#fff",
  border: "1px solid rgba(16,24,40,0.06)",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  textDecoration: "none",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

export default function Index() {
  const { stats, settings } = useLoaderData();
  const analytics = stats || { totalNotifications: 0, sent: 0, failed: 0, pending: 0 };
  const isConfigured = !!(settings?.META_ACCESS_TOKEN && settings?.META_PHONE_NUMBER_ID);
  const isEnabled = settings?.ENABLED === "true";

  return (
    <s-page heading="OrderPing">
      <div style={pageBg}>
        <s-stack direction="block" gap="loose">
          {!isConfigured && (
            <s-banner tone="warning" heading="Set up WhatsApp to start sending">
              <s-paragraph>
                Add your Meta access token and phone number ID in Settings before order
                notifications can go out.
              </s-paragraph>
              <s-link href="/app/settings">Go to Settings</s-link>
            </s-banner>
          )}

          <s-stack direction="inline" gap="base">
            <div style={statCard(COLORS.sent)}>
              <div style={accentBar(COLORS.sent)} />
              <div style={statLabel}>Total notifications</div>
              <div style={statValue}>{analytics.totalNotifications}</div>
            </div>
            <div style={statCard(isEnabled ? COLORS.sent : "#c9cccf")}>
              <div style={accentBar(isEnabled ? COLORS.sent : "#c9cccf")} />
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
              borderRadius: 18,
              padding: "26px 28px",
              background: "#fff",
              boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 12px rgba(16,24,40,0.06)",
              border: "1px solid rgba(16,24,40,0.04)",
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
            <a href="/app/notifications" style={quickLinkCard}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#14181f" }}>Notification log</span>
              <span style={{ fontSize: 12, color: "#8a8f98" }}>View every send attempt and status</span>
            </a>
            <a href="/app/settings" style={quickLinkCard}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#14181f" }}>WhatsApp settings</span>
              <span style={{ fontSize: 12, color: "#8a8f98" }}>Credentials, template, and behavior</span>
            </a>
          </s-stack>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
