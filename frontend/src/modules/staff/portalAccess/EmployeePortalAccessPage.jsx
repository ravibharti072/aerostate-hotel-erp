import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  KeyRound,
  Users,
  Search,
  Plus,
  RefreshCw,
  Building2,
  CheckCircle,
  AlertCircle,
  Edit,
  Hotel,
  Clock,
  Briefcase,
  UserCheck,
} from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import PortalHeader from "@components/headers/PortalHeader";
import StatCard from "@components/cards/StatCard";
import ModuleWriternHeader from "@components/headers/ModuleWriternHeader";
import EmployeePortalAccessModal, {
  DESIGNATION_OPTIONS,
  getDesignationForStaff,
  PORTAL_DEFINITIONS,
} from "./EmployeePortalAccessModal";
import { DEPARTMENT_OPTIONS } from "../directory/StaffDirectoryPage";
import "./portalAccess.css";

export default function EmployeePortalAccessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [staffData, setStaffData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleLevelFilter, setRoleLevelFilter] = useState("all"); // "all" | "department_head" | "employee"
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaffForModal, setSelectedStaffForModal] = useState(null);

  // Super Admin Multi-Hotel Support
  const [hotels, setHotels] = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState("");

  useEffect(() => {
    async function loadHotels() {
      if (user?.role === "super-admin") {
        try {
          const res = await api.get("/hotels");
          const list = Array.isArray(res.data) ? res.data : [];
          setHotels(list);
          if (list.length > 0 && !selectedHotelId) {
            setSelectedHotelId(String(list[0].id));
          }
        } catch (err) {
          console.error("Failed to load hotels list", err);
        }
      }
    }
    loadHotels();
  }, [user]);

  const effectiveHotelId = user?.role === "super-admin" ? selectedHotelId : user?.hotel_id;

  const fetchStaffStatus = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await api.get("/staff/unassigned-users", {
        params: effectiveHotelId ? { hotel_id: effectiveHotelId } : {},
      });
      setStaffData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load staff portal data:", err);
      setError("Failed to retrieve employee portal permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffStatus();
  }, [effectiveHotelId]);

  // Quick stats
  const stats = useMemo(() => {
    const total = staffData.length;
    const assigned = staffData.filter((s) => s.is_assigned).length;
    const unassigned = total - assigned;
    const hodCount = staffData.filter(
      (s) =>
        s.role_level === "department_head" ||
        s.user?.role_level === "department_head" ||
        (s.designation || "").toLowerCase().includes("head") ||
        (s.designation || "").toLowerCase().includes("manager")
    ).length;
    return {
      total,
      assigned,
      unassigned,
      hodCount,
    };
  }, [staffData]);

  // Filtered staff roster
  const filteredStaff = useMemo(() => {
    return staffData.filter((s) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        (s.full_name || "").toLowerCase().includes(search) ||
        (s.phone || "").includes(search) ||
        (s.user?.username || "").toLowerCase().includes(search) ||
        (s.department || "").toLowerCase().includes(search);

      const matchesDept =
        departmentFilter === "all" ||
        (s.department || "").toLowerCase() === departmentFilter.toLowerCase();

      const staffLevel = s.role_level || s.user?.role_level || "employee";
      const matchesLevel =
        roleLevelFilter === "all" ||
        (roleLevelFilter === "department_head" && staffLevel === "department_head") ||
        (roleLevelFilter === "employee" && staffLevel !== "department_head");

      const matchesAssignment =
        assignmentFilter === "all" ||
        (assignmentFilter === "assigned" && s.is_assigned) ||
        (assignmentFilter === "unassigned" && !s.is_assigned);

      return matchesSearch && matchesDept && matchesLevel && matchesAssignment;
    });
  }, [staffData, searchTerm, departmentFilter, roleLevelFilter, assignmentFilter]);

  const openModalForStaff = (staff) => {
    setSelectedStaffForModal(staff);
    setIsModalOpen(true);
  };

  const openNewAccessModal = () => {
    setSelectedStaffForModal(null);
    setIsModalOpen(true);
  };

  return (
    <div className="portal-access-page">
      {/* HEADER */}
      <PortalHeader
        title="Employee Designation & Access Management"
        kicker="SECURITY & ACCESS CONTROL"
        description="Assign department designation (HOD vs Staff) and manage hotel system login credentials."
        icon={ShieldCheck}
        backPath="/staff"
        rightAction={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {user?.role === "super-admin" && hotels.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "0 10px",
                  height: "38px",
                }}
              >
                <Building2 size={15} style={{ color: "#64748b" }} />
                <select
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                  value={selectedHotelId}
                  onChange={(e) => setSelectedHotelId(e.target.value)}
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.city ? `(${h.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="pa-btn-secondary"
              onClick={fetchStaffStatus}
              title="Refresh Access Data"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>

            <button className="pa-btn-primary" onClick={openNewAccessModal} style={{ backgroundColor: "#166962" }}>
              <Plus size={16} /> Assign Employee Access
            </button>
          </div>
        }
      />

      {error && (
        <div className="pa-alert pa-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* STATS GRID */}
      <div className="pa-stats-grid">
        <StatCard
          title="Total Staff Members"
          value={stats.total}
          Icon={Users}
          colorTheme="blue"
        />
        <StatCard
          title="Active Accounts"
          value={stats.assigned}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Pending Accounts"
          value={stats.unassigned}
          Icon={KeyRound}
          colorTheme="orange"
        />
        <StatCard
          title="Department Heads (HOD)"
          value={stats.hodCount}
          Icon={ShieldCheck}
          colorTheme="purple"
        />
      </div>

      {/* MODULE SECTION */}
      <section className="pa-modules-section">
        <ModuleWriternHeader
          title="Staff Designation & Access Roster"
          description="Manage assigned designations (HOD vs Staff) and operational login accounts across hotel departments."
          badgeCount={filteredStaff.length}
          badgeLabel="employees"
        />

        {/* CONTROLS */}
        <div className="pa-controls">
          <div className="pa-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by employee name, username, phone or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="pa-filter-group">
            <select
              className="pa-filter-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>

            <select
              className="pa-filter-select"
              value={roleLevelFilter}
              onChange={(e) => setRoleLevelFilter(e.target.value)}
            >
              <option value="all">All Role Levels</option>
              <option value="department_head">Department Heads (HOD)</option>
              <option value="employee">Staff / Technicians</option>
            </select>

            <select
              className="pa-filter-select"
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
            >
              <option value="all">All Account Statuses</option>
              <option value="assigned">Account Active</option>
              <option value="unassigned">Pending / Unassigned</option>
            </select>
          </div>
        </div>

        {/* ROSTER TABLE */}
        <div className="pa-table-container">
          <table className="pa-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department & Job Title</th>
                <th>Login Username</th>
                <th>Assigned Designation & Access</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading employee access permissions...
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    No employees matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const desig = getDesignationForStaff(staff);
                  const isHead =
                    staff.role_level === "department_head" ||
                    staff.user?.role_level === "department_head";

                  return (
                    <tr key={staff.id}>
                      {/* Employee Cell */}
                      <td>
                        <div className="pa-employee-cell">
                          <div className="pa-avatar">
                            {(staff.full_name || "S")[0].toUpperCase()}
                          </div>
                          <div className="pa-employee-details">
                            <span className="pa-employee-name">{staff.full_name}</span>
                            <span className="pa-employee-sub">
                              <span>Emp #{staff.id}</span>
                              <span>•</span>
                              <span>{staff.phone}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span className="pa-dept-badge">{staff.department}</span>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {staff.designation || "Staff"}
                          </span>
                        </div>
                      </td>

                      {/* Username */}
                      <td>
                        {staff.user ? (
                          <span style={{ fontWeight: "700", color: "#0f172a" }}>
                            @{staff.user.username}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "12px" }}>
                            Not provisioned
                          </span>
                        )}
                      </td>

                      {/* Designation & Access Role */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: "700",
                              color: "#0f172a",
                            }}
                          >
                            {desig.label}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "800",
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isHead ? "#fef3c7" : "#e0f2fe",
                              color: isHead ? "#b45309" : "#0369a1",
                              border: `1px solid ${isHead ? "#fcd34d" : "#bae6fd"}`,
                            }}
                          >
                            {isHead ? "HOD" : "Staff"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`pa-status-badge ${
                            staff.is_assigned
                              ? "pa-status-assigned"
                              : "pa-status-unassigned"
                          }`}
                        >
                          {staff.is_assigned ? "Account Active" : "Unassigned"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <button
                          className={`pa-action-btn ${
                            staff.is_assigned ? "edit-btn" : "create-btn"
                          }`}
                          onClick={() => openModalForStaff(staff)}
                        >
                          {staff.is_assigned ? (
                            <>
                              <Edit size={14} /> Edit Access
                            </>
                          ) : (
                            <>
                              <KeyRound size={14} /> Assign Access
                            </>
                          )}
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

      {/* MODAL */}
      <EmployeePortalAccessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialStaff={selectedStaffForModal}
        hotelId={effectiveHotelId}
        onSuccess={fetchStaffStatus}
      />
    </div>
  );
}
