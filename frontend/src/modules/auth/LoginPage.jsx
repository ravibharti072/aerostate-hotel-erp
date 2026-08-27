import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
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

      navigate("/dashboard");
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
              {/* Changed from white to gray */}
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
                {/* Changed from white to gray */}
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
    </div>
  );
}