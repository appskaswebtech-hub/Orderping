import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../services/billing.server";
import db from "../db.server";

const STATUSES = [
  {
    key: "sent",
    label: "Sent",
    icon: "check",
    description: "Sent to WhatsApp",
  },
  {
    key: "failed",
    label: "Failed",
    icon: "alert",
    description: "Needs your attention",
  },
  {
    key: "pending",
    label: "Pending",
    icon: "clock",
    description: "Waiting to be sent",
  },
];

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const shop = session?.shop;
  await requireActivePlan({ admin, billing, request, shop });

  const url = new URL(request.url);
  const pageInput = Number(url.searchParams.get("page") || "1");
  const limitInput = Number(url.searchParams.get("limit") || "50");
  let page = Number.isSafeInteger(pageInput) && pageInput > 0 ? pageInput : 1;
  const limit =
    Number.isSafeInteger(limitInput) && limitInput > 0
      ? Math.min(limitInput, 200)
      : 50;
  const query = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const requestedStatus = url.searchParams.get("status");
  const status = STATUSES.some((item) => item.key === requestedStatus)
    ? requestedStatus
    : "all";
  const where = {
    shop,
    ...(status !== "all" ? { status } : {}),
    ...(query
      ? {
          OR: [
            "orderNumber",
            "shopifyOrderId",
            "customerName",
            "customerPhone",
          ].map((field) => ({ [field]: { contains: query } })),
        }
      : {}),
  };

  let items = [];
  let total = 0;
  const summary = { total: 0, sent: 0, failed: 0, pending: 0 };
  let unavailable = false;
  try {
    if (!shop || !db?.notificationLog)
      throw new Error("Notification log is unavailable");
    const [count, groups] = await Promise.all([
      db.notificationLog.count({ where }),
      db.notificationLog.groupBy({
        by: ["status"],
        where: { shop },
        _count: { _all: true },
      }),
    ]);
    total = count;
    for (const group of groups) {
      summary.total += group._count._all;
      if (STATUSES.some((item) => item.key === group.status))
        summary[group.status] = group._count._all;
    }
    page = Math.min(page, Math.max(1, Math.ceil(total / limit)));
    items = await db.notificationLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: (page - 1) * limit,
    });
  } catch (err) {
    unavailable = true;
    console.error("Error loading notification logs", err);
  }
  return { items, total, page, limit, query, status, summary, unavailable };
};

// Private presentation components only receive props from this route.
/* eslint-disable react/prop-types */
function LogIcon({ name, size = 20 }) {
  const paths = {
    chat: (
      <>
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4 8.5 8.5 0 0 1 17 0Z" />
        <path d="M8 10h8M8 14h5" />
      </>
    ),
    chart: <path d="M4 4v16h16M9 16v-5M14 16V7M19 16v-3" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 17h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3a7 7 0 0 0 11.6-1" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" fill="currentColor" stroke="none" />
        <circle cx="15" cy="17" r="3" fill="currentColor" stroke="none" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.chat}
    </svg>
  );
}

function StatusBadge({ status }) {
  const known = STATUSES.find((item) => item.key === status);
  return (
    <span className={`op-log-status op-log-status-${known ? status : "other"}`}>
      <LogIcon name={known?.icon || "clock"} size={13} />
      {known?.label || status || "Unknown"}
    </span>
  );
}
/* eslint-enable react/prop-types */

const UPDATE_NAMES = {
  whatsapp: "Order confirmation",
  whatsapp_shipped: "Shipped",
  whatsapp_out_for_delivery: "Out for delivery",
  whatsapp_delivered: "Delivered",
  whatsapp_refund: "Refund initiated",
  whatsapp_cancelled: "Cancelled",
  whatsapp_paid: "Payment received",
  whatsapp_partially_fulfilled: "Partially fulfilled",
};

function formatUpdate(type) {
  return (
    UPDATE_NAMES[type] ||
    (type
      ? type
          .replaceAll("_", " ")
          .replace(/^./, (letter) => letter.toUpperCase())
      : "Order update")
  );
}

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The scroll region needs keyboard focus so the table can be scrolled with arrow keys. */
export default function Notifications() {
  const { items, total, page, limit, query, status, summary, unavailable } =
    useLoaderData();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const busy = navigation.state !== "idle" || revalidator.state !== "idle";
  const filtered = !!query || status !== "all";
  const pages = Math.max(1, Math.ceil(total / limit));
  const rangeStart = total ? (page - 1) * limit + 1 : 0;
  const rangeEnd = Math.min(page * limit, total);

  const logUrl = (changes = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "" || value === "all") next.delete(key);
      else next.set(key, String(value));
    }
    const encoded = next.toString();
    return `/app/notifications${encoded ? `?${encoded}` : ""}`;
  };
  const clearUrl = logUrl({ q: null, status: null, page: null });

  return (
    <s-page heading="Notifications">
      <div className="op-dashboard op-notifications">
        <header className="op-page-header">
          <div>
            <h1>Notifications</h1>
            <p>Track every WhatsApp update sent to your customers.</p>
          </div>
          <div className="op-log-actions">
            <Link to="/app/settings" className="op-button op-button-secondary">
              <LogIcon name="settings" size={16} />
              Settings
            </Link>
            <button
              type="button"
              className="op-button op-button-primary"
              onClick={() => revalidator.revalidate()}
              disabled={busy}
            >
              <LogIcon name="refresh" size={16} />
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        <div className="op-welcome op-log-intro">
          <span className="op-log-intro-icon">
            <LogIcon name="chat" size={27} />
          </span>
          <div>
            <h2>Every order update, in one place.</h2>
            <p>
              Find a notification, check its status, and see what needs
              attention.
            </p>
          </div>
          <span className="op-log-channel">WhatsApp</span>
        </div>

        <section
          className="op-stats-grid"
          aria-label="Notification totals, all time"
        >
          {[
            {
              key: "total",
              label: "Total notifications",
              description: "All notification attempts",
              icon: "chart",
            },
            ...STATUSES,
          ].map((item) => (
            <article
              className={`op-stat-card ${item.key !== "total" ? `op-stat-${item.key}` : ""}`}
              key={item.key}
            >
              <div className="op-stat-top">
                <h2>{item.label}</h2>
                <span
                  className={`op-icon op-icon-${item.key === "total" ? "neutral" : item.key}`}
                >
                  <LogIcon name={item.icon} size={18} />
                </span>
              </div>
              <strong className="op-stat-value">
                {unavailable ? "—" : summary[item.key].toLocaleString()}
              </strong>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <section
          className="op-log-panel"
          aria-labelledby="op-log-title"
          aria-busy={busy}
        >
          <div className="op-log-panel-top">
            <div>
              <h2 id="op-log-title">Notification log</h2>
              <p>Latest attempts first · Summary totals are for all time</p>
            </div>
            <span className="op-period">
              {unavailable
                ? "Unavailable"
                : `${total.toLocaleString()} ${filtered ? "matches" : "notifications"}`}
            </span>
          </div>
          <div className="op-log-tools">
            <nav
              className="op-log-filters"
              aria-label="Filter by notification status"
            >
              {[
                { key: "all", label: "All", count: summary.total },
                ...STATUSES.map((item) => ({
                  ...item,
                  count: summary[item.key],
                })),
              ].map((item) => (
                <Link
                  key={item.key}
                  to={logUrl({ status: item.key, page: null })}
                  className={`op-log-filter ${status === item.key ? "op-log-filter-active" : ""}`}
                  aria-current={status === item.key ? "page" : undefined}
                >
                  {item.label}
                  <span>{unavailable ? "—" : item.count.toLocaleString()}</span>
                </Link>
              ))}
            </nav>
            <Form
              method="get"
              className="op-log-search"
              role="search"
              key={query}
            >
              {[...searchParams]
                .filter(
                  ([key]) => !["q", "status", "page", "limit"].includes(key),
                )
                .map(([key, value], index) => (
                  <input
                    key={`${key}-${index}`}
                    type="hidden"
                    name={key}
                    value={value}
                  />
                ))}
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="limit" value={limit} />
              <label
                htmlFor="op-log-search-input"
                className="op-visually-hidden"
              >
                Search by order, customer or phone
              </label>
              <span className="op-log-search-field">
                <LogIcon name="search" size={17} />
                <input
                  id="op-log-search-input"
                  type="search"
                  name="q"
                  placeholder="Search order, customer or phone"
                  defaultValue={query}
                  maxLength={100}
                />
              </span>
              <button
                type="submit"
                className="op-button op-button-secondary"
                disabled={busy}
              >
                Search
              </button>
            </Form>
          </div>
          {filtered && (
            <div className="op-log-applied">
              <span>
                {query
                  ? `Results for “${query}”`
                  : `${STATUSES.find((item) => item.key === status)?.label} notifications`}
              </span>
              <Link to={clearUrl} className="op-text-link">
                Clear filters
              </Link>
            </div>
          )}

          {unavailable ? (
            <div className="op-log-empty" role="alert">
              <span className="op-log-empty-icon op-icon-failed">
                <LogIcon name="alert" size={30} />
              </span>
              <h3>We couldn’t load your notifications</h3>
              <p>
                Refresh to try again. Your notification history will appear here
                when it’s available.
              </p>
              <button
                type="button"
                className="op-button op-button-primary"
                onClick={() => revalidator.revalidate()}
                disabled={busy}
              >
                {busy ? "Retrying…" : "Try again"}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="op-log-empty">
              <span className="op-log-empty-icon op-icon-green">
                <LogIcon name={filtered ? "search" : "chat"} size={30} />
              </span>
              <h3>
                {filtered
                  ? "No matching notifications"
                  : "Your notification history starts here"}
              </h3>
              <p>
                {filtered
                  ? "Try another order number, customer name or phone number, or clear your filters."
                  : "Once notifications are enabled, messages triggered by your selected order events will appear here."}
              </p>
              {filtered ? (
                <Link to={clearUrl} className="op-button op-button-secondary">
                  Clear filters
                </Link>
              ) : (
                <Link
                  to="/app/settings"
                  className="op-button op-button-primary"
                >
                  Open notification settings
                  <LogIcon name="arrow" size={16} />
                </Link>
              )}
            </div>
          ) : (
            <div
              className="op-log-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Notification history. Scroll horizontally to see all columns."
            >
              <table className="op-log-table">
                <caption className="op-visually-hidden">
                  Notification attempts, newest first. Dates and times are in
                  UTC.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      Created <span>(UTC)</span>
                    </th>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Update</th>
                    <th scope="col">Status</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <time dateTime={new Date(item.createdAt).toISOString()}>
                          {new Date(item.createdAt).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: "UTC",
                            },
                          )}
                          <span className="op-log-subtext">
                            {new Date(item.createdAt).toLocaleTimeString(
                              "en-GB",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                              },
                            )}
                          </span>
                        </time>
                      </td>
                      <td>
                        <strong className="op-log-order">
                          {item.orderNumber || item.shopifyOrderId}
                        </strong>
                      </td>
                      <td>
                        <span className="op-log-customer">
                          {item.customerName || "Customer"}
                        </span>
                        <span className="op-log-subtext">
                          {item.customerPhone || "No phone recorded"}
                        </span>
                      </td>
                      <td>{formatUpdate(item.notificationType)}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        {item.errorMessage || item.metaMessageId ? (
                          <details
                            className={`op-log-details ${item.errorMessage ? "op-log-details-error" : ""}`}
                          >
                            <summary>
                              {item.errorMessage ? "View error" : "Message ID"}
                            </summary>
                            <pre>{item.errorMessage || item.metaMessageId}</pre>
                          </details>
                        ) : (
                          <span className="op-log-subtext">
                            {item.status === "pending"
                              ? "Awaiting send"
                              : "No additional details"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!unavailable && (
            <footer className="op-log-pagination">
              <p>
                {total
                  ? `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`
                  : "Showing 0 notifications"}
              </p>
              <div>
                <span className="op-log-page-count">
                  Page {page} of {pages}
                </span>
                {page > 1 ? (
                  <Link
                    to={logUrl({ page: page - 1 })}
                    className="op-button op-button-secondary"
                    aria-label="Previous page"
                  >
                    <LogIcon name="back" size={15} />
                    Previous
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="op-button op-button-secondary"
                    disabled
                  >
                    <LogIcon name="back" size={15} />
                    Previous
                  </button>
                )}
                {page < pages ? (
                  <Link
                    to={logUrl({ page: page + 1 })}
                    className="op-button op-button-secondary"
                    aria-label="Next page"
                  >
                    Next
                    <LogIcon name="arrow" size={15} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="op-button op-button-secondary"
                    disabled
                  >
                    Next
                    <LogIcon name="arrow" size={15} />
                  </button>
                )}
              </div>
            </footer>
          )}
        </section>
        <p className="op-log-footnote">
          <LogIcon name="clock" size={14} />
          New activity appears when you refresh. “Sent” means the message was
          accepted by WhatsApp.
        </p>
      </div>
    </s-page>
  );
}

/* eslint-enable jsx-a11y/no-noninteractive-tabindex */

export const headers = (headersArgs) => boundary.headers(headersArgs);
