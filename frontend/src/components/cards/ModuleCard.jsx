import React from "react";
import { ArrowRight } from "lucide-react";
import "./moduleCard.css";

export default function ModuleCard({ title, Icon, onClick, colorTheme = "blue" }) {
  const bgClass = `bg-${colorTheme}`;
  const colorClass = `color-${colorTheme}`;

  return (
    <div className="module-card" onClick={onClick}>
      <div className={`icon-wrapper ${bgClass}`}>
        {Icon && <Icon size={26} className={colorClass} />}
      </div>
      
      <div className="content">
        <h4>{title}</h4>
      </div>
      
      <ArrowRight size={20} className="arrow" />
    </div>
  );
}