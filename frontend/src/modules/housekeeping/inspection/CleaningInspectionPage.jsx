import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  BedDouble,
  Search,
  Filter,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  User,
  Layers,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader, Pagination } from "@components";
import "../checkoutCleaning/checkoutCleaning.css";

// Helper to format clean, professional inspection and cleaning notes
const formatInspectionNotes = (notes, isPassed, isFailed) => {
  if (!notes) return { type: "info", title: "Note", text: "Turnover cleaning completed." };

  const notesStr = String(notes);
  const passedMatch = notesStr.match(/\[Inspection PASSED.*?\]:?(.*)/i);
  const failedMatch = notesStr.match(/\[Inspection FAILED.*?\]:?(.*)/i);
  const completionMatch = notesStr.match(/Completion remarks:\s*(.*)/i);

  if (isPassed) {
    const remark = passedMatch ? passedMatch[1]?.trim() : "";
    return {
      type: "pass",
      title: "Inspection Passed",
      text: remark || "Room inspected & certified ready for guest check-in.",
    };
  }

  if (isFailed) {
    const reason = failedMatch ? failedMatch[1]?.trim() : "";
    return {
      type: "fail",
      title: "Re-clean Required",
      text: reason || "Inspection failed. Returned to cleaning queue.",
    };
  }

  if (completionMatch) {
    return {
      type: "info",
      title: "Attendant Remarks",
      text: completionMatch[1]?.trim(),
    };
  }

  // Clean up internal boilerplate text
  const cleaned = notesStr
    .replace(/Cleaning task assigned by supervisor\.?/gi, "")
    .replace(/Completion remarks:\s*/gi, "")
    .trim();

  return {
    type: "info",
    title: "Cleaning Remarks",
    text: cleaned || "Turnover completed and sanitization finished.",
  };
};

export default function CleaningInspectionPage({ showBack = true }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Inspection Fail Remarks Modal
  const [failModalTask, setFailModalTask] = useState(null);
  const [failRemarks, setFailRemarks] = useState("");
  const [submittingFail, setSubmittingFail] = useState(false);

  // Filters & Pagination
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("pending-inspection");
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [tasksRes, roomsRes] = await Promise.all([
        api.get("/housekeeping/tasks", { params }).catch(() => ({ data: [] })),
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
      ]);

      setTasks(normalizeList(tasksRes.data, "tasks"));
      setRooms(normalizeList(roomsRes.data, "rooms"));
    } catch (err) {
      console.error("Fetch inspection tasks error:", err);
      showToast(getApiErrorMessage(err, "Failed to load cleaning inspection records."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Inspection Action: Pass → Room becomes Ready
  const handlePassInspection = async (task) => {
    const room = getRoom(task.room_id);
    const roomNum = room?.room_number || task.room_id;
    try {
      setUpdatingId(task.id);
      await api.post(`/housekeeping/tasks/${task.id}/inspect`, {
        action: "pass",
        notes: "Passed HOD inspection. Room ready for guest check-in.",
      });
      showToast(`Inspection PASSED for Room ${roomNum}. Status updated to Ready.`, "success");
      await fetchData();
    } catch (err) {
      console.error("Pass inspection error:", err);
      showToast(getApiErrorMessage(err, "Failed to pass inspection."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Inspection Action: Fail → Send back to Cleaning
  const handleOpenFailModal = (task) => {
    setFailModalTask(task);
    setFailRemarks("");
  };

  const handleConfirmFail = async (e) => {
    e.preventDefault();
    if (!failModalTask) return;
    const room = getRoom(failModalTask.room_id);
    const roomNum = room?.room_number || failModalTask.room_id;

    try {
      setSubmittingFail(true);
      await api.post(`/housekeeping/tasks/${failModalTask.id}/inspect`, {
        action: "fail",
        notes: failRemarks.trim() || "Inspection failed. Rework / re-cleaning required.",
      });
      showToast(`Inspection FAILED for Room ${roomNum}. Sent back to Cleaning.`, "info");
      setFailModalTask(null);
      setFailRemarks("");
      await fetchData();
    } catch (err) {
      console.error("Fail inspection error:", err);
      showToast(getApiErrorMessage(err, "Failed to record inspection failure."), "error");
    } finally {
      setSubmittingFail(false);
    }
  };

  // Inspectable Turnover Tasks
  const inspectionTasks = useMemo(() => {
    return tasks.filter((t) => {
      const type = String(t.task_type || "").toLowerCase().replace(/_/g, "-");
      return (
        !type ||
        type === "checkout-cleaning" ||
        type === "room-cleaning" ||
        type === "cleaning" ||
        type === "turnover" ||
        type === "deep-cleaning"
      );
    });
  }, [tasks]);

  const stats = useMemo(() => {
    let pendingInspection = 0;
    let passedToday = 0;
    let inCleaning = 0;

    inspectionTasks.forEach((t) => {
      const st = String(t.status || "").toLowerCase();
      const notes = String(t.notes || "").toLowerCase();

      if (st === "completed" || st === "approved") {
        if (notes.includes("inspection passed")) {
          passedToday++;
        } else {
          pendingInspection++;
        }
      } else if (st === "in-progress" || st === "cleaning") {
        inCleaning++;
      }
    });

    return {
      pendingInspection,
      passedToday,
      inCleaning,
      total: inspectionTasks.length,
    };
  }, [inspectionTasks]);

  const filteredTasks = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return inspectionTasks.filter((task) => {
      const room = getRoom(task.room_id);
      const roomNum = String(room?.room_number || task.room_number || task.room_id || "").toLowerCase();
      const floorStr = String(room?.floor || task.floor || "").toLowerCase();
      const staffStr = String(task.assigned_to || "").toLowerCase();
      const notesStr = String(task.notes || "").toLowerCase();
      const st = String(task.status || "").toLowerCase();

      const matchesSearch =
        !search ||
        roomNum.includes(search) ||
        floorStr.includes(search) ||
        staffStr.includes(search) ||
        notesStr.includes(search);

      if (!matchesSearch) return false;

      if (selectedFloor !== "all" && floorStr !== selectedFloor.toLowerCase()) {
        return false;
      }

      // Tab filtering
      if (activeTab === "pending-inspection") {
        return (st === "completed" || st === "approved") && !notesStr.includes("inspection passed");
      }
      if (activeTab === "re-cleaning") {
        return (st === "in-progress" || st === "cleaning") && notesStr.includes("inspection failed");
      }
      if (activeTab === "all-cleaning") {
        return true;
      }

      return true;
    });
  }, [inspectionTasks, rooms, searchText, activeTab, selectedFloor]);

  const uniqueFloors = useMemo(() => {
    const set = new Set();
    rooms.forEach((r) => {
      if (r.floor !== null && r.floor !== undefined) set.add(String(r.floor));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rooms]);

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchText, selectedFloor, pageSize]);

  // Paginated records
  const paginatedTasks = useMemo(() => {
    const isAll = pageSize === "all" || pageSize >= 999999;
    if (isAll) return filteredTasks;
    const size = Number(pageSize) || 20;
    const startIndex = (currentPage - 1) * size;
    return filteredTasks.slice(startIndex, startIndex + size);
  }, [filteredTasks, currentPage, pageSize]);

  return (
    <div className="directory-page checkout-cleaning-directory">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Cleaning Inspection"
        kicker="HOUSEKEEPING OPERATIONS"
        description="Inspect completed room cleanings, certify readiness, or send rooms back for re-cleaning."
        icon={ClipboardCheck}
        backPath="/housekeeping/dashboard"
        showBack={showBack}
      />

      {/* 3 STAT CARDS */}
      <div className="dir-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <StatCard
          title="Awaiting Inspection"
          value={stats.pendingInspection}
          Icon={Clock}
          colorTheme="orange"
          onClick={() => setActiveTab("pending-inspection")}
        />
        <StatCard
          title="In Cleaning / Rework"
          value={stats.inCleaning}
          Icon={Sparkles}
          colorTheme="blue"
          onClick={() => setActiveTab("re-cleaning")}
        />
        <StatCard
          title="All Turnover Tasks"
          value={stats.total}
          Icon={BedDouble}
          colorTheme="purple"
          onClick={() => setActiveTab("all-cleaning")}
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Supervisor Inspection Queue"
          description="Evaluate turnover quality. Passing certifies the room as Ready; failing sends it back to Cleaning."
          badgeCount={filteredTasks.length}
          badgeLabel="rooms"
        />

        {/* SECTION TABS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "pending-inspection" ? "active" : ""}`}
            onClick={() => setActiveTab("pending-inspection")}
          >
            Awaiting Inspection <span className="tab-count-badge">{stats.pendingInspection}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "re-cleaning" ? "active" : ""}`}
            onClick={() => setActiveTab("re-cleaning")}
          >
            Failed / In Rework <span className="tab-count-badge">{stats.inCleaning}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "all-cleaning" ? "active" : ""}`}
            onClick={() => setActiveTab("all-cleaning")}
          >
            All Turnover Tasks <span className="tab-count-badge">{stats.total}</span>
          </button>
        </div>

        {/* SEARCH & ALL FLOOR SIDE BY SIDE */}
        <div
          className="dir-controls"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            width: "100%",
            padding: "12px 16px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            marginBottom: "16px",
            boxSizing: "border-box",
          }}
        >
          <div
            className="dir-search-box"
            style={{
              flex: "1 1 320px",
              maxWidth: "520px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "0 12px",
              height: "40px",
            }}
          >
            <Search size={16} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by Room Number, Floor, Attendant..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "13px",
                color: "#0f172a",
                width: "100%",
                height: "100%",
              }}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px",
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
            <select
              className="dir-filter-select"
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              style={{
                height: "40px",
                padding: "0 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
                outline: "none",
                minWidth: "150px",
              }}
            >
              <option value="all">All Floors</option>
              {uniqueFloors.map((fl) => (
                <option key={fl} value={fl}>
                  Floor {fl}
                </option>
              ))}
            </select>

            {(searchText || selectedFloor !== "all") && (
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setSearchText("");
                  setSelectedFloor("all");
                }}
                style={{
                  height: "40px",
                  padding: "0 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  borderColor: "#cbd5e1",
                  background: "#ffffff",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="dir-table-container">
          <table className="dir-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ minWidth: "110px" }}>Room</th>
                <th style={{ minWidth: "110px" }}>Floor / Type</th>
                <th style={{ minWidth: "130px" }}>Cleaned By</th>
                <th style={{ minWidth: "90px" }}>Priority</th>
                <th style={{ minWidth: "140px" }}>Status</th>
                <th style={{ minWidth: "260px" }}>Inspection Notes / Reason</th>
                <th style={{ minWidth: "180px", textAlign: "right" }}>Inspection Decision</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                    Loading inspection queue...
                  </td>
                </tr>
              ) : paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    No rooms found matching the current inspection criteria.
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => {
                  const room = getRoom(task.room_id);
                  const roomNum = room?.room_number || task.room_number || task.room_id;
                  const roomType = room?.room_type || task.room_type || "Deluxe";
                  const floorNum = room?.floor || task.floor || "1";
                  const st = String(task.status || "pending").toLowerCase();
                  const isPassed = String(task.notes || "").toLowerCase().includes("inspection passed");
                  const isFailed = String(task.notes || "").toLowerCase().includes("inspection failed");
                  const noteInfo = formatInspectionNotes(task.notes, isPassed, isFailed);

                  return (
                    <tr key={task.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="room-number-pill">Room {roomNum}</span>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>#{task.id}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ fontSize: "12px", color: "#0f172a" }}>Floor {floorNum}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>{roomType}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <User size={14} color="#64748b" />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                            {task.assigned_to || "Housekeeping Staff"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`mono-pill ${
                            task.priority === "urgent" || task.priority === "high"
                              ? "pill-urgent"
                              : "pill-normal"
                          }`}
                        >
                          {(task.priority || "NORMAL").toUpperCase()}
                        </span>
                      </td>

                      <td>
                        {isPassed ? (
                          <span className="balance-paid-text" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={13} /> Passed (Ready)
                          </span>
                        ) : isFailed ? (
                          <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={13} /> Sent for Re-clean
                          </span>
                        ) : st === "completed" || st === "approved" ? (
                          <span className="mono-pill pill-warning" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={11} /> AWAITING INSPECTION
                          </span>
                        ) : (
                          <span className="mono-pill pill-normal">
                            {st.toUpperCase()}
                          </span>
                        )}
                      </td>

                      <td style={{ maxWidth: "280px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color:
                                noteInfo.type === "pass"
                                  ? "#16a34a"
                                  : noteInfo.type === "fail"
                                  ? "#dc2626"
                                  : "#64748b",
                            }}
                          >
                            {noteInfo.title}
                          </span>
                          <span style={{ fontSize: "12px", color: "#334155", lineHeight: "1.4" }}>
                            {noteInfo.text}
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {isPassed ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "#ecfdf5",
                              color: "#059669",
                              border: "1px solid #a7f3d0",
                            }}
                          >
                            <CheckCircle2 size={14} /> Certified Ready
                          </span>
                        ) : (
                          <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn-action-complete"
                              style={{
                                background: "#16a34a",
                                color: "#ffffff",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                              }}
                              onClick={() => handlePassInspection(task)}
                              disabled={updatingId === task.id}
                              title="Pass Inspection -> Room becomes Ready"
                            >
                              <Check size={14} /> Pass (Ready)
                            </button>

                            <button
                              type="button"
                              className="btn-cancel"
                              style={{
                                color: "#dc2626",
                                borderColor: "#fecaca",
                                background: "#fef2f2",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                              }}
                              onClick={() => handleOpenFailModal(task)}
                              disabled={updatingId === task.id}
                              title="Fail Inspection -> Send back to Cleaning"
                            >
                              <X size={14} /> Fail (Re-Clean)
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div style={{ marginTop: "16px" }}>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredTasks.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(newSize) => {
              setPageSize(Number(newSize));
              setCurrentPage(1);
            }}
            pageSizeOptions={[20, 50, 100]}
            itemLabel="tasks"
          />
        </div>
      </section>

      {/* FAIL INSPECTION REASON MODAL */}
      {failModalTask && (
        <div className="modal-overlay" onClick={() => setFailModalTask(null)}>
          <div className="modal-content" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={18} color="#dc2626" />
                <h2>Fail Inspection: Room {getRoom(failModalTask.room_id)?.room_number || failModalTask.room_id}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setFailModalTask(null)}
                disabled={submittingFail}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmFail}>
              <div className="modal-body">
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  This will reject the cleaning turnover and send the room back to the <strong>Cleaning</strong> state for attendant rework.
                </p>

                <div className="cleaning-form-group">
                  <label className="cleaning-form-label">Reason for Re-Cleaning *</label>
                  <textarea
                    className="cleaning-form-textarea"
                    rows={3}
                    required
                    placeholder="e.g., Bathroom mirror smudged, fresh towels missing, bed linen not changed properly..."
                    value={failRemarks}
                    onChange={(e) => setFailRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: "#f8fafc" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setFailModalTask(null)}
                  disabled={submittingFail}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ background: "#dc2626" }}
                  disabled={submittingFail}
                >
                  {submittingFail ? "Sending back..." : "Confirm & Send Back to Cleaning"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
