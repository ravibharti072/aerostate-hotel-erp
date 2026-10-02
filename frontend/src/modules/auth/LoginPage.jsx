import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound, Check } from "lucide-react";

import { useAuth } from "@context/AuthContext";
import api from "../../api/api";
import "./login.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Mandatory first-login password change state
  const [mustChangePasswordOpen, setMustChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(formData.username, formData.password);

      if (data.role === "super-admin") {
        logout();
        setError("Super admin cannot login from normal hotel login page");
        return;
      }

      if (data.must_change_password) {
        setMustChangePasswordOpen(true);
        return;
      }

      navigate("/dashboard");
    } catch (error) {
      setError(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangePasswordError("");

    if (newPassword.length < 6) {
      setChangePasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError("Passwords do not match.");
      return;
    }

    setChangePasswordLoading(true);
    try {
      await api.post("/auth/change-password-first-login", {
        new_password: newPassword,
      });

      // Update stored user object so must_change_password is removed
      try {
        const storedUser = JSON.parse(localStorage.getItem("hotel_erp_user") || "{}");
        storedUser.must_change_password = false;
        localStorage.setItem("hotel_erp_user", JSON.stringify(storedUser));
      } catch (err) {
        console.error("Failed to update stored user", err);
      }

      setMustChangePasswordOpen(false);
      navigate("/dashboard");
    } catch (err) {
      setChangePasswordError(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleCancelPasswordChange = () => {
    logout();
    setMustChangePasswordOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setChangePasswordError("");
  };

  return (
    <div className="login-page">
      {/* Left Dark Section */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="brand-logo-large">
            <div className="logo-squares">
              <span className="square blue"></span>
              <span className="square gray"></span>
              <span className="square teal"></span>
            </div>
          </div>
          <span className="platform-kicker">AEROSTATE PLATFORM</span>
          <h1>Aerostate Hotel ERP</h1>
          <p>
            Hotel management, bookings, rooms, guests, billing, inventory and
            reporting in one secure platform.
          </p>
        </div>
      </div>

      {/* Right Light Section */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-header">
            <div className="card-brand-logo">
              <span className="square blue"></span>
              <span className="square gray"></span>
              <span className="square teal"></span>
            </div>
            <div className="card-brand-text">
              <h3>Aerostate ERP</h3>
              <span>Hotel Management System</span>
            </div>
          </div>

          <div className="login-card-body">
            <h2>Welcome Back</h2>
            <p className="subtitle">Login to manage your hotel operations.</p>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>User ID</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    name="username"
                    placeholder="Enter user ID"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <button 
                    type="button" 
                    className="toggle-password" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? "Logging in..." : "Login"} <ArrowRight size={18} />
              </button>
            </form>
          </div>

          <div className="login-footer">
            <ShieldCheck size={16} /> Secure access for authorized hotel users only.
          </div>
        </div>
      </div>

      {/* Mandatory First-Login Password Change Modal */}
      {mustChangePasswordOpen && (
        <div className="first-login-overlay">
          <div className="first-login-modal">
            <div className="first-login-header">
              <div className="first-login-icon-box">
                <KeyRound size={24} />
              </div>
              <div className="first-login-title">
                <h3>Set New Password</h3>
                <p>This is your first login. For security, please set a new personal password before continuing.</p>
              </div>
            </div>

            {changePasswordError && (
              <div className="login-error" style={{ marginBottom: 0 }}>
                {changePasswordError}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>New Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Confirm New Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="first-login-btn-row">
                <button
                  type="button"
                  className="first-login-btn-cancel"
                  onClick={handleCancelPasswordChange}
                  disabled={changePasswordLoading}
                >
                  Log Out
                </button>
                <button
                  type="submit"
                  className="first-login-btn-submit"
                  disabled={changePasswordLoading}
                >
                  {changePasswordLoading ? "Updating..." : "Save & Continue"}
                  <Check size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}