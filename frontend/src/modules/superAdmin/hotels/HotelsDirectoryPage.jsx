import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Hotel,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  Edit,
  X,
  Save,
  Download,
  Calendar,
  Search,
  ShieldCheck,
  UserCheck,
  UserX
} from "lucide-react";
import api from "../../../api/api";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard";
import ModuleWriternHeader from "../../../components/ModuleWriternHeader";
import styles from "./HotelsDirectoryPage.module.css"; 

export default function HotelsDirectoryPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
    go_live_date: "", 
  });
  const [submitting, setSubmitting] = useState(false);

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
      go_live_date: fetchedGoLive,
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

  const combinedHotelData = hotels.map((hotel) => {
    const adminUser = users.find(
      (u) => u.hotel_id === hotel.id && u.role === "hotel-admin"
    );
    return {
      ...hotel,
      adminUser: adminUser || null,
    };
  });

  const filteredHotels = combinedHotelData.filter(hotel => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      (hotel?.name || "").toLowerCase().includes(search) || 
      (hotel?.owner_name || "").toLowerCase().includes(search) ||
      (hotel?.email || "").toLowerCase().includes(search);
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && hotel?.is_active) || 
      (statusFilter === "inactive" && !hotel?.is_active);

    return matchesSearch && matchesStatus;
  });

  function handleDownloadCSV() {
    if (!combinedHotelData.length) return;
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

  const directoryStats = useMemo(() => {
    return {
      total: combinedHotelData.length,
      active: combinedHotelData.filter(h => h.is_active).length,
      inactive: combinedHotelData.filter(h => !h.is_active).length,
    };
  }, [combinedHotelData]);

  return (
    <main className={styles["sa-main"]}>
      <PortalHeader 
        title="Hotel Directory" 
        kicker="PLATFORM MANAGEMENT"
        description="Complete directory of hotel properties, locations, contact details, and configurations."
        icon={Hotel} 
        backPath="/super-admin/dashboard"
        rightAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles["dir-add-btn"]} style={{ backgroundColor: '#4f46e5' }} onClick={handleDownloadCSV}>
              <Download size={18} /> Download CSV
            </button>
          </div>
        }
      />

      {error && <div className={styles["alert-error"]}>{error}</div>}
      {success && <div className={styles["alert-success"]}>{success}</div>}

      {/* STATS GRID */}
      <div className={styles["dir-stats-grid"]}>
        <StatCard title="Total Properties" value={directoryStats.total} Icon={Building2} colorTheme="blue" />
        <StatCard title="Active Properties" value={directoryStats.active} Icon={UserCheck} colorTheme="green" />
        <StatCard title="Inactive Properties" value={directoryStats.inactive} Icon={UserX} colorTheme="purple" />
        <StatCard title="System Status" value="Online" Icon={ShieldCheck} colorTheme="orange" />
      </div>

      <section className={styles["dir-modules-section"]}>
        <ModuleWriternHeader 
          title="Onboarded Hotels"
          description="View and configure standard information for all network properties."
          badgeCount={filteredHotels.length}
          badgeLabel="hotels"
        />

        {/* TOOLBAR */}
        <div className={styles["dir-controls"]}>
          <select className={styles["dir-filter-select"]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <div className={styles["dir-search-box"]}>
            <Search size={18} className={styles["search-icon"]} />
            <input 
              type="text" 
              placeholder="Search by hotel name, owner, or email..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        <div className={styles["dir-table-container"]}>
          <table className={styles["dir-table"]}>
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
              {loading ? (
                 <tr>
                   <td colSpan="7" className={styles["empty-state"]}>Loading directory...</td>
                 </tr>
              ) : filteredHotels.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles["empty-state"]}>
                    No hotels match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredHotels.map((item) => {
                  const isActive = item?.is_active;
                  return (
                    <tr key={item.id}>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["table-hotel-name"]}>
                          <Hotel size={16} className="color-blue" />
                          <div>
                            <strong>{item.name}</strong>
                            <span className={styles["staff-id"]}>ID: HOTEL-{item.id.toString().padStart(4, '0')}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["contact-info"]}>
                          <strong style={{ color: '#0f172a', fontSize: '13px' }}>{item.owner_name}</strong>
                          <span><Mail size={12} /> {item.email}</span>
                          <span><Phone size={12} /> {item.phone}</span>
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["location-info"]}>
                          <MapPin size={13} />
                          {item.city ? `${item.city}, ${item.country || ""}` : "Location N/A"}
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <span className={styles["department-badge"]}>{item.tax_number || "N/A"}</span>
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${isActive ? styles["status-active"] : styles["status-inactive"]}`}>
                          {isActive ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/A"}</td>
                      <td className={styles["actions-cell"]}>
                        <button
                          className={`${styles["action-btn"]} ${styles["edit-btn"]}`}
                          onClick={() => handleOpenEdit(item)}
                          title="Configure Hotel Details"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* EDIT CONFIGURATION MODAL */}
      {isEditing && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal-content"]} style={{ maxWidth: '650px' }}>
            <div className={styles["modal-header"]}>
              <h2>Configure Hotel (ID: {currentHotel?.id})</h2>
              <button className={styles["modal-close"]} onClick={handleCloseEdit}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateHotel}>
              <div className={styles["modal-body"]}>
                
                {/* Go-Live Configuration Banner */}
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', padding: '16px', borderRadius: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontWeight: '700', marginBottom: '6px', fontSize: '14px' }}>
                    <Calendar size={18} /> System Go-Live & Testing Cut-Off Date
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
                    Set the official software rollout date. Users will be locked out from viewing attendance/payroll prior to this date.
                  </p>
                  <input
                    type="date"
                    name="go_live_date"
                    value={editFormData.go_live_date}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #93c5fd', backgroundColor: 'white', fontWeight: '600', color: '#1e3a8a', outline: 'none' }}
                  />
                </div>

                <div className={styles["form-section-title"]}>Property Details</div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Hotel Name *</label>
                    <input type="text" name="name" value={editFormData.name} onChange={handleEditChange} required />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Owner Name *</label>
                    <input type="text" name="owner_name" value={editFormData.owner_name} onChange={handleEditChange} required />
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Official Email *</label>
                    <input type="email" name="email" value={editFormData.email} onChange={handleEditChange} required />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Phone Number *</label>
                    <input type="text" name="phone" value={editFormData.phone} onChange={handleEditChange} required />
                  </div>
                </div>

                <div className={styles["form-section-title"]}>Location & Billing</div>
                <div className={styles["form-group"]}>
                  <label>Street Address</label>
                  <input type="text" name="address" value={editFormData.address} onChange={handleEditChange} />
                </div>
                
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>City</label>
                    <input type="text" name="city" value={editFormData.city} onChange={handleEditChange} />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>State / Province</label>
                    <input type="text" name="state" value={editFormData.state} onChange={handleEditChange} />
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Country</label>
                    <input type="text" name="country" value={editFormData.country} onChange={handleEditChange} />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Tax Number / GST</label>
                    <input type="text" name="tax_number" value={editFormData.tax_number} onChange={handleEditChange} />
                  </div>
                </div>
              </div>

              <div className={styles["modal-footer"]}>
                <button type="button" className={styles["btn-cancel"]} onClick={handleCloseEdit}>Cancel</button>
                <button type="submit" className={styles["btn-submit"]} disabled={submitting}>
                  <Save size={16} />
                  {submitting ? "Saving Changes..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}