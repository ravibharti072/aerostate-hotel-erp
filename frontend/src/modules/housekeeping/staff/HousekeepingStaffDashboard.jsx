import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  BedDouble,
  CheckCircle2,
  Clock,
  Play,
  Check,
  Wrench,
  Search,
  Filter,
  UserCheck,
  AlertTriangle,
  DoorOpen,
  Layers,
  X,
  Save,
  Calendar,
  RotateCw,
  FileText,
  History,
  XCircle,
  Trash2,
  Eye,
  ClipboardCheck,
  ListChecks,
  CheckSquare,
  Square,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader, Pagination } from "@components";
import "../checkoutCleaning/checkoutCleaning.css";

const initialMaintForm = {
  room_id: "",
  category: "AC",
  priority: "normal",
  description: "",
  blocks_room: false,
};

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

export const formatLogDateTime = (dateVal) => {
  const d = parseServerDate(dateVal);
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const extractTaskAuditEvents = (task, room) => {
  if (!task) return [];
  const events = [];
  const roomNum = room?.room_number || task?.room_number || task?.room_id || "Room";
  const notes = String(task?.notes || "");
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1. Initial Room Assignment by HOD
  if (task.created_at) {
    const creator = task.created_by || "Housekeeping HOD";
    const assignee = task.assigned_to || (task.assigned_staff_id ? `Staff #${task.assigned_staff_id}` : "Attendant");
    events.push({
      id: `${task.id}-assigned`,
      taskId: task.id,
      roomNumber: String(roomNum),
      stage: "ASSIGNED",
      stageLabel: "Assigned by HOD",
      title: `Room ${roomNum} Assigned for Turnover`,
      timestamp: task.created_at,
      actor: creator,
      role: "Housekeeping HOD / Supervisor",
      badgeColor: "#2563eb",
      badgeClass: "pill-info",
      details: `Assigned to ${assignee} for sanitization and turnover. Priority: ${(task.priority || "normal").toUpperCase()}.`,
    });
  }

  // 2. Start Cleaning
  if (task.started_at) {
    const starter = task.started_by || task.assigned_to || "Attendant";
    events.push({
      id: `${task.id}-started`,
      taskId: task.id,
      roomNumber: String(roomNum),
      stage: "STARTED",
      stageLabel: "Cleaning Started",
      title: `Attendant Began Turnover for Room ${roomNum}`,
      timestamp: task.started_at,
      actor: starter,
      role: "Room Attendant",
      badgeColor: "#d97706",
      badgeClass: "pill-warning",
      details: "Attendant started cleaning work: linen turnaround, trash removal, and bathroom sanitization.",
    });
  }

  // 3. Parse intermediate note audit entries
  lines.forEach((line, idx) => {
    // Inspection FAILED
    if (/\[Inspection FAILED/i.test(line)) {
      // Stop at " at <time>" / ":" — a greedy match used to swallow the timestamp into the name
      const matchActor = line.match(/by\s+(.+?)(?:\s+at\s|:|\]|$)/i);
      const actorName = matchActor ? matchActor[1].trim() : "Housekeeping HOD";
      const matchReason = line.match(/Reason:\s*([^.]+)/i) || line.match(/Remarks:\s*([^.]+)/i);
      const reason = matchReason ? matchReason[1].trim() : "Quality check rejected. Rework required.";
      const matchTime = line.match(/at\s+([0-9\-:\.TZ ]+)/i);
      const eventTime = matchTime ? matchTime[1].trim() : task.updated_at || task.created_at;

      events.push({
        id: `${task.id}-fail-${idx}`,
        taskId: task.id,
        roomNumber: String(roomNum),
        stage: "INSPECTION_FAILED",
        stageLabel: "HOD Inspection FAILED",
        title: `Inspection Rejected for Room ${roomNum}`,
        timestamp: eventTime,
        actor: actorName,
        role: "Housekeeping HOD",
        badgeColor: "#dc2626",
        badgeClass: "pill-urgent",
        details: `HOD rejected clearance. Reason: "${reason}". Returned to Dirty / Departed queue.`,
      });
    }

    // Re-cleaning Started
    if (/\[Turnover Re-cleaning Started/i.test(line)) {
      const matchActor = line.match(/by\s+(.+?)(?:\s+at\s|\]|$)/i);
      const actorName = matchActor ? matchActor[1].trim() : task.assigned_to || "Attendant";
      const matchTime = line.match(/at\s+([0-9\-:\.TZ ]+)/i);
      const eventTime = matchTime ? matchTime[1].trim() : task.updated_at || task.started_at || task.created_at;

      events.push({
        id: `${task.id}-restart-${idx}`,
        taskId: task.id,
        roomNumber: String(roomNum),
        stage: "RECLEAN_STARTED",
        stageLabel: "Re-cleaning Started",
        title: `Restarted Re-cleaning for Room ${roomNum}`,
        timestamp: eventTime,
        actor: actorName,
        role: "Room Attendant",
        badgeColor: "#ea580c",
        badgeClass: "pill-warning",
        details: "Attendant restarted turnover re-cleaning to rectify inspection feedback.",
      });
    }

    // Cleaning Completed & Submitted. Skip bare "Completion remarks:" lines — they are the remarks
    // belonging to the submission above them and would otherwise show up as a second completion.
    if (/\[Cleaning Completed/i.test(line)) {
      const remarkText = line.replace(/Completion remarks:\s*/i, "").replace(/\[Cleaning Completed[^\]]*\]:?\s*/i, "").trim();
      const matchActor = line.match(/by\s+(.+?)\s+at\s/i);
      const actorName = matchActor ? matchActor[1].trim() : task.completed_by || task.assigned_to || "Attendant";
      const matchTime = line.match(/at\s+([0-9\-:\.TZ ]+)/i);
      const eventTime = matchTime ? matchTime[1].trim() : task.completed_at || task.updated_at;

      events.push({
        id: `${task.id}-completed-${idx}`,
        taskId: task.id,
        roomNumber: String(roomNum),
        stage: "COMPLETED",
        stageLabel: "Cleaning Completed",
        title: `Turnover Completed & Submitted for Room ${roomNum}`,
        timestamp: eventTime,
        actor: actorName,
        role: "Room Attendant",
        badgeColor: "#0284c7",
        badgeClass: "pill-info",
        details: remarkText ? `Remarks: "${remarkText}"` : "Turnover completed. Bed linen changed, bathroom sanitized.",
      });
    }

    // Inspection PASSED
    if (/\[Inspection PASSED/i.test(line)) {
      const matchActor = line.match(/by\s+(.+?)(?:\s+at\s|:|\]|$)/i);
      const actorName = matchActor ? matchActor[1].trim() : "Housekeeping HOD";
      const matchRemarks = line.match(/Remarks:\s*(.*)/i);
      const remarks = matchRemarks ? matchRemarks[1].trim() : "Room verified ready for guest check-in.";
      const matchTime = line.match(/at\s+([0-9\-:\.TZ ]+)/i);
      const eventTime = matchTime ? matchTime[1].trim() : task.updated_at || task.completed_at;

      events.push({
        id: `${task.id}-pass-${idx}`,
        taskId: task.id,
        roomNumber: String(roomNum),
        stage: "INSPECTION_PASSED",
        stageLabel: "HOD Cleared & Passed",
        title: `HOD Inspection PASSED for Room ${roomNum}`,
        timestamp: eventTime,
        actor: actorName,
        role: "Housekeeping HOD",
        badgeColor: "#059669",
        badgeClass: "pill-normal",
        details: `Room verified clean and ready. Marked as Available in PMS. Remarks: "${remarks}"`,
      });
    }

    // Archived / Soft-deleted
    if (/\[Soft-Deleted \/ Archived/i.test(line)) {
      const matchActor = line.match(/by\s+([^\s]+)/i);
      const actorName = matchActor ? matchActor[1].trim() : "Housekeeping HOD";
      const matchTime = line.match(/at\s+([0-9\-:\.TZ ]+)/i);
      const eventTime = matchTime ? matchTime[1].trim() : task.updated_at;

      events.push({
        id: `${task.id}-archived-${idx}`,
        taskId: task.id,
        roomNumber: String(roomNum),
        stage: "ARCHIVED",
        stageLabel: "Archived by HOD",
        title: `Turnover Archived for Room ${roomNum}`,
        timestamp: eventTime,
        actor: actorName,
        role: "Housekeeping HOD",
        badgeColor: "#64748b",
        badgeClass: "pill-archived",
        details: "Task moved to Deleted / Archived section (preserved for audit trail).",
      });
    }
  });

  // 4. Pending HOD Clearance
  const rawStatus = String(task?.status || "").toLowerCase();
  const hasPassed = notes.lastIndexOf("Inspection PASSED") > notes.lastIndexOf("Inspection FAILED");
  const hasFailed = notes.lastIndexOf("Inspection FAILED") > notes.lastIndexOf("Inspection PASSED");

  if (rawStatus === "completed" && !hasPassed && !hasFailed) {
    events.push({
      id: `${task.id}-awaiting-hod`,
      taskId: task.id,
      roomNumber: String(roomNum),
      stage: "AWAITING_HOD",
      stageLabel: "Pending at HOD Clearance",
      title: `Awaiting HOD Clearance for Room ${roomNum}`,
      timestamp: task.completed_at || task.updated_at,
      actor: "Housekeeping HOD / Supervisor",
      role: "HOD Clearance Queue",
      badgeColor: "#9333ea",
      badgeClass: "pill-warning",
      details: "Turnover completed by attendant. Room is in HOD queue awaiting physical inspection clearance.",
    });
  }

  // Deduplicate, then sort chronologically.
  const uniqueMap = new Map();
  events.forEach((ev, order) => {
    const key = `${ev.stage}-${ev.timestamp}-${ev.actor}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { ...ev, _order: order });
    }
  });

  // Some note entries carry no time of their own (assignments, older HOD verdicts). Rather than
  // falling back to the task's current updated_at — which drags them to the bottom of the trail —
  // they inherit the nearest earlier recorded time so the order matches the note log.
  let inheritedTime = task.created_at;
  return Array.from(uniqueMap.values()).map((ev, index) => {
    if (!parseServerDate(ev.timestamp)) {
      ev.timestamp = inheritedTime;
      ev.timeInherited = true;
      ev.details = ev.details ? `${ev.details} (exact time not recorded)` : "Exact time not recorded.";
    } else {
      inheritedTime = ev.timestamp;
    }
    return { ev, index };
  })
    .sort((a, b) => {
      const timeA = parseServerDate(a.ev.timestamp)?.getTime() || 0;
      const timeB = parseServerDate(b.ev.timestamp)?.getTime() || 0;
      // Equal timestamps keep their note-log order (Array.sort is stable)
      return timeA - timeB || a.index - b.index;
    })
    .map(({ ev }) => ev);
};

export const getTaskInspectionInfo = (task) => {
  const notes = String(task?.notes || "");
  const rawStatus = String(task?.status || "pending").toLowerCase();

  const lastPassedIdx = notes.lastIndexOf("[Inspection PASSED");
  const lastFailedIdx = notes.lastIndexOf("[Inspection FAILED");
  // Every attendant submission (initial clean AND each re-clean) leaves a "[Cleaning Completed ..." note.
  // Its position vs. the last inspection note is what tells us whether that inspection verdict is still
  // the newest event, or whether the room has already been re-cleaned and resubmitted since then.
  const lastCompletedIdx = notes.lastIndexOf("[Cleaning Completed");

  const isPassed = lastPassedIdx !== -1 && (lastFailedIdx === -1 || lastPassedIdx > lastFailedIdx);
  const isFailed = lastFailedIdx !== -1 && (lastPassedIdx === -1 || lastFailedIdx > lastPassedIdx);

  // TRUE when an inspection FAILED and the attendant has since resubmitted the clean. The DB status stays
  // "completed" until the HOD inspects again, so without this the room keeps the stale FAILED verdict and
  // is filed back under "Pending Tasks" even though the work is done and waiting for the HOD.
  // Requires a prior failure: a room that already PASSED and was re-cleaned is not "rework".
  const isAwaitingRecheck = lastFailedIdx !== -1 && lastCompletedIdx > lastFailedIdx;

  if (rawStatus === "archived") {
    return {
      stage: "archived",
      statusLabel: "ARCHIVED",
      badgeClass: "pill-urgent",
      isPassed: false,
      isFailed: false,
      isPendingInspection: false,
    };
  }

  // 1. Actively in cleaning (even if previously failed and restarted!)
  if (rawStatus === "in-progress" || rawStatus === "cleaning") {
    return {
      stage: "in-progress",
      statusLabel: "IN CLEANING",
      badgeClass: "pill-warning",
      isPassed: false,
      isFailed: false,
      isPendingInspection: false,
    };
  }

  // 2. Completed by attendant:
  if (rawStatus === "completed" || rawStatus === "approved") {
    if (isPassed) {
      // Last inspection event was a PASS → fully cleaned & approved
      return {
        stage: "cleaned",
        statusLabel: "CLEANED",
        badgeClass: "pill-normal",
        isPassed: true,
        isFailed: false,
        isPendingInspection: false,
      };
    } else if (isFailed && !isAwaitingRecheck) {
      // Last lifecycle event was an inspection FAIL that has NOT been re-cleaned yet
      // (status may still read "completed" because the re-clean cycle hasn't started)
      return {
        stage: "failed",
        statusLabel: "FAILED",
        badgeClass: "pill-urgent",
        isPassed: false,
        isFailed: true,
        isPendingInspection: false,
      };
    } else {
      // Completed by attendant — either no inspection note yet, or the room was failed
      // and has since been re-cleaned and resubmitted → genuinely back in the HOD queue
      return {
        stage: "awaiting-inspection",
        statusLabel: "PENDING INSPECTION",
        badgeClass: "pill-warning",
        isPassed: false,
        isFailed: false,
        isPendingInspection: true,
      };
    }
  }

  // 3. Status is "pending": either a fresh assignment, or an inspection FAIL awaiting re-cleaning.
  // If the attendant has already resubmitted since that failure, it is back with the HOD, not pending.
  if (isFailed && !isAwaitingRecheck) {
    return {
      stage: "failed",
      statusLabel: "FAILED",
      badgeClass: "pill-urgent",
      isPassed: false,
      isFailed: true,
      isPendingInspection: false,
    };
  }

  if (isAwaitingRecheck) {
    return {
      stage: "awaiting-inspection",
      statusLabel: "PENDING INSPECTION",
      badgeClass: "pill-warning",
      isPassed: false,
      isFailed: false,
      isPendingInspection: true,
    };
  }

  // 4. Default: Pending turnover
  return {
    stage: "pending",
    statusLabel: "PENDING",
    badgeClass: "pill-urgent",
    isPassed: false,
    isFailed: false,
  };
};

export const formatStaffTurnoverNote = (rawNotes) => {
  if (!rawNotes || typeof rawNotes !== "string") {
    return {
      primary: "Turnover cleaning assigned.",
      secondary: null,
      isInspectionFailed: false,
      isInspectionPassed: false,
    };
  }

  const lines = rawNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      primary: "Turnover cleaning assigned.",
      secondary: null,
      isInspectionFailed: false,
      isInspectionPassed: false,
    };
  }

  const lastPassIdx = rawNotes.lastIndexOf("[Inspection PASSED");
  const lastFailIdx = rawNotes.lastIndexOf("[Inspection FAILED");
  const lastCompletedIdx = rawNotes.lastIndexOf("[Cleaning Completed");

  const isFailed = lastFailIdx !== -1 && (lastPassIdx === -1 || lastFailIdx > lastPassIdx);
  const isPassed = lastPassIdx !== -1 && (lastFailIdx === -1 || lastPassIdx > lastFailIdx);
  // Re-cleaned and resubmitted after the failed inspection → the failure is history, not current state.
  // Requires a prior failure (a room that already PASSED and was re-cleaned is not "rework").
  const isAwaitingRecheck = lastFailIdx !== -1 && lastCompletedIdx > lastFailIdx;

  if (isFailed && !isAwaitingRecheck) {
    const failLine = [...lines].reverse().find((l) => /\[Inspection FAILED/i.test(l) || /inspection failed/i.test(l));
    const cleanReason = failLine
      ? failLine
          .replace(/^\[Inspection FAILED[^\]]*\]:\s*/i, "")
          .replace(/^Sent back for cleaning\.\s*/i, "")
          .replace(/^Reason:\s*/i, "")
          .trim()
      : "Inspection failed. Rework required.";
    return {
      primary: `Inspection Failed: ${cleanReason || "Rework required."}`,
      secondary: "Sent back by HOD for re-cleaning",
      isInspectionFailed: true,
      isInspectionPassed: false,
    };
  }

  // Failed, then re-cleaned and resubmitted → show what the attendant did, not the stale failure.
  // Once the HOD has passed it again the failure is closed history, so drop the rework wording.
  if (isAwaitingRecheck && !isPassed) {
    const recheckRemark = [...lines].reverse().find((l) => /completion remarks:/i.test(l));
    const cleanRemark = recheckRemark
      ? recheckRemark.replace(/^Completion remarks:\s*/i, "").trim()
      : "";
    return {
      primary: cleanRemark || "Turnover completed. Bed linen changed, bathroom sanitized.",
      secondary: "Re-cleaned after inspection failure — awaiting HOD re-inspection",
      isInspectionFailed: false,
      isInspectionPassed: false,
    };
  }

  if (isPassed) {
    const passLine = [...lines].reverse().find((l) => /\[Inspection PASSED/i.test(l));
    const remarks = passLine
      ? passLine.replace(/^\[Inspection PASSED[^\]]*\]:\s*/i, "").trim()
      : "Room inspected and approved.";
    return {
      primary: remarks || "Inspection passed. Room ready for guest.",
      secondary: "Approved by Housekeeping HOD",
      isInspectionFailed: false,
      isInspectionPassed: true,
    };
  }

  // Find completion remarks if present
  const completionLine = [...lines].reverse().find((l) => /completion remarks:/i.test(l));
  if (completionLine) {
    const cleanRemark = completionLine.replace(/^Completion remarks:\s*/i, "").trim();
    return {
      primary: cleanRemark || "Turnover completed. Bed linen changed, bathroom sanitized.",
      secondary: "Awaiting HOD inspection",
      isInspectionFailed: false,
      isInspectionPassed: false,
    };
  }

  // Filter out supervisor boilerplate
  const nonBoilerplate = lines.filter(
    (l) => !l.toLowerCase().startsWith("cleaning task assigned by supervisor")
  );

  const display = (nonBoilerplate.length > 0 ? nonBoilerplate[nonBoilerplate.length - 1] : lines[0])
    .replace(/^\[Inspection PASSED[^\]]*\]:\s*/i, "")
    .replace(/^Remarks:\s*/i, "")
    .trim();

  return {
    primary: display || "Standard checkout turnover cleaning",
    secondary: null,
    isInspectionFailed: false,
    isInspectionPassed: false,
  };
};

export default function HousekeepingStaffDashboard({ showBack = true, isDashboard = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Active Tab: Default to "pending" on login as requested
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "in-progress" | "completed" | "all"
  const [searchText, setSearchText] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [cleaningTypeFilter, setCleaningTypeFilter] = useState("all");

  // Pagination (20 per page as requested)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal: Complete Cleaning
  const [completeModalTask, setCompleteModalTask] = useState(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeChecklist, setCompleteChecklist] = useState([]);
  const [completing, setCompleting] = useState(false);

  // Dynamic Checklists created by HOD
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [activeChecklistTask, setActiveChecklistTask] = useState(null);
  const [activeChecklistItems, setActiveChecklistItems] = useState([]);
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Modal: Raise Maintenance Request
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [maintForm, setMaintForm] = useState(initialMaintForm);
  const [submittingMaint, setSubmittingMaint] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getApiErrorMessage = (err, fallbackMessage = "Request failed") => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => `${item.loc?.join(".") || ""}: ${item.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  };

  const normalizeList = (data, key) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotelId || user?.hotel?.id || null;
  };

  const getRoom = (roomId) => rooms.find((r) => Number(r.id) === Number(roomId));

  // Identify current logged in staff member
  const currentStaff = useMemo(() => {
    if (!allStaff.length) return null;
    if (user?.staff_id) {
      const match = allStaff.find((s) => Number(s.id) === Number(user.staff_id));
      if (match) return match;
    }
    const username = String(user?.username || "").toLowerCase().trim();
    const fullName = String(user?.full_name || "").toLowerCase().trim();
    return (
      allStaff.find(
        (s) =>
          String(s.full_name || "").toLowerCase().trim() === fullName ||
          String(s.full_name || "").toLowerCase().trim() === username
      ) || null
    );
  }, [allStaff, user]);

  const fetchData = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [tasksRes, roomsRes, staffRes, checklistsRes] = await Promise.all([
        api.get("/housekeeping/tasks", { params }).catch(() => ({ data: [] })),
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
        api.get("/staff", { params }).catch(() => ({ data: [] })),
        api.get("/checklists", { params: { ...params, department: "housekeeping" } }).catch(() => ({ data: [] })),
      ]);

      setTasks(normalizeList(tasksRes.data, "tasks"));
      setRooms(normalizeList(roomsRes.data, "rooms"));
      setAllStaff(normalizeList(staffRes.data, "staff"));
      const cList = Array.isArray(checklistsRes.data) ? checklistsRes.data : checklistsRes.data?.data || [];
      setChecklistTemplates(cList);
    } catch (err) {
      console.error("Staff portal fetch error:", err);
      if (showLoadingSpinner) {
        showToast(getApiErrorMessage(err, "Failed to load cleaning tasks."), "error");
      }
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [user]);

  // Determine if a task belongs strictly to the current logged-in staff member (assigned by HOD)
  const isTaskAssignedToMe = (task) => {
    if (currentStaff?.id && Number(task.assigned_staff_id) === Number(currentStaff.id)) {
      return true;
    }
    const myName = (currentStaff?.full_name || user?.full_name || user?.username || "").toLowerCase().trim();
    const taskAssignedName = String(task.assigned_to || "").toLowerCase().trim();
    if (myName && taskAssignedName && (taskAssignedName === myName || taskAssignedName.includes(myName) || myName.includes(taskAssignedName))) {
      return true;
    }
    return false;
  };

  // Helper to check if a date string belongs to today (local or UTC)
  const isDateToday = (dateVal) => {
    if (!dateVal) return false;
    const d = parseServerDate(dateVal);
    if (!d) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  // Only show today's work in staff dashboard
  const isTaskForToday = (task) => {
    const st = String(task.status || "").toLowerCase();
    if (st === "archived") return false;
    // Always keep unfinished tasks in active queue so they are never lost
    if (st === "pending" || st === "assigned" || st === "in-progress" || st === "cleaning") {
      return true;
    }
    // Completed / inspected / failed tasks performed today
    return isDateToday(task.completed_at) || isDateToday(task.created_at) || isDateToday(task.updated_at);
  };

  // Only HOD assigns rooms: staff receives rooms assigned to them for today's work.
  // Keep only the room's CURRENT turnover record — the newest non-archived task for that room.
  // A room can carry several historical tasks (clean -> fail -> re-clean -> pass); showing all of
  // them made the attendant's queue disagree with the HOD board, which tracks exactly one row per
  // room. Older records stay fully visible in Housekeeping Logs and the per-task audit trail.
  const myTasks = useMemo(() => {
    const mine = tasks
      .filter((t) => isTaskAssignedToMe(t))
      .filter((t) => isTaskForToday(t));

    const newestIdByRoom = new Map();
    mine.forEach((t) => {
      const key = Number(t.room_id);
      const current = newestIdByRoom.get(key);
      if (current === undefined || Number(t.id) > Number(current)) {
        newestIdByRoom.set(key, t.id);
      }
    });

    return mine.filter((t) => newestIdByRoom.get(Number(t.room_id)) === t.id);
  }, [tasks, currentStaff, user]);

  // Counts for tabs & stat cards
  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    myTasks.forEach((t) => {
      const info = getTaskInspectionInfo(t);
      if (info.stage === "cleaned" || info.stage === "awaiting-inspection") {
        completed++;
      } else if (info.stage === "in-progress") {
        inProgress++;
      } else {
        // Pending turnover or failed rework
        pending++;
      }
    });

    return {
      total: myTasks.length,
      pending,
      inProgress,
      completed,
    };
  }, [myTasks]);

  // Filter tasks based on activeTab, search, floor, and priority
  const filteredTasks = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    const list = myTasks.filter((task) => {
      const room = getRoom(task.room_id);
      const roomNum = String(room?.room_number || task.room_number || task.room_id || "").toLowerCase();
      const floorStr = String(room?.floor || task.floor || "").toLowerCase();
      const notesStr = String(task.notes || "").toLowerCase();
      const pr = String(task.priority || "normal").toLowerCase();
      const taskInfo = getTaskInspectionInfo(task);

      // Tab Filtering
      if (activeTab === "pending") {
        // Pending tasks and rework/failed tasks needing cleaning
        if (!(taskInfo.stage === "pending" || taskInfo.stage === "failed")) return false;
      } else if (activeTab === "in-progress") {
        if (taskInfo.stage !== "in-progress") return false;
      } else if (activeTab === "completed") {
        // Show completed tasks, awaiting inspection, AND tasks that failed inspection
        // so that a failed task is NOT removed from this list!
        if (!(taskInfo.stage === "cleaned" || taskInfo.stage === "awaiting-inspection" || taskInfo.stage === "failed")) return false;
      }

      // Dropdown Filters
      if (floorFilter !== "all" && floorStr !== floorFilter.toLowerCase()) return false;
      if (priorityFilter !== "all" && pr !== priorityFilter.toLowerCase()) return false;
      if (cleaningTypeFilter !== "all") {
        const tType = String(task.task_type || "checkout-cleaning").toLowerCase();
        if (cleaningTypeFilter === "checkout-cleaning" && !(tType.includes("checkout") || tType.includes("turnover"))) return false;
        else if (cleaningTypeFilter === "stayover-cleaning" && !tType.includes("stayover")) return false;
        else if (cleaningTypeFilter === "deep-cleaning" && !tType.includes("deep")) return false;
        else if (cleaningTypeFilter === "room-cleaning" && !(tType.includes("room") || tType === "cleaning")) return false;
        else if (!tType.includes(cleaningTypeFilter.replace(/-cleaning$/, ""))) return false;
      }

      // Search Query
      if (search) {
        const matches =
          roomNum.includes(search) ||
          floorStr.includes(search) ||
          notesStr.includes(search);
        if (!matches) return false;
      }

      return true;
    });

    // In "all" tab, sort with Failed first, then Pending, In-Progress, and Completed at the very end
    if (activeTab === "all") {
      return [...list].sort((a, b) => {
        const statusWeight = (item) => {
          const info = getTaskInspectionInfo(item);
          if (info.stage === "failed") return 0; // Failed on top to grab immediate attention!
          if (info.stage === "pending") return 1;
          if (info.stage === "in-progress") return 2;
          return 3; // completed at the end
        };
        const diff = statusWeight(a) - statusWeight(b);
        if (diff !== 0) return diff;
        return (b.id || 0) - (a.id || 0);
      });
    }

    return list;
  }, [myTasks, rooms, activeTab, searchText, floorFilter, priorityFilter, cleaningTypeFilter]);

  // Filter for logs tab & selected task for audit modal
  const [logFilterStage, setLogFilterStage] = useState("all");
  const [selectedLogTask, setSelectedLogTask] = useState(null);

  // All extracted audit logs from my tasks today
  const allLogs = useMemo(() => {
    const list = [];
    myTasks.forEach((t) => {
      const room = getRoom(t.room_id);
      const evs = extractTaskAuditEvents(t, room);
      list.push(...evs);
    });
    return list.sort((a, b) => {
      const timeA = parseServerDate(a.timestamp)?.getTime() || 0;
      const timeB = parseServerDate(b.timestamp)?.getTime() || 0;
      return timeB - timeA;
    });
  }, [myTasks, rooms]);

  const filteredLogs = useMemo(() => {
    let result = [...allLogs];
    if (logFilterStage !== "all") {
      result = result.filter((l) => l.stage === logFilterStage);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase().trim();
      result = result.filter(
        (l) =>
          String(l.roomNumber).toLowerCase().includes(q) ||
          String(l.title).toLowerCase().includes(q) ||
          String(l.actor).toLowerCase().includes(q) ||
          String(l.stageLabel).toLowerCase().includes(q) ||
          String(l.details).toLowerCase().includes(q)
      );
    }
    return result;
  }, [allLogs, logFilterStage, searchText]);

  // Total items and pagination
  const totalItems = activeTab === "logs" ? filteredLogs.length : filteredTasks.length;
  const totalPages = Math.ceil(totalItems / (Number(pageSize) || 20)) || 1;

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchText, floorFilter, priorityFilter, cleaningTypeFilter, logFilterStage, pageSize]);

  // Paginated records (20 items per page by default)
  const paginatedTasks = useMemo(() => {
    const isAll = pageSize === "all" || pageSize >= 999999;
    if (isAll) return filteredTasks;
    const size = Number(pageSize) || 20;
    const startIndex = (currentPage - 1) * size;
    return filteredTasks.slice(startIndex, startIndex + size);
  }, [filteredTasks, currentPage, pageSize]);

  const paginatedLogs = useMemo(() => {
    const isAll = pageSize === "all" || pageSize >= 999999;
    if (isAll) return filteredLogs;
    const size = Number(pageSize) || 20;
    const startIndex = (currentPage - 1) * size;
    return filteredLogs.slice(startIndex, startIndex + size);
  }, [filteredLogs, currentPage, pageSize]);

  // Extract unique floors for dropdown
  const uniqueFloors = useMemo(() => {
    const set = new Set();
    myTasks.forEach((t) => {
      const room = getRoom(t.room_id);
      const fl = room?.floor || t.floor;
      if (fl !== null && fl !== undefined && String(fl).trim() !== "") {
        set.add(String(fl));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [myTasks, rooms]);

  // Resolve dynamic checklist created by HOD
  const resolveTaskChecklist = (task) => {
    // 1. If task already has a checklist stored
    if (Array.isArray(task?.checklist) && task.checklist.length > 0) {
      return task.checklist.map((it) => ({
        text: typeof it === "string" ? it : it.text || "",
        checked: Boolean(it.checked),
        required: Boolean(it.required),
      }));
    }

    // 2. Resolve matching template created by HOD
    const taskTypeLower = String(task?.task_type || "").toLowerCase();
    let template = checklistTemplates.find((t) => {
      const name = String(t.name || "").toLowerCase();
      if (taskTypeLower.includes("checkout") && (name.includes("checkout") || name.includes("turnover"))) return true;
      if (taskTypeLower.includes("stayover") && name.includes("stayover")) return true;
      if (taskTypeLower.includes("deep") && name.includes("deep")) return true;
      return false;
    });

    if (!template && checklistTemplates.length > 0) {
      template = checklistTemplates[0];
    }

    if (template && Array.isArray(template.items)) {
      return template.items.map((it) => ({
        text: typeof it === "string" ? it : it.text || "",
        checked: false,
        required: false,
      }));
    }

    return [];
  };

  const toggleCompleteChecklistItem = (idx) => {
    setCompleteChecklist((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it))
    );
  };

  const setAllCompleteChecklist = (checkedVal) => {
    setCompleteChecklist((prev) => prev.map((it) => ({ ...it, checked: checkedVal })));
  };

  // For In-Progress checklist drawer / modal:
  const handleOpenInProgressChecklist = (task) => {
    setActiveChecklistTask(task);
    setActiveChecklistItems(resolveTaskChecklist(task));
  };

  const toggleActiveChecklistItem = (idx) => {
    setActiveChecklistItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it))
    );
  };

  const handleSaveInProgressChecklist = async () => {
    if (!activeChecklistTask) return;
    try {
      setSavingChecklist(true);
      await api.put(`/housekeeping/tasks/${activeChecklistTask.id}/checklist`, {
        checklist: activeChecklistItems,
      });
      showToast("Checklist progress saved!", "success");
      setActiveChecklistTask(null);
      await fetchData(false);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to save checklist progress."), "error");
    } finally {
      setSavingChecklist(false);
    }
  };

  // Action: Start Cleaning
  const handleStartCleaning = async (task) => {
    try {
      setUpdatingId(task.id);
      const roomNum = getRoom(task.room_id)?.room_number || task.room_id;
      await api.post(`/housekeeping/tasks/${task.id}/start`);
      showToast(`Started turnover for Room ${roomNum}. Status updated to Cleaning.`, "success");
      setActiveTab("in-progress");
      await fetchData();
    } catch (err) {
      console.error("Start cleaning error:", err);
      showToast(getApiErrorMessage(err, "Failed to start cleaning."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Action: Open Complete Cleaning Modal
  const handleOpenCompleteModal = (task) => {
    setCompleteModalTask(task);
    const initialChecklist = resolveTaskChecklist(task);
    setCompleteChecklist(initialChecklist);
    setCompleteNotes("Turnover cleaning completed. Bed linen changed, bathroom sanitized.");
  };

  // Action: Confirm Complete Cleaning
  const handleConfirmComplete = async (e) => {
    e.preventDefault();
    if (!completeModalTask) return;
    const roomNum = getRoom(completeModalTask.room_id)?.room_number || completeModalTask.room_id;

    try {
      setCompleting(true);
      await api.post(`/housekeeping/tasks/${completeModalTask.id}/complete`, {
        notes: completeNotes.trim() || "Turnover completed by attendant.",
        checklist: completeChecklist,
      });
      showToast(`Room ${roomNum} marked Cleaned! Moved to Completed Tasks.`, "success");
      setCompleteModalTask(null);
      setActiveTab("completed");
      await fetchData();
    } catch (err) {
      console.error("Complete cleaning error:", err);
      showToast(getApiErrorMessage(err, "Failed to submit completed clean."), "error");
    } finally {
      setCompleting(false);
    }
  };

  // Action: Open Maintenance Request Modal for a Room
  const handleOpenMaintModal = (roomId = "") => {
    setMaintForm({
      ...initialMaintForm,
      room_id: roomId ? String(roomId) : myTasks[0]?.room_id ? String(myTasks[0].room_id) : "",
    });
    setIsMaintModalOpen(true);
  };

  // Action: Submit Maintenance Request
  const handleSubmitMaintenance = async (e) => {
    e.preventDefault();
    if (!maintForm.room_id) {
      showToast("Please select a room.", "error");
      return;
    }
    if (!maintForm.description.trim()) {
      showToast("Please enter an issue description.", "error");
      return;
    }

    try {
      setSubmittingMaint(true);
      const roomNum = getRoom(maintForm.room_id)?.room_number || maintForm.room_id;
      await api.post("/housekeeping/report-problem", {
        room_id: Number(maintForm.room_id),
        category: maintForm.category,
        description: maintForm.description.trim(),
        priority: maintForm.priority,
        blocks_room: Boolean(maintForm.blocks_room),
      });

      showToast(`Maintenance issue reported for Room ${roomNum}.`, "success");
      setIsMaintModalOpen(false);
      setMaintForm(initialMaintForm);
      await fetchData();
    } catch (err) {
      console.error("Report maintenance error:", err);
      showToast(getApiErrorMessage(err, "Failed to report maintenance issue."), "error");
    } finally {
      setSubmittingMaint(false);
    }
  };

  const displayName = currentStaff?.full_name || user?.full_name || user?.username || "Room Attendant";

  return (
    <div className="directory-page checkout-cleaning-directory">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title={isDashboard ? "Housekeeping Operations" : "Housekeeping Staff Portal"}
        kicker="HOUSEKEEPING OPERATIONS"
        description={`Welcome, ${displayName}. Manage your assigned room turnover queue, start cleaning, and report maintenance issues.`}
        icon={Sparkles}
        isDashboard={isDashboard}
        showBack={showBack && !isDashboard}
        backPath="/dashboard"
        rightAction={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="portal-action-btn"
              style={{ background: "#166962", borderColor: "#166962" }}
              onClick={() => navigate("/checklists")}
            >
              <ClipboardCheck size={16} /> Cleaning Checklists
            </button>
            <button
              type="button"
              className="portal-action-btn"
              style={{ background: "#d97706", borderColor: "#d97706" }}
              onClick={() => handleOpenMaintModal()}
            >
              <Wrench size={16} /> Raise Maintenance Request
            </button>
            <button
              type="button"
              onClick={() => fetchData(true)}
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
              title="Refresh Cleaning Tasks"
              disabled={loading}
            >
              <RotateCw size={15} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
            </button>
          </div>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Pending Turnover"
          value={stats.pending}
          Icon={Clock}
          colorTheme="orange"
          onClick={() => setActiveTab("pending")}
        />
        <StatCard
          title="Cleaning In-Progress"
          value={stats.inProgress}
          Icon={Sparkles}
          colorTheme="blue"
          onClick={() => setActiveTab("in-progress")}
        />
        <StatCard
          title="Completed Today"
          value={stats.completed}
          Icon={CheckCircle2}
          colorTheme="green"
          onClick={() => setActiveTab("completed")}
        />
        <StatCard
          title="Total Assigned"
          value={stats.total}
          Icon={BedDouble}
          colorTheme="purple"
          onClick={() => setActiveTab("pending")}
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title={activeTab === "logs" ? "Housekeeping Activity & Audit Trail" : "Assigned Turnover Tasks"}
          description={
            activeTab === "logs"
              ? "Comprehensive chronological history: HOD assignment, cleaning started, completed, pending clearance, and inspection pass/fail records."
              : "Rooms assigned to you by the Housekeeping HOD for turnover and sanitization."
          }
          badgeCount={activeTab === "logs" ? filteredLogs.length : filteredTasks.length}
          badgeLabel={activeTab === "logs" ? "events" : "rooms"}
        />

        {/* SECTION TABS: 1. PENDING, 2. IN-PROGRESS, 3. ALL TODAY, 4. HOUSEKEEPING LOGS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending Tasks <span className="tab-count-badge">{stats.pending}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "in-progress" ? "active" : ""}`}
            onClick={() => setActiveTab("in-progress")}
          >
            In-Progress Cleaning <span className="tab-count-badge">{stats.inProgress}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Today's Tasks <span className="tab-count-badge">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            Housekeeping Logs <span className="tab-count-badge">{allLogs.length}</span>
          </button>
        </div>

        {/* TOOLBAR CONTROLS (MATCHES PMS PORTAL STYLE) */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={
                activeTab === "logs"
                  ? "Search logs by Room, Actor, Lifecycle Stage, Remarks..."
                  : "Search by Room Number, Floor, Notes..."
              }
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {activeTab === "logs" ? (
              <select
                className="dir-filter-select"
                value={logFilterStage}
                onChange={(e) => setLogFilterStage(e.target.value)}
              >
                <option value="all">All Lifecycle Stages</option>
                <option value="ASSIGNED">Assigned by HOD</option>
                <option value="STARTED">Cleaning Started</option>
                <option value="COMPLETED">Cleaning Completed</option>
                <option value="AWAITING_HOD">Pending at HOD Clearance</option>
                <option value="INSPECTION_PASSED">HOD Inspection PASSED</option>
                <option value="INSPECTION_FAILED">HOD Inspection FAILED</option>
                <option value="RECLEAN_STARTED">Re-cleaning Started</option>
                <option value="ARCHIVED">Archived / Deleted</option>
              </select>
            ) : (
              <>
                <select
                  className="dir-filter-select"
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                >
                  <option value="all">All Floors</option>
                  {uniqueFloors.map((fl) => (
                    <option key={fl} value={fl}>
                      Floor {fl}
                    </option>
                  ))}
                </select>

                <select
                  className="dir-filter-select"
                  value={cleaningTypeFilter}
                  onChange={(e) => setCleaningTypeFilter(e.target.value)}
                >
                  <option value="all">All Cleaning Types</option>
                  <option value="checkout-cleaning">Checkout Turnover</option>
                  <option value="stayover-cleaning">Stayover Cleaning</option>
                  <option value="deep-cleaning">Deep Sanitization</option>
                  <option value="room-cleaning">Room Cleaning</option>
                </select>

                <select
                  className="dir-filter-select"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </>
            )}

            {(searchText || floorFilter !== "all" || priorityFilter !== "all" || cleaningTypeFilter !== "all" || logFilterStage !== "all") && (
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setSearchText("");
                  setFloorFilter("all");
                  setPriorityFilter("all");
                  setCleaningTypeFilter("all");
                  setLogFilterStage("all");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className="dir-table-container">
          {activeTab === "logs" ? (
            <table className="dir-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "160px" }}>Event Timestamp</th>
                  <th style={{ width: "130px", minWidth: "130px" }}>Room & Task</th>
                  <th style={{ minWidth: "170px" }}>Lifecycle Stage</th>
                  <th style={{ minWidth: "160px" }}>Actor / Role</th>
                  <th style={{ minWidth: "280px" }}>Audit Details & Remarks</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Trail</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      Loading housekeeping audit logs...
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      No housekeeping activity logs found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    return (
                      <tr key={log.id} className="dir-table-row">
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#0f172a", fontWeight: 600 }}>
                            <Clock size={13} style={{ color: "#64748b" }} />
                            <span>{formatLogDateTime(log.timestamp)}</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="room-number-pill">Room {log.roomNumber}</span>
                            <span style={{ fontSize: "11px", color: "#878e99" }}>#{log.taskId}</span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`mono-pill ${log.badgeClass}`}
                            style={{
                              fontWeight: 700,
                              fontSize: "11px",
                              letterSpacing: "0.3px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            <span
                              style={{
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: log.badgeColor,
                                display: "inline-block",
                              }}
                            />
                            {log.stageLabel}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>{log.actor}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{log.role}</span>
                          </div>
                        </td>

                        <td style={{ maxWidth: "340px", whiteSpace: "normal", wordBreak: "break-word" }}>
                          <span style={{ fontSize: "12px", color: "#334155", lineHeight: "1.4" }}>
                            {log.details}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn-cancel"
                            style={{
                              gap: "4px",
                              padding: "4px 10px",
                              fontSize: "11.5px",
                              background: "#f8fafc",
                              border: "1px solid #cbd5e1",
                              color: "#334155",
                              fontWeight: 600,
                            }}
                            onClick={() => {
                              const target = myTasks.find((t) => t.id === log.taskId);
                              if (target) setSelectedLogTask(target);
                            }}
                            title="View full step-by-step lifecycle trail for this room"
                          >
                            <History size={13} /> Full Trail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="dir-table">
              <thead>
                <tr>
                  <th style={{ width: "120px", minWidth: "120px" }}>Room</th>
                  <th style={{ minWidth: "130px" }}>Floor / Type</th>
                  <th style={{ minWidth: "170px" }}>Cleaning Type</th>
                  <th style={{ minWidth: "110px" }}>Priority</th>
                  <th style={{ minWidth: "140px" }}>Status</th>
                  <th style={{ minWidth: "260px" }}>Turnover Notes</th>
                  <th style={{ width: "240px", textAlign: "right" }}>Attendant Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      Loading assigned turnover tasks...
                    </td>
                  </tr>
                ) : paginatedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      {activeTab === "pending"
                        ? "No pending tasks waiting to be started. Great job!"
                        : activeTab === "in-progress"
                        ? "No rooms currently in-progress. Start a pending task above!"
                        : activeTab === "completed"
                        ? "No completed tasks recorded yet today."
                        : "No assigned rooms found matching the current filters."}
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((task) => {
                    const room = getRoom(task.room_id);
                    const roomNum = room?.room_number || task.room_number || task.room_id;
                    const roomType = room?.room_type || task.room_type || "Standard Room";
                    const floorNum = room?.floor || task.floor || "1";
                    const pr = String(task.priority || "normal").toLowerCase();
                    const taskInfo = getTaskInspectionInfo(task);
                    const noteInfo = formatStaffTurnoverNote(task.notes);

                    return (
                      <tr key={task.id} className="dir-table-row">
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="room-number-pill">Room {roomNum}</span>
                            <span style={{ fontSize: "11px", color: "#878e99" }}>#{task.id}</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "13px", color: "#0f172a" }}>Floor {floorNum}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{roomType}</span>
                          </div>
                        </td>

                        {/* Dedicated Cleaning Type column */}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span
                              className={`mono-pill ${
                                String(task.task_type).toLowerCase() === "deep-cleaning"
                                  ? "pill-urgent"
                                  : String(task.task_type).toLowerCase() === "stayover-cleaning"
                                  ? "pill-warning"
                                  : String(task.task_type).toLowerCase() === "room-cleaning"
                                  ? "pill-info"
                                  : "pill-normal"
                              }`}
                              style={{
                                alignSelf: "flex-start",
                                fontWeight: 800,
                                fontSize: "10.5px",
                                letterSpacing: "0.02em",
                              }}
                            >
                              {{
                                "checkout-cleaning": "CHECKOUT TURNOVER",
                                "stayover-cleaning": "STAYOVER CLEANING",
                                "deep-cleaning": "DEEP SANITIZATION",
                                "room-cleaning": "ROOM CLEANING",
                              }[String(task.task_type || "").toLowerCase()] ||
                                String(task.task_type || "checkout-cleaning").replace(/-/g, " ").toUpperCase()}
                            </span>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {String(task.task_type).toLowerCase() === "stayover-cleaning"
                                ? "Daily in-house service"
                                : String(task.task_type).toLowerCase() === "deep-cleaning"
                                ? "Periodic deep sanitization"
                                : String(task.task_type).toLowerCase() === "room-cleaning"
                                ? "Turnover sanitization"
                                : String(task.notes || "").toLowerCase().includes("assigned by supervisor") || String(task.notes || "").toLowerCase().includes("assigned by hod")
                                ? "Assigned by the HOD"
                                : "Raised automatically at checkout"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`mono-pill ${
                              pr === "urgent" || pr === "high"
                                ? "pill-urgent"
                                : pr === "medium" || pr === "normal"
                                ? "pill-warning"
                                : "pill-normal"
                            }`}
                          >
                            {pr.toUpperCase()}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`mono-pill ${taskInfo.badgeClass}`}
                            style={{
                              fontWeight: 600,
                              letterSpacing: "0.5px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            {taskInfo.stage === "in-progress" && <Clock size={11} />}
                            {taskInfo.stage === "in-progress" && task.started_at ? (
                              (() => {
                                const startD = parseServerDate(task.started_at);
                                const mins = startD ? Math.max(1, Math.floor((Date.now() - startD.getTime()) / 60000)) : 1;
                                return `IN CLEANING (${mins}m)`;
                              })()
                            ) : (
                              taskInfo.statusLabel
                            )}
                          </span>
                        </td>

                        <td style={{ maxWidth: "320px", whiteSpace: "normal", wordBreak: "break-word" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span
                              style={{
                                fontSize: "12px",
                                color: noteInfo.isInspectionFailed ? "#b91c1c" : "#334155",
                                fontWeight: noteInfo.isInspectionFailed ? 600 : 400,
                                lineHeight: "1.4",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={task.notes}
                            >
                              {noteInfo.isInspectionFailed && "⚠️ "}
                              {noteInfo.primary}
                            </span>
                            {noteInfo.secondary && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: noteInfo.isInspectionFailed ? "#ef4444" : "#64748b",
                                  fontWeight: 500,
                                }}
                              >
                                {noteInfo.secondary}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                            {taskInfo.stage === "failed" && (
                              <>
                                <button
                                  type="button"
                                  className="btn-submit"
                                  style={{ gap: "5px", padding: "6px 12px", height: "32px", fontSize: "12px", background: "#dc2626" }}
                                  onClick={() => handleStartCleaning(task)}
                                  disabled={updatingId === task.id}
                                  title="Start re-cleaning this room"
                                >
                                  <Play size={12} fill="#ffffff" /> Start Re-clean
                                </button>
                                <button
                                  type="button"
                                  className="btn-action-complete"
                                  style={{ gap: "5px", padding: "6px 12px", height: "32px", fontSize: "12px" }}
                                  onClick={() => handleOpenCompleteModal(task)}
                                  disabled={updatingId === task.id}
                                  title="Mark re-cleaning completed"
                                >
                                  <CheckCircle2 size={13} /> Complete
                                </button>
                              </>
                            )}

                            {taskInfo.stage === "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="btn-submit"
                                  style={{ gap: "5px", padding: "6px 12px", height: "32px", fontSize: "12px" }}
                                  onClick={() => handleStartCleaning(task)}
                                  disabled={updatingId === task.id}
                                  title="Start cleaning this room"
                                >
                                  <Play size={12} fill="#ffffff" /> Start
                                </button>
                                <button
                                  type="button"
                                  className="btn-action-complete"
                                  style={{ gap: "5px", padding: "6px 12px", height: "32px", fontSize: "12px" }}
                                  onClick={() => handleOpenCompleteModal(task)}
                                  disabled={updatingId === task.id}
                                  title="Directly mark room as cleaned"
                                >
                                  <CheckCircle2 size={13} /> Complete
                                </button>
                              </>
                            )}

                            {taskInfo.stage === "in-progress" && (
                              <>
                                <button
                                  type="button"
                                  className="btn-cancel"
                                  style={{
                                    gap: "5px",
                                    padding: "6px 12px",
                                    height: "32px",
                                    fontSize: "12px",
                                    color: "#059669",
                                    borderColor: "#a7f3d0",
                                    background: "#ecfdf5",
                                    fontWeight: 600,
                                  }}
                                  onClick={() => handleOpenInProgressChecklist(task)}
                                  title="Review / mark room cleaning checklist"
                                >
                                  <ClipboardCheck size={13} color="#059669" /> Checklist
                                </button>
                                <button
                                  type="button"
                                  className="btn-action-complete"
                                  style={{ gap: "5px", padding: "6px 14px", height: "32px", fontSize: "12px" }}
                                  onClick={() => handleOpenCompleteModal(task)}
                                  disabled={updatingId === task.id}
                                  title="Finish cleaning room"
                                >
                                  <CheckCircle2 size={13} /> Complete Cleaning
                                </button>
                              </>
                            )}

                            {taskInfo.stage === "awaiting-inspection" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "5px 12px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "#b45309",
                                  background: "#fffbeb",
                                  border: "1px solid #fde68a",
                                  borderRadius: "6px",
                                }}
                              >
                                <Clock size={13} /> Pending Inspection
                              </span>
                            )}

                            {taskInfo.stage === "cleaned" && (
                              <span
                                className="balance-paid-text"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "5px 12px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "#059669",
                                  background: "#ecfdf5",
                                  border: "1px solid #a7f3d0",
                                  borderRadius: "6px",
                                }}
                              >
                                <CheckCircle2 size={13} /> Cleaned
                              </span>
                            )}

                            <button
                              type="button"
                              className="btn-cancel"
                              style={{
                                color: "#2563eb",
                                borderColor: "#bfdbfe",
                                background: "#eff6ff",
                                padding: "0 8px",
                                height: "32px",
                                fontSize: "11.5px",
                                gap: "4px",
                              }}
                              onClick={() => setSelectedLogTask(task)}
                              title="View Full Lifecycle Audit Trail"
                            >
                              <History size={13} /> Log
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 20 IN 1 PAGE PAGINATION CONTROLS */}
        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            itemLabel={activeTab === "logs" ? "events" : "tasks"}
          />
        )}
      </section>

      {/* COMPLETE CLEANING MODAL */}
      {completeModalTask && (
        <div className="modal-overlay" onClick={() => setCompleteModalTask(null)}>
          <div className="modal-content" style={{ maxWidth: "560px", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle2 size={20} color="#16a34a" />
                <div>
                  <h2 style={{ fontSize: "16px", margin: 0 }}>
                    Complete Cleaning: Room {getRoom(completeModalTask.room_id)?.room_number || completeModalTask.room_id}
                  </h2>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Turnover cleaning sign-off & HOD inspection dispatch
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCompleteModalTask(null)}
                disabled={completing}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmComplete} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
                <p style={{ fontSize: "12.5px", color: "#64748b", margin: "0 0 12px" }}>
                  Please mark the checklist points you performed for <strong>Room {getRoom(completeModalTask.room_id)?.room_number || completeModalTask.room_id}</strong>. When ready, click <strong>Mark Cleaned</strong> to submit for HOD inspection.
                </p>

                {/* DYNAMIC CHECKLIST CREATED BY HOD */}
                <div style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ClipboardCheck size={16} color="#059669" />
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>
                        Cleaning Checklist
                      </span>
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#0284c7",
                        background: "#e0f2fe",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                      }}>
                        HOD Configured
                      </span>
                    </div>

                    {completeChecklist.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669" }}>
                          {completeChecklist.filter((c) => c.checked).length} of {completeChecklist.length} marked
                        </span>
                        <span style={{ color: "#cbd5e1" }}>•</span>
                        <button
                          type="button"
                          onClick={() => setAllCompleteChecklist(true)}
                          style={{ fontSize: "11px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                        >
                          Check All
                        </button>
                        <span style={{ color: "#cbd5e1" }}>•</span>
                        <button
                          type="button"
                          onClick={() => setAllCompleteChecklist(false)}
                          style={{ fontSize: "11px", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {completeChecklist.length === 0 ? (
                    <div style={{ padding: "10px", background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: "6px", fontSize: "12px", color: "#64748b", textAlign: "center" }}>
                      No checklist template configured yet by HOD. You can still mark the room as cleaned.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
                      {completeChecklist.map((item, idx) => {
                        const isChecked = Boolean(item.checked);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleCompleteChecklistItem(idx)}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              padding: "7px 10px",
                              borderRadius: "6px",
                              background: isChecked ? "#ecfdf5" : "#ffffff",
                              border: `1px solid ${isChecked ? "#a7f3d0" : "#e2e8f0"}`,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ marginTop: "2px", cursor: "pointer", width: "15px", height: "15px", accentColor: "#16a34a" }}
                            />
                            <span style={{
                              fontSize: "12px",
                              lineHeight: "1.4",
                              color: isChecked ? "#065f46" : "#334155",
                              fontWeight: isChecked ? 600 : 400,
                            }}>
                              {item.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: "6px", fontSize: "10.5px", color: "#64748b", fontStyle: "italic" }}>
                    * Checkmarks are not strictly forced — verify items completed according to hotel standards.
                  </div>
                </div>

                <div className="cleaning-form-group" style={{ marginBottom: 0 }}>
                  <label className="cleaning-form-label">Completion Remarks / Notes</label>
                  <textarea
                    className="cleaning-form-textarea"
                    rows={2}
                    placeholder="Enter what was cleaned, linen replenished, minibar restocked..."
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "12px 20px" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setCompleteModalTask(null)}
                  disabled={completing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ background: "#16a34a", padding: "8px 18px", gap: "6px" }}
                  disabled={completing}
                >
                  <CheckCircle2 size={15} />
                  {completing ? "Submitting..." : "Mark Cleaned"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-PROGRESS CHECKLIST MODAL (Staff can view and mark items while cleaning in the room) */}
      {activeChecklistTask && (
        <div className="modal-overlay" onClick={() => setActiveChecklistTask(null)}>
          <div className="modal-content" style={{ maxWidth: "540px", maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
                  <ClipboardCheck size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", margin: 0, color: "#0f172a" }}>
                    Room {getRoom(activeChecklistTask.room_id)?.room_number || activeChecklistTask.room_id} Cleaning Checklist
                  </h2>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Tick off points as you clean • Created by Housekeeping HOD
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setActiveChecklistTask(null)}
                disabled={savingChecklist}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "3px 8px", borderRadius: "6px" }}>
                  {activeChecklistItems.filter((c) => c.checked).length} of {activeChecklistItems.length} tasks marked
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setActiveChecklistItems((prev) => prev.map((it) => ({ ...it, checked: true })))}
                    style={{ fontSize: "11px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Check All
                  </button>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <button
                    type="button"
                    onClick={() => setActiveChecklistItems((prev) => prev.map((it) => ({ ...it, checked: false })))}
                    style={{ fontSize: "11px", color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {activeChecklistItems.length === 0 ? (
                <div style={{ padding: "16px", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#64748b", textAlign: "center" }}>
                  No checklist items found for this cleaning task.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {activeChecklistItems.map((item, idx) => {
                    const isChecked = Boolean(item.checked);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleActiveChecklistItem(idx)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: isChecked ? "#ecfdf5" : "#ffffff",
                          border: `1px solid ${isChecked ? "#a7f3d0" : "#e2e8f0"}`,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ marginTop: "2px", cursor: "pointer", width: "16px", height: "16px", accentColor: "#16a34a" }}
                        />
                        <span style={{
                          fontSize: "13px",
                          lineHeight: "1.4",
                          color: isChecked ? "#065f46" : "#1e293b",
                          fontWeight: isChecked ? 600 : 400,
                        }}>
                          {item.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setActiveChecklistTask(null)}
                disabled={savingChecklist}
              >
                Close
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  style={{ color: "#059669", borderColor: "#a7f3d0", background: "#ecfdf5", fontWeight: 600 }}
                  onClick={handleSaveInProgressChecklist}
                  disabled={savingChecklist}
                >
                  <Save size={14} />
                  {savingChecklist ? "Saving..." : "Save Progress"}
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  style={{ background: "#16a34a", padding: "8px 16px" }}
                  onClick={() => {
                    const taskToComplete = activeChecklistTask;
                    setActiveChecklistTask(null);
                    handleOpenCompleteModal({ ...taskToComplete, checklist: activeChecklistItems });
                  }}
                >
                  <CheckCircle2 size={14} />
                  Proceed to Mark Cleaned
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RAISE MAINTENANCE REQUEST MODAL */}
      {isMaintModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMaintModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Wrench size={18} color="#d97706" />
                <h2>Raise Room Maintenance Request</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsMaintModalOpen(false)}
                disabled={submittingMaint}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitMaintenance}>
              <div className="modal-body">
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  Found a repair issue while cleaning? Submit this request directly to the Engineering & Maintenance team.
                </p>

                <div className="cleaning-form-group">
                  <label className="cleaning-form-label">Select Room *</label>
                  <select
                    className="cleaning-form-select"
                    required
                    value={maintForm.room_id}
                    onChange={(e) => setMaintForm((prev) => ({ ...prev, room_id: e.target.value }))}
                  >
                    <option value="">-- Choose Room --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} (Floor {r.floor} • {r.room_type || "Deluxe"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cleaning-form-row">
                  <div className="cleaning-form-group">
                    <label className="cleaning-form-label">Issue Category</label>
                    <select
                      className="cleaning-form-select"
                      value={maintForm.category}
                      onChange={(e) => setMaintForm((prev) => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="AC">HVAC / Air Conditioning</option>
                      <option value="Plumbing">Plumbing / Water Leak</option>
                      <option value="Electrical">Electrical / Lights / Power</option>
                      <option value="Carpentry">Furniture / Door / Window</option>
                      <option value="Bathroom">Bathroom Fixtures / Geyser</option>
                      <option value="Other">Other Maintenance</option>
                    </select>
                  </div>

                  <div className="cleaning-form-group">
                    <label className="cleaning-form-label">Urgency</label>
                    <select
                      className="cleaning-form-select"
                      value={maintForm.priority}
                      onChange={(e) => setMaintForm((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="low">Low Priority</option>
                      <option value="normal">Normal Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent / Blocking</option>
                    </select>
                  </div>
                </div>

                <div className="cleaning-form-group">
                  <label className="cleaning-form-label">Issue Description *</label>
                  <textarea
                    className="cleaning-form-textarea"
                    rows={3}
                    required
                    placeholder="Describe the issue found (e.g., Shower mixer leaking, AC remote broken, bathroom light flickering)..."
                    value={maintForm.description}
                    onChange={(e) => setMaintForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <input
                    type="checkbox"
                    id="blocksRoomCheck"
                    checked={maintForm.blocks_room}
                    onChange={(e) => setMaintForm((prev) => ({ ...prev, blocks_room: e.target.checked }))}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="blocksRoomCheck" style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", cursor: "pointer" }}>
                    Mark room Out-of-Order / Maintenance
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ background: "#f8fafc" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsMaintModalOpen(false)}
                  disabled={submittingMaint}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ background: "#d97706" }}
                  disabled={submittingMaint}
                >
                  <Save size={14} /> {submittingMaint ? "Submitting..." : "Submit Maintenance Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE AUDIT TRAIL MODAL (Full step-by-step history with timestamps) */}
      {selectedLogTask && (
        <div className="modal-overlay" onClick={() => setSelectedLogTask(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "640px", maxHeight: "88vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#eff6ff",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <History size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", margin: 0, color: "#0f172a" }}>
                    Room {getRoom(selectedLogTask.room_id)?.room_number || selectedLogTask.room_id} Turnover Audit Trail
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Task #HK-26-{selectedLogTask.id} • Chronological lifecycle events & timestamps
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedLogTask(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
              {/* Task summary header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    Attendant
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {selectedLogTask.assigned_to || "Unassigned"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    Priority
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {(selectedLogTask.priority || "NORMAL").toUpperCase()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    Current State
                  </div>
                  <div>
                    <span
                      className={`mono-pill ${getTaskInspectionInfo(selectedLogTask).badgeClass}`}
                      style={{ fontWeight: 700, fontSize: "11px" }}
                    >
                      {getTaskInspectionInfo(selectedLogTask).statusLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Audit Progression Timeline */}
              <div style={{ position: "relative", paddingLeft: "24px" }}>
                {/* Connecting bar */}
                <div
                  style={{
                    position: "absolute",
                    left: "9px",
                    top: "12px",
                    bottom: "16px",
                    width: "2px",
                    background: "#e2e8f0",
                  }}
                />

                {(() => {
                  const evs = extractTaskAuditEvents(selectedLogTask, getRoom(selectedLogTask.room_id));
                  if (evs.length === 0) {
                    return (
                      <p style={{ color: "#64748b", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                        No audit events recorded for this task yet.
                      </p>
                    );
                  }

                  return evs.map((ev, i) => (
                    <div key={ev.id || i} style={{ position: "relative", marginBottom: "16px" }}>
                      {/* Step Indicator Dot */}
                      <div
                        style={{
                          position: "absolute",
                          left: "-24px",
                          top: "4px",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: ev.badgeColor || "#2563eb",
                          border: "3px solid #ffffff",
                          boxShadow: `0 0 0 2px ${ev.badgeColor || "#2563eb"}44`,
                        }}
                      />

                      <div
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            className={`mono-pill ${ev.badgeClass}`}
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 700,
                              padding: "2px 8px",
                            }}
                          >
                            {ev.stageLabel}
                          </span>
                          <span
                            style={{
                              fontSize: "11.5px",
                              color: "#64748b",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock size={11} /> {formatLogDateTime(ev.timestamp)}
                          </span>
                        </div>

                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginTop: "3px" }}>
                          {ev.title}
                        </div>

                        <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", lineHeight: "1.4" }}>
                          {ev.details}
                        </div>

                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            marginTop: "6px",
                            paddingTop: "6px",
                            borderTop: "1px dashed #f1f5f9",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>Actor: <strong>{ev.actor}</strong> ({ev.role})</span>
                          <span>Timestamp: {formatLogDateTime(ev.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button
                type="button"
                className="btn-submit"
                onClick={() => setSelectedLogTask(null)}
                style={{ padding: "6px 16px", fontSize: "12.5px" }}
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
