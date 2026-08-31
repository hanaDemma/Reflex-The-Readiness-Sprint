import { useEffect, useState } from "react";
import { api } from "../api";
import { useReflexSocket } from "../ws";
import StatusPill from "../components/StatusPill";
import Dashboard from "./Dashboard";

export default function Dispatcher() {
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedRider, setSelectedRider] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);

  async function refresh() {
    try {
      setLoading(true);
      const [openRequests, riderList] = await Promise.all([
        api.openQueue(),
        api.listRiders(),
      ]);
      setQueue(openRequests);
      setRiders(riderList);
    } catch (e) {
      setError(e.message || "Unable to load the dispatch queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useReflexSocket((event) => {
    if (event.type === "new_request" || event.type === "status_changed") {
      refresh();
    }
  });

  async function assign(deliveryId) {
    const riderId = selectedRider[deliveryId];
    if (!riderId) return;

    setError("");
    setAssigningId(deliveryId);

    try {
      await api.assign(deliveryId, riderId);
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to assign rider.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <main className="role-page dispatcher-page">
      <div className="tabs">
        <button
          className={`tab-button ${tab === "queue" ? "active" : ""}`}
          onClick={() => setTab("queue")}
        >
          Dispatch queue
        </button>
        <button
          className={`tab-button ${tab === "dashboard" ? "active" : ""}`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
      </div>

      {tab === "dashboard" ? (
        <Dashboard />
      ) : (
        <>
          <section className="role-hero">
            <div>
              <p className="section-eyebrow">Live dispatch</p>
              <h1>Open delivery requests</h1>
              <p className="subtle">
                Assign a rider to each request so deliveries can start moving.
              </p>
            </div>
            <span className="queue-count">{queue.length} waiting</span>
          </section>

          {error && <div className="error-banner">{error}</div>}

          <section className="dispatch-layout">
            <div className="card dispatch-queue-card">
              <div className="section-heading">
                <div>
                  <p className="section-eyebrow">Needs attention</p>
                  <h2>Unassigned requests</h2>
                </div>
              </div>

              {loading ? (
                <div className="empty-state">Loading dispatch queue…</div>
              ) : queue.length === 0 ? (
                <div className="empty-state">
                  All clear. There are no open delivery requests right now.
                </div>
              ) : (
                <div className="delivery-list">
                  {queue.map((delivery) => {
                    const isAssigning = assigningId === delivery.id;

                    return (
                      <article className="delivery-item dispatch-item" key={delivery.id}>
                        <div className="delivery-item-head">
                          <div>
                            <p className="delivery-reference">Request #{delivery.id}</p>
                            <strong>{delivery.customer_name}</strong>
                            <div className="delivery-meta">
                              {delivery.customer_phone}
                              <br />
                              {delivery.address}
                              <br />
                              {delivery.item_description}
                            </div>
                          </div>
                          <StatusPill status={delivery.current_status} />
                        </div>

                        <div className="assign-row">
                          <select
                            className="rider-select"
                            value={selectedRider[delivery.id] || ""}
                            disabled={isAssigning}
                            onChange={(e) =>
                              setSelectedRider({
                                ...selectedRider,
                                [delivery.id]: e.target.value,
                              })
                            }
                          >
                            <option value="">Choose a rider…</option>
                            {riders.map((rider) => (
                              <option key={rider.id} value={rider.id}>
                                {rider.name}
                              </option>
                            ))}
                          </select>

                          <button
                            className="secondary assign-button"
                            disabled={!selectedRider[delivery.id] || isAssigning}
                            onClick={() => assign(delivery.id)}
                          >
                            {isAssigning ? "Assigning…" : "Assign rider"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="card riders-card">
              <p className="section-eyebrow">Team</p>
              <h2>Available riders</h2>
              {riders.length === 0 ? (
                <div className="empty-state">No riders are available.</div>
              ) : (
                <div className="rider-list">
                  {riders.map((rider) => (
                    <div className="rider-list-item" key={rider.id}>
                      <span className="availability-dot" />
                      <span>{rider.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </section>
        </>
      )}
    </main>
  );
}