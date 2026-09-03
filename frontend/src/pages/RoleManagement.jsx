import { useEffect, useState } from "react";
import { api } from "../api";

const BASE_PERMISSIONS = ["admin", "retailer_staff", "dispatcher", "rider"];

const BASE_PERMISSION_LABELS = {
  admin: "Admin",
  retailer_staff: "Retailer staff",
  dispatcher: "Dispatcher",
  rider: "Rider",
};

const EMPTY_FORM = {
  name: "",
  label: "",
  base_permission: "retailer_staff",
};

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setLoading(true);
      const data = await api.listRoles();
      setRoles(data);
    } catch (e) {
      setError(e.message || "Unable to load roles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createRole(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      await api.createRole(form);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to create the role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="user-management">
      <section className="card user-form-card">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Administration</p>
            <h2>Add a role</h2>
          </div>
        </div>

        <p className="subtle">
          A new role inherits the permissions and page of whichever tier you map it
          to below — it doesn't create a new permission set of its own.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form className="user-form" onSubmit={createRole}>
          <div className="form-field">
            <label htmlFor="role-name">Role key</label>
            <input
              id="role-name"
              required
              value={form.name}
              placeholder="e.g. warehouse_manager"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="role-label">Display name</label>
            <input
              id="role-label"
              required
              value={form.label}
              placeholder="e.g. Warehouse Manager"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="role-base">Maps to</label>
            <select
              id="role-base"
              value={form.base_permission}
              onChange={(e) => setForm({ ...form, base_permission: e.target.value })}
            >
              {BASE_PERMISSIONS.map((perm) => (
                <option key={perm} value={perm}>
                  {BASE_PERMISSION_LABELS[perm]}
                </option>
              ))}
            </select>
          </div>

          <button className="primary user-submit" disabled={busy}>
            {busy ? "Creating role…" : "Create role"}
          </button>
        </form>
      </section>

      <section className="card users-list-card">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Catalog</p>
            <h2>All roles</h2>
          </div>
          <span className="user-count">{roles.length} roles</span>
        </div>

        <div className="table-wrap">
          <table className="user-table">
            <thead>
              <tr>
                <th>Display name</th>
                <th>Role key</th>
                <th>Maps to</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="table-message">
                    Loading roles…
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="table-message">
                    No roles yet.
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.name}>
                    <td className="user-name">{role.label}</td>
                    <td>{role.name}</td>
                    <td>{BASE_PERMISSION_LABELS[role.base_permission] || role.base_permission}</td>
                    <td>
                      <span className={role.is_builtin ? "pill-neutral" : "pill-active"}>
                        {role.is_builtin ? "Built in" : "Custom"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
