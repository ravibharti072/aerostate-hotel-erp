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
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; 
import ModuleWriternHeader from "../../../../components/ModuleWriternHeader";
import "./restaurantTableManagement.css";

const initialForm = {
  table_number: "",
  section: "",
  capacity: 2,
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function getLoggedInHotelId() {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id || 1;
  }

  function getStorageKey() {
    return `hotel_erp_restaurant_tables_${getLoggedInHotelId()}`;
  }

  function loadTablesFromStorage() {
    try {
      const savedTables = localStorage.getItem(getStorageKey());

      if (!savedTables) {
        const defaultTables = [
          {
            id: Date.now() + 1,
            hotel_id: getLoggedInHotelId(),
            table_number: "T1",
            section: "Main Hall",
            capacity: 2,
            status: "available",
            notes: "Example: Near window",
            created_at: new Date().toISOString(),
          },
        ];
        localStorage.setItem(getStorageKey(), JSON.stringify(defaultTables));
        setTables(defaultTables);
        return;
      }
      setTables(JSON.parse(savedTables));
    } catch (err) {
      console.error("Load tables error:", err);
      setTables([]);
    }
  }

  function saveTablesToStorage(nextTables) {
    localStorage.setItem(getStorageKey(), JSON.stringify(nextTables));
    setTables(nextTables);
  }

  function getOrderStatus(order) {
    return order.order_status || order.status || "pending";
  }

  function getOrderType(order) {
    return order.order_type || order.type || "dine-in";
  }

  function getOrderAmount(order) {
    return Number(order.total_amount || order.order_total || order.amount || 0);
  }

  function isActiveOrder(order) {
    const status = String(getOrderStatus(order)).toLowerCase();
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
    return table.status;
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      loadTablesFromStorage();

      const ordersResponse = await api.get("/restaurant/orders").catch(() => ({ data: [] }));
      setOrders(normalizeList(ordersResponse.data, "orders"));
    } catch (err) {
      console.error("Fetch table management error:", err);
      setError(getApiErrorMessage(err, "Failed to load table management."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const available = tables.filter((table) => getDisplayStatus(table) === "available").length;
    const occupied = tables.filter((table) => getDisplayStatus(table) === "occupied").length;
    const reserved = tables.filter((table) => getDisplayStatus(table) === "reserved").length;
    const totalCapacity = tables.reduce((sum, table) => sum + Number(table.capacity || 0), 0);

    return { total: tables.length, available, occupied, reserved, totalCapacity };
  }, [tables, orders]);

  const filteredTables = useMemo(() => {
    const search = searchText.toLowerCase();

    return tables.filter((table) => {
      const displayStatus = getDisplayStatus(table);
      const rowText = [table.table_number, table.section, table.capacity, displayStatus, table.notes].join(" ").toLowerCase();

      const matchesSearch = !search || rowText.includes(search);
      const matchesStatus = statusFilter === "all" || displayStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tables, orders, searchText, statusFilter]);

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
      section: table.section || "",
      capacity: table.capacity || 2,
      status: table.status || "available",
      notes: table.notes || "",
    });
    setIsModalOpen(true);
  }

  function resetForm() {
    setFormData(initialForm);
    setEditingTable(null);
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    const tableNumber = formData.table_number.trim();

    if (!tableNumber) return setError("Table number is required.");
    if (Number(formData.capacity) <= 0) return setError("Table capacity must be greater than 0.");

    const duplicateTable = tables.find(
      (table) => String(table.table_number).toLowerCase() === String(tableNumber).toLowerCase() && Number(table.id) !== Number(editingTable?.id)
    );

    if (duplicateTable) {
      setError("This table number already exists.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (editingTable) {
      const updatedTables = tables.map((table) =>
        Number(table.id) === Number(editingTable.id)
          ? {
              ...table,
              table_number: tableNumber,
              section: formData.section.trim(),
              capacity: Number(formData.capacity),
              status: formData.status,
              notes: formData.notes.trim(),
            }
          : table
      );
      saveTablesToStorage(updatedTables);
      setSuccess("Table updated successfully.");
    } else {
      const newTable = {
        id: Date.now(),
        hotel_id: getLoggedInHotelId(),
        table_number: tableNumber,
        section: formData.section.trim(),
        capacity: Number(formData.capacity),
        status: formData.status,
        notes: formData.notes.trim(),
        created_at: new Date().toISOString(),
      };
      saveTablesToStorage([newTable, ...tables]);
      setSuccess("Table created successfully.");
    }

    setTimeout(() => setSuccess(""), 3000);
    setIsModalOpen(false);
  }

  function handleDelete(table) {
    const activeOrders = getTableActiveOrders(table.table_number);
    if (activeOrders.length > 0) {
      setError("Cannot delete table because an active order exists on this table.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete table ${table.table_number}?`);
    if (!confirmed) return;

    const updatedTables = tables.filter((item) => Number(item.id) !== Number(table.id));
    saveTablesToStorage(updatedTables);
    setSuccess("Table deleted successfully.");
    setTimeout(() => setSuccess(""), 3000);
  }

  function updateTableStatus(table, status) {
    const activeOrders = getTableActiveOrders(table.table_number);
    if (activeOrders.length > 0 && status !== "occupied") {
      setError("This table has an active order. Complete the order first.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const updatedTables = tables.map((item) =>
      Number(item.id) === Number(table.id) ? { ...item, status } : item
    );
    saveTablesToStorage(updatedTables);
    setSuccess(`Table ${table.table_number} marked as ${getStatusLabel(status)}.`);
    setTimeout(() => setSuccess(""), 3000);
  }

  return (
    <div className="table-management-page">
      
      {/* --- TOP CENTER NOTIFICATION TOASTS --- */}
      {(error || success) && (
        <div className="table-toast-container">
          {error && <div className="table-toast error-toast">{error}</div>}
          {success && <div className="table-toast success-toast">{success}</div>}
        </div>
      )}

      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Table Management"
        kicker="RESTAURANT MANAGEMENT"
        description="Manage restaurant tables, seating capacity, table status, and active dine-in orders."
        icon={Armchair}
        backPath="/restaurant"
        rightAction={
          <button className="table-add-btn" onClick={openAddModal}>
            <Plus size={16} /> Create Table
          </button>
        }
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="table-stats-grid">
        <StatCard
          title="Total Tables"
          value={stats.total}
          Icon={Armchair}
          colorTheme="blue"
        />
        <StatCard
          title="Available"
          value={stats.available}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Occupied"
          value={stats.occupied}
          Icon={ClipboardList}
          colorTheme="orange"
        />
        <StatCard
          title="Total Capacity"
          value={stats.totalCapacity}
          Icon={Users}
          colorTheme="purple"
        />
      </section>

      {/* --- MODULE SECTION --- */}
      <section className="table-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Tables Directory"
          description="Manage, sort, and update restaurant seating layouts."
          badgeCount={filteredTables.length}
          badgeLabel="tables"
        />

        {/* TOOLBAR */}
        <div className="table-toolbar-card">
          <div className="table-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search table, section, status..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="table-filters-right-group">
            <select className="table-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Tables</option>
              {tableStatuses.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CARDS GRID */}
        {loading ? (
          <div className="table-empty-state"><h4>Loading tables...</h4></div>
        ) : filteredTables.length === 0 ? (
          <div className="table-empty-state">
            <h4>No tables found</h4>
            <p>Create your first restaurant table using the "Create Table" button.</p>
          </div>
        ) : (
          <div className="table-cards-grid">
            {filteredTables.map((table) => {
              const displayStatus = getDisplayStatus(table);
              const activeOrders = getTableActiveOrders(table.table_number);
              const activeAmount = activeOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);

              return (
                <div className="table-card" key={table.id}>
                  <div className="table-card-top">
                    <div>
                      <p>Table</p>
                      <h3>{table.table_number}</h3>
                    </div>
                    <span className={`table-status ${displayStatus}`}>
                      {getStatusLabel(displayStatus)}
                    </span>
                  </div>

                  <div className="table-card-info">
                    <div>
                      <span>Section</span>
                      <strong>{table.section || "Default"}</strong>
                    </div>
                    <div>
                      <span>Capacity</span>
                      <strong>{table.capacity} Guests</strong>
                    </div>
                  </div>

                  {activeOrders.length > 0 && (
                    <div className="table-active-order">
                      <p>Active Order</p>
                      <strong>{activeOrders.length} order(s)</strong>
                      <span>₹{activeAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {table.notes && (
                    <div className="table-notes">
                      <strong>Notes:</strong> {table.notes}
                    </div>
                  )}

                  <div className="table-status-actions">
                    {tableStatuses.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={displayStatus === status ? "active" : ""}
                        onClick={() => updateTableStatus(table, status)}
                      >
                        {getStatusLabel(status)}
                      </button>
                    ))}
                  </div>

                  <div className="table-card-actions">
                    <button type="button" className="table-edit-btn" onClick={() => handleEdit(table)} title="Edit Table">
                      <Edit size={14} />
                    </button>
                    <button type="button" className="table-delete-btn" onClick={() => handleDelete(table)} title="Delete Table">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="table-modal-backdrop">
          <div className="table-modal">
            <div className="table-modal-header">
              <h3>{editingTable ? "Edit Table" : "Create Table"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={18}/></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="table-form-row">
                <div className="table-form-group">
                  <label>Table Number *</label>
                  <input type="text" name="table_number" placeholder="E.g. T1" value={formData.table_number} onChange={handleChange} required />
                </div>
                <div className="table-form-group">
                  <label>Section / Area</label>
                  <input type="text" name="section" placeholder="E.g. Main Hall" value={formData.section} onChange={handleChange} />
                </div>
              </div>

              <div className="table-form-row">
                <div className="table-form-group">
                  <label>Capacity *</label>
                  <input type="number" name="capacity" min="1" value={formData.capacity} onChange={handleChange} required />
                </div>
                <div className="table-form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    {tableStatuses.map((status) => (
                      <option key={status} value={status}>{getStatusLabel(status)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-form-group table-full-width">
                <label>Notes</label>
                <textarea name="notes" rows="2" placeholder="E.g. Near window, family table" value={formData.notes} onChange={handleChange} />
              </div>

              <div className="table-modal-actions">
                <button type="button" className="table-btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="table-btn-primary">
                  {editingTable ? "Update Table" : "Create Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}