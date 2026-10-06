import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../services/billing.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const shop = session?.shop;
  await requireActivePlan({ admin, billing, shop });

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);
  const skip = (page - 1) * limit;

  const where = { shop };

  let items = [];
  let total = 0;
  try {
    if (shop && db && db.notificationLog && typeof db.notificationLog.findMany === "function") {
      const [fetched, cnt] = await Promise.all([
        db.notificationLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip }),
        db.notificationLog.count({ where }),
      ]);
      items = fetched || [];
      total = cnt || 0;
    } else {
      console.warn("NotificationLog model not available on Prisma client");
    }
  } catch (err) {
    console.error("Error loading notification logs", err);
  }

  return { items, total, page, limit };
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

function Icon({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const DocIcon = (p) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h6" />
  </Icon>
);
const ListIcon = (p) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);
const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const XIcon = (p) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);
const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Icon>
);
const BellIcon = (p) => (
  <Icon {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Icon>
);
const EnvelopeIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 34" fill="none">
    <path d="M2 4C2 2 4 1 6 1h36c2 0 4 1 4 3v26c0 2-2 3-4 3H6c-2 0-4-1-4-3V4Z" fill="#FBF0DC" stroke="#EED9AE" strokeWidth="1.5" />
    <path d="M4 3 24 20 44 3" stroke="#EED9AE" strokeWidth="1.5" fill="none" />
  </svg>
);
const SparkleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#EED9AE">
    <path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10Z" />
  </svg>
);

const STATUS_STYLE = {
  sent: { tone: "success", color: COLORS.sent },
  failed: { tone: "critical", color: COLORS.failed },
  pending: { tone: "info", color: COLORS.pending },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status];
  return <s-badge tone={s ? s.tone : "neutral"}>{status}</s-badge>;
}

const th = {
  textAlign: "left",
  padding: "12px 20px",
  borderBottom: `2px solid ${COLORS.goldBorder}`,
  fontSize: 11,
  fontWeight: 700,
  color: COLORS.gold,
  textTransform: "uppercase",
  letterSpacing: 0.6,
};
const td = { padding: "14px 20px", verticalAlign: "top", fontSize: 14, color: "#202223" };

function SummaryPill({ bg, fg, icon, value, label }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 180,
        borderRadius: 14,
        background: bg,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: fg,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#14181f", letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: "#6d7175", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { items, total, page, limit } = useLoaderData();

  const sentCount = items.filter((r) => r.status === "sent").length;
  const failedCount = items.filter((r) => r.status === "failed").length;
  const pendingCount = items.filter((r) => r.status === "pending").length;

  return (
    <s-page heading="Notifications">
      <div style={pageBg}>
        <s-stack direction="block" gap="loose">
          <div
            style={{
              ...cardBase,
              borderBottom: `2px solid ${COLORS.goldBorder}`,
              padding: "22px 28px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "linear-gradient(90deg, #FEFCF7 0%, #FDF8ED 100%)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: COLORS.goldSoft,
                border: `1px solid ${COLORS.goldBorder}`,
                color: COLORS.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <DocIcon size={22} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#14181f", letterSpacing: -0.5 }}>Notifications</div>
          </div>

          <div style={{ ...cardBase, padding: "24px 26px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginBottom: 16 }}>Summary</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <SummaryPill bg={COLORS.goldSoft} fg={COLORS.gold} icon={<ListIcon size={18} />} value={total} label="total" />
              <SummaryPill bg="#E6F6EF" fg={COLORS.sent} icon={<CheckIcon size={18} />} value={sentCount} label="sent" />
              <SummaryPill bg="#FBE7E8" fg={COLORS.failed} icon={<XIcon size={18} />} value={failedCount} label="failed" />
              <SummaryPill bg="#E7EDFE" fg={COLORS.pending} icon={<ClockIcon size={18} />} value={pendingCount} label="pending" />
            </div>
          </div>

          <div style={{ ...cardBase, padding: "24px 26px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f", marginBottom: 16 }}>Notification log</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Created</th>
                    <th style={th}>Order</th>
                    <th style={th}>Customer</th>
                    <th style={th}>Phone</th>
                    <th style={th}>Status</th>
                    <th style={th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "48px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                          <div style={{ position: "relative", width: 80, height: 60 }}>
                            <span style={{ position: "absolute", left: -6, top: 4 }}>
                              <SparkleIcon size={12} />
                            </span>
                            <span style={{ position: "absolute", right: -6, top: 4 }}>
                              <SparkleIcon size={12} />
                            </span>
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: COLORS.goldSoft,
                                border: `1px solid ${COLORS.goldBorder}`,
                                color: COLORS.gold,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <BellIcon size={16} />
                            </div>
                            <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
                              <EnvelopeIcon size={48} />
                            </div>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#14181f" }}>
                            No notifications recorded yet —
                          </div>
                          <div style={{ fontSize: 13, color: "#8a8f98" }}>
                            they&apos;ll show up here once an order comes in.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((r) => {
                      const detail = r.metaMessageId
                        ? r.metaMessageId
                        : r.errorMessage
                          ? r.errorMessage
                          : "—";
                      return (
                        <tr key={r.id} style={{ borderTop: "1px solid #f1ece0" }}>
                          <td style={td}>{new Date(r.createdAt).toLocaleString()}</td>
                          <td style={td}>{r.orderNumber || r.shopifyOrderId}</td>
                          <td style={td}>{r.customerName || "—"}</td>
                          <td style={td}>{r.customerPhone || "—"}</td>
                          <td style={td}>
                            <StatusBadge status={r.status} />
                          </td>
                          <td style={{ ...td, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#6d7175" }}>
                            {detail}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: "#8a8f98" }}>
              Showing {items.length} of {total} notifications (page {page}, {limit} per page)
            </div>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
