import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Armchair,
  CheckCircle,
  ClipboardList,
  Edit,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  ReceiptText,
  Utensils,
  Download,
  Check,
  Sparkles,
  AlertCircle,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import {
  PortalHeader,
  StatCard,
  ModuleWriternHeader,
} from "@components";
import "./restaurantTableManagement.css";

const initialForm = {
  table_number: "",
  section: "Main Hall",
  capacity: 4,
  status: "available",
  notes: "",
};

const tableStatuses = [
  "available",
  "occupied",
  "reserved",
  "cleaning",
  "out-of-service",
];

const defaultSections = [
  "Main Dining Hall",
  "Outdoor Terrace",
  "Rooftop Lounge",
  "Bar & Counter",
  "VIP / Private Dining",
];

function normalizeList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.[key])) return data.data[key];
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getApiErrorMessage(err, fallbackMessage) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
        return `${field}: ${item.msg}`;
      })
      .join(" | ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  if (err.message) return err.message;
  return fallbackMessage;
}

function getStatusLabel(status) {
  if (!status) return "-";
  if (status === "out-of-service") return "Out of Service";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function RestaurantTableManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [editingTable, setEditingTable] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function getLoggedInHotelId() {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id || 1;
  }

  function filterByHotel(list) {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;
    const filteredList = list.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId));
    if (filteredList.length === 0 && list.length > 0) return list;
    return filteredList;
  }

  function getOrderStatus(order) {
    return String(order.order_status || order.status || "pending").toLowerCase();
  }

  function getOrderType(order) {
    return order.order_type || order.type || "dine-in";
  }

  function getOrderAmount(order) {
    return Number(order.total_amount || order.order_total || order.amount || 0);
  }

  function isActiveOrder(order) {
    const status = getOrderStatus(order);
    return getOrderType(order) === "dine-in" && !["completed", "cancelled"].includes(status);
  }

  function getTableActiveOrders(tableNumber) {
    return orders.filter(
      (order) =>
        isActiveOrder(order) &&
        String(order.table_number || "").toLowerCase() === String(tableNumber || "").toLowerCase()
    );
  }

  function getDisplayStatus(table) {
    const activeOrders = getTableActiveOrders(table.table_number);
    if (activeOrders.length > 0) return "occupied";
    return table.status || "available";
  }

  async function fetchData(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      setError("");

      const [tablesResponse, ordersResponse] = await Promise.all([
        api.get("/restaurant/tables").catch(() => ({ data: [] })),
        api.get("/restaurant/orders?order_type=dine-in").catch(() => ({ data: [] })),
      ]);

      setTables(filterByHotel(normalizeList(tablesResponse.data, "tables")));
      setOrders(filterByHotel(normalizeList(ordersResponse.data, "orders")));
    } catch (err) {
      console.error("Fetch table management error:", err);
      if (!isSilent) setError(getApiErrorMessage(err, "Failed to load table management."));
    } finally {
      if (!isSilent) setLoading(false);
    }
  }

  // Initial load and 30-second background polling
  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const sections = useMemo(() => {
    const set = new Set();
    tables.forEach((t) => {
      if (t.section) set.add(t.section);
    });
    return Array.from(set);
  }, [tables]);

  const stats = useMemo(() => {
    const available = tables.filter((table) => getDisplayStatus(table) === "available").length;
    const occupied = tables.filter((table) => getDisplayStatus(table) === "occupied").length;
    const reserved = tables.filter((table) => getDisplayStatus(table) === "reserved").length;
    const totalCapacity = tables.reduce((sum, table) => sum + Number(table.capacity || 0), 0);

    return { total: tables.length, available, occupied, reserved, totalCapacity };
  }, [tables, orders]);

  const filteredTables = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return tables.filter((table) => {
      const displayStatus = getDisplayStatus(table);
      const activeOrders = getTableActiveOrders(table.table_number);
      const latestOrder = activeOrders[0];
      const guestName = latestOrder?.guest_name || "";

      const rowText = [table.table_number, table.section, table.capacity, displayStatus, table.notes, guestName]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || rowText.includes(search);
      const matchesStatus = statusFilter === "all" || displayStatus === statusFilter;
      const matchesSection = sectionFilter === "all" || (table.section || "Main Hall") === sectionFilter;

      return matchesSearch && matchesStatus && matchesSection;
    });
  }, [tables, orders, searchText, statusFilter, sectionFilter]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function openAddModal() {
    setFormData(initialForm);
    setEditingTable(null);
    setError("");
    setIsModalOpen(true);
  }

  function handleEdit(table) {
    setEditingTable(table);
    setError("");
    setSuccess("");
    setFormData({
      table_number: table.table_number || "",
      section: table.section || "Main Hall",
      capacity: table.capacity || 4,
      status: table.status || "available",
      notes: table.notes || "",
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const tableNumber = formData.table_number.trim();

    if (!tableNumber) {
      setError("Table number is required.");
      return;
    }
    if (Number(formData.capacity) <= 0) {
      setError("Table capacity must be greater than 0.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        hotel_id: Number(getLoggedInHotelId()),
        table_number: tableNumber,
        section: formData.section.trim() || "Main Hall",
        capacity: Number(formData.capacity),
        status: formData.status,
        notes: formData.notes.trim() || null,
      };

      if (editingTable) {
        await api.put(`/restaurant/tables/${editingTable.id}`, payload);
        setSuccess(`Table ${tableNumber} updated successfully.`);
      } else {
        await api.post("/restaurant/tables", payload);
        setSuccess(`Table ${tableNumber} created successfully.`);
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccess(""), 3500);
      await fetchData(true);
    } catch (err) {
      console.error("Save table error:", err);
      setError(getApiErrorMessage(err, "Failed to save table."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(table) {
    const activeOrders = getTableActiveOrders(table.table_number);
    if (activeOrders.length > 0) {
      setError(`Cannot delete table ${table.table_number} because an active order (#${activeOrders[0].id}) is currently seated.`);
      setTimeout(() => setError(""), 4000);
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete table ${table.table_number}?`);
    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete(`/restaurant/tables/${table.id}`);
      setSuccess(`Table ${table.table_number} deleted successfully.`);
      setTimeout(() => setSuccess(""), 3500);
      await fetchData(true);
    } catch (err) {
      console.error("Delete table error:", err);
      setError(getApiErrorMessage(err, "Failed to delete table."));
      setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  }

  async function updateTableStatus(table, status) {
    const activeOrders = getTableActiveOrders(table.table_number);
    if (activeOrders.length > 0 && status !== "occupied") {
      setError(`Table ${table.table_number} has an active order. Please settle or complete the order first.`);
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      await api.put(`/restaurant/tables/${table.id}`, { status });
      setSuccess(`Table ${table.table_number} marked as ${getStatusLabel(status)}.`);
      setTimeout(() => setSuccess(""), 3000);
      setTables((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, status } : t))
      );
    } catch (err) {
      console.error("Update table status error:", err);
      setError(getApiErrorMessage(err, "Failed to update table status."));
      setTimeout(() => setError(""), 3500);
    }
  }

  function downloadCSV() {
    if (tables.length === 0) {
      setError("No tables to export.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const headers = ["Table Number", "Section", "Capacity", "Current Status", "Active Orders", "Active Bill (INR)", "Notes"];
    const rows = tables.map((t) => {
      const displayStatus = getDisplayStatus(t);
      const activeOrders = getTableActiveOrders(t.table_number);
      const activeAmount = activeOrders.reduce((sum, o) => sum + getOrderAmount(o), 0);

      return [
        `"${t.table_number}"`,
        `"${t.section || "Main Hall"}"`,
        t.capacity,
        displayStatus,
        activeOrders.length,
        activeAmount.toFixed(2),
        `"${(t.notes || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `restaurant_tables_layout_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="table-page">
      {/* NOTIFICATION TOASTS */}
      {(error || success) && (
        <div className="table-toast-container">
          {error && <div className="table-toast error-toast">{error}</div>}
          {success && <div className="table-toast success-toast">{success}</div>}
        </div>
      )}

      {/* PORTAL HEADER - NO REFRESH BUTTON */}
      <PortalHeader
        title="Table Management"
        kicker="RESTAURANT & FLOOR OPERATIONS"
        description="Live floor plan, seating layouts, real-time occupancy tracking, and table order settlements."
        icon={Armchair}
        backPath="/restaurant"
        rightAction={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="table-live-badge">
              <span className="table-live-dot" />
              <span>Live Floor Plan</span>
            </div>

            <button type="button" className="table-export-btn" onClick={downloadCSV}>
              <Download size={15} /> Export Layout
            </button>

            <button type="button" className="table-primary-btn" onClick={openAddModal}>
              <Plus size={16} /> Create Table
            </button>
          </div>
        }
      />

      {/* STATS GRID */}
      <section className="table-stats-grid">
        <StatCard
          title="Total Tables"
          value={stats.total}
          Icon={Armchair}
          colorTheme="blue"
        />
        <StatCard
          title="Available to Seat"
          value={stats.available}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Occupied (Dining)"
          value={stats.occupied}
          Icon={ClipboardList}
          colorTheme="orange"
        />
        <StatCard
          title="Total Seating Capacity"
          value={`${stats.totalCapacity} Guests`}
          Icon={Users}
          colorTheme="purple"
        />
      </section>

      {/* MODULE SECTION */}
      <section className="table-modules-section">
        <ModuleWriternHeader
          title="Restaurant Floor Plan"
          description="View table occupancy, take dine-in orders, and settle dining bills."
          badgeCount={filteredTables.length}
          badgeLabel="tables shown"
        />

        {/* TOOLBAR */}
        <div className="table-toolbar-card">
          <div className="table-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search table #, section, guest name, or notes..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="table-filter-groups">
            {/* Section tabs */}
            <div className="table-section-tabs">
              <button
                type="button"
                className={`table-section-tab ${sectionFilter === "all" ? "active" : ""}`}
                onClick={() => setSectionFilter("all")}
              >
                All Sections
              </button>
              {sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`table-section-tab ${sectionFilter === sec ? "active" : ""}`}
                  onClick={() => setSectionFilter(sec)}
                >
                  {sec}
                </button>
              ))}
            </div>

            {/* Status Dropdown */}
            <select
              className="table-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter by Table Status"
            >
              <option value="all">All Statuses ({tables.length})</option>
              {tableStatuses.map((st) => (
                <option key={st} value={st}>
                  {getStatusLabel(st)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CARDS GRID */}
        {loading && tables.length === 0 ? (
          <div className="table-empty-state">
            <h4>Loading restaurant floor plan...</h4>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="table-empty-state">
            <h4>No tables match your search or filter</h4>
            <p>Try clearing your search or add a new table using the "Create Table" button above.</p>
          </div>
        ) : (
          <div className="table-cards-grid">
            {filteredTables.map((table) => {
              const displayStatus = getDisplayStatus(table);
              const activeOrders = getTableActiveOrders(table.table_number);
              const activeAmount = activeOrders.reduce(
                (sum, order) => sum + getOrderAmount(order),
                0
              );
              const latestOrder = activeOrders[0];
              const isOccupied = activeOrders.length > 0;

              return (
                <div
                  className={`table-card status-${displayStatus}`}
                  key={table.id}
                >
                  {/* CARD HEADER */}
                  <div className="table-card-top">
                    <div className="table-num-wrap">
                      <span className="table-section-label">{table.section || "Main Dining Hall"}</span>
                      <h3 className="table-num">{table.table_number}</h3>
                    </div>
                    <span className={`table-status-badge ${displayStatus}`}>
                      {getStatusLabel(displayStatus)}
                    </span>
                  </div>

                  {/* DETAILS INFO */}
                  <div className="table-card-details">
                    <div className="table-detail-item">
                      <span>Capacity</span>
                      <strong>
                        <Users size={12} style={{ display: "inline", marginRight: "3px" }} />
                        {table.capacity} Seats
                      </strong>
                    </div>
                    <div className="table-detail-item" style={{ textAlign: "right" }}>
                      <span>Active Orders</span>
                      <strong>{activeOrders.length} ticket(s)</strong>
                    </div>
                  </div>

                  {/* ACTIVE OCCUPANCY WIDGET */}
                  {isOccupied && (
                    <div className="table-active-order-box">
                      <div className="table-order-header">
                        <span>Active Dining Order #{latestOrder?.id}</span>
                        <span style={{ fontSize: "10.5px", background: "#fed7aa", padding: "1px 5px", borderRadius: "4px" }}>
                          {getOrderStatus(latestOrder).toUpperCase()}
                        </span>
                      </div>
                      <div className="table-order-guest">
                        Guest: {latestOrder?.guest_name || "Dine-In Customer"}
                      </div>
                      <div className="table-order-amount">
                        Bill: ₹{activeAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="table-order-actions">
                        <button
                          type="button"
                          className="table-view-order-btn"
                          onClick={() => navigate(`/restaurant/orders?search=${encodeURIComponent(table.table_number)}`)}
                          title="View order in Live Orders queue"
                        >
                          <ReceiptText size={12} /> View
                        </button>
                        <button
                          type="button"
                          className="table-settle-btn"
                          onClick={() => navigate(`/restaurant/billing?orderId=${latestOrder.id}`)}
                          title="Settle bill at Counter POS"
                        >
                          <Utensils size={12} /> Settle Bill
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TABLE NOTES */}
                  {table.notes && (
                    <div className="table-notes-text">
                      "{table.notes}"
                    </div>
                  )}

                  {/* CONTEXTUAL CARD ACTIONS */}
                  <div className="table-card-footer">
                    <div className="table-action-row">
                      {displayStatus === "available" && (
                        <>
                          <button
                            type="button"
                            className="table-seat-btn"
                            onClick={() =>
                              navigate(
                                `/restaurant/orders?newOrder=true&table=${encodeURIComponent(
                                  table.table_number
                                )}`
                              )
                            }
                            title="Seat guests and place dining order"
                          >
                            <Plus size={13} /> Seat & Order
                          </button>
                          <button
                            type="button"
                            className="table-quick-btn"
                            onClick={() => updateTableStatus(table, "reserved")}
                            title="Quick reserve table"
                          >
                            Reserve
                          </button>
                        </>
                      )}

                      {displayStatus === "reserved" && (
                        <>
                          <button
                            type="button"
                            className="table-seat-btn"
                            onClick={() =>
                              navigate(
                                `/restaurant/orders?newOrder=true&table=${encodeURIComponent(
                                  table.table_number
                                )}`
                              )
                            }
                            title="Seat reserved guests"
                          >
                            <Plus size={13} /> Seat Guest
                          </button>
                          <button
                            type="button"
                            className="table-quick-btn"
                            onClick={() => updateTableStatus(table, "available")}
                            title="Cancel reservation and free up table"
                          >
                            Free Up
                          </button>
                        </>
                      )}

                      {displayStatus === "cleaning" && (
                        <button
                          type="button"
                          className="table-clean-btn"
                          onClick={() => updateTableStatus(table, "available")}
                          title="Mark table clean and ready for seating"
                        >
                          <Check size={14} /> Mark Clean & Ready
                        </button>
                      )}

                      {displayStatus === "out-of-service" && (
                        <button
                          type="button"
                          className="table-quick-btn"
                          onClick={() => updateTableStatus(table, "available")}
                          title="Restore table to service"
                        >
                          Restore to Service
                        </button>
                      )}

                      {displayStatus === "occupied" && (
                        <button
                          type="button"
                          className="table-quick-btn"
                          onClick={() =>
                            navigate(
                              `/restaurant/orders?search=${encodeURIComponent(
                                table.table_number
                              )}`
                            )
                          }
                        >
                          Manage Order #{latestOrder?.id}
                        </button>
                      )}
                    </div>

                    {/* STATUS OVERRIDE & EDIT/DELETE BUTTONS */}
                    <div className="table-action-row">
                      <select
                        className="table-status-select-inline"
                        value={displayStatus}
                        disabled={isOccupied}
                        onChange={(e) => updateTableStatus(table, e.target.value)}
                        title={isOccupied ? "Table status is locked while orders are active" : "Change table status"}
                      >
                        {tableStatuses.map((st) => (
                          <option key={st} value={st}>
                            Status: {getStatusLabel(st)}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="table-icon-btn"
                        onClick={() => handleEdit(table)}
                        title="Edit Table Layout"
                      >
                        <Edit size={14} />
                      </button>

                      <button
                        type="button"
                        className="table-icon-btn table-del-btn"
                        onClick={() => handleDelete(table)}
                        title="Delete Table"
                        disabled={isOccupied}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="table-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="table-modal" onClick={(e) => e.stopPropagation()}>
            <div className="table-modal-header">
              <h3>{editingTable ? `Edit Table ${editingTable.table_number}` : "Create New Restaurant Table"}</h3>
              <button
                type="button"
                className="table-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="table-modal-body">
              <div className="table-form-row">
                <div className="table-form-group">
                  <label>Table Number / Code *</label>
                  <input
                    type="text"
                    name="table_number"
                    placeholder="E.g. T-01, Rooftop-4, Booth-2"
                    value={formData.table_number}
                    onChange={handleChange}
                    className="table-input"
                    required
                  />
                </div>

                <div className="table-form-group">
                  <label>Floor Section / Area</label>
                  <input
                    type="text"
                    name="section"
                    placeholder="E.g. Main Hall, Terrace, Rooftop"
                    list="section-suggestions"
                    value={formData.section}
                    onChange={handleChange}
                    className="table-input"
                  />
                  <datalist id="section-suggestions">
                    {defaultSections.map((sec) => (
                      <option key={sec} value={sec} />
                    ))}
                    {sections.map((sec) => (
                      <option key={sec} value={sec} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="table-form-row">
                <div className="table-form-group">
                  <label>Seating Capacity (Seats) *</label>
                  <input
                    type="number"
                    name="capacity"
                    min="1"
                    max="50"
                    value={formData.capacity}
                    onChange={handleChange}
                    className="table-input"
                    required
                  />
                </div>

                <div className="table-form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="table-input"
                  >
                    {tableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-form-group">
                <label>Notes & Location Specifics</label>
                <textarea
                  name="notes"
                  rows="2"
                  placeholder="E.g. Near corner window, booth seating, power outlet accessible"
                  value={formData.notes}
                  onChange={handleChange}
                  className="table-input"
                />
              </div>

              <div className="table-modal-actions">
                <button
                  type="button"
                  className="table-export-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="table-primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingTable ? "Update Table" : "Create Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}