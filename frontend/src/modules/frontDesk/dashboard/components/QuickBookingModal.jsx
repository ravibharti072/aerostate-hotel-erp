import React, { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import styles from "../frontDeskCalendar.module.css";

export default function QuickBookingModal({
  isOpen,
  onClose,
  rooms,
  quickBookingData,
  setQuickBookingData,
  handleCreateQuickBooking,
  actionLoading,
}) {
  const { user } = useAuth();
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const fetchAvailable = async () => {
      if (!isOpen || !quickBookingData.checkin_date || !quickBookingData.checkout_date) return;
      try {
        setLoadingRooms(true);
        const ci = new Date(quickBookingData.checkin_date);
        const co = new Date(quickBookingData.checkout_date);
        if (isNaN(ci.getTime()) || isNaN(co.getTime()) || co <= ci) {
          if (!isCancelled) setAvailableRooms([]);
          return;
        }

        const params = {
          checkin_date: ci.toISOString(),
          checkout_date: co.toISOString(),
        };
        const hotelId = user?.hotel_id || user?.hotel?.id || user?.hotelId || 1;
        if (hotelId) params.hotel_id = hotelId;

        const res = await api.get("/bookings/available-rooms", { params });
        const list = Array.isArray(res.data) ? res.data : (res.data?.rooms || []);
        if (!isCancelled) {
          setAvailableRooms(list);
          setHasQueried(true);

          // If current room_id is NOT available for these dates, auto-switch to first available room
          if (list.length > 0 && !list.some((r) => Number(r.id) === Number(quickBookingData.room_id))) {
            const firstAvail = list[0];
            setQuickBookingData((prev) => ({
              ...prev,
              room_id: firstAvail.id,
              room_rate: firstAvail.base_price || prev.room_rate,
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch available rooms for quick booking:", err);
      } finally {
        if (!isCancelled) setLoadingRooms(false);
      }
    };

    fetchAvailable();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, quickBookingData.checkin_date, quickBookingData.checkout_date, user]);

  if (!isOpen) return null;

  const unavailableRooms = rooms.filter(
    (r) => !availableRooms.some((ar) => Number(ar.id) === Number(r.id))
  );

  return (
    <div className={styles["modal-overlay"]} onClick={onClose}>
      <div
        className={styles["modal-content-card"]}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles["modal-header"]}>
          <h3 className={styles["modal-title"]}>Quick New Booking</h3>
          <button
            type="button"
            onClick={onClose}
            className={styles["modal-close-btn"]}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreateQuickBooking}>
          <div className={styles["modal-body"]}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                Guest Full Name *
              </label>
              <input
                type="text"
                required
                value={quickBookingData.full_name}
                onChange={(e) =>
                  setQuickBookingData({ ...quickBookingData, full_name: e.target.value })
                }
                placeholder="e.g. John Doe"
                style={{
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  outline: "none",
                  fontSize: "13px",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={quickBookingData.phone}
                onChange={(e) =>
                  setQuickBookingData({ ...quickBookingData, phone: e.target.value })
                }
                placeholder="e.g. 9876543210"
                style={{
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  outline: "none",
                  fontSize: "13px",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Select Room *
                  </label>
                  {loadingRooms ? (
                    <span style={{ fontSize: "10.5px", color: "#64748b" }}>Checking...</span>
                  ) : hasQueried && (
                    <span style={{ fontSize: "10.5px", color: availableRooms.length > 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {availableRooms.length} ready
                    </span>
                  )}
                </div>
                <select
                  value={quickBookingData.room_id}
                  onChange={(e) => {
                    const newId = e.target.value;
                    const r = rooms.find((x) => Number(x.id) === Number(newId));
                    setQuickBookingData({
                      ...quickBookingData,
                      room_id: newId,
                      room_rate: r?.base_price || quickBookingData.room_rate,
                    });
                  }}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    outline: "none",
                    fontSize: "13px",
                  }}
                  required
                >
                  {hasQueried && availableRooms.length > 0 ? (
                    <>
                      <optgroup label="Available Rooms (Ready to Book)">
                        {availableRooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            Room {r.room_number} ({r.room_type || "Standard"})
                          </option>
                        ))}
                      </optgroup>
                      {unavailableRooms.length > 0 && (
                        <optgroup label="Occupied / Unavailable for Selected Dates">
                          {unavailableRooms.map((r) => (
                            <option key={r.id} value={r.id} disabled style={{ color: "#94a3b8", background: "#f8fafc" }}>
                              Room {r.room_number} ({r.room_type || "Standard"}) - [Occupied / Booked]
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.room_type})
                      </option>
                    ))
                  )}
                </select>

                {hasQueried && availableRooms.length === 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#dc2626", fontSize: "11px", marginTop: "2px" }}>
                    <AlertCircle size={13} />
                    <span>No rooms available for these dates</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  Room Rate (₹)
                </label>
                <input
                  type="number"
                  value={quickBookingData.room_rate}
                  onChange={(e) =>
                    setQuickBookingData({
                      ...quickBookingData,
                      room_rate: Number(e.target.value),
                    })
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    outline: "none",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  Check-in Date
                </label>
                <input
                  type="datetime-local"
                  required
                  value={quickBookingData.checkin_date}
                  onChange={(e) =>
                    setQuickBookingData({
                      ...quickBookingData,
                      checkin_date: e.target.value,
                    })
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    outline: "none",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  Check-out Date
                </label>
                <input
                  type="datetime-local"
                  required
                  value={quickBookingData.checkout_date}
                  onChange={(e) =>
                    setQuickBookingData({
                      ...quickBookingData,
                      checkout_date: e.target.value,
                    })
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    outline: "none",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles["modal-footer"]}>
            <button
              type="button"
              onClick={onClose}
              className={styles["btn-secondary"]}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className={styles["btn-primary"]}
              style={{ background: "#10b981" }}
            >
              {actionLoading ? "Creating..." : "Confirm Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
