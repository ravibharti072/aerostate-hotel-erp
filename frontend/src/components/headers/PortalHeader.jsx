import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";
import "./portalHeader.css";

export default function PortalHeader({
  title,
  kicker,
  description,
  icon: Icon,
  backPath,
  showBack = true,
  rightAction,
  isDashboard = false,
  showDateTime = false,
}) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const shouldShowDateTime = isDashboard || showDateTime;

  useEffect(() => {
    if (!shouldShowDateTime) return;
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [shouldShowDateTime]);

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  const formattedDate = currentDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formattedTime = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <header className="portal-header-card">
      <div className="portal-header-left">
        {showBack && (
          <button type="button" className="portal-back-btn" onClick={handleBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        )}

        {Icon && (
          <div className="portal-header-icon-box">
            <Icon size={28} />
          </div>
        )}

        <div className="portal-header-text">
          {kicker && <span className="portal-kicker">{kicker}</span>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>

      {(shouldShowDateTime || rightAction) && (
        <div className="portal-header-right">
          {rightAction}

          {shouldShowDateTime && (
            <div className="portal-header-time-widget">
              <div className="portal-time-icon-box">
                <Clock size={16} />
              </div>
              <div className="portal-time-text">
                <span className="portal-time-date">{formattedDate}</span>
                <span className="portal-time-clock">{formattedTime}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}