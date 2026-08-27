import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Hotel,
  RefreshCw,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  UserCheck,
  Edit,
  X,
  Save,
  Download,
  Calendar
} from "lucide-react";
import api from "../../api/api";
import styles from "./hotelsManagement.module.css";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default function HotelsManagementPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [currentHotel, setCurrentHotel] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    owner_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    tax_number: "",
    go_live_date: "", // --- NEW: Added for Go-Live configuration ---
  });
  const [submitting, setSubmitting] = useState(false);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    return [];
  }

  async function fetchData() {
    try {
      setLoading(true);
      const [hotelsRes, usersRes] = await Promise.all([
        api.get("/hotels").catch(() => ({ data: [] })),
        api.get("/users").catch(() => ({ data: [] }))
      ]);

      setHotels(normalizeList(hotelsRes.data, "hotels"));
      setUsers(normalizeList(usersRes.data, "users"));
    } catch (err) {
      console.error("Failed to fetch hotels data:", err);
      setError("Failed to load hotel directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleOpenEdit(hotel) {
    setCurrentHotel(hotel);
    
    // Fetch current go-live date for this specific hotel
    let fetchedGoLive = "";
    try {
      const res = await api.get(`/system/hotels/${hotel.id}/go-live`);
      if (res.data && res.data.go_live_date) {
        fetchedGoLive = res.data.go_live_date;
      }
    } catch (err) {
      console.error("Could not fetch go-live date", err);
    }

    setEditFormData({
      name: hotel.name || "",
      owner_name: hotel.owner_name || "",
      email: hotel.email || "",
      phone: hotel.phone || "",
      address: hotel.address || "",
      city: hotel.city || "",
      state: hotel.state || "",
      country: hotel.country || "",
      tax_number: hotel.tax_number || "",
      go_live_date: fetchedGoLive, // Populate form
    });
    setIsEditing(true);
  }

  function handleCloseEdit() {
    setIsEditing(false);
    setCurrentHotel(null);
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleUpdateHotel(e) {
    e.preventDefault();
    if (!currentHotel) return;

    setError("");
    setSuccess("");

    try {
      setSubmitting(true);
      
      // 1. Update standard hotel info
      await api.put(`/hotels/${currentHotel.id}`, {
        name: editFormData.name,
        owner_name: editFormData.owner_name,
        email: editFormData.email,
        phone: editFormData.phone,
        address: editFormData.address,
        city: editFormData.city,
        state: editFormData.state,
        country: editFormData.country,
        tax_number: editFormData.tax_number
      });

      // 2. Update System Go-Live Date via our new endpoint
      if (editFormData.go_live_date) {
        await api.put(`/system/hotels/${currentHotel.id}/go-live`, {
          go_live_date: editFormData.go_live_date
        });
      }

      setSuccess("Hotel information & System Go-Live date updated successfully!");
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error("Failed to update hotel:", err);
      setError(err.response?.data?.detail || "Failed to update hotel information.");
    } finally {
      setSubmitting(false);
    }
  }

  // Export full directory as CSV download
  function handleDownloadCSV() {
    const headers = ["ID", "Hotel Name", "Owner Name", "Email", "Phone", "Address", "City", "State", "Country", "Tax Number", "Status", "Registered Date"];
    const rows = combinedHotelData.map((h) => [
      h.id,
      `"${h.name || ""}"`,
      `"${h.owner_name || ""}"`,
      `"${h.email || ""}"`,
      `"${h.phone || ""}"`,
      `"${h.address || ""}"`,
      `"${h.city || ""}"`,
      `"${h.state || ""}"`,
      `"${h.country || ""}"`,
      `"${h.tax_number || ""}"`,
      h.is_active ? "Active" : "Inactive",
      h.created_at ? new Date(h.created_at).toLocaleDateString() : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hotel_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Map each hotel to its corresponding admin user
  const combinedHotelData = hotels.map((hotel) => {
    const adminUser = users.find(
      (u) => u.hotel_id === hotel.id && u.role === "hotel-admin"
    );
    return {
      ...hotel,
      adminUser: adminUser || null,
    };
  });

  return (
    <div className={styles["sa-page"]}>
      <SuperAdminSidebar />

      <main className={styles["sa-main"]}>
        {/* Top Header Card */}
        <header className={styles["sa-header-card"]}>
          <div className={styles["sa-header-left"]}>
            <div className={styles["sa-header-icon"]}>
              <Building2 size={24} />
            </div>
            <div>
              <span className={styles["sa-kicker"]}>Platform Management</span>
              <h1>Hotel Directory</h1>
            </div>
          </div>

          <div className={styles["header-actions-group"]}>
            <button className={styles["download-btn"]} onClick={handleDownloadCSV}>
              <Download size={16} />
              Download All Information
            </button>
            <button className={styles["sa-back-btn"]} onClick={() => navigate("/super-admin/dashboard")}>
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
          </div>
        </header>

        {error && <div className={styles["alert-error"]}>{error}</div>}
        {success && <div className={styles["alert-success"]}>{success}</div>}

        {/* Hotels Table Section */}
        <section className={styles["sa-list-section"]}>
          <div className={styles["sa-modules-header"]}>
            <div>
              <h3>All Onboarded Hotels</h3>
              <p>Complete directory of hotel properties, locations, and contact details.</p>
            </div>
            <button className={styles["sa-refresh"]} onClick={fetchData} disabled={loading}>
              <RefreshCw size={16} className={loading ? styles["spin"] : ""} />
              Refresh
            </button>
          </div>

          <div className={styles["table-responsive"]}>
            <table className={styles["hotels-table"]}>
              <thead>
                <tr>
                  <th>Hotel Property</th>
                  <th>Owner & Contact</th>
                  <th>Location & Details</th>
                  <th>Tax Number / GST</th>
                  <th>Status</th>
                  <th>Registered Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {combinedHotelData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={styles["no-data"]}>
                      No hotels onboarded yet.
                    </td>
                  </tr>
                ) : (
                  combinedHotelData.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className={styles["table-hotel-name"]}>
                          <Hotel size={16} className="color-blue" />
                          <div>
                            <strong>{item.name}</strong>
                            <span className={styles["hotel-id-tag"]}>ID: {item.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles["contact-info"]}>
                          <strong>{item.owner_name}</strong>
                          <span><Mail size={12} /> {item.email}</span>
                          <span><Phone size={12} /> {item.phone}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles["location-info"]}>
                          <MapPin size={13} />
                          {item.address ? `${item.address}, ` : ""}
                          {item.city ? `${item.city}, ` : ""}
                          {item.state ? `${item.state}, ` : ""}
                          {item.country || "N/A"}
                        </div>
                      </td>
                      <td>
                        <span className={styles["tax-tag"]}>{item.tax_number || "N/A"}</span>
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${item.is_active ? styles["active"] : styles["inactive"]}`}>
                          {item.is_active ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/A"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className={styles["btn-icon-edit"]}
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Hotel Information & Go-Live"
                        >
                          <Edit size={14} /> Configure
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Edit Hotel Modal (Includes Go-Live Date configuration) */}
        {isEditing && (
          <div className={styles["modal-overlay"]}>
            <div className={styles["modal-card"]} style={{ maxWidth: '600px' }}>
              <div className={styles["modal-header"]}>
                <h3>Configure Hotel (ID: {currentHotel?.id})</h3>
                <button className={styles["modal-close"]} onClick={handleCloseEdit}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateHotel} className={styles["modal-form"]}>
                
                {/* --- NEW: GO-LIVE CONFIGURATION BANNER --- */}
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontWeight: '700', marginBottom: '6px' }}>
                    <Calendar size={18} /> System Go-Live & Testing Cut-Off Date
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                    Set the official software rollout date (e.g., 2026-06-01 for testing, or 2026-11-01 for live launch). Users will be locked out from viewing attendance/payroll prior to this date.
                  </p>
                  <input
                    type="date"
                    name="go_live_date"
                    value={editFormData.go_live_date}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #93c5fd', backgroundColor: 'white', fontWeight: '600', color: '#1e3a8a' }}
                  />
                </div>

                <div className={styles["form-grid"]}>
                  <div className={styles["form-group"]}>
                    <label>Hotel Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                      required
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>Owner Name *</label>
                    <input
                      type="text"
                      name="owner_name"
                      value={editFormData.owner_name}
                      onChange={handleEditChange}
                      required
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>Official Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={editFormData.email}
                      onChange={handleEditChange}
                      required
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      name="phone"
                      value={editFormData.phone}
                      onChange={handleEditChange}
                      required
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={editFormData.address}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>City</label>
                    <input
                      type="text"
                      name="city"
                      value={editFormData.city}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>State / Province</label>
                    <input
                      type="text"
                      name="state"
                      value={editFormData.state}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>Country</label>
                    <input
                      type="text"
                      name="country"
                      value={editFormData.country}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className={`${styles["form-group"]} ${styles["full-width"]}`}>
                    <label>Tax Number / GST</label>
                    <input
                      type="text"
                      name="tax_number"
                      value={editFormData.tax_number}
                      onChange={handleEditChange}
                    />
                  </div>
                </div>

                <div className={styles["modal-actions"]}>
                  <button type="button" className={styles["cancel-btn"]} onClick={handleCloseEdit}>
                    Cancel
                  </button>
                  <button type="submit" className={styles["submit-btn"]} disabled={submitting}>
                    <Save size={16} />
                    {submitting ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}