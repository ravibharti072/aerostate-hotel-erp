import React, { useState, useEffect } from "react";
import { Megaphone, X } from "lucide-react";
import api from "../api/api";
import "./globalAnnouncement.css";

export default function GlobalAnnouncement() {
  const [announcement, setAnnouncement] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    return [];
  }

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const res = await api.get("/announcements/active");
        const list = normalizeList(res.data, "announcements");
        
        if (list.length > 0) {
          const latest = list[0];
          const dismissedId = localStorage.getItem("dismissed_announcement_id");
          
          // Display banner only if this specific announcement ID hasn't been dismissed
          if (String(dismissedId) !== String(latest.id)) {
            setAnnouncement(latest);
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
      }
    };
    fetchAnnouncement();
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    if (announcement?.id) {
      localStorage.setItem("dismissed_announcement_id", announcement.id);
    }
  };

  if (!announcement || !isVisible) return null;

  return (
    <div className={`global-announcement-banner ${announcement.alert_type || "info"}`}>
      <div className="banner-content">
        <Megaphone size={18} className="banner-icon" />
        <div className="banner-text">
          <strong>{announcement.title}</strong>
          <span className="banner-separator">•</span>
          <span>{announcement.message}</span>
        </div>
      </div>
      <button className="banner-close" onClick={handleDismiss} title="Dismiss announcement">
        <X size={16} />
      </button>
    </div>
  );
}