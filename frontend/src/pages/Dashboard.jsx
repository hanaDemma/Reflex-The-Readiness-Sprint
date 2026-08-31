import { useEffect, useState } from "react";
import { api } from "../api";

const STAT_ROWS = [
  { key: "total_deliveries", label: "Total deliveries", tone: "blue" },
  { key: "open_count", label: "Open", tone: "orange" },
  { key: "assigned_count", label: "Assigned", tone: "purple" },
  { key: "picked_up_count", label: "Picked up", tone: "cyan" },
  { key: "delivered_count", label: "Delivered", tone: "green" },
  { key: "failed_count", label: "Failed", tone: "red" },
];

const PEOPLE_ROWS = [
  { key: "total_riders", label: "Riders", tone: "blue" },
  { key: "active_riders", label: "Active riders", tone: "green" },
  { key: "total_dispatchers", label: "Dispatchers", tone: "purple" },
  { key: "total_retailers", label: "Retailer staff", tone: "orange" },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  const loadDashboard = () => {
    setError("");

    api.dashboard()
      .then(setStats)
      .catch((e) => setError(e.message || "Unable to load dashboard data."));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (error) {
    return (
      <div className="card dashboard-message">
        <div className="error-banner">{error}</div>
        <button className="dashboard-retry" onClick={loadDashboard}>
          Try again
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card dashboard-message">
        <div className="empty-state">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <main className="dashboard">
      <section className="dashboard-section">
        <div className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">Overview</p>
            <h2>Deliveries</h2>
          </div>
          <span className="dashboard-total">
            {stats.total_deliveries ?? 0} total
          </span>
        </div>

        <div className="stat-grid">
          {STAT_ROWS.map((row) => (
            <article className={`stat-card stat-card--${row.tone}`} key={row.key}>
              <div className="stat-value">{stats[row.key] ?? 0}</div>
              <div className="stat-label">{row.label}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">Team</p>
            <h2>People</h2>
          </div>
        </div>

        <div className="stat-grid people-stat-grid">
          {PEOPLE_ROWS.map((row) => (
            <article className={`stat-card stat-card--${row.tone}`} key={row.key}>
              <div className="stat-value">{stats[row.key] ?? 0}</div>
              <div className="stat-label">{row.label}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}