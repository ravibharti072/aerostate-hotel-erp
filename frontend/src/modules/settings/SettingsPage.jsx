import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  Building2, 
  UserCircle, 
  Mail, 
  Phone, 
  MapPin, 
  Hash, 
  Save, 
  ShieldCheck,
  Settings,
  Calendar
} from "lucide-react";
import PortalHeader from "../../components/PortalHeader";
import ModuleWriternHeader from "../../components/ModuleWriternHeader";
import "./settings.css";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [hotelData, setHotelData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    username: user?.username || "",
    password: "",
    confirmPassword: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const fetchHotel = async () => {
      if (!user?.hotel_id) return;
      try {
        const res = await fetch(`http://localhost:8000/hotels/${user.hotel_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setHotelData(await res.json());
        }
      } catch (err) {
        console.error("Failed to load hotel data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHotel();
  }, [user, token]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (formData.password && formData.password !== formData.confirmPassword) {
      return setMessage({ type: "error", text: "New passwords do not match." });
    }
    if (formData.password && formData.password.length < 6) {
      return setMessage({ type: "error", text: "Password must be at least 6 characters." });
    }

    setIsSubmitting(true);
    const payload = {
      full_name: formData.full_name,
      username: formData.username
    };
    if (formData.password) {
      payload.password = formData.password;
    }

    try {
      const res = await fetch(`http://localhost:8000/users/${user.user_id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Profile updated successfully! Logging you out to refresh credentials..." });
        setFormData({ ...formData, password: "", confirmPassword: "" });
        
        // If they change login info, forcefully log them out to require re-login
        if (formData.password || formData.username !== user.username) {
          setTimeout(() => logout(), 2500);
        }
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.detail || "Failed to update profile." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Settings & Profile"
        kicker="SYSTEM MODULE"
        description="View your hotel property details, system activation date, and manage your personal login credentials."
        icon={Settings}
        backPath="/dashboard"
      />

      {/* --- MODULE SECTION --- */}
      <section className="settings-modules-section">
        <ModuleWriternHeader 
          title="System Configuration"
          description="Manage property details and user account settings."
        />

        <div className="settings-content-stack">
          {/* TOP SECTION: Hotel Info (Read-Only) */}
          <div className="settings-card">
            <div className="card-header">
              <div className="card-header-title">
                <Building2 size={20} className="text-blue" />
                <h2>Hotel Property Details & Activation</h2>
              </div>
            </div>
            
            <div className="card-body">
              {isLoading ? (
                <p className="text-muted">Loading hotel info...</p>
              ) : hotelData ? (
                <div className="hotel-details-grid">
                  <div className="detail-item">
                    <span className="label"><Building2 size={14}/> Hotel Name</span>
                    <span className="value">{hotelData.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label"><UserCircle size={14}/> Registered Owner</span>
                    <span className="value">{hotelData.owner_name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label"><Hash size={14}/> GST / Tax ID</span>
                    <span className="value">{hotelData.tax_number || "Not Provided"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label"><Mail size={14}/> Contact Email</span>
                    <span className="value">{hotelData.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label"><Phone size={14}/> Phone Number</span>
                    <span className="value">{hotelData.phone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label"><MapPin size={14}/> Full Address</span>
                    <span className="value">
                      {hotelData.address}, {hotelData.city}, {hotelData.state}
                    </span>
                  </div>
                  {/* --- NEW: SYSTEM GO-LIVE / ACTIVATION DATE DISPLAY --- */}
                  <div className="detail-item go-live-box">
                    <span className="label text-blue-bold"><Calendar size={14}/> System Go-Live & Activation Date</span>
                    <span className="value go-live-date">
                      {hotelData.go_live_date ? new Date(hotelData.go_live_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "Not Configured (Live Immediately)"}
                    </span>
                    <small className="go-live-disclaimer">
                      Attendance and historical leave tracking prior to this date are restricted by platform policy.
                    </small>
                  </div>
                </div>
              ) : (
                <p className="text-muted">Could not load hotel information.</p>
              )}
            </div>
          </div>

          {/* BOTTOM SECTION: User Profile Update */}
          <div className="settings-card">
            <div className="card-header">
              <div className="card-header-title">
                <ShieldCheck size={20} className="text-purple" />
                <h2>My Login Credentials</h2>
              </div>
            </div>
            
            <div className="card-body">
              {message.text && (
                <div className={`message-banner ${message.type}`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="profile-form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Login Username</label>
                  <input 
                    type="text" 
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>

                <div className="divider">
                  <span>Update Password (Optional)</span>
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    placeholder="Leave blank to keep current password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password" 
                    placeholder="Re-type new password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-save" disabled={isSubmitting}>
                    <Save size={16} />
                    {isSubmitting ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}