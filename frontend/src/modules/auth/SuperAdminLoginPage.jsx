import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldAlert } from "lucide-react";
import "./login.css"; // Uses the same unified CSS file

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

      if (data.role !== "super-admin") {
        logout();
        setError("Only super admin can login from this page");
        return;
      }

      navigate("/super-admin/dashboard");
    } catch (error) {
      setError(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
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
          <h1>Aerostate Admin</h1>
          <p>
            Super admin access for managing hotels, users, system statistics and
            platform-level controls.
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
               <span>Super Admin Portal</span>
             </div>
          </div>

          <div className="login-card-body">
            <h2>System Admin</h2>
            <p className="subtitle">Restricted access for platform admins only.</p>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Super Admin ID</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    name="username"
                    placeholder="Enter super admin ID"
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
                {loading ? "Authenticating..." : "Admin Login"} <ArrowRight size={18} />
              </button>
            </form>
          </div>

          <div className="login-footer">
            <ShieldAlert size={16} /> This page is restricted to system administrators.
          </div>
        </div>
      </div>
    </div>
  );
}