import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Edit,
  Filter,
  Search,
  Trash2,
  X,
  Plus,
  Clock,
  CheckCircle,
  CreditCard,
  User,
  BedDouble
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; // <-- Imported reusable component
import "./guestServices.css";

const initialFormData = {
  booking_id: "",
  charge_name: "Extra Mattress",
  quantity: 1,
  rate: "",
  status: "pending",
  description: "",
};

const chargeTypes = [
  "Extra Mattress",
  "Extra Bed",
  "Laundry",
  "Late Checkout",
  "Minibar",
  "Damage Charge",
  "Room Service",
  "Other"
];

export default function GuestServicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [editingService, setEditingService] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getApiErrorMessage = (err, fallbackMessage) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => `${item.loc?.join(".") || ""}: ${item.msg}`).join(" | ");
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
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [servicesRes, bookingsRes, guestsRes, roomsRes] = await Promise.all([
        api.get("/extra-charges").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] }))
      ]);

      const hotelId = getLoggedInHotelId();
      const servicesList = normalizeList(servicesRes.data, "extra_charges");
      const bookingsList = normalizeList(bookingsRes.data, "bookings");
      const guestsList = normalizeList(guestsRes.data, "guests");
      const roomsList = normalizeList(roomsRes.data, "rooms");

      if (hotelId) {
        setServices(servicesList.filter((s) => Number(s.hotel_id) === Number(hotelId)));
        setBookings(bookingsList.filter((b) => Number(b.hotel_id) === Number(hotelId)));
        setGuests(guestsList.filter((g) => Number(g.hotel_id) === Number(hotelId)));
        setRooms(roomsList.filter((r) => Number(r.hotel_id) === Number(hotelId)));
      } else {
        setServices(servicesList);
        setBookings(bookingsList);
        setGuests(guestsList);
        setRooms(roomsList);
      }
    } catch (err) {
      console.error("Fetch guest services error:", err);
      setError(getApiErrorMessage(err, "Failed to load guest services data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getGuestName = (guestId) => {
    const guest = guests.find((item) => Number(item.id) === Number(guestId));
    return guest?.full_name || "-";
  };

  const getRoomNumber = (roomId) => {
    const room = rooms.find((item) => Number(item.id) === Number(roomId));
    return room?.room_number || "-";
  };

  const getBookingLabel = (booking) => {
    return `#${booking.id} - ${getGuestName(booking.guest_id)} - Room ${getRoomNumber(booking.room_id)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculatedTotal = useMemo(() => {
    return (Number(formData.quantity) || 0) * (Number(formData.rate) || 0);
  }, [formData.quantity, formData.rate]);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingService(null);
    setError("");
  };

  const buildPayload = () => {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) throw new Error("Hotel ID not found. Please logout and login again.");

    return {
      hotel_id: Number(hotelId),
      booking_id: Number(formData.booking_id),
      charge_name: formData.charge_name.trim(),
      quantity: Number(formData.quantity),
      rate: Number(formData.rate),
      total_amount: calculatedTotal,
      status: formData.status,
      description: formData.description.trim(),
    };
  };

  const buildUpdatePayload = () => {
    return {
      charge_name: formData.charge_name.trim(),
      quantity: Number(formData.quantity),
      rate: Number(formData.rate),
      status: formData.status,
      description: formData.description.trim(),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingService) {
        await api.put(`/extra-charges/${editingService.id}`, buildUpdatePayload());
        setSuccess("Extra charge updated successfully.");
      } else {
        await api.post("/extra-charges", buildPayload());
        setSuccess("Extra charge created successfully.");
      }

      setTimeout(() => setSuccess(""), 3000);
      resetForm();
      await fetchData();
    } catch (err) {
      console.error("Save service error:", err);
      setError(getApiErrorMessage(err, "Failed to save extra charge."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setError("");
    setSuccess("");

    setFormData({
      booking_id: service.booking_id || "",
      charge_name: service.charge_name || "Extra Mattress",
      quantity: service.quantity || 1,
      rate: service.rate || "",
      status: service.status || "pending",
      description: service.description || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (service) => {
    const confirmed = window.confirm(`Are you sure you want to delete this charge?`);
    if (!confirmed) return;

    try {
      setDeletingId(service.id);
      setError("");
      setSuccess("");

      await api.delete(`/extra-charges/${service.id}`);
      setSuccess("Charge deleted successfully.");
      
      setTimeout(() => setSuccess(""), 3000);
      if (editingService?.id === service.id) resetForm();
      await fetchData();
    } catch (err) {
      console.error("Delete service error:", err);
      setError(getApiErrorMessage(err, "Failed to delete extra charge."));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const search = searchText.toLowerCase();
      const chargeName = String(service.charge_name || "").toLowerCase();
      const bookingId = String(service.booking_id || "").toLowerCase();
      const status = String(service.status || "").toLowerCase();

      const booking = bookings.find(b => Number(b.id) === Number(service.booking_id));
      const guestName = booking ? getGuestName(booking.guest_id).toLowerCase() : "";
      const roomNumber = booking ? getRoomNumber(booking.room_id).toLowerCase() : "";

      const matchesSearch = 
        !search || 
        chargeName.includes(search) || 
        bookingId.includes(search) || 
        guestName.includes(search) || 
        roomNumber.includes(search);
        
      const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [services, bookings, searchText, statusFilter]);

  const stats = useMemo(() => {
    const pending = services.filter((s) => String(s.status || "").toLowerCase() === "pending").length;
    const paid = services.filter((s) => String(s.status || "").toLowerCase() === "paid").length;
    const totalRevenue = services.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

    return {
      total: services.length,
      pending,
      paid,
      totalRevenue,
    };
  }, [services]);

  return (
    <div className="services-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Extra Charges"
        kicker="GUEST SERVICES"
        description="Add and manage extra charges like mattress, laundry, late checkout, and other services."
        icon={ClipboardList}
        backPath="/front-desk"
      />

      {error && <div className="services-error-box">{error}</div>}
      {success && <div className="services-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <div className="services-stats-grid">
        <StatCard
          title="Total Charges"
          value={stats.total}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          Icon={Clock}
          colorTheme="orange"
        />
        <StatCard
          title="Paid"
          value={stats.paid}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Total Amount"
          value={`₹${stats.totalRevenue.toFixed(2)}`}
          Icon={CreditCard}
          colorTheme="purple"
        />
      </div>
      {/* --------------------------- */}

      <div className="services-layout">
        
        {/* Form Card */}
        <section className="services-form-card">
          <div className="services-section-header">
            <div className="services-section-title">
              <div className="services-section-icon">
                {editingService ? <Edit size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editingService ? "Edit Extra Charge" : "Add Extra Charge"}</h3>
                <p>Add charge against a guest booking.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="services-form-grid">
            <div className="services-form-group">
              <label>Booking</label>
              <select
                name="booking_id"
                value={formData.booking_id}
                onChange={handleChange}
                required
                disabled={Boolean(editingService)}
              >
                <option value="">Select booking</option>
                {bookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {getBookingLabel(booking)}
                  </option>
                ))}
              </select>
            </div>

            <div className="services-form-group">
              <label>Charge Name</label>
              <select
                name="charge_name"
                value={formData.charge_name}
                onChange={handleChange}
                required
              >
                {chargeTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="services-form-group">
              <label>Quantity</label>
              <input
                type="number"
                name="quantity"
                min="1"
                value={formData.quantity}
                onChange={handleChange}
                required
              />
            </div>

            <div className="services-form-group">
              <label>Rate</label>
              <input
                type="number"
                name="rate"
                min="0"
                step="0.01"
                placeholder="Example: 500"
                value={formData.rate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="services-form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div className="services-form-group">
              <label>Total Amount</label>
              <div className="services-readonly-amount">
                ₹{calculatedTotal.toFixed(2)}
              </div>
            </div>

            <div className="services-form-group services-description-field">
              <label>Description</label>
              <textarea
                name="description"
                rows="3"
                placeholder="Example: Extra mattress given to guest"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="services-form-actions">
              {editingService && (
                <button type="button" className="services-cancel-btn" onClick={resetForm}>
                  <X size={16} /> Cancel
                </button>
              )}
              <button type="submit" className="services-save-btn" disabled={saving}>
                {editingService ? <Edit size={16} /> : <Plus size={16} />}
                {saving ? "Saving..." : editingService ? "Update Charge" : "Create Charge"}
              </button>
            </div>
          </form>
        </section>

        {/* Table Card */}
        <section className="services-table-card">
          <div className="services-table-header">
            <div className="services-section-title">
              <div className="services-section-icon">
                <ClipboardList size={18} />
              </div>
              <div>
                <h3>Extra Charges List</h3>
                <p>All extra charges added against bookings.</p>
              </div>
            </div>

            <div className="services-filter-row">
              <div className="services-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search charge..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <div className="services-filter-box">
                <Filter size={16} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="services-empty-state">
              <h4>Loading extra charges...</h4>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="services-empty-state">
              <h4>No charges found</h4>
              <p>Create your first extra charge using the form.</p>
            </div>
          ) : (
            <div className="services-table-scroll">
              <table className="services-table">
                <thead>
                  <tr>
                    <th>Charge ID</th>
                    <th>Booking</th>
                    <th>Guest / Room</th>
                    <th>Charge Details</th>
                    <th>Qty x Rate</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => {
                    const booking = bookings.find((b) => Number(b.id) === Number(service.booking_id));
                    
                    return (
                      <tr key={service.id}>
                        <td><span className="sv-id-tag">#{service.id}</span></td>
                        
                        <td>
                          <div className="sv-details-cell">
                            <strong>Booking #{service.booking_id}</strong>
                          </div>
                        </td>

                        <td>
                          <div className="sv-details-cell">
                            <strong>
                              <User size={13} />
                              {booking ? getGuestName(booking.guest_id) : "-"}
                            </strong>
                            <span>
                              <BedDouble size={13} />
                              Room {booking ? getRoomNumber(booking.room_id) : "-"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="sv-details-cell">
                            <strong>{service.charge_name}</strong>
                            <span>{service.description || "-"}</span>
                          </div>
                        </td>

                        <td>
                          {service.quantity} x ₹{Number(service.rate).toFixed(2)}
                        </td>

                        <td>
                          <strong className="sv-price">₹{Number(service.total_amount || 0).toFixed(2)}</strong>
                        </td>

                        <td>
                          <span className={`sv-status-pill ${service.status || "pending"}`}>
                            {service.status || "pending"}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div className="services-action-row">
                            <button type="button" className="services-edit-btn" onClick={() => handleEdit(service)}>
                              <Edit size={14} /> Edit
                            </button>
                            <button
                              type="button"
                              className="services-delete-btn"
                              onClick={() => handleDelete(service)}
                              disabled={deletingId === service.id}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}