import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CheckCircle,
  Edit,
  Filter,
  Key,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
  ArrowLeft
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import StatCard from "../../../../components/StatCard"; // <-- Imported reusable component
import "./addRoom.css";

const initialFormData = {
  room_number: "",
  room_type: "",
  floor: "",
  price_per_night: "",
  status: "available",
  description: "",
};

const roomStatuses = ["available", "occupied", "maintenance", "cleaning"];

export default function AddRoomPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [editingRoom, setEditingRoom] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const getApiErrorMessage = (err, fallbackMessage) => {
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
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getLoggedInHotelId = () => {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id
    );
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/rooms");
      setRooms(normalizeList(response.data, "rooms"));
    } catch (err) {
      console.error("Fetch rooms error:", err);
      setError(getApiErrorMessage(err, "Failed to load rooms."));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingRoom(null);
    setError("");
  };

  const buildPayload = () => {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) {
      throw new Error("Hotel ID not found. Please logout and login again.");
    }

    return {
      hotel_id: Number(hotelId),
      room_number: formData.room_number.trim(),
      room_type: formData.room_type.trim(),
      floor: String(formData.floor || "").trim(),
      base_price: formData.price_per_night === "" ? 0 : Number(formData.price_per_night),
      status: editingRoom ? formData.status : "available",
      description: formData.description.trim(),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = buildPayload();

      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.id}`, payload);
        setSuccess("Room updated successfully.");
      } else {
        await api.post("/rooms", payload);
        setSuccess("Room created successfully.");
      }

      setTimeout(() => setSuccess(""), 3000);
      resetForm();
      await fetchRooms();
    } catch (err) {
      console.error("Save room error:", err);
      setError(getApiErrorMessage(err, "Failed to save room."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setError("");
    setSuccess("");

    setFormData({
      room_number: room.room_number || "",
      room_type: room.room_type || "",
      floor: room.floor ?? "",
      price_per_night: room.base_price ?? room.price_per_night ?? "",
      status: room.status || "available",
      description: room.description || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (room) => {
    const confirmed = window.confirm(`Are you sure you want to delete room ${room.room_number}?`);
    if (!confirmed) return;

    try {
      setDeletingId(room.id);
      setError("");
      setSuccess("");

      await api.delete(`/rooms/${room.id}`);
      setSuccess("Room deleted successfully.");
      setTimeout(() => setSuccess(""), 3000);

      if (editingRoom?.id === room.id) {
        resetForm();
      }
      await fetchRooms();
    } catch (err) {
      console.error("Delete room error:", err);
      setError(getApiErrorMessage(err, "Failed to delete room."));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const status = String(room.status || "").toLowerCase();
      const roomNumber = String(room.room_number || "").toLowerCase();
      const roomType = String(room.room_type || "").toLowerCase();
      const search = searchText.toLowerCase();

      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesSearch = !search || roomNumber.includes(search) || roomType.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [rooms, statusFilter, searchText]);

  const roomStats = useMemo(() => {
    return {
      total: rooms.length,
      available: rooms.filter((room) => String(room.status || "").toLowerCase() === "available").length,
      occupied: rooms.filter((room) => String(room.status || "").toLowerCase() === "occupied").length,
      maintenance: rooms.filter((room) => String(room.status || "").toLowerCase() === "maintenance").length,
    };
  }, [rooms]);

  return (
    <div className="rooms-page">
      {/* UNIFIED PORTAL HEADER */}
      <header className="rm-header-card">
        <div className="rm-header-left">
          <button className="rm-back-btn" onClick={() => navigate("/rooms")}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="rm-header-icon-box">
            <Plus size={28} />
          </div>
          
          <div className="rm-header-text">
            <span className="rm-kicker">ROOMS MANAGEMENT</span>
            <h1>Add & Manage Rooms</h1>
            <p>Create, update, and manage hotel rooms, pricing, and details.</p>
          </div>
        </div>
      </header>

      {error && <div className="rooms-error-box">{error}</div>}
      {success && <div className="rooms-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <div className="rooms-stats-grid">
        <StatCard
          title="Total Rooms"
          value={roomStats.total}
          Icon={BedDouble}
          colorTheme="blue"
        />
        <StatCard
          title="Available"
          value={roomStats.available}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Occupied"
          value={roomStats.occupied}
          Icon={Key}
          colorTheme="orange"
        />
        <StatCard
          title="Maintenance"
          value={roomStats.maintenance}
          Icon={Wrench}
          colorTheme="purple"
        />
      </div>
      {/* --------------------------- */}

      <div className="rooms-layout">
        <section className="rooms-form-card">
          <div className="rooms-section-header">
            <div className="rooms-section-title">
              <div className="rooms-section-icon">{editingRoom ? <Edit size={18} /> : <Plus size={18} />}</div>
              <div>
                <h3>{editingRoom ? "Edit Room" : "Add Room"}</h3>
                <p>{editingRoom ? "Update selected room details." : "Create a new hotel room."}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rooms-form-grid">
            <div className="rooms-form-group">
              <label>Room Number</label>
              <input type="text" name="room_number" placeholder="Example: 101" value={formData.room_number} onChange={handleChange} required />
            </div>
            <div className="rooms-form-group">
              <label>Room Type</label>
              <input type="text" name="room_type" placeholder="Example: Deluxe, Suite" value={formData.room_type} onChange={handleChange} required />
            </div>
            <div className="rooms-form-group">
              <label>Floor</label>
              <input type="text" name="floor" placeholder="Example: 1" value={formData.floor} onChange={handleChange} required />
            </div>
            <div className="rooms-form-group">
              <label>Price / Night</label>
              <input type="number" name="price_per_night" placeholder="Example: 2500" value={formData.price_per_night} onChange={handleChange} min="0" step="0.01" required />
            </div>

            {editingRoom && (
              <div className="rooms-form-group">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleChange} required>
                  {roomStatuses.map((status) => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="rooms-form-group rooms-description-field">
              <label>Description</label>
              <textarea name="description" placeholder="Room notes or facilities" value={formData.description} onChange={handleChange} rows="3" />
            </div>

            <div className="rooms-form-actions">
              {editingRoom && (
                <button type="button" className="rooms-cancel-btn" onClick={resetForm}>
                  <X size={16} /> Cancel
                </button>
              )}
              <button type="submit" className="rooms-save-btn" disabled={saving}>
                {editingRoom ? <Edit size={16} /> : <Plus size={16} />}
                {saving ? "Saving..." : editingRoom ? "Update Room" : "Create Room"}
              </button>
            </div>
          </form>
        </section>

        <section className="rooms-table-card">
          <div className="rooms-table-header">
            <div className="rooms-section-title">
              <div className="rooms-section-icon"><BedDouble size={18} /></div>
              <div><h3>Room List</h3><p>All rooms created for this hotel.</p></div>
            </div>
            <div className="rooms-filter-row">
              <div className="rooms-search-box">
                <Search size={16} />
                <input type="text" placeholder="Search room..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              </div>
              <div className="rooms-filter-box">
                <Filter size={16} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  {roomStatuses.map((status) => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rooms-empty-state"><h4>Loading rooms...</h4></div>
          ) : filteredRooms.length === 0 ? (
            <div className="rooms-empty-state"><h4>No rooms found</h4></div>
          ) : (
            <div className="rooms-table-scroll">
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Room Details</th>
                    <th>Type / Floor</th>
                    <th>Price / Night</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room) => (
                    <tr key={room.id}>
                      <td><span className="rm-id-tag">#{room.id}</span></td>
                      <td>
                        <div className="rm-details-cell">
                          <strong>Room {room.room_number || "-"}</strong>
                          <span>{room.description || "No description"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="rm-details-cell">
                          <strong>{room.room_type || "-"}</strong>
                          <span>Floor {room.floor ?? "-"}</span>
                        </div>
                      </td>
                      <td><strong className="rm-price">₹{Number(room.base_price || room.price_per_night || 0).toFixed(2)}</strong></td>
                      <td><span className={`rm-status-pill ${room.status || "available"}`}>{room.status || "available"}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <div className="rooms-action-row">
                          <button type="button" className="rooms-edit-btn" onClick={() => handleEdit(room)}><Edit size={14} /> Edit</button>
                          <button type="button" className="rooms-delete-btn" onClick={() => handleDelete(room)} disabled={deletingId === room.id}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}