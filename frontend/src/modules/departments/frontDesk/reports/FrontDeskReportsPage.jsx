import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck,
  FileText,
  BedDouble,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import PortalHeader from "../../../../components/PortalHeader"; // Adjust the relative path if needed based on file depth
import "./frontDeskReports.css";

export default function FrontDeskReportsPage() {
  const navigate = useNavigate();

  const reportModules = [
    {
      id: "bookings",
      title: "All Bookings Report",
      path: "/reports/front-desk/bookings",
      icon: CalendarCheck,
      iconClass: "fdr-icon-purple"
    },
    {
      id: "checkins",
      title: "Check-In / Out Report",
      path: "/reports/front-desk/check-ins",
      icon: BedDouble,
      iconClass: "fdr-icon-teal"
    },
    {
      id: "invoices",
      title: "Invoices & Revenue Report",
      path: "/reports/front-desk/invoices",
      icon: FileText,
      iconClass: "fdr-icon-blue"
    },
    {
      id: "financial",
      title: "Payments & Collections Report",
      path: "/reports/front-desk/payments",
      icon: TrendingUp,
      iconClass: "fdr-icon-green"
    }
  ];

  return (
    <div className="fdr-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Front Desk Reports Hub"
        kicker="ANALYTICS & LOGS"
        description="Select a report module tile below to view detailed operational records."
        icon={BarChart3}
        backPath="/front-desk"
      />

      <section className="fdr-modules-section">
        <div className="fdr-section-header">
          <div>
            <h3>Available Report Modules</h3>
            <p>Click any tile to open analytical logs.</p>
          </div>
          <div className="fdr-module-badge">{reportModules.length} reports</div>
        </div>

        <div className="fdr-modules-grid">
          {reportModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="fdr-module-card"
                onClick={() => navigate(mod.path)}
              >
                <div className={`fdr-module-icon-wrapper ${mod.iconClass}`}>
                  <Icon size={26} />
                </div>
                <div className="fdr-module-content">
                  <h4>{mod.title}</h4>
                </div>
                <ArrowRight size={20} className="fdr-module-arrow" />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}