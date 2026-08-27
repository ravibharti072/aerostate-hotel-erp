import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import {
  Fingerprint,
  CalendarDays,
  RefreshCw,
  Cpu,
  Clock,
  User,
  HardDrive,
  Users,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard";
import ModuleWriternHeader from "../../../components/ModuleWriternHeader";
import "./biometricLogs.css";

export default function BiometricLogsPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const todayDate = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(todayDate);
  const [punchTypeFilter, setPunchTypeFilter] = useState("all");
  const [message, setMessage] = useState("");

  // Custom confirmation modal state (replaces browser confirm)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "" });

  const fetchLogs = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/biometric/logs?date=${dateFilter}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching biometric logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [dateFilter, token]);

  const handleProcessAttendanceClick = () => {
    setConfirmModal({
      isOpen: true,
      title: "Run Attendance Engine",
      message: `Process attendance for ${dateFilter}? This calculates shift hours and updates the main sheets.`
    });
  };

  const executeProcessAttendance = async () => {
    setConfirmModal({ isOpen: false, title: "", message: "" });
    setIsProcessing(true);
    setMessage("");
    
    try {
      const response = await fetch(`http://localhost:8000/attendance-engine/process-daily?target_date_str=${dateFilter}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setMessage(`Success: ${result.message}`);
        setTimeout(() => setMessage(""), 5000);
      } else {
        setMessage(result.detail || "Failed to process attendance.");
      }
    } catch (error) {
      setMessage("Network error occurred while processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (datetimeStr) => {
    if (!datetimeStr) return "--:--";
    const d = new Date(datetimeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const filteredLogs = logs.filter(log => {
    if (punchTypeFilter === "all") return true;
    return log.punch_type === punchTypeFilter;
  });

  const logStats = useMemo(() => {
    const uniqueStaff = new Set(logs.map(log => log.staff_id)).size;
    return {
      totalPunches: logs.length,
      uniqueStaff: uniqueStaff,
      autoPunches: logs.filter(l => l.punch_type === 'auto').length,
      manualPunches: logs.filter(l => l.punch_type !== 'auto').length,
    };
  }, [logs]);

  return (
    <div className="bio-page">
      <PortalHeader 
        title="Biometric Logs"
        kicker="ATTENDANCE ENGINE"
        description="View raw hardware punches and process them into daily attendance records."
        icon={Fingerprint}
        backPath="/staff"
        rightAction={
          <button 
            className="bio-add-btn" 
            onClick={handleProcessAttendanceClick}
            disabled={isProcessing}
            style={{ backgroundColor: '#4f46e5' }}
          >
            {isProcessing ? <RefreshCw size={18} className="spin" /> : <Cpu size={18} />}
            {isProcessing ? "Processing Engine..." : "Run Attendance Engine"}
          </button>
        }
      />

      {message && (
        <div className={`bio-processing-alert ${message.includes('Success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* --- STATS GRID --- */}
      <div className="bio-stats-grid">
        <StatCard title="Total Punches" value={logStats.totalPunches} Icon={Fingerprint} colorTheme="blue" />
        <StatCard title="Unique Staff Present" value={logStats.uniqueStaff} Icon={Users} colorTheme="green" />
        <StatCard title="Auto Scans" value={logStats.autoPunches} Icon={CheckCircle2} colorTheme="purple" />
        <StatCard title="Manual Overrides" value={logStats.manualPunches} Icon={AlertCircle} colorTheme="orange" />
      </div>

      {/* --- MODULE SECTION --- */}
      <section className="bio-modules-section">
        <ModuleWriternHeader 
          title="Raw Device Data"
          description="Chronological log of all card, fingerprint, and facial recognitions."
          badgeCount={filteredLogs.length}
          badgeLabel="punches"
        />

        {/* TOOLBAR */}
        <div className="bio-controls">
          <div className="bio-filter-group">
            <CalendarDays size={18} className="filter-icon text-gray" />
            <input 
              type="date" 
              className="bio-date-picker"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          
          <select className="bio-filter-select" value={punchTypeFilter} onChange={(e) => setPunchTypeFilter(e.target.value)}>
            <option value="all">All Punch Types</option>
            <option value="auto">Auto (Device)</option>
            <option value="in">Check-In</option>
            <option value="out">Check-Out</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="bio-table-container">
          <table className="bio-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Employee Details</th>
                <th>Punch Time</th>
                <th>Punch Type</th>
                <th>Source Device</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="5" className="empty-state">Loading biometric data...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="5" className="empty-state">No biometric logs found for this date.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td><span className="log-id">#{log.id}</span></td>
                    <td>
                      <div className="bio-name-cell">
                        <div className="bio-avatar">
                          <User size={18} />
                        </div>
                        <div>
                          <strong>EMP-{log.staff_id.toString().padStart(4, '0')}</strong>
                          <div className="contact-item" style={{ marginTop: '4px' }}>
                            Internal ID: {log.staff_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="info-row">
                        <Clock size={14} className="info-icon" />
                        <span className="info-value">{formatTime(log.punch_time)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="punch-badge">
                        {log.punch_type || 'auto'}
                      </span>
                    </td>
                    <td>
                      <div className="info-row">
                        <HardDrive size={14} className="info-icon" />
                        <span className="info-label">{log.device_id || 'UNKNOWN-DEVICE'}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- CUSTOM IN-APP CONFIRMATION MODAL --- */}
      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="confirm-modal-content">
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <h2>{confirmModal.title}</h2>
              <button className="modal-close" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body confirm-modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', backgroundColor: 'transparent' }}>
              <button className="btn-cancel" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancel</button>
              <button className="btn-submit" onClick={executeProcessAttendance}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}