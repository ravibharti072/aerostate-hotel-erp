import React from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Megaphone, CalendarDays } from "lucide-react";
import PortalHeader from "../../components/PortalHeader";
import "./alerts.css";

export default function AlertDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Retrieve the alert data passed from the list page
  const alertData = location.state?.alert;

  // If someone tries to access this URL directly without clicking a list item, send them back
  if (!alertData) {
    return <Navigate to="/alerts" />;
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
  };

  const getAlertIconColor = (type) => {
    switch(type) {
      case 'critical': return '#ef4444';
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      default: return '#db2777';
    }
  };

  return (
    <div className="alerts-module-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Alert Details"
        kicker="SYSTEM MODULE"
        description="View full information and metadata for this system announcement."
        icon={Megaphone}
        backPath="/alerts"
      />

      <div className="alert-detail-container">
        <div className="alert-detail-card">
          <div className="alert-detail-header">
            <div 
              className="alert-detail-icon" 
              style={{ color: getAlertIconColor(alertData.alert_type) }}
            >
              <Megaphone size={32} />
            </div>
            <div className="alert-detail-title-area">
              <h1>{alertData.title}</h1>
              <div className="alert-detail-meta">
                <CalendarDays size={16} />
                <span>Published on {formatDate(alertData.created_at)}</span>
              </div>
            </div>
          </div>
          
          <div className="alert-detail-body">
            {alertData.message}
          </div>
        </div>
      </div>
    </div>
  );
}