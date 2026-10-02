import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  CreditCard,
  Wallet,
  Calendar,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  QrCode,
  Building2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import api from "@api/api";

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Wallet, color: "#166962" },
  { id: "upi", label: "UPI / QR Code", icon: QrCode, color: "#7c3aed" },
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, color: "#2563eb" },
  { id: "bank_transfer", label: "Bank Transfer (NEFT/IMPS)", icon: Building2, color: "#0891b2" },
  { id: "cheque", label: "Cheque", icon: FileText, color: "#d97706" },
  { id: "ota_virtual", label: "OTA Virtual Card", icon: CreditCard, color: "#475569" },
];

const getTodayDateStr = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const getCurrentTimeStr = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export default function CheckInPaymentModal({
  isOpen,
  onClose,
  booking,
  guest,
  room,
  onSuccess,
}) {
  if (!isOpen || !booking) return null;

  const guestName = guest?.full_name || booking.guest?.full_name || "Guest";
  const guestPhone = guest?.phone || booking.guest?.phone || "N/A";
  const roomNumber = room?.room_number || booking.room?.room_number || booking.room_id || "Unassigned";
  const roomType = room?.room_type || booking.room?.room_type || "Deluxe";

  // Check-In and Check-Out timing state
  // Check-in time defaults automatically to CURRENT local time (Now)
  const [checkinDate, setCheckinDate] = useState(getTodayDateStr());
  const [checkinTime, setCheckinTime] = useState(getCurrentTimeStr());
  const [checkoutDate, setCheckoutDate] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("11:00");

  const [collectAmount, setCollectAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(booking.payment_method || "cash");
  const [transactionId, setTransactionId] = useState("");
  const [idType, setIdType] = useState(guest?.id_type || "Aadhaar");
  const [idNumber, setIdNumber] = useState(guest?.id_number || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize and sync when booking changes
  useEffect(() => {
    const todayStr = getTodayDateStr();
    const nowTimeStr = getCurrentTimeStr();

    setCheckinDate(todayStr);
    setCheckinTime(nowTimeStr);

    if (booking?.checkout_date) {
      try {
        const co = new Date(booking.checkout_date);
        setCheckoutDate(co.toISOString().split("T")[0]);
        const coH = String(co.getHours()).padStart(2, "0");
        const coM = String(co.getMinutes()).padStart(2, "0");
        setCheckoutTime(`${coH}:${coM}` !== "00:00" ? `${coH}:${coM}` : "11:00");
      } catch {
        const tomorrow = new Date(Date.now() + 86400000);
        setCheckoutDate(tomorrow.toISOString().split("T")[0]);
        setCheckoutTime("11:00");
      }
    } else {
      const tomorrow = new Date(Date.now() + 86400000);
      setCheckoutDate(tomorrow.toISOString().split("T")[0]);
      setCheckoutTime("11:00");
    }

    setPaymentMethod(booking.payment_method || "cash");
    setIdType(guest?.id_type || "Aadhaar");
    setIdNumber(guest?.id_number || "");
    setTransactionId("");
    setNotes("");
    setErrorMessage("");
  }, [booking, guest]);

  // Sync to current live time
  const handleSyncToCurrentTime = () => {
    setCheckinDate(getTodayDateStr());
    setCheckinTime(getCurrentTimeStr());
  };

  // Dynamic Stay and Financial Metrics Calculation
  const stayMetrics = useMemo(() => {
    let ciDt = new Date();
    try {
      if (checkinDate) {
        ciDt = new Date(`${checkinDate}T${checkinTime || "11:00"}:00`);
      }
    } catch {}

    let coDt = new Date(Date.now() + 86400000);
    try {
      if (checkoutDate) {
        coDt = new Date(`${checkoutDate}T${checkoutTime || "11:00"}:00`);
      }
    } catch {}

    const d1 = new Date(ciDt);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(coDt);
    d2.setHours(0, 0, 0, 0);

    const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    const nights = diffDays;
    const days = nights + 1;
    const stayLabel = `${days} Days / ${nights} Night${nights > 1 ? "s" : ""}`;

    const originalRate = Number(booking.room_rate || 0);
    const roomsCount = Number(booking.rooms_count || 1);
    const origNights = Math.max(1, Number(booking.nights_count || 1));
    const origTotal = Number(booking.total_amount || 0);

    const nightlyRate = originalRate > 0 ? originalRate : (origTotal > 0 ? origTotal / origNights : 2500);
    const roomTariff = nightlyRate * nights * roomsCount;
    const taxAmount = Number(booking.tax || 0);
    const totalAmount = roomTariff + taxAmount;
    const advancePaid = Number(booking.advance_paid || 0);
    const balanceDue = Math.max(0, totalAmount - advancePaid);

    return {
      ciDt,
      coDt,
      nights,
      days,
      stayLabel,
      nightlyRate,
      roomsCount,
      roomTariff,
      totalAmount,
      advancePaid,
      balanceDue,
      taxAmount,
    };
  }, [booking, checkinDate, checkinTime, checkoutDate, checkoutTime]);

  // Keep collection amount updated with calculated balance due
  useEffect(() => {
    setCollectAmount(stayMetrics.balanceDue);
  }, [stayMetrics.balanceDue]);

  const handlePresetAmount = (amt) => {
    setCollectAmount(amt);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const payAmt = Number(collectAmount || 0);
    if (payAmt < 0) {
      setErrorMessage("Collection amount cannot be negative.");
      return;
    }

    try {
      setSubmitting(true);

      const ciIso = new Date(`${checkinDate}T${checkinTime || "11:00"}:00`).toISOString();
      const coIso = new Date(`${checkoutDate}T${checkoutTime || "11:00"}:00`).toISOString();

      const payload = {
        checkin_date: ciIso,
        checkout_date: coIso,
        actual_checkin_time: ciIso,
        collect_payment: payAmt,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim() || undefined,
        primary_id_type: idType,
        primary_id_number: idNumber.trim() || undefined,
        corporate_notes: notes.trim()
          ? `${booking.corporate_notes || ""}\n[Check-In Note (${checkinDate} ${checkinTime})]: ${notes.trim()}`
          : booking.corporate_notes,
      };

      const res = await api.post(`/bookings/${booking.id}/check-in`, payload);

      if (onSuccess) {
        onSuccess(res.data, payAmt, paymentMethod);
      }
      onClose();
    } catch (err) {
      console.error("Check-in payment error:", err);
      const msg = err.response?.data?.detail || err.message || "Failed to process check-in and payment.";
      setErrorMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "16px",
      }}
      onClick={() => !submitting && onClose()}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "700px",
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  letterSpacing: "0.5px",
                }}
              >
                CHECK-IN PAYMENT & TIMING
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b" }}>
                {booking.reservation_code || `#${booking.id}`}
              </span>
            </div>
            <h2 style={{ margin: "4px 0 0 0", fontSize: "19px", fontWeight: 800, color: "#0f172a" }}>
              Check-In Registration & Tariff Collection
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {errorMessage && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#b91c1c",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Guest & Room Summary Banner */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "12px",
              padding: "12px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "#166962",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "16px",
                }}
              >
                {guestName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#0f172a" }}>{guestName}</div>
                <div style={{ fontSize: "12px", color: "#475569" }}>📞 {guestPhone}</div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#166962", textTransform: "uppercase" }}>
                Assigned Room
              </div>
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#166962" }}>
                Room {roomNumber}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  background: "#dcfce7",
                  color: "#15803d",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontWeight: 700,
                }}
              >
                {roomType}
              </span>
            </div>
          </div>

          {/* Check-In & Check-Out Timings Section (Auto live time + manual override for downtime) */}
          <div
            style={{
              background: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              borderRadius: "12px",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 800, color: "#1e293b" }}>
                <Clock size={16} color="#2563eb" />
                <span>CHECK-IN & CHECK-OUT TIMINGS</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {stayMetrics.stayLabel}
                </span>
                <button
                  type="button"
                  onClick={handleSyncToCurrentTime}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#ecfdf5",
                    border: "1px solid #10b981",
                    color: "#047857",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Reset check-in to current clock time right now"
                >
                  <Zap size={12} /> Auto Current Time
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1.2fr 0.8fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "3px" }}>
                  Check-In Date *
                </label>
                <input
                  type="date"
                  value={checkinDate}
                  onChange={(e) => setCheckinDate(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "3px" }}>
                  Check-In Time *
                </label>
                <input
                  type="time"
                  value={checkinTime}
                  onChange={(e) => setCheckinTime(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1.5px solid #2563eb",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "#1d4ed8",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "3px" }}>
                  Checkout Date *
                </label>
                <input
                  type="date"
                  value={checkoutDate}
                  onChange={(e) => setCheckoutDate(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "3px" }}>
                  Checkout Time *
                </label>
                <input
                  type="time"
                  value={checkoutTime}
                  onChange={(e) => setCheckoutTime(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginTop: "8px", fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "5px" }}>
              <span>ℹ️ Check-in time is auto-set to the current live moment. In case of previous software downtime, feel free to select the earlier time.</span>
            </div>
          </div>

          {/* Financial Breakdown (Calculated Automatically according to stay) */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "12px",
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 800, color: "#0f172a" }}>
                <DollarSign size={16} color="#166962" />
                <span>AUTOMATIC BILLING CALCULATION</span>
              </div>
              <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                {stayMetrics.nights} Night(s) × {formatCurrency(stayMetrics.nightlyRate)} / night
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                <span>Room Tariff ({stayMetrics.nights} Nights × Room {roomNumber})</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>
                  {formatCurrency(stayMetrics.roomTariff)}
                </span>
              </div>

              {stayMetrics.taxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                  <span>Taxes / GST</span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    {formatCurrency(stayMetrics.taxAmount)}
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "8px",
                  borderTop: "1px dashed #e2e8f0",
                  fontWeight: 800,
                  fontSize: "14px",
                  color: "#0f172a",
                }}
              >
                <span>Total Stay Tariff</span>
                <span style={{ color: "#166962", fontSize: "15px" }}>{formatCurrency(stayMetrics.totalAmount)}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", color: "#15803d", fontSize: "12.5px" }}>
                <span>Advance Previously Deposited</span>
                <span style={{ fontWeight: 700 }}>- {formatCurrency(stayMetrics.advancePaid)}</span>
              </div>

              {/* Net Balance Due Box */}
              <div
                style={{
                  marginTop: "6px",
                  background: stayMetrics.balanceDue > 0 ? "#fff7ed" : "#f0fdf4",
                  border: `1.5px solid ${stayMetrics.balanceDue > 0 ? "#fdba74" : "#86efac"}`,
                  borderRadius: "10px",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: stayMetrics.balanceDue > 0 ? "#9a3412" : "#166534" }}>
                    NET BALANCE DUE TO COLLECT AT CHECK-IN
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    {stayMetrics.balanceDue > 0 ? "Collect from guest now at reception" : "Fully settled in advance"}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 900,
                    color: stayMetrics.balanceDue > 0 ? "#ea580c" : "#16a34a",
                  }}
                >
                  {formatCurrency(stayMetrics.balanceDue)}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Collection Inputs */}
          <div
            style={{
              background: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              borderRadius: "12px",
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                Amount Collecting at Check-In (₹) *
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => handlePresetAmount(stayMetrics.balanceDue)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid #10b981",
                    background: "#ecfdf5",
                    color: "#047857",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Full ({formatCurrency(stayMetrics.balanceDue)})
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetAmount(0)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Pay at Checkout (₹0)
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#166962",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1.5px solid #059669",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    fontWeight: 700,
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transaction Ref & Notes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Payment Reference / UTR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / Card Auth / Cheque #"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    fontSize: "12.5px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Check-In Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional front desk note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    fontSize: "12.5px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick ID Proof Verification Strip */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#475569", fontSize: "12px", fontWeight: 700, minWidth: "120px" }}>
              <ShieldCheck size={16} color="#059669" />
              <span>Guest Identity</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px", flex: 1 }}>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                disabled={submitting}
                style={{
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="Aadhaar">Aadhaar Card</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
                <option value="Voter ID">Voter ID</option>
                <option value="Other">Other Official ID</option>
              </select>

              <input
                type="text"
                placeholder="ID Number (Optional / On File)"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                disabled={submitting}
                style={{
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "10px",
              paddingTop: "14px",
              borderTop: "1px solid #e2e8f0",
              marginTop: "4px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: submitting ? "#94a3b8" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "13.5px",
                cursor: submitting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.3)",
              }}
            >
              <CheckCircle size={16} />
              <span>
                {submitting
                  ? "Processing Check-In..."
                  : Number(collectAmount) > 0
                  ? `Confirm Payment (${formatCurrency(collectAmount)}) & Check-In`
                  : "Confirm Check-In (Pay at Checkout)"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
