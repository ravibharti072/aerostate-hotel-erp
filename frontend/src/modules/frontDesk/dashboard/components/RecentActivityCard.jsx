import React from "react";
import { Activity, LogIn, LogOut, CheckCircle, Calendar } from "lucide-react";
import styles from "../frontDeskCalendar.module.css";

export default function RecentActivityCard({
  bookings = [],
  guestMap = {},
  rooms = [],
}) {
  // Extract activity feed from real booking records
  const activities = bookings
    .slice()
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .slice(0, 6)
    .map((b) => {
      const guest = guestMap[b.guest_id];
      const room = rooms.find((r) => r.id === b.room_id);
      const guestName = guest?.full_name || b.company_name || `Guest #${b.id}`;
      const status = String(b.status || "").toLowerCase();

      let actionText = "Reservation created";
      let Icon = Calendar;
      let iconColor = "#3b82f6";
      let iconBg = "#eff6ff";

      if (status === "checked-in") {
        actionText = "Guest checked in";
        Icon = LogIn;
        iconColor = "#16a34a";
        iconBg = "#dcfce7";
      } else if (status === "checked-out") {
        actionText = "Guest checked out";
        Icon = LogOut;
        iconColor = "#9333ea";
        iconBg = "#f3e8ff";
      }

      return {
        id: b.id,
        guestName,
        roomNumber: room ? `Room ${room.room_number}` : "Room Unassigned",
        actionText,
        time: b.updated_at || b.created_at || b.checkin_date || "Today",
        code: b.reservation_code || `#${b.id}`,
        Icon,
        iconColor,
        iconBg,
      };
    });

  return (
    <div className={styles["operations-card"]} style={{ flex: 1 }}>
      <div className={styles["card-header-between"]}>
        <div>
          <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={16} color="#3b82f6" />
            Front Desk Operations Log
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Audit trail of recent guest arrivals, departures, and bookings
          </span>
        </div>
        <span className={styles["card-badge-muted"]}>Live Log</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", marginTop: "10px" }}>
        {activities.length > 0 ? (
          activities.map((act) => {
            const Icon = act.Icon;
            return (
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
                      backgroundColor: act.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} color={act.iconColor} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong style={{ fontSize: "12px", color: "#0f172a" }}>{act.guestName}</strong>
                      <span style={{ fontSize: "10px", color: "#64748b", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>
                        {act.roomNumber}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {act.actionText} • Code: {act.code}
                    </span>
                  </div>
                </div>

                <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                  {act.time ? String(act.time).substring(0, 10) : "Today"}
                </span>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8", fontSize: "12px" }}>
            No recent activity recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
