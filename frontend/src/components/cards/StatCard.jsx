import React from "react";
import "./statCard.css";

export default function StatCard({
  title,
  value,
  Icon,
  colorTheme = "blue",
  onClick,
  className = "",
  isActive = false,
}) {
  const bgClass = `bg-light-${colorTheme}`;
  const colorClass = `color-${colorTheme}`;

  return (
    <div
      className={`stat-card ${onClick ? "stat-card-clickable" : ""} ${isActive ? "active" : ""} ${className}`}
      onClick={onClick}
    >
      <div className={`stat-icon-wrapper ${bgClass}`}>
        {Icon && <Icon size={22} className={colorClass} />}
      </div>
      <div className="stat-info">
        <p>{title}</p>
        <h2>{value}</h2>
      </div>
    </div>
  );
}