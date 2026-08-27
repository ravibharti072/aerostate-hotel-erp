import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext"; 
import { 
  ArrowLeft, 
  CalendarCheck, 
  Plus, 
  Edit, 
  Trash2,
  Clock,
  X,
  User,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Coffee,
  CalendarDays,
  CalendarHeart,
  Layers,
  Lock
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; // <-- Imported reusable component
import "./staffAttendance.css";

export default function StaffAttendancePage() {
  const navigate = useNavigate();
  const { token, user, goLiveDate } = useAuth(); 

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState("monthly-grid"); 

  // Date Strings
  const todayDate = new Date().toISOString().split("T")[0];
  const currentMonth = todayDate.slice(0, 7);

  // Go-Live Restriction Hook
  const goLiveMonth = goLiveDate ? goLiveDate.slice(0, 7) : null;
  const defaultInitialMonth = goLiveMonth && currentMonth < goLiveMonth ? goLiveMonth : currentMonth;

  // Filters
  const [gridMonth, setGridMonth] = useState(defaultInitialMonth);
  const [dailyDateFilter, setDailyDateFilter] = useState(todayDate);
  const [allDateFilter, setAllDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Person-Wise State
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [summaryMonth, setSummaryMonth] = useState(defaultInitialMonth);

  // Bulk Selection State
  const [selectedRecords, setSelectedRecords] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [formData, setFormData] = useState({
    staff_id: "",
    attendance_date: todayDate,
    status: "present",
    check_in_time: "09:00",
    check_out_time: "18:00",
    remarks: "",
    hotel_id: user?.hotel_id || 1 
  });

  const [bulkData, setBulkData] = useState({
    staff_id: "",
    start_date: todayDate,
    end_date: todayDate,
    status: "present",
    check_in_time: "09:00",
    check_out_time: "18:00",
    remarks: "Date Range Testing Entry",
    hotel_id: user?.hotel_id || 1
  });

  const fetchData = async () => {
    if (!token) return; 
    setIsLoading(true);

    try {
      const staffRes = await fetch("http://localhost:8000/staff", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffList(Array.isArray(staffData) ? staffData : []);
      }

      let attendanceUrl = `http://localhost:8000/staff-attendance`;
      if (statusFilter && activeTab === 'list') {
        attendanceUrl += `?status=${statusFilter}`;
      }

      const attRes = await fetch(attendanceUrl, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (attRes.ok) {
        const attData = await attRes.json();
        setAttendanceRecords(Array.isArray(attData) ? attData : []);
      }

      const leaveRes = await fetch("http://localhost:8000/staff-leaves", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        setLeaveRecords(Array.isArray(leaveData) ? leaveData : []);
      }

    } catch (error) {
      console.error("Error fetching attendance/leave data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, activeTab, token]); 

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsBulkModalOpen(false);
    setErrorMessage(""); 
  };

  const formatDateTime = (dateStr, timeStr) => {
    if (!timeStr) return null;
    let formattedTime = timeStr;
    if (formattedTime.length === 5) formattedTime += ":00";
    return `${dateStr}T${formattedTime}`;
  };

  const handleAddAttendance = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(""); 

    try {
      const payload = {
        ...formData,
        hotel_id: parseInt(formData.hotel_id, 10),
        staff_id: parseInt(formData.staff_id, 10)
      };

      if (payload.status === "absent" || payload.status === "on-leave" || payload.status === "off-day") {
        payload.check_in_time = null;
        payload.check_out_time = null;
      } else {
        payload.check_in_time = formatDateTime(payload.attendance_date, formData.check_in_time);
        payload.check_out_time = formatDateTime(payload.attendance_date, formData.check_out_time);
      }

      const response = await fetch("http://localhost:8000/staff-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        closeModal();
        fetchData(); 
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.detail || "Failed to mark attendance.");
      }
    } catch (error) {
      setErrorMessage("Network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAttendance = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    if (!bulkData.staff_id) {
      setErrorMessage("Please select an employee.");
      setIsSubmitting(false);
      return;
    }

    const start = new Date(bulkData.start_date);
    const end = new Date(bulkData.end_date);

    if (end < start) {
      setErrorMessage("End date cannot be earlier than start date.");
      setIsSubmitting(false);
      return;
    }

    try {
      let currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split("T")[0];

        const payload = {
          hotel_id: parseInt(bulkData.hotel_id, 10),
          staff_id: parseInt(bulkData.staff_id, 10),
          attendance_date: dateStr,
          status: bulkData.status,
          check_in_time: (bulkData.status === "present" || bulkData.status === "half-day") ? formatDateTime(dateStr, bulkData.check_in_time) : null,
          check_out_time: (bulkData.status === "present" || bulkData.status === "half-day") ? formatDateTime(dateStr, bulkData.check_out_time) : null,
          remarks: bulkData.remarks
        };

        await fetch("http://localhost:8000/staff-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(payload)
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      setIsBulkModalOpen(false);
      fetchData();
    } catch (error) {
      setErrorMessage("Network error during date range creation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttendance = async (id) => {
    if (!window.confirm("Are you sure you want to delete this attendance record?")) return;
    try {
      const response = await fetch(`http://localhost:8000/staff-attendance/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        setSelectedRecords(prev => prev.filter(rId => rId !== id));
        fetchData();
      } else {
        alert("Failed to delete attendance record.");
      }
    } catch (error) {
      console.error("Error deleting attendance:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedRecords.length} selected records?`)) return;
    
    setIsSubmitting(true);
    try {
      for (const id of selectedRecords) {
        await fetch(`http://localhost:8000/staff-attendance/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
      }
      setSelectedRecords([]); 
      fetchData(); 
    } catch (error) {
      console.error("Error deleting bulk attendance:", error);
      alert("An error occurred during bulk deletion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStaffName = (staffId) => {
    const staff = staffList.find(s => s.id === staffId);
    return staff ? (staff.full_name || "Unknown") : "Unknown Staff";
  };

  const formatTimeDisplay = (datetimeStr) => {
    if (!datetimeStr) return "--:--";
    try {
      const d = new Date(datetimeStr);
      if (!isNaN(d)) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}
    if (datetimeStr.includes("T")) return datetimeStr.split("T")[1].slice(0, 5);
    return datetimeStr;
  };

  const isDateInLeaveRange = (dateStr, startDateStr, endDateStr) => {
    const target = new Date(dateStr).setHours(0, 0, 0, 0);
    const start = new Date(startDateStr.split("T")[0]).setHours(0, 0, 0, 0);
    const end = new Date(endDateStr.split("T")[0]).setHours(0, 0, 0, 0);
    return target >= start && target <= end;
  };

  const getDaysInMonth = (yearMonth) => {
    if (!yearMonth) return [];
    const [year, month] = yearMonth.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `${yearMonth}-${day}`;
    });
  };

  // -------------------------------------------------------------
  // PRECISE CHRONOLOGICAL MONTH-BY-MONTH SIMULATION ENGINE
  // -------------------------------------------------------------
  const simulateStaffUpToMonth = (staff, targetMonthStr) => {
    if (!staff || !targetMonthStr) return { finalBalance: 0, monthStatuses: [] };

    const startDateString = staff.leave_tracking_start_date || staff.created_at || targetMonthStr + "-01";
    let currDate = new Date(startDateString);
    currDate.setDate(1); // Start at 1st of start month

    const [targetY, targetM] = targetMonthStr.split('-').map(Number);
    const targetDateLimit = new Date(targetY, targetM - 1, 1);

    let balance = parseFloat(staff.legacy_leave_balance) || 0;
    let targetMonthDaysStatuses = [];

    while (currDate <= targetDateLimit) {
      const y = currDate.getFullYear();
      const m = currDate.getMonth() + 1;
      const mStr = `${y}-${String(m).padStart(2, '0')}`;

      // Add 4 new offs at the start of every tracked month
      balance += 4;

      const daysInMonth = new Date(y, m, 0).getDate();
      let monthStatuses = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${mStr}-${dayStr}`;

        // Check if there is an explicit database attendance record or approved leave
        const attRecord = attendanceRecords.find(r => r.staff_id === staff.id && r.attendance_date?.startsWith(dateStr));
        const matchingLeave = leaveRecords.find(l => l.staff_id === staff.id && l.status === "approved" && isDateInLeaveRange(dateStr, l.start_date, l.end_date));

        let status = null;
        if (attRecord) status = attRecord.status;
        else if (matchingLeave) status = 'on-leave';

        const isFutureOrToday = dateStr >= todayDate;

        if (status === 'present') {
          monthStatuses.push({ date: dateStr, status: 'present' });
        } else if (status === 'half-day') {
          monthStatuses.push({ date: dateStr, status: 'half-day' });
        } else if (status === 'on-leave') {
          balance = Math.max(0, balance - 1);
          monthStatuses.push({ date: dateStr, status: 'on-leave' });
        } else if (status === 'off-day') {
          balance = Math.max(0, balance - 1);
          monthStatuses.push({ date: dateStr, status: 'off-day' });
        } else {
          // Unrecorded past day: draw from available pool starting strictly from Day 1
          if (!isFutureOrToday) {
            if (balance > 0) {
              balance = Math.max(0, balance - 1);
              monthStatuses.push({ date: dateStr, status: 'off-day' }); // Auto-O
            } else {
              monthStatuses.push({ date: dateStr, status: 'absent' }); // Absent once pool hits 0
            }
          } else {
            monthStatuses.push({ date: dateStr, status: '-' }); // Future date
          }
        }
      }

      if (mStr === targetMonthStr) {
        targetMonthDaysStatuses = monthStatuses;
      }

      // Move to next month
      currDate.setMonth(currDate.getMonth() + 1);
    }

    return { finalBalance: Math.max(0, balance), monthStatuses: targetMonthDaysStatuses };
  };

  // -------------------------------------------------------------
  // TAB 1: MONTHLY GRID VIEW
  // -------------------------------------------------------------
  const gridDaysList = getDaysInMonth(gridMonth);
  const activeStaffList = staffList.filter(s => s.status === 'active');

  const generateGridData = () => {
    return activeStaffList.map(staff => {
      const { finalBalance, monthStatuses } = simulateStaffUpToMonth(staff, gridMonth);

      let monthPresentCount = 0;
      const daysData = gridDaysList.map((dateStr) => {
        const found = monthStatuses.find(s => s.date === dateStr);
        const st = found ? found.status : '-';

        let statusCode = '-';
        if (st === 'present') { statusCode = 'P'; monthPresentCount++; }
        else if (st === 'half-day') { statusCode = 'H'; monthPresentCount += 0.5; }
        else if (st === 'on-leave') statusCode = 'L';
        else if (st === 'off-day') statusCode = 'O';
        else if (st === 'absent') statusCode = 'A';

        return statusCode;
      });

      return { staff, days: daysData, monthPresentCount, weeklyOffsLeft: finalBalance };
    });
  };

  const gridData = generateGridData();

  // -------------------------------------------------------------
  // TAB 2 & 4: TABLE SELECTION LOGIC
  // -------------------------------------------------------------
  const handleSelectAll = (e, recordsArray) => {
    if (e.target.checked) {
      setSelectedRecords(recordsArray.map(r => r.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (id) => {
    setSelectedRecords(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const dailyRecords = attendanceRecords.filter(record => {
    const recordDate = record.attendance_date ? record.attendance_date.split('T')[0] : "";
    return recordDate === dailyDateFilter;
  });

  const allFilteredRecords = attendanceRecords.filter(record => {
    if (allDateFilter) {
      const recordDate = record.attendance_date ? record.attendance_date.split('T')[0] : "";
      if (recordDate !== allDateFilter) return false;
    }
    return true;
  });

  // Calculate generic daily stats for the top of the page
  const todayStats = useMemo(() => {
    const activeStaff = staffList.filter(s => s.status === 'active');
    const total = activeStaff.length;

    const todayAtt = attendanceRecords.filter(r => r.attendance_date && r.attendance_date.split('T')[0] === todayDate);
    
    const present = todayAtt.filter(r => r.status === 'present' || r.status === 'half-day').length;
    const absent = todayAtt.filter(r => r.status === 'absent').length;
    
    const onLeave = leaveRecords.filter(l => l.status === "approved" && isDateInLeaveRange(todayDate, l.start_date, l.end_date)).length;
    const offDay = todayAtt.filter(r => r.status === 'off-day').length;
    
    return { 
      total, 
      present, 
      absent, 
      onLeave: onLeave + offDay 
    };
  }, [staffList, attendanceRecords, leaveRecords, todayDate]);

  const renderTable = (records, emptyMessage) => {
    const isAllSelected = records.length > 0 && records.every(r => selectedRecords.includes(r.id));

    return (
      <div className="att-table-container">
        <table className="att-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e, records)}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Employee Name</th>
              <th>Date</th>
              <th>Status</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" className="empty-state">Loading attendance data...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan="7" className="empty-state">{emptyMessage}</td></tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} style={{ backgroundColor: selectedRecords.includes(record.id) ? '#eff6ff' : 'transparent' }}>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedRecords.includes(record.id)}
                      onChange={() => handleSelectRecord(record.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <div className="employee-cell">
                      <strong>{getStaffName(record.staff_id)}</strong>
                      <span className="emp-id">EMP-{record.staff_id.toString().padStart(4, '0')}</span>
                    </div>
                  </td>
                  <td>
                    <div className="date-cell">
                      {record.attendance_date ? record.attendance_date.split('T')[0] : "N/A"}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${record.status}`}>
                      {record.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="time-cell">
                      {record.check_in_time ? (
                        <><Clock size={14} className="text-gray" /> {formatTimeDisplay(record.check_in_time)}</>
                      ) : (<span className="text-gray">--:--</span>)}
                    </div>
                  </td>
                  <td>
                    <div className="time-cell">
                      {record.check_out_time ? (
                        <><Clock size={14} className="text-gray" /> {formatTimeDisplay(record.check_out_time)}</>
                      ) : (<span className="text-gray">--:--</span>)}
                    </div>
                  </td>
                  <td className="actions-cell text-right">
                    <button className="action-btn delete-btn" title="Delete Attendance" onClick={() => handleDeleteAttendance(record.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 3: PERSON-WISE SUMMARY
  // -------------------------------------------------------------
  const getEmployeeMonthData = () => {
    if (!selectedEmployee) return { stats: {}, days: [], balance: 0 };
    
    const days = getDaysInMonth(summaryMonth);
    const { finalBalance, monthStatuses } = simulateStaffUpToMonth(selectedEmployee, summaryMonth);

    let present = 0, absent = 0, halfDay = 0, leave = 0;

    const daysData = days.map((dateStr) => {
      const found = monthStatuses.find(s => s.date === dateStr);
      const st = found ? found.status : '-';

      let effectiveRecord = null;
      if (st === 'present') { present++; effectiveRecord = { status: 'present' }; }
      else if (st === 'half-day') { halfDay++; effectiveRecord = { status: 'half-day' }; }
      else if (st === 'on-leave') { leave++; effectiveRecord = { status: 'on-leave' }; }
      else if (st === 'off-day') { leave++; effectiveRecord = { status: 'off-day', remarks: 'Auto-allocated weekly off' }; }
      else if (st === 'absent') { absent++; effectiveRecord = { status: 'absent', remarks: 'Unexcused absence' }; }

      return { date: dateStr, record: effectiveRecord };
    });

    return {
      stats: { present, absent, halfDay, leave },
      days: daysData,
      balance: finalBalance
    };
  };

  const { stats: empStats, days: empDays, balance: empBalance } = getEmployeeMonthData();

  const isGridLocked = goLiveMonth && gridMonth < goLiveMonth;
  const isSummaryLocked = goLiveMonth && summaryMonth < goLiveMonth;

  return (
    <div className="attendance-page">
      
      <PortalHeader 
        title="Staff Attendance"
        kicker="HUMAN RESOURCES"
        description="Monitor daily presence, auto-sync leave approvals, and view monthly reports."
        icon={CalendarCheck}
        backPath="/staff"
        rightAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="att-add-btn" style={{ backgroundColor: '#4f46e5' }} onClick={() => setIsBulkModalOpen(true)}>
              <Layers size={18} /> Range Bulk Mark
            </button>
            <button className="att-add-btn" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> Manual Entry
            </button>
          </div>
        }
      />

      {/* --- REUSABLE STATS GRID (TODAY'S OVERVIEW) --- */}
      <div className="att-stats-grid">
        <StatCard
          title="Total Active Staff"
          value={todayStats.total}
          Icon={Users}
          colorTheme="blue"
        />
        <StatCard
          title="Present Today"
          value={todayStats.present}
          Icon={CheckCircle2}
          colorTheme="green"
        />
        <StatCard
          title="On Leave / Off"
          value={todayStats.onLeave}
          Icon={CalendarHeart}
          colorTheme="purple"
        />
        <StatCard
          title="Absent Today"
          value={todayStats.absent}
          Icon={XCircle}
          colorTheme="red"
        />
      </div>
      {/* --------------------------- */}

      {/* TABS NAVIGATION */}
      <div className="att-tabs">
        <button 
          className={`tab-btn ${activeTab === 'monthly-grid' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('monthly-grid'); setSelectedEmployee(null); setSelectedRecords([]); }}
        >
          Monthly Grid
        </button>
        <button 
          className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('daily'); setSelectedEmployee(null); setSelectedRecords([]); }}
        >
          Daily View
        </button>
        <button 
          className={`tab-btn ${activeTab === 'person-wise' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('person-wise'); setSelectedRecords([]); }}
        >
          Person-Wise Report
        </button>
        <button 
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('list'); setSelectedEmployee(null); setSelectedRecords([]); }}
        >
          List View
        </button>
      </div>

      {/* TAB 1: MONTHLY GRID VIEW */}
      {activeTab === 'monthly-grid' && (
        <>
          <div className="att-controls" style={{ justifyContent: 'space-between' }}>
            <div className="att-filter-group">
              <CalendarDays size={18} className="filter-icon" />
              <input 
                type="month" 
                className="att-month-picker"
                value={gridMonth}
                min={goLiveMonth || ""}
                onChange={(e) => setGridMonth(e.target.value)}
              />
            </div>
            
            <div className="grid-legend">
              <span className="legend-item"><span className="legend-box lb-p">P</span> Present</span>
              <span className="legend-item"><span className="legend-box lb-a">A</span> Absent</span>
              <span className="legend-item"><span className="legend-box lb-h">H</span> Half Day</span>
              <span className="legend-item"><span className="legend-box lb-o">O</span> Weekly Off</span>
              <span className="legend-item"><span className="legend-box lb-l">L</span> On Leave</span>
            </div>
          </div>

          {isGridLocked ? (
            <div className="att-lockout-banner">
              <Lock size={48} color="#dc2626" style={{ marginBottom: '16px' }} />
              <h2>Restricted Period (Pre-Go-Live)</h2>
              <p>
                Digital attendance tracking for this property officially begins on <strong>{goLiveDate}</strong>. You cannot view or modify attendance records prior to this date.
              </p>
            </div>
          ) : (
            <div className="att-table-container grid-table-wrapper">
              {isLoading ? (
                 <div className="empty-state">Loading grid data...</div>
              ) : (
                <table className="att-grid-table">
                  <thead>
                    <tr>
                      <th className="sticky-col header-sticky">Employee Name</th>
                      {gridDaysList.map(d => (
                        <th key={d} className="grid-day-header">{parseInt(d.split('-')[2], 10)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridData.length === 0 ? (
                      <tr>
                        <td colSpan={gridDaysList.length + 1} className="empty-state">No active employees found.</td>
                      </tr>
                    ) : (
                      gridData.map(row => (
                        <tr key={row.staff.id}>
                          <td className="sticky-col body-sticky">
                            <div className="grid-emp-name">{row.staff.full_name || "Unknown"}</div>
                            
                            <div className="grid-emp-summary">
                              <span className="emp-sum-item">
                                Present: <strong>{row.monthPresentCount}</strong>
                              </span>
                              <span className="emp-sum-item">
                                Offs Left: <strong style={{ color: row.weeklyOffsLeft === 0 ? '#16a34a' : '#0f172a' }}>{row.weeklyOffsLeft}</strong>
                              </span>
                            </div>

                          </td>
                          {row.days.map((status, index) => (
                            <td key={index} className="grid-cell-wrapper">
                              <span className={`grid-cell-box gc-${status}`}>
                                {status}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: DAILY VIEW */}
      {activeTab === 'daily' && (
        <>
          <div className="att-controls" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="att-filter-group">
                <CalendarCheck size={18} className="filter-icon" />
                <input 
                  type="date" 
                  className="att-date-picker"
                  value={dailyDateFilter}
                  min={goLiveDate ? goLiveDate.split('T')[0] : ""}
                  onChange={(e) => setDailyDateFilter(e.target.value)}
                />
              </div>
              {dailyDateFilter === todayDate && <span className="today-badge">Today</span>}
            </div>

            {selectedRecords.length > 0 && (
              <button 
                onClick={handleBulkDelete} 
                disabled={isSubmitting}
                style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
              >
                <Trash2 size={16} /> Delete {selectedRecords.length} Selected
              </button>
            )}
          </div>
          {renderTable(dailyRecords, "No attendance records found for this specific date.")}
        </>
      )}

      {/* TAB 3: PERSON-WISE SUMMARY */}
      {activeTab === 'person-wise' && (
        <div className="person-wise-container">
          {!selectedEmployee ? (
            <div className="staff-tiles-grid">
              {staffList.map(staff => (
                <div key={staff.id} className="staff-tile" onClick={() => setSelectedEmployee(staff)}>
                  <div className="staff-tile-avatar">
                    <User size={24} />
                  </div>
                  <div className="staff-tile-info">
                    <h3>{staff.full_name || "Unknown"}</h3>
                    <p>EMP-{staff.id.toString().padStart(4, '0')} • {staff.designation || "Staff"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="employee-summary-view">
              <div className="summary-header">
                <button className="back-to-grid-btn" onClick={() => setSelectedEmployee(null)}>
                  <ArrowLeft size={16} /> Back to Staff Grid
                </button>
                <div className="summary-profile">
                  <h2>{selectedEmployee.full_name || "Unknown"}</h2>
                  <span>EMP-{selectedEmployee.id.toString().padStart(4, '0')}</span>
                </div>
                <div className="month-picker-container">
                  <input 
                    type="month" 
                    className="att-month-picker"
                    value={summaryMonth}
                    min={goLiveMonth || ""}
                    onChange={(e) => setSummaryMonth(e.target.value)}
                  />
                </div>
              </div>

              {isSummaryLocked ? (
                <div className="att-lockout-banner">
                  <Lock size={48} color="#dc2626" style={{ marginBottom: '16px' }} />
                  <h2>Restricted Period (Pre-Go-Live)</h2>
                  <p>
                    Digital tracking for this employee officially begins on <strong>{goLiveDate}</strong>.
                  </p>
                </div>
              ) : (
                <>
                  {/* --- REUSABLE STATS GRID (PERSON-WISE SUMMARY) --- */}
                  <div className="att-stats-grid">
                    <StatCard
                      title="Present (Month)"
                      value={empStats.present}
                      Icon={CheckCircle2}
                      colorTheme="green"
                    />
                    <StatCard
                      title="Absent (Month)"
                      value={empStats.absent}
                      Icon={XCircle}
                      colorTheme="red"
                    />
                    <StatCard
                      title="Weekly Offs Left (Total)"
                      value={empBalance}
                      Icon={CalendarHeart}
                      colorTheme="purple"
                    />
                    <StatCard
                      title="On Leave (Month)"
                      value={empStats.leave}
                      Icon={Coffee}
                      colorTheme="orange"
                    />
                  </div>
                  {/* --------------------------- */}

                  <div className="daily-cards-grid">
                    {empDays.map(({ date, record }) => {
                      const dayNum = parseInt(date.split('-')[2], 10);
                      const dateObj = new Date(date);
                      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                      
                      return (
                        <div key={date} className={`daily-card ${record ? record.status : 'no-record'}`}>
                          <div className="daily-card-date">
                            <span className="day-name">{dayName}</span>
                            <span className="day-num">{dayNum}</span>
                          </div>
                          <div className="daily-card-info">
                            {record ? (
                              <>
                                <span className="daily-status">{record.status.replace('-', ' ')}</span>
                                {(record.status === 'present' || record.status === 'half-day') && record.check_in_time && (
                                  <span className="daily-time">
                                    In: {formatTimeDisplay(record.check_in_time)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="daily-status empty">No Record</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIST VIEW */}
      {activeTab === 'list' && (
        <>
          <div className="att-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="att-filter-group">
                <CalendarCheck size={18} className="filter-icon" />
                <input 
                  type="date" 
                  className="att-date-picker"
                  value={allDateFilter}
                  min={goLiveDate ? goLiveDate.split('T')[0] : ""}
                  onChange={(e) => setAllDateFilter(e.target.value)}
                />
                {allDateFilter && (
                  <button className="clear-date-btn" onClick={() => setAllDateFilter("")}><X size={14} /></button>
                )}
              </div>

              <select className="att-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
                <option value="on-leave">On Leave</option>
                <option value="off-day">Weekly Off</option>
              </select>
            </div>

            {selectedRecords.length > 0 && (
              <button 
                onClick={handleBulkDelete} 
                disabled={isSubmitting}
                style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
              >
                <Trash2 size={16} /> Delete {selectedRecords.length} Selected
              </button>
            )}
          </div>
          {renderTable(allFilteredRecords, "No attendance records match your filters.")}
        </>
      )}

      {/* MANUAL ENTRY MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Mark Manual Attendance</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddAttendance}>
              <div className="modal-body">
                {errorMessage && <div className="modal-error-message">{errorMessage}</div>}
                
                <div className="form-group">
                  <label>Select Employee</label>
                  <select name="staff_id" required value={formData.staff_id} onChange={handleInputChange}>
                    <option value="">-- Choose Staff --</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name || "Unknown"} (EMP-{staff.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input 
                      type="date" 
                      name="attendance_date" 
                      required 
                      min={goLiveDate ? goLiveDate.split('T')[0] : ""}
                      value={formData.attendance_date} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={formData.status} onChange={handleInputChange}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="half-day">Half Day</option>
                      <option value="on-leave">On Leave</option>
                      <option value="off-day">Weekly Off</option>
                    </select>
                  </div>
                </div>

                {(formData.status === "present" || formData.status === "half-day") && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Check In Time</label>
                      <input type="time" name="check_in_time" value={formData.check_in_time} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                      <label>Check Out Time</label>
                      <input type="time" name="check_out_time" value={formData.check_out_time} onChange={handleInputChange} />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Remarks / Reason</label>
                  <input type="text" name="remarks" placeholder="Optional notes" value={formData.remarks} onChange={handleInputChange} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RANGE BULK MARK MODAL --- */}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Bulk Mark Attendance (Date Range)</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleBulkAttendance}>
              <div className="modal-body">
                {errorMessage && <div className="modal-error-message">{errorMessage}</div>}
                
                <div className="form-group">
                  <label>Select Employee</label>
                  <select 
                    required 
                    value={bulkData.staff_id} 
                    onChange={(e) => setBulkData({ ...bulkData, staff_id: e.target.value })}
                  >
                    <option value="">-- Choose Staff --</option>
                    {staffList.filter(s => s.status === 'active').map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name || "Unknown"} (EMP-{staff.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input 
                      type="date" 
                      required 
                      min={goLiveDate ? goLiveDate.split('T')[0] : ""}
                      value={bulkData.start_date} 
                      onChange={(e) => setBulkData({ ...bulkData, start_date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input 
                      type="date" 
                      required 
                      min={goLiveDate ? goLiveDate.split('T')[0] : ""}
                      value={bulkData.end_date} 
                      onChange={(e) => setBulkData({ ...bulkData, end_date: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Status to Apply for Range</label>
                    <select 
                      value={bulkData.status} 
                      onChange={(e) => setBulkData({ ...bulkData, status: e.target.value })}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="half-day">Half Day</option>
                      <option value="on-leave">On Leave</option>
                      <option value="off-day">Weekly Off</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Testing Note / Remarks</label>
                    <input 
                      type="text" 
                      value={bulkData.remarks || "Testing Note"} 
                      onChange={(e) => setBulkData({ ...bulkData, remarks: e.target.value })} 
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSubmitting} style={{ backgroundColor: '#4f46e5' }}>
                  {isSubmitting ? "Generating range..." : "Generate Attendance Range"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}