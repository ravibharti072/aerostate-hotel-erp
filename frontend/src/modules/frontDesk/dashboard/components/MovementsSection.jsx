import React from "react";
import { Clock, BedDouble, Search } from "lucide-react";
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

export default function MovementsSection({
  dailyMovements,
  guestMap,
  rooms,
  movementSearch,
  setMovementSearch,
  arrivalsViewMode,
  setArrivalsViewMode,
  setSelectedBooking,
  setMovementsModalType,
  handleCheckIn,
  handleCheckOut,
}) {
  return (
    <div className={styles["operations-card"]} style={{ width: "100%" }}>
      <div className={styles["card-header-between"]}>
        <div>
          <h3 className={styles["card-title-main"]}>Check In / Out & Live Movements</h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Real-time arrivals, departures, and active room occupants
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type="text"
              value={movementSearch}
              onChange={(e) => setMovementSearch(e.target.value)}
              placeholder="Search guest or room..."
              className={styles["movements-search-input"]}
            />
          </div>
          <button
            type="button"
            onClick={() => setMovementsModalType("all")}
            className={styles["view-all-movements-btn"]}
            title="Open all live movements directory"
          >
            View All
          </button>
        </div>
      </div>

      <div className={styles["movements-three-cols"]}>
        {/* Column 1: Arrivals */}
        <div className={styles["movement-col"]}>
          <div className={styles["movement-col-title"]}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{arrivalsViewMode === "today" ? "Today Arrivals" : "Coming Guests"}</span>
              <span className={styles["movement-count-tag"]}>
                {dailyMovements.arrivals.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setArrivalsViewMode(arrivalsViewMode === "today" ? "all" : "today")}
              className={styles["mode-toggle-btn"]}
              title="Toggle between today's arrivals and all upcoming coming guests"
            >
              {arrivalsViewMode === "today"
                ? `All Coming (${dailyMovements.allComingCount})`
                : `Today Only (${dailyMovements.todayArrivalsCount})`}
            </button>
          </div>

          <div className={styles["movement-items-list"]}>
            {dailyMovements.arrivals.length > 0 ? (
              <>
                {dailyMovements.arrivals.slice(0, 3).map((b) => {
                  const guest = guestMap[b.guest_id];
                  const room = rooms.find((r) => r.id === b.room_id);
                  const gName = guest?.full_name || b.company_name || `Guest #${b.id}`;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking({ ...b, guest, room })}
                      className={styles["movement-item-card"]}
                    >
                      <div className={styles["guest-name-row"]}>
                        <span className={styles["guest-name-text"]}>{gName}</span>
                        <span className={styles["guest-room-tag"]}>
                          {room ? `Rm ${room.room_number}` : "Unassigned"}
                        </span>
                      </div>
                      <div className={styles["guest-footer-row"]}>
                        <span className={styles["guest-time-label"]}>
                          <Clock size={11} />{" "}
                          {formatMovementTime(b.checkin_date, "12:00 PM")}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckIn(b.id);
                          }}
                          className={`${styles["quick-action-pill"]} ${styles["checkin"]}`}
                        >
                          Check In
                        </button>
                      </div>
                    </div>
                  );
                })}
                {dailyMovements.arrivals.length > 3 && (
                  <button
                    type="button"
                    className={styles["see-more-btn"]}
                    onClick={() => setMovementsModalType("arrivals")}
                  >
                    + {dailyMovements.arrivals.length - 3} more • View All
                  </button>
                )}
              </>
            ) : (
              <div className={styles["empty-col-note"]}>
                {arrivalsViewMode === "today"
                  ? "No arrivals scheduled today"
                  : "No coming guests found"}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Departures */}
        <div className={styles["movement-col"]}>
          <div className={styles["movement-col-title"]}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Today Checkout</span>
              <span className={styles["movement-count-tag"]}>
                {dailyMovements.departures.length}
              </span>
            </div>
          </div>

          <div className={styles["movement-items-list"]}>
            {dailyMovements.departures.length > 0 ? (
              <>
                {dailyMovements.departures.slice(0, 3).map((b) => {
                  const guest = guestMap[b.guest_id];
                  const room = rooms.find((r) => r.id === b.room_id);
                  const gName = guest?.full_name || b.company_name || `Guest #${b.id}`;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking({ ...b, guest, room })}
                      className={styles["movement-item-card"]}
                    >
                      <div className={styles["guest-name-row"]}>
                        <span className={styles["guest-name-text"]}>{gName}</span>
                        <span className={styles["guest-room-tag"]}>
                          {room ? `Rm ${room.room_number}` : "Unassigned"}
                        </span>
                      </div>
                      <div className={styles["guest-footer-row"]}>
                        <span className={styles["guest-time-label"]}>
                          <Clock size={11} />{" "}
                          {formatMovementTime(b.checkout_date, "11:00 AM")}
                        </span>
                        {String(b.status || "").toLowerCase() === "checked-out" ? (
                          <span
                            className={styles["quick-action-pill"]}
                            style={{
                              background: "#f3e8ff",
                              color: "#6b21a8",
                              border: "1px solid #d8b4fe",
                              cursor: "default",
                              fontWeight: 700,
                            }}
                          >
                            Checked Out
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckOut(b.id);
                            }}
                            className={`${styles["quick-action-pill"]} ${styles["checkout"]}`}
                          >
                            Check Out
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {dailyMovements.departures.length > 3 && (
                  <button
                    type="button"
                    className={styles["see-more-btn"]}
                    onClick={() => setMovementsModalType("departures")}
                  >
                    + {dailyMovements.departures.length - 3} more • View All
                  </button>
                )}
              </>
            ) : (
              <div className={styles["empty-col-note"]}>No departures scheduled today</div>
            )}
          </div>
        </div>

        {/* Column 3: Guest In-House */}
        <div className={styles["movement-col"]}>
          <div className={styles["movement-col-title"]}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>In-House Guests</span>
              <span className={styles["movement-count-tag"]}>
                {dailyMovements.inHouse.length}
              </span>
            </div>
          </div>

          <div className={styles["movement-items-list"]}>
            {dailyMovements.inHouse.length > 0 ? (
              <>
                {dailyMovements.inHouse.slice(0, 3).map((b) => {
                  const guest = guestMap[b.guest_id];
                  const room = rooms.find((r) => r.id === b.room_id);
                  const gName = guest?.full_name || b.company_name || `Guest #${b.id}`;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking({ ...b, guest, room })}
                      className={styles["movement-item-card"]}
                    >
                      <div className={styles["guest-name-row"]}>
                        <span className={styles["guest-name-text"]}>{gName}</span>
                        <span className={styles["guest-room-tag"]}>
                          {room ? `Rm ${room.room_number}` : "Unassigned"}
                        </span>
                      </div>
                      <div className={styles["guest-footer-row"]}>
                        <span className={styles["guest-time-label"]}>
                          <BedDouble size={11} /> {room?.room_type || "Deluxe"}
                        </span>
                        <span className={`${styles["quick-action-pill"]} ${styles["inhouse"]}`}>
                          Staying
                        </span>
                      </div>
                    </div>
                  );
                })}
                {dailyMovements.inHouse.length > 3 && (
                  <button
                    type="button"
                    className={styles["see-more-btn"]}
                    onClick={() => setMovementsModalType("inHouse")}
                  >
                    + {dailyMovements.inHouse.length - 3} more • View All
                  </button>
                )}
              </>
            ) : (
              <div className={styles["empty-col-note"]}>No guests currently in-house</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Operations Summary Strip */}
      <div className={styles["movements-bottom-strip"]}>
        <div className={styles["movement-summary-tile"]}>
          <span className={styles["movement-summary-label"]}>Expected Arrivals</span>
          <span className={styles["movement-summary-val"]}>
            {dailyMovements.todayArrivalsCount} Guests
          </span>
          <span className={styles["movement-summary-sub"]}>Pending check-in today</span>
        </div>

        <div className={styles["movement-summary-tile"]}>
          <span className={styles["movement-summary-label"]}>Scheduled Departures</span>
          <span className={styles["movement-summary-val"]}>
            {dailyMovements.todayDeparturesCount} Guests
          </span>
          <span className={styles["movement-summary-sub"]}>Today checkout</span>
        </div>

        <div className={styles["movement-summary-tile"]}>
          <span className={styles["movement-summary-label"]}>Property In-House</span>
          <span className={styles["movement-summary-val"]}>
            {dailyMovements.inHouseCount} / {rooms.length} Rooms
          </span>
          <span className={styles["movement-summary-sub"]}>
            {Math.round((dailyMovements.inHouseCount / (rooms.length || 1)) * 100)}% live occupancy
          </span>
        </div>
      </div>
    </div>
  );
}
