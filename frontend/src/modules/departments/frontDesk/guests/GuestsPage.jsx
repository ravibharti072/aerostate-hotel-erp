import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Edit,
  Filter,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
  ArrowLeft,
  Globe,
  MapPin,
  UserCheck
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import "./guests.css";

const initialFormData = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  nationality: "",
  id_type: "Aadhaar",
  id_number: "",
};

const idTypes = ["Aadhaar", "Passport", "Driving License", "Voter ID", "Other"];

export default function GuestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [guests, setGuests] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [editingGuest, setEditingGuest] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchText, setSearchText] = useState("");
  const [idTypeFilter, setIdTypeFilter] = useState("all");

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

  const fetchGuests = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/guests");
      const list = normalizeList(response.data, "guests");

      const hotelId = getLoggedInHotelId();

      if (hotelId) {
        setGuests(
          list.filter((guest) => Number(guest.hotel_id) === Number(hotelId))
        );
      } else {
        setGuests(list);
      }
    } catch (err) {
      console.error("Fetch guests error:", err);
      setError(getApiErrorMessage(err, "Failed to load guests."));
      setGuests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
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
    setEditingGuest(null);
    setError("");
  };

  const buildPayload = () => {
    const hotelId = getLoggedInHotelId();

    if (!hotelId) {
      throw new Error("Hotel ID not found. Please logout and login again.");
    }

    return {
      hotel_id: Number(hotelId),
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      nationality: formData.nationality.trim(),
      id_type: formData.id_type.trim(),
      id_number: formData.id_number.trim(),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = buildPayload();

      if (editingGuest) {
        await api.put(`/guests/${editingGuest.id}`, payload);
        setSuccess("Guest updated successfully.");
      } else {
        await api.post("/guests", payload);
        setSuccess("Guest created successfully.");
      }

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      resetForm();
      await fetchGuests();
    } catch (err) {
      console.error("Save guest error:", err);
      setError(getApiErrorMessage(err, "Failed to save guest."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (guest) => {
    setEditingGuest(guest);
    setError("");
    setSuccess("");

    setFormData({
      full_name: guest.full_name || "",
      phone: guest.phone || "",
      email: guest.email || "",
      address: guest.address || "",
      nationality: guest.nationality || "",
      id_type: guest.id_type || "Aadhaar",
      id_number: guest.id_number || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (guest) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete guest ${guest.full_name}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(guest.id);
      setError("");
      setSuccess("");

      await api.delete(`/guests/${guest.id}`);

      setSuccess("Guest deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      if (editingGuest?.id === guest.id) {
        resetForm();
      }

      await fetchGuests();
    } catch (err) {
      console.error("Delete guest error:", err);
      setError(getApiErrorMessage(err, "Failed to delete guest."));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const search = searchText.toLowerCase();

      const fullName = String(guest.full_name || "").toLowerCase();
      const phone = String(guest.phone || "").toLowerCase();
      const email = String(guest.email || "").toLowerCase();
      const idNumber = String(guest.id_number || "").toLowerCase();
      const idType = String(guest.id_type || "").toLowerCase();

      const matchesSearch =
        !search ||
        fullName.includes(search) ||
        phone.includes(search) ||
        email.includes(search) ||
        idNumber.includes(search);

      const matchesIdType =
        idTypeFilter === "all" || idType === idTypeFilter.toLowerCase();

      return matchesSearch && matchesIdType;
    });
  }, [guests, searchText, idTypeFilter]);

  // Updated Better Metrics
  const guestStats = useMemo(() => {
    const domestic = guests.filter((guest) => {
      const nat = String(guest.nationality || "").toLowerCase();
      return nat === "indian" || nat === "india";
    }).length;

    const international = guests.filter((guest) => {
      const nat = String(guest.nationality || "").toLowerCase();
      return nat !== "" && nat !== "indian" && nat !== "india";
    }).length;

    const withEmail = guests.filter((guest) => guest.email && guest.email.trim() !== "").length;

    return {
      total: guests.length,
      domestic,
      international,
      withEmail,
    };
  }, [guests]);

  return (
    <div className="guests-page">
      
      {/* Top Header Card */}
      <header className="gs-header-card">
        <div className="gs-header-left">
          
          <button className="gs-back-btn" onClick={() => navigate("/front-desk")}>
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="gs-header-title-group">
            <div className="gs-header-icon">
              <User size={24} />
            </div>
            <div>
              <span className="gs-kicker">Guests Management</span>
              <h1>Guests</h1>
              <p>Create and manage guest profiles, contact details, nationality, and ID proof information.</p>
            </div>
          </div>

        </div>
      </header>

      {error && <div className="guests-error-box">{error}</div>}
      {success && <div className="guests-success-box">{success}</div>}

      {/* Improved Stats Grid */}
      <div className="guests-stats-grid">
        <div className="guests-stat-card">
          <div className="guests-stat-icon-wrapper bg-light-blue">
            <User size={22} className="color-blue" />
          </div>
          <div className="guests-stat-info">
            <p>Total Guests</p>
            <h2>{guestStats.total}</h2>
            <span>All guest profiles</span>
          </div>
        </div>

        <div className="guests-stat-card">
          <div className="guests-stat-icon-wrapper bg-light-green">
            <MapPin size={22} className="color-green" />
          </div>
          <div className="guests-stat-info">
            <p>Domestic Guests</p>
            <h2>{guestStats.domestic}</h2>
            <span>Local nationality</span>
          </div>
        </div>

        <div className="guests-stat-card">
          <div className="guests-stat-icon-wrapper bg-light-orange">
            <Globe size={22} className="color-orange" />
          </div>
          <div className="guests-stat-info">
            <p>International Guests</p>
            <h2>{guestStats.international}</h2>
            <span>Foreign nationality</span>
          </div>
        </div>

        <div className="guests-stat-card">
          <div className="guests-stat-icon-wrapper bg-light-purple">
            <UserCheck size={22} className="color-purple" />
          </div>
          <div className="guests-stat-info">
            <p>Contactable</p>
            <h2>{guestStats.withEmail}</h2>
            <span>Profiles with emails</span>
          </div>
        </div>
      </div>

      <div className="guests-layout">
        
        {/* Form Card */}
        <section className="guests-form-card">
          <div className="guests-section-header">
            <div className="guests-section-title">
              <div className="guests-section-icon">
                {editingGuest ? <Edit size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editingGuest ? "Edit Guest" : "Add Guest"}</h3>
                <p>
                  {editingGuest
                    ? "Update selected guest details."
                    : "Create a new guest profile for this hotel."}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="guests-form-grid">
            <div className="guests-form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                placeholder="Enter guest full name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="guests-form-group">
              <label>Phone</label>
              <input
                type="text"
                name="phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="guests-form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="guest@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="guests-form-group">
              <label>Nationality</label>
              <input
                type="text"
                name="nationality"
                placeholder="Example: Indian"
                value={formData.nationality}
                onChange={handleChange}
                required
              />
            </div>

            <div className="guests-form-group">
              <label>ID Type</label>
              <select
                name="id_type"
                value={formData.id_type}
                onChange={handleChange}
                required
              >
                {idTypes.map((idType) => (
                  <option key={idType} value={idType}>
                    {idType}
                  </option>
                ))}
              </select>
            </div>

            <div className="guests-form-group">
              <label>ID Number</label>
              <input
                type="text"
                name="id_number"
                placeholder="Enter ID proof number"
                value={formData.id_number}
                onChange={handleChange}
                required
              />
            </div>

            <div className="guests-form-group guests-address-field">
              <label>Address</label>
              <textarea
                name="address"
                placeholder="Enter guest address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                required
              />
            </div>

            <div className="guests-form-actions">
              {editingGuest && (
                <button
                  type="button"
                  className="guests-cancel-btn"
                  onClick={resetForm}
                >
                  <X size={16} />
                  Cancel
                </button>
              )}

              <button
                type="submit"
                className="guests-save-btn"
                disabled={saving}
              >
                {editingGuest ? <Edit size={16} /> : <Plus size={16} />}
                {saving
                  ? "Saving..."
                  : editingGuest
                  ? "Update Guest"
                  : "Create Guest"}
              </button>
            </div>
          </form>
        </section>

        {/* Table Card */}
        <section className="guests-table-card">
          <div className="guests-table-header">
            <div className="guests-section-title">
              <div className="guests-section-icon">
                <User size={18} />
              </div>
              <div>
                <h3>Guest List</h3>
                <p>All guests registered under this hotel.</p>
              </div>
            </div>

            <div className="guests-filter-row">
              <div className="guests-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search guest..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="guests-filter-box">
                <Filter size={16} />
                <select
                  value={idTypeFilter}
                  onChange={(e) => setIdTypeFilter(e.target.value)}
                >
                  <option value="all">All ID Types</option>
                  {idTypes.map((idType) => (
                    <option key={idType} value={idType}>
                      {idType}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="guests-empty-state">
              <h4>Loading guests...</h4>
            </div>
          ) : filteredGuests.length === 0 ? (
            <div className="guests-empty-state">
              <h4>No guests found</h4>
              <p>Create your first guest using the form.</p>
            </div>
          ) : (
            <div className="guests-table-scroll">
              <table className="guests-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Guest Details</th>
                    <th>Contact</th>
                    <th>Nationality</th>
                    <th>ID Proof</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredGuests.map((guest) => (
                    <tr key={guest.id}>
                      <td><span className="guest-id-tag">#{guest.id}</span></td>

                      <td>
                        <div className="guest-details-cell">
                          <strong>{guest.full_name || "-"}</strong>
                          <span>{guest.address || "-"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="guest-contact-list">
                          <span>
                            <Phone size={12} />
                            {guest.phone || "-"}
                          </span>
                          <span>
                            <Mail size={12} />
                            {guest.email || "-"}
                          </span>
                        </div>
                      </td>

                      <td>{guest.nationality || "-"}</td>

                      <td>
                        <div className="guest-id-proof">
                          <span className="guest-id-pill">
                            {guest.id_type || "-"}
                          </span>
                          <small>{guest.id_number || "-"}</small>
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="guests-action-row">
                          <button
                            type="button"
                            className="guests-edit-btn"
                            onClick={() => handleEdit(guest)}
                          >
                            <Edit size={14} /> Edit
                          </button>

                          <button
                            type="button"
                            className="guests-delete-btn"
                            onClick={() => handleDelete(guest)}
                            disabled={deletingId === guest.id}
                          >
                            <Trash2 size={14} />
                          </button>
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