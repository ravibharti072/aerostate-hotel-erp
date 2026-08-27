import { useEffect, useState } from "react";
import api from "../../../api/api";
import "./hotels.css";

export default function HotelsPage() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
  name: "",
  owner_name: "",
  email: "",
  phone: "",
  address: "",
});

  const getApiErrorMessage = (err, fallbackMessage) => {
    const detail = err.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
          return `${field}: ${item.msg}`;
        })
        .join(" | ");
    }

    if (detail && typeof detail === "object") {
      return JSON.stringify(detail);
    }

    return fallbackMessage;
  };

  const normalizeHotels = (data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.hotels)) {
      return data.hotels;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  };

  const fetchHotels = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/hotels");

      const safeHotels = normalizeHotels(response.data);
      setHotels(safeHotels);
    } catch (err) {
      console.error("Fetch hotels error:", err);
      setError(getApiErrorMessage(err, "Failed to load hotels."));
      setHotels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateHotel = async (e) => {
    e.preventDefault();

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const payload = {
        name: formData.name.trim(),
        owner_name: formData.owner_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
      };

      await api.post("/hotels", payload);

      setSuccess("Hotel created successfully.");
      setTimeout(() => {
       setSuccess("");
      }, 3000);


      setFormData({
        name: "",
        owner_name: "",
        email: "",
        phone: "",
        address: "",
      });

      await fetchHotels();
    } catch (err) {
      console.error("Create hotel error:", err);
      setError(getApiErrorMessage(err, "Failed to create hotel."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Hotels Management</h1>
          <p>Create and manage hotels registered on the ERP platform.</p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div className="hotels-layout">
        <div className="hotel-form-card">
          <h3>Add New Hotel</h3>

          <form onSubmit={handleCreateHotel}>
            <div className="form-group">
              <label>Hotel Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter hotel name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Owner Name</label>
              <input
                type="text"
                name="owner_name"
                placeholder="Enter owner name"
                value={formData.owner_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="hotel@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="text"
                name="phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <textarea
                name="address"
                placeholder="Enter hotel address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Hotel"}
            </button>
          </form>
        </div>

        <div className="hotels-table-card">
          <div className="table-card-header">
            <h3>Registered Hotels</h3>

            <button type="button" onClick={fetchHotels}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              <h4>Loading hotels...</h4>
            </div>
          ) : hotels.length === 0 ? (
            <div className="empty-state">
              <h4>No hotels found</h4>
              <p>Create your first hotel using the form.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hotel Name</th>
                  <th>Owner Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Address</th>
                </tr>
              </thead>

              <tbody>
                {hotels.map((hotel) => (
                  <tr key={hotel.id}>
                    <td>{hotel.id}</td>
                    <td>{hotel.name || "-"}</td>
                    <td>{hotel.owner_name || "-"}</td>
                    <td>{hotel.email || "-"}</td>
                    <td>{hotel.phone || hotel.phone_number || "-"}</td>
                    <td>{hotel.address || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}