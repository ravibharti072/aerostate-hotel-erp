import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Search,
  CheckCircle,
  CheckCircle2,
  Trash2,
  Edit,
  X,
  Plus,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Building,
  Eye,
  CalendarCheck,
  Globe,
  Printer,
  Calendar,
  CalendarPlus,
  IndianRupee,
  Award,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Star,
  ShieldAlert,
  Sparkles,
  Briefcase,
  Tag,
  Download,
  FileSpreadsheet,
  RotateCcw,
} from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./guests.css";

const ID_TYPES = [
  "Aadhaar Card",
  "Passport",
  "Driving License",
  "Voter ID",
  "PAN Card",
  "Government ID",
];

const VISA_TYPES = [
  "Tourist (e-Visa / Regular)",
  "Business Visa",
  "Employment Visa",
  "Conference Visa",
  "Medical / Medical Attendant",
  "Student / Research",
  "Entry (X) Visa",
  "Diplomatic / Official",
  "Transit Visa",
  "Other Visa",
];

const COMMON_PREFERENCES = [
  "High Floor",
  "Non-Smoking",
  "Away from Elevator",
  "Feather-Free Pillows",
  "Vegetarian",
  "Quiet Room",
  "Late Check-Out Preferred",
  "Extra Towels",
];

const emptyGuestForm = {
  full_name: "",
  phone: "",
  email: "",
  nationality: "Indian",
  is_international: false,
  id_type: "Aadhaar Card",
  id_number: "",
  address: "",
  // Statutory Form C / FRRO
  passport_expiry: "",
  visa_number: "",
  visa_type: "Tourist (e-Visa / Regular)",
  visa_expiry: "",
  port_of_entry: "",
  date_of_arrival: "",
  next_destination: "",
  // Operational VIP, Blacklist, Preferences & Corporate
  vip_status: "regular",
  is_blacklisted: false,
  blacklist_reason: "",
  preferences: "",
  company_name: "",
  gstin: "",
};

export default function GuestsPage() {
  const { user, hotelInfo } = useAuth();
  const navigate = useNavigate();
  const hotelId =
    user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;

  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [idTypeFilter, setIdTypeFilter] = useState("ALL");
  const [inHouseFilter, setInHouseFilter] = useState("ALL");
  const [activeSegment, setActiveSegment] = useState("ALL"); // "ALL" | "IN_HOUSE" | "VIP" | "REPEAT" | "INTERNATIONAL" | "BLACKLISTED"

  const handleResetFilters = () => {
    setSearchQuery("");
    setIdTypeFilter("ALL");
    setInHouseFilter("ALL");
    setActiveSegment("ALL");
  };

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [formData, setFormData] = useState(emptyGuestForm);

  const [selectedGuest, setSelectedGuest] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchData = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [gstRes, bkgRes, rmsRes] = await Promise.all([
        api.get(`/guests?hotel_id=${hotelId}`).catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
      ]);

      const allGuests = normalizeList(gstRes.data, "guests");
      const allBookings = normalizeList(bkgRes.data, "bookings");
      const allRooms = normalizeList(rmsRes.data, "rooms");

      setGuests(allGuests);
      setBookings(allBookings.filter((b) => !b.hotel_id || Number(b.hotel_id) === Number(hotelId)));
      setRooms(allRooms);
    } catch (err) {
      console.error("Error loading guests:", err);
      showToast("Failed to load guests data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hotelId]);

  // Helper: check if booking status is active/checked-in
  const isStatusCheckedIn = (status) => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim().replace(/_/g, "-");
    return s === "checked-in" || s === "in-house";
  };

  // Helper: extract all room IDs assigned to a reservation
  const getBookingRoomIds = (b) => {
    if (!b) return [];
    const ids = new Set();
    if (b.room_id) ids.add(Number(b.room_id));
    if (Array.isArray(b.assigned_room_ids)) {
      b.assigned_room_ids.forEach((id) => id && ids.add(Number(id)));
    } else if (typeof b.assigned_room_ids === "string" && b.assigned_room_ids.trim()) {
      try {
        const parsed = JSON.parse(b.assigned_room_ids);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => id && ids.add(Number(id)));
        }
      } catch {
        b.assigned_room_ids.split(",").forEach((s) => {
          const n = Number(s.trim());
          if (!isNaN(n) && n > 0) ids.add(n);
        });
      }
    }
    return Array.from(ids);
  };

  // Helper: format room numbers for display (e.g. Rm 101 or Rms 101, 102)
  const formatBookingRooms = (b, roomList = rooms) => {
    if (!b) return null;
    const roomIds = getBookingRoomIds(b);
    if (roomIds.length === 0) {
      if (b.room_number) return `Rm ${b.room_number}`;
      if (b.room?.room_number) return `Rm ${b.room.room_number}`;
      return null;
    }
    const roomNums = roomIds
      .map((id) => {
        const r = roomList.find((rm) => Number(rm.id) === Number(id));
        return r ? r.room_number : `#${id}`;
      })
      .filter(Boolean);
    if (roomNums.length === 0) return null;
    return roomNums.length === 1 ? `Rm ${roomNums[0]}` : `Rms ${roomNums.join(", ")}`;
  };

  // Helper: verify if a booking belongs to a guest (primary or co-guest)
  const isBookingForGuest = (b, guestOrId) => {
    if (!b || !guestOrId) return false;
    const guestId = typeof guestOrId === "object" ? guestOrId.id : guestOrId;
    const guestObj = typeof guestOrId === "object" ? guestOrId : null;

    if (guestId && Number(b.guest_id) === Number(guestId)) return true;
    if (guestId && b.guest && Number(b.guest.id) === Number(guestId)) return true;

    if (guestObj && Array.isArray(b.co_guests) && b.co_guests.length > 0) {
      const gName = (guestObj.full_name || "").toLowerCase().trim();
      const gIdNum = (guestObj.id_number || "").toLowerCase().trim();
      const gPhone = (guestObj.phone || "").replace(/\D/g, "");

      const matchedCoGuest = b.co_guests.some((cg) => {
        if (!cg) return false;
        const cgIdNum = (cg.id_number || "").toLowerCase().trim();
        if (gIdNum && cgIdNum && gIdNum === cgIdNum) return true;
        const cgName = (cg.full_name || "").toLowerCase().trim();
        if (gName && cgName && gName === cgName) return true;
        const cgPhone = (cg.phone || "").replace(/\D/g, "");
        if (gPhone && cgPhone && gPhone === cgPhone) return true;
        return false;
      });
      if (matchedCoGuest) return true;
    }
    return false;
  };

  // Get active checked-in booking for guest
  const getGuestActiveBooking = (guestOrId) => {
    return bookings.find(
      (b) => isStatusCheckedIn(b.status) && isBookingForGuest(b, guestOrId)
    );
  };

  // Check if guest is currently checked in (primary or co-guest)
  const isGuestInHouse = (guestOrId) => {
    return Boolean(getGuestActiveBooking(guestOrId));
  };

  // Get active room(s) string for an in-house guest
  const getGuestActiveRoom = (guestOrId) => {
    const activeBooking = getGuestActiveBooking(guestOrId);
    if (!activeBooking) return null;
    return formatBookingRooms(activeBooking, rooms);
  };

  // Check if active stay is as a co-guest
  const isGuestActiveCoGuest = (guestOrId) => {
    const activeBooking = getGuestActiveBooking(guestOrId);
    if (!activeBooking) return false;
    const guestId = typeof guestOrId === "object" ? guestOrId.id : guestOrId;
    return Number(activeBooking.guest_id) !== Number(guestId);
  };

  // Helper: check if guest is a foreign national requiring Form C
  const isInternationalGuest = (guest) => {
    if (!guest) return false;
    const nat = (guest.nationality || "").toLowerCase().trim();
    if (nat && nat !== "indian") return true;
    if (guest.id_type === "Passport" && nat && nat !== "indian") return true;
    if (guest.visa_number || guest.passport_expiry) return true;
    return false;
  };

  // Helper: check if statutory Form C fields are complete
  const isFormCCompliant = (guest) => {
    if (!isInternationalGuest(guest)) return true;
    const hasPassport = Boolean(guest.id_number && guest.id_number.trim());
    const hasVisa = Boolean(guest.visa_number && guest.visa_number.trim());
    const hasVisaExp = Boolean(guest.visa_expiry && guest.visa_expiry.trim());
    return hasPassport && hasVisa && hasVisaExp;
  };

  const handleOpenAdd = () => {
    setEditingGuest(null);
    setFormData(emptyGuestForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (guest) => {
    const isIntl = isInternationalGuest(guest);
    setEditingGuest(guest);
    setFormData({
      full_name: guest.full_name || "",
      phone: guest.phone || "",
      email: guest.email || "",
      nationality: guest.nationality || "Indian",
      is_international: isIntl,
      id_type: guest.id_type || (isIntl ? "Passport" : "Aadhaar Card"),
      id_number: guest.id_number || "",
      address: guest.address || "",
      passport_expiry: guest.passport_expiry || "",
      visa_number: guest.visa_number || "",
      visa_type: guest.visa_type || "Tourist (e-Visa / Regular)",
      visa_expiry: guest.visa_expiry || "",
      port_of_entry: guest.port_of_entry || "",
      date_of_arrival: guest.date_of_arrival || "",
      next_destination: guest.next_destination || "",
      vip_status: guest.vip_status || "regular",
      is_blacklisted: Boolean(guest.is_blacklisted),
      blacklist_reason: guest.blacklist_reason || "",
      preferences: guest.preferences || "",
      company_name: guest.company_name || "",
      gstin: guest.gstin || "",
    });
    setIsModalOpen(true);
  };

  const handleOpenDetails = (guest) => {
    setSelectedGuest(guest);
    setIsDetailModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.phone.trim()) {
      showToast("Guest Name and Phone number are required", "error");
      return;
    }

    const isIntl =
      formData.is_international ||
      (formData.nationality &&
        formData.nationality.toLowerCase().trim() !== "indian");

    if (isIntl) {
      if (!formData.id_number || !formData.id_number.trim()) {
        showToast("Passport Number is mandatory for international guests (Form C)", "error");
        return;
      }
      if (!formData.visa_number || !formData.visa_number.trim()) {
        showToast("Visa Number is mandatory for foreign national Form C compliance", "error");
        return;
      }
    }

    if (formData.is_blacklisted && (!formData.blacklist_reason || !formData.blacklist_reason.trim())) {
      showToast("Please specify the caution / blacklist reason for this guest profile", "error");
      return;
    }

    try {
      const payload = {
        hotel_id: Number(hotelId),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email?.trim() || null,
        nationality: formData.nationality?.trim() || (isIntl ? "Foreign" : "Indian"),
        id_type: isIntl ? "Passport" : formData.id_type,
        id_number: formData.id_number?.trim() || null,
        address: formData.address?.trim() || null,
        passport_expiry: formData.passport_expiry?.trim() || null,
        visa_number: formData.visa_number?.trim() || null,
        visa_type: formData.visa_type?.trim() || null,
        visa_expiry: formData.visa_expiry?.trim() || null,
        port_of_entry: formData.port_of_entry?.trim() || null,
        date_of_arrival: formData.date_of_arrival?.trim() || null,
        next_destination: formData.next_destination?.trim() || null,
        vip_status: formData.vip_status || "regular",
        is_blacklisted: Boolean(formData.is_blacklisted),
        blacklist_reason: formData.is_blacklisted ? formData.blacklist_reason?.trim() : null,
        preferences: formData.preferences?.trim() || null,
        company_name: formData.company_name?.trim() || null,
        gstin: formData.gstin?.trim() || null,
      };

      if (editingGuest) {
        await api.put(`/guests/${editingGuest.id}`, payload);
        showToast("Guest profile & operational preferences updated");
      } else {
        await api.post("/guests", payload);
        showToast("Guest registered successfully");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save guest";
      showToast(msg, "error");
    }
  };

  const handleDelete = async (guestId) => {
    if (!window.confirm("Are you sure you want to remove this guest profile?")) return;
    try {
      await api.delete(`/guests/${guestId}`);
      showToast("Guest profile deleted");
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete guest";
      showToast(msg, "error");
    }
  };

  // Precompute stay count per guest for repeat loyalty identification
  const guestStayCounts = useMemo(() => {
    const map = {};
    guests.forEach((g) => {
      let count = 0;
      for (let i = 0; i < bookings.length; i++) {
        if (isBookingForGuest(bookings[i], g)) {
          count++;
        }
      }
      map[g.id] = count;
    });
    return map;
  }, [guests, bookings]);

  // Enhanced Operational & Compliance Stats
  const stats = useMemo(() => {
    const total = guests.length;
    const inHouse = guests.filter((g) => isGuestInHouse(g)).length;
    const vips = guests.filter(
      (g) => g.vip_status === "vip" || g.vip_status === "vvip"
    ).length;
    const repeat = guests.filter(
      (g) => (guestStayCounts[g.id] || 0) >= 2
    ).length;
    const international = guests.filter((g) => isInternationalGuest(g)).length;
    const blacklisted = guests.filter((g) => Boolean(g.is_blacklisted)).length;

    return { total, inHouse, vips, repeat, international, blacklisted };
  }, [guests, bookings, rooms, guestStayCounts]);

  // Filtered guests supporting Search, ID Type, In-House, and Quick Segment Chips
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        g.full_name?.toLowerCase().includes(q) ||
        g.phone?.includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.id_number?.toLowerCase().includes(q) ||
        g.company_name?.toLowerCase().includes(q) ||
        g.address?.toLowerCase().includes(q);

      const matchesIdType =
        idTypeFilter === "ALL" || g.id_type === idTypeFilter;

      const inHouse = isGuestInHouse(g);
      const isVip = g.vip_status === "vip" || g.vip_status === "vvip";
      const isIntl = isInternationalGuest(g);
      const isBlacklisted = Boolean(g.is_blacklisted);
      const isRepeat = (guestStayCounts[g.id] || 0) >= 2;

      let matchesSegment = true;
      if (activeSegment === "IN_HOUSE") matchesSegment = inHouse;
      else if (activeSegment === "VIP") matchesSegment = isVip;
      else if (activeSegment === "REPEAT") matchesSegment = isRepeat;
      else if (activeSegment === "INTERNATIONAL") matchesSegment = isIntl;
      else if (activeSegment === "BLACKLISTED") matchesSegment = isBlacklisted;

      let matchesInHouse = true;
      if (inHouseFilter === "in-house") matchesInHouse = inHouse;
      else if (inHouseFilter === "departed") matchesInHouse = !inHouse;

      return matchesSearch && matchesIdType && matchesSegment && matchesInHouse;
    });
  }, [
    guests,
    bookings,
    rooms,
    searchQuery,
    idTypeFilter,
    activeSegment,
    inHouseFilter,
    guestStayCounts,
  ]);

  // Statutory Form B / Police Register CSV Export
  const handleExportPoliceRegister = () => {
    if (!filteredGuests || filteredGuests.length === 0) {
      showToast("No guest records match current filters to export", "error");
      return;
    }

    const headers = [
      "Sl No",
      "Guest ID",
      "Full Name",
      "Phone Number",
      "Email Address",
      "Nationality",
      "Guest Category",
      "ID Proof Type",
      "ID Proof Number",
      "Current In-House Status",
      "Assigned Room(s)",
      "Form C FRRO Compliance",
      "Passport Number",
      "Passport Expiry Date",
      "Visa Number",
      "Visa Type",
      "Visa Expiry Date",
      "Port of Entry",
      "Date of Arrival in India",
      "Next Destination / Proceeding To",
      "VIP Stature",
      "Caution / Blacklist Status",
      "Blacklist Restriction Reason",
      "Corporate Company Name",
      "Corporate GSTIN",
      "Guest Stay Preferences",
      "Total Stays on Record",
      "Residential Address",
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = filteredGuests.map((g, index) => {
      const inHouse = isGuestInHouse(g);
      const activeRoom = inHouse
        ? getGuestActiveRoom(g) || "In-House"
        : "Departed / Historical";
      const isIntl = isInternationalGuest(g);
      const isCompliant = isFormCCompliant(g);
      const staysCount = guestStayCounts[g.id] || 0;

      return [
        index + 1,
        g.id,
        g.full_name || "",
        g.phone || "",
        g.email || "",
        g.nationality || "Indian",
        isIntl ? "Foreign National (Form C)" : "Domestic",
        g.id_type || "",
        g.id_number || "",
        inHouse ? "Currently In-House" : "Departed / Registered",
        activeRoom,
        isIntl
          ? isCompliant
            ? "Form C Compliant"
            : "Form C Incomplete"
          : "N/A (Domestic)",
        g.passport_expiry ? g.id_number || "" : isIntl ? g.id_number || "" : "",
        g.passport_expiry || "",
        g.visa_number || "",
        g.visa_type || "",
        g.visa_expiry || "",
        g.port_of_entry || "",
        g.date_of_arrival || "",
        g.next_destination || "",
        (g.vip_status || "regular").toUpperCase(),
        g.is_blacklisted ? "YES - RESTRICTED" : "NO",
        g.blacklist_reason || "",
        g.company_name || "",
        g.gstin || "",
        g.preferences || "",
        staysCount,
        g.address || "",
      ]
        .map(escapeCsv)
        .join(",");
    });

    const csvContent =
      "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `Hotel_Guest_Register_FormB_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(
      `Form B Police Register (${filteredGuests.length} guests) exported successfully`
    );
  };

  // Guest stay history (both primary reservations & co-guest stays)
  const guestBookings = useMemo(() => {
    if (!selectedGuest) return [];
    return bookings.filter((b) => isBookingForGuest(b, selectedGuest));
  }, [selectedGuest, bookings]);

  // Guest lifetime analytics & stay intelligence
  const guestAnalytics = useMemo(() => {
    if (!selectedGuest) {
      return {
        lifetimeSpend: 0,
        totalStays: 0,
        totalNights: 0,
        loyaltyTier: "New Registered Guest",
        loyaltyClass: "first",
        outstandingBalance: 0,
        lastStayDate: "None",
        isInHouseNow: false,
        activeRooms: null,
      };
    }

    const totalStays = guestBookings.length;
    let lifetimeSpend = 0;
    let totalNights = 0;
    let outstandingBalance = 0;
    let latestDate = null;

    guestBookings.forEach((b) => {
      const amt = Number(b.total_amount) || 0;
      lifetimeSpend += amt;

      const adv = Number(b.advance_paid) || 0;
      const s = String(b.payment_status || "").toLowerCase();
      if (s !== "paid") {
        outstandingBalance += Math.max(0, amt - adv);
      }

      if (b.nights_count) {
        totalNights += Number(b.nights_count);
      } else if (b.checkin_date && b.checkout_date) {
        const diffDays = Math.max(
          1,
          Math.round(
            (new Date(b.checkout_date) - new Date(b.checkin_date)) /
              (1000 * 60 * 60 * 24)
          )
        );
        totalNights += diffDays;
      } else {
        totalNights += 1;
      }

      const d = b.checkout_date || b.checkin_date;
      if (d) {
        const dt = new Date(d);
        if (!latestDate || dt > latestDate) {
          latestDate = dt;
        }
      }
    });

    let loyaltyTier = "First-Time Guest";
    let loyaltyClass = "first";
    if (totalStays >= 5) {
      loyaltyTier = "VIP Frequent Stayer";
      loyaltyClass = "vip";
    } else if (totalStays >= 2) {
      loyaltyTier = "Repeat Guest";
      loyaltyClass = "repeat";
    } else if (totalStays === 0) {
      loyaltyTier = "New Registered Guest";
      loyaltyClass = "first";
    }

    const inHouseNow = isGuestInHouse(selectedGuest);
    const activeRooms = inHouseNow ? getGuestActiveRoom(selectedGuest) : null;

    return {
      lifetimeSpend,
      totalStays,
      totalNights,
      loyaltyTier,
      loyaltyClass,
      outstandingBalance,
      lastStayDate: latestDate
        ? latestDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "No previous stay",
      isInHouseNow: inHouseNow,
      activeRooms,
    };
  }, [selectedGuest, guestBookings, rooms]);

  const formatStayPeriod = (b) => {
    const inStr = b.checkin_date
      ? new Date(b.checkin_date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";
    const outStr = b.checkout_date
      ? new Date(b.checkout_date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";
    let nights = b.nights_count;
    if (!nights && b.checkin_date && b.checkout_date) {
      nights = Math.max(
        1,
        Math.round(
          (new Date(b.checkout_date) - new Date(b.checkin_date)) /
            (1000 * 60 * 60 * 24)
        )
      );
    }
    return { inStr, outStr, nights: nights || 1 };
  };

  const renderFolioBadge = (b) => {
    const total = Number(b.total_amount) || 0;
    const adv = Number(b.advance_paid) || 0;
    const status = String(b.payment_status || "").toLowerCase();

    if (status === "paid" || (total > 0 && adv >= total)) {
      return <span className="gst-folio-badge paid">Settled / Paid</span>;
    }
    if (adv > 0 && adv < total) {
      const bal = total - adv;
      return (
        <span className="gst-folio-badge partial">
          Partially Paid (₹{bal.toLocaleString("en-IN")} due)
        </span>
      );
    }
    return (
      <span className="gst-folio-badge unpaid">
        Unpaid (₹{total.toLocaleString("en-IN")} due)
      </span>
    );
  };

  const handleCreateBookingForGuest = (guest) => {
    if (guest.is_blacklisted) {
      const proceed = window.confirm(
        `⚠️ CAUTION: Guest "${guest.full_name}" is on the HOTEL BLACKLIST / RESTRICTED LIST!\nReason: ${guest.blacklist_reason || "Management restriction"}\n\nAre you sure you want to proceed with creating a reservation?`
      );
      if (!proceed) return;
    }
    navigate("/front-desk/bookings", {
      state: {
        prefillGuest: {
          id: guest.id,
          full_name: guest.full_name,
          phone: guest.phone,
          email: guest.email,
          nationality: guest.nationality,
          id_type: guest.id_type,
          id_number: guest.id_number,
          address: guest.address,
          vip_status: guest.vip_status,
          company_name: guest.company_name,
          gstin: guest.gstin,
          preferences: guest.preferences,
        },
      },
    });
  };

  const tabs = [
    { id: "ALL", label: "All Guests", count: stats.total },
    { id: "IN_HOUSE", label: "In-House Guests", count: stats.inHouse },
    { id: "VIP", label: "VIP & VVIP", count: stats.vips },
    { id: "REPEAT", label: "Repeat Guests", count: stats.repeat },
    { id: "INTERNATIONAL", label: "Form C / Intl", count: stats.international },
    { id: "BLACKLISTED", label: "Blacklisted / Caution", count: stats.blacklisted },
  ];

  return (
    <div className="directory-page checkinout-page guests-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Guests Directory"
        kicker="FRONT DESK OPERATIONS"
        description="Manage registered hotel guests, verification ID proofs, and reservation history."
        icon={Users}
        backPath="/front-desk"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={handleOpenAdd}
          >
            <Plus size={16} /> Register New Guest
          </button>
        }
      />

      {/* STATS GRID - 6 KEY PROFILES */}
      <div className="dir-stats-grid gst-stats-six-grid">
        <StatCard
          title="Total Registered"
          value={stats.total}
          Icon={Users}
          colorTheme="teal"
          onClick={() => setActiveSegment("ALL")}
          isActive={activeSegment === "ALL"}
        />
        <StatCard
          title="Currently In-House"
          value={stats.inHouse}
          Icon={CheckCircle}
          colorTheme="green"
          onClick={() => setActiveSegment(activeSegment === "IN_HOUSE" ? "ALL" : "IN_HOUSE")}
          isActive={activeSegment === "IN_HOUSE"}
        />
        <StatCard
          title="VIP & VVIP Guests"
          value={stats.vips}
          Icon={Star}
          colorTheme="amber"
          onClick={() => setActiveSegment(activeSegment === "VIP" ? "ALL" : "VIP")}
          isActive={activeSegment === "VIP"}
        />
        <StatCard
          title="Repeat Loyal Guests"
          value={stats.repeat}
          Icon={Award}
          colorTheme="blue"
          onClick={() => setActiveSegment(activeSegment === "REPEAT" ? "ALL" : "REPEAT")}
          isActive={activeSegment === "REPEAT"}
        />
        <StatCard
          title="Form C / International"
          value={stats.international}
          Icon={Globe}
          colorTheme="purple"
          onClick={() => setActiveSegment(activeSegment === "INTERNATIONAL" ? "ALL" : "INTERNATIONAL")}
          isActive={activeSegment === "INTERNATIONAL"}
        />
        <StatCard
          title="Caution / Blacklisted"
          value={stats.blacklisted}
          Icon={ShieldAlert}
          colorTheme="red"
          onClick={() => setActiveSegment(activeSegment === "BLACKLISTED" ? "ALL" : "BLACKLISTED")}
          isActive={activeSegment === "BLACKLISTED"}
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Guest Directory Register"
          description="Operational directory of registered guests, verification ID proofs, and reservation profiles."
          badgeCount={filteredGuests.length}
          badgeLabel="guests"
        />

        {/* TABS & FILTER CONTROLS */}
        <div className="cio-queue-controls">
          <div className="cio-queue-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`cio-queue-tab ${activeSegment === tab.id ? "active" : ""}`}
                onClick={() => setActiveSegment(tab.id)}
              >
                {tab.label}
                <span className="cio-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="dir-controls" style={{ marginTop: 0 }}>
            <div className="dir-search-box" style={{ flex: 1.5 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by name, phone, email, ID number, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <select
                className="dir-filter-select"
                value={idTypeFilter}
                onChange={(e) => setIdTypeFilter(e.target.value)}
              >
                <option value="ALL">All ID Types</option>
                {ID_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                className="dir-filter-select"
                value={inHouseFilter}
                onChange={(e) => setInHouseFilter(e.target.value)}
              >
                <option value="ALL">All Stay Statuses</option>
                <option value="in-house">Currently In-House</option>
                <option value="departed">Past / Departed</option>
              </select>

              <button
                type="button"
                className="gst-export-btn"
                onClick={handleExportPoliceRegister}
                title="Export statutory Form B / Police Inspection Register to CSV"
              >
                <Download size={15} /> Export Form B
              </button>

              {(searchQuery || idTypeFilter !== "ALL" || inHouseFilter !== "ALL" || activeSegment !== "ALL") && (
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleResetFilters}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="dir-table-container gst-table-card">
          {filteredGuests.length === 0 ? (
            <div className="gst-empty">
              <Users size={48} />
              <h4>No Guest Records Found</h4>
              <p>
                {searchQuery || idTypeFilter !== "ALL" || inHouseFilter !== "ALL" || activeSegment !== "ALL"
                  ? "No guest records match your active search or filter selection."
                  : "Add guest profiles to maintain historical stay logs and statutory compliance."}
              </p>
              {(searchQuery || idTypeFilter !== "ALL" || inHouseFilter !== "ALL" || activeSegment !== "ALL") && (
                <button
                  type="button"
                  className="btn-cancel"
                  style={{ marginTop: "12px" }}
                  onClick={handleResetFilters}
                >
                  <RotateCcw size={13} style={{ marginRight: "4px" }} />
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <table className="dir-table gst-table">
              <thead>
                <tr>
                  <th>Guest Profile</th>
                  <th>Contact Info</th>
                  <th>Nationality</th>
                  <th>ID Verification</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((g) => {
                  const inHouse = isGuestInHouse(g);
                  const activeRoomStr = inHouse ? getGuestActiveRoom(g) : null;
                  const isCoGuest = inHouse && isGuestActiveCoGuest(g);
                  const staysCount = guestStayCounts[g.id] || 0;

                  return (
                    <tr key={g.id} className="dir-table-row">
                    <td>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <strong>{g.full_name}</strong>
                          {g.vip_status === "vvip" && (
                            <span className="gst-badge vvip-pill" title="Very Very Important Person (VVIP)">
                              <Sparkles size={10} /> VVIP
                            </span>
                          )}
                          {g.vip_status === "vip" && (
                            <span className="gst-badge vip-pill" title="VIP Guest">
                              <Star size={10} fill="#f59e0b" /> VIP
                            </span>
                          )}
                          {staysCount >= 2 && (
                            <span className="gst-badge repeat-pill" title={`${staysCount} hotel stays on record`}>
                              <Award size={10} /> Repeat ({staysCount})
                            </span>
                          )}
                          {g.is_blacklisted && (
                            <span
                              className="gst-badge blacklist-pill"
                              title={`CAUTION: Blacklisted guest! Reason: ${g.blacklist_reason || "Management flag"}`}
                            >
                              <ShieldAlert size={10} /> Blacklisted
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          ID: #{g.id}
                          {g.company_name && (
                            <span style={{ marginLeft: "8px", color: "#475569", fontWeight: 600 }}>
                              <Briefcase size={10} style={{ verticalAlign: "middle" }} /> {g.company_name}
                            </span>
                          )}
                        </div>
                        {g.preferences && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#0f766e",
                              marginTop: "3px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title={g.preferences}
                          >
                            <Tag size={10} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>
                              {g.preferences}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Phone size={12} style={{ color: "#64748b" }} /> {g.phone}
                        </span>
                      </div>
                      {g.email && (
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          <Mail size={11} style={{ verticalAlign: "middle" }} /> {g.email}
                        </div>
                      )}
                    </td>
                    <td>
                      {isInternationalGuest(g) ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span className="gst-badge intl-pill" title="Foreign National - Statutory Form C FRRO Reporting Applicable">
                            <Globe size={11} /> {g.nationality || "Foreign"}
                          </span>
                          {isFormCCompliant(g) ? (
                            <span className="gst-formc-pill compliant" title="Form C Passport & Visa details verified">
                              <CheckCircle2 size={10} /> Form C OK
                            </span>
                          ) : (
                            <span className="gst-formc-pill pending" title="Statutory Visa & Passport details incomplete!">
                              <AlertCircle size={10} /> Form C Required
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: "13px", color: "#334155" }}>
                          {g.nationality || "Indian"}
                        </span>
                      )}
                    </td>
                    <td>
                      <div>
                        <span className="gst-badge id-pill">
                          {g.id_type || "Government ID"}
                        </span>
                      </div>
                      {g.id_number && (
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>
                          {g.id_number}
                        </div>
                      )}
                      {g.passport_expiry && (
                        <div style={{ fontSize: "10px", color: "#64748b", marginTop: "1px" }}>
                          Exp: {g.passport_expiry}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "#475569" }}>
                        {g.address || "—"}
                      </span>
                    </td>
                    <td>
                      {inHouse ? (
                        <span
                          className={`gst-badge in-house ${isCoGuest ? "co-guest" : ""}`}
                          title={isCoGuest ? "Currently staying as registered Co-Guest" : "Primary Reservation Guest"}
                        >
                          In-House {activeRoomStr ? `(${activeRoomStr})` : ""}
                          {isCoGuest && <span className="gst-co-guest-tag">Co-Guest</span>}
                        </span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                          Departed
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="gst-actions">
                        <button
                          className="gst-action-btn"
                          title="View Guest History"
                          onClick={() => handleOpenDetails(g)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="gst-action-btn"
                          title="Edit Guest"
                          onClick={() => handleOpenEdit(g)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="gst-action-btn delete"
                          title="Delete Guest"
                          onClick={() => handleDelete(g.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      </section>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="gst-modal-overlay">
          <div className="gst-modal">
            <div className="gst-modal-header">
              <h3>{editingGuest ? "Edit Guest Profile" : "Register New Guest"}</h3>
              <button
                className="gst-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="gst-modal-body">
                <div className="gst-form-grid">
                  <div className="gst-form-group gst-form-full">
                    <label>Guest Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="gst-form-group">
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="gst-form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. guest@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="gst-form-group">
                    <label>Nationality</label>
                    <input
                      type="text"
                      placeholder="e.g. Indian, US, British..."
                      value={formData.nationality}
                      onChange={(e) => {
                        const val = e.target.value;
                        const isNonIndian = val.trim() !== "" && val.toLowerCase().trim() !== "indian";
                        setFormData((prev) => ({
                          ...prev,
                          nationality: val,
                          is_international: isNonIndian ? true : prev.is_international,
                          id_type: isNonIndian ? "Passport" : prev.id_type,
                        }));
                      }}
                    />
                  </div>

                  <div className="gst-form-group">
                    <label>ID Proof Type</label>
                    <select
                      value={formData.id_type}
                      onChange={(e) =>
                        setFormData({ ...formData, id_type: e.target.value })
                      }
                    >
                      {ID_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gst-form-group gst-form-full">
                    <label>
                      {formData.id_type === "Passport" ? "Passport Document Number *" : "ID Proof Document Number"}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        formData.id_type === "Passport"
                          ? "Enter Passport Number (e.g. A1234567)"
                          : "e.g. 1234-5678-9012 (Aadhaar) / Voter ID / DL"
                      }
                      value={formData.id_number}
                      onChange={(e) =>
                        setFormData({ ...formData, id_number: e.target.value })
                      }
                    />
                  </div>

                  {/* INTERNATIONAL / FORM C TOGGLE */}
                  <div className="gst-form-full gst-intl-toggle-box">
                    <label className="gst-toggle-label">
                      <input
                        type="checkbox"
                        checked={
                          formData.is_international ||
                          (formData.nationality &&
                            formData.nationality.toLowerCase().trim() !== "indian")
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData((prev) => ({
                            ...prev,
                            is_international: checked,
                            id_type: checked ? "Passport" : prev.id_type,
                            nationality:
                              checked && prev.nationality.toLowerCase().trim() === "indian"
                                ? ""
                                : prev.nationality,
                          }));
                        }}
                      />
                      <span className="gst-toggle-text">
                        <Globe size={14} /> Foreign National / International Visitor (Statutory Form C FRRO Compliance)
                      </span>
                    </label>
                  </div>

                  {/* FORM C EXPANDED FIELDS */}
                  {(formData.is_international ||
                    (formData.nationality &&
                      formData.nationality.toLowerCase().trim() !== "indian")) && (
                    <div className="gst-form-full gst-formc-container">
                      <div className="gst-formc-header">
                        <FileText size={15} />
                        <span>Statutory Form C (FRRO) Registration Details</span>
                      </div>
                      <div className="gst-formc-grid">
                        <div className="gst-form-group">
                          <label>Passport Expiry Date *</label>
                          <input
                            type="date"
                            value={formData.passport_expiry}
                            onChange={(e) =>
                              setFormData({ ...formData, passport_expiry: e.target.value })
                            }
                          />
                        </div>

                        <div className="gst-form-group">
                          <label>Visa / e-Visa Number *</label>
                          <input
                            type="text"
                            placeholder="e.g. V9876543"
                            value={formData.visa_number}
                            onChange={(e) =>
                              setFormData({ ...formData, visa_number: e.target.value })
                            }
                          />
                        </div>

                        <div className="gst-form-group">
                          <label>Visa Type *</label>
                          <select
                            value={formData.visa_type}
                            onChange={(e) =>
                              setFormData({ ...formData, visa_type: e.target.value })
                            }
                          >
                            {VISA_TYPES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="gst-form-group">
                          <label>Visa Valid Till / Expiry *</label>
                          <input
                            type="date"
                            value={formData.visa_expiry}
                            onChange={(e) =>
                              setFormData({ ...formData, visa_expiry: e.target.value })
                            }
                          />
                        </div>

                        <div className="gst-form-group">
                          <label>Date of Arrival in India</label>
                          <input
                            type="date"
                            value={formData.date_of_arrival}
                            onChange={(e) =>
                              setFormData({ ...formData, date_of_arrival: e.target.value })
                            }
                          />
                        </div>

                        <div className="gst-form-group">
                          <label>Port of Entry / Airport</label>
                          <input
                            type="text"
                            placeholder="e.g. Delhi IGI (DEL) / Mumbai (BOM)"
                            value={formData.port_of_entry}
                            onChange={(e) =>
                              setFormData({ ...formData, port_of_entry: e.target.value })
                            }
                          />
                        </div>

                        <div className="gst-form-group gst-form-full">
                          <label>Next Destination / Proceeding To</label>
                          <input
                            type="text"
                            placeholder="e.g. Agra, Jaipur, or Outbound Flight"
                            value={formData.next_destination}
                            onChange={(e) =>
                              setFormData({ ...formData, next_destination: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="gst-form-group gst-form-full">
                    <label>Residential / Street Address</label>
                    <textarea
                      rows={2}
                      placeholder="Full residential address for police verification / hotel register..."
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>

                  {/* VIP & CORPORATE BILLING */}
                  <div className="gst-form-full gst-ops-container">
                    <div className="gst-ops-header">
                      <Star size={15} style={{ color: "#d97706" }} />
                      <span>VIP Category & Corporate Affiliation</span>
                    </div>
                    <div className="gst-ops-grid">
                      <div className="gst-form-group">
                        <label>VIP Status</label>
                        <select
                          value={formData.vip_status}
                          onChange={(e) => setFormData({ ...formData, vip_status: e.target.value })}
                        >
                          <option value="regular">Regular Guest</option>
                          <option value="vip">⭐ VIP Guest</option>
                          <option value="vvip">✨ VVIP Guest</option>
                        </select>
                      </div>

                      <div className="gst-form-group">
                        <label>Company / Organization Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Tata Consultancy Services"
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        />
                      </div>

                      <div className="gst-form-group gst-form-full">
                        <label>Company GSTIN (for Corporate GST Invoicing)</label>
                        <input
                          type="text"
                          placeholder="e.g. 27AABCT3518Q1ZV"
                          value={formData.gstin}
                          onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* STAY PREFERENCES */}
                  <div className="gst-form-full gst-ops-container">
                    <div className="gst-ops-header">
                      <Tag size={15} style={{ color: "#0f766e" }} />
                      <span>Guest Stay Preferences & Special Requests</span>
                    </div>
                    <div className="gst-form-group">
                      <textarea
                        rows={2}
                        placeholder="e.g. High floor, non-smoking, feather-free pillows, vegetarian meals only..."
                        value={formData.preferences}
                        onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
                      />
                      <div className="gst-chip-suggestions">
                        <span style={{ fontSize: "11px", color: "#64748b", alignSelf: "center", marginRight: "4px" }}>Quick add:</span>
                        {COMMON_PREFERENCES.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            className="gst-suggestion-chip"
                            onClick={() => {
                              const curr = formData.preferences?.trim();
                              if (!curr) {
                                setFormData({ ...formData, preferences: chip });
                              } else if (!curr.toLowerCase().includes(chip.toLowerCase())) {
                                setFormData({ ...formData, preferences: `${curr}, ${chip}` });
                              }
                            }}
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* BLACKLIST / CAUTION ALERT SECTION */}
                  <div className={`gst-form-full gst-blacklist-box ${formData.is_blacklisted ? "active" : ""}`}>
                    <label className="gst-blacklist-toggle-label">
                      <input
                        type="checkbox"
                        checked={formData.is_blacklisted}
                        onChange={(e) =>
                          setFormData({ ...formData, is_blacklisted: e.target.checked })
                        }
                      />
                      <span className="gst-blacklist-toggle-text">
                        <ShieldAlert size={16} /> Flag / Blacklist this Guest Profile (Management Caution Alert)
                      </span>
                    </label>

                    {formData.is_blacklisted && (
                      <div className="gst-blacklist-input-box">
                        <label>Blacklist Reason / Incident Details *</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Specify reason for caution / refusal (e.g. Unpaid bills, property damage, misconduct)..."
                          value={formData.blacklist_reason}
                          onChange={(e) =>
                            setFormData({ ...formData, blacklist_reason: e.target.value })
                          }
                        />
                        <span style={{ fontSize: "11px", color: "#b91c1c", marginTop: "4px", display: "block" }}>
                          Front desk staff will receive a caution alert before checking in this guest.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="gst-modal-footer">
                <button
                  type="button"
                  className="gst-secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gst-primary-btn">
                  {editingGuest ? "Save Changes" : "Register Guest"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GUEST DETAIL & STAY HISTORY MODAL */}
      {isDetailModalOpen && selectedGuest && (
        <div className="gst-modal-overlay">
          <div className="gst-modal gst-modal-xl">
            <div className="gst-modal-header no-print">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0 }}>{selectedGuest.full_name}</h3>
                  {selectedGuest.vip_status === "vvip" && (
                    <span className="gst-badge vvip-pill">
                      <Sparkles size={11} /> VVIP
                    </span>
                  )}
                  {selectedGuest.vip_status === "vip" && (
                    <span className="gst-badge vip-pill">
                      <Star size={11} fill="#f59e0b" /> VIP
                    </span>
                  )}
                  {selectedGuest.is_blacklisted && (
                    <span className="gst-badge blacklist-pill">
                      <ShieldAlert size={11} /> Blacklisted
                    </span>
                  )}
                  <span className={`gst-tier-badge ${guestAnalytics.loyaltyClass}`}>
                    <Award size={12} /> {guestAnalytics.loyaltyTier}
                  </span>
                  {guestAnalytics.isInHouseNow && (
                    <span className="gst-badge in-house">
                      In-House {guestAnalytics.activeRooms ? `(${guestAnalytics.activeRooms})` : ""}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "inline-block" }}>
                  Guest Record #{selectedGuest.id} • {selectedGuest.nationality || "Indian"} • Registered: {selectedGuest.created_at ? new Date(selectedGuest.created_at).toLocaleDateString("en-IN") : "—"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="gst-secondary-btn"
                  onClick={() => window.print()}
                  title="Print Guest Registration & Stay Summary"
                >
                  <Printer size={15} /> Print Card
                </button>
                <button
                  className="gst-modal-close"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="gst-modal-body">
              {/* BLACKLIST / CAUTION ALERT BANNER */}
              {selectedGuest.is_blacklisted && (
                <div className="gst-blacklist-alert-banner">
                  <ShieldAlert size={22} style={{ flexShrink: 0, color: "#dc2626" }} />
                  <div>
                    <strong style={{ color: "#991b1b" }}>MANAGEMENT CAUTION ALERT: GUEST IS BLACKLISTED</strong>
                    <div style={{ marginTop: "3px", fontSize: "12px", color: "#7f1d1d" }}>
                      <strong>Reason on file:</strong> {selectedGuest.blacklist_reason || "Flagged by hotel management"}
                    </div>
                  </div>
                </div>
              )}

              {/* PRINTABLE ARCHIVAL LETTERHEAD (visible when printing) */}
              <div className="gst-printable-letterhead">
                <div className="gst-print-top">
                  <div>
                    <h2 className="gst-print-hotel-name">
                      {hotelInfo?.name || user?.hotel?.name || user?.hotel_name || "HOTEL ERP"}
                    </h2>
                    <p className="gst-print-hotel-sub">
                      Front Desk Department • Guest Profile & Stay History Ledger
                    </p>
                  </div>
                  <div className="gst-print-meta-box">
                    <div><strong>Guest Account:</strong> #GST-{String(selectedGuest.id).padStart(5, "0")}</div>
                    <div><strong>Date Generated:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    <div><strong>Front Desk Agent:</strong> {user?.name || user?.username || "Front Desk"}</div>
                  </div>
                </div>
              </div>

              {/* 4 KPI METRICS BAR */}
              <div className="gst-modal-analytics-grid">
                <div className="gst-modal-kpi">
                  <div className="kpi-label">
                    <IndianRupee size={13} style={{ color: "#0f766e" }} /> Lifetime Spend
                  </div>
                  <div className="kpi-val" style={{ color: "#0f766e" }}>
                    ₹{guestAnalytics.lifetimeSpend.toLocaleString("en-IN")}
                  </div>
                  <div className="kpi-sub">Total billed across stays</div>
                </div>

                <div className="gst-modal-kpi">
                  <div className="kpi-label">
                    <CalendarCheck size={13} style={{ color: "#2563eb" }} /> Visits & Stays
                  </div>
                  <div className="kpi-val">
                    {guestAnalytics.totalStays} {guestAnalytics.totalStays === 1 ? "Stay" : "Stays"}
                  </div>
                  <div className="kpi-sub">{guestAnalytics.totalNights} Total Nights</div>
                </div>

                <div className="gst-modal-kpi">
                  <div className="kpi-label">
                    <Award size={13} style={{ color: "#d97706" }} /> Loyalty Status
                  </div>
                  <div className="kpi-val" style={{ fontSize: "15px", color: "#d97706" }}>
                    {guestAnalytics.loyaltyTier}
                  </div>
                  <div className="kpi-sub">Last Stay: {guestAnalytics.lastStayDate}</div>
                </div>

                <div className="gst-modal-kpi">
                  <div className="kpi-label">
                    <AlertCircle size={13} style={{ color: guestAnalytics.outstandingBalance > 0 ? "#dc2626" : "#059669" }} />
                    Folio Balance
                  </div>
                  <div
                    className="kpi-val"
                    style={{ color: guestAnalytics.outstandingBalance > 0 ? "#dc2626" : "#059669" }}
                  >
                    {guestAnalytics.outstandingBalance > 0
                      ? `₹${guestAnalytics.outstandingBalance.toLocaleString("en-IN")} Due`
                      : "Nil / Clear"}
                  </div>
                  <div className="kpi-sub">
                    {guestAnalytics.outstandingBalance > 0 ? "Unsettled room folio" : "All payments settled"}
                  </div>
                </div>
              </div>

              {/* GUEST IDENTITY & CONTACT PARTICULARS */}
              <div className="gst-modal-profile-card">
                <h4 className="gst-section-title">
                  <FileText size={15} /> Personal & Statutory Verification
                </h4>
                <div className="gst-profile-grid">
                  <div className="gst-profile-item">
                    <span className="gst-item-label">Mobile Phone</span>
                    <strong className="gst-item-val">
                      <Phone size={13} /> {selectedGuest.phone}
                    </strong>
                  </div>
                  <div className="gst-profile-item">
                    <span className="gst-item-label">Email Address</span>
                    <strong className="gst-item-val">
                      <Mail size={13} /> {selectedGuest.email || "—"}
                    </strong>
                  </div>
                  <div className="gst-profile-item">
                    <span className="gst-item-label">Nationality</span>
                    <strong className="gst-item-val">
                      <Globe size={13} /> {selectedGuest.nationality || "Indian"}
                    </strong>
                  </div>
                  <div className="gst-profile-item">
                    <span className="gst-item-label">ID Proof Type</span>
                    <strong className="gst-item-val">
                      <CreditCard size={13} /> {selectedGuest.id_type || "Government ID"}
                    </strong>
                  </div>
                  <div className="gst-profile-item">
                    <span className="gst-item-label">ID Document Number</span>
                    <strong className="gst-item-val" style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
                      {selectedGuest.id_number || "—"}
                    </strong>
                  </div>
                  <div className="gst-profile-item" style={{ gridColumn: "span 2" }}>
                    <span className="gst-item-label">Registered Residential Address</span>
                    <span className="gst-item-val">
                      <MapPin size={13} style={{ flexShrink: 0 }} /> {selectedGuest.address || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* STATUTORY FORM C (FRRO) CARD (if International) */}
              {isInternationalGuest(selectedGuest) && (
                <div className="gst-modal-profile-card gst-formc-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                    <h4 className="gst-section-title" style={{ margin: 0, color: "#0f766e" }}>
                      <Globe size={15} /> Statutory Form C (FRRO) Particulars
                    </h4>
                    {isFormCCompliant(selectedGuest) ? (
                      <span className="gst-formc-pill compliant">
                        <CheckCircle2 size={11} /> Form C Compliant
                      </span>
                    ) : (
                      <span className="gst-formc-pill pending">
                        <AlertCircle size={11} /> Statutory Details Incomplete
                      </span>
                    )}
                  </div>
                  <div className="gst-profile-grid">
                    <div className="gst-profile-item">
                      <span className="gst-item-label">Passport Number</span>
                      <strong className="gst-item-val" style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
                        {selectedGuest.id_number || "—"}
                      </strong>
                    </div>
                    <div className="gst-profile-item">
                      <span className="gst-item-label">Passport Expiry</span>
                      <strong className="gst-item-val">{selectedGuest.passport_expiry || "—"}</strong>
                    </div>
                    <div className="gst-profile-item">
                      <span className="gst-item-label">Visa / e-Visa No</span>
                      <strong className="gst-item-val" style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
                        {selectedGuest.visa_number || "—"}
                      </strong>
                    </div>
                    <div className="gst-profile-item">
                      <span className="gst-item-label">Visa Type</span>
                      <strong className="gst-item-val">{selectedGuest.visa_type || "Tourist"}</strong>
                    </div>
                    <div className="gst-profile-item">
                      <span className="gst-item-label">Visa Valid Till</span>
                      <strong className="gst-item-val">{selectedGuest.visa_expiry || "—"}</strong>
                    </div>
                    <div className="gst-profile-item">
                      <span className="gst-item-label">Port of Entry & Arrival</span>
                      <strong className="gst-item-val">
                        {selectedGuest.port_of_entry || "—"} {selectedGuest.date_of_arrival ? `(${selectedGuest.date_of_arrival})` : ""}
                      </strong>
                    </div>
                    <div className="gst-profile-item" style={{ gridColumn: "span 2" }}>
                      <span className="gst-item-label">Next Destination / Proceeding To</span>
                      <span className="gst-item-val">{selectedGuest.next_destination || "—"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PREFERENCES & CORPORATE AFFILIATION CARD */}
              {(selectedGuest.company_name || selectedGuest.preferences || selectedGuest.gstin) && (
                <div className="gst-modal-profile-card">
                  <h4 className="gst-section-title">
                    <Briefcase size={15} /> Preferences & Corporate Information
                  </h4>
                  <div className="gst-profile-grid">
                    {selectedGuest.company_name && (
                      <div className="gst-profile-item">
                        <span className="gst-item-label">Company / Organization</span>
                        <strong className="gst-item-val">{selectedGuest.company_name}</strong>
                      </div>
                    )}
                    {selectedGuest.gstin && (
                      <div className="gst-profile-item">
                        <span className="gst-item-label">Corporate GSTIN</span>
                        <strong className="gst-item-val" style={{ fontFamily: "monospace" }}>{selectedGuest.gstin}</strong>
                      </div>
                    )}
                    {selectedGuest.preferences && (
                      <div className="gst-profile-item" style={{ gridColumn: "span 2" }}>
                        <span className="gst-item-label">Guest Stay Preferences & Special Requests</span>
                        <span className="gst-item-val" style={{ color: "#0f766e", fontWeight: 600 }}>
                          <Tag size={13} style={{ flexShrink: 0 }} /> {selectedGuest.preferences}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RESERVATION & STAY HISTORY */}
              <div className="gst-history-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h4 className="gst-section-title" style={{ margin: 0 }}>
                    <CalendarCheck size={15} /> Stay & Folio Ledger History ({guestBookings.length})
                  </h4>
                  {guestAnalytics.totalStays > 0 && (
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Cumulative Nights: <strong>{guestAnalytics.totalNights}</strong>
                    </span>
                  )}
                </div>

                {guestBookings.length === 0 ? (
                  <div className="gst-no-history">
                    <Users size={36} />
                    <p>No reservations or check-in records found for this guest.</p>
                  </div>
                ) : (
                  <div className="gst-history-table-wrapper">
                    <table className="gst-table gst-history-table">
                      <thead>
                        <tr>
                          <th>Reservation Code</th>
                          <th>Assigned Room(s)</th>
                          <th>Stay Dates & Duration</th>
                          <th>Bill Amount</th>
                          <th>Folio Settlement</th>
                          <th>Stay Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {guestBookings.map((b) => {
                          const roomDisplay = formatBookingRooms(b, rooms) || "Unassigned";
                          const isCgStay = Number(b.guest_id) !== Number(selectedGuest.id);
                          const { inStr, outStr, nights } = formatStayPeriod(b);
                          const active = isStatusCheckedIn(b.status);

                          return (
                            <tr key={b.id} className={active ? "gst-active-stay-row" : ""}>
                              <td>
                                <strong style={{ color: "#0f172a" }}>
                                  {b.reservation_code || `#${b.id}`}
                                </strong>
                                {isCgStay && (
                                  <span className="gst-cg-indicator">
                                    Co-Guest Stay
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="gst-room-pill">{roomDisplay}</span>
                              </td>
                              <td>
                                <div style={{ fontSize: "12px", fontWeight: 600 }}>
                                  {inStr} → {outStr}
                                </div>
                                <span style={{ fontSize: "11px", color: "#64748b" }}>
                                  {nights} {nights === 1 ? "Night" : "Nights"}
                                </span>
                              </td>
                              <td>
                                <strong>₹{(Number(b.total_amount) || 0).toLocaleString("en-IN")}</strong>
                              </td>
                              <td>{renderFolioBadge(b)}</td>
                              <td>
                                <span className={`gst-badge ${active ? "in-house" : "id-pill"}`}>
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* STATUTORY GUEST CARD SIGNATURES (Print Only) */}
              <div className="gst-print-signatures">
                <div className="gst-sig-box">
                  <div className="gst-sig-line"></div>
                  <span>Guest Signature / Acknowledgment</span>
                </div>
                <div className="gst-sig-box">
                  <div className="gst-sig-line"></div>
                  <span>Front Desk Officer / Official Stamp</span>
                </div>
              </div>
            </div>

            <div className="gst-modal-footer no-print">
              <button
                type="button"
                className="gst-primary-btn"
                style={{ background: "#0284c7" }}
                onClick={() => handleCreateBookingForGuest(selectedGuest)}
              >
                <CalendarPlus size={15} /> Book Room for Guest
              </button>
              <button
                type="button"
                className="gst-secondary-btn"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Print Guest Card
              </button>
              <button
                type="button"
                className="gst-secondary-btn"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
