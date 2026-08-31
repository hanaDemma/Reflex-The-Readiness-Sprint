import { useState } from "react";
import { api, setSession } from "../api";

export default function Login({ onLoggedIn }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function doLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const session = await api.login(phone, password);
      setSession(session);
      onLoggedIn(session);
    } catch (e) {
      setError(e.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        display: "grid",
        minHeight: "100vh",
        width: "100%",
        placeItems: "center",
        padding: "24px",
        background: "#f7f7f5",
      }}
    >
      <section
        className="card"
        style={{
          width: "min(100%, 420px)",
          margin: 0,
          padding: "32px",
          borderRadius: "16px",
          boxShadow: "0 18px 40px rgba(31, 36, 33, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "13px", marginBottom: "26px" }}>
          <span
            style={{
              display: "grid",
              width: "42px",
              height: "42px",
              placeItems: "center",
              borderRadius: "11px",
              background: "#1f6f5c",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            R
          </span>

          <div>
            <h1 style={{ margin: 0, fontSize: "1.7rem" }}>
              Reflex<span style={{ color: "#1f6f5c" }}>.</span>
            </h1>
            <p style={{ margin: "3px 0 0", color: "#5c635f", fontSize: "0.88rem" }}>
              Delivery tracking for small retailers.
            </p>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={doLogin}>
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            required
            inputMode="tel"
            autoComplete="username"
            value={phone}
            placeholder="0700000000"
            onChange={(e) => setPhone(e.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            required
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder="Enter your password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="primary" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}