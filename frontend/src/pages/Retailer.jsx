import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api";
import { useReflexSocket } from "../ws";
import StatusPill from "../components/StatusPill";

const EMPTY_FORM = {
  customer_name: "",
  customer_phone: "",
  address: "",
  item_description: "",
};

export default function Retailer() {
  const [deliveries, setDeliveries] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setLoading(true);
      setDeliveries(await api.myDeliveries());
    } catch (e) {
      setError(e.message || "Unable to load deliveries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useReflexSocket((event) => {
    if (event.type === "status_changed" || event.type === "new_assignment") {
      refresh();
    }
  });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      await api.createDelivery(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to create delivery request.");
    } finally {
      setBusy(false);
    }
  }

  const activeDeliveries = deliveries.filter(
    (delivery) => !["Delivered", "Failed"].includes(delivery.current_status)
  );

  return (
    <main className="role-page retailer-page">
      <section className="role-hero">
        <div>
          <p className="section-eyebrow">Delivery tracking</p>
          <h1>Deliveries at a glance</h1>
          <p className="subtle">
            Log a request, track its progress, and share the QR code with your rider.
          </p>
        </div>

        <button className="primary hero-action" onClick={() => setShowForm((open) => !open)}>
          {showForm ? "Close form" : "+ New delivery"}
        </button>
      </section>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <section className="card delivery-form-card">
          <div className="section-heading">
            <div>
              <p className="section-eyebrow">New request</p>
              <h2>Log a delivery</h2>
            </div>
          </div>

          <form className="user-form" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="customer-name">Customer name</label>
              <input
                id="customer-name"
                required
                value={form.customer_name}
                placeholder="e.g. Mary Wanjiku"
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="customer-phone">Customer phone</label>
              <input
                id="customer-phone"
                required
                value={form.customer_phone}
                placeholder="+254 7XX XXX XXX"
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="delivery-address">Delivery address</label>
              <input
                id="delivery-address"
                required
                value={form.address}
                placeholder="Estate, building, road, or landmark"
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="item-description">Item description</label>
              <input
                id="item-description"
                required
                value={form.item_description}
                placeholder="e.g. Samsung A15, black"
                onChange={(e) => setForm({ ...form, item_description: e.target.value })}
              />
            </div>

            <button className="primary user-submit" disabled={busy}>
              {busy ? "Saving request…" : "Log delivery request"}
            </button>
          </form>
        </section>
      )}

      <section className="retailer-summary">
        <div className="summary-card">
          <span className="summary-number">{activeDeliveries.length}</span>
          <span className="summary-label">Active deliveries</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">{deliveries.length}</span>
          <span className="summary-label">All delivery requests</span>
        </div>
      </section>

      <section className="card delivery-list-card">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Live tracking</p>
            <h2>Your deliveries</h2>
          </div>
          <span className="user-count">{deliveries.length} total</span>
        </div>

        {loading ? (
          <div className="empty-state">Loading deliveries…</div>
        ) : deliveries.length === 0 ? (
          <div className="empty-state">
            No deliveries logged yet. Create your first request to begin tracking it.
          </div>
        ) : (
          <div className="delivery-list">
            {deliveries.map((delivery) => (
              <article className="delivery-item" key={delivery.id}>
                <div className="delivery-item-head">
                  <div>
                    <p className="delivery-reference">Delivery #{delivery.id}</p>
                    <strong>{delivery.customer_name}</strong>
                    <div className="delivery-meta">
                      {delivery.address}
                      <br />
                      {delivery.item_description}
                    </div>
                  </div>
                  <StatusPill status={delivery.current_status} />
                </div>

                <div className="delivery-footer">
                  <span className="rider-name">
                    {delivery.assigned_rider_name
                      ? `Rider: ${delivery.assigned_rider_name}`
                      : "Waiting for rider assignment"}
                  </span>

                  {delivery.current_status !== "Delivered" && delivery.qr_token && (
                    <QrToggle token={delivery.qr_token} />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function QrToggle({ token }) {
  const [show, setShow] = useState(false);

  return (
    <div className="qr-toggle">
      <button className="link qr-button" onClick={() => setShow((current) => !current)}>
        {show ? "Hide QR code" : "Show rider QR"}
      </button>
      {show && (
        <div className="retailer-qr">
          <QRCodeSVG value={token} size={132} />
          <span>Let the rider scan this to confirm the next delivery step.</span>
        </div>
      )}
    </div>
  );
}