import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Plus,
  X,
  UserCheck,
  Calendar,
  ClipboardList,
  ArrowRight,
  RotateCw,
  SlidersHorizontal,
  Check,
  Building,
  Phone,
  Layers,
  Package,
  Boxes,
  Activity,
  AlertOctagon,
  ShieldAlert,
  BedDouble,
  User,
  Info,
  CalendarClock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCheck,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard } from "@components";
import styles from "./maintenanceDashboard.module.css";

const CATEGORIES = [
  "AC / HVAC",
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance",
  "Elevator",
  "Generator",
  "Painting",
  "General",
  "Other",
];

const PRIORITIES = ["urgent", "high", "normal", "low"];

export default function MaintenanceDashboard({
  isEmbedded = false,
  viewMode = "standalone",
  showBack = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmbeddedView = isEmbedded || viewMode === "embedded";

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
  };

  // Core Data States from Backend Server
  const [dashboardData, setDashboardData] = useState(null);
  const [requestsList, setRequestsList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [techniciansList, setTechniciansList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState("priority");
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showAllTechs, setShowAllTechs] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);

  // Modals
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    room_id: "",
    category: "AC / HVAC",
    priority: "normal",
    blocks_room: false,
    issue_title: "",
    issue_description: "",
    estimated_cost: 0,
  });

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({
    request_id: "",
    assigned_staff_id: "",
    remarks: "",
    issue_title: "",
    room_number: "",
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getApiErrorMessage = (err, fallbackMessage = "Request failed") => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((i) => `${i.loc?.join(".") || ""}: ${i.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  };

  const filterByHotel = (list) => {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;
    return list.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId));
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  // Fetch Original Data Directly from Backend Server
  const loadBackendData = async () => {
    try {
      setLoading(true);
      setError(null);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [summaryRes, requestsRes, roomsRes, techRes] = await Promise.allSettled([
        api.get("/maintenance/dashboard/summary", { params }).catch(() => ({ data: null })),
        api.get("/maintenance-requests/", { params }).catch(() => ({ data: [] })),
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
        api.get("/maintenance/technicians", { params }).catch(() => ({ data: [] })),
      ]);

      const rawSummary = summaryRes.value?.data || null;
      let rawRequests = normalizeList(requestsRes.value?.data, "items");
      if (!rawRequests || rawRequests.length === 0) {
        rawRequests = normalizeList(requestsRes.value?.data, "requests");
      }
      if (!rawRequests || rawRequests.length === 0) {
        rawRequests = rawSummary?.active_requests || [];
      }

      const rawRooms = filterByHotel(normalizeList(roomsRes.value?.data, "rooms"));
      let rawTechs = normalizeList(techRes.value?.data, "staff");
      if (!rawTechs || rawTechs.length === 0) {
        rawTechs = normalizeList(techRes.value?.data, "technicians");
      }
      if (!rawTechs || rawTechs.length === 0) {
        const staffRes = await api.get("/staff", { params }).catch(() => ({ data: [] }));
        rawTechs = filterByHotel(normalizeList(staffRes.data, "staff"));
      }

      setDashboardData(rawSummary);
      setRequestsList(rawRequests);
      setRoomsList(rawRooms);
      setTechniciansList(rawTechs);
    } catch (err) {
      console.error("Maintenance dashboard load error:", err);
      setError(getApiErrorMessage(err, "Failed to load maintenance operations data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackendData();
  }, [user]);

  // -------------------------------------------------------------
  // Computed Metrics & Stats
  // -------------------------------------------------------------
  const kpis = useMemo(() => {
    if (dashboardData?.kpis) {
      return dashboardData.kpis;
    }
    const total_active = requestsList.filter(
      (r) => !["completed", "verified", "closed", "cancelled"].includes((r.status || "").toLowerCase())
    ).length;
    const in_progress = requestsList.filter((r) =>
      ["in-progress", "in_progress"].includes((r.status || "").toLowerCase())
    ).length;
    const rooms_under_maintenance = roomsList.filter(
      (r) => (r.status || "").toLowerCase() === "maintenance"
    ).length;
    const completed_today = requestsList.filter((r) =>
      ["completed", "verified", "closed"].includes((r.status || "").toLowerCase())
    ).length;

    return {
      total_active,
      in_progress,
      rooms_under_maintenance,
      completed_today,
      total_all_time: requestsList.length,
      open_requests: requestsList.filter((r) => ["open", "assigned"].includes((r.status || "").toLowerCase())).length,
      critical_issues: requestsList.filter(
        (r) => ["urgent", "high"].includes((r.priority || "").toLowerCase()) || Boolean(r.blocks_room)
      ).length,
    };
  }, [dashboardData, requestsList, roomsList]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const list = requestsList;
    return {
      all: list.length,
      open: list.filter((r) => ["open", "assigned"].includes((r.status || "open").toLowerCase())).length,
      in_progress: list.filter((r) => ["in-progress", "in_progress"].includes((r.status || "").toLowerCase())).length,
      pending_parts: list.filter((r) => (r.status || "").toLowerCase() === "pending_parts").length,
      blocked: list.filter((r) => Boolean(r.blocks_room)).length,
      completed: list.filter((r) => ["completed", "verified", "closed"].includes((r.status || "").toLowerCase())).length,
    };
  }, [requestsList]);

  // Filtering & Sorting Requests
  const filteredRequests = useMemo(() => {
    let result = [...requestsList];

    if (activeTab === "open") {
      result = result.filter((r) => ["open", "assigned"].includes((r.status || "open").toLowerCase()));
    } else if (activeTab === "in_progress") {
      result = result.filter((r) => ["in-progress", "in_progress"].includes((r.status || "").toLowerCase()));
    } else if (activeTab === "pending_parts") {
      result = result.filter((r) => (r.status || "").toLowerCase() === "pending_parts");
    } else if (activeTab === "blocked") {
      result = result.filter((r) => Boolean(r.blocks_room));
    } else if (activeTab === "completed") {
      result = result.filter((r) => ["completed", "verified", "closed"].includes((r.status || "").toLowerCase()));
    }

    if (categoryFilter !== "all") {
      result = result.filter((r) => (r.category || "").toLowerCase() === categoryFilter.toLowerCase());
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          (r.issue_title || "").toLowerCase().includes(q) ||
          String(r.room_number || "").toLowerCase().includes(q) ||
          (r.assigned_staff_name || "").toLowerCase().includes(q) ||
          (r.asset_name || "").toLowerCase().includes(q) ||
          (r.category || "").toLowerCase().includes(q) ||
          String(r.id || "").includes(q)
      );
    }

    if (sortMode === "priority") {
      const order = { urgent: 1, high: 2, normal: 3, medium: 3, low: 4 };
      result.sort(
        (a, b) =>
          (order[(a.priority || "normal").toLowerCase()] || 3) -
          (order[(b.priority || "normal").toLowerCase()] || 3)
      );
    } else if (sortMode === "room_asc") {
      result.sort((a, b) => (Number(a.room_number) || 9999) - (Number(b.room_number) || 9999));
    } else if (sortMode === "status") {
      result.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
    } else if (sortMode === "newest") {
      result.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return result;
  }, [requestsList, activeTab, categoryFilter, searchText, sortMode]);

  // Short list: defaults to 5 requests, expandable to all
  const displayedRequests = useMemo(() => {
    return showAllRequests ? filteredRequests : filteredRequests.slice(0, 5);
  }, [filteredRequests, showAllRequests]);

  // -------------------------------------------------------------
  // Technician Workload Data
  // -------------------------------------------------------------
  const technicianWorkload = useMemo(() => {
    if (dashboardData?.technician_workload && dashboardData.technician_workload.length > 0) {
      return dashboardData.technician_workload.map((t) => {
        const initials = (t.full_name || "TC")
          .split(" ")
          .map((p) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return {
          ...t,
          id: t.staff_id,
          name: t.full_name,
          initials,
          trade: t.designation || "Maintenance Staff",
        };
      });
    }

    if (techniciansList.length > 0) {
      return techniciansList.map((tech) => {
        const assigned = requestsList.filter((r) => r.assigned_staff_id === tech.id);
        const active = assigned.filter(
          (r) => !["completed", "verified", "closed"].includes((r.status || "").toLowerCase())
        ).length;
        const highPri = assigned.filter((r) =>
          ["urgent", "high"].includes((r.priority || "").toLowerCase())
        ).length;
        const parts = assigned.filter((r) => (r.status || "").toLowerCase() === "pending_parts").length;

        let status_label = "Available";
        if (active > 3) status_label = "Heavy Load";
        else if (active > 0) status_label = "Active";

        const initials = (tech.full_name || "TC")
          .split(" ")
          .map((p) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return {
          id: tech.id,
          staff_id: tech.id,
          name: tech.full_name,
          initials,
          trade: tech.designation || tech.department || "Technician",
          phone: tech.phone || "+91 98000 00000",
          active_jobs: active,
          high_priority: highPri,
          waiting_parts: parts,
          overdue: 0,
          workload_status: status_label,
        };
      });
    }

    return [];
  }, [dashboardData, techniciansList, requestsList]);

  // Displayed Technicians: Max 10 with toggle
  const displayedTechnicians = useMemo(() => {
    return showAllTechs ? technicianWorkload : technicianWorkload.slice(0, 10);
  }, [technicianWorkload, showAllTechs]);

  // Technician KPI Summary Strip
  const staffSummary = useMemo(() => {
    const totalStaff = technicianWorkload.length;
    const totalAssigned = technicianWorkload.reduce((acc, t) => acc + (t.active_jobs || 0), 0);
    const resolvedCount = requestsList.filter((r) =>
      ["completed", "verified", "closed"].includes((r.status || "").toLowerCase())
    ).length;
    const totalAll = requestsList.length;
    const resolutionRate = totalAll > 0 ? Math.round((resolvedCount / totalAll) * 100) : 100;

    return { totalStaff, totalAssigned, resolutionRate };
  }, [technicianWorkload, requestsList]);

  // -------------------------------------------------------------
  // Priority & Critical Queue
  // -------------------------------------------------------------
  const priorityQueue = useMemo(() => {
    if (dashboardData?.critical_issues && dashboardData.critical_issues.length > 0) {
      return dashboardData.critical_issues.slice(0, 5);
    }
    const critical = requestsList.filter(
      (r) =>
        ["urgent", "high"].includes((r.priority || "").toLowerCase()) ||
        Boolean(r.blocks_room)
    );
    if (critical.length > 0) return critical.slice(0, 5);
    return requestsList.slice(0, 4);
  }, [dashboardData, requestsList]);

  // -------------------------------------------------------------
  // Operations Audit Log
  // -------------------------------------------------------------
  const recentActivities = useMemo(() => {
    if (dashboardData?.recent_activity && dashboardData.recent_activity.length > 0) {
      return dashboardData.recent_activity.slice(0, 6);
    }
    return requestsList.slice(0, 6).map((r) => {
      const roomStr = r.room_number ? `Room ${r.room_number}` : r.asset_name || "Facility";
      return {
        id: r.id,
        room_number: roomStr,
        action: `Reported issue: ${r.issue_title}`,
        actor: r.assigned_staff_name || r.reported_by || "Maintenance Staff",
        time_formatted: r.age_formatted || "Recently",
        status: r.status || "open",
        priority: r.priority || "normal",
      };
    });
  }, [dashboardData, requestsList]);

  // -------------------------------------------------------------
  // Floor / Area Maintenance Readiness
  // -------------------------------------------------------------
  const areaProgressData = useMemo(() => {
    const floorSet = Array.from(new Set(roomsList.map((r) => String(r.floor || "1")))).sort();
    if (floorSet.length === 0) {
      return [
        { id: "1", name: "Floor 1 • East Wing", total: 4, operational: 4, inRepair: 0, blocked: 0, pctReady: 100 },
      ];
    }

    return floorSet.map((floorNum) => {
      const floorRooms = roomsList.filter((r) => String(r.floor) === String(floorNum));
      const total = floorRooms.length || 1;
      const blockedRooms = floorRooms.filter(
        (r) =>
          (r.status || "").toLowerCase() === "maintenance" ||
          requestsList.some((req) => req.room_id === r.id && req.blocks_room)
      ).length;
      const inRepair = requestsList.filter(
        (req) =>
          floorRooms.some((rm) => rm.id === req.room_id) &&
          ["in-progress", "in_progress"].includes((req.status || "").toLowerCase())
      ).length;
      const operational = Math.max(0, total - blockedRooms);
      const pctReady = Math.round((operational / total) * 100);

      return {
        id: floorNum,
        name: `Floor ${floorNum} • Wing ${
          floorNum === "1" ? "East" : floorNum === "2" ? "West" : "Garden View"
        }`,
        total,
        operational,
        inRepair,
        blocked: blockedRooms,
        pctReady,
      };
    });
  }, [roomsList, requestsList]);

  // Displayed Areas: Max 4 with toggle
  const displayedAreas = useMemo(() => {
    return showAllAreas ? areaProgressData : areaProgressData.slice(0, 4);
  }, [areaProgressData, showAllAreas]);

  // Differential Data: Category & Trade Readiness Matrix (Eliminates Blank Space)
  const categoryReadiness = useMemo(() => {
    const availableCategories = CATEGORIES.slice(0, 6);
    return availableCategories.map((cat) => {
      const catReqs = requestsList.filter((r) => (r.category || "").toLowerCase() === cat.toLowerCase());
      const total = catReqs.length;
      const resolved = catReqs.filter((r) =>
        ["completed", "verified", "closed"].includes((r.status || "").toLowerCase())
      ).length;
      const active = total - resolved;
      const pctHealthy = total > 0 ? Math.round((resolved / total) * 100) : 100;

      return {
        category: cat,
        total,
        active,
        resolved,
        pctHealthy,
      };
    });
  }, [requestsList]);

  // -------------------------------------------------------------
  // Backend Connected Actions
  // -------------------------------------------------------------
  const handleMarkCompleted = async (request) => {
    try {
      await api.put(`/maintenance-requests/${request.id}`, {
        status: "completed",
        remarks: "Marked resolved via Maintenance command center",
      });

      showToast(`Request #${request.id} marked completed and room released.`);
      await loadBackendData();
    } catch (err) {
      console.error("Mark completed error:", err);
      showToast(getApiErrorMessage(err, "Failed to resolve maintenance request."), "error");
    }
  };

  const handleMarkInProgress = async (request) => {
    try {
      await api.put(`/maintenance-requests/${request.id}`, {
        status: "in-progress",
      });

      showToast(`Request #${request.id} marked in-progress.`);
      await loadBackendData();
    } catch (err) {
      console.error("Mark in progress error:", err);
      showToast(getApiErrorMessage(err, "Failed to update maintenance status."), "error");
    }
  };

  const handleOpenAssignModal = (request) => {
    setAssignForm({
      request_id: request.id,
      assigned_staff_id: request.assigned_staff_id || (techniciansList[0]?.id || ""),
      remarks: request.remarks || "",
      issue_title: request.issue_title || "",
      room_number: request.room_number || "",
    });
    setIsAssignModalOpen(true);
  };

  const handleSaveAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.assigned_staff_id) {
      showToast("Please select a technician.", "error");
      return;
    }

    try {
      setSubmittingAssign(true);
      await api.put(`/maintenance-requests/${assignForm.request_id}`, {
        assigned_staff_id: Number(assignForm.assigned_staff_id),
        status: "assigned",
        remarks: assignForm.remarks,
      });

      showToast("Technician assigned successfully.");
      setIsAssignModalOpen(false);
      await loadBackendData();
    } catch (err) {
      console.error("Assign technician error:", err);
      showToast(getApiErrorMessage(err, "Failed to assign technician."), "error");
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleOpenRaiseModal = (initialRoomId = "") => {
    setRequestForm({
      room_id: initialRoomId || (roomsList[0]?.id ? String(roomsList[0].id) : ""),
      category: "AC / HVAC",
      priority: "normal",
      blocks_room: false,
      issue_title: "",
      issue_description: "",
      estimated_cost: 0,
    });
    setIsRaiseModalOpen(true);
  };

  const handleSaveRaiseRequest = async (e) => {
    e.preventDefault();
    if (!requestForm.issue_title.trim()) {
      showToast("Please enter an issue title.", "error");
      return;
    }

    try {
      setSubmittingRequest(true);
      const hotelId = getLoggedInHotelId();
      const payload = {
        hotel_id: hotelId,
        room_id: requestForm.room_id ? Number(requestForm.room_id) : null,
        category: requestForm.category,
        priority: requestForm.priority,
        blocks_room: Boolean(requestForm.blocks_room),
        issue_title: requestForm.issue_title.trim(),
        issue_description: requestForm.issue_description.trim(),
        estimated_cost: Number(requestForm.estimated_cost) || 0,
        source: "Direct",
      };

      await api.post("/maintenance-requests/", payload);
      showToast("Maintenance request logged successfully.");
      setIsRaiseModalOpen(false);
      await loadBackendData();
    } catch (err) {
      console.error("Submit request error:", err);
      showToast(getApiErrorMessage(err, "Failed to create maintenance request."), "error");
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div
      className={`${styles["maint-dashboard-container"]} ${
        isEmbeddedView ? styles["embedded-view"] : ""
      }`}
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`${styles["toast-banner"]} ${styles[toast.type]}`}>
          <Check size={16} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* -------------------------------------------------------------
          1. HEADER & QUICK ACTIONS
          ------------------------------------------------------------- */}
      <PortalHeader
        title="Maintenance Operations"
        kicker="PMS DEPARTMENT COMMAND CENTER"
        description="Manage property repairs, work orders, technician workload, critical equipment and facility readiness."
        icon={Wrench}
        isDashboard={true}
        showBack={viewMode === "standalone" && showBack}
        backPath="/dashboard"
        rightAction={
          <div className={styles["header-actions-group"]}>
            <button
              type="button"
              onClick={() => navigate("/maintenance/preventive")}
              className={styles["secondary-header-btn"]}
              title="View preventive maintenance schedules"
            >
              <CalendarClock size={15} />
              Preventive Maintenance
            </button>
            <button
              type="button"
              onClick={() => navigate("/maintenance/requests")}
              className={styles["secondary-header-btn"]}
              title="View all requests directory"
            >
              <Boxes size={15} />
              All Requests
            </button>
            <button
              type="button"
              onClick={() => handleOpenRaiseModal()}
              className={styles["primary-header-btn"]}
            >
              <Plus size={16} />
              Raise Request
            </button>
          </div>
        }
      />

      {/* -------------------------------------------------------------
          2. TOP KPI SECTION (4 Unified Metric Cards)
          ------------------------------------------------------------- */}
      <div className={styles["stats-grid"]}>
        <StatCard
          title="Active Requests"
          value={`${kpis.total_active || 0}`}
          subtitle="Open & pending jobs"
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="In Progress Repairs"
          value={`${kpis.in_progress || 0}`}
          subtitle="Active technician jobs"
          Icon={Wrench}
          colorTheme="amber"
        />
        <StatCard
          title="Rooms in Maintenance"
          value={`${kpis.rooms_under_maintenance || 0}`}
          subtitle="Blocked from inventory"
          Icon={BedDouble}
          colorTheme="purple"
        />
        <StatCard
          title="Resolved Today"
          value={`${kpis.completed_today || 0}`}
          subtitle="Turned over / resolved"
          Icon={CheckCircle2}
          colorTheme="green"
        />
      </div>

      {/* -------------------------------------------------------------
          3. MAIN OPERATIONS TABLE / ACTIVE MAINTENANCE LIST
          ------------------------------------------------------------- */}
      <div className={styles["operations-card"]}>
        <div className={styles["card-header-between"]}>
          <div>
            <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Wrench size={18} color="#0284c7" />
              Active Maintenance & Repair Operations
            </h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Live directory of reported faults, technician assignments, room blocks and resolution status
            </span>
          </div>
          <span className={styles["card-badge-muted"]}>
            {filteredRequests.length} Requests Live
          </span>
        </div>

        {/* 4. STATUS FILTER STRIP */}
        <div className={styles["status-filter-strip"]}>
          <div
            className={`${styles["status-chip"]} ${activeTab === "all" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span>All Requests</span>
            <span className={styles["status-chip-count"]}>{tabCounts.all}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "open" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("open")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#2563eb" }} />
            <span>Open / Unassigned</span>
            <span className={styles["status-chip-count"]}>{tabCounts.open}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "in_progress" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("in_progress")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#0d9488" }} />
            <span>In Progress</span>
            <span className={styles["status-chip-count"]}>{tabCounts.in_progress}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "pending_parts" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("pending_parts")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#ea580c" }} />
            <span>Waiting Parts</span>
            <span className={styles["status-chip-count"]}>{tabCounts.pending_parts}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "blocked" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("blocked")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#dc2626" }} />
            <span>Rooms Blocked</span>
            <span className={styles["status-chip-count"]}>{tabCounts.blocked}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "completed" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("completed")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#10b981" }} />
            <span>Resolved</span>
            <span className={styles["status-chip-count"]}>{tabCounts.completed}</span>
          </div>
        </div>

        {/* 5. CONTROLS BAR: SEARCH, CATEGORY, SORT & RESET */}
        <div className={styles["controls-bar"]}>
          <div className={styles["search-box"]}>
            <Search size={15} className={styles["search-icon"]} />
            <input
              type="text"
              placeholder="Search by room, issue, category, or technician..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={styles["search-input"]}
            />
          </div>

          <div className={styles["action-tools-group"]}>
            <div className={styles["select-wrapper"]}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={styles["control-select"]}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles["select-wrapper"]}>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className={styles["control-select"]}
              >
                <option value="priority">Highest Priority First</option>
                <option value="room_asc">Room Number (Asc)</option>
                <option value="newest">Newest Reported</option>
                <option value="status">Status Grouping</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setCategoryFilter("all");
                setSortMode("priority");
                setActiveTab("all");
              }}
              className={styles["btn-secondary"]}
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 6. DATA TABLE / ACTIVE REQUEST LIST */}
        <div className={styles["table-card"]}>
          <div className={styles["table-scroll-wrap"]}>
            <table className={styles["data-table"]}>
              <thead>
                <tr>
                  <th style={{ minWidth: "170px" }}>Issue & Location</th>
                  <th style={{ minWidth: "210px" }}>Assigned Technician & Trade</th>
                  <th style={{ minWidth: "170px" }}>Status & Inventory</th>
                  <th style={{ minWidth: "140px" }}>Priority & Timing</th>
                  <th style={{ minWidth: "140px" }}>Parts & Cost</th>
                  <th style={{ minWidth: "190px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className={styles["empty-state"]}>
                      Loading original maintenance records from server...
                    </td>
                  </tr>
                ) : displayedRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles["empty-state"]}>
                      No maintenance records found matching current filters.
                    </td>
                  </tr>
                ) : (
                  displayedRequests.map((req) => {
                    const isClosed = ["completed", "verified", "closed"].includes((req.status || "").toLowerCase());
                    const isInProg = ["in-progress", "in_progress"].includes((req.status || "").toLowerCase());
                    const isParts = (req.status || "").toLowerCase() === "pending_parts";

                    const initials = (req.assigned_staff_name || "TC")
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr key={req.id}>
                        {/* 1. Issue & Location */}
                        <td>
                          <div className={styles["room-badge-wrap"]}>
                            <div className={styles["room-icon-box"]}>
                              {req.room_number ? <BedDouble size={16} /> : <Package size={16} />}
                            </div>
                            <div>
                              <div className={styles["room-num-text"]}>
                                {req.room_number ? `Room ${req.room_number}` : req.asset_name || "Facility"}
                              </div>
                              <div className={styles["room-sub-meta"]}>
                                {req.issue_title} • {req.category}
                              </div>
                              <span className={styles["req-id-code"]}>
                                MR-#{req.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Assigned Technician */}
                        <td>
                          <div className={styles["tech-wrap"]}>
                            <div className={styles["tech-avatar"]}>
                              {initials}
                            </div>
                            <div>
                              <div className={styles["tech-name"]}>
                                {req.assigned_staff_name || "Unassigned"}
                              </div>
                              <div className={styles["tech-shift"]}>
                                {req.category} Specialist
                              </div>
                              <div className={styles["tech-phone"]}>
                                <Phone size={10} />
                                {req.reported_by || "Front Desk / PMS"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Status & Inventory Block */}
                        <td>
                          <div>
                            <span
                              className={`${styles["status-pill"]} ${
                                isClosed
                                  ? styles["completed"]
                                  : isInProg
                                  ? styles["in-progress"]
                                  : isParts
                                  ? styles["pending-parts"]
                                  : req.assigned_staff_name !== "Unassigned"
                                  ? styles["assigned"]
                                  : styles["open"]
                              }`}
                            >
                              {isClosed && <Check size={11} />}
                              {isInProg && <Wrench size={11} />}
                              {isParts && <Clock size={11} />}
                              {!isClosed && !isInProg && !isParts && <RotateCw size={11} />}
                              {req.status || "open"}
                            </span>
                            {req.blocks_room && (
                              <span className={styles["status-pill"]["blocked-pill"] || styles["blocked-tag"]}>
                                BLOCKED
                              </span>
                            )}
                            <span className={styles["occupancy-tag"]}>
                              {req.guest_name ? `Guest: ${req.guest_name}` : req.blocks_room ? "Room Out of Service" : "Available"}
                            </span>
                          </div>
                        </td>

                        {/* 4. Priority & Timing */}
                        <td>
                          <div>
                            <span
                              className={`${styles["priority-badge"]} ${
                                styles[req.priority?.toLowerCase()] || styles["normal"]
                              }`}
                            >
                              {req.priority || "NORMAL"}
                            </span>
                            <div className={styles["age-text"]}>
                              <Clock size={11} />
                              {req.age_formatted || "Today"}
                            </div>
                          </div>
                        </td>

                        {/* 5. Parts & Cost */}
                        <td>
                          <div>
                            <div className={styles["parts-tag"]}>
                              {isParts ? (
                                <span className={styles["parts-waiting"]}>Parts Required</span>
                              ) : (
                                <span>Parts In Stock</span>
                              )}
                            </div>
                            <div className={styles["cost-text"]}>
                              Est: ₹{req.estimated_cost || 0}
                            </div>
                          </div>
                        </td>

                        {/* 6. Actions */}
                        <td>
                          <div className={styles["row-actions-group"]}>
                            {!isClosed && (
                              <button
                                type="button"
                                onClick={() => handleMarkCompleted(req)}
                                className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                                title="Mark repair completed and release room"
                              >
                                <Check size={12} />
                                Resolve
                              </button>
                            )}

                            {!isClosed && !isInProg && (
                              <button
                                type="button"
                                onClick={() => handleMarkInProgress(req)}
                                className={`${styles["action-pill-btn"]} ${styles["approve"]}`}
                                title="Start repair work"
                              >
                                <Wrench size={11} />
                                Start
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(req)}
                              className={styles["action-pill-btn"]}
                              style={{ background: "#f1f5f9", color: "#475569" }}
                              title="Assign or reassign technician"
                            >
                              Assign
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Bar: Pagination info + Toggle All/Short list */}
          <div className={styles["table-bottom-bar"]}>
            <div className={styles["table-pagination-info"]}>
              Showing {displayedRequests.length} of {filteredRequests.length} requests (Total: {requestsList.length} requests)
            </div>
            {filteredRequests.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllRequests((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllRequests ? (
                  <>
                    <ChevronUp size={14} />
                    Show Less (Top 5 Requests)
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    View All Requests ({filteredRequests.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          7. DIRECT DASHBOARD BELOW LIST (2-Column Auxiliary Widgets)
          ------------------------------------------------------------- */}

      {/* ROW 1: Technician Workload + Operations Audit Log */}
      <div className={styles["two-col-grid"]}>
        {/* Left Column: Maintenance Staff & Technician Workload */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserCheck size={16} color="#0284c7" />
                Maintenance Staff & Technician Workload
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Live duty status and work order distribution across repair technicians
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {technicianWorkload.length} Techs Active
            </span>
          </div>

          {/* Quick Staff KPI Summary Strip */}
          <div className={styles["staff-kpi-strip"]}>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Active Roster</span>
              <span className={styles["staff-kpi-val"]}>{staffSummary.totalStaff} Techs</span>
            </div>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Assigned Tasks</span>
              <span className={styles["staff-kpi-val"]}>{staffSummary.totalAssigned} Jobs</span>
            </div>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Resolution Rate</span>
              <span
                className={styles["staff-kpi-val"]}
                style={{ color: staffSummary.resolutionRate >= 75 ? "#10b981" : "#0284c7" }}
              >
                {staffSummary.resolutionRate}% Resolved
              </span>
            </div>
          </div>

          <div className={styles["tech-cards-grid"]}>
            {displayedTechnicians.map((tech) => {
              const statusClass =
                tech.workload_status === "Available"
                  ? styles["available"]
                  : tech.workload_status === "Active"
                  ? styles["active"]
                  : styles["heavy"];

              const pct = tech.active_jobs > 0 ? Math.min(100, Math.round((tech.active_jobs / 4) * 100)) : 15;

              return (
                <div key={tech.id} className={styles["tech-card"]}>
                  <div className={styles["tech-header"]}>
                    <div className={styles["tech-profile"]}>
                      <div className={styles["tech-avatar"]}>{tech.initials}</div>
                      <div>
                        <div className={styles["tech-name"]}>{tech.name}</div>
                        <div className={styles["tech-shift"]}>{tech.trade}</div>
                      </div>
                    </div>
                    <span className={`${styles["tech-status-tag"]} ${statusClass}`}>
                      {tech.workload_status}
                    </span>
                  </div>

                  <div className={styles["tech-stats-box"]}>
                    <div className={styles["tech-stat-item"]}>
                      <span className={styles["tech-stat-val"]}>{tech.active_jobs}</span>
                      <span className={styles["tech-stat-lbl"]}>Active</span>
                    </div>
                    <div className={styles["tech-stat-item"]}>
                      <span className={styles["tech-stat-val"]} style={{ color: tech.high_priority > 0 ? "#dc2626" : "#64748b" }}>
                        {tech.high_priority}
                      </span>
                      <span className={styles["tech-stat-lbl"]}>High Pri</span>
                    </div>
                    <div className={styles["tech-stat-item"]}>
                      <span className={styles["tech-stat-val"]} style={{ color: tech.waiting_parts > 0 ? "#ea580c" : "#64748b" }}>
                        {tech.waiting_parts}
                      </span>
                      <span className={styles["tech-stat-lbl"]}>Parts</span>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#64748b",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Workload Distribution</span>
                      <span>{tech.active_jobs} Active Jobs</span>
                    </div>
                    <div className={styles["progress-track"]}>
                      <div
                        className={styles["progress-fill"]}
                        style={{
                          width: `${pct}%`,
                          background: pct > 75 ? "#dc2626" : pct > 40 ? "#0284c7" : "#10b981",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {technicianWorkload.length > 10 && (
            <div className={styles["card-footer-action"]}>
              <button
                type="button"
                onClick={() => setShowAllTechs((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllTechs ? (
                  <>
                    <ChevronUp size={14} /> Show Top 10 Technicians
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> View All Technicians ({technicianWorkload.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Maintenance Operations Audit Log */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={16} color="#0284c7" />
                Maintenance Operations Audit Log
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Audit trail of recent repair requests, technician assignments, and job resolutions
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>Live Log</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "310px", overflowY: "auto", marginTop: "6px" }}>
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "8px",
                        backgroundColor: ["completed", "verified", "closed"].includes((act.status || "").toLowerCase())
                          ? "#dcfce7"
                          : "#f0f9ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {["completed", "verified", "closed"].includes((act.status || "").toLowerCase()) ? (
                        <CheckCheck size={14} color="#16a34a" />
                      ) : (
                        <Wrench size={14} color="#0284c7" />
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ fontSize: "12px", color: "#0f172a" }}>{act.room_number}</strong>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                            background: "#f1f5f9",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          }}
                        >
                          {act.actor}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {act.action} • #{act.id}
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {act.time_formatted || "Today"}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8", fontSize: "12px" }}>
                No recent maintenance tasks logged.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 2: Priority & Critical Queue + Facility/Area Readiness */}
      <div className={styles["two-col-grid"]}>
        {/* Left Column: Priority & Critical Maintenance Queue */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={16} color="#dc2626" />
                Priority & Critical Maintenance Queue
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Room-blocking emergencies, urgent HVAC/electrical repairs, and expedited fixes
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {priorityQueue.length} Critical
            </span>
          </div>

          <div className={styles["turnover-list"]}>
            {priorityQueue.length > 0 ? (
              priorityQueue.map((item) => (
                <div key={item.id} className={styles["turnover-item"]}>
                  <div className={styles["turnover-info"]}>
                    <div className={styles["turnover-room-title"]}>
                      <span>{item.room_number ? `Room ${item.room_number}` : item.asset_name || "Facility"}</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                        • {item.category}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: item.priority === "urgent" ? "#fee2e2" : "#ffedd5",
                          color: item.priority === "urgent" ? "#dc2626" : "#c2410c",
                        }}
                      >
                        {(item.priority || "HIGH").toUpperCase()}
                      </span>
                    </div>
                    <div className={styles["turnover-meta"]}>
                      <span>{item.issue_title}</span>
                      <span>•</span>
                      <span>
                        Tech: <strong>{item.assigned_staff_name || "Unassigned"}</strong>
                      </span>
                      <span>•</span>
                      <span
                        style={{
                          color: item.blocks_room ? "#dc2626" : "#0284c7",
                          fontWeight: 700,
                        }}
                      >
                        {item.blocks_room ? "Room Blocked" : item.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    {!item.assigned_staff_id ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAssignModal(item)}
                        className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                      >
                        Assign
                      </button>
                    ) : item.status !== "completed" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkCompleted(item)}
                        className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                      >
                        <Check size={12} /> Resolve
                      </button>
                    ) : (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981" }}>
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8", fontSize: "12px" }}>
                No critical or urgent repairs in queue.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Facility & Area Maintenance Readiness */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers size={16} color="#059669" />
                Facility & Area Maintenance Readiness
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Live breakdown of operational equipment vs active repairs across hotel areas
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {areaProgressData.length} Areas Active
            </span>
          </div>

          <div className={styles["area-progress-list"]}>
            {displayedAreas.map((a) => (
              <div key={a.id} className={styles["area-item"]}>
                <div className={styles["area-header"]}>
                  <span className={styles["area-title"]}>{a.name}</span>
                  <span className={styles["area-count"]}>
                    <strong style={{ color: "#10b981" }}>{a.operational} Ready</strong> / {a.total} Rooms ({a.pctReady}%)
                  </span>
                </div>
                <div className={styles["area-bar-track"]}>
                  <div
                    className={styles["area-bar-clean"]}
                    style={{ width: `${(a.operational / a.total) * 100}%` }}
                    title={`Operational: ${a.operational}`}
                  />
                  <div
                    className={styles["area-bar-cleaning"]}
                    style={{ width: `${(a.inRepair / a.total) * 100}%` }}
                    title={`In Repair: ${a.inRepair}`}
                  />
                  <div
                    className={styles["area-bar-dirty"]}
                    style={{ width: `${(a.blocked / a.total) * 100}%` }}
                    title={`Blocked: ${a.blocked}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {areaProgressData.length > 4 && (
            <div className={styles["card-footer-action"]} style={{ marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setShowAllAreas((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllAreas ? (
                  <>
                    <ChevronUp size={14} /> Show Top 4 Areas
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> View All Areas ({areaProgressData.length})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Differential Data: Trade & Category Readiness Matrix (Eliminates Blank Space) */}
          {categoryReadiness.length > 0 && (
            <div className={styles["area-diff-section"]}>
              <div className={styles["area-diff-header"]}>
                <span className={styles["area-diff-title"]}>
                  <Building size={14} color="#059669" />
                  Trade & Equipment Health Matrix
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Live operational readiness by trade
                </span>
              </div>
              <div className={styles["category-readiness-grid"]}>
                {categoryReadiness.map((cat) => (
                  <div key={cat.category} className={styles["category-readiness-card"]}>
                    <div className={styles["category-name-row"]}>
                      <span>{cat.category}</span>
                      <span className={styles["category-badge-count"]}>
                        <strong style={{ color: cat.pctHealthy === 100 ? "#10b981" : "#0284c7" }}>
                          {cat.active > 0 ? `${cat.active} Active` : "100% Ready"}
                        </strong>
                      </span>
                    </div>
                    <div className={styles["category-progress-track"]}>
                      <div
                        className={styles["category-progress-fill"]}
                        style={{
                          width: `${cat.pctHealthy}%`,
                          background: cat.pctHealthy === 100 ? "#10b981" : cat.pctHealthy > 50 ? "#0284c7" : "#ea580c",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          MODAL 1: RAISE MAINTENANCE REQUEST
          ------------------------------------------------------------- */}
      {isRaiseModalOpen && (
        <div className={styles["modal-overlay"]} onClick={() => setIsRaiseModalOpen(false)}>
          <div className={styles["modal-content-card"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <h3 className={styles["modal-title"]}>Raise Maintenance Request</h3>
              <button
                type="button"
                onClick={() => setIsRaiseModalOpen(false)}
                className={styles["modal-close-btn"]}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRaiseRequest}>
              <div className={styles["modal-body"]}>
                <div className={styles["form-row"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Select Room (Optional)</label>
                    <select
                      value={requestForm.room_id}
                      onChange={(e) => setRequestForm({ ...requestForm, room_id: e.target.value })}
                      className={styles["form-select"]}
                    >
                      <option value="">General Facility / Non-Room</option>
                      {roomsList.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.room_number} ({r.room_type || "Deluxe"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Category *</label>
                    <select
                      value={requestForm.category}
                      onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value })}
                      className={styles["form-select"]}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Priority *</label>
                    <select
                      value={requestForm.priority}
                      onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                      className={styles["form-select"]}
                    >
                      <option value="normal">Normal Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent / Emergency</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Estimated Repair Cost (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={requestForm.estimated_cost}
                      onChange={(e) => setRequestForm({ ...requestForm, estimated_cost: e.target.value })}
                      className={styles["form-input"]}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>Issue Title *</label>
                  <input
                    type="text"
                    value={requestForm.issue_title}
                    onChange={(e) => setRequestForm({ ...requestForm, issue_title: e.target.value })}
                    className={styles["form-input"]}
                    placeholder="e.g. AC unit leaking water, Shower pressure low"
                    required
                  />
                </div>

                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>Issue Description</label>
                  <textarea
                    rows={3}
                    value={requestForm.issue_description}
                    onChange={(e) => setRequestForm({ ...requestForm, issue_description: e.target.value })}
                    className={styles["form-textarea"]}
                    placeholder="Provide additional details or technician instructions..."
                  />
                </div>

                <label className={styles["checkbox-label"]}>
                  <input
                    type="checkbox"
                    checked={requestForm.blocks_room}
                    onChange={(e) => setRequestForm({ ...requestForm, blocks_room: e.target.checked })}
                  />
                  <span>Block room from front desk inventory until repair is resolved</span>
                </label>
              </div>

              <div className={styles["modal-footer"]}>
                <button
                  type="button"
                  onClick={() => setIsRaiseModalOpen(false)}
                  className={styles["btn-cancel"]}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className={styles["btn-submit"]}
                >
                  {submittingRequest ? "Logging..." : "Log Maintenance Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 2: ASSIGN TECHNICIAN
          ------------------------------------------------------------- */}
      {isAssignModalOpen && (
        <div className={styles["modal-overlay"]} onClick={() => setIsAssignModalOpen(false)}>
          <div className={styles["modal-content-card"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <h3 className={styles["modal-title"]}>Assign Technician</h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className={styles["modal-close-btn"]}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAssign}>
              <div className={styles["modal-body"]}>
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>
                    Request Details
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                    {assignForm.issue_title}
                  </div>
                  {assignForm.room_number && (
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      Location: Room {assignForm.room_number}
                    </div>
                  )}
                </div>

                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>Select Technician *</label>
                  <select
                    value={assignForm.assigned_staff_id}
                    onChange={(e) => setAssignForm({ ...assignForm, assigned_staff_id: e.target.value })}
                    className={styles["form-select"]}
                    required
                  >
                    <option value="">-- Choose Technician --</option>
                    {techniciansList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.designation || t.department || "Staff"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>Technician Instructions / Remarks</label>
                  <textarea
                    rows={3}
                    value={assignForm.remarks}
                    onChange={(e) => setAssignForm({ ...assignForm, remarks: e.target.value })}
                    className={styles["form-textarea"]}
                    placeholder="Special tools required, guest preference, time window..."
                  />
                </div>
              </div>

              <div className={styles["modal-footer"]}>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className={styles["btn-cancel"]}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className={styles["btn-submit"]}
                >
                  {submittingAssign ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
