import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Save,
  X,
  CheckCircle2,
  Circle,
  Pencil,
  AlertCircle,
  ListChecks,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./checklists.css";

const DEPARTMENTS = [
  { value: "housekeeping", label: "Housekeeping" },
  { value: "maintenance", label: "Maintenance" },
  { value: "front_desk", label: "Front Desk" },
  { value: "kitchen", label: "Kitchen" },
  { value: "general", label: "General" },
];

const emptyForm = () => ({
  id: null,
  name: "",
  department: "housekeeping",
  description: "",
  is_active: true,
  // [{ text, required }]
  items: [{ text: "", required: true }],
});

export default function ChecklistsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchText, setSearchText] = useState("");

  // Only HODs or Administrators have permission to create, edit, activate/deactivate, or delete checklists
  const isHod =
    ["super-admin", "hotel-admin", "manager"].includes(String(user?.role || "")) ||
    String(user?.role_level || "").toLowerCase() === "department_head";

  const hotelId = user?.hotel_id || user?.hotelId || user?.hotel?.id || null;

  const getApiErrorMessage = (err, fallback) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg || "").join(", ");
    return err.message || fallback;
  };

  const fetchChecklists = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const params = hotelId ? { hotel_id: hotelId } : {};
      const res = await api.get("/checklists", { params });
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setChecklists(data);
    } catch (err) {
      console.error("Load checklists error:", err);
      setError(getApiErrorMessage(err, "Failed to load checklists."));
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const flash = (setter, text) => {
    setter(text);
    setTimeout(() => setter(""), 3500);
  };

  const openCreate = () => {
    if (!isHod) return;
    setForm(emptyForm());
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (row) => {
    if (!isHod) return;
    const items = (row.items || []).map((it) => ({
      text: typeof it === "string" ? it : it.text || "",
      required: typeof it === "string" ? true : it.required !== false,
    }));
    setForm({
      id: row.id,
      name: row.name || "",
      department: row.department || "housekeeping",
      description: row.description || "",
      is_active: row.is_active !== false,
      items: items.length ? items : [{ text: "", required: true }],
    });
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm());
    setError("");
  };

  const updateItem = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));
  };

  const addItemRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { text: "", required: true }] }));
  };

  const removeItemRow = (index) => {
    setForm((prev) => {
      const next = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: next.length ? next : [{ text: "", required: true }] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isHod) return;
    setError("");

    const name = form.name.trim();
    const items = form.items
      .map((it) => ({ text: String(it.text || "").trim(), required: !!it.required }))
      .filter((it) => it.text);

    if (!name) {
      setError("Please give the checklist a name.");
      return;
    }
    if (!items.length) {
      setError("Add at least one checklist point.");
      return;
    }

    const payload = {
      name,
      department: form.department,
      description: form.description.trim() || null,
      items,
      is_active: !!form.is_active,
      ...(form.id ? {} : { hotel_id: hotelId || undefined }),
    };

    try {
      setSaving(true);
      if (form.id) {
        await api.put(`/checklists/${form.id}`, payload);
        flash(setSuccess, "Checklist updated successfully.");
      } else {
        await api.post("/checklists", payload);
        flash(setSuccess, "Checklist created successfully.");
      }
      closeForm();
      await fetchChecklists(false);
    } catch (err) {
      console.error("Save checklist error:", err);
      setError(getApiErrorMessage(err, "Failed to save the checklist."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!isHod) return;
    try {
      setDeletingId(row.id);
      setError("");
      await api.delete(`/checklists/${row.id}`);
      flash(setSuccess, `Checklist "${row.name}" deleted.`);
      if (form.id === row.id) closeForm();
      await fetchChecklists(false);
    } catch (err) {
      console.error("Delete checklist error:", err);
      setError(getApiErrorMessage(err, "Failed to delete the checklist."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (row) => {
    if (!isHod) return;
    try {
      await api.put(`/checklists/${row.id}`, { is_active: !(row.is_active !== false) });
      await fetchChecklists(false);
    } catch (err) {
      console.error("Toggle checklist error:", err);
      setError(getApiErrorMessage(err, "Failed to update the checklist."));
    }
  };

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return checklists;
    return checklists.filter(
      (row) =>
        String(row.name || "").toLowerCase().includes(q) ||
        String(row.department || "").toLowerCase().includes(q) ||
        (row.items || []).some((it) =>
          String(typeof it === "string" ? it : it.text || "").toLowerCase().includes(q)
        )
    );
  }, [checklists, searchText]);

  const stats = useMemo(() => {
    const totalPoints = checklists.reduce((acc, row) => acc + (row.items?.length || 0), 0);
    return {
      total: checklists.length,
      active: checklists.filter((r) => r.is_active !== false).length,
      points: totalPoints,
    };
  }, [checklists]);

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    color: "#0f172a",
    background: "#ffffff",
  };

  return (
    <div className="directory-page checkout-cleaning-directory checklists-page">
      <PortalHeader
        title="Checklists"
        kicker="HOUSEKEEPING OPERATIONS"
        description="Standard operational checklists created and maintained by the Housekeeping HOD."
        icon={ClipboardCheck}
        showBack
        backPath="/dashboard"
        rightAction={
          isHod ? (
            <button
              type="button"
              className="portal-action-btn"
              style={{ background: "#166962", borderColor: "#166962" }}
              onClick={openCreate}
            >
              <Plus size={16} /> Add Checklist
            </button>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#475569",
                fontWeight: 600,
              }}
            >
              <ListChecks size={15} style={{ color: "#166962" }} /> Staff Reference View (HOD Managed)
            </div>
          )
        }
      />

      <div className="dir-stats-grid checklists-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatCard title="Checklists" value={stats.total} Icon={ListChecks} colorTheme="blue" />
        <StatCard title="Active Templates" value={stats.active} Icon={CheckCircle2} colorTheme="green" />
        <StatCard title="Total Points" value={stats.points} Icon={ClipboardCheck} colorTheme="purple" />
      </div>

      {showForm && (
        <section className="dir-modules-section">
          <ModuleWriternHeader
            title={form.id ? "Edit Checklist" : "Add Checklist"}
            description="Name the checklist and add the points someone must tick off. Points can be optional."
          />

          {error && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: "8px", margin: "0 0 14px",
                background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
                borderRadius: "8px", padding: "10px 14px", fontSize: "13px",
              }}
            >
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                  Checklist Name *
                </label>
                <input
                  type="text"
                  style={inputStyle}
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Deep Clean Verification"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                  Department
                </label>
                <select
                  style={inputStyle}
                  value={form.department}
                  onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                Description
              </label>
              <input
                type="text"
                style={inputStyle}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="When should this checklist be used?"
              />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                  Checklist Points *
                </label>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="btn-cancel"
                  style={{ gap: "5px", height: "32px" }}
                >
                  <Plus size={13} /> Add Point
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {form.items.map((item, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "22px", fontSize: "12px", fontWeight: 700, color: "#94a3b8", textAlign: "right" }}>
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      style={{ ...inputStyle, flex: 1 }}
                      value={item.text}
                      onChange={(e) => updateItem(index, { text: e.target.value })}
                      placeholder="e.g. Mattress vacuumed and rotated"
                    />
                    <button
                      type="button"
                      onClick={() => updateItem(index, { required: !item.required })}
                      title={item.required ? "Required" : "Optional"}
                      className="btn-cancel"
                      style={{
                        height: "36px", gap: "5px", minWidth: "104px", justifyContent: "center",
                        color: item.required ? "#059669" : "#64748b",
                        borderColor: item.required ? "#a7f3d0" : "#e2e8f0",
                        background: item.required ? "#ecfdf5" : "#f8fafc",
                      }}
                    >
                      {item.required ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                      {item.required ? "Required" : "Optional"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      title="Remove this point"
                      className="btn-cancel"
                      style={{ height: "36px", color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="checklistActive"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="checklistActive" style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", cursor: "pointer" }}>
                Active (available for use)
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
              <button type="submit" className="btn-submit" disabled={saving} style={{ gap: "6px" }}>
                <Save size={15} /> {saving ? "Saving..." : form.id ? "Update Checklist" : "Save Checklist"}
              </button>
              <button type="button" className="btn-cancel" onClick={closeForm} disabled={saving} style={{ gap: "6px" }}>
                <X size={15} /> Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Saved Checklists"
          description="Templates available to your housekeeping team."
          badgeCount={filtered.length}
          badgeLabel="checklists"
        />

        {success && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: "8px", margin: "0 0 14px",
              background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px",
            }}
          >
            <CheckCircle2 size={15} /> {success}
          </div>
        )}

        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1 }}>
            <ClipboardCheck size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search checklists by name, department or point..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="dir-table-container">
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              Loading checklists...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              {checklists.length === 0
                ? isHod
                  ? 'No checklists yet. Use "Add Checklist" to build the first one.'
                  : "No checklists have been published yet."
                : "No checklists match your search."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px", padding: "16px" }}>
              {filtered.map((row) => {
                const items = row.items || [];
                const isActive = row.is_active !== false;
                return (
                  <div
                    key={row.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      background: "#ffffff",
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "14px", color: "#0f172a" }}>{row.name}</strong>
                          <span
                            className={`mono-pill ${isActive ? "pill-normal" : "pill-warning"}`}
                            style={{ fontSize: "10px" }}
                          >
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                          <span className="mono-pill pill-warning" style={{ fontSize: "10px" }}>
                            {String(row.department || "general").replace(/_/g, " ").toUpperCase()}
                          </span>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {items.length} point{items.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {row.description && (
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>{row.description}</div>
                        )}
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>
                          Created by {row.created_by || "—"}
                        </div>
                      </div>

                      {isHod && (
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn-cancel"
                            style={{ gap: "5px", height: "32px" }}
                            onClick={() => handleToggleActive(row)}
                          >
                            {isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            className="btn-cancel"
                            style={{ gap: "5px", height: "32px", color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn-cancel"
                            style={{ gap: "5px", height: "32px", color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                            onClick={() => handleDelete(row)}
                            disabled={deletingId === row.id}
                          >
                            <Trash2 size={12} /> {deletingId === row.id ? "..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>

                    <ol style={{ margin: "10px 0 0", paddingLeft: "20px", display: "grid", gap: "4px" }}>
                      {items.map((it, i) => {
                        const text = typeof it === "string" ? it : it.text;
                        const required = typeof it === "string" ? true : it.required !== false;
                        return (
                          <li key={i} style={{ fontSize: "12.5px", color: "#334155" }}>
                            {text}
                            {!required && (
                              <span style={{ fontSize: "10.5px", color: "#94a3b8", marginLeft: "6px" }}>(optional)</span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
