import { useState } from "react";
import { getSession, clearSession } from "./api";
import Login from "./pages/Login";
import Retailer from "./pages/Retailer";
import Dispatcher from "./pages/Dispatcher";
import Rider from "./pages/Rider";
import Admin from "./pages/Admin";

const ROLE_LABEL = {
  admin: "Admin",
  retailer_staff: "Retailer staff",
  dispatcher: "Dispatcher",
  rider: "Rider",
};

const ROLE_VIEW = {
  admin: Admin,
  retailer_staff: Retailer,
  dispatcher: Dispatcher,
  rider: Rider,
};

export default function App() {
  const [session, setSession] = useState(getSession());

  function logout() {
    clearSession();
    setSession(null);
  }

  if (!session) {
    return <Login onLoggedIn={setSession} />;
  }

  const View = ROLE_VIEW[session.role];

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">Reflex<span>.</span></div>
        <div style={{ textAlign: "right" }}>
          <div>{session.name}</div>
          <div className="role-badge">{ROLE_LABEL[session.role]}</div>
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </div>
      <View />
    </div>
  );
}
