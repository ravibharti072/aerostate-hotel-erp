import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wrench } from "lucide-react";

export default function HousekeepingMaintenancePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      flexGrow: 1,
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "24px",
      backgroundColor: "#f4f7fa",
      minHeight: "100vh",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#0f172a"
    }}>
      
      {/* Modern Header Card */}
      <header style={{
        background: "#ffffff",
        borderRadius: "16px",
        padding: "24px 32px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
        border: "1px solid #eef2f6",
        display: "flex",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          
          <button 
            onClick={() => navigate("/housekeeping")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#eff6ff",
              color: "#3b82f6",
              border: "none",
              padding: "10px 16px",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "56px",
              height: "56px",
              background: "#eff6ff",
              color: "#3b82f6",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <Wrench size={24} />
            </div>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#3b82f6", letterSpacing: "0.5px", textTransform: "uppercase" }}>Housekeeping</span>
              <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>Raise Maintenance Request</h1>
              <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>Report AC, plumbing, electrical, lock, or furniture issues.</p>
            </div>
          </div>

        </div>
      </header>

      {/* Placeholder Body */}
      <div style={{ padding: "40px", textAlign: "center", background: "#fff", borderRadius: "16px", border: "1px solid #eef2f6" }}>
        <h2 style={{ color: "#0f172a" }}>Maintenance Module Coming Soon</h2>
        <p style={{ color: "#64748b" }}>This page will be designed next.</p>
      </div>

    </div>
  );
}