import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Hotel,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  ArrowLeft
} from "lucide-react";
import api from "../../api/api";
import styles from "./hotelOnboard.module.css";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default function HotelOnboardPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    owner_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    tax_number: "",
  });

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-dismiss error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
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

  async function fetchHotels() {
    try {
      setLoading(true);
      const response = await api.get("/hotels");
      setHotels(normalizeList(response.data, "hotels"));
    } catch (err) {
      console.error("Failed to fetch hotels:", err);
      setError("Failed to load hotels list.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHotels();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleRegisterHotel(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSubmitting(true);
      await api.post("/hotels", formData);
      setSuccess("Hotel registered successfully!");
      setFormData({
        name: "",
        owner_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "",
        tax_number: "",
      });
      fetchHotels();
    } catch (err) {
      console.error("Hotel registration error:", err);
      setError(err.response?.data?.detail || "Failed to register hotel. Please check details.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles["sa-page"]}>
      <SuperAdminSidebar />

      <main className={styles["sa-main"]}>
        {/* Top Header Card */}
        <header className={styles["sa-header-card"]}>
          <div className={styles["sa-header-left"]}>
            <div className={styles["sa-header-icon"]}>
              <Hotel size={24} />
            </div>
            <div>
              <span className={styles["sa-kicker"]}>Platform Management</span>
              <h1>Hotel Onboarding</h1>
            </div>
          </div>

          <button className={styles["sa-back-btn"]} onClick={() => navigate("/super-admin/dashboard")}>
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
        </header>

        {/* Feedback Alerts */}
        {error && <div className={styles["alert-error"]}>{error}</div>}
        {success && <div className={styles["alert-success"]}>{success}</div>}

        {/* Registration Form Card */}
        <section className={styles["sa-form-section"]}>
          <div className={styles["section-title"]}>
            <Plus size={20} />
            <h3>Register New Hotel Property</h3>
          </div>

          <form onSubmit={handleRegisterHotel} className={styles["hotel-form"]}>
            <div className={styles["form-grid"]}>
              <div className={styles["form-group"]}>
                <label>Hotel Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Aerostate Grand Resort"
                  required
                />
              </div>

              <div className={styles["form-group"]}>
                <label>Owner Name *</label>
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div className={styles["form-group"]}>
                <label>Official Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. contact@hotel.com"
                  required
                />
              </div>

              <div className={styles["form-group"]}>
                <label>Phone Number *</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +1 234 567 890"
                  required
                />
              </div>

              <div className={styles["form-group"]}>
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </div>

              <div className={styles["form-group"]}>
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                />
              </div>

              <div className={styles["form-group"]}>
                <label>State / Province</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="State"
                />
              </div>

              <div className={styles["form-group"]}>
                <label>Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Country"
                />
              </div>

              <div className={styles["form-group"]}>
                <label>Tax Number / GST</label>
                <input
                  type="text"
                  name="tax_number"
                  value={formData.tax_number}
                  onChange={handleChange}
                  placeholder="Tax Registration ID"
                />
              </div>
            </div>

            <div className={styles["form-actions"]}>
              <button type="submit" className={styles["submit-btn"]} disabled={submitting}>
                {submitting ? "Registering Hotel..." : "Onboard Hotel"}
              </button>
            </div>
          </form>
        </section>

        {/* Registered Hotels List Section */}
        <section className={styles["sa-list-section"]}>
          <div className={styles["sa-modules-header"]}>
            <div>
              <h3>Active Hotel Tenants</h3>
              <p>List of all properties currently onboarded on the platform.</p>
            </div>
            <button className={styles["sa-refresh"]} onClick={fetchHotels} disabled={loading}>
              <RefreshCw size={16} className={loading ? styles["spin"] : ""} />
              Refresh
            </button>
          </div>

          <div className={styles["table-responsive"]}>
            <table className={styles["hotels-table"]}>
              <thead>
                <tr>
                  <th>Hotel Name</th>
                  <th>Owner</th>
                  <th>Contact Info</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Registered On</th>
                </tr>
              </thead>
              <tbody>
                {hotels.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles["no-data"]}>
                      No hotels onboarded yet.
                    </td>
                  </tr>
                ) : (
                  hotels.map((hotel) => (
                    <tr key={hotel.id}>
                      <td>
                        <div className={styles["table-hotel-name"]}>
                          <Building2 size={16} className="color-blue" />
                          <strong>{hotel.name}</strong>
                        </div>
                      </td>
                      <td>{hotel.owner_name}</td>
                      <td>
                        <div className={styles["contact-info"]}>
                          <span><Mail size={13} /> {hotel.email}</span>
                          <span><Phone size={13} /> {hotel.phone}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles["location-info"]}>
                          <MapPin size={13} />
                          {hotel.city ? `${hotel.city}, ${hotel.country || ""}` : "N/A"}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${hotel.is_active ? styles["active"] : styles["inactive"]}`}>
                          {hotel.is_active ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          {hotel.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{new Date(hotel.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}