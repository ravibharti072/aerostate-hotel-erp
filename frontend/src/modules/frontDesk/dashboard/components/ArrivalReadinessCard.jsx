import React from "react";
import { CheckCircle2, AlertTriangle, Clock, AlertCircle, Sparkles, UserCheck } from "lucide-react";
import styles from "../frontDeskCalendar.module.css";

export default function ArrivalReadinessCard({
  activeBookings,
  rooms,
  guestMap,
  handleCheckIn,
  setSelectedBooking,
}) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  // Today's incoming reservations that have not checked in yet
  const pendingArrivals = activeBookings.filter((b) => {
    const isToday = String(b.checkin_date || "").substring(0, 10) === todayStr;
    const s = String(b.status || "").toLowerCase();
    return isToday && s !== "cancelled" && s !== "canceled" && s !== "checked-in" && s !== "checked-out";
  });

  // Calculate readiness status for each arrival
  const arrivalAssessments = pendingArrivals.map((b) => {
    const guest = guestMap[b.guest_id];
    const room = rooms.find((r) => r.id === b.room_id);
    const guestName = guest?.full_name || b.company_name || `Guest #${b.id}`;

    if (!room) {
      return {
        booking: b,
        guest,
        room: null,
        guestName,
        statusKey: "unassigned",
        label: "Room Unassigned",
        badgeColor: "#9333ea",
        badgeBg: "#f3e8ff",
        canCheckIn: false,
        note: "Assign a room before arrival",
      };
    }

    const roomStatus = String(room.status || "available").toLowerCase();

    if (roomStatus === "available") {
      return {
        booking: b,
        guest,
        room,
        guestName,
        statusKey: "ready",
        label: "Ready for Guest",
        badgeColor: "#16a34a",
        badgeBg: "#dcfce7",
        canCheckIn: true,
        note: `Room ${room.room_number} inspected & clean`,
      };
    }

    if (roomStatus === "cleaning" || roomStatus === "dirty") {
      return {
        booking: b,
        guest,
        room,
        guestName,
        statusKey: "cleaning",
        label: "Turnover Cleaning",
        badgeColor: "#d97706",
        badgeBg: "#fef3c7",
        canCheckIn: false,
        note: `Room ${room.room_number} in housekeeping`,
      };
    }

    if (roomStatus === "occupied") {
      return {
        booking: b,
        guest,
        room,
        guestName,
        statusKey: "occupied",
        label: "Occupant Present",
        badgeColor: "#dc2626",
        badgeBg: "#fee2e2",
        canCheckIn: false,
        note: `Room ${room.room_number} awaiting departure`,
      };
    }

    return {
      booking: b,
      guest,
      room,
      guestName,
      statusKey: "maintenance",
      label: "Room Blocked",
      badgeColor: "#64748b",
      badgeBg: "#f1f5f9",
      canCheckIn: false,
      note: `Room ${room.room_number} under maintenance`,
    };
  });

  const total = arrivalAssessments.length;
  const readyCount = arrivalAssessments.filter((a) => a.statusKey === "ready").length;
  const readyPct = total > 0 ? Math.round((readyCount / total) * 100) : 100;

  return (
    <div className={styles["operations-card"]} style={{ flex: 1 }}>
      <div className={styles["card-header-between"]}>
        <div>
          <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} color="#2563eb" />
            Arrival Readiness & Prep
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Real-time room readiness for today's arriving guests
          </span>
        </div>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: "6px",
            backgroundColor: readyPct === 100 ? "#dcfce7" : "#fef3c7",
            color: readyPct === 100 ? "#166534" : "#92400e",
          }}
        >
          {readyCount} of {total} Ready ({readyPct}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden", margin: "10px 0" }}>
        <div
          style={{
            height: "100%",
            width: `${readyPct}%`,
            backgroundColor: readyPct === 100 ? "#10b981" : "#f59e0b",
            borderRadius: "9999px",
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Readiness Assessment List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
        {arrivalAssessments.length > 0 ? (
          arrivalAssessments.map((item) => (
            <div
              key={item.booking.id}
              onClick={() => setSelectedBooking({ ...item.booking, guest: item.guest, room: item.room })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "border-color 0.15s ease",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong style={{ fontSize: "12px", color: "#0f172a" }}>{item.guestName}</strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {item.room ? `Room ${item.room.room_number}` : "Unassigned"}
                  </span>
                </div>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{item.note}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    backgroundColor: item.badgeBg,
                    color: item.badgeColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>

                {item.canCheckIn && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckIn(item.booking.id);
                    }}
                    className={`${styles["quick-action-pill"]} ${styles["checkin"]}`}
                  >
                    Check In
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "24px 12px", color: "#94a3b8", fontSize: "12px" }}>
            All expected guests for today have been checked in or no remaining arrivals.
          </div>
        )}
      </div>
    </div>
  );
}
