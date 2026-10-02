import React from "react";
import { CreditCard, DollarSign, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "../frontDeskCalendar.module.css";

export default function FrontDeskFinancialSummary({
  reservationBreakdown,
  activeBookings,
}) {
  const navigate = useNavigate();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  // Today's departures pending balance
  const todayDepartures = activeBookings.filter((b) => {
    const isToday = String(b.checkout_date || "").substring(0, 10) === todayStr;
    const s = String(b.status || "").toLowerCase();
    return isToday && s !== "cancelled" && s !== "canceled";
  });

  const todayCheckoutPending = todayDepartures.reduce((sum, b) => {
    const total = Number(b.total_amount) || Number(b.room_rate) || 0;
    const paid = Number(b.advance_paid) || 0;
    return sum + Math.max(0, total - paid);
  }, 0);

  const { totalAmount, advancePaid, pendingBalance } = reservationBreakdown.financials;

  return (
    <div className={styles["operations-card"]} style={{ flex: 1 }}>
      <div className={styles["card-header-between"]}>
        <div>
          <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CreditCard size={16} color="#059669" />
            Front Desk Shift Financials
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Real-time folio balances, cashier collections & stay billing
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/payments")}
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
          Open Cashier
          <ArrowUpRight size={12} />
        </button>
      </div>

      {/* Financial 4-Grid Micro Tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Total Folio Portfolio
          </span>
          <strong style={{ fontSize: "16px", color: "#0f172a" }}>
            ₹{totalAmount.toLocaleString("en-IN")}
          </strong>
          <span style={{ fontSize: "10px", color: "#94a3b8" }}>Gross revenue committed</span>
        </div>

        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>
            Collected to Date
          </span>
          <strong style={{ fontSize: "16px", color: "#065f46" }}>
            ₹{advancePaid.toLocaleString("en-IN")}
          </strong>
          <span style={{ fontSize: "10px", color: "#059669" }}>
            {totalAmount > 0 ? `${Math.round((advancePaid / totalAmount) * 100)}% secured` : "0%"}
          </span>
        </div>

        <div
          style={{
            background: pendingBalance > 0 ? "#fffbeb" : "#f8fafc",
            border: pendingBalance > 0 ? "1px solid #fde68a" : "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: pendingBalance > 0 ? "#b45309" : "#64748b",
              textTransform: "uppercase",
            }}
          >
            Pending Folio Balance
          </span>
          <strong style={{ fontSize: "16px", color: pendingBalance > 0 ? "#b45309" : "#0f172a" }}>
            ₹{pendingBalance.toLocaleString("en-IN")}
          </strong>
          <span style={{ fontSize: "10px", color: "#94a3b8" }}>Due from active stays</span>
        </div>

        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>
            Today's Due on Departure
          </span>
          <strong style={{ fontSize: "16px", color: "#1e40af" }}>
            ₹{todayCheckoutPending.toLocaleString("en-IN")}
          </strong>
          <span style={{ fontSize: "10px", color: "#3b82f6" }}>
            {todayDepartures.length} departures scheduled
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: "12px",
          padding: "10px 14px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "12px", color: "#475569" }}>
          Need to settle guest ledger or produce invoices?
        </span>
        <button
          type="button"
          onClick={() => navigate("/invoices")}
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#2563eb",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Manage Invoices →
        </button>
      </div>
    </div>
  );
}
