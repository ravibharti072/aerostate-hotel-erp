import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getDefaultRouteForUser, getUserRoleLevel } from "../../config/rbacConfig";

export default function AccessDeniedView({ attemptedPath = "" }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const defaultRoute = getDefaultRouteForUser(user);
  const roleLevel = getUserRoleLevel(user);
  const roleLabel =
    roleLevel === "hotel_admin"
      ? "Hotel Administrator"
      : roleLevel === "department_head"
      ? "Department Head (HOD)"
      : "Employee / Technician";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        padding: "32px 16px",
        textAlign: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "20px",
          backgroundColor: "#fef2f2",
          color: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
          boxShadow: "0 10px 15px -3px rgba(239, 68, 68, 0.1)",
        }}
      >
        <ShieldAlert size={36} />
      </div>

      <span
        style={{
          fontSize: "12px",
          fontWeight: "800",
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: "#991b1b",
          backgroundColor: "#fee2e2",
          padding: "4px 12px",
          borderRadius: "999px",
          marginBottom: "12px",
        }}
      >
        Permission Restricted
      </span>

      <h1
        style={{
          fontSize: "28px",
          fontWeight: "800",
          color: "#0f172a",
          margin: "0 0 8px 0",
          letterSpacing: "-0.5px",
        }}
      >
        Access Denied
      </h1>

      <p
        style={{
          fontSize: "14px",
          color: "#64748b",
          maxWidth: "460px",
          margin: "0 0 24px 0",
          lineHeight: "1.6",
        }}
      >
        Your current account does not have permission to access{" "}
        <code
          style={{
            backgroundColor: "#f1f5f9",
            padding: "2px 6px",
            borderRadius: "4px",
            color: "#0f172a",
            fontWeight: "600",
          }}
        >
          {attemptedPath || "this section"}
        </code>
        . Please use your department workspace or contact your hotel administrator.
      </p>

      <div
        style={{
          backgroundColor: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "12px 20px",
          marginBottom: "28px",
          display: "inline-flex",
          gap: "16px",
          fontSize: "13px",
        }}
      >
        <div>
          <span style={{ color: "#64748b", fontWeight: "500" }}>Account: </span>
          <strong style={{ color: "#0f172a" }}>{user?.username}</strong>
        </div>
        <div style={{ color: "#cbd5e1" }}>|</div>
        <div>
          <span style={{ color: "#64748b", fontWeight: "500" }}>Department: </span>
          <strong style={{ color: "#0f172a" }}>{user?.department || "Unassigned"}</strong>
        </div>
        <div style={{ color: "#cbd5e1" }}>|</div>
        <div>
          <span style={{ color: "#64748b", fontWeight: "500" }}>Role: </span>
          <strong style={{ color: "#2563eb" }}>{roleLabel}</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "10px 18px",
            backgroundColor: "#ffffff",
            color: "#475569",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ArrowLeft size={16} /> Go Back
        </button>

        <button
          onClick={() => navigate(defaultRoute)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
          }}
        >
          <Home size={16} /> Open My Workspace
        </button>
      </div>
    </div>
  );
}
