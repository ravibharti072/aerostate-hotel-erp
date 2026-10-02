import React from "react";
import { ModuleWriternHeader } from "@components";
import styles from "../frontDeskCalendar.module.css";

export default function LiveRoomStatusGrid({
  statusCounts,
  roomStatusFilter,
  setRoomStatusFilter,
  filteredStatusRooms,
  handleCellClick,
  monthDays,
}) {
  return (
    <section className={styles["room-status-section"]}>
      <ModuleWriternHeader
        title="Live Room Status"
        description="Real-time occupancy, cleanliness, and readiness of all property rooms"
        badgeCount={filteredStatusRooms.length}
        badgeLabel="rooms"
      />

      {/* Status Filter Chips / Legend Bar */}
      <div className={styles["room-status-filter-strip"]}>
        {[
          { key: "all", label: "All Rooms", count: statusCounts.all, dotColor: null },
          { key: "available", label: "Available", count: statusCounts.available, dotColor: "#10b981" },
          { key: "occupied", label: "Occupied", count: statusCounts.occupied, dotColor: "#ef4444" },
          { key: "reserved", label: "Reserved", count: statusCounts.reserved, dotColor: "#3b82f6" },
          { key: "cleaning", label: "Cleaning / Dirty", count: statusCounts.cleaning, dotColor: "#f59e0b" },
          { key: "maintenance", label: "Maintenance", count: statusCounts.maintenance, dotColor: "#8b5cf6" },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setRoomStatusFilter(chip.key)}
            className={`${styles["status-chip"]} ${
              roomStatusFilter === chip.key ? styles["active"] : ""
            }`}
          >
            {chip.dotColor && (
              <span
                className={styles["status-chip-dot"]}
                style={{ backgroundColor: chip.dotColor }}
              />
            )}
            <span>{chip.label}</span>
            <span style={{ opacity: 0.75, fontSize: "11px" }}>({chip.count})</span>
          </button>
        ))}
      </div>

      {/* Compact Rooms Grid (Continuous, No Floor Grouping, Clean Uniform Tiles) */}
      <div className={styles["compact-rooms-grid"]}>
        {filteredStatusRooms.map((room) => {
          const status = String(room.status || "available").toLowerCase();
          const borderClass = styles[`tile-border-${status}`] || styles["tile-border-available"];
          const dotClass = styles[`status-dot-${status}`] || styles["status-dot-available"];
          const textClass = styles[`status-text-${status}`] || styles["status-text-available"];

          return (
            <div
              key={room.id}
              onClick={() => handleCellClick(room, monthDays[0] || { day: 1, dateKey: "" })}
              className={`${styles["compact-room-tile"]} ${borderClass}`}
              title={`Room ${room.room_number} (${room.room_type || "Deluxe"}) • ${status} • Click to reserve`}
            >
              <div className={styles["tile-top-row"]}>
                <span className={styles["tile-room-num"]}>
                  {room.room_number}
                </span>
                <span className={styles["tile-room-type"]}>
                  {room.room_type || "Deluxe"}
                </span>
              </div>

              <div className={styles["tile-bottom-row"]}>
                <span className={`${styles["tile-status-tag"]} ${textClass}`}>
                  <span className={`${styles["status-chip-dot"]} ${dotClass}`} />
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
