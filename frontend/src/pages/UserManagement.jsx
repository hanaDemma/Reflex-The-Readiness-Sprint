import { useEffect, useState } from "react";
import { api } from "../api";

const ROLES = ["admin", "retailer_staff", "dispatcher", "rider"];

const ROLE_LABELS = {
  admin: "Admin",
  retailer_staff: "Retailer staff",
  dispatcher: "Dispatcher",
  rider: "Rider",
};

const EMPTY_FORM = {
  name: "",
  phone: "",
  password: "",
  role: "retailer_staff",
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  async function refresh() {
    try {
      setLoading(true);
      const data = await api.listUsers();
      setUsers(data);
    } catch (e) {
      setError(e.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      await api.createUser(form);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to create the user.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user) {
    setError("");
    setUpdatingId(user.id);

    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to update user status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function changeRole(user, role) {
    setError("");
    setUpdatingId(user.id);

    try {
      await api.updateUser(user.id, { role });
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to update user role.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="user-management">
      <section className="card user-form-card">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Administration</p>
            <h2>Add a user</h2>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="user-form" onSubmit={createUser}>
          <div className="form-field">
            <label htmlFor="user-name">Name</label>
            <input
              id="user-name"
              required
              value={form.name}
              placeholder="Full name"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="user-phone">Phone</label>
            <input
              id="user-phone"
              required
              value={form.phone}
              placeholder="+254 700 000 000"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="user-password">Temporary password</label>
            <input
              id="user-password"
              required
              type="password"
              value={form.password}
              placeholder="Create a secure password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="user-role">Role</label>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <button className="primary user-submit" disabled={busy}>
            {busy ? "Creating user…" : "Create user"}
          </button>
        </form>
      </section>

      <section className="card users-list-card">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Directory</p>
            <h2>All users</h2>
          </div>
          <span className="user-count">{users.length} users</span>
        </div>

        <div className="table-wrap">
          <table className="user-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-message">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-message">
                    No users have been added yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isUpdating = updatingId === user.id;

                  return (
                    <tr key={user.id}>
                      <td className="user-name">{user.name}</td>
                      <td>{user.phone}</td>
                      <td>
                        <select
                          className="role-select"
                          value={user.role}
                          disabled={isUpdating}
                          onChange={(e) => changeRole(user, e.target.value)}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={user.is_active ? "pill-active" : "pill-inactive"}>
                          {user.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="tiny"
                          disabled={isUpdating}
                          onClick={() => toggleActive(user)}
                        >
                          {isUpdating
                            ? "Saving…"
                            : user.is_active
                              ? "Deactivate"
                              : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}