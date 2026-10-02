import React from "react";
import { AlertCircle, CheckCircle, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "../frontDeskCalendar.module.css";

export default function FrontDeskWorkQueueCard({
  activeBookings,
  rooms,
  guestMap,
  handleCheckOut,
  setSelectedBooking,
}) {
  const navigate = useNavigate();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const tasks = [];

  // 1. Identify Overdue Checkouts (Scheduled today or earlier, still checked-in)
  activeBookings.forEach((b) => {
    const s = String(b.status || "").toLowerCase();
    const outDate = String(b.checkout_date || "").substring(0, 10);
    if (s === "checked-in" && outDate <= todayStr) {
      const guest = guestMap[b.guest_id];
      const room = rooms.find((r) => r.id === b.room_id);
      const guestName = guest?.full_name || b.company_name || `Guest #${b.id}`;
      const balance = Math.max(0, (Number(b.total_amount) || 0) - (Number(b.advance_paid) || 0));

      tasks.push({
        id: `overdue-${b.id}`,
        priority: "HIGH",
        title: `Overdue Check-Out: ${guestName}`,
        subtitle: `Room ${room?.room_number || "N/A"} • ${balance > 0 ? `₹${balance.toLocaleString()} pending` : "Paid in full"}`,
        actionLabel: "Check Out",
        actionColor: "#d97706",
        onAction: () => handleCheckOut(b.id),
        onClick: () => setSelectedBooking({ ...b, guest, room }),
      });
    }
  });

  // 2. Unassigned Arrivals (Arrival today with room_id not set or null)
  activeBookings.forEach((b) => {
    const s = String(b.status || "").toLowerCase();
    const inDate = String(b.checkin_date || "").substring(0, 10);
    if (inDate === todayStr && !b.room_id && s !== "cancelled" && s !== "checked-out") {
      const guest = guestMap[b.guest_id];
      const guestName = guest?.full_name || b.company_name || `Guest #${b.id}`;

      tasks.push({
        id: `unassigned-${b.id}`,
        priority: "HIGH",
        title: `Unassigned Arrival: ${guestName}`,
        subtitle: `Booking ${b.reservation_code || `#${b.id}`} arriving today requires room allocation`,
        actionLabel: "Assign Room",
        actionColor: "#2563eb",
        onAction: () => navigate("/check-in-out"),
        onClick: () => setSelectedBooking({ ...b, guest }),
      });
    }
  });

  // 3. Rooms that are dirty / cleaning with an arrival scheduled today
  rooms.forEach((r) => {
    const roomStatus = String(r.status || "").toLowerCase();
    if (roomStatus === "cleaning" || roomStatus === "dirty") {
      const incomingBooking = activeBookings.find(
        (b) =>
          b.room_id === r.id &&
          String(b.checkin_date || "").substring(0, 10) === todayStr &&
          String(b.status || "").toLowerCase() === "confirmed"
      );

      if (incomingBooking) {
        tasks.push({
          id: `turnover-${r.id}`,
          priority: "MEDIUM",
          title: `Expedite Turnover: Room ${r.room_number}`,
          subtitle: `Room is currently ${roomStatus} with guest scheduled to arrive today`,
          actionLabel: "Housekeeping",
          actionColor: "#059669",
          onAction: () => navigate("/housekeeping"),
          onClick: () => navigate("/housekeeping"),
        });
      }
    }
  });

  // If queue is light, add an informative task
  if (tasks.length === 0) {
    tasks.push({
      id: "all-clear",
      priority: "INFO",
      title: "Front Desk Queue is Clear",
      subtitle: "All checkouts, arrivals, and room assignments for the current shift are on schedule.",
      actionLabel: "All Bookings",
      actionColor: "#64748b",
      onAction: () => navigate("/bookings"),
      onClick: () => navigate("/bookings"),
    });
  }

  return (
    <div className={styles["operations-card"]} style={{ flex: 1 }}>
      <div className={styles["card-header-between"]}>
        <div>
          <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={16} color="#dc2626" />
            Front Desk Work Queue
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Action items requiring desk staff attention
          </span>
        </div>
        <span className={styles["card-badge-muted"]}>
          {tasks.filter((t) => t.priority !== "INFO").length} Pending
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", marginTop: "10px" }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={task.onClick}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor:
                    task.priority === "HIGH"
                      ? "#fee2e2"
                      : task.priority === "MEDIUM"
                      ? "#fef3c7"
                      : "#e2e8f0",
                  color:
                    task.priority === "HIGH"
                      ? "#dc2626"
                      : task.priority === "MEDIUM"
                      ? "#b45309"
                      : "#475569",
                  letterSpacing: "0.04em",
                }}
              >
                {task.priority}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <strong style={{ fontSize: "12px", color: "#0f172a" }}>{task.title}</strong>
                <span style={{ fontSize: "11px", color: "#64748b" }}>{task.subtitle}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                task.onAction();
              }}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                background: "#f1f5f9",
                color: task.actionColor,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {task.actionLabel}
              <ArrowRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
