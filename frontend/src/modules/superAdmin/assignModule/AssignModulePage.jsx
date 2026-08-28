import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCog,
  CheckSquare,
  Square,
  Building2,
  Save,
  Search,
  Download,
  X,
  Eye,
  ShieldCheck,
  UserCheck,
  UserX,
  Plus
} from "lucide-react";
import api from "../../../api/api";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard";
import ModuleWriternHeader from "../../../components/ModuleWriternHeader";
import styles from "./assignModule.module.css";

export default function AssignModulePage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [availableModules, setAvailableModules] = useState([]);
  const [assignedRecords, setAssignedRecords] = useState([]); 
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedModules, setSelectedModules] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", data: null });

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

  async function fetchInitialData() {
    try {
      setLoading(true);
      const [hotelsRes, modulesRes] = await Promise.all([
        api.get("/hotels").catch(() => ({ data: [] })),
        api.get("/modules").catch(() => ({ data: [] }))
      ]);

      const fetchedHotels = normalizeList(hotelsRes.data, "hotels");
      const fetchedModules = normalizeList(modulesRes.data, "modules");

      setHotels(fetchedHotels);
      setAvailableModules(fetchedModules);

      const overviewList = await Promise.all(
        fetchedHotels.map(async (hotel) => {
          try {
            const res = await api.get(`/hotels/${hotel.id}/modules`);
            const assignedMods = res.data?.modules || [];
            return {
              ...hotel,
              assignedModules: assignedMods,
              is_active: hotel.is_active ?? true
            };
          } catch {
            return {
              ...hotel,
              assignedModules: [],
              is_active: hotel.is_active ?? true
            };
          }
        })
      );
      setAssignedRecords(overviewList);

    } catch (err) {
      console.error("Failed to fetch initial data:", err);
      setError("Failed to load hotels or system modules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchHotelModules(hotelId) {
    try {
      const res = await api.get(`/hotels/${hotelId}/modules`);
      const assignedMods = res.data?.modules || [];
      
      const initialModules = {};
      availableModules.forEach((mod) => {
        const modKey = mod.id || mod.module_key || mod.name;
        initialModules[modKey] = assignedMods.includes(modKey); 
      });
      setSelectedModules(initialModules);
    } catch (err) {
      console.error("Failed to fetch assigned modules:", err);
      setError("Could not load hotel's current permissions.");
    }
  }

  const openAddModal = () => {
    setSelectedHotelId("");
    setSelectedModules({});
    setError("");
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError("");
    setSelectedHotelId("");
    setSelectedModules({});
    setIsViewMode(false);
  };

  const handleHotelSelectInModal = (e) => {
    const hotelId = e.target.value;
    setSelectedHotelId(hotelId);
    setError("");
    if (hotelId) {
      fetchHotelModules(hotelId);
    } else {
      setSelectedModules({});
    }
  };

  const handleViewClick = async (record) => {
    setSelectedHotelId(record.id);
    setError("");
    setIsViewMode(true);
    await fetchHotelModules(record.id);
    setIsModalOpen(true);
  };

  const handleEditClick = async (record) => {
    setSelectedHotelId(record.id);
    setError("");
    setIsViewMode(false);
    await fetchHotelModules(record.id);
    setIsModalOpen(true);
  };

  const handleToggleClick = (record) => {
    const isCurrentlyActive = record.is_active;
    setConfirmModal({
      isOpen: true,
      title: isCurrentlyActive ? "Deactivate Tenant Access" : "Reactivate Tenant Access",
      message: isCurrentlyActive ? `Deactivate module permissions for "${record.name}"?` : `Reactivate module permissions for "${record.name}"?`,
      data: { hotelId: record.id, newStatus: !isCurrentlyActive }
    });
  };

  const executeStatusToggle = async () => {
    if (!confirmModal.data) return;
    try {
      await api.put(`/hotels/${confirmModal.data.hotelId}`, { is_active: confirmModal.data.newStatus });
      fetchInitialData();
      setConfirmModal({ isOpen: false, title: "", message: "", data: null });
      setSuccess("Tenant status updated successfully.");
    } catch (err) {
      console.error("Status update error:", err);
      setError("Failed to update tenant status.");
    }
  };

  function toggleModule(modKey) {
    if (isViewMode) return;
    setSelectedModules((prev) => ({
      ...prev,
      [modKey]: !prev[modKey],
    }));
  }

  async function handleSaveModules(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedHotelId) {
      setError("Please select a hotel property first.");
      return;
    }

    try {
      setSubmitting(true);
      
      const modulesToSave = Object.keys(selectedModules).filter(
        (key) => selectedModules[key] === true
      );

      await api.put(`/hotels/${selectedHotelId}/modules`, { modules: modulesToSave }); 

      setSuccess("Module permissions updated successfully for the selected hotel!");
      closeModal();
      fetchInitialData();
    } catch (err) {
      console.error("Failed to update modules:", err);
      setError("Failed to save module configurations.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleDownloadData = () => {
    if (!assignedRecords.length) {
      alert("No assignment records available to download.");
      return;
    }

    const headers = ["ID", "Hotel Name", "Assigned Modules Count", "Status"];
    const rows = assignedRecords.map(r => [
      `HOTEL-${r.id.toString().padStart(4, '0')}`,
      `"${r.name || ''}"`,
      r.assignedModules?.length || 0,
      r.is_active ? "Active" : "Inactive"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `assigned_modules_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = assignedRecords.filter(record => {
    const search = searchTerm.toLowerCase();
    return (
      (record?.name || "").toLowerCase().includes(search) || 
      (record?.city || "").toLowerCase().includes(search)
    );
  });

  const assignmentStats = useMemo(() => {
    return {
      total: assignedRecords.length,
      active: assignedRecords.filter(r => r.is_active).length,
      fullyConfigured: assignedRecords.filter(r => r.assignedModules && r.assignedModules.length > 0).length,
      totalModulesAvailable: availableModules.length,
    };
  }, [assignedRecords, availableModules]);

  return (
    <main className={styles["sa-main"]}>
      <PortalHeader 
        title="Assign ERP Modules" 
        kicker="PLATFORM MANAGEMENT"
        description="Configure and manage module permissions for hotel tenants across the network."
        icon={UserCog} 
        backPath="/super-admin/dashboard"
        rightAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles["dir-add-btn"]} style={{ backgroundColor: '#4f46e5' }} onClick={handleDownloadData}>
              <Download size={18} /> Download Data
            </button>
            <button className={styles["dir-add-btn"]} onClick={openAddModal}>
              <Plus size={18} /> Assign Modules
            </button>
          </div>
        }
      />

      {error && <div className={styles["alert-error"]}>{error}</div>}
      {success && <div className={styles["alert-success"]}>{success}</div>}

      {/* STATS GRID */}
      <div className={styles["dir-stats-grid"]}>
        <StatCard title="Total Properties" value={assignmentStats.total} Icon={Building2} colorTheme="blue" />
        <StatCard title="Configured Tenants" value={assignmentStats.fullyConfigured} Icon={UserCheck} colorTheme="green" />
        <StatCard title="Active Status" value={assignmentStats.active} Icon={ShieldCheck} colorTheme="purple" />
        <StatCard title="Available Modules" value={assignmentStats.totalModulesAvailable} Icon={UserCog} colorTheme="orange" />
      </div>

      {/* MODULE SECTION */}
      <section className={styles["dir-modules-section"]}>
        <ModuleWriternHeader 
          title="Tenant Access Roster"
          description="View, sort, and update module access assignments for each property."
          badgeCount={filteredRecords.length}
          badgeLabel="tenants"
        />

        {/* TOOLBAR */}
        <div className={styles["dir-controls"]}>
          <select className={styles["dir-filter-select"]} disabled value="all">
            <option value="all">All Access Levels</option>
          </select>

          <div className={styles["dir-search-box"]}>
            <Search size={18} className={styles["search-icon"]} />
            <input 
              type="text" 
              placeholder="Search by hotel name or city..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className={styles["dir-table-container"]}>
          <table className={styles["dir-table"]}>
            <thead>
              <tr>
                <th>Hotel Property</th>
                <th>Location</th>
                <th>Assigned Modules</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className={styles["empty-state"]}>Loading assignments...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles["empty-state"]}>No properties match your search.</td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isActive = record?.is_active;
                  return (
                    <tr key={record.id}>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["table-hotel-name"]}>
                          <Building2 size={16} className="color-blue" />
                          <div>
                            <strong>{record.name}</strong>
                            <span className={styles["staff-id"]}>ID: HOTEL-{record.id.toString().padStart(4, '0')}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        {record.city ? `${record.city}, ${record.country || ""}` : "N/A"}
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <span className={styles["department-badge"]}>
                          {record.assignedModules?.length || 0} Modules Assigned
                        </span>
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${isActive ? styles["status-active"] : styles["status-inactive"]}`}>
                          {isActive ? <CheckSquare size={13} /> : <Square size={13} />}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={styles["actions-cell"]}>
                        <button className={`${styles["action-btn"]} ${styles["edit-btn"]}`} onClick={() => handleViewClick(record)} title="View Permissions">
                          <Eye size={16} />
                        </button>
                        <button className={`${styles["action-btn"]} ${styles["edit-btn"]}`} onClick={() => handleEditClick(record)} title="Edit Permissions">
                          <UserCog size={16} />
                        </button>
                        <button className={`${styles["action-btn"]} ${isActive ? styles["delete-btn"] : styles["reactivate-btn"]}`} onClick={() => handleToggleClick(record)} title={isActive ? "Deactivate" : "Reactivate"}>
                          {isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ASSIGN / EDIT / VIEW MODAL */}
      {isModalOpen && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal-content"]} style={{ maxWidth: "700px" }}>
            <div className={styles["modal-header"]}>
              <h2>{isViewMode ? "View Module Permissions" : selectedHotelId ? "Edit Module Permissions" : "Assign Modules to Tenant"}</h2>
              <button className={styles["modal-close"]} onClick={closeModal}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveModules}>
              <div className={styles["modal-body"]}>
                <div className={styles["form-group"]}>
                  <label>Select Target Hotel Property *</label>
                  <select
                    value={selectedHotelId}
                    onChange={handleHotelSelectInModal}
                    required
                    disabled={isViewMode || !!selectedHotelId}
                  >
                    <option value="">-- Choose Hotel Property --</option>
                    {hotels.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>
                        {hotel.name} (ID: {hotel.id}) - {hotel.city || "Global"}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedHotelId && (
                  <div className={styles["modules-container"]} style={{ marginTop: "16px" }}>
                    <div className={styles["form-section-title"]} style={{ marginBottom: "12px" }}>Available System Modules</div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", maxHeight: "350px", overflowY: "auto" }}>
                      {availableModules.length > 0 ? (
                        availableModules.map((mod) => {
                          const modKey = mod.id || mod.module_key || mod.name; 
                          const isChecked = !!selectedModules[modKey];
                          return (
                            <div
                              key={modKey}
                              onClick={() => toggleModule(modKey)}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "12px",
                                padding: "14px",
                                borderRadius: "10px",
                                border: isChecked ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                                background: isChecked ? "#eff6ff" : "#f8fafc",
                                cursor: isViewMode ? "default" : "pointer",
                                transition: "all 0.2s"
                              }}
                            >
                              <div style={{ marginTop: "2px" }}>
                                {isChecked ? (
                                  <CheckSquare size={18} color="#2563eb" />
                                ) : (
                                  <Square size={18} color="#94a3b8" />
                                )}
                              </div>
                              <div>
                                <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                                  {mod.name || mod.title || "Unnamed Module"}
                                </strong>
                                <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px" }}>
                                  {mod.description || "No description provided."}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p style={{ fontSize: "13px", color: "#64748b" }}>No modules found in the system.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles["modal-footer"]}>
                <button type="button" className={styles["btn-cancel"]} onClick={closeModal}>
                  {isViewMode ? "Close" : "Cancel"}
                </button>
                {isViewMode ? (
                  <button type="button" className={styles["btn-submit"]} onClick={() => setIsViewMode(false)}>
                    Edit Permissions
                  </button>
                ) : (
                  <button type="submit" className={styles["btn-submit"]} disabled={submitting || availableModules.length === 0 || !selectedHotelId}>
                    <Save size={16} />
                    {submitting ? "Saving Access..." : "Save Module Permissions"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["confirm-modal-content"]}>
            <div className={styles["modal-header"]} style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <h2>{confirmModal.title}</h2>
              <button className={styles["modal-close"]} onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}><X size={20} /></button>
            </div>
            <div className={styles["modal-body"]} style={{ textAlign: 'center', padding: '10px 24px', fontSize: '14px', color: '#475569' }}>
              <p>{confirmModal.message}</p>
            </div>
            <div className={styles["modal-footer"]} style={{ borderTop: 'none', backgroundColor: 'transparent' }}>
              <button className={styles["btn-cancel"]} onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancel</button>
              <button className={`${styles["btn-submit"]} ${styles["btn-danger"]}`} onClick={executeStatusToggle}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}