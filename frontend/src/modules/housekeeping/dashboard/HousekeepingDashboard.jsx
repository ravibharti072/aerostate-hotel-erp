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
  History,
  ShieldCheck,
  PackageCheck,
  Activity,
  CheckCheck,
  Trash2,
  ClipboardCheck,
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

/** "Oct 2, 2026, 06:20 PM" for the lifecycle log rows. */
export const formatTrailDateTime = (dateVal) => {
  const d = parseServerDate(dateVal);
  if (!d || isNaN(d.getTime())) return "time not recorded";
  return d.toLocaleString([], {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

/**
 * Returns standardized cleaning type metadata, badge styling class, and contextual subtext.
 * Guarantees human-friendly labels (Checkout Turnover / Stayover Cleaning / Deep Sanitization / Room Cleaning).
 */
export const getTaskTypeMeta = (rawType, task, roomStatus, isOccupied) => {
  const norm = String(rawType || "").toLowerCase().trim();
  let key = "checkout-cleaning";
  let label = "Checkout Turnover";
  let badgeClass = "cleaning-type-checkout";
  let badgeColor = "#1d4ed8";
  let badgeBg = "#eff6ff";
  let badgeBorder = "#bfdbfe";

  if (norm === "stayover-cleaning" || norm.includes("stayover") || (isOccupied && !norm.includes("deep"))) {
    key = "stayover-cleaning";
    label = "Stayover Cleaning";
    badgeClass = "cleaning-type-stayover";
    badgeColor = "#b45309";
    badgeBg = "#fffbeb";
    badgeBorder = "#fde68a";
  } else if (norm === "deep-cleaning" || norm.includes("deep") || norm.includes("sanitize")) {
    key = "deep-cleaning";
    label = "Deep Sanitization";
    badgeClass = "cleaning-type-deep";
    badgeColor = "#7c3aed";
    badgeBg = "#f5f3ff";
    badgeBorder = "#ddd6fe";
  } else if (norm === "room-cleaning" || norm === "cleaning") {
    key = "room-cleaning";
    label = "Room Cleaning";
    badgeClass = "cleaning-type-room";
    badgeColor = "#047857";
    badgeBg = "#ecfdf5";
    badgeBorder = "#a7f3d0";
  } else if (norm === "checkout-cleaning" || norm.includes("turnover") || norm.includes("checkout")) {
    key = "checkout-cleaning";
    label = "Checkout Turnover";
    badgeClass = "cleaning-type-checkout";
    badgeColor = "#1d4ed8";
    badgeBg = "#eff6ff";
    badgeBorder = "#bfdbfe";
  } else if (norm) {
    key = norm;
    label = norm.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    badgeClass = "cleaning-type-checkout";
    badgeColor = "#1d4ed8";
    badgeBg = "#eff6ff";
    badgeBorder = "#bfdbfe";
  }

  // Determine intelligent contextual subtext
  let subtext = "Raised automatically at checkout";
  const notesLower = String(task?.notes || "").toLowerCase();
  const createdByLower = String(task?.created_by || "").toLowerCase();

  if (key === "stayover-cleaning") {
    subtext = "Daily guest stayover service";
  } else if (key === "deep-cleaning") {
    subtext = "Periodic deep sanitization";
  } else if (
    createdByLower.includes("auto") ||
    createdByLower.includes("checkout") ||
    notesLower.includes("auto-created") ||
    notesLower.includes("turnover cleaning for room")
  ) {
    subtext = "Raised automatically at checkout";
  } else if (
    createdByLower.includes("hod") ||
    createdByLower.includes("supervisor") ||
    createdByLower.includes("manager") ||
    notesLower.includes("assigned by supervisor") ||
    notesLower.includes("assigned by hod")
  ) {
    subtext = "Assigned by the HOD";
  } else if (roomStatus === "clean-inspected") {
    subtext = "Turnover cycle completed";
  } else {
    subtext = "Raised automatically at checkout";
  }

  return { key, label, subtext, badgeClass, badgeColor, badgeBg, badgeBorder };
};

/**
 * Builds the room-turnover lifecycle trail for one task, e.g.
 *   Assigned -> Cleaning Started -> Cleaning Completed -> HOD Cleared / Sent back for re-clean
 * Only the CURRENT cycle is returned: a room that went dirty -> cleaned -> failed -> re-cleaned ->
 * passed has several historical attempts, and the HOD only cares about the live one.
 */
export const buildTaskLifecycleEvents = (task) => {
  if (!task) return [];
  const notes = String(task.notes || "");
  const roomLabel = task.room_number || task.room_id || "";
  const events = [];
  const add = (ev) => events.push(ev);

  const base = (stage, stageLabel, badgeColor, title, details, timestamp, actor, role) => ({
    id: `${task.id}-${stage}-${events.length}`,
    stage, stageLabel, badgeColor, title, details, timestamp, actor, role,
  });

  // 1. Created / assigned when the room went dirty
  add({
    ...base("ASSIGNED", "Assigned by HOD", "#2563eb", `Room ${roomLabel} assigned for turnover`,
      `Assigned to ${task.assigned_to || "unassigned"}. Priority: ${String(task.priority || "normal").toUpperCase()}.`,
      task.created_at, task.created_by || "Housekeeping HOD", "Housekeeping HOD / Supervisor"),
    _origin: true,
  });

  // 2. Cleaning started (task field)
  if (task.started_at) {
    add(base("STARTED", "Cleaning Started", "#d97706", `Cleaning started for Room ${roomLabel}`,
      "Attendant started the turnover: linen turnaround, trash removal and bathroom sanitization.",
      task.started_at, task.started_by || task.assigned_to || "Room Attendant", "Room Attendant"));
  }

  // 3. Walk the note log so each completion / verdict lands at its recorded position
  let inherited = task.started_at || task.created_at;
  const isoFrom = (line) => {
    const m = line.match(/at\s+([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:\.]+Z)/i);
    return m ? m[1] : null;
  };

  notes.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const found = isoFrom(line);
    const at = found || inherited;
    if (found) inherited = found;

    if (/^Assignment:/i.test(line)) {
      add({
        ...base("ASSIGNED", "Assignment Updated", "#2563eb", `Attendant assigned for Room ${roomLabel}`,
          line.replace(/^Assignment:\s*/i, "").trim(),
          at, task.assigned_to || "Housekeeping HOD", "Housekeeping HOD / Supervisor"),
        _isNote: true,
      });
    } else if (/\[Cleaning Completed/i.test(line)) {
      const actor = (line.match(/by\s+(.+?)\s+at\s/i) || [])[1] || task.completed_by || task.assigned_to || "Attendant";
      add(base("COMPLETED", "Cleaning Completed", "#0284c7",
        `Turnover completed & submitted for Room ${roomLabel}`,
        "Submitted to the HOD for inspection clearance.", at, actor.trim(), "Room Attendant"));
    } else if (/\[Inspection PASSED/i.test(line)) {
      const actor = (line.match(/by\s+(.+?)(?:\s+at\s|:|\]|$)/i) || [])[1] || "Housekeeping HOD";
      const remarks = (line.match(/Remarks:\s*(.*)/i) || [])[1] || "";
      add(base("INSPECTION_PASSED", "HOD Cleared & Passed", "#059669",
        `Inspection passed for Room ${roomLabel}`,
        remarks.trim() || "Room verified clean and marked Available in the PMS.",
        at, actor.trim(), "Housekeeping HOD"));
    } else if (/\[Inspection FAILED/i.test(line)) {
      const actor = (line.match(/by\s+(.+?)(?:\s+at\s|:|\]|$)/i) || [])[1] || "Housekeeping HOD";
      const reason = (line.match(/Reason:\s*(.*)/i) || [])[1] || "";
      add(base("INSPECTION_FAILED", "HOD Sent Back for Re-clean", "#dc2626",
        `Inspection rejected for Room ${roomLabel}`,
        reason.trim() || "Room returned to Dirty / Departed for rework.",
        at, actor.trim(), "Housekeeping HOD"));
    } else if (/\[(Turnover Re-cleaning|Cleaning) Started/i.test(line)) {
      const actor = (line.match(/by\s+([^\s\]]+)/i) || [])[1] || task.assigned_to || "Attendant";
      add({
        ...base("STARTED", "Cleaning Started", "#d97706", `Cleaning started for Room ${roomLabel}`,
          "Attendant resumed the turnover work.", at, actor.trim(), "Room Attendant"),
        _isNote: true,
      });
    }
  });

  // 4. Submitted and still waiting on the HOD
  const low = notes.toLowerCase();
  const lastVerdict = Math.max(low.lastIndexOf("[inspection passed"), low.lastIndexOf("[inspection failed"));
  const lastSubmit = low.lastIndexOf("[cleaning completed");
  if (lastSubmit !== -1 && lastSubmit > lastVerdict && task.completed_at) {
    add(base("AWAITING_HOD", "Awaiting HOD Inspection", "#9333ea",
      `Room ${roomLabel} waiting for HOD clearance`,
      "Turnover submitted; waiting for the HOD to pass or send it back.",
      task.completed_at, "Housekeeping HOD / Supervisor", "HOD Clearance Queue"));
  }

  // 5. Keep only the trailing cycle: everything after the second-to-last verdict, i.e. the last
  //    attempt plus the verdict that closed it.
  const verdictIdx = events
    .map((ev, i) => ({ ev, i }))
    .filter(({ ev }) => ev.stage === "INSPECTION_PASSED" || ev.stage === "INSPECTION_FAILED")
    .map(({ i }) => i);
  const lastCycleIdx = verdictIdx.length > 1 ? verdictIdx[verdictIdx.length - 2] : -1;
  const cycleFromMs =
    lastCycleIdx >= 0
      ? parseServerDate(events[lastCycleIdx].timestamp)?.getTime() ?? 0
      : parseServerDate(task.started_at || task.created_at)?.getTime() ?? 0;
  const cycleEvents = lastCycleIdx >= 0 ? events.slice(lastCycleIdx) : events;

  // 6. Chronological order. Note-only entries carry no time of their own, so they inherit the nearest
  //    earlier recorded timestamp instead of the task's current updated_at.
  const ordered = cycleEvents
    .map((ev) => ({ ...ev, _at: parseServerDate(ev.timestamp)?.getTime() ?? 0 }))
    .sort((a, b) => a._at - b._at || String(a.id).localeCompare(String(b.id)))
    .filter((ev) => ev._origin || ev._at >= cycleFromMs);

  // 7. Drop noise: repeated assignment clicks, and a cycle start recorded twice (task field + note).
  let assignmentSeen = false;
  const seenStartAt = new Set(
    ordered.filter((ev) => ev.stage === "STARTED" && !ev._isNote).map((ev) => ev.timestamp),
  );
  return ordered
    .filter((ev) => {
      if (ev._origin) {
        assignmentSeen = true;
        return true;
      }
      if (ev.stage === "STARTED" && ev._isNote) {
        if (seenStartAt.has(ev.timestamp)) return false;
        seenStartAt.add(ev.timestamp);
        return true;
      }
      if (ev.stage === "ASSIGNED") {
        if (assignmentSeen) return false;
        assignmentSeen = true;
      }
      return true;
    })
    .map(({ _at, _isNote, _origin, ...ev }, i) => ({ ...ev, id: `${task.id}-${ev.stage}-${i}` }));
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
  const [sortMode, setSortMode] = useState("room_asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // Cleaning timing log has its own pager so it does not disturb the room table
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(20);
  // Lifecycle audit trail (Dirty -> Cleaning Started -> Completed -> Inspected) for one room
  const [trailTask, setTrailTask] = useState(null);

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

      // Assigned attendant: room.assigned_staff_id is the primary designated attendant!
      const targetStaffId = r.assigned_staff_id || activeTask?.assigned_staff_id;
      const matchedStaff = targetStaffId ? rawStaff.find((s) => Number(s.id) === Number(targetStaffId)) : null;

      let attendantName = matchedStaff?.full_name || activeTask?.assigned_to || activeTask?.completed_by || "Unassigned";
      if (attendantName === "Unassigned" && matchedStaff) {
        attendantName = matchedStaff.full_name;
      }

      const staffObj = matchedStaff || (attendantName !== "Unassigned" ? rawStaff.find((s) => s.full_name?.toLowerCase() === attendantName?.toLowerCase()) : null);
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
        // Raw task row so the timing log can reuse the lifecycle builder without re-fetching
        rawTask: activeTask || null,
        // Raw DB status of the active task (pending / in-progress / completed / archived)
        taskStatus: activeTask ? String(activeTask.status || "") : "",
        // Standardized cleaning job metadata (Checkout Turnover, Stayover Cleaning, Deep Sanitization, Room Cleaning)
        taskType: (() => {
          const rawType = activeTask?.task_type || activeTask?.taskType || latestTaskOverall?.task_type || latestTaskOverall?.taskType || (isOccupied ? "stayover-cleaning" : "checkout-cleaning");
          return getTaskTypeMeta(rawType, activeTask || latestTaskOverall, statusKey, isOccupied).key;
        })(),
        taskTypeKey: (() => {
          const rawType = activeTask?.task_type || activeTask?.taskType || latestTaskOverall?.task_type || latestTaskOverall?.taskType || (isOccupied ? "stayover-cleaning" : "checkout-cleaning");
          return getTaskTypeMeta(rawType, activeTask || latestTaskOverall, statusKey, isOccupied).key;
        })(),
        taskTypeLabel: (() => {
          const rawType = activeTask?.task_type || activeTask?.taskType || latestTaskOverall?.task_type || latestTaskOverall?.taskType || (isOccupied ? "stayover-cleaning" : "checkout-cleaning");
          return getTaskTypeMeta(rawType, activeTask || latestTaskOverall, statusKey, isOccupied).label;
        })(),
        taskTypeSubtext: (() => {
          const rawType = activeTask?.task_type || activeTask?.taskType || latestTaskOverall?.task_type || latestTaskOverall?.taskType || (isOccupied ? "stayover-cleaning" : "checkout-cleaning");
          return getTaskTypeMeta(rawType, activeTask || latestTaskOverall, statusKey, isOccupied).subtext;
        })(),
        taskTypeBadgeClass: (() => {
          const rawType = activeTask?.task_type || activeTask?.taskType || latestTaskOverall?.task_type || latestTaskOverall?.taskType || (isOccupied ? "stayover-cleaning" : "checkout-cleaning");
          return getTaskTypeMeta(rawType, activeTask || latestTaskOverall, statusKey, isOccupied).badgeClass;
        })(),
      };
    });

    return liveRecords.filter(Boolean);
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
    } else if (activeTab === "maintenance") {
      result = result.filter((r) => r.status === "maintenance");
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

  // Cleaning timing log: TODAY's events from every room's latest cleaning cycle, newest first.
  // This replaces the removed "Inspected & Ready" tab — finished rooms are represented here by their
  // lifecycle stages (assigned -> cleaning started -> completed -> HOD verdict) with real timestamps.
  const timingLogRows = useMemo(() => {
    const now = new Date();
    const isToday = (dateVal) => {
      const d = parseServerDate(dateVal);
      return (
        !!d &&
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };

    const rows = [];
    records.forEach((item) => {
      if (!item.rawTask) return;
      buildTaskLifecycleEvents(item.rawTask).forEach((ev) => {
        if (!isToday(ev.timestamp)) return;
        rows.push({
          ...ev,
          roomNumber: item.roomNumber,
          boardStatusLabel: item.statusLabel,
          boardTaskId: item.taskId,
          taskTypeKey: item.taskTypeKey || "checkout-cleaning",
          taskTypeLabel: item.taskTypeLabel || "Checkout Turnover",
          taskTypeBadgeClass: item.taskTypeBadgeClass || "cleaning-type-checkout",
          _at: parseServerDate(ev.timestamp)?.getTime() || 0,
        });
      });
    });
    return rows.sort((a, b) => b._at - a._at);
  }, [records]);

  // 20 entries per page by default
  const logTotalPages = Math.max(1, Math.ceil(timingLogRows.length / (Number(logPageSize) || 20)));
  const pagedTimingLog = useMemo(() => {
    const size = Number(logPageSize) || 20;
    return timingLogRows.slice((logPage - 1) * size, (logPage - 1) * size + size);
  }, [timingLogRows, logPage, logPageSize]);

  // Keep the log on a valid page when its row count shrinks (e.g. a new day starts)
  useEffect(() => {
    if (logPage > logTotalPages) setLogPage(1);
  }, [logPage, logTotalPages]);

  // The Deleted / Archived and Inspected & Ready views were removed from this board, so never leave
  // the room list parked on one of them.
  useEffect(() => {
    if (activeTab === "archived" || activeTab === "inspected") setActiveTab("all");
  }, [activeTab]);

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
  // Quick-Assign: directly assign staff from inline dropdown (no full modal needed)
  const handleQuickAssign = async (item, staffId) => {
    if (!staffId) { showToast("Please select a staff member.", "error"); return; }
    setQuickAssigning(true);
    try {
      const sid = Number(staffId);
      const staffObj = staffList.find((s) => Number(s.id) === sid);
      const roomId = item.id;

      // Assign staff permanently to this room & update any active task
      await api.post(`/housekeeping/rooms/${roomId}/assign-staff`, {
        staff_id: sid,
      });

      setQuickAssignItemId(null);
      setQuickAssignStaffId("");
      showToast(`Room ${item.roomNumber} designated to ${staffObj?.full_name || "attendant"}. Future turnovers will auto-assign to them.`, "success");
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
    const prevTask = [...tasks]
      .filter((t) => Number(t.room_id) === Number(item.id) && t.assigned_staff_id)
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];

    const autoStaffId = item.assignedStaffId || prevTask?.assigned_staff_id;
    if (autoStaffId) {
      await handleQuickAssign(item, autoStaffId);
    } else if (staffList.length > 0) {
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

      // Assign staff permanently to this room & update any active task
      await api.post(`/housekeeping/rooms/${roomId}/assign-staff`, {
        staff_id: staffId,
      });

      setIsAssignModalOpen(false);
      showToast(`Room ${targetRoom?.room_number || assignForm.room_id} designated to ${staffObj?.full_name || "attendant"}.`, "success");
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
              onClick={() => navigate("/checklists")}
              className="portal-action-btn"
              style={{
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                whiteSpace: "nowrap",
              }}
              title="Configure dynamic turnover and inspection checklists"
            >
              <ClipboardCheck size={16} color="#059669" />
              Cleaning Checklists
            </button>
            <button
              type="button"
              onClick={() => navigate("/housekeeping/staff")}
              className="portal-action-btn"
              style={{
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                whiteSpace: "nowrap",
              }}
              title="Open Room Attendant Cleaning Portal"
            >
              <Users size={16} color="#2563eb" />
              Staff View
            </button>
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
        {/* Ready-for-check-in tally only — the "Inspected & Ready" tab was removed, so this card no
            longer drives the room list. */}
        <StatCard
          title="Ready for Check-In"
          value={`${stats.ready} Ready`}
          Icon={CheckCircle2}
          colorTheme="green"
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
              <option value="room_asc">Room Number (101 → 303)</option>
              <option value="workflow">Workflow Order (Dirty → In Cleaning → Inspection → Ready)</option>
              <option value="priority">Highest Priority First</option>
              <option value="status">Status Grouping</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setSelectedFloor("all");
                setSortMode("room_asc");
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
                  <th style={{ minWidth: "200px" }}>Assigned Attendant & Shift</th>
                  <th style={{ minWidth: "165px" }}>Room Status & Occupancy</th>
                  <th style={{ minWidth: "150px" }}>Cleaning Type</th>
                  <th style={{ minWidth: "200px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className={styles["empty-state"]}>
                      Loading original records from server...
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={styles["empty-state"]}>
                      No housekeeping records found matching current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item) => {
                    const isDirty = item.status === "dirty-departed";
                    const isAwaitingInspection = item.status === "awaiting-inspection";
                    const isInspected = item.status === "clean-inspected";
                    const isMaintenance = item.status === "maintenance";
                    const isCleaning = item.status === "in-cleaning" || item.status === "stayover-cleaning";
                    // Reassigning is available on every room in the list — the HOD owns staffing. The
                    // backend keeps a submitted turnover in the inspection queue and only swaps the
                    // attendant, so assigning can never pull work back out of the HOD's queue.
                    const canAssign = !isMaintenance;

                    return (
                      <tr key={item.id}>
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
                              {/* Timing log is only for rooms still in the cleaning workflow. */}
                              {!isInspected && (
                                <button
                                  type="button"
                                  className={styles["task-id-link"]}
                                  onClick={() => setTrailTask(item)}
                                  title="View this room's current cleaning cycle with timings"
                                >
                                  <History size={11} /> {item.taskId} • Timing log
                                </button>
                              )}
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
                                  : styles["cleaning"]
                              }`}
                            >
                              {isInspected && <Check size={11} />}
                              {isDirty && <Clock size={11} />}
                              {isAwaitingInspection && <Sparkles size={11} />}
                              {isMaintenance && <AlertTriangle size={11} />}
                              {!isDirty && !isInspected && !isAwaitingInspection && !isMaintenance && <RotateCw size={11} />}
                              {item.statusLabel}
                            </span>
                            <span className={styles["occupancy-tag"]}>
                              {item.occupancy}
                            </span>
                          </div>
                        </td>
                        {/* 4. Cleaning Type — checkout turnover vs stayover vs HOD deep clean */}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span
                              className={`${styles["cleaning-type-tag"]} ${styles[item.taskTypeBadgeClass] || styles["cleaning-type-checkout"]}`}
                              title={`Cleaning job type: ${item.taskTypeLabel}`}
                            >
                              {item.taskTypeLabel}
                            </span>
                            <span className={styles["occupancy-tag"]}>
                              {item.taskTypeSubtext}
                            </span>
                          </div>
                        </td>
                        {/* 5. Actions */}
                        <td>
                          <div className={styles["row-actions-group"]}>
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
                            ) : (
                              <>
                                {/* Quick-Assign inline: collapsed button or expanded dropdown */}
                                {quickAssignItemId !== item.id ? (
                                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                    {/* Assigning a room is always an explicit HOD choice — a room that
                                        goes dirty is auto-assigned to its previous attendant by the
                                        backend when the turnover task is created. */}
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

      {/* ROW 1: Cleaning Timing Log + Housekeeping Operations Audit Log */}
      <div className={styles["two-col-grid"]}>
        {/* Left Column: Cleaning Timing Log (today's lifecycle stages, newest first) */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <History size={16} color="#7c3aed" />
                Cleaning Timing Log
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Today's lifecycle: assigned, cleaning started, completed, HOD verdict — with times
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>{timingLogRows.length} events today</span>
          </div>

          <div className={styles["timing-log-list"]}>
            {pagedTimingLog.length === 0 ? (
              <div className={styles["timing-log-empty"]}>No cleaning activity recorded today.</div>
            ) : (
              pagedTimingLog.map((log, idx) => (
                <div key={`${log.boardTaskId}-${log.stage}-${idx}`} className={styles["timing-log-row"]}>
                  <span className={styles["timing-log-stage"]} style={{ background: log.badgeColor }}>
                    {log.stageLabel}
                  </span>
                  <div className={styles["timing-log-body"]}>
                    <div className={styles["timing-log-line1"]}>
                      <strong>Room {log.roomNumber}</strong>
                      <span className={styles["log-task-id"]}>{log.boardTaskId}</span>
                      <span
                        className={`${styles["cleaning-type-tag"]} ${styles[log.taskTypeBadgeClass] || styles["cleaning-type-checkout"]}`}
                      >
                        {log.taskTypeLabel}
                      </span>
                      <span className={styles["timing-log-when"]}>
                        <Clock size={11} /> {formatTrailDateTime(log.timestamp)}
                      </span>
                    </div>
                    <div className={styles["timing-log-line2"]}>
                      <strong>{log.actor}</strong> • {log.role}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {timingLogRows.length > 0 && (
            <div className={styles["card-footer-action"]}>
              <Pagination
                currentPage={logPage}
                totalItems={timingLogRows.length}
                pageSize={logPageSize}
                onPageChange={(page) => setLogPage(page)}
                onPageSizeChange={(newSize) => {
                  setLogPageSize(Number(newSize));
                  setLogPage(1);
                }}
                pageSizeOptions={[20, 50, 100]}
                itemLabel="entries"
              />
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

      {/* ROW 3: Housekeeping Staff & Attendant Workload */}
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
            <span className={styles["card-badge-muted"]}>{attendantWorkload.length} Staff Active</span>
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
          MODAL 4: ROOM CLEANING LIFECYCLE / TIMING LOG
          Dirty -> Cleaning Started -> Completed & Submitted -> HOD verdict, with times
          ------------------------------------------------------------- */}
      {trailTask && (
        <div className={styles["modal-overlay"]} onClick={() => setTrailTask(null)}>
          <div
            className={styles["modal-content-card"]}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "620px", maxHeight: "88vh", display: "flex", flexDirection: "column" }}
          >
            <div className={styles["modal-header"]}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                  <History size={18} />
                </div>
                <div>
                  <h3 className={styles["modal-title"]} style={{ fontSize: "16px" }}>
                    Room {trailTask.roomNumber} • Cleaning Timing Log
                  </h3>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {trailTask.taskId} • current cycle, every stage with its timestamp
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setTrailTask(null)} className={styles["modal-close-btn"]}>
                <X size={18} />
              </button>
            </div>

            <div className={styles["modal-body"]} style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px",
                  background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px",
                  padding: "10px 14px", marginBottom: "18px",
                }}
              >
                <div>
                  <div style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Attendant</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {trailTask.assignedAttendant || "Unassigned"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Cleaning Type</div>
                  <div style={{ marginTop: "2px" }}>
                    <span
                      className={`${styles["cleaning-type-tag"]} ${styles[trailTask.taskTypeBadgeClass] || styles["cleaning-type-checkout"]}`}
                    >
                      {trailTask.taskTypeLabel}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Current State</div>
                  <div>
                    <span className={`${styles["status-pill"]} ${
                      trailTask.status === "dirty-departed" ? styles["dirty"]
                        : trailTask.status === "awaiting-inspection" ? styles["inspection"]
                        : trailTask.status === "clean-inspected" ? styles["inspected"]
                        : styles["cleaning"]
                    }`}>
                      {trailTask.statusLabel}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Initiation</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginTop: "2px" }}>
                    {trailTask.taskTypeSubtext || "Turnover cycle"}
                  </div>
                </div>
              </div>

              {trailTask.rawTask && Array.isArray(trailTask.rawTask.checklist) && trailTask.rawTask.checklist.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ClipboardCheck size={16} color="#059669" />
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>
                        Attendant Checklist Verification (HOD Template)
                      </span>
                    </div>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#059669",
                      background: "#ecfdf5",
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}>
                      {trailTask.rawTask.checklist.filter((c) => c.checked).length} of {trailTask.rawTask.checklist.length} marked
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {trailTask.rawTask.checklist.map((it, idx) => {
                      const isChecked = Boolean(it.checked);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            background: isChecked ? "#f0fdf4" : "#f8fafc",
                            border: `1px solid ${isChecked ? "#bbf7d0" : "#f1f5f9"}`,
                            fontSize: "12px",
                            color: isChecked ? "#166534" : "#64748b",
                          }}
                        >
                          <span style={{ fontWeight: 800, color: isChecked ? "#16a34a" : "#94a3b8", fontSize: "13px" }}>
                            {isChecked ? "✓" : "○"}
                          </span>
                          <span style={{ fontWeight: isChecked ? 600 : 400 }}>
                            {it.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const evs = trailTask.rawTask ? buildTaskLifecycleEvents(trailTask.rawTask) : [];
                if (evs.length === 0) {
                  return (
                    <p style={{ color: "#64748b", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                      No lifecycle events recorded for this room yet.
                    </p>
                  );
                }
                return (
                  <div style={{ position: "relative", paddingLeft: "24px" }}>
                    <div style={{ position: "absolute", left: "9px", top: "12px", bottom: "16px", width: "2px", background: "#e2e8f0" }} />
                    {evs.map((ev) => (
                      <div key={ev.id} style={{ position: "relative", marginBottom: "14px" }}>
                        <div
                          style={{
                            position: "absolute", left: "-24px", top: "4px", width: "18px", height: "18px",
                            borderRadius: "50%", background: ev.badgeColor,
                            border: "3px solid #ffffff", boxShadow: `0 0 0 2px ${ev.badgeColor}44`,
                          }}
                        />
                        <div
                          style={{
                            background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px",
                            padding: "10px 14px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "10px" }}>
                            <span
                              style={{
                                fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "4px",
                                background: `${ev.badgeColor}18`, color: ev.badgeColor, whiteSpace: "nowrap",
                              }}
                            >
                              {ev.stageLabel}
                            </span>
                            <span style={{ fontSize: "11.5px", color: "#475569", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                              <Clock size={11} /> {formatTrailDateTime(ev.timestamp)}
                            </span>
                          </div>
                          <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>{ev.title}</div>
                          <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                            <strong style={{ color: "#334155" }}>{ev.actor}</strong> • {ev.role}
                          </div>
                          {ev.details && (
                            <div style={{ fontSize: "11.5px", color: "#475569", marginTop: "4px", lineHeight: 1.45 }}>
                              {ev.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className={styles["modal-footer"]}>
              <button type="button" className={styles["btn-secondary"]} onClick={() => setTrailTask(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 5: CONFIRM INSPECTION FAILURE (Move to Dirty / Departed)
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
