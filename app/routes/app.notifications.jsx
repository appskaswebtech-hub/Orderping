import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;

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

const STATUS_TONE = { sent: "success", failed: "critical", pending: "info" };

function StatusBadge({ status }) {
  return <s-badge tone={STATUS_TONE[status] || "neutral"}>{status}</s-badge>;
}

const cardStyle = {
  border: "1px solid #e3e5e7",
  borderRadius: 12,
  overflow: "hidden",
  background: "#fff",
};
const th = {
  textAlign: "left",
  padding: "12px 16px",
  borderBottom: "1px solid #e3e5e7",
  background: "#fafbfb",
  fontSize: 12,
  fontWeight: 600,
  color: "#6d7175",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const td = { padding: "12px 16px", verticalAlign: "top", fontSize: 14, color: "#202223" };

export default function Notifications() {
  const { items, total, page, limit } = useLoaderData();

  const sentCount = items.filter((r) => r.status === "sent").length;
  const failedCount = items.filter((r) => r.status === "failed").length;
  const pendingCount = items.filter((r) => r.status === "pending").length;

  return (
    <s-page heading="Notifications">
      <s-section heading="Summary">
        <s-stack direction="inline" gap="base">
          <s-badge tone="neutral">{total} total</s-badge>
          <s-badge tone="success">{sentCount} sent</s-badge>
          <s-badge tone="critical">{failedCount} failed</s-badge>
          <s-badge tone="info">{pendingCount} pending</s-badge>
        </s-stack>
      </s-section>

      <s-section heading="Notification log">
        <div style={cardStyle}>
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
                    <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#8c9196" }}>
                      No notifications recorded yet — they'll show up here once an order comes
                      in.
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
                      <tr key={r.id} style={{ borderTop: "1px solid #edf0f2" }}>
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
        </div>
        <div style={{ marginTop: 12 }}>
          <s-text>
            Showing {items.length} of {total} notifications (page {page}, {limit} per page)
          </s-text>
        </div>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
