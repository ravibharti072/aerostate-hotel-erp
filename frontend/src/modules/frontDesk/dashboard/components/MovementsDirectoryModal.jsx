import React from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "../frontDeskCalendar.module.css";

// Parse datetime strings, treating naive ISO strings from server as UTC
const parseServerDate = (str) => {
  if (!str) return null;
  const s = String(str).trim();
  if (s.length <= 10) return new Date(`${s}T00:00:00Z`);
  if (s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s.replace(" ", "T") + "Z");
};

// Robust movement time formatter: handles UTC date-only midnight timestamps & timezone offsets
const formatMovementTime = (dateStr, defaultTime = "11:00 AM") => {
  if (!dateStr) return defaultTime;
  const s = String(dateStr).trim();
  if (s.length <= 10) return defaultTime;
  try {
    const d = parseServerDate(dateStr);
    if (!d || isNaN(d.getTime())) return defaultTime;
    // 00:00 UTC signifies date-only input stored as datetime
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      return defaultTime;
    }
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return defaultTime;
  }
};

export default function MovementsDirectoryModal({
  movementsModalType,
  setMovementsModalType,
  dailyMovements,
  activeBookings,
  guestMap,
  rooms,
  now,
  setSelectedBooking,
  handleCheckIn,
  handleCheckOut,
}) {
  const navigate = useNavigate();
  if (!movementsModalType) return null;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  let list = [];
  if (
    movementsModalType === "todayArrivals" ||
    movementsModalType === "arrivals" ||
    movementsModalType === "all"
  ) {
    list = activeBookings.filter((b) => {
      const isToday = String(b.checkin_date || "").substring(0, 10) === todayStr;
      const s = String(b.status || "").toLowerCase();
      return isToday && s !== "cancelled" && s !== "canceled" && s !== "checked-out";
    });
  } else if (movementsModalType === "allComing") {
    list = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return (
        (s === "confirmed" || s === "booked" || s === "reserved") &&
        s !== "cancelled" &&
        s !== "checked-out"
      );
    });
  } else if (
    movementsModalType === "todayDepartures" ||
    movementsModalType === "departures"
  ) {
    list = activeBookings.filter((b) => {
      const isToday = String(b.checkout_date || "").substring(0, 10) === todayStr;
      const s = String(b.status || "").toLowerCase();
      return isToday && s !== "cancelled" && s !== "canceled";
    });
  } else if (movementsModalType === "inHouse") {
    list = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "checked-in" || s === "in-house";
    });
  } else if (movementsModalType === "allDepartures") {
    list = activeBookings.filter(
      (b) => String(b.status || "").toLowerCase() === "checked-out"
    );
  }

  return (
    <div className={styles["modal-overlay"]}>
      <div
        className={styles["modal-content-card"]}
        style={{ maxWidth: "780px", maxHeight: "88vh" }}
      >
        <div className={styles["modal-header"]}>
          <div>
            <h3 className={styles["modal-title"]}>Live Guest Movements Directory</h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Real-time operational tracking of arrivals, departures, and in-house guests
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMovementsModalType(null)}
            className={styles["modal-close-btn"]}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "12px 24px 0",
            borderBottom: "1px solid #e2e8f0",
            overflowX: "auto",
          }}
        >
          {[
            {
              key: "todayArrivals",
              label: `Today Arrivals (${dailyMovements.todayArrivalsCount})`,
            },
            {
              key: "allComing",
              label: `All Coming Guests (${dailyMovements.allComingCount})`,
            },
            {
              key: "todayDepartures",
              label: `Today Checkout (${dailyMovements.todayDeparturesCount})`,
            },
            {
              key: "inHouse",
              label: `In-House Guests (${dailyMovements.inHouseCount})`,
            },
            {
              key: "allDepartures",
              label: `All Departures (${dailyMovements.allDeparturesCount})`,
            },
          ].map((tab) => {
            const isActive =
              (movementsModalType === "all" && tab.key === "todayArrivals") ||
              movementsModalType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMovementsModalType(tab.key)}
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "none",
                  borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                  background: "transparent",
                  color: isActive ? "#2563eb" : "#64748b",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          className={styles["modal-body"]}
          style={{
            padding: "16px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {list.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 16px",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              No records found in this category.
            </div>
          ) : (
            list.map((b) => {
              const guest = guestMap[b.guest_id];
              const room = rooms.find((r) => r.id === b.room_id);
              const gName = guest?.full_name || b.company_name || `Guest #${b.id}`;
              const s = String(b.status || "").toLowerCase();

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBooking({ ...b, guest, room });
                    setMovementsModalType(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#0f172a" }}>{gName}</strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {guest?.phone || ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      <span style={{ fontWeight: 600, color: "#334155" }}>
                        {room ? `Room ${room.room_number}` : "Room Unassigned"}
                      </span>
                      {room?.room_type && (
                        <span style={{ color: "#94a3b8" }}>({room.room_type})</span>
                      )}
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <span>
                        In: {b.checkin_date ? String(b.checkin_date).substring(0, 10) : "N/A"}{" "}
                        <strong style={{ color: "#0284c7" }}>({formatMovementTime(b.checkin_date, "12:00 PM")})</strong>
                      </span>
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <span>
                        Out: {b.checkout_date ? String(b.checkout_date).substring(0, 10) : "N/A"}{" "}
                        <strong style={{ color: "#dc2626" }}>({formatMovementTime(b.checkout_date, "11:00 AM")})</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        textTransform: "uppercase",
                        backgroundColor:
                          s === "checked-in"
                            ? "#dcfce7"
                            : s === "confirmed"
                            ? "#dbeafe"
                            : s === "checked-out"
                            ? "#f3e8ff"
                            : "#f1f5f9",
                        color:
                          s === "checked-in"
                            ? "#166534"
                            : s === "confirmed"
                            ? "#1e40af"
                            : s === "checked-out"
                            ? "#6b21a8"
                            : "#475569",
                      }}
                    >
                      {b.status}
                    </span>

                    {s === "confirmed" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckIn(b.id);
                          setMovementsModalType(null);
                        }}
                        className={`${styles["quick-action-pill"]} ${styles["checkin"]}`}
                      >
                        Check In
                      </button>
                    )}

                    {s === "checked-in" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckOut(b.id);
                          setMovementsModalType(null);
                        }}
                        className={`${styles["quick-action-pill"]} ${styles["checkout"]}`}
                      >
                        Check Out
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          className={styles["modal-footer"]}
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <button
            type="button"
            onClick={() => {
              setMovementsModalType(null);
              navigate("/check-in-out");
            }}
            className={styles["btn-primary"]}
            style={{ background: "#2563eb" }}
          >
            Go to Full Check-In / Out Desk
          </button>
          <button
            type="button"
            onClick={() => setMovementsModalType(null)}
            className={styles["btn-secondary"]}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
