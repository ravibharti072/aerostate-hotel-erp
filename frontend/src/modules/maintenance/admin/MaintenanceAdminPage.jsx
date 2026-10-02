import React, { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  Download,
  Plus,
  Search,
  Filter,
  Wrench,
  RotateCcw,
  Check,
  X,
  MapPin,
  Calendar,
  UserCheck,
  FileSpreadsheet,
  Award,
  ChevronRight,
  TrendingUp,
  AlertOctagon,
  Ticket,
  History,
  ArrowRight,
  Phone,
  Tag,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard } from "@components";
import "./maintenanceAdmin.css";

const CATEGORIES = [
  "General",
  "Electrical",
  "Plumbing",
  "AC / HVAC",
  "Carpentry",
  "Appliance",
  "Elevator",
  "Generator",
  "Painting",
  "Civil Work",
  "Safety / Fire",
];

const SOURCES = [
  { value: "direct", label: "Direct Report" },
  { value: "front_desk", label: "Front Desk" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "guest", label: "Guest Request" },
  { value: "inspection", label: "Routine Inspection" },
];

const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "#ef4444" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "normal", label: "Normal", color: "#3b82f6" },
  { value: "low", label: "Low", color: "#64748b" },
];

export default function MaintenanceAdminPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("board"); // board | team | approvals | tickets | audit | analytics
  const [tasks, setTasks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [teamOverview, setTeamOverview] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters for board
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");

  // Approvals Filter
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("pending_signoff"); // pending_signoff | all_completed

  // Tickets Filter
  const [ticketStatusFilter, setTicketStatusFilter] = useState("open"); // open | converted_to_task | resolved | all
  const [ticketSearch, setTicketSearch] = useState("");

  // Audit Logs Filter
  const [auditEntityFilter, setAuditEntityFilter] = useState("all"); // all | task | ticket
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // Modals
  const [quickAssignTask, setQuickAssignTask] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Sign Off Modal
  const [signOffTask, setSignOffTask] = useState(null);
  const [signOffNotes, setSignOffNotes] = useState("");
  const [signOffSubmitting, setSignOffSubmitting] = useState(false);

  // Rework Modal
  const [reworkTask, setReworkTask] = useState(null);
  const [reworkReason, setReworkReason] = useState("");
  const [reworkSubmitting, setReworkSubmitting] = useState(false);

  // Create Task Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    category: "Electrical",
    priority: "normal",
    location: "",
    due_date: "",
    estimated_hours: 1.0,
    assigned_to_staff_id: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Convert Ticket to Task Modal
  const [convertTicketModal, setConvertTicketModal] = useState(null);
  const [convertForm, setConvertForm] = useState({
    assigned_to_staff_id: "",
    estimated_hours: 1.0,
    due_date: "",
    priority: "normal",
    title: "",
    notes: "",
  });
  const [convertSubmitting, setConvertSubmitting] = useState(false);

  // Create Ticket Modal
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    title: "",
    description: "",
    category: "General",
    priority: "normal",
    source: "direct",
    location: "",
    reported_by: "",
    contact_phone: "",
  });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  // Fetch all operations data
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg("");

    try {
      const [tasksRes, teamRes, perfRes, techRes, ticketsRes, auditRes] = await Promise.all([
        api.get("/tasks", { params: { department: "maintenance" } }),
        api.get("/tasks/team-overview", { params: { department: "maintenance" } }),
        api.get("/tasks/performance", { params: { department: "maintenance" } }),
        api.get("/staff", { params: { department: "maintenance", status: "active" } }),
        api.get("/tickets", { params: { department: "maintenance" } }),
        api.get("/tickets/audit-logs", { params: { department: "maintenance", limit: 100 } }),
      ]);

      setTasks(tasksRes.data || []);
      setTeamOverview(teamRes.data || []);
      setPerformance(perfRes.data || null);
      setTechnicians(techRes.data || []);
      setTickets(ticketsRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      console.error("Failed to load maintenance operations data:", err);
      setErrorMsg(err?.response?.data?.detail || "Failed to load maintenance operations data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Flash message timer
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Statistics Calculations
  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const assigned = tasks.filter((t) => t.status === "assigned").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const awaitingSignOff = tasks.filter((t) => t.status === "completed" && !t.verified_at).length;
    const activeTechs = teamOverview.filter((t) => t.attendance_status === "present").length;
    const openTicketsCount = tickets.filter((t) => t.status === "open").length;

    return {
      total,
      pending,
      assigned,
      inProgress,
      completed,
      awaitingSignOff,
      activeTechs,
      openTicketsCount,
      totalTechs: teamOverview.length,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [tasks, teamOverview, tickets]);

  // Filtered Tasks for Board
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        !search ||
        task.title?.toLowerCase().includes(search.toLowerCase()) ||
        task.task_number?.toLowerCase().includes(search.toLowerCase()) ||
        task.location?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesTech =
        techFilter === "all" ||
        (techFilter === "unassigned" && !task.assigned_to_staff_id) ||
        String(task.assigned_to_staff_id) === String(techFilter);

      return matchesSearch && matchesCategory && matchesPriority && matchesTech;
    });
  }, [tasks, search, categoryFilter, priorityFilter, techFilter]);

  // Group into Kanban columns
  const kanbanColumns = useMemo(() => {
    return {
      pending: filteredTasks.filter((t) => t.status === "pending"),
      assigned: filteredTasks.filter((t) => t.status === "assigned"),
      in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
      completed: filteredTasks.filter((t) => t.status === "completed"),
    };
  }, [filteredTasks]);

  // Approvals Queue tasks
  const approvalTasks = useMemo(() => {
    const completedTasks = tasks.filter((t) => t.status === "completed");
    if (approvalStatusFilter === "pending_signoff") {
      return completedTasks.filter((t) => !t.verified_at);
    }
    return completedTasks;
  }, [tasks, approvalStatusFilter]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((tick) => {
      const matchesStatus = ticketStatusFilter === "all" || tick.status === ticketStatusFilter;
      const matchesSearch =
        !ticketSearch ||
        tick.title?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        tick.ticket_number?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        tick.location?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        tick.reported_by?.toLowerCase().includes(ticketSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [tickets, ticketStatusFilter, ticketSearch]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesEntity = auditEntityFilter === "all" || log.entity_type === auditEntityFilter;
      const matchesAction = auditActionFilter === "all" || log.action === auditActionFilter;
      return matchesEntity && matchesAction;
    });
  }, [auditLogs, auditEntityFilter, auditActionFilter]);

  // Quick Assign Submit
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!quickAssignTask) return;
    setAssignSubmitting(true);
    try {
      await api.post(`/tasks/${quickAssignTask.id}/assign`, {
        staff_id: selectedTechId ? Number(selectedTechId) : null,
      });
      setSuccessMsg(`Task ${quickAssignTask.task_number} assigned successfully.`);
      setQuickAssignTask(null);
      setSelectedTechId("");
      loadData(true);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to assign task.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Sign Off Submit
  const handleSignOffSubmit = async (e) => {
    e.preventDefault();
    if (!signOffTask) return;
    setSignOffSubmitting(true);
    try {
      await api.post(`/tasks/${signOffTask.id}/verify`, {
        notes: signOffNotes.trim() || undefined,
      });
      setSuccessMsg(`Task ${signOffTask.task_number} verified and signed off.`);
      setSignOffTask(null);
      setSignOffNotes("");
      loadData(true);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to sign off task.");
    } finally {
      setSignOffSubmitting(false);
    }
  };

  // Rework Submit
  const handleReworkSubmit = async (e) => {
    e.preventDefault();
    if (!reworkTask || !reworkReason.trim()) return;
    setReworkSubmitting(true);
    try {
      await api.post(`/tasks/${reworkTask.id}/rework`, {
        reason: reworkReason.trim(),
      });
      setSuccessMsg(`Rework requested for ${reworkTask.task_number}. Reverted to assigned status.`);
      setReworkTask(null);
      setReworkReason("");
      loadData(true);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to request rework.");
    } finally {
      setReworkSubmitting(false);
    }
  };

  // Create Task Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) return;
    setCreateSubmitting(true);
    try {
      const payload = {
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        category: createForm.category,
        priority: createForm.priority,
        location: createForm.location.trim() || null,
        due_date: createForm.due_date ? new Date(createForm.due_date).toISOString() : null,
        estimated_hours: parseFloat(createForm.estimated_hours) || 1.0,
        department: "maintenance",
        assigned_to_staff_id: createForm.assigned_to_staff_id ? Number(createForm.assigned_to_staff_id) : null,
      };

      await api.post("/tasks", payload);
      setSuccessMsg("New maintenance task created successfully.");
      setIsCreateModalOpen(false);
      setCreateForm({
        title: "",
        description: "",
        category: "Electrical",
        priority: "normal",
        location: "",
        due_date: "",
        estimated_hours: 1.0,
        assigned_to_staff_id: "",
      });
      loadData(true);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to create task.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Convert Ticket Modal
  const openConvertModal = (ticket) => {
    setConvertTicketModal(ticket);
    setConvertForm({
      title: ticket.title,
      priority: ticket.priority || "normal",
      estimated_hours: 1.0,
      due_date: "",
      assigned_to_staff_id: "",
      notes: "",
    });
  };

  // Convert Ticket Submit
  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!convertTicketModal) return;
    setConvertSubmitting(true);
    try {
      const payload = {
        title: convertForm.title.trim() || undefined,
        priority: convertForm.priority,
        estimated_hours: parseFloat(convertForm.estimated_hours) || 1.0,
        due_date: convertForm.due_date ? new Date(convertForm.due_date).toISOString() : null,
        assigned_to_staff_id: convertForm.assigned_to_staff_id ? Number(convertForm.assigned_to_staff_id) : null,
        notes: convertForm.notes.trim() || undefined,
      };

      const res = await api.post(`/tickets/${convertTicketModal.id}/convert-to-task`, payload);
      setSuccessMsg(`Ticket ${convertTicketModal.ticket_number} converted to task ${res.data.task_number}.`);
      setConvertTicketModal(null);
      loadData(true);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to convert ticket to task.");
    } finally {
      setConvertSubmitting(false);
    }
  };

  // Create Ticket Submit
  const handleTicketCreateSubmit = async (e) => {
    e.preventDefault();
    if (!ticketForm.title.trim()) return;
    setTicketSubmitting(true);
    try {
      const payload = {
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim() || null,
        category: ticketForm.category,
        priority: ticketForm.priority,
        source: ticketForm.source,
        location: ticketForm.location.trim() || null,
        reported_by: ticketForm.reported_by.trim() || null,
        contact_phone: ticketForm.contact_phone.trim() || null,
        department: "maintenance",
      };

      await api.post("/tickets", payload);
      setSuccessMsg("Incoming maintenance ticket logged successfully.");
      setIsCreateTicketModalOpen(false);
      setTicketForm({
        title: "",
        description: "",
        category: "General",
        priority: "normal",
        source: "direct",
        location: "",
        reported_by: "",
        contact_phone: "",
      });
      loadData(true);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to log ticket.");
    } finally {
      setTicketSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!tasks || tasks.length === 0) {
      alert("No tasks available to export.");
      return;
    }

    const headers = [
      "Task Number",
      "Title",
      "Category",
      "Priority",
      "Status",
      "Assigned Technician",
      "Location",
      "Estimated Hours",
      "Actual Hours",
      "Created At",
      "Completed At",
      "Verified Status",
    ];

    const rows = tasks.map((t) => [
      `"${t.task_number || ""}"`,
      `"${(t.title || "").replace(/"/g, '""')}"`,
      `"${t.category || ""}"`,
      `"${t.priority || ""}"`,
      `"${t.status || ""}"`,
      `"${t.assigned_staff?.full_name || "Unassigned"}"`,
      `"${(t.location || "").replace(/"/g, '""')}"`,
      t.estimated_hours || 0,
      t.actual_hours || 0,
      `"${t.created_at ? new Date(t.created_at).toLocaleString() : ""}"`,
      `"${t.completed_at ? new Date(t.completed_at).toLocaleString() : ""}"`,
      `"${t.verified_at ? `Verified by ${t.verified_by || "Admin"}` : "Unverified"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `maintenance_tasks_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="maint-admin-container">
      {/* Top Header */}
      <PortalHeader
        title="Maintenance Operations Command Center"
        kicker="OPERATIONS & ENGINEERING"
        description="Live Operations Board, Team Workload, Incoming Tickets, Approvals & Department Audit Trail"
        icon={Wrench}
        backPath="/dashboard"
        rightAction={
          <div className="maint-admin-header-actions">
            <button
              type="button"
              className="maint-btn maint-btn-secondary"
              onClick={handleExportCSV}
              title="Export Tasks CSV Report"
            >
              <Download size={15} />
              Export CSV
            </button>

            <button
              type="button"
              className="maint-btn maint-btn-ticket"
              onClick={() => setIsCreateTicketModalOpen(true)}
            >
              <Ticket size={15} />
              Log Ticket
            </button>
          </div>
        }
      />

      {/* Notifications */}
      {successMsg && (
        <div style={{
          backgroundColor: "#ecfdf5",
          border: "1px solid #10b981",
          color: "#065f46",
          padding: "12px 18px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontWeight: 600
        }}>
          <Check size={18} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{
          backgroundColor: "#fef2f2",
          border: "1px solid #ef4444",
          color: "#991b1b",
          padding: "12px 18px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontWeight: 600
        }}>
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {/* KPI Stats Banner using standard StatCard */}
      <div className="maint-admin-stats-grid">
        <StatCard
          title="Total Department Tasks"
          value={stats.total}
          Icon={KanbanSquare}
          colorTheme="blue"
        />

        <StatCard
          title="Open Incoming Tickets"
          value={stats.openTicketsCount}
          Icon={Ticket}
          colorTheme="amber"
        />

        <StatCard
          title="In Progress Now"
          value={stats.inProgress}
          Icon={Clock}
          colorTheme="purple"
        />

        <StatCard
          title="Awaiting Sign-Off"
          value={stats.awaitingSignOff}
          Icon={ShieldCheck}
          colorTheme="green"
        />

        <StatCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          Icon={TrendingUp}
          colorTheme="teal"
        />
      </div>

      {/* Tabs Bar */}
      <div className="maint-admin-tabs-bar">
        <div className="maint-nav-tabs">
          <button
            type="button"
            className={`maint-tab-btn ${activeTab === "board" ? "active" : ""}`}
            onClick={() => setActiveTab("board")}
          >
            <KanbanSquare size={16} />
            Live Kanban Board
            <span className="maint-tab-badge">{stats.total}</span>
          </button>

          <button
            type="button"
            className={`maint-tab-btn ${activeTab === "tickets" ? "active" : ""}`}
            onClick={() => setActiveTab("tickets")}
          >
            <Ticket size={16} />
            Incoming Tickets
            {stats.openTicketsCount > 0 && (
              <span className="maint-tab-badge amber">
                {stats.openTicketsCount} Open
              </span>
            )}
          </button>

          <button
            type="button"
            className={`maint-tab-btn ${activeTab === "team" ? "active" : ""}`}
            onClick={() => setActiveTab("team")}
          >
            <Users size={16} />
            Team Workload & Roster
            <span className="maint-tab-badge">{stats.totalTechs}</span>
          </button>

          <button
            type="button"
            className={`maint-tab-btn ${activeTab === "approvals" ? "active" : ""}`}
            onClick={() => setActiveTab("approvals")}
          >
            <ShieldCheck size={16} />
            Approvals & Sign-Offs
            {stats.awaitingSignOff > 0 && (
              <span className="maint-tab-badge green">
                {stats.awaitingSignOff}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`maint-tab-btn ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            <History size={16} />
            Audit Trail
            <span className="maint-tab-badge">{auditLogs.length}</span>
          </button>

          <button
            type="button"
            className={`maint-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            <TrendingUp size={16} />
            Performance & Analytics
          </button>
        </div>
      </div>

      {/* TAB 1: KANBAN BOARD */}
      {activeTab === "board" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filters Bar */}
          <div className="maint-filter-bar">
            <div className="maint-search-box">
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search tasks by number, title, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="maint-filter-select"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="maint-filter-select"
            >
              <option value="all">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="maint-filter-select"
            >
              <option value="all">All Technicians</option>
              <option value="unassigned">Unassigned Tasks</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Kanban Columns */}
          <div className="maint-kanban-board">
            {/* Column 1: Pending */}
            <div className="maint-kanban-column">
              <div className="maint-column-header">
                <div className="maint-column-title">
                  <Clock size={16} color="#fbbf24" />
                  Pending Assignment
                </div>
                <span className="maint-column-count pending">{kanbanColumns.pending.length}</span>
              </div>
              <div className="maint-column-body">
                {kanbanColumns.pending.length === 0 ? (
                  <div className="maint-empty-column">No pending tasks.</div>
                ) : (
                  kanbanColumns.pending.map((task) => (
                    <div key={task.id} className={`maint-task-card priority-${task.priority}`}>
                      <div className="maint-task-header">
                        <span className="maint-task-number">{task.task_number}</span>
                        <span className={`maint-badge ${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className="maint-task-title">{task.title}</div>
                      <div className="maint-task-meta">
                        {task.location && (
                          <div className="maint-meta-item">
                            <MapPin size={13} />
                            {task.location}
                          </div>
                        )}
                        <div className="maint-meta-item">
                          <Wrench size={13} />
                          {task.category}
                        </div>
                      </div>
                      <div className="maint-task-assigned">
                        <span style={{ color: "#fbbf24", fontWeight: 600 }}>Unassigned</span>
                        <button
                          className="maint-btn maint-btn-primary"
                          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          onClick={() => {
                            setQuickAssignTask(task);
                            setSelectedTechId(task.assigned_to_staff_id || "");
                          }}
                        >
                          Assign Now
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Assigned */}
            <div className="maint-kanban-column">
              <div className="maint-column-header">
                <div className="maint-column-title">
                  <UserCheck size={16} color="#60a5fa" />
                  Assigned
                </div>
                <span className="maint-column-count assigned">{kanbanColumns.assigned.length}</span>
              </div>
              <div className="maint-column-body">
                {kanbanColumns.assigned.length === 0 ? (
                  <div className="maint-empty-column">No tasks in assigned queue.</div>
                ) : (
                  kanbanColumns.assigned.map((task) => (
                    <div key={task.id} className={`maint-task-card priority-${task.priority}`}>
                      <div className="maint-task-header">
                        <span className="maint-task-number">{task.task_number}</span>
                        <span className={`maint-badge ${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className="maint-task-title">{task.title}</div>
                      <div className="maint-task-meta">
                        {task.location && (
                          <div className="maint-meta-item">
                            <MapPin size={13} />
                            {task.location}
                          </div>
                        )}
                        <div className="maint-meta-item">
                          <Wrench size={13} />
                          {task.category}
                        </div>
                      </div>
                      <div className="maint-task-assigned">
                        <div className="maint-tech-avatar-name">
                          <div className="maint-tech-avatar">
                            {task.assigned_staff?.full_name?.charAt(0) || "T"}
                          </div>
                          <span>{task.assigned_staff?.full_name || "Assigned"}</span>
                        </div>
                        <button
                          className="maint-btn maint-btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                          onClick={() => {
                            setQuickAssignTask(task);
                            setSelectedTechId(task.assigned_to_staff_id || "");
                          }}
                        >
                          Reassign
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: In Progress */}
            <div className="maint-kanban-column">
              <div className="maint-column-header">
                <div className="maint-column-title">
                  <Clock size={16} color="#c084fc" />
                  In Progress
                </div>
                <span className="maint-column-count in_progress">{kanbanColumns.in_progress.length}</span>
              </div>
              <div className="maint-column-body">
                {kanbanColumns.in_progress.length === 0 ? (
                  <div className="maint-empty-column">No tasks actively working right now.</div>
                ) : (
                  kanbanColumns.in_progress.map((task) => (
                    <div key={task.id} className={`maint-task-card priority-${task.priority}`}>
                      <div className="maint-task-header">
                        <span className="maint-task-number">{task.task_number}</span>
                        <span className={`maint-badge ${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className="maint-task-title">{task.title}</div>
                      <div className="maint-task-meta">
                        {task.location && (
                          <div className="maint-meta-item">
                            <MapPin size={13} />
                            {task.location}
                          </div>
                        )}
                        <div className="maint-meta-item">
                          <Wrench size={13} />
                          {task.category}
                        </div>
                        {task.started_at && (
                          <div className="maint-meta-item" style={{ color: "#c084fc" }}>
                            <Clock size={13} />
                            Started: {new Date(task.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                      <div className="maint-task-assigned">
                        <div className="maint-tech-avatar-name">
                          <div className="maint-tech-avatar">
                            {task.assigned_staff?.full_name?.charAt(0) || "T"}
                          </div>
                          <span>{task.assigned_staff?.full_name}</span>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#a855f7", fontWeight: 600 }}>Active</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 4: Completed */}
            <div className="maint-kanban-column">
              <div className="maint-column-header">
                <div className="maint-column-title">
                  <CheckCircle2 size={16} color="#34d399" />
                  Completed / Sign-Off
                </div>
                <span className="maint-column-count completed">{kanbanColumns.completed.length}</span>
              </div>
              <div className="maint-column-body">
                {kanbanColumns.completed.length === 0 ? (
                  <div className="maint-empty-column">No completed tasks yet.</div>
                ) : (
                  kanbanColumns.completed.map((task) => (
                    <div key={task.id} className="maint-task-card" style={{ borderLeft: "4px solid #10b981" }}>
                      <div className="maint-task-header">
                        <span className="maint-task-number">{task.task_number}</span>
                        {task.verified_at ? (
                          <span className="maint-badge normal" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399" }}>
                            Verified ✓
                          </span>
                        ) : (
                          <span className="maint-badge urgent" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>
                            Sign-Off Req.
                          </span>
                        )}
                      </div>
                      <div className="maint-task-title">{task.title}</div>
                      <div className="maint-task-meta">
                        <div className="maint-meta-item">
                          <UserCheck size={13} />
                          By {task.assigned_staff?.full_name || "Tech"}
                        </div>
                        {task.actual_hours && (
                          <div className="maint-meta-item">
                            <Clock size={13} />
                            Logged: {task.actual_hours}h
                          </div>
                        )}
                      </div>
                      <div className="maint-task-assigned">
                        {!task.verified_at ? (
                          <button
                            className="maint-btn maint-btn-success"
                            style={{ padding: "4px 10px", fontSize: "0.75rem", width: "100%", justifyContent: "center" }}
                            onClick={() => {
                              setSignOffTask(task);
                              setSignOffNotes("");
                            }}
                          >
                            <ShieldCheck size={14} /> Review & Sign Off
                          </button>
                        ) : (
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            Signed by {task.verified_by || "Admin"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING TICKETS (PHASE 6) */}
      {activeTab === "tickets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header & Filter */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              Incoming requests & issues reported by Front Desk, Housekeeping, or Guests awaiting conversion to official tasks.
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                className={`maint-btn ${ticketStatusFilter === "open" ? "maint-btn-primary" : "maint-btn-secondary"}`}
                onClick={() => setTicketStatusFilter("open")}
              >
                Open ({tickets.filter((t) => t.status === "open").length})
              </button>
              <button
                className={`maint-btn ${ticketStatusFilter === "converted_to_task" ? "maint-btn-primary" : "maint-btn-secondary"}`}
                onClick={() => setTicketStatusFilter("converted_to_task")}
              >
                Converted ({tickets.filter((t) => t.status === "converted_to_task").length})
              </button>
              <button
                className={`maint-btn ${ticketStatusFilter === "resolved" ? "maint-btn-primary" : "maint-btn-secondary"}`}
                onClick={() => setTicketStatusFilter("resolved")}
              >
                Resolved ({tickets.filter((t) => t.status === "resolved").length})
              </button>
              <button
                className={`maint-btn ${ticketStatusFilter === "all" ? "maint-btn-primary" : "maint-btn-secondary"}`}
                onClick={() => setTicketStatusFilter("all")}
              >
                All Tickets ({tickets.length})
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="maint-search-box" style={{ maxWidth: "420px" }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search tickets by number, issue, or reporter..."
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
            />
            {ticketSearch && (
              <button
                onClick={() => setTicketSearch("")}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="maint-approvals-table-wrapper">
            <table className="maint-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Issue Details</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Reported By</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      No tickets found matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#fbbf24" }}>
                        {t.ticket_number}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{t.title}</div>
                        {t.description && (
                          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "2px" }}>
                            {t.description}
                          </div>
                        )}
                        {t.location && (
                          <div style={{ fontSize: "0.74rem", color: "#60a5fa", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={12} /> {t.location}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="maint-ticket-source-badge">
                          {t.source?.replace("_", " ")}
                        </span>
                      </td>
                      <td>{t.category}</td>
                      <td>
                        <span className={`maint-badge ${t.priority}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.85rem", color: "#f8fafc" }}>
                          {t.reported_by || "Guest / Staff"}
                        </div>
                        {t.contact_phone && (
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            {t.contact_phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`maint-ticket-status ${t.status}`}>
                          {t.status === "converted_to_task" ? "In Task Board" : t.status}
                        </span>
                      </td>
                      <td>
                        {t.status === "open" ? (
                          <button
                            className="maint-btn maint-btn-primary"
                            style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                            onClick={() => openConvertModal(t)}
                          >
                            <ArrowRight size={14} /> Convert to Task
                          </button>
                        ) : t.status === "converted_to_task" ? (
                          <div style={{ fontSize: "0.78rem", color: "#60a5fa", fontWeight: 600 }}>
                            Linked Task #{t.converted_to_task_id}
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 600 }}>
                            ✓ Resolved
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TEAM ROSTER & WORKLOAD */}
      {activeTab === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
            Real-time status, ongoing assignments, and daily attendance of all maintenance staff.
          </div>

          <div className="maint-roster-grid">
            {teamOverview.length === 0 ? (
              <div style={{ padding: "40px", color: "#64748b", textAlign: "center", gridColumn: "1 / -1" }}>
                No maintenance technicians registered. Add staff under HR / Staff Directory.
              </div>
            ) : (
              teamOverview.map((tech) => (
                <div key={tech.id} className="maint-roster-card">
                  <div className="maint-roster-top">
                    <div className="maint-roster-user-info">
                      <div className="maint-roster-avatar">
                        {tech.full_name?.charAt(0) || "T"}
                      </div>
                      <div>
                        <div className="maint-roster-name">{tech.full_name}</div>
                        <div className="maint-roster-desig">{tech.designation}</div>
                      </div>
                    </div>
                    <span className={`maint-status-pill ${tech.status}`}>
                      {tech.status === "busy" ? "Busy" : tech.status === "available" ? "Active" : "Free"}
                    </span>
                  </div>

                  {/* Current Active Task */}
                  <div className="maint-roster-current-task">
                    <span className="maint-roster-task-label">CURRENT JOB</span>
                    <div className="maint-roster-task-name">
                      {tech.in_progress_task_title ? (
                        <span style={{ color: "#60a5fa" }}>
                          [{tech.in_progress_task_number}] {tech.in_progress_task_title}
                        </span>
                      ) : (
                        <span style={{ color: "#64748b" }}>No active task in progress</span>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="maint-roster-metrics">
                    <div>
                      <div className="maint-roster-metric-val">{tech.active_tasks_count}</div>
                      <div className="maint-roster-metric-lbl">In Queue</div>
                    </div>
                    <div>
                      <div className="maint-roster-metric-val" style={{ color: "#34d399" }}>
                        {tech.completed_today}
                      </div>
                      <div className="maint-roster-metric-lbl">Done Today</div>
                    </div>
                    <div>
                      <div className="maint-roster-metric-val">{tech.total_completed}</div>
                      <div className="maint-roster-metric-lbl">Total Done</div>
                    </div>
                  </div>

                  {/* Attendance & Action */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "6px" }}>
                    <span style={{ fontSize: "0.8rem", color: tech.attendance_status === "present" ? "#34d399" : "#fbbf24" }}>
                      ● Today: {tech.attendance_status.toUpperCase()}
                    </span>
                    <button
                      className="maint-btn maint-btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                      onClick={() => {
                        setCreateForm((prev) => ({
                          ...prev,
                          assigned_to_staff_id: tech.id,
                        }));
                        setIsCreateModalOpen(true);
                      }}
                    >
                      <Plus size={14} /> Assign Task
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: APPROVALS & SIGN-OFF QUEUE */}
      {activeTab === "approvals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              Review completed maintenance work, verify resolution quality, or request rework.
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className={`maint-btn ${approvalStatusFilter === "pending_signoff" ? "maint-btn-primary" : "maint-btn-secondary"}`}
                onClick={() => setApprovalStatusFilter("pending_signoff")}
              >
                Awaiting Sign-Off ({tasks.filter((t) => t.status === "completed" && !t.verified_at).length})
              </button>
              <button
                className={`maint-btn ${approvalStatusFilter === "all_completed" ? "maint-btn-primary" : "maint-btn-secondary"}`}
                onClick={() => setApprovalStatusFilter("all_completed")}
              >
                All Completed ({tasks.filter((t) => t.status === "completed").length})
              </button>
            </div>
          </div>

          <div className="maint-approvals-table-wrapper">
            <table className="maint-table">
              <thead>
                <tr>
                  <th>Task #</th>
                  <th>Title & Location</th>
                  <th>Technician</th>
                  <th>Hours (Act / Est)</th>
                  <th>Technician Notes</th>
                  <th>Completed At</th>
                  <th>Status / Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      {approvalStatusFilter === "pending_signoff"
                        ? "Great job! No completed tasks awaiting HOD sign-off."
                        : "No completed tasks recorded yet."}
                    </td>
                  </tr>
                ) : (
                  approvalTasks.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#93c5fd" }}>
                        {t.task_number}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{t.title}</div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8", display: "flex", gap: "10px", marginTop: "3px" }}>
                          <span>{t.category}</span>
                          {t.location && <span>• {t.location}</span>}
                        </div>
                      </td>
                      <td>{t.assigned_staff?.full_name || "Technician"}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: "#f8fafc" }}>{t.actual_hours || 0}h</span>
                        <span style={{ color: "#64748b", fontSize: "0.8rem" }}> / {t.estimated_hours || 0}h</span>
                      </td>
                      <td style={{ maxWidth: "260px" }}>
                        <div style={{ fontSize: "0.82rem", color: "#cbd5e1", fontStyle: t.completion_notes ? "normal" : "italic" }}>
                          {t.completion_notes || "No notes provided"}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                        {t.completed_at ? new Date(t.completed_at).toLocaleString() : "Recently"}
                      </td>
                      <td>
                        {t.verified_at ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ color: "#34d399", fontWeight: 600, fontSize: "0.82rem" }}>
                              ✓ Verified
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              by {t.verified_by || "Chief Engineer"}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="maint-btn maint-btn-success"
                              style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                              onClick={() => {
                                setSignOffTask(t);
                                setSignOffNotes("");
                              }}
                            >
                              <ShieldCheck size={14} /> Verify
                            </button>
                            <button
                              className="maint-btn maint-btn-danger"
                              style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                              onClick={() => {
                                setReworkTask(t);
                                setReworkReason("");
                              }}
                            >
                              <RotateCcw size={14} /> Rework
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL (PHASE 6) */}
      {activeTab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header & Filter */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              Immutable audit log of all maintenance actions, assignments, completions, and HOD sign-offs.
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <select
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className="maint-filter-select"
              >
                <option value="all">All Entity Types</option>
                <option value="task">Tasks Only</option>
                <option value="ticket">Tickets Only</option>
              </select>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="maint-filter-select"
              >
                <option value="all">All Actions</option>
                <option value="created">Created</option>
                <option value="assigned">Assigned</option>
                <option value="started">Started</option>
                <option value="completed">Completed</option>
                <option value="verified">Verified</option>
                <option value="rework_requested">Rework Requested</option>
                <option value="converted_to_task">Converted to Task</option>
              </select>
            </div>
          </div>

          <div className="maint-audit-timeline">
            {filteredAuditLogs.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748b", background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: "10px" }}>
                No audit trail logs recorded yet.
              </div>
            ) : (
              filteredAuditLogs.map((log) => (
                <div key={log.id} className="maint-audit-item">
                  <div className={`maint-audit-icon ${log.action}`}>
                    {log.action === "created" || log.action === "created_from_ticket" ? (
                      <Plus size={18} />
                    ) : log.action === "assigned" ? (
                      <UserCheck size={18} />
                    ) : log.action === "started" ? (
                      <Clock size={18} />
                    ) : log.action === "completed" || log.action === "verified" ? (
                      <CheckCircle2 size={18} />
                    ) : log.action === "rework_requested" ? (
                      <RotateCcw size={18} />
                    ) : (
                      <Tag size={18} />
                    )}
                  </div>

                  <div className="maint-audit-content">
                    <div className="maint-audit-header">
                      <div className="maint-audit-title">
                        <span style={{ textTransform: "uppercase", color: "#93c5fd", marginRight: "8px", fontWeight: 700 }}>
                          [{log.action.replace("_", " ")}]
                        </span>
                        <span>{log.entity_identifier || `${log.entity_type} #${log.entity_id}`}</span>
                      </div>
                      <div className="maint-audit-time">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                      </div>
                    </div>

                    <div className="maint-audit-actor">
                      Performed by <strong style={{ color: "#f8fafc" }}>{log.performed_by_name}</strong>
                    </div>

                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="maint-audit-details">
                        {Object.entries(log.details).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", gap: "6px" }}>
                            <span style={{ color: "#94a3b8" }}>{k}:</span>
                            <span style={{ color: "#f8fafc" }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: PERFORMANCE & ANALYTICS */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="maint-analytics-grid">
            {/* Category Breakdown */}
            <div className="maint-analytics-card">
              <div className="maint-analytics-title">
                <Wrench size={18} color="#60a5fa" />
                Work Distribution by Category
              </div>
              <div style={{ marginTop: "10px" }}>
                {performance && Object.keys(performance.category_breakdown || {}).length > 0 ? (
                  Object.entries(performance.category_breakdown).map(([cat, count]) => {
                    const total = performance.total_tasks || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={cat} className="maint-bar-item">
                        <div className="maint-bar-header">
                          <span>{cat}</span>
                          <span>
                            {count} tasks ({pct}%)
                          </span>
                        </div>
                        <div className="maint-bar-track">
                          <div className="maint-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "#64748b", padding: "20px" }}>No tasks logged yet.</div>
                )}
              </div>
            </div>

            {/* Turnaround & Key Metrics */}
            <div className="maint-analytics-card">
              <div className="maint-analytics-title">
                <Award size={18} color="#fbbf24" />
                Turnaround & Efficiency KPI
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "16px", borderRadius: "10px" }}>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>AVERAGE TURNAROUND TIME</div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#2563eb" }}>
                      {performance?.avg_turnaround_hours || 0} hrs
                    </div>
                  </div>
                  <Clock size={36} color="#3b82f6" />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "16px", borderRadius: "10px" }}>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>OVERALL COMPLETION RATIO</div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#10b981" }}>
                      {performance?.completion_rate || 0}%
                    </div>
                  </div>
                  <CheckCircle2 size={36} color="#10b981" />
                </div>
              </div>
            </div>
          </div>

          {/* Technician Leaderboard */}
          <div className="maint-analytics-card">
            <div className="maint-analytics-title">
              <Award size={18} color="#a855f7" />
              Technician Performance Leaderboard
            </div>
            <div className="maint-approvals-table-wrapper" style={{ marginTop: "10px" }}>
              <table className="maint-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Technician Name</th>
                    <th>Designation</th>
                    <th>Tasks Completed</th>
                    <th>Total Logged Hours</th>
                    <th>Efficiency Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {performance?.technician_metrics?.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                        No completed task metrics for technicians yet.
                      </td>
                    </tr>
                  ) : (
                    performance?.technician_metrics
                      ?.sort((a, b) => b.tasks_completed - a.tasks_completed)
                      .map((tech, index) => (
                        <tr key={tech.name}>
                          <td style={{ fontWeight: 700, color: index === 0 ? "#fbbf24" : index === 1 ? "#cbd5e1" : "#cd7f32" }}>
                            #{index + 1}
                          </td>
                          <td style={{ fontWeight: 600, color: "#f8fafc" }}>{tech.name}</td>
                          <td style={{ color: "#94a3b8" }}>{tech.designation || "Technician"}</td>
                          <td style={{ fontWeight: 700, color: "#34d399" }}>{tech.tasks_completed}</td>
                          <td>{tech.hours_logged} hrs</td>
                          <td>
                            <span className="maint-badge normal" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
                              {tech.tasks_completed > 0
                                ? (tech.hours_logged / tech.tasks_completed).toFixed(1) + " h/task"
                                : "N/A"}
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: QUICK ASSIGN TASK */}
      {quickAssignTask && (
        <div className="maint-modal-overlay">
          <div className="maint-modal">
            <div className="maint-modal-header">
              <h3>Assign Task: {quickAssignTask.task_number}</h3>
              <button
                onClick={() => setQuickAssignTask(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="maint-modal-body">
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "1rem" }}>{quickAssignTask.title}</div>
                  <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "4px" }}>
                    Location: {quickAssignTask.location || "General"} | Category: {quickAssignTask.category}
                  </div>
                </div>

                <div className="maint-form-group">
                  <label>Select Maintenance Technician</label>
                  <select
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Technician --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.designation || "Technician"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="maint-modal-footer">
                <button
                  type="button"
                  className="maint-btn maint-btn-secondary"
                  onClick={() => setQuickAssignTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="maint-btn maint-btn-primary"
                  disabled={assignSubmitting || !selectedTechId}
                >
                  {assignSubmitting ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VERIFY & SIGN-OFF */}
      {signOffTask && (
        <div className="maint-modal-overlay">
          <div className="maint-modal">
            <div className="maint-modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={20} color="#10b981" />
                Sign Off & Verify Task
              </h3>
              <button
                onClick={() => setSignOffTask(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSignOffSubmit}>
              <div className="maint-modal-body">
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "14px", borderRadius: "8px" }}>
                  <div style={{ fontWeight: 700, color: "#2563eb", fontFamily: "monospace" }}>
                    {signOffTask.task_number}
                  </div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "4px" }}>
                    {signOffTask.title}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "6px" }}>
                    Completed by: <strong style={{ color: "#1e293b" }}>{signOffTask.assigned_staff?.full_name || "Technician"}</strong>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "2px" }}>
                    Logged Time: <strong style={{ color: "#059669" }}>{signOffTask.actual_hours || 0} hours</strong>
                  </div>
                  {signOffTask.completion_notes && (
                    <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: "8px", fontStyle: "italic", borderTop: "1px solid #e2e8f0", paddingTop: "6px" }}>
                      "{signOffTask.completion_notes}"
                    </div>
                  )}
                </div>

                <div className="maint-form-group">
                  <label>Inspection & Verification Notes (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Inspected on site, AC compressor cooling restored to 18°C. Approved."
                    value={signOffNotes}
                    onChange={(e) => setSignOffNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="maint-modal-footer">
                <button
                  type="button"
                  className="maint-btn maint-btn-secondary"
                  onClick={() => setSignOffTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="maint-btn maint-btn-success"
                  disabled={signOffSubmitting}
                >
                  {signOffSubmitting ? "Signing Off..." : "Approve & Sign Off"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REQUEST REWORK */}
      {reworkTask && (
        <div className="maint-modal-overlay">
          <div className="maint-modal">
            <div className="maint-modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <RotateCcw size={20} color="#ef4444" />
                Request Rework: {reworkTask.task_number}
              </h3>
              <button
                onClick={() => setReworkTask(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReworkSubmit}>
              <div className="maint-modal-body">
                <div style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>
                  This will reopen the task, reset its status to <strong>Assigned</strong>, and notify the technician of required corrections.
                </div>

                <div className="maint-form-group">
                  <label>Rework Instructions & Reason (Required)</label>
                  <textarea
                    rows={4}
                    placeholder="Specify why rework is required (e.g. Pipe still leaks slightly at coupling joint, please re-tighten seal)."
                    value={reworkReason}
                    onChange={(e) => setReworkReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="maint-modal-footer">
                <button
                  type="button"
                  className="maint-btn maint-btn-secondary"
                  onClick={() => setReworkTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="maint-btn maint-btn-danger"
                  disabled={reworkSubmitting || !reworkReason.trim()}
                >
                  {reworkSubmitting ? "Submitting..." : "Send Back for Rework"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONVERT TICKET TO TASK (PHASE 6) */}
      {convertTicketModal && (
        <div className="maint-modal-overlay">
          <div className="maint-modal">
            <div className="maint-modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ArrowRight size={20} color="#3b82f6" />
                Convert Ticket {convertTicketModal.ticket_number} to Task
              </h3>
              <button
                onClick={() => setConvertTicketModal(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConvertSubmit}>
              <div className="maint-modal-body">
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px", fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{convertTicketModal.title}</div>
                  <div style={{ color: "#64748b", marginTop: "4px" }}>
                    Source: {convertTicketModal.source} | Category: {convertTicketModal.category} | Location: {convertTicketModal.location || "General"}
                  </div>
                </div>

                <div className="maint-form-group">
                  <label>Task Title</label>
                  <input
                    type="text"
                    value={convertForm.title}
                    onChange={(e) => setConvertForm({ ...convertForm, title: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="maint-form-group">
                    <label>Priority</label>
                    <select
                      value={convertForm.priority}
                      onChange={(e) => setConvertForm({ ...convertForm, priority: e.target.value })}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="maint-form-group">
                    <label>Estimated Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={convertForm.estimated_hours}
                      onChange={(e) => setConvertForm({ ...convertForm, estimated_hours: e.target.value })}
                    />
                  </div>
                </div>

                <div className="maint-form-group">
                  <label>Assign to Technician (Optional)</label>
                  <select
                    value={convertForm.assigned_to_staff_id}
                    onChange={(e) => setConvertForm({ ...convertForm, assigned_to_staff_id: e.target.value })}
                  >
                    <option value="">-- Leave Unassigned (Pending) --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.designation || "Technician"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="maint-form-group">
                  <label>Conversion / Work Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="Instructions for the assigned technician..."
                    value={convertForm.notes}
                    onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="maint-modal-footer">
                <button
                  type="button"
                  className="maint-btn maint-btn-secondary"
                  onClick={() => setConvertTicketModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="maint-btn maint-btn-primary"
                  disabled={convertSubmitting}
                >
                  {convertSubmitting ? "Converting..." : "Confirm Conversion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: LOG INCOMING TICKET (PHASE 6) */}
      {isCreateTicketModalOpen && (
        <div className="maint-modal-overlay">
          <div className="maint-modal">
            <div className="maint-modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Ticket size={20} color="#fbbf24" />
                Log Incoming Issue / Ticket
              </h3>
              <button
                onClick={() => setIsCreateTicketModalOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTicketCreateSubmit}>
              <div className="maint-modal-body">
                <div className="maint-form-group">
                  <label>Issue Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. AC leaking water in Room 204"
                    value={ticketForm.title}
                    onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="maint-form-group">
                    <label>Category</label>
                    <select
                      value={ticketForm.category}
                      onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="maint-form-group">
                    <label>Priority</label>
                    <select
                      value={ticketForm.priority}
                      onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="maint-form-group">
                    <label>Source</label>
                    <select
                      value={ticketForm.source}
                      onChange={(e) => setTicketForm({ ...ticketForm, source: e.target.value })}
                    >
                      {SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="maint-form-group">
                    <label>Location / Room</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 204, 2nd Floor Hallway"
                      value={ticketForm.location}
                      onChange={(e) => setTicketForm({ ...ticketForm, location: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="maint-form-group">
                    <label>Reported By</label>
                    <input
                      type="text"
                      placeholder="e.g. Guest Mr. Smith / Front Desk"
                      value={ticketForm.reported_by}
                      onChange={(e) => setTicketForm({ ...ticketForm, reported_by: e.target.value })}
                    />
                  </div>

                  <div className="maint-form-group">
                    <label>Contact Phone (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={ticketForm.contact_phone}
                      onChange={(e) => setTicketForm({ ...ticketForm, contact_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="maint-form-group">
                  <label>Description / Details</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details about the malfunction or problem..."
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="maint-modal-footer">
                <button
                  type="button"
                  className="maint-btn maint-btn-secondary"
                  onClick={() => setIsCreateTicketModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="maint-btn maint-btn-primary"
                  style={{ background: "#d97706", borderColor: "#f59e0b" }}
                  disabled={ticketSubmitting}
                >
                  {ticketSubmitting ? "Logging..." : "Log Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE TASK */}
      {isCreateModalOpen && (
        <div className="maint-modal-overlay">
          <div className="maint-modal">
            <div className="maint-modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={20} color="#3b82f6" />
                Create Maintenance Task
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="maint-modal-body">
                <div className="maint-form-group">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Repair water pressure pump in Tower A"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="maint-form-group">
                  <label>Description / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Details about the issue, diagnostic instructions, or required spare parts..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="maint-form-group">
                    <label>Category</label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="maint-form-group">
                    <label>Priority</label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="maint-form-group">
                    <label>Location / Asset</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 402, Boiler Room"
                      value={createForm.location}
                      onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    />
                  </div>

                  <div className="maint-form-group">
                    <label>Estimated Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={createForm.estimated_hours}
                      onChange={(e) => setCreateForm({ ...createForm, estimated_hours: e.target.value })}
                    />
                  </div>
                </div>

                <div className="maint-form-group">
                  <label>Assign to Technician (Optional)</label>
                  <select
                    value={createForm.assigned_to_staff_id}
                    onChange={(e) => setCreateForm({ ...createForm, assigned_to_staff_id: e.target.value })}
                  >
                    <option value="">-- Leave Unassigned (Pending) --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.designation || "Technician"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="maint-modal-footer">
                <button
                  type="button"
                  className="maint-btn maint-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="maint-btn maint-btn-primary"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
