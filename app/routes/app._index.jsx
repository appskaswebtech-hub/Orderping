import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../services/billing.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const shop = session?.shop;
  await requireActivePlan({ admin, billing, request, shop });

  const stats = { totalNotifications: 0, sent: 0, failed: 0, pending: 0 };
  const settings = {};
  let analyticsUnavailable = false;
  try {
    if (
      shop &&
      db &&
      db.notificationLog &&
      typeof db.notificationLog.count === "function"
    ) {
      const where = { shop };
      stats.totalNotifications = await db.notificationLog.count({ where });
      stats.sent = await db.notificationLog.count({
        where: { ...where, status: "sent" },
      });
      stats.failed = await db.notificationLog.count({
        where: { ...where, status: "failed" },
      });
      stats.pending = await db.notificationLog.count({
        where: { ...where, status: "pending" },
      });
      const rows = await db.appSetting.findMany({
        where: { shop, key: { in: ["ENABLED", "ENABLED_OPT_IN_CONFIRMED"] } },
      });
      for (const row of rows) settings[row.key] = row.value;
    } else {
      analyticsUnavailable = true;
    }
  } catch (err) {
    analyticsUnavailable = true;
    console.error("Failed to load notification analytics", err);
  }
  return { stats, settings, analyticsUnavailable };
};

const DELIVERY_STATES = [
  {
    key: "sent",
    label: "Sent",
    description: "Sent to WhatsApp",
    color: "#16865f",
    icon: "check",
  },
  {
    key: "failed",
    label: "Failed",
    description: "Needs your attention",
    color: "#d04747",
    icon: "alert",
  },
  {
    key: "pending",
    label: "Pending",
    description: "Waiting to be sent",
    color: "#5475d6",
    icon: "clock",
  },
];

// These private presentation helpers only receive props from this route.
/* eslint-disable react/prop-types */
function Icon({ name, size = 20 }) {
  const paths = {
    chat: (
      <>
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4 8.5 8.5 0 0 1 17 0Z" />
        <path d="M8 10h8M8 14h5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 4v16h16M9 16v-5M14 16V7M19 16v-3" />
      </>
    ),
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
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    document: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h5" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" fill="currentColor" stroke="none" />
        <circle cx="15" cy="17" r="3" fill="currentColor" stroke="none" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
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

function DonutChart({ analytics, unavailable }) {
  const total = DELIVERY_STATES.reduce(
    (sum, state) => sum + analytics[state.key],
    0,
  );
  const radius = 63;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div
      className="op-donut"
      role="img"
      aria-label={
        unavailable
          ? "Delivery data unavailable"
          : `${total.toLocaleString()} notifications: ${analytics.sent} sent, ${analytics.failed} failed, ${analytics.pending} pending`
      }
    >
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#edf1ef"
          strokeWidth="15"
        />
        {!unavailable &&
          total > 0 &&
          DELIVERY_STATES.map((state) => {
            const dash = (analytics[state.key] / total) * circumference;
            const segment = (
              <circle
                key={state.key}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={state.color}
                strokeWidth="15"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
              />
            );
            offset += dash;
            return segment;
          })}
      </svg>
      <div className="op-donut-label">
        <strong>{unavailable ? "—" : total.toLocaleString()}</strong>
        <span>Notifications</span>
      </div>
    </div>
  );
}

function QuickLink({ to, icon, title, children }) {
  return (
    <Link to={to} className="op-quick-link">
      <span className="op-icon op-icon-neutral">
        <Icon name={icon} />
      </span>
      <span className="op-quick-copy">
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
      <Icon name="arrow" size={18} />
    </Link>
  );
}

/* eslint-enable react/prop-types */

export default function Index() {
  const { stats, settings, analyticsUnavailable = false } = useLoaderData();
  const analytics = stats || {
    totalNotifications: 0,
    sent: 0,
    failed: 0,
    pending: 0,
  };
  const isEnabled =
    settings?.ENABLED === "true" &&
    settings?.ENABLED_OPT_IN_CONFIRMED === "true";
  const hasNotifications = analytics.totalNotifications > 0;
  const status = analyticsUnavailable
    ? "Unavailable"
    : isEnabled
      ? "Enabled"
      : "Disabled";
  const successRate =
    analytics.totalNotifications > 0
      ? Math.round((analytics.sent / analytics.totalNotifications) * 100)
      : 0;

  return (
    <s-page heading="OrderPing">
      <div className="op-dashboard">
        <header className="op-page-header">
          <div>
            <h1>Overview</h1>
            <p>Your WhatsApp notifications, at a glance.</p>
          </div>
          <Link
            to="/app/notifications"
            className="op-button op-button-secondary"
          >
            <Icon name="document" size={16} />
            View notification log
          </Link>
        </header>

        <section className="op-welcome" aria-labelledby="op-welcome-title">
          <div className="op-welcome-copy">
            <div className="op-eyebrow">
              <Icon name="chat" size={16} />
              WHATSAPP ORDER UPDATES
            </div>
            <h2 id="op-welcome-title">Keep customers in the loop.</h2>
            <p>
              Send timely order updates on WhatsApp.
              <br />A little reassurance, from checkout to delivery.
            </p>
            <Link to="/app/settings" className="op-button op-button-primary">
              Manage notifications
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div
            className="op-message-preview"
            aria-label="Example WhatsApp notification"
          >
            <div className="op-message-heading">
              <span className="op-icon op-icon-green">
                <Icon name="chat" size={20} />
              </span>
              <div>
                <strong>Order update</strong>
                <span>WhatsApp notification</span>
              </div>
              <span className="op-example-label">Example</span>
            </div>
            <div className="op-message-bubble">
              <strong>Your order is on its way 🎉</strong>
              <p>
                We’ll keep you updated on its journey.
                <br />
                Thanks for shopping with us!
              </p>
              <span className="op-message-checks">
                <Icon name="check" size={12} />
                <Icon name="check" size={12} />
              </span>
            </div>
          </div>
        </section>

        {analyticsUnavailable && (
          <div className="op-load-alert" role="alert">
            <Icon name="alert" size={18} />
            <span>
              We couldn’t load your dashboard data. Refresh the page to try
              again.
            </span>
          </div>
        )}

        <section
          className="op-stats-grid"
          aria-label="Notification totals, all time"
        >
          <article className="op-stat-card">
            <div className="op-stat-top">
              <h2>Total notifications</h2>
              <span className="op-icon op-icon-neutral">
                <Icon name="chart" size={18} />
              </span>
            </div>
            <strong className="op-stat-value">
              {analyticsUnavailable
                ? "—"
                : analytics.totalNotifications.toLocaleString()}
            </strong>
            <p>All notification attempts</p>
          </article>
          {DELIVERY_STATES.map((state) => (
            <article
              className={`op-stat-card op-stat-${state.key}`}
              key={state.key}
            >
              <div className="op-stat-top">
                <h2>{state.label}</h2>
                <span className={`op-icon op-icon-${state.key}`}>
                  <Icon name={state.icon} size={18} />
                </span>
              </div>
              <strong className="op-stat-value">
                {analyticsUnavailable
                  ? "—"
                  : analytics[state.key].toLocaleString()}
              </strong>
              <p>{state.description}</p>
            </article>
          ))}
        </section>

        <div className="op-detail-grid">
          <section className="op-panel" aria-labelledby="op-delivery-title">
            <div className="op-panel-heading">
              <div>
                <h2 id="op-delivery-title">Delivery overview</h2>
                <p>How your notifications are performing</p>
              </div>
              <span className="op-period">All time</span>
            </div>
            <div className="op-delivery-content">
              <DonutChart
                analytics={analytics}
                unavailable={analyticsUnavailable}
              />
              <div className="op-legend">
                {DELIVERY_STATES.map((state) => (
                  <div className="op-legend-row" key={state.key}>
                    <span className={`op-dot op-dot-${state.key}`} />
                    <span>{state.label}</span>
                    <strong>
                      {analyticsUnavailable
                        ? "—"
                        : analytics[state.key].toLocaleString()}
                    </strong>
                    <span className="op-percentage">
                      {analyticsUnavailable
                        ? "—"
                        : `${analytics.totalNotifications > 0 ? Math.round((analytics[state.key] / analytics.totalNotifications) * 100) : 0}%`}
                    </span>
                  </div>
                ))}
                <div className="op-delivery-note">
                  {analyticsUnavailable
                    ? "Data temporarily unavailable"
                    : hasNotifications
                      ? `${successRate}% of all attempts sent successfully`
                      : "Your delivery stats will appear here."}
                </div>
              </div>
            </div>
          </section>

          <section
            className="op-panel op-automation"
            aria-labelledby="op-automation-title"
          >
            <div className="op-panel-heading">
              <h2 id="op-automation-title">Notification status</h2>
              <span
                className={`op-status ${analyticsUnavailable ? "op-status-unknown" : isEnabled ? "op-status-enabled" : "op-status-disabled"}`}
              >
                <span />
                {status}
              </span>
            </div>
            <span
              className={`op-automation-icon op-icon ${isEnabled && !analyticsUnavailable ? "op-icon-green" : "op-icon-neutral"}`}
            >
              <Icon name="bolt" size={23} />
            </span>
            <h3>
              {analyticsUnavailable
                ? "Status temporarily unavailable"
                : isEnabled
                  ? "Order updates are enabled"
                  : "Ready when you are"}
            </h3>
            <p>
              {analyticsUnavailable
                ? "Refresh the page to check your notification settings."
                : isEnabled
                  ? "Automatic WhatsApp updates are enabled for your selected order events."
                  : "Turn on WhatsApp notifications in Settings to keep customers updated about their orders."}
            </p>
            <Link to="/app/settings" className="op-text-link">
              {isEnabled ? "Manage settings" : "Open settings"}
              <Icon name="arrow" size={16} />
            </Link>
          </section>
        </div>

        {!hasNotifications && !analyticsUnavailable && (
          <div className="op-first-notification">
            <span className="op-icon op-icon-green">
              <Icon name="chat" size={20} />
            </span>
            <div>
              <strong>Your first notification starts here</strong>
              <p>
                {isEnabled
                  ? "Notifications will appear here when a selected order event triggers a message."
                  : "Enable notifications and choose the order updates you want to send in Settings."}
              </p>
            </div>
          </div>
        )}

        <nav className="op-quick-links" aria-label="Dashboard shortcuts">
          <QuickLink
            to="/app/notifications"
            icon="document"
            title="Notification log"
          >
            Track send attempts and investigate errors.
          </QuickLink>
          <QuickLink
            to="/app/settings"
            icon="settings"
            title="WhatsApp settings"
          >
            Choose your messaging mode and order updates.
          </QuickLink>
        </nav>
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
