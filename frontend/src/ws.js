import { useEffect, useRef } from "react";
import { wsUrl } from "./api";

/**
 * Subscribes to the shared Reflex WebSocket and invokes onMessage for
 * every event pushed from the backend. The role-based filtering happens
 * server-side (see websocket_manager.py) — this hook just listens.
 */
export function useReflexSocket(onMessage) {
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  useEffect(() => {
    let socket;
    let closedByUs = false;

    function connect() {
      socket = new WebSocket(wsUrl());
      socket.onmessage = (event) => {
        try {
          cbRef.current(JSON.parse(event.data));
        } catch {}
      };
      socket.onclose = () => {
        // Known trade-off: no exponential backoff / catch-up fetch yet.
        // A dropped connection here means missed pushes until manual refresh.
        if (!closedByUs) {
          console.warn("Reflex socket closed — live updates paused until refresh.");
        }
      };
    }

    connect();
    return () => {
      closedByUs = true;
      socket && socket.close();
    };
  }, []);
}
