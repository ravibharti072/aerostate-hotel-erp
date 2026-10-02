import React from "react";
import styles from "../frontDeskCalendar.module.css";

export default function ReservationChannelsCard({ reservationBreakdown }) {
  return (
    <div className={styles["operations-card"]} style={{ width: "100%" }}>
      <div className={styles["card-header-between"]}>
        <div>
          <h3 className={styles["card-title-main"]}>Reservations Breakdown</h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Property booking statuses & operational portfolio
          </span>
        </div>
        <span className={styles["card-badge-muted"]}>
          {reservationBreakdown.total} Total
        </span>
      </div>

      {/* Donut & Status Hero Section */}
      <div className={styles["donut-top-section"]}>
        {/* SVG Donut Chart */}
        <div className={styles["donut-chart-box"]}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            {/* Background track circle */}
            <circle
              cx="70"
              cy="70"
              r={50}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="16"
            />

            {/* Slices rotated from 12 o'clock (-90deg) */}
            <g transform="rotate(-90 70 70)">
              {(() => {
                const r = 50;
                const c = 2 * Math.PI * r;
                let accumulatedOffset = 0;
                const total = reservationBreakdown.total || 1;

                return reservationBreakdown.statusSlices.map((slice) => {
                  if (slice.count <= 0) return null;
                  const strokeLen = (slice.count / total) * c;
                  const currentOffset = accumulatedOffset;
                  accumulatedOffset += strokeLen;

                  return (
                    <circle
                      key={slice.key}
                      cx="70"
                      cy="70"
                      r={r}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="16"
                      strokeDasharray={`${strokeLen} ${c - strokeLen}`}
                      strokeDashoffset={-currentOffset}
                      strokeLinecap="butt"
                      style={{
                        transition: "stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease",
                      }}
                    />
                  );
                });
              })()}
            </g>
          </svg>

          <div className={styles["donut-center-text"]}>
            <span className={styles["donut-center-num"]}>
              {reservationBreakdown.total}
            </span>
            <span className={styles["donut-center-label"]}>TOTAL RES</span>
          </div>
        </div>

        {/* Status Legend Grid with Micro Progress Bars */}
        <div className={styles["donut-legend-grid"]}>
          {reservationBreakdown.statusSlices.map((slice) => {
            const total = reservationBreakdown.total || 1;
            const pct = Math.round((slice.count / total) * 100);

            return (
              <div key={slice.key} className={styles["status-legend-item"]}>
                <div className={styles["status-legend-header"]}>
                  <div className={styles["status-legend-title"]}>
                    <span
                      className={styles["status-legend-dot"]}
                      style={{ backgroundColor: slice.color }}
                    />
                    <span>{slice.label}</span>
                  </div>
                  <div className={styles["status-legend-metrics"]}>
                    <span className={styles["status-legend-count"]}>{slice.count}</span>
                    <span className={styles["status-legend-pct"]}>{pct}%</span>
                  </div>
                </div>
                <div className={styles["status-progress-track"]}>
                  <div
                    className={styles["status-progress-fill"]}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle Section: Booking Channels & Sources */}
      <div className={styles["breakdown-subcard"]}>
        <div className={styles["breakdown-subcard-header"]}>
          <span className={styles["breakdown-subtitle"]}>Booking Channels & Source</span>
          <span className={styles["breakdown-submeta"]}>Distribution</span>
        </div>

        {/* Stacked Horizontal Progress Bar */}
        <div className={styles["source-stacked-bar"]}>
          {reservationBreakdown.sources.map((src) => {
            const total = reservationBreakdown.total || 1;
            const pct = (src.count / total) * 100;
            if (src.count <= 0) return null;
            return (
              <div
                key={src.key}
                className={styles["source-bar-segment"]}
                style={{
                  width: `${pct}%`,
                  backgroundColor: src.color,
                }}
                title={`${src.label}: ${src.count} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Source Chips */}
        <div className={styles["source-chips-row"]}>
          {reservationBreakdown.sources.map((src) => {
            const total = reservationBreakdown.total || 1;
            const pct = Math.round((src.count / total) * 100);
            return (
              <div key={src.key} className={styles["source-chip"]}>
                <span
                  className={styles["source-chip-dot"]}
                  style={{ backgroundColor: src.color }}
                />
                <span className={styles["source-chip-label"]}>{src.label}</span>
                <span className={styles["source-chip-value"]}>
                  {src.count} <span className={styles["source-chip-pct"]}>({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
