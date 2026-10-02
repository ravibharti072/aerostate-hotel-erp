import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  BedDouble,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
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
  ChevronDown,
  ChevronUp,
  Users,
  ShieldCheck,
  PackageCheck,
  Activity,
  CheckCheck,
  Trash2,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader, Pagination } from "@components";
import "../checkoutCleaning/checkoutCleaning.css";
import styles from "./housekeepingDashboard.module.css";

export const parseServerDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  let str = String(dateVal).trim();
  if (!str) return null;
  if (!str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str = str.replace(" ", "T") + "Z";
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

export const getRecordTimingInfo = (statusKey, activeTask) => {
  const startedAt = parseServerDate(activeTask?.started_at);
  const completedAt = parseServerDate(activeTask?.completed_at);
  const updatedAt = parseServerDate(activeTask?.updated_at);
  const createdAt = parseServerDate(activeTask?.created_at);

  const formatTimeOnly = (d) => {
    if (!d) return null;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const getMinsAgo = (d) => {
    if (!d) return 1;
    return Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
  };

  // 1. If actively in cleaning:
  if (statusKey === "in-cleaning" || statusKey === "stayover-cleaning") {
    const startRef = startedAt || updatedAt || createdAt;
    const mins = getMinsAgo(startRef);
    const timeStr = formatTimeOnly(startRef);
    return {
      primary: `${mins}m in cleaning`,
      secondary: timeStr ? `Started ${timeStr}` : null,
      badgeColor: "#2563eb",
      isLiveTimer: true,
    };
  }

  // 2. If awaiting inspection:
  if (statusKey === "awaiting-inspection") {
    const compRef = completedAt || updatedAt;
    const mins = getMinsAgo(compRef);
    const timeStr = formatTimeOnly(compRef);
    return {
      primary: timeStr ? `Cleaned ${timeStr}` : "Cleaned",
      secondary: mins > 0 ? `Waiting ${mins}m` : null,
      badgeColor: "#d97706",
      isLiveTimer: false,
    };
  }

  // 3. If ready / inspected:
  if (statusKey === "clean-inspected") {
    const readyRef = completedAt || updatedAt || createdAt;
    const timeStr = formatTimeOnly(readyRef);
    return {
      primary: timeStr ? `Ready ${timeStr}` : "Ready Today",
      secondary: null,
      badgeColor: "#059669",
      isLiveTimer: false,
    };
  }

  // 4. If dirty / departed:
  if (statusKey === "dirty-departed") {
    const notes = String(activeTask?.notes || "");
    const isFailed = notes.lastIndexOf("Inspection FAILED") > notes.lastIndexOf("Inspection PASSED");
    if (isFailed) {
      const failRef = updatedAt || createdAt;
      const timeStr = formatTimeOnly(failRef);
      return {
        primary: timeStr ? `Failed ${timeStr}` : "Failed Inspection",
        secondary: "Requires Re-clean",
        badgeColor: "#dc2626",
        isLiveTimer: false,
      };
    }
    const assignRef = createdAt || updatedAt;
    const timeStr = formatTimeOnly(assignRef);
    return {
      primary: timeStr ? `Assigned ${timeStr}` : "Pending Turnover",
      secondary: null,
      badgeColor: "#64748b",
      isLiveTimer: false,
    };
  }

  // 5. Maintenance
  if (statusKey === "maintenance") {
    return {
      primary: "Under Maintenance",
      secondary: null,
      badgeColor: "#d97706",
      isLiveTimer: false,
    };
  }

  return {
    primary: formatTimeOnly(createdAt) || "Today",
    secondary: null,
    badgeColor: "#64748b",
    isLiveTimer: false,
  };
};

export default function HousekeepingDashboard({
  isEmbedded = false,
  viewMode = "standalone",
  showBack = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmbeddedView = isEmbedded || viewMode === "embedded";

  // Core Data States from Backend Server
  const [rooms, setRooms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [sortMode, setSortMode] = useState("workflow");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Redirect Housekeeping Staff directly to Staff Portal
  useEffect(() => {
    if (user) {
      const dept = (user.department || user.staff?.department || "").toLowerCase();
      const roleLevel = (user.role_level || "").toLowerCase();
      const isAdmin = user.role === "hotel-admin" || user.role === "super-admin";
      if (!isAdmin && dept.includes("housekeep") && roleLevel === "employee") {
        navigate("/housekeeping/staff", { replace: true });
      }
    }
  }, [user, navigate]);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [showAllFloors, setShowAllFloors] = useState(false);

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    room_id: "",
    task_type: "checkout-cleaning",
    priority: "normal",
    assigned_staff_id: "",
    notes: "",
  });

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    room_id: "",
    issue_type: "HVAC / Air Conditioning",
    priority: "high",
    description: "",
    blocks_room: true,
  });

  // Custom Confirmation & Input Modals (Replaces native browser popups)
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [failConfirmItem, setFailConfirmItem] = useState(null);
  const [failReasonText, setFailReasonText] = useState("");

  // Quick-Assign inline dropdown state (per row, no full modal needed)
  const [quickAssignItemId, setQuickAssignItemId] = useState(null);
  const [quickAssignStaffId, setQuickAssignStaffId] = useState("");
  const [quickAssigning, setQuickAssigning] = useState(false);


  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
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
    return [];
  };

  // Build Unified Housekeeping Room Records from Original Backend Entities
  const buildRoomRecords = (rawRooms, rawTasks, rawStaff, rawBookings) => {
    const liveRecords = rawRooms.map((r, idx) => {
      // Find tasks for this room - sorted newest first
      const roomTasks = rawTasks.filter((t) => Number(t.room_id) === Number(r.id));
      roomTasks.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

      // If the latest turnover task for this room was archived/deleted, that completed turnover
      // entry was moved to the Deleted section by the user. Do NOT recreate it in liveRecords (especially not in 'Inspected & Ready')!
      const latestTaskOverall = roomTasks[0];
      if (latestTaskOverall && (latestTaskOverall.status === "archived" || latestTaskOverall.status === "deleted")) {
        return null;
      }

      // Latest active task (ignoring soft-deleted/archived tasks for current room state)
      const activeTask = roomTasks.find((t) => t.status !== "archived" && t.status !== "deleted");

      // Active booking for this room
      const activeBooking = rawBookings.find(
        (b) => Number(b.room_id) === Number(r.id) && (b.status === "checked-in" || b.status === "confirmed")
      );
      const isOccupied = activeBooking && activeBooking.status === "checked-in";

      // Status mapping from actual backend room status and active task
      const rStatus = String(r.status || "available").toLowerCase();
      const taskStatus = String(activeTask?.status || "").toLowerCase();
      const taskNotes = String(activeTask?.notes || "").toLowerCase();
      const lastPassedIdx = taskNotes.lastIndexOf("inspection passed");
      const lastFailedIdx = taskNotes.lastIndexOf("inspection failed");
      const isPassed = lastPassedIdx !== -1 && (lastFailedIdx === -1 || lastPassedIdx > lastFailedIdx);
      const isFailed = lastFailedIdx !== -1 && (lastPassedIdx === -1 || lastFailedIdx > lastPassedIdx);

      let statusKey = "clean-inspected";
      let statusLabel = "Inspected & Ready";

      if (rStatus === "maintenance") {
        statusKey = "maintenance";
        statusLabel = "Under Maintenance";
      } else if (isOccupied) {
        if (taskStatus === "in-progress" || taskStatus === "cleaning") {
          statusKey = "in-cleaning";
          statusLabel = "Stayover (In Cleaning)";
        } else if (taskStatus === "completed" && isPassed) {
          statusKey = "clean-inspected";
          statusLabel = "Stayover (Inspected & Ready)";
        } else if (taskStatus === "completed" && isFailed) {
          // Last inspection was a FAIL even if status says completed — don't show as awaiting
          statusKey = "dirty-departed";
          statusLabel = "Stayover (Failed Inspection)";
        } else if (taskStatus === "completed" && !isPassed && !isFailed) {
          statusKey = "awaiting-inspection";
          statusLabel = "Stayover (Awaiting Inspection)";
        } else {
          statusKey = "stayover-cleaning";
          statusLabel = "Stayover Cleaning";
        }
      } else if (rStatus === "reserved") {
        statusKey = "clean-inspected";
        statusLabel = "Reserved / Ready";
      } else if (activeTask) {
        if (taskStatus === "completed") {
          if (isPassed) {
            statusKey = "clean-inspected";
            statusLabel = "Inspected & Ready";
          } else if (isFailed) {
            // Last event was inspection FAIL — room is dirty again, awaiting re-clean
            statusKey = "dirty-departed";
            statusLabel = "Dirty / Failed Inspection";
          } else {
            // No inspection note at all → genuinely awaiting HOD inspection
            statusKey = "awaiting-inspection";
            statusLabel = "Awaiting Inspection";
          }
        } else if (taskStatus === "in-progress" || taskStatus === "cleaning") {
          statusKey = "in-cleaning";
          statusLabel = "In Cleaning";
        } else if (taskStatus === "pending" || taskStatus === "assigned") {
          statusKey = "dirty-departed";
          statusLabel = "Dirty / Departed";
        }
      } else {
        if (rStatus === "dirty") {
          statusKey = "dirty-departed";
          statusLabel = "Dirty / Departed";
        } else if (rStatus === "cleaning") {
          statusKey = "in-cleaning";
          statusLabel = "In Cleaning";
        } else {
          statusKey = "clean-inspected";
          statusLabel = "Inspected & Ready";
        }
      }

      // Priority
      let priority = "NORMAL";
      if (activeTask?.priority === "high" || activeTask?.priority === "rush") {
        priority = "RUSH CLEANING";
      } else if (activeTask?.priority === "vip") {
        priority = "VIP ARRIVAL";
      }

      // Assigned attendant
      let attendantName = activeTask?.assigned_to;
      if (!attendantName && activeTask?.assigned_staff_id) {
        const matched = rawStaff.find((s) => s.id === activeTask.assigned_staff_id);
        if (matched) attendantName = matched.full_name;
      }
      if (!attendantName && activeTask?.completed_by) {
        attendantName = activeTask.completed_by;
      }
      if (!attendantName) attendantName = "Unassigned";

      const staffObj = activeTask?.assigned_staff_id
        ? rawStaff.find((s) => s.id === activeTask.assigned_staff_id)
        : (attendantName !== "Unassigned"
            ? rawStaff.find((s) => s.full_name?.toLowerCase() === attendantName?.toLowerCase())
            : null);
      if (staffObj && (!attendantName || attendantName === "Unassigned")) {
        attendantName = staffObj.full_name;
      }

      const initials = attendantName !== "Unassigned"
        ? attendantName
            .split(" ")
            .map((p) => p[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "--";

      // Occupancy text
      let occupancy = "Vacant (Available)";
      if (isOccupied) {
        occupancy = `Occupied (${activeBooking?.guest_name || "In-House Guest"})`;
      } else if (rStatus === "dirty") {
        occupancy = "Vacant (Departed)";
      } else if (rStatus === "reserved") {
        occupancy = "Reserved (Arrival Today)";
      } else if (rStatus === "maintenance") {
        occupancy = "Vacant (Blocked)";
      }

      const floorNum = String(r.floor || "1");
      const wingName = `Floor ${floorNum} • Wing ${
        floorNum === "1" ? "East" : floorNum === "2" ? "West" : "Garden View"
      }`;

      const timingInfo = getRecordTimingInfo(statusKey, activeTask);

      return {
        id: r.id,
        taskId: activeTask ? `HK-26-${activeTask.id}` : `HK-26-${8000 + r.id}`,
        dbTaskId: activeTask ? activeTask.id : null,
        roomNumber: String(r.room_number),
        floor: floorNum,
        wing: wingName,
        roomType: r.room_type || "Deluxe",
        status: statusKey,
        statusLabel,
        occupancy,
        priority,
        timingInfo,
        timestamp: timingInfo.primary,
        assignedAttendant: attendantName,
        assignedStaffId: staffObj?.id || activeTask?.assigned_staff_id || null,
        attendantInitials: initials,
        shift: staffObj ? "Housekeeping Duty" : "-",
        notes:
          activeTask?.notes ||
          (statusKey === "maintenance"
            ? "Maintenance issue logged"
            : "Turnover sanitization"),
        lastCleanedAt: activeTask?.completed_at
          ? parseServerDate(activeTask.completed_at)?.toLocaleDateString()
          : "Today",
      };
    });

    // Generate dedicated records for Archived / Soft-Deleted turnover entries
    const archivedTasks = rawTasks.filter((t) => t.status === "archived" || t.status === "deleted");
    const archivedRecords = archivedTasks.map((task) => {
      const matchedRoom = rawRooms.find((r) => Number(r.id) === Number(task.room_id));
      const roomNumber = matchedRoom ? String(matchedRoom.room_number) : (task.room_number || String(task.room_id));
      const floorNum = String(matchedRoom?.floor || task.floor || "1");
      const wingName = `Floor ${floorNum} • Wing ${
        floorNum === "1" ? "East" : floorNum === "2" ? "West" : "Garden View"
      }`;
      const attendantName = task.assigned_to || task.completed_by || "Attendant";
      const initials = attendantName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      return {
        id: matchedRoom ? matchedRoom.id : task.room_id,
        isArchived: true,
        taskId: `HK-26-${task.id}`,
        dbTaskId: task.id,
        roomNumber,
        floor: floorNum,
        wing: wingName,
        roomType: matchedRoom?.room_type || "Deluxe",
        status: "archived",
        statusLabel: "Deleted / Archived",
        occupancy: "Historical Task",
        priority: (task.priority || "normal").toUpperCase(),
        timingInfo: {
          primary: task.updated_at
            ? parseServerDate(task.updated_at)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Archived"
            : "Archived",
          secondary: "Removed from Active",
          badgeColor: "#64748b",
          isLiveTimer: false,
        },
        timestamp: task.updated_at
          ? parseServerDate(task.updated_at)?.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Archived",
        assignedAttendant: attendantName,
        assignedStaffId: task.assigned_staff_id,
        attendantInitials: initials,
        shift: "Archived Record",
        notes: task.notes || "Archived turnover record",
        lastCleanedAt: task.completed_at
          ? parseServerDate(task.completed_at)?.toLocaleDateString()
          : "-",
      };
    });

    return [...liveRecords.filter(Boolean), ...archivedRecords];
  };

  // Fetch Original Data Directly from Backend Server
  const loadBackendData = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const [roomsRes, tasksRes, staffRes, bookingsRes] = await Promise.allSettled([
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/housekeeping/tasks").catch(() => ({ data: [] })),
        api.get("/housekeeping/cleaning-staff").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
      ]);

      const rawRooms = filterByHotel(normalizeList(roomsRes.value?.data, "rooms"));
      const rawTasks = filterByHotel(normalizeList(tasksRes.value?.data, "tasks"));
      let rawStaff = normalizeList(staffRes.value?.data, "staff");
      if (!rawStaff || rawStaff.length === 0) {
        const allStaffRes = await api.get("/staff").catch(() => ({ data: [] }));
        const allStaff = normalizeList(allStaffRes.data, "staff");
        const hkStaff = allStaff.filter((s) => {
          const d = (s.department || "").toLowerCase();
          const desig = (s.designation || "").toLowerCase();
          return d.includes("housekeep") || d.includes("clean") || desig.includes("attendant") || desig.includes("clean");
        });
        rawStaff = filterByHotel(hkStaff.length > 0 ? hkStaff : allStaff);
      } else {
        rawStaff = filterByHotel(rawStaff);
      }
      const rawBookings = filterByHotel(normalizeList(bookingsRes.value?.data, "bookings"));

      setRooms(rawRooms);
      setTasks(rawTasks);
      setStaffList(rawStaff);
      setBookings(rawBookings);

      const built = buildRoomRecords(rawRooms, rawTasks, rawStaff, rawBookings);
      setRecords(built);

      if (rawRooms.length > 0 && !assignForm.room_id) {
        setAssignForm((prev) => ({
          ...prev,
          room_id: rawRooms[0].room_number,
          assigned_staff_id: rawStaff[0]?.id || "",
        }));
      }
      if (rawRooms.length > 0 && !reportForm.room_id) {
        setReportForm((prev) => ({
          ...prev,
          room_id: rawRooms[0].room_number,
        }));
      }
    } catch (err) {
      console.error("Housekeeping data load error:", err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadBackendData(true);
    const interval = setInterval(() => {
      loadBackendData(false);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // -------------------------------------------------------------
  // Computed Metrics from Real Records
  // -------------------------------------------------------------
  const stats = useMemo(() => {
    const live = records.filter((r) => r.status !== "archived");
    const total = live.length;
    const ready = live.filter((r) => r.status === "clean-inspected").length;
    const awaitingInspection = live.filter((r) => r.status === "awaiting-inspection").length;
    const inCleaning = live.filter((r) => r.status === "in-cleaning" || r.status === "stayover-cleaning").length;
    const dirty = live.filter((r) => r.status === "dirty-departed").length;
    const maintenance = live.filter((r) => r.status === "maintenance").length;

    return { total, ready, awaitingInspection, inCleaning, dirty, maintenance };
  }, [records]);

  // Workflow Order Rank:
  // 1. Dirty rooms
  // 2. Room cleaning happening by staff (in progress)
  // 3. Inspection
  // 4. Whole list which work is done (Inspected & Ready)
  // 5. Maintenance
  const getWorkflowRank = (item) => {
    if (item.status === "dirty-departed") return 1;
    if (item.status === "in-cleaning" || item.status === "stayover-cleaning") return 2;
    if (item.status === "awaiting-inspection") return 3;
    if (item.status === "clean-inspected") return 4;
    if (item.status === "maintenance") return 5;
    return 6;
  };

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: records.filter((r) => r.status !== "archived").length,
      dirty: records.filter((r) => r.status === "dirty-departed").length,
      inCleaning: records.filter((r) => r.status === "in-cleaning" || r.status === "stayover-cleaning").length,
      inspection: records.filter((r) => r.status === "awaiting-inspection").length,
      inspected: records.filter((r) => r.status === "clean-inspected").length,
      maintenance: records.filter((r) => r.status === "maintenance").length,
      archived: records.filter((r) => r.status === "archived").length,
    };
  }, [records]);

  // Filtering & Sorting
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (activeTab === "all") {
      result = result.filter((r) => r.status !== "archived");
    } else if (activeTab === "dirty") {
      result = result.filter((r) => r.status === "dirty-departed");
    } else if (activeTab === "in-cleaning") {
      result = result.filter((r) => r.status === "in-cleaning" || r.status === "stayover-cleaning");
    } else if (activeTab === "inspection") {
      result = result.filter((r) => r.status === "awaiting-inspection");
    } else if (activeTab === "inspected") {
      result = result.filter((r) => r.status === "clean-inspected");
    } else if (activeTab === "maintenance") {
      result = result.filter((r) => r.status === "maintenance");
    } else if (activeTab === "archived") {
      result = result.filter((r) => r.status === "archived");
    }

    if (selectedFloor !== "all") {
      result = result.filter((r) => String(r.floor) === String(selectedFloor));
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.roomNumber.toLowerCase().includes(q) ||
          r.assignedAttendant.toLowerCase().includes(q) ||
          r.taskId.toLowerCase().includes(q) ||
          r.wing.toLowerCase().includes(q) ||
          r.roomType.toLowerCase().includes(q)
      );
    }

    if (sortMode === "workflow") {
      result.sort((a, b) => {
        const rankA = getWorkflowRank(a);
        const rankB = getWorkflowRank(b);
        if (rankA !== rankB) return rankA - rankB;
        return Number(a.roomNumber) - Number(b.roomNumber);
      });
    } else if (sortMode === "priority") {
      const order = { "VIP ARRIVAL": 1, "RUSH CLEANING": 2, "NORMAL": 3 };
      result.sort((a, b) => (order[a.priority] || 4) - (order[b.priority] || 4));
    } else if (sortMode === "room_asc") {
      result.sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));
    } else if (sortMode === "status") {
      result.sort((a, b) => a.status.localeCompare(b.status));
    }

    return result;
  }, [records, activeTab, selectedFloor, searchText, sortMode]);

  // Paginated records (20 per page by default, up to 100)
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Real Attendant Workload Tracker Data
  const attendantWorkload = useMemo(() => {
    if (!staffList || staffList.length === 0) {
      const uniqueAttendants = Array.from(new Set(records.map((r) => r.assignedAttendant))).filter(Boolean);
      return uniqueAttendants.map((name, idx) => {
        const assigned = records.filter((r) => r.assignedAttendant === name);
        const completed = assigned.filter((r) => r.status === "clean-inspected").length;
        const pending = assigned.length - completed;
        return {
          id: idx + 1,
          name,
          initials: name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2),
          shift: "Day Shift • Housekeeping",
          totalAssigned: assigned.length,
          completedRooms: completed,
          pendingRooms: pending,
          progressPct: assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 100,
        };
      });
    }

    return staffList.map((staff) => {
      const assignedRooms = records.filter(
        (r) =>
          (r.assignedStaffId && Number(r.assignedStaffId) === Number(staff.id)) ||
          (r.assignedAttendant && r.assignedAttendant.toLowerCase() === staff.full_name?.toLowerCase())
      );
      const totalAssigned = assignedRooms.length;
      const completedRooms = assignedRooms.filter(
        (r) => r.status === "clean-inspected"
      ).length;
      const pendingRooms = Math.max(0, totalAssigned - completedRooms);
      const progressPct =
        totalAssigned > 0 ? Math.round((completedRooms / totalAssigned) * 100) : 100;

      return {
        id: staff.id,
        name: staff.full_name,
        initials: (staff.full_name || "HK")
          .split(" ")
          .map((p) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
        shift: `${staff.department || "Housekeeping"} • ${staff.designation || "Staff"}`,
        totalAssigned,
        completedRooms,
        pendingRooms,
        progressPct,
      };
    });
  }, [staffList, records]);

  // Displayed Staff (Max 10 with toggle)
  const displayedStaff = useMemo(() => {
    return showAllStaff ? attendantWorkload : attendantWorkload.slice(0, 10);
  }, [attendantWorkload, showAllStaff]);

  // Quick KPI summary metrics for Attendant card
  const staffSummary = useMemo(() => {
    const totalStaff = attendantWorkload.length;
    const totalAssigned = attendantWorkload.reduce((acc, s) => acc + (s.totalAssigned || 0), 0);
    const totalCleaned = attendantWorkload.reduce((acc, s) => acc + (s.completedRooms || 0), 0);
    const readyRate = totalAssigned > 0 ? Math.round((totalCleaned / totalAssigned) * 100) : 100;
    return { totalStaff, totalAssigned, readyRate };
  }, [attendantWorkload]);

  // Real Priority Turnover Queue
  const priorityTurnoverQueue = useMemo(() => {
    const urgent = records.filter(
      (r) =>
        r.status === "dirty-departed" ||
        r.priority === "RUSH CLEANING" ||
        r.priority === "VIP ARRIVAL"
    );
    if (urgent.length > 0) return urgent.slice(0, 5);
    return records.slice(0, 4);
  }, [records]);

  // Real Floor Readiness Progress
  const floorProgressData = useMemo(() => {
    const floorSet = Array.from(new Set(records.map((r) => String(r.floor || "1")))).sort();
    return floorSet.map((floorNum) => {
      const floorRooms = records.filter((r) => String(r.floor) === String(floorNum));
      const total = floorRooms.length || 1;
      const clean = floorRooms.filter((r) => r.status === "clean-inspected").length;
      const cleaning = floorRooms.filter(
        (r) => r.status === "dirty-departed" && r.progress === "IN CLEANING"
      ).length;
      const dirty = floorRooms.filter(
        (r) =>
          (r.status === "dirty-departed" && r.progress !== "IN CLEANING") ||
          r.status === "maintenance"
      ).length;
      const pctClean = Math.round((clean / total) * 100);

      return {
        id: floorNum,
        name: `Floor ${floorNum} • Wing ${
          floorNum === "1" ? "East" : floorNum === "2" ? "West" : "Garden View"
        }`,
        total: floorRooms.length,
        clean,
        cleaning,
        dirty,
        pctClean,
      };
    });
  }, [records]);

  // Displayed Floors (Max 4 with toggle)
  const displayedFloors = useMemo(() => {
    return showAllFloors ? floorProgressData : floorProgressData.slice(0, 4);
  }, [floorProgressData, showAllFloors]);

  // Diff Data: Room Category Readiness Matrix (Live computation from records)
  const roomCategoryReadiness = useMemo(() => {
    const types = Array.from(new Set(records.map((r) => r.roomType || "Standard"))).filter(Boolean);
    return types.map((type) => {
      const matched = records.filter((r) => (r.roomType || "Standard") === type);
      const total = matched.length;
      const clean = matched.filter((r) => r.status === "clean-inspected").length;
      const dirty = matched.filter((r) => r.status === "dirty-departed").length;
      const pct = total > 0 ? Math.round((clean / total) * 100) : 100;
      return { type, total, clean, dirty, pct };
    });
  }, [records]);

  // Real Operations Audit Feed from Tasks
  const recentActivities = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return records.slice(0, 5).map((r) => ({
        id: r.id,
        roomNumber: `Room ${r.roomNumber}`,
        actionText: `${r.statusLabel} verified`,
        staffName: r.assignedAttendant,
        time: r.timestamp || "Today",
        status: r.status,
      }));
    }

    return tasks.slice(0, 6).map((t) => {
      const room = rooms.find((r) => r.id === t.room_id);
      const rNum = room ? `Room ${room.room_number}` : `Room ${t.room_id}`;
      let actionText = "Turnover cleaning scheduled";
      if (t.status === "completed") {
        actionText = "Turnover cleaning completed";
      } else if (t.status === "in-progress" || t.status === "in_progress") {
        actionText = "Cleaning currently in progress";
      }

      return {
        id: t.id,
        roomNumber: rNum,
        actionText,
        staffName: t.assigned_to || "Housekeeping Staff",
        time: t.completed_at || t.updated_at || t.created_at
          ? new Date(t.completed_at || t.updated_at || t.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Today",
        status: t.status,
      };
    });
  }, [tasks, records, rooms]);

  // -------------------------------------------------------------
  // Backend Connected Actions
  // -------------------------------------------------------------
  const handleMarkClean = async (item) => {
    try {
      await api.put(`/rooms/${item.id}/status`, { status: "available" }).catch(async () => {
        await api.put(`/rooms/${item.id}`, { status: "available" });
      });

      if (item.dbTaskId) {
        await api.post(`/housekeeping/tasks/${item.dbTaskId}/inspect`, {
          action: "pass",
          notes: "Marked clean by HOD.",
        }).catch(async () => {
          await api.put(`/housekeeping/tasks/${item.dbTaskId}/status`, { status: "completed" });
        });
      }

      showToast(`Room ${item.roomNumber} marked clean and ready.`);
      await loadBackendData();
    } catch (err) {
      console.error("Mark clean error:", err);
      showToast(`Room ${item.roomNumber} marked clean.`);
      await loadBackendData();
    }
  };

  const handleInspectPass = async (item) => {
    try {
      if (item.dbTaskId) {
        await api.post(`/housekeeping/tasks/${item.dbTaskId}/inspect`, {
          action: "pass",
          notes: "Passed HOD inspection. Room ready for guest check-in.",
        }).catch(async () => {
          await api.put(`/housekeeping/tasks/${item.dbTaskId}/status`, { status: "completed" });
        });
      }

      await api.put(`/rooms/${item.id}/status`, { status: "available" }).catch(async () => {
        await api.put(`/rooms/${item.id}`, { status: "available" });
      });

      showToast(`Room ${item.roomNumber} inspection PASSED. Moved to Completed section.`, "success");
      await loadBackendData();
    } catch (err) {
      console.error("Inspect pass error:", err);
      showToast(`Failed to pass inspection for Room ${item.roomNumber}.`, "error");
      await loadBackendData();
    }
  };

  const executeInspectFail = async (item, failureReason) => {
    try {
      if (item.dbTaskId) {
        await api.post(`/housekeeping/tasks/${item.dbTaskId}/inspect`, {
          action: "fail",
          notes: failureReason || "Inspection failed. Rework required.",
        }).catch(async () => {
          await api.put(`/housekeeping/tasks/${item.dbTaskId}/status`, { status: "pending" });
        });
      }

      await api.put(`/rooms/${item.id}/status`, { status: "dirty" }).catch(async () => {
        await api.put(`/rooms/${item.id}`, { status: "dirty" });
      });

      showToast(`Room ${item.roomNumber} inspection FAILED. Moved to Dirty / Departed.`, "info");
      setFailConfirmItem(null);
      setFailReasonText("");
      await loadBackendData();
    } catch (err) {
      console.error("Inspect fail error:", err);
      showToast(`Failed to update inspection for Room ${item.roomNumber}.`, "error");
      await loadBackendData();
    }
  };

  const executeSoftDelete = async (item) => {
    if (!item.dbTaskId) {
      showToast(`No specific turnover task reference found for Room ${item.roomNumber}.`, "error");
      setDeleteConfirmItem(null);
      return;
    }

    try {
      await api.delete(`/housekeeping/tasks/${item.dbTaskId}`);
      showToast(`Record #${item.taskId} for Room ${item.roomNumber} moved to Deleted section.`, "success");
      setDeleteConfirmItem(null);
      await loadBackendData();
    } catch (err) {
      console.error("Soft delete error:", err);
      showToast("Failed to delete entry.", "error");
    }
  };

  const handleRestoreTask = async (item) => {
    if (!item.dbTaskId) return;
    try {
      await api.post(`/housekeeping/tasks/${item.dbTaskId}/restore`);
      showToast(`Record #${item.taskId} for Room ${item.roomNumber} restored back to Completed section.`, "success");
      await loadBackendData();
    } catch (err) {
      console.error("Restore error:", err);
      showToast("Failed to restore entry.", "error");
    }
  };

  // Quick-Assign: directly assign staff from inline dropdown (no full modal needed)
  const handleQuickAssign = async (item, staffId) => {
    if (!staffId) { showToast("Please select a staff member.", "error"); return; }
    setQuickAssigning(true);
    try {
      const sid = Number(staffId);
      const staffObj = staffList.find((s) => Number(s.id) === sid);
      const roomId = item.id;

      // Find existing active task or create new one
      let existingTaskId = item.dbTaskId;
      if (!existingTaskId && roomId) {
        const existing = tasks.find(
          (t) => Number(t.room_id) === Number(roomId) && ["pending", "assigned", "in-progress"].includes(t.status)
        );
        if (existing) existingTaskId = existing.id;
      }

      if (existingTaskId) {
        await api.post(`/housekeeping/tasks/${existingTaskId}/assign`, {
          staff_id: sid,
          assigned_to_name: staffObj?.full_name,
          notes: "Cleaning task assigned by supervisor.",
        });
      } else {
        await api.post("/housekeeping/tasks", {
          hotel_id: getLoggedInHotelId() || 1,
          room_id: roomId,
          assigned_staff_id: sid,
          assigned_to: staffObj?.full_name,
          task_type: "checkout-cleaning",
          priority: "normal",
          status: "pending",
          notes: "Cleaning task assigned by supervisor.",
        });
      }

      setQuickAssignItemId(null);
      setQuickAssignStaffId("");
      showToast(`Room ${item.roomNumber} assigned to ${staffObj?.full_name || "attendant"}.`, "success");
      await loadBackendData();
    } catch (err) {
      console.error("Quick assign error:", err);
      showToast("Failed to assign. Please try again.", "error");
    } finally {
      setQuickAssigning(false);
    }
  };

  // Auto-Assign Dirty Room: finds previously assigned staff and assigns instantly
  const handleAutoAssignDirty = async (item) => {
    // Try to find the last assigned staff from previous tasks for this room
    const prevTask = [...tasks]
      .filter((t) => Number(t.room_id) === Number(item.id) && t.assigned_staff_id)
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];

    const autoStaffId = prevTask?.assigned_staff_id || item.assignedStaffId;
    if (autoStaffId) {
      await handleQuickAssign(item, autoStaffId);
    } else if (staffList.length > 0) {
      // Assign to first available staff if no history
      await handleQuickAssign(item, staffList[0].id);
    } else {
      showToast("No housekeeping staff available for auto-assignment.", "error");
    }
  };


  const handleOpenAssignModal = (roomItem = null) => {
    const defaultStaff = roomItem?.assignedStaffId || (staffList.length > 0 ? staffList[0].id : "");
    const initialRoomNum = roomItem ? roomItem.roomNumber : (rooms[0]?.room_number || "101");
    const matchedRoom = rooms.find((r) => String(r.room_number) === String(initialRoomNum));
    setAssignForm({
      room_id: initialRoomNum,
      target_room_id: roomItem?.id || matchedRoom?.id || null,
      task_id: roomItem?.dbTaskId || null,
      task_type: roomItem?.status === "stayover-cleaning" ? "stayover-cleaning" : "checkout-cleaning",
      priority: roomItem?.priority === "VIP ARRIVAL" ? "vip" : (roomItem?.priority === "RUSH CLEANING" ? "high" : "normal"),
      assigned_staff_id: defaultStaff,
      notes: "",
    });
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignTask = async (e) => {
    e.preventDefault();
    try {
      const staffId = Number(assignForm.assigned_staff_id);
      if (!staffId) {
        showToast("Please select an attendant to assign.", "error");
        return;
      }

      const targetRoom = rooms.find(
        (r) => String(r.room_number) === String(assignForm.room_id) || String(r.id) === String(assignForm.room_id)
      );
      const roomId = targetRoom ? targetRoom.id : Number(assignForm.target_room_id || assignForm.room_id);
      const staffObj = staffList.find((s) => Number(s.id) === staffId);

      // Check if this room already has an active task that can be assigned
      let existingTaskId = assignForm.task_id;
      if (!existingTaskId && roomId) {
        const existingTask = tasks.find(
          (t) => Number(t.room_id) === Number(roomId) && ["pending", "assigned", "in-progress"].includes(t.status)
        );
        if (existingTask) existingTaskId = existingTask.id;
      }

      if (existingTaskId) {
        await api.post(`/housekeeping/tasks/${existingTaskId}/assign`, {
          staff_id: staffId,
          assigned_to_name: staffObj?.full_name,
          notes: assignForm.notes || "Cleaning task assigned by supervisor.",
        });
      } else {
        const payload = {
          hotel_id: getLoggedInHotelId() || 1,
          room_id: roomId,
          assigned_staff_id: staffId,
          assigned_to: staffObj?.full_name,
          task_type: assignForm.task_type || "checkout-cleaning",
          priority: assignForm.priority || "normal",
          status: "pending",
          notes: assignForm.notes || "Cleaning task assigned by supervisor.",
        };
        await api.post("/housekeeping/tasks", payload);
      }

      if (roomId) {
        await api.put(`/rooms/${roomId}/status`, { status: "dirty" }).catch(() => {});
      }

      setIsAssignModalOpen(false);
      showToast(`Task assigned to ${staffObj?.full_name || "attendant"} for Room ${targetRoom?.room_number || assignForm.room_id}.`, "success");
      await loadBackendData();
    } catch (err) {
      console.error("Assign task error:", err);
      const errorMsg = err.response?.data?.detail || "Failed to assign task. Please try again.";
      showToast(errorMsg, "error");
    }
  };

  const handleOpenReportModal = (roomItem = null) => {
    setReportForm({
      room_id: roomItem ? roomItem.roomNumber : rooms[0]?.room_number || "101",
      issue_type: "HVAC / Air Conditioning",
      priority: "high",
      description: "",
      blocks_room: true,
    });
    setIsReportModalOpen(true);
  };

  const handleSaveReportProblem = async (e) => {
    e.preventDefault();
    try {
      const targetRoom = rooms.find(
        (r) => String(r.room_number) === String(reportForm.room_id) || String(r.id) === String(reportForm.room_id)
      );
      const roomId = targetRoom ? targetRoom.id : Number(reportForm.room_id);

      const payload = {
        hotel_id: getLoggedInHotelId() || 1,
        room_id: roomId,
        issue_type: reportForm.issue_type,
        priority: reportForm.priority,
        description: reportForm.description,
        blocks_room: reportForm.blocks_room,
      };

      await api.post("/housekeeping/report-problem", payload).catch(async () => {
        await api.post("/maintenance/requests", {
          hotel_id: getLoggedInHotelId() || 1,
          room_id: roomId,
          request_type: reportForm.issue_type,
          priority: reportForm.priority,
          description: reportForm.description,
          status: "pending",
        });
      });

      if (roomId && reportForm.blocks_room) {
        await api.put(`/rooms/${roomId}/status`, { status: "maintenance" }).catch(() => {});
      }

      setIsReportModalOpen(false);
      showToast(`Maintenance issue logged for Room ${targetRoom?.room_number || reportForm.room_id}.`);
      await loadBackendData();
    } catch (err) {
      console.error("Report problem error:", err);
      setIsReportModalOpen(false);
      showToast("Maintenance ticket submitted.");
      await loadBackendData();
    }
  };

  return (
    <div className={`checkout-cleaning-directory ${styles["hk-dashboard-container"]} ${isEmbeddedView ? styles["embedded-view"] : ""}`}>
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* 1. PORTAL HEADER (100% Matching Image 2) */}
      <PortalHeader
        title="Housekeeping Operations"
        kicker="HOUSEKEEPING OPERATIONS"
        description={`Welcome, ${user?.full_name || "Housekeeping HOD"}. Real-time room turnover tracking, attendant assignments, and cleaning operations.`}
        icon={Sparkles}
        isDashboard={true}
        showDateTime={true}
        showBack={!isEmbeddedView && showBack}
        backPath="/dashboard"
        rightAction={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => handleOpenAssignModal()}
              className="portal-action-btn"
              style={{
                background: "#166962",
                color: "#ffffff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                whiteSpace: "nowrap",
              }}
            >
              <Plus size={16} />
              Assign Cleaning Task
            </button>
            <button
              type="button"
              onClick={() => loadBackendData(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "38px",
                height: "38px",
                background: "#ffffff",
                color: "#475569",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                transition: "all 0.15s ease",
              }}
              title="Refresh Housekeeping Records"
              disabled={loading}
            >
              <RotateCw size={15} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
            </button>
          </div>
        }
      />

      {/* 2. TOP STAT / METRIC CARDS ROW (Exact Style Match to Image 2) */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Rooms Monitored"
          value={`${stats.total} Rooms`}
          Icon={BedDouble}
          colorTheme="blue"
          onClick={() => setActiveTab("all")}
        />
        <StatCard
          title="Awaiting Inspection"
          value={`${stats.awaitingInspection} Rooms`}
          Icon={Sparkles}
          colorTheme="purple"
          onClick={() => setActiveTab("inspection")}
        />
        <StatCard
          title="In Cleaning"
          value={`${stats.inCleaning} In Progress`}
          Icon={Clock}
          colorTheme="orange"
          onClick={() => setActiveTab("in-cleaning")}
        />
        <StatCard
          title="Ready for Check-In"
          value={`${stats.ready} Ready`}
          Icon={CheckCircle2}
          colorTheme="green"
          onClick={() => setActiveTab("inspected")}
        />
      </div>

      {/* -------------------------------------------------------------
          3. MAIN OPERATIONS SECTION: TABS, CONTROLS & TABLE
          (100% Matching Image 2 / PMS Directory Portal System)
          ------------------------------------------------------------- */}
      <section className="dir-modules-section">
        {/* Module Header */}
        <ModuleWriternHeader
          title="Room Service & Cleaning Records"
          description="Catalog of room cleaning states, priority turnarounds, staff assignments, and inspection logs"
          badgeCount={filteredRecords.length}
          badgeLabel="rooms"
        />

        {/* 4. STATUS FILTER TABS STRIP (Workflow Sequence: Dirty -> Cleaning -> Inspection -> Done) */}
        <div className="booking-sections-tabs">
          {[
            { key: "all", label: "All Rooms", count: tabCounts.all },
            { key: "dirty", label: "Dirty / Departed", count: tabCounts.dirty },
            { key: "in-cleaning", label: "In Cleaning", count: tabCounts.inCleaning },
            { key: "inspection", label: "Awaiting Inspection", count: tabCounts.inspection },
            { key: "inspected", label: "Inspected & Ready", count: tabCounts.inspected },
            { key: "maintenance", label: "Maintenance Blocked", count: tabCounts.maintenance },
            { key: "archived", label: "Deleted / Archived", count: tabCounts.archived },
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                setActiveTab(chip.key);
                setCurrentPage(1);
              }}
              className={`booking-tab-btn ${activeTab === chip.key ? "active" : ""}`}
            >
              {chip.label} <span className="tab-count-badge">{chip.count}</span>
            </button>
          ))}
        </div>

        {/* 5. CONTROLS & SEARCH BAR */}
        <div className="dir-controls">
          {/* Search Box */}
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by room number, attendant, or task ID..."
            />
            {searchText && (
              <button
                type="button"
                onClick={() => {
                  setSearchText("");
                  setCurrentPage(1);
                }}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Right Action Tools */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={selectedFloor}
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setCurrentPage(1);
              }}
              className="dir-filter-select"
            >
              <option value="all">All Floors</option>
              <option value="1">Floor 1</option>
              <option value="2">Floor 2</option>
              <option value="3">Floor 3</option>
            </select>

            <select
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value);
                setCurrentPage(1);
              }}
              className="dir-filter-select"
            >
              <option value="workflow">Workflow Order (Dirty → In Cleaning → Inspection → Ready)</option>
              <option value="priority">Highest Priority First</option>
              <option value="room_asc">Room Number (Asc)</option>
              <option value="status">Status Grouping</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setSelectedFloor("all");
                setSortMode("workflow");
                setActiveTab("all");
                setCurrentPage(1);
              }}
              className="btn-cancel"
              style={{ height: "40px", padding: "0 16px" }}
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 6. DATA TABLE / TASK RECORD LIST */}
        <div className="dir-table-container">
          <div className={styles["table-scroll-wrap"]}>
            <table className={styles["data-table"]}>
              <thead>
                <tr>
                  <th style={{ minWidth: "160px" }}>Room & Location</th>
                  <th style={{ minWidth: "210px" }}>Assigned Attendant & Shift</th>
                  <th style={{ minWidth: "170px" }}>Room Status & Occupancy</th>
                  <th style={{ minWidth: "280px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className={styles["empty-state"]}>
                      Loading original records from server...
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan="4" className={styles["empty-state"]}>
                      No housekeeping records found matching current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item) => {
                    const isDirty = item.status === "dirty-departed";
                    const isAwaitingInspection = item.status === "awaiting-inspection";
                    const isInspected = item.status === "clean-inspected";
                    const isMaintenance = item.status === "maintenance";
                    const isArchived = item.status === "archived";
                    const isCleaning = item.status === "in-cleaning" || item.status === "stayover-cleaning";

                    return (
                      <tr key={item.isArchived ? `archived-${item.dbTaskId}` : item.id}>
                        {/* 1. Room & Location */}
                        <td>
                          <div className={styles["room-badge-wrap"]}>
                            <div className={styles["room-icon-box"]}>
                              <BedDouble size={16} />
                            </div>
                            <div>
                              <div className={styles["room-num-text"]}>
                                Room {item.roomNumber}
                              </div>
                              <div className={styles["room-sub-meta"]}>
                                {item.roomType} • {item.wing}
                              </div>
                              <span className={styles["task-id-code"]}>
                                {item.taskId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Assigned Attendant & Shift (without phone number) */}
                        <td>
                          <div className={styles["attendant-wrap"]}>
                            <div className={styles["attendant-avatar"]}>
                              {item.attendantInitials}
                            </div>
                            <div>
                              <div className={styles["attendant-name"]}>
                                {item.assignedAttendant}
                              </div>
                              <div className={styles["attendant-shift"]}>
                                {item.shift}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Room Status & Occupancy */}
                        <td>
                          <div>
                            <span
                              className={`${styles["status-pill"]} ${
                                isDirty
                                  ? styles["dirty"]
                                  : isAwaitingInspection
                                  ? styles["inspection"]
                                  : isInspected
                                  ? styles["inspected"]
                                  : isMaintenance
                                  ? styles["maintenance"]
                                  : isArchived
                                  ? styles["archived"]
                                  : styles["cleaning"]
                              }`}
                              style={isArchived ? { background: "#f1f5f9", color: "#64748b", border: "1px solid #cbd5e1" } : {}}
                            >
                              {isInspected && <Check size={11} />}
                              {isDirty && <Clock size={11} />}
                              {isAwaitingInspection && <Sparkles size={11} />}
                              {isMaintenance && <AlertTriangle size={11} />}
                              {isArchived && <Trash2 size={11} />}
                              {!isDirty && !isInspected && !isAwaitingInspection && !isMaintenance && !isArchived && <RotateCw size={11} />}
                              {item.statusLabel}
                            </span>
                            <span className={styles["occupancy-tag"]}>
                              {item.occupancy}
                            </span>
                          </div>
                        </td>
                        {/* 5. Actions */}
                        <td>
                          <div className={styles["row-actions-group"]} style={{ justifyContent: "flex-end" }}>
                            {isAwaitingInspection ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleInspectPass(item)}
                                  className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                                  style={{
                                    background: "#059669", color: "#ffffff", borderColor: "#059669",
                                    fontWeight: 700, boxShadow: "0 1px 2px rgba(5, 150, 105, 0.2)",
                                    padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "5px",
                                  }}
                                  title="Pass inspection: Mark clean & available"
                                >
                                  <Check size={12} /> Pass
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setFailConfirmItem(item); setFailReasonText(""); }}
                                  className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                  style={{
                                    background: "#dc2626", color: "#ffffff", borderColor: "#dc2626",
                                    fontWeight: 700, boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                                    padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "5px",
                                  }}
                                  title="Fail inspection: Return room to Dirty / Departed"
                                >
                                  <X size={12} /> Fail
                                </button>
                              </>
                            ) : isArchived ? (
                              <button
                                type="button"
                                onClick={() => handleRestoreTask(item)}
                                className={styles["action-pill-btn"]}
                                style={{
                                  background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0",
                                  fontWeight: 700, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "5px",
                                }}
                                title="Restore record back to Completed section"
                              >
                                <RotateCw size={11} /> Restore
                              </button>
                            ) : (
                              <>
                                {/* Quick-Assign inline: collapsed button or expanded dropdown */}
                                {quickAssignItemId !== item.id ? (
                                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                    {/* Auto-assign for dirty rooms to previously assigned staff */}
                                    {isDirty && (
                                      <button
                                        type="button"
                                        onClick={() => handleAutoAssignDirty(item)}
                                        disabled={quickAssigning}
                                        style={{
                                          fontSize: "12px", padding: "5px 11px", borderRadius: "6px",
                                          border: "1px solid #1d4ed8", background: "#2563eb",
                                          color: "#fff", fontWeight: 700, cursor: "pointer",
                                          display: "inline-flex", alignItems: "center", gap: "5px",
                                        }}
                                        title="Auto-assign to previously assigned staff"
                                      >
                                        <UserCheck size={12} /> Auto Assign
                                      </button>
                                    )}
                                    {/* Manual assign — opens inline staff dropdown */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQuickAssignItemId(item.id);
                                        setQuickAssignStaffId(
                                          item.assignedStaffId ? String(item.assignedStaffId) :
                                          staffList[0]?.id ? String(staffList[0].id) : ""
                                        );
                                      }}
                                      className={`${styles["action-pill-btn"]} ${styles["assign"]}`}
                                      title="Assign to a housekeeping staff member"
                                    >
                                      <Users size={11} /> Assign
                                    </button>
                                    {/* Report Issue — only for non-inspected rooms */}
                                    {!isInspected && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReportModal(item)}
                                        className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                        title="Report room maintenance issue"
                                      >
                                        <Wrench size={11} /> Issue
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  /* Inline staff picker */
                                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                    <select
                                      value={quickAssignStaffId}
                                      onChange={(e) => setQuickAssignStaffId(e.target.value)}
                                      style={{
                                        fontSize: "12px", padding: "5px 8px", borderRadius: "6px",
                                        border: "1px solid #bfdbfe", background: "#eff6ff",
                                        color: "#1d4ed8", fontWeight: 600, cursor: "pointer", minWidth: "140px",
                                      }}
                                    >
                                      <option value="">-- Select Staff --</option>
                                      {staffList.map((s) => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickAssign(item, quickAssignStaffId)}
                                      disabled={!quickAssignStaffId || quickAssigning}
                                      style={{
                                        fontSize: "12px", padding: "5px 11px", borderRadius: "6px",
                                        border: "1px solid #059669", background: "#059669",
                                        color: "#fff", fontWeight: 700, cursor: "pointer",
                                        display: "inline-flex", alignItems: "center", gap: "4px",
                                      }}
                                    >
                                      <Check size={12} /> {quickAssigning ? "…" : "OK"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setQuickAssignItemId(null); setQuickAssignStaffId(""); }}
                                      style={{
                                        fontSize: "12px", padding: "5px 8px", borderRadius: "6px",
                                        border: "1px solid #e2e8f0", background: "#f8fafc",
                                        color: "#64748b", fontWeight: 600, cursor: "pointer",
                                      }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Bar: Standard ERP Pagination */}
          <div className={styles["table-bottom-bar"]}>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRecords.length}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(newSize) => {
                setPageSize(Number(newSize));
                setCurrentPage(1);
              }}
              pageSizeOptions={[20, 50, 100]}
              itemLabel="rooms"
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          7. HOUSEKEEPING OPERATIONAL DASHBOARD (DIRECTLY BELOW LIST)
          2-Column Auxiliary Widgets Matching Front Desk Visual System
          ------------------------------------------------------------- */}

      {/* ROW 1: Attendant Workload + Recent Operations Log */}
      <div className={styles["two-col-grid"]}>
        {/* Left Column: Housekeeping Attendant Roster */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={16} color="#2563eb" />
                Housekeeping Staff & Attendant Workload
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Live duty status and room cleaning distribution across attendants
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {attendantWorkload.length} Staff Active
            </span>
          </div>

          {/* Quick Staff KPI Summary Strip */}
          <div className={styles["staff-kpi-strip"]}>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Active Roster</span>
              <span className={styles["staff-kpi-val"]}>{staffSummary.totalStaff} Attendants</span>
            </div>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Assigned Tasks</span>
              <span className={styles["staff-kpi-val"]}>{staffSummary.totalAssigned} Rooms</span>
            </div>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Overall Turnover</span>
              <span
                className={styles["staff-kpi-val"]}
                style={{ color: staffSummary.readyRate === 100 ? "#10b981" : "#2563eb" }}
              >
                {staffSummary.readyRate}% Ready
              </span>
            </div>
          </div>

          <div className={styles["attendant-cards-grid"]}>
            {displayedStaff.map((staff) => (
              <div key={staff.id} className={styles["attendant-card"]}>
                <div className={styles["attendant-header"]}>
                  <div className={styles["attendant-profile"]}>
                    <div className={styles["attendant-avatar"]}>{staff.initials}</div>
                    <div>
                      <div className={styles["attendant-name"]}>{staff.name}</div>
                      <div className={styles["attendant-shift"]}>{staff.shift}</div>
                    </div>
                  </div>
                  <span className={styles["attendant-status-tag"]}>On Duty</span>
                </div>

                <div className={styles["attendant-stats-box"]}>
                  <div className={styles["attendant-stat-item"]}>
                    <span className={styles["attendant-stat-val"]}>{staff.totalAssigned}</span>
                    <span className={styles["attendant-stat-lbl"]}>Assigned</span>
                  </div>
                  <div className={styles["attendant-stat-item"]}>
                    <span className={styles["attendant-stat-val"]} style={{ color: "#10b981" }}>
                      {staff.completedRooms}
                    </span>
                    <span className={styles["attendant-stat-lbl"]}>Cleaned</span>
                  </div>
                  <div className={styles["attendant-stat-item"]}>
                    <span
                      className={styles["attendant-stat-val"]}
                      style={{ color: staff.pendingRooms > 0 ? "#f59e0b" : "#64748b" }}
                    >
                      {staff.pendingRooms}
                    </span>
                    <span className={styles["attendant-stat-lbl"]}>Pending</span>
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
                    <span>Turnover Progress</span>
                    <span>{staff.progressPct}%</span>
                  </div>
                  <div className={styles["progress-track"]}>
                    <div
                      className={styles["progress-fill"]}
                      style={{
                        width: `${staff.progressPct}%`,
                        background: staff.progressPct === 100 ? "#10b981" : "#2563eb",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {attendantWorkload.length > 10 && (
            <div className={styles["card-footer-action"]}>
              <button
                type="button"
                onClick={() => setShowAllStaff((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllStaff ? (
                  <>
                    <ChevronUp size={14} /> Show Top 10 Attendants
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> View All Attendants ({attendantWorkload.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Housekeeping Operations Audit Log (Matches Front Desk Operations Log style!) */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={16} color="#3b82f6" />
                Housekeeping Operations Audit Log
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Audit trail of recent room turnovers, inspections, and cleaning tasks
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>Live Log</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "290px", overflowY: "auto", marginTop: "6px" }}>
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
                        backgroundColor: act.status === "completed" ? "#dcfce7" : "#eff6ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {act.status === "completed" ? (
                        <CheckCheck size={14} color="#16a34a" />
                      ) : (
                        <Sparkles size={14} color="#2563eb" />
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ fontSize: "12px", color: "#0f172a" }}>{act.roomNumber}</strong>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                            background: "#f1f5f9",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          }}
                        >
                          {act.staffName}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {act.actionText} • Task #{act.id}
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {act.time}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8", fontSize: "12px" }}>
                No recent cleaning tasks recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 2: Priority Queue + Floor Readiness */}
      <div className={styles["two-col-grid"]}>
        {/* Left Column: Priority Turnover Queue */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={16} color="#d97706" />
                Priority Turnover & Urgent Queue
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Expedited departure turnovers, VIP reservations, and priority room releases
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {priorityTurnoverQueue.length} Active
            </span>
          </div>

          <div className={styles["turnover-list"]}>
            {priorityTurnoverQueue.map((item) => (
              <div key={item.id} className={styles["turnover-item"]}>
                <div className={styles["turnover-info"]}>
                  <div className={styles["turnover-room-title"]}>
                    <span>Room {item.roomNumber}</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                      • {item.roomType}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: item.priority === "VIP ARRIVAL" ? "#fef3c7" : "#fee2e2",
                        color: item.priority === "VIP ARRIVAL" ? "#b45309" : "#dc2626",
                      }}
                    >
                      {item.priority}
                    </span>
                  </div>
                  <div className={styles["turnover-meta"]}>
                    <span>{item.wing}</span>
                    <span>•</span>
                    <span>
                      Attendant: <strong>{item.assignedAttendant}</strong>
                    </span>
                    <span>•</span>
                    <span
                      style={{
                        color: item.status === "dirty-departed" ? "#b45309" : "#059669",
                        fontWeight: 700,
                      }}
                    >
                      {item.statusLabel}
                    </span>
                  </div>
                </div>

                <div>
                  {item.status === "dirty-departed" ? (
                    <button
                      type="button"
                      onClick={() => handleMarkClean(item)}
                      className={`${styles["action-pill-btn"]} ${styles["approve"]}`}
                    >
                      Mark Clean
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInspectApprove(item)}
                      className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                    >
                      <Check size={12} /> Inspect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Floor & Wing Readiness Overview */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers size={16} color="#059669" />
                Floor & Wing Readiness Overview
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Live breakdown of inspected ready rooms vs in-progress across hotel floors
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {floorProgressData.length} Floors Active
            </span>
          </div>

          <div className={styles["floor-progress-list"]}>
            {displayedFloors.map((f) => (
              <div key={f.id} className={styles["floor-item"]}>
                <div className={styles["floor-header"]}>
                  <span className={styles["floor-title"]}>{f.name}</span>
                  <span className={styles["floor-count"]}>
                    <strong style={{ color: "#10b981" }}>{f.clean} Ready</strong> / {f.total} Rooms ({f.pctClean}%)
                  </span>
                </div>
                <div className={styles["floor-bar-track"]}>
                  <div
                    className={styles["floor-bar-clean"]}
                    style={{ width: `${(f.clean / f.total) * 100}%` }}
                    title={`Ready: ${f.clean}`}
                  />
                  <div
                    className={styles["floor-bar-cleaning"]}
                    style={{ width: `${(f.cleaning / f.total) * 100}%` }}
                    title={`Cleaning: ${f.cleaning}`}
                  />
                  <div
                    className={styles["floor-bar-dirty"]}
                    style={{ width: `${(f.dirty / f.total) * 100}%` }}
                    title={`Dirty / Blocked: ${f.dirty}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {floorProgressData.length > 4 && (
            <div className={styles["card-footer-action"]} style={{ marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setShowAllFloors((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllFloors ? (
                  <>
                    <ChevronUp size={14} /> Show Top 4 Floors
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> View All Floors ({floorProgressData.length})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Differential Data: Room Category Readiness Matrix (Eliminates Blank Space) */}
          {roomCategoryReadiness.length > 0 && (
            <div className={styles["floor-diff-section"]}>
              <div className={styles["floor-diff-header"]}>
                <span className={styles["floor-diff-title"]}>
                  <Building size={14} color="#059669" />
                  Room Category Readiness Matrix
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Live turnover by category
                </span>
              </div>
              <div className={styles["category-readiness-grid"]}>
                {roomCategoryReadiness.map((cat) => (
                  <div key={cat.type} className={styles["category-readiness-card"]}>
                    <div className={styles["category-name-row"]}>
                      <span>{cat.type}</span>
                      <span className={styles["category-badge-count"]}>
                        <strong style={{ color: "#10b981" }}>{cat.clean}</strong> / {cat.total} Ready ({cat.pct}%)
                      </span>
                    </div>
                    <div className={styles["category-progress-track"]}>
                      <div
                        className={styles["category-progress-fill"]}
                        style={{
                          width: `${cat.pct}%`,
                          background: cat.pct === 100 ? "#10b981" : cat.pct > 50 ? "#0ea5e9" : "#f59e0b",
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
          MODAL 1: ASSIGN TASK (Connected to Real Backend Staff & Rooms)
          ------------------------------------------------------------- */}
      {isAssignModalOpen && (
        <div className={styles["modal-overlay"]} onClick={() => setIsAssignModalOpen(false)}>
          <div className={styles["modal-content-card"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <h3 className={styles["modal-title"]}>Assign Cleaning Task</h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className={styles["modal-close-btn"]}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAssignTask}>
              <div className={styles["modal-body"]}>
                <div className={styles["form-row"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Select Room *</label>
                    <select
                      value={assignForm.room_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        const matchedRoom = rooms.find((r) => String(r.room_number) === String(val) || String(r.id) === String(val));
                        setAssignForm((prev) => ({
                          ...prev,
                          room_id: val,
                          target_room_id: matchedRoom?.id || null,
                          task_id: null,
                        }));
                      }}
                      className={styles["form-select"]}
                      required
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.room_number}>
                          Room {r.room_number} ({r.room_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Cleaning Type *</label>
                    <select
                      value={assignForm.task_type}
                      onChange={(e) => setAssignForm({ ...assignForm, task_type: e.target.value })}
                      className={styles["form-select"]}
                    >
                      <option value="checkout-cleaning">Checkout Turnover Cleaning</option>
                      <option value="stayover-cleaning">Stayover Guest Cleaning</option>
                      <option value="deep-cleaning">Deep Sanitization & Inspection</option>
                    </select>
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Assign Attendant *</label>
                    <select
                      value={assignForm.assigned_staff_id}
                      onChange={(e) => setAssignForm({ ...assignForm, assigned_staff_id: e.target.value })}
                      className={styles["form-select"]}
                      required
                    >
                      <option value="">-- Select Attendant --</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.department || "Housekeeping"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>Special Instructions / Remarks</label>
                  <textarea
                    rows={3}
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                    placeholder="e.g. Guest requested extra towels and expedited afternoon cleaning..."
                    className={styles["form-textarea"]}
                  />
                </div>
              </div>

              <div className={styles["modal-footer"]}>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className={styles["btn-secondary"]}
                >
                  Cancel
                </button>
                <button type="submit" className={styles["btn-primary"]}>
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 2: REPORT MAINTENANCE ISSUE (Connected to Backend)
          ------------------------------------------------------------- */}
      {isReportModalOpen && (
        <div className={styles["modal-overlay"]} onClick={() => setIsReportModalOpen(false)}>
          <div className={styles["modal-content-card"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <h3 className={styles["modal-title"]}>Report Room Maintenance Issue</h3>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className={styles["modal-close-btn"]}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReportProblem}>
              <div className={styles["modal-body"]}>
                <div className={styles["form-row"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Room Number *</label>
                    <select
                      value={reportForm.room_id}
                      onChange={(e) => setReportForm({ ...reportForm, room_id: e.target.value })}
                      className={styles["form-select"]}
                      required
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.room_number}>
                          Room {r.room_number} ({r.room_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Issue Category *</label>
                    <select
                      value={reportForm.issue_type}
                      onChange={(e) => setReportForm({ ...reportForm, issue_type: e.target.value })}
                      className={styles["form-select"]}
                    >
                      <option value="HVAC / Air Conditioning">HVAC / Air Conditioning</option>
                      <option value="Plumbing & Bathroom">Plumbing & Bathroom</option>
                      <option value="Electrical & Lighting">Electrical & Lighting</option>
                      <option value="Carpentry & Furniture">Carpentry & Furniture</option>
                      <option value="Door Lock & Keycard">Door Lock & Keycard</option>
                      <option value="TV & Electronics">TV & Electronics</option>
                    </select>
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Urgency / Priority</label>
                    <select
                      value={reportForm.priority}
                      onChange={(e) => setReportForm({ ...reportForm, priority: e.target.value })}
                      className={styles["form-select"]}
                    >
                      <option value="high">High (Immediate repair)</option>
                      <option value="medium">Normal / Medium</option>
                      <option value="low">Low (Cosmetic)</option>
                    </select>
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]}>Block Room Status?</label>
                    <select
                      value={reportForm.blocks_room ? "yes" : "no"}
                      onChange={(e) => setReportForm({ ...reportForm, blocks_room: e.target.value === "yes" })}
                      className={styles["form-select"]}
                    >
                      <option value="yes">Yes - Mark Room Out of Order</option>
                      <option value="no">No - Keep Room Active</option>
                    </select>
                  </div>
                </div>

                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>Issue Description *</label>
                  <textarea
                    rows={3}
                    required
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    placeholder="Describe the problem observed during housekeeping..."
                    className={styles["form-textarea"]}
                  />
                </div>
              </div>

              <div className={styles["modal-footer"]}>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className={styles["btn-secondary"]}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles["btn-primary"]}
                  style={{ background: "#dc2626" }}
                >
                  Submit Maintenance Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* -------------------------------------------------------------
          MODAL 3: CONFIRM SOFT DELETE / MOVE TO DELETED SECTION
          (Custom Modal Replacing Native Browser window.confirm)
          ------------------------------------------------------------- */}
      {deleteConfirmItem && (
        <div className={styles["modal-overlay"]} onClick={() => setDeleteConfirmItem(null)}>
          <div className={styles["modal-content-card"]} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <div className={styles["modal-header"]} style={{ background: "#fef2f2", borderBottom: "1px solid #fee2e2" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className={styles["modal-title"]} style={{ color: "#991b1b", fontSize: "16px" }}>
                    Move to Deleted Records
                  </h3>
                  <span style={{ fontSize: "11px", color: "#b91c1c" }}>
                    Room {deleteConfirmItem.roomNumber} ({deleteConfirmItem.taskId})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className={styles["modal-close-btn"]}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles["modal-body"]} style={{ padding: "20px 24px" }}>
              <p style={{ margin: "0 0 14px 0", fontSize: "13.5px", color: "#1e293b", lineHeight: "1.5" }}>
                Are you sure you want to move the cleaning record for <strong>Room {deleteConfirmItem.roomNumber}</strong> to the Deleted section?
              </p>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "#64748b" }}>Attendant:</span>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{deleteConfirmItem.assignedAttendant}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "#64748b" }}>Status:</span>
                  <span style={{ fontWeight: 600, color: "#059669" }}>Completed & Inspected</span>
                </div>
              </div>

              <div style={{ marginTop: "14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#1e40af", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 700 }}>Note:</span>
                <span>This entry will NOT be permanently deleted. It will be safely moved to the <strong>Deleted / Archived</strong> section next to Maintenance Blocked and can be restored anytime.</span>
              </div>
            </div>

            <div className={styles["modal-footer"]} style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "14px 24px" }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className={styles["btn-secondary"]}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeSoftDelete(deleteConfirmItem)}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                }}
              >
                <Trash2 size={14} />
                Move to Deleted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 4: CONFIRM INSPECTION FAILURE (Move to Dirty / Departed)
          (Custom Modal Replacing Native Browser window.prompt)
          ------------------------------------------------------------- */}
      {failConfirmItem && (
        <div className={styles["modal-overlay"]} onClick={() => setFailConfirmItem(null)}>
          <div className={styles["modal-content-card"]} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <div className={styles["modal-header"]} style={{ background: "#fef2f2", borderBottom: "1px solid #fee2e2" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className={styles["modal-title"]} style={{ color: "#991b1b", fontSize: "16px" }}>
                    Fail Room Inspection
                  </h3>
                  <span style={{ fontSize: "11px", color: "#b91c1c" }}>
                    Room {failConfirmItem.roomNumber} ({failConfirmItem.taskId})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFailConfirmItem(null)}
                className={styles["modal-close-btn"]}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles["modal-body"]} style={{ padding: "20px 24px" }}>
              <p style={{ margin: "0 0 12px 0", fontSize: "13.5px", color: "#1e293b", lineHeight: "1.5" }}>
                Mark inspection as failed for <strong>Room {failConfirmItem.roomNumber}</strong>? The room will be returned to <strong>Dirty / Departed</strong> for re-cleaning.
              </p>

              <div className={styles["form-field"]}>
                <label className={styles["form-label"]}>Reason for Failure / Rework Instructions:</label>
                <textarea
                  rows={3}
                  value={failReasonText}
                  onChange={(e) => setFailReasonText(e.target.value)}
                  placeholder="e.g. Bathroom floor not sanitized, bed linen needs replacement, dust on headboard..."
                  className={styles["form-textarea"]}
                  autoFocus
                />
              </div>

              <div style={{ marginTop: "10px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#92400e", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <Clock size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span>The room state will immediately change to <strong>Dirty / Departed</strong> so the attendant can re-clean and resubmit.</span>
              </div>
            </div>

            <div className={styles["modal-footer"]} style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "14px 24px" }}>
              <button
                type="button"
                onClick={() => setFailConfirmItem(null)}
                className={styles["btn-secondary"]}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeInspectFail(failConfirmItem, failReasonText)}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                }}
              >
                <X size={14} />
                Confirm Fail & Move to Dirty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
