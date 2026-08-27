import { useEffect, useState } from "react";
import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  RotateCcwKey,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import api from "../../../api/api";
import "./users.css";

export default function HotelUsersPage() {
  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [createdCredential, setCreatedCredential] = useState(null);

  const [deleteUser, setDeleteUser] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [formData, setFormData] = useState({
    hotel_id: "",
    username: "",
    password: "",
    role: "hotel-admin",
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

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchHotels = async () => {
    try {
      setLoadingHotels(true);
      setError("");

      const response = await api.get("/hotels");
      setHotels(normalizeList(response.data, "hotels"));
    } catch (err) {
      console.error("Fetch hotels error:", err);
      setError(getApiErrorMessage(err, "Failed to load hotels."));
      setHotels([]);
    } finally {
      setLoadingHotels(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      setError("");

      const response = await api.get("/users");
      setUsers(normalizeList(response.data, "users"));
    } catch (err) {
      console.error("Fetch users error:", err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchHotels();
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getHotelName = (hotelId) => {
    const hotel = hotels.find((item) => Number(item.id) === Number(hotelId));
    return hotel?.name || "-";
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    try {
      setCreating(true);
      setError("");
      setSuccess("");
      setCreatedCredential(null);

      const selectedHotel = hotels.find(
        (hotel) => Number(hotel.id) === Number(formData.hotel_id)
      );

      const payload = {
        hotel_id: Number(formData.hotel_id),
        full_name:
          selectedHotel?.owner_name ||
          selectedHotel?.name ||
          formData.username.trim(),
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
      };

      await api.post("/auth/register-user", payload);

      setSuccess("Hotel user created successfully.");

      setCreatedCredential({
        hotel: selectedHotel?.name || "-",
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
      });

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      setFormData({
        hotel_id: "",
        username: "",
        password: "",
        role: "hotel-admin",
      });

      setShowPassword(false);
      await fetchUsers();
    } catch (err) {
      console.error("Create user error:", err);
      setError(getApiErrorMessage(err, "Failed to create hotel user."));
    } finally {
      setCreating(false);
    }
  };

  const openResetModal = (user) => {
    setResetUser(user);
    setNewPassword("");
    setShowNewPassword(false);
    setError("");
    setSuccess("");
  };

  const closeResetModal = () => {
    setResetUser(null);
    setNewPassword("");
    setShowNewPassword(false);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;

    if (!newPassword.trim()) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setResetting(true);
      setError("");
      setSuccess("");
      setCreatedCredential(null);

      await api.put(`/users/${resetUser.id}`, {
        password: newPassword,
      });

      setSuccess("Password updated successfully.");

      setCreatedCredential({
        hotel: getHotelName(resetUser.hotel_id),
        username: resetUser.username,
        password: newPassword,
        role: resetUser.role,
      });

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      closeResetModal();
      await fetchUsers();
    } catch (err) {
      console.error("Reset password error:", err);
      setError(getApiErrorMessage(err, "Failed to reset password."));
    } finally {
      setResetting(false);
    }
  };

  const openDeleteModal = (user) => {
    setDeleteUser(user);
    setDeletePassword("");
    setError("");
    setSuccess("");
  };

  const closeDeleteModal = () => {
    setDeleteUser(null);
    setDeletePassword("");
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    if (!deletePassword.trim()) {
      setError("Please enter password to confirm delete.");
      return;
    }

    if (deleteUser.role === "super-admin") {
      setError("Super admin user cannot be deleted from this screen.");
      closeDeleteModal();
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setSuccess("");

      await api.delete(`/users/${deleteUser.id}`, {
        data: {
          password: deletePassword,
        },
      });

      setSuccess("User deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      closeDeleteModal();
      await fetchUsers();
    } catch (err) {
      console.error("Delete user error:", err);
      setError(getApiErrorMessage(err, "Failed to delete user."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-content">
      <div className="users-page-header">
        <div className="page-title-row">
          <div className="page-icon">
            <Users size={22} />
          </div>

          <div>
            <h1>Hotel Users</h1>
            <p>Create and manage hotel users for registered hotels.</p>
          </div>
        </div>

        <button type="button" className="header-refresh-btn" onClick={fetchUsers}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      {createdCredential && (
        <div className="credential-box">
          <div className="credential-top">
            <div>
              <h3>
                <KeyRound size={18} />
                User Login Credential
              </h3>
              <p>
                Save this password now. For security, it will not be visible
                again after refresh.
              </p>
            </div>

            <button
              type="button"
              className="credential-close-btn"
              onClick={() => setCreatedCredential(null)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="credential-grid">
            <div>
              <span>Hotel</span>
              <strong>{createdCredential.hotel}</strong>
            </div>

            <div>
              <span>Username</span>
              <strong>{createdCredential.username}</strong>
            </div>

            <div>
              <span>Password</span>
              <strong>{createdCredential.password}</strong>
            </div>

            <div>
              <span>Role</span>
              <strong>{createdCredential.role}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="users-layout upgraded-users-layout">
        <div className="user-form-card upgraded-card">
          <div className="section-title">
            <div className="section-icon">
              <UserPlus size={18} />
            </div>

            <div>
              <h3>Create Hotel User</h3>
              <p>Add login access for hotel admin, manager, or front desk.</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser}>
            <div className="form-group">
              <label>Select Hotel</label>

              <div className="input-icon-wrap">
                <Building2 size={17} />

                <select
                  name="hotel_id"
                  value={formData.hotel_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    {loadingHotels ? "Loading hotels..." : "Select hotel"}
                  </option>

                  {hotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name} - {hotel.owner_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                placeholder="Enter login username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>

              <div className="password-input-row upgraded-password-row">
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
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="hotel-admin">Hotel Admin</option>
                <option value="front-desk">Front Desk</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <button type="submit" className="create-user-btn" disabled={creating}>
              <UserPlus size={17} />
              {creating ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>

        <div className="users-table-card upgraded-card">
          <div className="table-card-header upgraded-table-header">
            <div className="section-title compact">
              <div className="section-icon">
                <ShieldCheck size={18} />
              </div>

              <div>
                <h3>Platform Users</h3>
                <p>All users created under hotels.</p>
              </div>
            </div>

            <button type="button" onClick={fetchUsers}>
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>

          {loadingUsers ? (
            <div className="empty-state">
              <h4>Loading users...</h4>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <h4>No users found</h4>
              <p>Create your first hotel user using the form.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table upgraded-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Hotel</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>#{user.id}</td>

                      <td>
                        <strong>{user.username || "-"}</strong>
                      </td>

                      <td>
                        <span className={`role-pill ${user.role}`}>
                          {user.role || "-"}
                        </span>
                      </td>

                      <td>{getHotelName(user.hotel_id)}</td>

                      <td>
                        {user.role === "super-admin" ? (
                          <span className="protected-user">Protected</span>
                        ) : (
                          <div className="user-action-row">
                            <button
                              type="button"
                              className="reset-password-btn"
                              onClick={() => openResetModal(user)}
                            >
                              <RotateCcwKey size={15} />
                              Reset
                            </button>

                            <button
                              type="button"
                              className="delete-user-btn"
                              onClick={() => openDeleteModal(user)}
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {resetUser && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="reset-modal-icon">
              <RotateCcwKey size={24} />
            </div>

            <h3>Reset Password</h3>

            <p>
              Set a new password for user{" "}
              <strong>{resetUser.username}</strong>. The new password will be
              shown once after update.
            </p>

            <div className="form-group">
              <label>New Password</label>

              <div className="password-input-row upgraded-password-row">
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                >
                  {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="delete-modal-actions">
              <button type="button" onClick={closeResetModal}>
                Cancel
              </button>

              <button
                type="button"
                className="confirm-reset-btn"
                onClick={handleResetPassword}
                disabled={resetting}
              >
                <RotateCcwKey size={15} />
                {resetting ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="delete-modal-icon">
              <Trash2 size={24} />
            </div>

            <h3>Delete User</h3>

            <p>
              Are you sure you want to delete user{" "}
              <strong>{deleteUser.username}</strong>? This action cannot be
              undone.
            </p>

            <div className="form-group">
              <label>Enter Your Password to Confirm</label>
              <input
                type="password"
                placeholder="Enter password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>

            <div className="delete-modal-actions">
              <button type="button" onClick={closeDeleteModal}>
                Cancel
              </button>

              <button
                type="button"
                className="confirm-delete-btn"
                onClick={handleDeleteUser}
                disabled={deleting}
              >
                <Trash2 size={15} />
                {deleting ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}