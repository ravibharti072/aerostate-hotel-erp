import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Clock, ArrowRight } from "lucide-react";
import api from "../../api/api";
import PortalHeader from "../../components/PortalHeader";
import "./alerts.css";

export default function AlertsListPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // UPDATED: Now fetching ALL historical alerts from the new endpoint
        const res = await api.get("/announcements/");
        setAlerts(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "Recently";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric"
    });
  };

  const getAlertStyle = (type) => {
    switch(type) {
      case 'critical': return 'critical-alert';
      case 'success': return 'success-alert';
      case 'warning': return 'warning-alert';
      default: return 'info-alert';
    }
  };

  return (
    <div className="alerts-module-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Updates & Alerts"
        kicker="SYSTEM MODULE"
        description="View all system announcements and historical updates."
        icon={Megaphone}
        backPath="/dashboard"
      />

      <div className="alerts-content-area">
        <h2 className="alerts-section-title">All Announcements History</h2>
        
        {isLoading ? (
          <p className="alerts-empty-text">Loading updates...</p>
        ) : alerts.length === 0 ? (
          <p className="alerts-empty-text">No alerts or updates have been published yet.</p>
        ) : (
          <div className="alerts-list">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={`alert-list-card ${getAlertStyle(alert.alert_type)}`}
                onClick={() => navigate('/alerts/details', { state: { alert } })}
              >
                <div className="alert-card-main">
                  <div className="alert-card-type-indicator"></div>
                  <div className="alert-card-info">
                    <h3>{alert.title}</h3>
                    <div className="alert-card-meta">
                      <Clock size={14} />
                      <span>{formatDate(alert.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="alert-card-action">
                  <span>View Details</span>
                  <ArrowRight size={18} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}