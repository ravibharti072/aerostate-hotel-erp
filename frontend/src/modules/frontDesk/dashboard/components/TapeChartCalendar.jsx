import React from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Calendar,
  X,
} from "lucide-react";
import styles from "../frontDeskCalendar.module.css";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PASTEL_THEMES = [
  styles["pastel-blue"],
  styles["pastel-green"],
  styles["pastel-amber"],
  styles["pastel-olive"],
  styles["pastel-purple"],
];

export default function TapeChartCalendar({
  rooms,
  activeBookings,
  guestMap,
  categorizedRooms,
  collapsedCategories,
  toggleCategory,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  visibleStartYear,
  setVisibleStartYear,
  monthDays,
  daysInMonth,
  goLiveDate,
  searchQuery,
  setSearchQuery,
  roomTypeFilter,
  setRoomTypeFilter,
  statusFilter,
  setStatusFilter,
  scrollContainerRef,
  handleJumpToToday,
  handleCellClick,
  setSelectedBooking,
}) {
  return (
    <>
      {/* -------------------------------------------------------------
          SIDE-BY-SIDE YEAR & MONTH NAVIGATOR BAR
          Eliminates blank space by placing Month & Year side by side
          ------------------------------------------------------------- */}
      <div className={styles["timeline-nav-card"]}>
        {/* Left Side: Month Selector Carousel */}
        <div className={styles["month-selector-block"]}>
          <button
            type="button"
            onClick={() => setSelectedMonth((m) => (m === 0 ? 11 : m - 1))}
            className={styles["nav-arrow-btn"]}
            title="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>

          {MONTH_NAMES.map((mName, mIdx) => {
            const isMonthPrior = Boolean(
              goLiveDate &&
                `${selectedYear}-${String(mIdx + 1).padStart(2, "0")}` < goLiveDate.slice(0, 7)
            );

            return (
              <button
                key={mName}
                type="button"
                onClick={() => setSelectedMonth(mIdx)}
                className={`${styles["selector-pill"]} ${
                  selectedMonth === mIdx ? styles["active"] : ""
                } ${isMonthPrior ? styles["locked"] : ""}`}
                title={isMonthPrior ? `Before Go-Live Date (${goLiveDate})` : mName}
              >
                {mName}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedMonth((m) => (m === 11 ? 0 : m + 1))}
            className={styles["nav-arrow-btn"]}
            title="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Vertical Divider */}
        <div className={styles["nav-vertical-divider"]} />

        {/* Right Side: Year Selector */}
        <div className={styles["year-selector-block"]}>
          <button
            type="button"
            onClick={() => setVisibleStartYear((y) => Math.max(2020, y - 1))}
            className={styles["nav-arrow-btn"]}
            title="Previous Year"
          >
            <ChevronLeft size={16} />
          </button>

          {[0, 1, 2, 3].map((offset) => {
            const y = visibleStartYear + offset;
            const isYearPrior = Boolean(goLiveDate && String(y) < goLiveDate.slice(0, 4));

            return (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`${styles["selector-pill"]} ${
                  selectedYear === y ? styles["active"] : ""
                } ${isYearPrior ? styles["locked"] : ""}`}
                title={isYearPrior ? `Before Go-Live Date (${goLiveDate})` : String(y)}
              >
                {y}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setVisibleStartYear((y) => y + 1)}
            className={styles["nav-arrow-btn"]}
            title="Next Year"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          TIMELINE CONTROLS BAR (Filters & Jump to Today)
          ------------------------------------------------------------- */}
      <div className={styles["timeline-controls-card"]}>
        <div className={styles["controls-bar"]}>
          {/* Search Box */}
          <div className={styles["search-box"]}>
            <Search size={15} className={styles["search-icon"]} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guest, booking code, or room..."
              className={styles["search-input"]}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={styles["search-clear-btn"]}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Right Action Tools */}
          <div className={styles["action-tools-group"]}>
            {/* Room Type Filter */}
            <div className={styles["select-wrapper"]}>
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className={styles["control-select"]}
              >
                <option value="all">All Room Types</option>
                {Array.from(new Set(rooms.map((r) => r.room_type).filter(Boolean))).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Booking Status Filter */}
            <div className={styles["select-wrapper"]}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles["control-select"]}
              >
                <option value="all">All Booking Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked-in">Checked In</option>
                <option value="checked-out">Checked Out</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>

            {/* Jump to Today */}
            <button
              type="button"
              onClick={handleJumpToToday}
              className={styles["jump-today-btn"]}
              title="Jump to today's date"
            >
              <Calendar size={13} />
              Jump to Today
            </button>
          </div>
        </div>

        {/* Calendar Timeline Table View */}
        <div className={styles["table-scroll-container"]} ref={scrollContainerRef}>
          <table className={styles["timeline-table"]}>
            <thead>
              <tr>
                {/* Sticky Left Corner Header */}
                <th
                  className={`${styles["header-date-th"]} ${styles["sticky-room-col"]}`}
                  style={{
                    textAlign: "left",
                    padding: "16px 18px",
                    fontSize: "14px",
                    fontWeight: 800,
                  }}
                >
                  Rooms
                </th>

                {/* Day Columns */}
                {monthDays.map((d) => (
                  <th
                    key={d.day}
                    className={`${styles["header-date-th"]} ${
                      d.isToday ? styles["today"] : ""
                    } ${d.isLocked ? styles["locked"] : ""}`}
                  >
                    <span className={styles["day-name"]}>{d.dayName}</span>
                    <span
                      className={`${styles["day-number"]} ${
                        d.isToday ? styles["today-badge"] : ""
                      }`}
                    >
                      {String(d.day).padStart(2, "0")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Object.entries(categorizedRooms).map(([category, catRooms]) => {
                const isCollapsed = Boolean(collapsedCategories[category]);

                return (
                  <React.Fragment key={category}>
                    {/* Clean Category Group Header */}
                    <tr className={styles["category-row"]}>
                      <td
                        className={`${styles["category-name-cell"]} ${styles["sticky-room-col"]}`}
                        onClick={() => toggleCategory(category)}
                      >
                        <span>
                          {category} Rooms ({catRooms.length})
                        </span>
                        <span className={styles["category-collapse-icon"]}>
                          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </span>
                      </td>

                      {/* Clean Neutral Filler Cells across the row */}
                      {monthDays.map((d) => (
                        <td key={d.day} className={styles["category-filler-cell"]} />
                      ))}
                    </tr>

                    {/* Individual Room Rows */}
                    {!isCollapsed &&
                      catRooms.map((room) => {
                        // Find bookings for this room that strictly overlap this selected month
                        const roomBookings = activeBookings
                          .filter((b) => {
                            if (b.room_id !== room.id && !(b.assigned_room_ids || []).includes(room.id)) {
                              return false;
                            }
                            if (statusFilter !== "all" && b.status !== statusFilter) {
                              return false;
                            }
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              const g = guestMap[b.guest_id];
                              const guestName = (g?.full_name || "").toLowerCase();
                              const resCode = (b.reservation_code || "").toLowerCase();
                              const roomNum = String(room.room_number).toLowerCase();
                              if (!guestName.includes(q) && !resCode.includes(q) && !roomNum.includes(q)) {
                                return false;
                              }
                            }
                            // Must strictly overlap this month
                            if (!b.checkin_date || !b.checkout_date) return false;
                            const checkin = new Date(b.checkin_date);
                            const checkout = new Date(b.checkout_date);
                            const mStart = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
                            const mEnd = new Date(selectedYear, selectedMonth, daysInMonth, 23, 59, 59);

                            return checkin <= mEnd && checkout >= mStart;
                          })
                          .map((b) => {
                            const checkin = new Date(b.checkin_date);
                            const checkout = new Date(b.checkout_date);

                            let startDay = 1;
                            if (checkin.getFullYear() === selectedYear && checkin.getMonth() === selectedMonth) {
                              startDay = checkin.getDate();
                            }

                            let endDay = daysInMonth;
                            if (checkout.getFullYear() === selectedYear && checkout.getMonth() === selectedMonth) {
                              endDay = checkout.getDate();
                            }

                            const spanDays = Math.max(1, endDay - startDay);
                            return {
                              ...b,
                              span: { startDay, endDay, spanDays },
                            };
                          });

                        return (
                          <tr key={room.id} className={styles["room-row"]}>
                            {/* Sticky Room Label */}
                            <td className={`${styles["room-info-cell"]} ${styles["sticky-room-col"]}`}>
                              <div className={styles["room-title-group"]}>
                                <span
                                  className={`${styles["room-status-dot"]} ${
                                    styles[room.status || "available"]
                                  }`}
                                />
                                <div>
                                  <span className={styles["room-number-text"]}>
                                    {room.room_number}
                                  </span>
                                  <span className={styles["room-bed-type"]}>
                                    {room.bed_type || "Standard Bed"}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCellClick(room, monthDays[0])}
                                className={styles["room-more-btn"]}
                              >
                                <MoreVertical size={14} />
                              </button>
                            </td>

                            {/* Calendar Days with Clickable Slots & Spanned Booking Bars */}
                            {monthDays.map((d) => {
                              // Only render booking bar in the exact cell where it starts within this month!
                              const cellBookings = roomBookings.filter((b) => b.span.startDay === d.day);
                              // Check if this room already has an active stay covering this day
                              const activeBookingOnDay = roomBookings.find(
                                (b) => d.day >= b.span.startDay && d.day < b.span.endDay
                              );

                              return (
                                <td
                                  key={d.day}
                                  onClick={() => {
                                    if (activeBookingOnDay) {
                                      const guest = guestMap[activeBookingOnDay.guest_id];
                                      setSelectedBooking({ ...activeBookingOnDay, guest, room });
                                    } else {
                                      handleCellClick(room, d);
                                    }
                                  }}
                                  className={`${styles["day-cell"]} ${
                                    d.isToday ? styles["today-col"] : ""
                                  } ${d.isLocked ? styles["locked-cell"] : ""}`}
                                  title={
                                    d.isLocked
                                      ? `Prior to activation date (${goLiveDate})`
                                      : activeBookingOnDay
                                      ? `Room ${room.room_number} on ${d.dateKey} - Booked (${guestMap[activeBookingOnDay.guest_id]?.full_name || "Resident"})`
                                      : `Room ${room.room_number} on ${d.dateKey} - Available (Click to book)`
                                  }
                                >
                                  {cellBookings.map((b) => {
                                    const spanDays = b.span.spanDays;
                                    const cellWidth = 58;
                                    const widthPx = spanDays * cellWidth - 8;

                                    const guest = guestMap[b.guest_id];
                                    const guestName =
                                      guest?.full_name ||
                                      b.company_name ||
                                      `Guest #${b.guest_id || b.id}`;

                                    const themeClass =
                                      PASTEL_THEMES[b.id % PASTEL_THEMES.length];

                                    return (
                                      <div
                                        key={b.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBooking({ ...b, guest, room });
                                        }}
                                        className={`${styles["booking-bar"]} ${themeClass}`}
                                        style={{
                                          width: `${widthPx}px`,
                                          left: "4px",
                                        }}
                                        title={`${guestName} (${b.reservation_code || "RES"}) - ${spanDays} nights`}
                                      >
                                        <span className={styles["bar-guest-name"]}>
                                          {guestName}
                                        </span>
                                        <span className={styles["bar-stay-pill"]}>
                                          {spanDays}d
                                        </span>
                                      </div>
                                    );
                                  })}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
