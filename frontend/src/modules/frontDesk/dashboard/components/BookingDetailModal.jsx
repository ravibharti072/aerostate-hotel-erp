import React from "react";
import { X, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "../frontDeskCalendar.module.css";

export default function BookingDetailModal({
  selectedBooking,
  setSelectedBooking,
  actionLoading,
  handleCheckIn,
  handleCheckOut,
  handleNoShow,
}) {
  const navigate = useNavigate();
  if (!selectedBooking) return null;

  return (
    <div className={styles["modal-overlay"]} onClick={() => setSelectedBooking(null)}>
      <div
        className={styles["modal-content-card"]}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles["modal-header"]}>
          <div>
            <h3 className={styles["modal-title"]}>
              Reservation {selectedBooking.reservation_code || `#${selectedBooking.id}`}
            </h3>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color:
                  selectedBooking.status === "checked-in"
                    ? "#15803d"
                    : selectedBooking.status === "confirmed"
                    ? "#1d4ed8"
                    : selectedBooking.status === "no-show"
                    ? "#dc2626"
                    : "#64748b",
                textTransform: "uppercase",
              }}
            >
              Status: {selectedBooking.status}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBooking(null)}
            className={styles["modal-close-btn"]}
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles["modal-body"]}>
          <div className={styles["detail-row"]}>
            <label>Guest Name</label>
            <strong>{selectedBooking.guest?.full_name || "Walk-in Guest"}</strong>
          </div>

          <div className={styles["detail-row"]}>
            <label>Contact Phone</label>
            <span>{selectedBooking.guest?.phone || "N/A"}</span>
          </div>

          <div className={styles["detail-row"]}>
            <label>Room Number</label>
            <strong>
              {selectedBooking.room?.room_number || selectedBooking.room_id} (
              {selectedBooking.room?.room_type || "Deluxe"})
            </strong>
          </div>

          <div className={styles["detail-row"]}>
            <label>Check-in Date</label>
            <span>
              {selectedBooking.checkin_date
                ? new Date(selectedBooking.checkin_date).toLocaleString()
                : "N/A"}
            </span>
          </div>

          <div className={styles["detail-row"]}>
            <label>Check-out Date</label>
            <span>
              {selectedBooking.checkout_date
                ? new Date(selectedBooking.checkout_date).toLocaleString()
                : "N/A"}
            </span>
          </div>

          <div className={styles["detail-row"]}>
            <label>Total Folio Amount</label>
            <strong>₹{Number(selectedBooking.total_amount || 0).toLocaleString("en-IN")}</strong>
          </div>

          <div className={styles["detail-row"]}>
            <label>Advance Collected</label>
            <span style={{ color: "#15803d", fontWeight: 700 }}>
              ₹{Number(selectedBooking.advance_paid || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className={styles["modal-footer"]}>
          <button
            type="button"
            onClick={() => setSelectedBooking(null)}
            className={styles["btn-secondary"]}
          >
            Close
          </button>

          {selectedBooking.status === "confirmed" && (
            <>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleCheckIn(selectedBooking.id)}
                className={styles["btn-primary"]}
                style={{
                  background: "#10b981",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 800,
                }}
              >
                <Wallet size={15} />
                <span>Check In & Collect Payment</span>
              </button>
              {handleNoShow && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleNoShow(selectedBooking.id)}
                  className={styles["btn-primary"]}
                  style={{ background: "#dc2626" }}
                  title="Guest did not arrive. Mark as No-Show and release room."
                >
                  {actionLoading ? "Processing..." : "Mark No-Show"}
                </button>
              )}
            </>
          )}

          {selectedBooking.status === "checked-in" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleCheckOut(selectedBooking.id)}
              className={styles["btn-primary"]}
              style={{ background: "#f59e0b" }}
            >
              {actionLoading ? "Processing..." : "Check Out Guest"}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate("/check-in-out")}
            className={styles["btn-primary"]}
          >
            Full Front Desk
          </button>
        </div>
      </div>
    </div>
  );
}
