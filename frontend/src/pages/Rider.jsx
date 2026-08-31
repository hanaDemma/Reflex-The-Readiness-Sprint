import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { api } from "../api";
import { useReflexSocket } from "../ws";
import StatusPill from "../components/StatusPill";

const NEXT_STATUS = {
  Assigned: "Picked Up",
  "Picked Up": "Delivered",
};

export default function Rider() {
  const [deliveries, setDeliveries] = useState([]);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  async function refresh() {
    try {
      setLoading(true);
      setDeliveries(await api.assignedToMe());
    } catch (e) {
      setError(e.message || "Unable to load your deliveries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useReflexSocket((event) => {
    if (event.type === "new_assignment" || event.type === "status_changed") {
      refresh();
    }
  });

  async function advance(delivery, method = "manual") {
    const next = NEXT_STATUS[delivery.current_status];
    if (!next) return;

    setError("");
    setUpdatingId(delivery.id);

    try {
      await api.updateStatus(delivery.id, next, method);
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to update delivery status.");
    } finally {
      setUpdatingId(null);
    }
  }

  const handleScanResult = useCallback(
    async (token) => {
      setScanning(false);
      setError("");

      try {
        const delivery = await api.lookupByQr(token);
        const myDelivery = deliveries.find((item) => item.id === delivery.id);

        if (!myDelivery) {
          setError("This QR code belongs to a delivery that is not assigned to you.");
          return;
        }

        await advance(myDelivery, "qr_scan");
      } catch (e) {
        setError(e.message || "Unable to process QR code.");
      }
    },
    [deliveries]
  );

  const activeDeliveries = deliveries.filter(
    (delivery) => !["Delivered", "Failed"].includes(delivery.current_status)
  );

  return (
    <main className="role-page rider-page">
      <section className="role-hero rider-hero">
        <div>
          <p className="section-eyebrow">My route</p>
          <h1>Your assigned deliveries</h1>
          <p className="subtle">
            Complete each step to keep customers and dispatchers updated.
          </p>
        </div>

        <button className="secondary scanner-button" onClick={() => setScanning((open) => !open)}>
          {scanning ? "Close scanner" : "Scan delivery QR"}
        </button>
      </section>

      {error && <div className="error-banner">{error}</div>}

      {scanning && <QrScanner onResult={handleScanResult} />}

      <section className="rider-summary">
        <span>{activeDeliveries.length}</span>
        active {activeDeliveries.length === 1 ? "delivery" : "deliveries"}
      </section>

      {loading ? (
        <div className="card empty-state">Loading your deliveries…</div>
      ) : deliveries.length === 0 ? (
        <div className="card empty-state">
          No deliveries assigned right now. New assignments will appear here automatically.
        </div>
      ) : (
        <section className="rider-delivery-list">
          {deliveries.map((delivery, index) => {
            const nextStatus = NEXT_STATUS[delivery.current_status];
            const isUpdating = updatingId === delivery.id;

            return (
              <article
                className={`card rider-delivery-card ${index === 0 ? "next-delivery" : ""}`}
                key={delivery.id}
              >
                {index === 0 && <span className="next-stop-label">Next stop</span>}

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

                <div className="rider-contact">
                  <a href={`tel:${delivery.customer_phone}`}>Call customer</a>
                  <span>{delivery.customer_phone}</span>
                </div>

                {nextStatus && (
                  <button
                    className="primary rider-action"
                    disabled={isUpdating}
                    onClick={() => advance(delivery)}
                  >
                    {isUpdating ? "Updating…" : `Mark as ${nextStatus}`}
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function QrScanner({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    let stream;
    let frameId;
    let cancelled = false;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (cancelled) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanFrame();
      } catch {
        setScanError("Camera access was denied or is unavailable on this device.");
      }
    }

    function scanFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          onResult(code.data);
          return;
        }
      }

      frameId = requestAnimationFrame(scanFrame);
    }

    startCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  return (
    <section className="card scanner-card">
      {scanError && <div className="error-banner">{scanError}</div>}
      <p className="subtle">Point your camera at the retailer’s delivery QR code.</p>
      <video className="scanner-video" ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} hidden />
    </section>
  );
}