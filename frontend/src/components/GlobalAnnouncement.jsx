import React, { useState, useEffect } from "react";
import { Megaphone, X } from "lucide-react";
import api from "../api/api";
import "./globalAnnouncement.css";

export default function GlobalAnnouncement() {
  const [announcement, setAnnouncement] = useState(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const res = await api.get("/announcements/active");
        if (res.data && res.data.length > 0) {
          setAnnouncement(res.data[0]); // Display the latest active announcement
        }
      } catch (err) {
        console.error("Failed to fetch announcements");
      }
    };
    fetchAnnouncement();
  }, []);

  if (!announcement || !isVisible) return null;

  return (
    <div className={`global-announcement-banner ${announcement.alert_type}`}>
      <div className="banner-content">
        <Megaphone size={18} className="banner-icon" />
        <div className="banner-text">
          <strong>{announcement.title}</strong>
          <span className="banner-separator">•</span>
          {announcement.message}
        </div>
      </div>
      <button className="banner-close" onClick={() => setIsVisible(false)}>
        <X size={16} />
      </button>
    </div>
  );
}