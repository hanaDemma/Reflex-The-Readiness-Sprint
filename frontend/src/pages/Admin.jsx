import { useState } from "react";
import Dashboard from "./Dashboard";
import UserManagement from "./UserManagement";

export default function Admin() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">
          <p className="section-eyebrow">Administration</p>
          <h2>Control centre</h2>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          <button
            className={`admin-nav-item ${tab === "dashboard" ? "active" : ""}`}
            onClick={() => setTab("dashboard")}
          >
            <span className="nav-icon">▦</span>
            Dashboard
          </button>

          <button
            className={`admin-nav-item ${tab === "users" ? "active" : ""}`}
            onClick={() => setTab("users")}
          >
            <span className="nav-icon">♙</span>
            User management
          </button>
        </nav>
      </aside>

      <section className="admin-content">
        {tab === "dashboard" ? <Dashboard /> : <UserManagement />}
      </section>
    </div>
  );
}