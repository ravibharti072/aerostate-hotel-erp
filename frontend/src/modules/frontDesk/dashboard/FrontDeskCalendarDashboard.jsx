import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  LogIn,
  LogOut,
  BedDouble,
  Users,
  Hotel,
  ShieldAlert,
  ArrowRight,
  ClipboardList,
  UserCheck,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard } from "@components";
import styles from "./frontDeskCalendar.module.css";

import {
  TapeChartCalendar,
  LiveRoomStatusGrid,
  MovementsSection,
  ArrivalReadinessCard,
  FrontDeskWorkQueueCard,
  ReservationChannelsCard,
  FrontDeskFinancialSummary,
  GuestRequestsCard,
  RecentActivityCard,
  BookingDetailModal,
  QuickBookingModal,
  MovementsDirectoryModal,
  CheckInPaymentModal,
} from "./components";

export default function FrontDeskCalendarDashboard({ isEmbedded = false }) {
  const navigate = useNavigate();
  const { user, goLiveDate } = useAuth();
  const scrollContainerRef = useRef(null);

  // Core Data States
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Timeline Navigator States - Defaults strictly to Today
  const now = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [visibleStartYear, setVisibleStartYear] = useState(now.getFullYear() - 1);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roomStatusFilter, setRoomStatusFilter] = useState("all");

  // Category Collapsed Map
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Movements List View Mode & Modal States
  const [arrivalsViewMode, setArrivalsViewMode] = useState("today"); // "today" | "all"
  const [movementsModalType, setMovementsModalType] = useState(null); // null | "arrivals" | "departures" | "inHouse" | "all"

  // Modals
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [quickBookingModalOpen, setQuickBookingModalOpen] = useState(false);
  const [quickBookingData, setQuickBookingData] = useState({
    room_id: "",
    checkin_date: "",
    checkout_date: "",
    full_name: "",
    phone: "",
    room_rate: 5000,
    advance_paid: 0,
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [checkInPaymentBooking, setCheckInPaymentBooking] = useState(null);

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
  };

  const filterByHotel = (list) => {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;
    return list.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId));
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      // Automatically sweep overdue un-arrived reservations into No-Show and release rooms
      await api.post("/bookings/process-no-shows").catch(() => {});

      const [roomsRes, bookingsRes, guestsRes, chargesRes] = await Promise.allSettled([
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/extra-charges/").catch(() => ({ data: [] })),
      ]);

      if (roomsRes.status === "fulfilled") {
        setRooms(filterByHotel(normalizeList(roomsRes.value.data, "rooms")));
      }
      if (bookingsRes.status === "fulfilled") {
        setBookings(filterByHotel(normalizeList(bookingsRes.value.data, "bookings")));
      }
      if (guestsRes.status === "fulfilled") {
        setGuests(filterByHotel(normalizeList(guestsRes.value.data, "guests")));
      }
      if (chargesRes.status === "fulfilled") {
        setExtraCharges(normalizeList(chargesRes.value.data, "charges"));
      }
    } catch (err) {
      console.error("Calendar load error:", err);
      setError("Failed to load front desk data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter out any bookings before the property activation date (goLiveDate)
  const activeBookings = useMemo(() => {
    if (!goLiveDate) return bookings;
    return bookings.filter((b) => {
      const checkin = String(b.checkin_date || "").substring(0, 10);
      const checkout = String(b.checkout_date || "").substring(0, 10);
      // Strictly ignore any bookings completely completed prior to goLiveDate
      if (checkout && checkout < goLiveDate) return false;
      if (checkin && checkin < goLiveDate && (!checkout || checkout < goLiveDate)) return false;
      return true;
    });
  }, [bookings, goLiveDate]);

  // Compute Days in Selected Month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const monthDays = useMemo(() => {
    const list = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(selectedYear, selectedMonth, day);
      const dayName = dt.toLocaleDateString("en-US", { weekday: "short" });
      const isToday =
        now.getFullYear() === selectedYear &&
        now.getMonth() === selectedMonth &&
        now.getDate() === day;

      const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;

      // Check if this specific day is before the activation date
      const isLocked = Boolean(goLiveDate && dateKey < goLiveDate);

      list.push({
        day,
        dayName,
        isToday,
        dateKey,
        isLocked,
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth, goLiveDate]);

  // Check if entire selected month is before activation date
  const isMonthBeforeGoLive = useMemo(() => {
    if (!goLiveDate) return false;
    const selectedMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    const goLiveMonthStr = goLiveDate.slice(0, 7);
    return selectedMonthStr < goLiveMonthStr;
  }, [selectedYear, selectedMonth, goLiveDate]);

  // Guest lookup map
  const guestMap = useMemo(() => {
    const m = {};
    guests.forEach((g) => {
      m[g.id] = g;
    });
    return m;
  }, [guests]);

  // Rooms grouped by Category
  const categorizedRooms = useMemo(() => {
    let filtered = [...rooms];
    if (roomTypeFilter !== "all") {
      filtered = filtered.filter((r) => r.room_type === roomTypeFilter);
    }

    const groups = {};
    filtered.forEach((r) => {
      const cat = r.room_type || "Standard";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });

    return groups;
  }, [rooms, roomTypeFilter]);

  // Overall Room Status Counts for the Filter Strip
  const statusCounts = useMemo(() => {
    const counts = {
      all: rooms.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      maintenance: 0,
    };

    rooms.forEach((r) => {
      const s = String(r.status || "available").toLowerCase();
      if (s === "available") counts.available += 1;
      else if (s === "occupied") counts.occupied += 1;
      else if (s === "reserved") counts.reserved += 1;
      else if (s === "cleaning" || s === "dirty") counts.cleaning += 1;
      else if (s === "maintenance" || s === "out-of-service") counts.maintenance += 1;
    });

    return counts;
  }, [rooms]);

  // Filtered rooms for the compact room status grid (Unified, No Floor Grouping)
  const filteredStatusRooms = useMemo(() => {
    let list = [...rooms].sort((a, b) =>
      String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })
    );

    if (roomStatusFilter !== "all") {
      list = list.filter((r) => {
        const s = String(r.status || "available").toLowerCase();
        if (roomStatusFilter === "cleaning") return s === "cleaning" || s === "dirty";
        if (roomStatusFilter === "maintenance") return s === "maintenance" || s === "out-of-service";
        return s === roomStatusFilter;
      });
    }

    return list;
  }, [rooms, roomStatusFilter]);

  // Comprehensive Reservations Breakdown Statistics (Status, Source & Financials)
  const reservationBreakdown = useMemo(() => {
    const total = activeBookings.length || 0;

    const confirmed = activeBookings.filter(
      (b) => String(b.status || "").toLowerCase() === "confirmed"
    ).length;
    const checkedIn = activeBookings.filter(
      (b) => String(b.status || "").toLowerCase() === "checked-in"
    ).length;
    const checkedOut = activeBookings.filter(
      (b) => String(b.status || "").toLowerCase() === "checked-out"
    ).length;
    const cancelled = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "cancelled" || s === "canceled" || s === "no-show";
    }).length;
    const otherStatus = Math.max(0, total - (confirmed + checkedIn + checkedOut + cancelled));

    const statusSlices = [
      { key: "confirmed", label: "Confirmed", count: confirmed, color: "#3b82f6" },
      { key: "checkedIn", label: "Checked In", count: checkedIn, color: "#10b981" },
      { key: "checkedOut", label: "Checked Out", count: checkedOut, color: "#8b5cf6" },
      { key: "cancelled", label: "Cancelled", count: cancelled, color: "#ef4444" },
    ];
    if (otherStatus > 0) {
      statusSlices.push({ key: "other", label: "Other", count: otherStatus, color: "#94a3b8" });
    }

    // Source Distribution
    let walkInCount = 0;
    let agentCount = 0;
    let onlineCount = 0;
    let otherSourceCount = 0;

    activeBookings.forEach((b) => {
      const src = String(b.booking_source || "").toLowerCase();
      if (src.includes("walk")) {
        walkInCount += 1;
      } else if (
        src.includes("agent") ||
        src.includes("ota") ||
        String(b.guest_type || "").toLowerCase().includes("corp")
      ) {
        agentCount += 1;
      } else if (src.includes("web") || src.includes("direct") || src.includes("online")) {
        onlineCount += 1;
      } else {
        otherSourceCount += 1;
      }
    });

    const sources = [
      { key: "walkin", label: "Walk-in", count: walkInCount, color: "#f59e0b" },
      { key: "agent", label: "Agent / Corporate", count: agentCount, color: "#8b5cf6" },
      { key: "online", label: "Website / Direct", count: onlineCount, color: "#0ea5e9" },
    ];
    if (otherSourceCount > 0) {
      sources.push({ key: "other", label: "Other / Phone", count: otherSourceCount, color: "#64748b" });
    }

    // Financial Totals
    const totalAmount = activeBookings.reduce(
      (sum, b) => sum + (Number(b.total_amount) || Number(b.room_rate) || 0),
      0
    );
    const advancePaid = activeBookings.reduce(
      (sum, b) => sum + (Number(b.advance_paid) || 0),
      0
    );
    const pendingBalance = Math.max(0, totalAmount - advancePaid);

    return {
      total,
      statusSlices,
      sources,
      financials: {
        totalAmount,
        advancePaid,
        pendingBalance,
      },
    };
  }, [activeBookings]);

  // Daily Movements 3-Column Lists (Today Arrivals, Today Departures, In-House Guests)
  const dailyMovements = useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    const todayArrivalsList = activeBookings.filter((b) => {
      const isToday = String(b.checkin_date || "").substring(0, 10) === todayStr;
      const s = String(b.status || "").toLowerCase();
      return isToday && s !== "cancelled" && s !== "canceled" && s !== "checked-out";
    });

    const allComingList = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return (s === "confirmed" || s === "booked" || s === "reserved") && s !== "cancelled" && s !== "checked-out";
    });

    const todayDeparturesList = activeBookings.filter((b) => {
      const isToday = String(b.checkout_date || "").substring(0, 10) === todayStr;
      const s = String(b.status || "").toLowerCase();
      return isToday && s !== "cancelled" && s !== "canceled";
    });

    const allDeparturesList = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "checked-out";
    });

    let inHouseList = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "checked-in" || s === "in-house";
    });

    let arrivals = arrivalsViewMode === "all" ? allComingList : todayArrivalsList;
    let departures = todayDeparturesList;
    let inHouse = inHouseList;

    if (movementSearch.trim()) {
      const q = movementSearch.toLowerCase();
      const match = (b) => {
        const g = guestMap[b.guest_id];
        const r = rooms.find((rm) => rm.id === b.room_id);
        const gName = (g?.full_name || "").toLowerCase();
        const rNum = String(r?.room_number || "").toLowerCase();
        const code = (b.reservation_code || "").toLowerCase();
        return gName.includes(q) || rNum.includes(q) || code.includes(q);
      };
      arrivals = arrivals.filter(match);
      departures = departures.filter(match);
      inHouse = inHouse.filter(match);
    }

    return {
      todayArrivalsCount: todayArrivalsList.length,
      allComingCount: allComingList.length,
      todayDeparturesCount: todayDeparturesList.length,
      allDeparturesCount: allDeparturesList.length,
      inHouseCount: inHouseList.length,
      arrivals,
      departures,
      inHouse,
    };
  }, [activeBookings, rooms, guestMap, movementSearch, now, arrivalsViewMode]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    const arrivals = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return String(b.checkin_date).substring(0, 10) === todayStr && s !== "cancelled" && s !== "checked-out";
    }).length;

    const departures = activeBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return String(b.checkout_date).substring(0, 10) === todayStr && s !== "cancelled";
    }).length;

    const inHouse = activeBookings.filter(
      (b) => String(b.status || "").toLowerCase() === "checked-in"
    ).length;

    const available = rooms.filter(
      (r) => String(r.status || "").toLowerCase() === "available"
    ).length;

    return {
      arrivals,
      departures,
      inHouse,
      available,
    };
  }, [activeBookings, rooms, now]);

  // Jump to Today
  const handleJumpToToday = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    if (scrollContainerRef.current) {
      const dayWidth = 58;
      const todayIndex = now.getDate() - 1;
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, todayIndex * dayWidth - 150),
        behavior: "smooth",
      });
    }
  };

  // Automatically scroll to today on load or when viewing current month & year
  useEffect(() => {
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          const dayWidth = 58;
          const todayIndex = now.getDate() - 1;
          scrollContainerRef.current.scrollTo({
            left: Math.max(0, todayIndex * dayWidth - 150),
            behavior: "smooth",
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedYear, selectedMonth, now]);

  // Toggle Category Collapsed
  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Check-In Action: Opens Payment & Stay Settlement Modal before checking in
  const handleCheckIn = (bookingId) => {
    const b = activeBookings.find((item) => item.id === bookingId) || bookings.find((item) => item.id === bookingId);
    if (b) {
      setCheckInPaymentBooking(b);
      setSelectedBooking(null);
      setMovementsModalType(null);
    } else {
      alert("Booking record not found.");
    }
  };

  // Check-Out Action
  const handleCheckOut = async (bookingId) => {
    try {
      setActionLoading(true);
      await api.put(`/bookings/${bookingId}`, { status: "checked-out" });
      await loadData();
      setSelectedBooking(null);
    } catch (err) {
      console.error("Check-out error:", err);
      alert("Failed to check out guest.");
    } finally {
      setActionLoading(false);
    }
  };

  // No-Show Action
  const handleNoShow = async (bookingId) => {
    if (
      !window.confirm(
        "Are you sure you want to mark this reservation as No-Show?\nThe reserved room will be released immediately back to available inventory."
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/bookings/${bookingId}/no-show`);
      await loadData();
      setSelectedBooking(null);
    } catch (err) {
      console.error("No-Show error:", err);
      alert(err.response?.data?.detail || "Failed to mark as No-Show.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Quick Booking Submit
  const handleCreateQuickBooking = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        hotel_id: getLoggedInHotelId() || 1,
        room_id: Number(quickBookingData.room_id),
        full_name: quickBookingData.full_name,
        phone: quickBookingData.phone,
        checkin_date: new Date(quickBookingData.checkin_date).toISOString(),
        checkout_date: new Date(quickBookingData.checkout_date).toISOString(),
        room_rate: Number(quickBookingData.room_rate),
        advance_paid: Number(quickBookingData.advance_paid) || 0,
        total_amount:
          Number(quickBookingData.room_rate) *
          Math.max(
            1,
            Math.round(
              (new Date(quickBookingData.checkout_date) - new Date(quickBookingData.checkin_date)) /
                (1000 * 60 * 60 * 24)
            ) || 1
          ),
        booking_source: "walk-in",
        status: "confirmed",
      };

      await api.post("/bookings/walk-in", payload);
      await loadData();
      setQuickBookingModalOpen(false);
    } catch (err) {
      console.error("Failed to create walk-in:", err);
      alert("Failed to create booking. Please check date requirements.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open empty cell to book
  const handleCellClick = (room, dayObj) => {
    if (dayObj.isLocked) {
      alert(`Cannot book prior to property activation date (${goLiveDate}).`);
      return;
    }

    const nextDay = new Date(selectedYear, selectedMonth, (dayObj.day || 1) + 2);
    const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(nextDay.getDate()).padStart(2, "0")}T11:00`;

    setQuickBookingData({
      room_id: room.id,
      checkin_date: `${dayObj.dateKey || `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`}T12:00`,
      checkout_date: nextDayStr,
      full_name: "",
      phone: "",
      room_rate: room.base_price || 5000,
      advance_paid: room.base_price || 0,
    });
    setQuickBookingModalOpen(true);
  };

  return (
    <div
      className={`${styles["calendar-page-container"]} ${
        isEmbedded ? styles["embedded-view"] : ""
      }`}
    >
      {/* -------------------------------------------------------------
          1. HEADER & QUICK ACTIONS
          ------------------------------------------------------------- */}
      <PortalHeader
        title="Front Desk"
        kicker="FRONT DESK OPERATIONS"
        description="Interactive room tape chart, live reservations, and occupancy timeline"
        icon={Hotel}
        isDashboard={true}
        showBack={false}
        rightAction={
          <div className={styles["header-actions-group"]}>
            <button
              type="button"
              onClick={() => navigate("/check-in-out")}
              className={styles["secondary-header-btn"]}
            >
              <ClipboardList size={15} />
              Check-In / Out Desk
            </button>
            <button
              type="button"
              onClick={() => navigate("/guests")}
              className={styles["secondary-header-btn"]}
            >
              <UserCheck size={15} />
              Guest Directory
            </button>
            <button
              type="button"
              onClick={() => {
                if (rooms.length > 0) {
                  const todayDayObj = monthDays.find((d) => d.isToday) || monthDays[0];
                  const readyRoom = rooms.find((r) => String(r.status || "").toLowerCase() === "available") || rooms[0];
                  handleCellClick(readyRoom, todayDayObj);
                } else {
                  navigate("/bookings");
                }
              }}
              className={styles["add-booking-btn"]}
            >
              <Plus size={16} />
              New Walk-in / Booking
            </button>
          </div>
        }
      />

      {/* -------------------------------------------------------------
          SYSTEM ACTIVATION DATE NOTICE (If viewing before goLiveDate)
          ------------------------------------------------------------- */}
      {goLiveDate && isMonthBeforeGoLive && (
        <div className={styles["go-live-notice-banner"]}>
          <ShieldAlert size={18} />
          <span>
            System Go-Live Date: <strong>{goLiveDate}</strong>. Digital front desk records prior to
            this activation date are archived and not displayed.
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------
          2. CONSISTENT REUSABLE STAT CARDS
          ------------------------------------------------------------- */}
      <div className={styles["stats-grid"]}>
        <StatCard
          title="Today's Arrivals"
          value={`${kpis.arrivals} Check-ins`}
          Icon={LogIn}
          colorTheme="amber"
        />
        <StatCard
          title="Today's Departures"
          value={`${kpis.departures} Check-outs`}
          Icon={LogOut}
          colorTheme="blue"
        />
        <StatCard
          title="Available Rooms"
          value={`${kpis.available} Ready`}
          Icon={BedDouble}
          colorTheme="green"
        />
        <StatCard
          title="In-House Guests"
          value={`${kpis.inHouse} Active Stays`}
          Icon={Users}
          colorTheme="purple"
        />
      </div>

      {/* -------------------------------------------------------------
          3. ROOM CALENDAR / TAPE CHART (STRICTLY PRESERVED WORKSPACE)
          ------------------------------------------------------------- */}
      <TapeChartCalendar
        rooms={rooms}
        activeBookings={activeBookings}
        guestMap={guestMap}
        categorizedRooms={categorizedRooms}
        collapsedCategories={collapsedCategories}
        toggleCategory={toggleCategory}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        visibleStartYear={visibleStartYear}
        setVisibleStartYear={setVisibleStartYear}
        monthDays={monthDays}
        daysInMonth={daysInMonth}
        goLiveDate={goLiveDate}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        roomTypeFilter={roomTypeFilter}
        setRoomTypeFilter={setRoomTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        scrollContainerRef={scrollContainerRef}
        handleJumpToToday={handleJumpToToday}
        handleCellClick={handleCellClick}
        setSelectedBooking={setSelectedBooking}
      />

      {/* -------------------------------------------------------------
          4. LIVE ROOM STATUS SECTION (Unified, Compact Tiles)
          ------------------------------------------------------------- */}
      <LiveRoomStatusGrid
        statusCounts={statusCounts}
        roomStatusFilter={roomStatusFilter}
        setRoomStatusFilter={setRoomStatusFilter}
        filteredStatusRooms={filteredStatusRooms}
        handleCellClick={handleCellClick}
        monthDays={monthDays}
      />

      {/* -------------------------------------------------------------
          5. OPERATIONAL MOVEMENTS (Balanced 3-Column Section)
          ------------------------------------------------------------- */}
      <MovementsSection
        dailyMovements={dailyMovements}
        guestMap={guestMap}
        rooms={rooms}
        movementSearch={movementSearch}
        setMovementSearch={setMovementSearch}
        arrivalsViewMode={arrivalsViewMode}
        setArrivalsViewMode={setArrivalsViewMode}
        setSelectedBooking={setSelectedBooking}
        setMovementsModalType={setMovementsModalType}
        handleCheckIn={handleCheckIn}
        handleCheckOut={handleCheckOut}
      />

      {/* -------------------------------------------------------------
          6. FRONT DESK ACTION CENTER (Arrival Readiness & Work Queue)
          ------------------------------------------------------------- */}
      <div className={styles["two-col-grid"]}>
        <ArrivalReadinessCard
          activeBookings={activeBookings}
          rooms={rooms}
          guestMap={guestMap}
          handleCheckIn={handleCheckIn}
          setSelectedBooking={setSelectedBooking}
        />
        <FrontDeskWorkQueueCard
          activeBookings={activeBookings}
          rooms={rooms}
          guestMap={guestMap}
          handleCheckOut={handleCheckOut}
          setSelectedBooking={setSelectedBooking}
        />
      </div>

      {/* -------------------------------------------------------------
          7. PORTFOLIO & SERVICES (Donut / Channels + Guest Requests)
          ------------------------------------------------------------- */}
      <div className={styles["two-col-grid"]}>
        <ReservationChannelsCard reservationBreakdown={reservationBreakdown} />
        <GuestRequestsCard
          extraCharges={extraCharges}
          rooms={rooms}
          bookings={activeBookings}
          guestMap={guestMap}
        />
      </div>

      {/* -------------------------------------------------------------
          8. FINANCIAL CASHFLOW & RECENT ACTIVITY AUDIT LOG
          ------------------------------------------------------------- */}
      <div className={styles["two-col-grid"]}>
        <FrontDeskFinancialSummary
          reservationBreakdown={reservationBreakdown}
          activeBookings={activeBookings}
        />
        <RecentActivityCard
          bookings={activeBookings}
          guestMap={guestMap}
          rooms={rooms}
        />
      </div>

      {/* -------------------------------------------------------------
          9. MODALS
          ------------------------------------------------------------- */}
      <BookingDetailModal
        selectedBooking={selectedBooking}
        setSelectedBooking={setSelectedBooking}
        actionLoading={actionLoading}
        handleCheckIn={handleCheckIn}
        handleCheckOut={handleCheckOut}
        handleNoShow={handleNoShow}
      />

      <QuickBookingModal
        isOpen={quickBookingModalOpen}
        onClose={() => setQuickBookingModalOpen(false)}
        rooms={rooms}
        quickBookingData={quickBookingData}
        setQuickBookingData={setQuickBookingData}
        handleCreateQuickBooking={handleCreateQuickBooking}
        actionLoading={actionLoading}
      />

      <MovementsDirectoryModal
        movementsModalType={movementsModalType}
        setMovementsModalType={setMovementsModalType}
        dailyMovements={dailyMovements}
        activeBookings={activeBookings}
        guestMap={guestMap}
        rooms={rooms}
        now={now}
        setSelectedBooking={setSelectedBooking}
        handleCheckIn={handleCheckIn}
        handleCheckOut={handleCheckOut}
      />

      <CheckInPaymentModal
        isOpen={Boolean(checkInPaymentBooking)}
        onClose={() => setCheckInPaymentBooking(null)}
        booking={checkInPaymentBooking}
        guest={checkInPaymentBooking ? guestMap[checkInPaymentBooking.guest_id] : null}
        room={checkInPaymentBooking ? rooms.find((r) => r.id === checkInPaymentBooking.room_id) : null}
        onSuccess={async (updatedBooking, collectedAmt, method) => {
          await loadData();
          setCheckInPaymentBooking(null);
        }}
      />
    </div>
  );
}
