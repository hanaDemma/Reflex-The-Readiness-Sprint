const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("reflex_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("reflex_token", token);
  else localStorage.removeItem("reflex_token");
}

export function getSession() {
  const token = getToken();
  const role = localStorage.getItem("reflex_role");
  const name = localStorage.getItem("reflex_name");
  if (!token) return null;
  return { token, role, name };
}

export function setSession({ access_token, role, name }) {
  setToken(access_token);
  localStorage.setItem("reflex_role", role);
  localStorage.setItem("reflex_name", name);
}

export function clearSession() {
  setToken(null);
  localStorage.removeItem("reflex_role");
  localStorage.removeItem("reflex_name");
}

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (phone, password) => request("/auth/login", { method: "POST", body: { phone, password } }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),

  createDelivery: (payload) => request("/deliveries", { method: "POST", body: payload }),
  myDeliveries: () => request("/deliveries/mine"),

  openQueue: () => request("/deliveries/open"),
  listRiders: () => request("/deliveries/riders"),
  assign: (id, riderId) => request(`/deliveries/${id}/assign`, { method: "POST", body: { rider_id: riderId } }),

  assignedToMe: () => request("/deliveries/assigned"),
  updateStatus: (id, status, method_ = "manual") =>
    request(`/deliveries/${id}/status`, { method: "POST", body: { status, method: method_ } }),
  lookupByQr: (token) => request(`/deliveries/by-qr/${token}`),

  dashboard: () => request("/deliveries/dashboard"),
  listUsers: () => request("/users"),
  createUser: (payload) => request("/users", { method: "POST", body: payload }),
  updateUser: (id, payload) => request(`/users/${id}`, { method: "PATCH", body: payload }),
};

export function wsUrl() {
  const token = getToken();
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}
