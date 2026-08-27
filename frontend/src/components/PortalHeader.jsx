import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./portalHeader.css";

export default function PortalHeader({ 
  title, 
  kicker, 
  description, 
  icon: Icon, 
  backPath, 
  showBack = true, 
  rightAction 
}) {
  const navigate = useNavigate();

  return (
    <header className="rm-header-card">
      <div className="rm-header-left">
        {showBack && backPath && (
          <button className="rm-back-btn" onClick={() => navigate(backPath)}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        )}

        {Icon && (
          <div className="rm-header-icon-box">
            <Icon size={28} />
          </div>
        )}

        <div className="rm-header-text">
          {kicker && <span className="rm-kicker">{kicker}</span>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>

      {rightAction && (
        <div className="rm-header-right">
          {rightAction}
        </div>
      )}
    </header>
  );
}