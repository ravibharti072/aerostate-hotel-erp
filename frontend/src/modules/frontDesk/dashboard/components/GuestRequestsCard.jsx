import React from "react";
import { Bell, Check, Clock, Plus, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "../frontDeskCalendar.module.css";

export default function GuestRequestsCard({
  extraCharges = [],
  rooms = [],
  bookings = [],
  guestMap = {},
}) {
  const navigate = useNavigate();

  // Map charges with room/guest information
  const recentRequests = extraCharges.slice(0, 5).map((charge) => {
    const booking = bookings.find((b) => b.id === charge.booking_id);
    const room = rooms.find((r) => r.id === (charge.room_id || booking?.room_id));
    const guest = guestMap[booking?.guest_id];

    return {
      ...charge,
      roomNumber: room?.room_number || "N/A",
      guestName: guest?.full_name || "Guest",
    };
  });

  return (
    <div className={styles["operations-card"]} style={{ flex: 1 }}>
      <div className={styles["card-header-between"]}>
        <div>
          <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={16} color="#d97706" />
            Guest Services & Extra Requests
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Real-time amenity requests and folio room charges
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/guest-services")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          View All
          <ExternalLink size={12} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", marginTop: "10px" }}>
        {recentRequests.length > 0 ? (
          recentRequests.map((req) => {
            const status = String(req.status || "pending").toLowerCase();
            const isPending = status === "pending";

            return (
              <div
                key={req.id}
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
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong style={{ fontSize: "12px", color: "#0f172a" }}>
                      {req.charge_name || req.description || "Guest Service Request"}
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Rm {req.roomNumber}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {req.guestName} • ₹{Number(req.total_amount || req.rate || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    textTransform: "uppercase",
                    backgroundColor: isPending ? "#fef3c7" : "#dcfce7",
                    color: isPending ? "#92400e" : "#166534",
                  }}
                >
                  {status}
                </span>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8", fontSize: "12px" }}>
            No pending guest service charges or amenity requests.
          </div>
        )}
      </div>
    </div>
  );
}
