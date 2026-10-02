import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CalendarCheck,
  CheckCircle,
  LogIn,
  LogOut,
  Search,
  User,
  Briefcase,
  Plus,
  X,
  Save,
  BedDouble,
  Shield,
  CreditCard,
  Building,
  Clock,
  Users,
  Trash2,
  Calendar,
  Wallet,
  Utensils,
  Wine,
  Shirt,
  Sparkles,
  Receipt,
  RotateCcw,
  AlertTriangle,
  Globe,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader, Pagination } from "@components";
import { calculateHospitalityStay, formatStayLabel } from "@/shared/utils/hospitalityStay";
import "./checkInOut.css";

const VISA_TYPES = [
  "Tourist (e-Visa / Regular)",
  "Business (e-Business)",
  "Medical (e-Medical)",
  "Conference (e-Conference)",
  "Employment (E)",
  "Student (S)",
  "OCI / PIO Cardholder",
  "Diplomatic / Official",
  "Transit",
  "Other",
];

const getTodayInputDate = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const getTomorrowInputDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const getCurrentInputTime = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const getAutoGstRate = (amount) => {
  const roomAmount = Number(amount || 0);
  if (roomAmount <= 1000) return 0;
  if (roomAmount <= 7500) return 5;
  return 18;
};

const calculateNights = (checkin, checkout, checkinTime = "11:00", checkoutTime = "11:00") => {
  return calculateHospitalityStay({
    checkinDateStr: checkin,
    checkinTimeStr: checkinTime,
    checkoutDateStr: checkout,
    checkoutTimeStr: checkoutTime,
  }).nights;
};

// Parse datetime strings, treating naive ISO strings from server as UTC so local IST times are exact
const parseServerDate = (str) => {
  if (!str) return null;
  const s = String(str).trim();
  if (s.length <= 10) return new Date(`${s}T00:00:00Z`);
  if (s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s.replace(" ", "T") + "Z");
};

// Formats date string with local 12-hour AM/PM time
const formatDateWithTime = (dateStr, defaultTime = "12:00 PM") => {
  if (!dateStr) return "-";
  try {
    const d = parseServerDate(dateStr);
    if (!d || isNaN(d.getTime())) return "-";
    const dateFormatted = d.toLocaleDateString();
    const isMidnightUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
    const timeFormatted = isMidnightUtc
      ? defaultTime
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${dateFormatted} (${timeFormatted})`;
  } catch {
    return String(dateStr);
  }
};

const getAllBookingRoomIds = (booking) => {
  const ids = new Set();
  if (booking?.room_id) ids.add(Number(booking.room_id));
  let raw = booking?.assigned_room_ids;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (Array.isArray(raw)) {
    raw.forEach((id) => {
      if (id) ids.add(Number(id));
    });
  }
  return ids;
};

const calculateTaxAndTotal = ({ combinedNightlyRate, nights, discount, taxMode, taxRate, extraServicesTotal }) => {
  const ratePerNight = Number(combinedNightlyRate || 0);
  const totalNights = Number(nights || 1);
  const grossRoomRate = ratePerNight * totalNights;
  const addOns = Number(extraServicesTotal || 0);
  const subTotalBeforeDiscount = grossRoomRate + addOns;

  const discountAmount = Number(discount || 0);
  const gstRate = Number(taxRate || 0);

  const amountAfterDiscount = Math.max(subTotalBeforeDiscount - discountAmount, 0);

  let taxAmount = 0;
  let totalAmount = amountAfterDiscount;

  if (gstRate > 0 && taxMode === "exclusive") {
    taxAmount = amountAfterDiscount * (gstRate / 100);
    totalAmount = amountAfterDiscount + taxAmount;
  }

  if (gstRate > 0 && taxMode === "inclusive") {
    taxAmount = amountAfterDiscount - amountAfterDiscount / (1 + gstRate / 100);
    totalAmount = amountAfterDiscount;
  }

  return {
    grossRoomRate: Number(grossRoomRate.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
};

const parseCorporateNotes = (rawNotes) => {
  if (!rawNotes) {
    return {
      corporate_notes: "",
      special_requests: "",
      agent_name: "",
      agent_phone: "",
      agent_notes: "",
      co_guests: [],
      formC: {},
    };
  }

  let corporate = "";
  let special = "";
  let agentName = "";
  let agentPhone = "";
  let agentNotes = "";
  let coGuests = [];
  let formC = {};

  const lines = String(rawNotes).split("\n");
  const leftover = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[Corporate]:")) {
      corporate = trimmed.replace("[Corporate]:", "").trim();
    } else if (trimmed.startsWith("[Special Requests]:")) {
      special = trimmed.replace("[Special Requests]:", "").trim();
    } else if (trimmed.startsWith("[Agent Referral]:") || trimmed.startsWith("[Agent]:")) {
      const tag = trimmed.startsWith("[Agent Referral]:") ? "[Agent Referral]:" : "[Agent]:";
      const agentRaw = trimmed.replace(tag, "").trim();
      const segments = agentRaw.split("|").map((s) => s.trim());
      agentName = segments[0] || "";
      for (const seg of segments.slice(1)) {
        if (seg.toLowerCase().startsWith("phone:")) {
          agentPhone = seg.replace(/phone:/i, "").trim();
        } else if (seg.toLowerCase().startsWith("note:")) {
          agentNotes = seg.replace(/note:/i, "").trim();
        }
      }
      if (!agentPhone && agentRaw.includes("(Phone:")) {
        const pm = agentRaw.match(/\(Phone:\s*([^)]+)\)/i);
        if (pm) agentPhone = pm[1].trim();
        agentName = agentRaw.split("(")[0].trim();
      }
    } else if (trimmed.startsWith("[Form C / International]:") || trimmed.startsWith("[Form C]:")) {
      const tag = trimmed.startsWith("[Form C / International]:") ? "[Form C / International]:" : "[Form C]:";
      const formCRaw = trimmed.replace(tag, "").trim();
      const segments = formCRaw.split("|").map((s) => s.trim());
      for (const seg of segments) {
        if (seg.startsWith("Nationality:")) formC.nationality = seg.replace("Nationality:", "").trim();
        else if (seg.startsWith("Passport Exp:")) formC.passport_expiry = seg.replace("Passport Exp:", "").trim();
        else if (seg.startsWith("Visa:")) {
          const vMatch = seg.match(/Visa:\s*([^(]+)(?:\(([^)]+)\))?/);
          if (vMatch) {
            formC.visa_number = (vMatch[1] || "").trim();
            formC.visa_type = (vMatch[2] || "Tourist (e-Visa / Regular)").trim();
          } else {
            formC.visa_number = seg.replace("Visa:", "").trim();
          }
        } else if (seg.startsWith("Visa Exp:")) formC.visa_expiry = seg.replace("Visa Exp:", "").trim();
        else if (seg.startsWith("Entry Date:")) formC.date_of_arrival_in_country = seg.replace("Entry Date:", "").trim();
        else if (seg.startsWith("Port:")) formC.port_of_entry = seg.replace("Port:", "").trim();
        else if (seg.startsWith("Next Dest:")) formC.next_destination = seg.replace("Next Dest:", "").trim();
      }
    } else if (trimmed.startsWith("[Co-Guests]:")) {
      const rawCg = trimmed.replace("[Co-Guests]:", "").trim();
      const parts = rawCg.split(";").map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        const m = p.match(/^([^(]+)(?:\(([^,]+)?(?:,\s*(\d+)y)?(?:,\s*([^:]+):\s*([^)]+))?\))?$/);
        if (m) {
          coGuests.push({
            full_name: (m[1] || "").trim(),
            gender: (m[2] || "male").trim().toLowerCase(),
            age: m[3] ? parseInt(m[3], 10) : "",
            id_type: (m[4] || "Aadhaar").trim(),
            id_number: (m[5] || "").trim(),
          });
        } else {
          coGuests.push({
            full_name: p,
            gender: "male",
            age: "",
            id_type: "Aadhaar",
            id_number: "",
          });
        }
      }
    } else {
      leftover.push(trimmed);
    }
  }

  if (leftover.length > 0 && !special) {
    special = leftover.join("\n");
  }
  if (!corporate && leftover.length > 0) {
    corporate = leftover.join("\n");
  }

  return {
    corporate_notes: corporate,
    special_requests: special,
    agent_name: agentName,
    agent_phone: agentPhone,
    agent_notes: agentNotes,
    co_guests: coGuests,
    formC,
  };
};

const initialWalkInState = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  guest_type: "individual",
  company_name: "",
  gstin: "",
  corporate_notes: "",
  booking_source: "walk-in",
  agent_name: "",
  agent_phone: "",
  agent_notes: "",
  nationality: "Indian",
  is_international: false,
  passport_expiry: "",
  visa_number: "",
  visa_type: "Tourist (e-Visa / Regular)",
  visa_expiry: "",
  date_of_arrival_in_country: "",
  port_of_entry: "",
  next_destination: "",
  id_proof_type: "Aadhaar",
  id_proof_number: "",
  rooms_count: 1,
  selected_room_ids: [""],
  checkin_date: getTodayInputDate(),
  checkin_time: getCurrentInputTime(),
  checkout_date: getTomorrowInputDate(),
  checkout_time: "11:00",
  adults: 1,
  children: 0,
  room_rate: "",
  discount: 0,
  tax_mode: "inclusive",
  tax_rate_type: "auto",
  tax_rate: 0,
  advance_paid: 0,
  payment_method: "cash",
  payment_status: "paid",
  co_guests: [],
  extra_services: [],
};

export default function CheckInOut() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);

  const [activeTab, setActiveTab] = useState(location.state?.defaultTab || "all");
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchText, sourceFilter]);

  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Quick Walk-In Modal State
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInForm, setWalkInForm] = useState(initialWalkInState);
  const [savingWalkIn, setSavingWalkIn] = useState(false);
  const [selectedReturningGuestId, setSelectedReturningGuestId] = useState("");
  const [serverAvailableRooms, setServerAvailableRooms] = useState(null);
  const [loadingAvailableRooms, setLoadingAvailableRooms] = useState(false);

  // Reservation Check-In Verification Modal State
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkingInBooking, setCheckingInBooking] = useState(null);
  const [checkInForm, setCheckInForm] = useState({
    primary_id_type: "Aadhaar",
    primary_id_number: "",
    nationality: "Indian",
    is_international: false,
    passport_expiry: "",
    visa_number: "",
    visa_type: "Tourist (e-Visa / Regular)",
    visa_expiry: "",
    date_of_arrival_in_country: "",
    port_of_entry: "",
    next_destination: "",
    co_guests: [],
    collect_payment: 0,
    payment_method: "cash",
  });
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // Guest Details Inspector Modal State
  const [selectedDetailsBooking, setSelectedDetailsBooking] = useState(null);
  const inspectorNotes = useMemo(() => {
    return parseCorporateNotes(selectedDetailsBooking?.corporate_notes);
  }, [selectedDetailsBooking?.corporate_notes]);

  // Checkout & Folio Settlement Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkingOutBooking, setCheckingOutBooking] = useState(null);
  const [folioData, setFolioData] = useState(null);
  const [loadingFolio, setLoadingFolio] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    payment_method: "cash",
    transaction_id: "",
    discount: 0,
  });
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  const [toast, setToast] = useState(null);

  const bookingSources = ["walk-in", "phone", "website", "agent", "ota", "corporate", "other"];
  const paymentMethods = ["cash", "upi", "card", "bank_transfer", "cheque", "ota_virtual"];

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getApiErrorMessage = (err, fallbackMessage = "Process failed.") => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => `${item.loc?.join(" → ") || "field"}: ${item.msg}`)
        .join("\n");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail, null, 2);
    return err.message || fallbackMessage;
  };

  const getLoggedInHotelId = () => {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id ||
      null
    );
  };

  const getDateKey = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayKey = getDateKey(new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      await api.post("/bookings/process-no-shows").catch(() => {});
      const [bookingsResponse, guestsResponse, roomsResponse, catalogResponse] = await Promise.all([
        api.get("/bookings"),
        api.get("/guests"),
        api.get("/rooms"),
        api.get("/extra-charges/catalog").catch(() => ({ data: [] })),
      ]);

      const hotelId = getLoggedInHotelId();
      const bookingsList = normalizeList(bookingsResponse.data, "bookings");
      const guestsList = normalizeList(guestsResponse.data, "guests");
      const roomsList = normalizeList(roomsResponse.data, "rooms");
      const catalogList = normalizeList(catalogResponse.data, "catalog");

      if (hotelId) {
        setBookings(bookingsList.filter((b) => Number(b.hotel_id) === Number(hotelId)));
        setGuests(guestsList.filter((g) => Number(g.hotel_id) === Number(hotelId)));
        setRooms(roomsList.filter((r) => Number(r.hotel_id) === Number(hotelId)));
        setCatalogServices(catalogList.filter((c) => !c.hotel_id || Number(c.hotel_id) === Number(hotelId)));
      } else {
        setBookings(bookingsList);
        setGuests(guestsList);
        setRooms(roomsList);
        setCatalogServices(catalogList);
      }
    } catch (err) {
      console.error("Check-in/Out fetch error:", err);
      showToast(getApiErrorMessage(err, "Failed to load front desk records."), "error");
      setBookings([]);
      setGuests([]);
      setRooms([]);
      setCatalogServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live server-side room availability query for walk-in window
  useEffect(() => {
    if (!showWalkInModal || !walkInForm.checkin_date || !walkInForm.checkout_date) {
      setServerAvailableRooms(null);
      return;
    }

    let isMounted = true;
    const fetchWalkInAvailableRooms = async () => {
      try {
        setLoadingAvailableRooms(true);
        const params = {
          checkin_date: new Date(`${walkInForm.checkin_date}T${walkInForm.checkin_time || "11:00"}:00`).toISOString(),
          checkout_date: new Date(`${walkInForm.checkout_date}T${walkInForm.checkout_time || "11:00"}:00`).toISOString(),
        };
        const hotelId = getLoggedInHotelId();
        if (hotelId) params.hotel_id = hotelId;

        const res = await api.get("/bookings/available-rooms", { params });
        const list = normalizeList(res.data, "rooms");
        if (isMounted) {
          setServerAvailableRooms(list);
        }
      } catch (err) {
        console.warn("Failed to fetch available rooms for walk-in window:", err);
        if (isMounted) {
          setServerAvailableRooms(null);
        }
      } finally {
        if (isMounted) setLoadingAvailableRooms(false);
      }
    };

    fetchWalkInAvailableRooms();

    return () => {
      isMounted = false;
    };
  }, [
    showWalkInModal,
    walkInForm.checkin_date,
    walkInForm.checkin_time,
    walkInForm.checkout_date,
    walkInForm.checkout_time,
  ]);

  const getGuest = (guestId) => guests.find((g) => Number(g.id) === Number(guestId));
  const getRoom = (roomId) => rooms.find((r) => Number(r.id) === Number(roomId));

  const openCheckInModal = (booking) => {
    const guest = getGuest(booking.guest_id);
    const parsedNotes = parseCorporateNotes(booking.corporate_notes);

    // Preserve existing co-guests from booking or notes (prevents wiping out registered occupants)
    let existingCoGuests = [];
    if (Array.isArray(booking.co_guests) && booking.co_guests.length > 0) {
      existingCoGuests = booking.co_guests.map((cg) => ({
        full_name: cg.full_name || "",
        gender: cg.gender || "male",
        age: cg.age || "",
        id_type: cg.id_type || "Aadhaar",
        id_number: cg.id_number || "",
      }));
    } else if (parsedNotes.co_guests?.length > 0) {
      existingCoGuests = parsedNotes.co_guests;
    }

    const totalOccupants = Number(booking.adults || 1) + Number(booking.children || 0);
    const neededCoGuestSlots = Math.max(0, totalOccupants - 1);

    const initialCoGuests = [...existingCoGuests];
    while (initialCoGuests.length < neededCoGuestSlots) {
      initialCoGuests.push({
        full_name: "",
        gender: "male",
        age: "",
        id_type: "Aadhaar",
        id_number: "",
      });
    }

    const total = Number(booking.total_amount || 0);
    const adv = Number(booking.advance_paid || 0);
    const due = Math.max(total - adv, 0);
    const isForeign = Boolean(
      (guest?.nationality && guest.nationality.toLowerCase().trim() !== "indian") ||
      (parsedNotes.formC?.nationality && parsedNotes.formC.nationality.toLowerCase().trim() !== "indian") ||
      parsedNotes.formC?.visa_number ||
      parsedNotes.formC?.passport_expiry ||
      guest?.id_type === "Passport"
    );

    const guestNat = (guest?.nationality && guest.nationality.toLowerCase().trim() !== "indian" ? guest.nationality : null) ||
      parsedNotes.formC?.nationality ||
      (isForeign ? "" : "Indian");

    let coDateStr = getTomorrowInputDate();
    let coTimeStr = "11:00";
    if (booking.checkout_date) {
      try {
        const co = new Date(booking.checkout_date);
        coDateStr = co.toISOString().split("T")[0];
        const h = String(co.getHours()).padStart(2, "0");
        const m = String(co.getMinutes()).padStart(2, "0");
        coTimeStr = `${h}:${m}` !== "00:00" ? `${h}:${m}` : "11:00";
      } catch {}
    }

    setCheckingInBooking(booking);
    setCheckInForm({
      checkin_date: getTodayInputDate(),
      checkin_time: getCurrentInputTime(),
      checkout_date: coDateStr,
      checkout_time: coTimeStr,
      primary_id_type: guest?.id_type || (isForeign ? "Passport" : "Aadhaar"),
      primary_id_number: guest?.id_number || "",
      nationality: guestNat,
      is_international: isForeign,
      passport_expiry: parsedNotes.formC?.passport_expiry || "",
      visa_number: parsedNotes.formC?.visa_number || "",
      visa_type: parsedNotes.formC?.visa_type || "Tourist (e-Visa / Regular)",
      visa_expiry: parsedNotes.formC?.visa_expiry || "",
      date_of_arrival_in_country: parsedNotes.formC?.date_of_arrival_in_country || "",
      port_of_entry: parsedNotes.formC?.port_of_entry || "",
      next_destination: parsedNotes.formC?.next_destination || "",
      co_guests: initialCoGuests,
      collect_payment: due,
      payment_method: booking.payment_method || "cash",
    });
    setCheckInModalOpen(true);
  };

  useEffect(() => {
    const targetId = location.state?.autoCheckInBookingId;
    if (targetId && bookings.length > 0) {
      const matched = bookings.find((b) => Number(b.id) === Number(targetId));
      if (matched && (matched.status === "confirmed" || matched.status === "reserved")) {
        openCheckInModal(matched);
        window.history.replaceState({}, document.title);
      }
    }
  }, [bookings, location.state]);

  const openGuestDetailsModal = async (booking) => {
    try {
      const res = await api.get(`/bookings/${booking.id}`);
      setSelectedDetailsBooking(res.data || booking);
    } catch {
      setSelectedDetailsBooking(booking);
    }
  };

  const handleCopyFormC = (targetBooking) => {
    const b = targetBooking || selectedDetailsBooking || checkingInBooking;
    if (!b) return;
    const g = getGuest(b.guest_id);
    const parsed = parseCorporateNotes(b.corporate_notes);
    const formCData = parsed.formC || {};
    const nat =
      (g?.nationality && g.nationality.toLowerCase().trim() !== "indian" ? g.nationality : null) ||
      formCData.nationality ||
      "Foreign";

    const text = [
      `=== FORM C / BUREAU OF IMMIGRATION (FRRO) RECORD ===`,
      `Full Name (as in Passport): ${g?.full_name || "N/A"}`,
      `Nationality / Citizenship: ${nat}`,
      `Passport Number: ${g?.id_number || "N/A"}`,
      `Passport Expiry Date: ${formCData.passport_expiry || "N/A"}`,
      `Visa / e-Visa Number: ${formCData.visa_number || "N/A"}`,
      `Visa Type: ${formCData.visa_type || "Tourist (e-Visa / Regular)"}`,
      `Visa Valid Until: ${formCData.visa_expiry || "N/A"}`,
      `Date of Arrival in Country: ${formCData.date_of_arrival_in_country || "N/A"}`,
      `Port of Entry / Airport: ${formCData.port_of_entry || "N/A"}`,
      `Next Destination: ${formCData.next_destination || "N/A"}`,
      `Residential / Permanent Address: ${g?.address || "N/A"}`,
      `Contact Phone: ${g?.phone || "N/A"}`,
      `Check-In Date: ${b.checkin_date ? new Date(b.checkin_date).toLocaleString() : "N/A"}`,
      `Check-Out Date: ${b.checkout_date ? new Date(b.checkout_date).toLocaleString() : "N/A"}`,
      `====================================================`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    showToast("Form C immigration details copied to clipboard!", "success");
  };

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    if (!checkingInBooking) return;

    try {
      setSubmittingCheckIn(true);
      const collectAmt = Number(checkInForm.collect_payment || 0);

      const isCheckInInternational = Boolean(
        checkInForm.is_international ||
        (checkInForm.nationality && checkInForm.nationality.toLowerCase().trim() !== "indian") ||
        checkInForm.primary_id_type === "Passport"
      );

      const notesParts = [];
      const currentParsed = parseCorporateNotes(checkingInBooking.corporate_notes);
      if (currentParsed.corporate_notes) {
        notesParts.push(`[Corporate]: ${currentParsed.corporate_notes}`);
      }
      if (currentParsed.agent_name) {
        let agentStr = `[Agent Referral]: ${currentParsed.agent_name}`;
        if (currentParsed.agent_phone) agentStr += ` | Phone: ${currentParsed.agent_phone}`;
        if (currentParsed.agent_notes) agentStr += ` | Note: ${currentParsed.agent_notes}`;
        notesParts.push(agentStr);
      }
      if (isCheckInInternational) {
        const formCParts = [];
        if (checkInForm.nationality) formCParts.push(`Nationality: ${checkInForm.nationality}`);
        if (checkInForm.passport_expiry) formCParts.push(`Passport Exp: ${checkInForm.passport_expiry}`);
        if (checkInForm.visa_number) {
          formCParts.push(`Visa: ${checkInForm.visa_number} (${checkInForm.visa_type || "Tourist (e-Visa / Regular)"})`);
        }
        if (checkInForm.visa_expiry) formCParts.push(`Visa Exp: ${checkInForm.visa_expiry}`);
        if (checkInForm.date_of_arrival_in_country) formCParts.push(`Entry Date: ${checkInForm.date_of_arrival_in_country}`);
        if (checkInForm.port_of_entry) formCParts.push(`Port: ${checkInForm.port_of_entry}`);
        if (checkInForm.next_destination) formCParts.push(`Next Dest: ${checkInForm.next_destination}`);
        if (formCParts.length > 0) {
          notesParts.push(`[Form C / International]: ${formCParts.join(" | ")}`);
        }
      }
      if (currentParsed.special_requests) {
        notesParts.push(`[Special Requests]: ${currentParsed.special_requests}`);
      }
      const updatedNotes = notesParts.join("\n") || null;

      const ciIso = new Date(`${checkInForm.checkin_date || getTodayInputDate()}T${checkInForm.checkin_time || "11:00"}:00`).toISOString();
      const coIso = new Date(`${checkInForm.checkout_date || getTomorrowInputDate()}T${checkInForm.checkout_time || "11:00"}:00`).toISOString();

      const payload = {
        checkin_date: ciIso,
        checkout_date: coIso,
        actual_checkin_time: ciIso,
        primary_id_type: checkInForm.primary_id_type,
        primary_id_number: checkInForm.primary_id_number.trim(),
        nationality: checkInForm.nationality?.trim() || (isCheckInInternational ? "Foreign" : "Indian"),
        corporate_notes: updatedNotes,
        co_guests: checkInForm.co_guests.filter((cg) => cg.full_name.trim() !== ""),
        collect_payment: collectAmt,
        payment_method: checkInForm.payment_method,
      };

      await api.post(`/bookings/${checkingInBooking.id}/check-in`, payload);


      const identifier = checkingInBooking.reservation_code || `#${checkingInBooking.id}`;
      showToast(`Reservation ${identifier} checked in successfully!`, "success");
      setCheckInModalOpen(false);
      setCheckingInBooking(null);
      await fetchData();
    } catch (err) {
      console.error("Check-in error:", err);
      showToast(getApiErrorMessage(err, "Failed to complete check-in."), "error");
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const handleMarkNoShow = async (booking, e) => {
    if (e) e.stopPropagation();
    const code = booking.reservation_code || `#${booking.id}`;
    if (!window.confirm(`Mark reservation ${code} as No-Show?\nThis will immediately release the reserved room back to inventory.`)) {
      return;
    }
    try {
      setProcessingId(booking.id);
      await api.post(`/bookings/${booking.id}/no-show`);
      await fetchData();
      showToast(`Reservation ${code} marked as No-Show and room released.`, "success");
    } catch (err) {
      console.error("No-Show error:", err);
      showToast(getApiErrorMessage(err, "Failed to mark as No-Show."), "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Pure Server-Authoritative Folio Fetch
  const openCheckoutModal = async (booking, e) => {
    if (e) e.stopPropagation();
    setCheckingOutBooking(booking);
    setSettlementForm({
      payment_method: booking.payment_method || "cash",
      transaction_id: "",
      discount: 0,
    });
    setCheckoutModalOpen(true);
    setLoadingFolio(true);

    try {
      const res = await api.get(`/invoices/folio/${booking.id}`);
      setFolioData(res.data);
    } catch (err) {
      console.error("Folio fetch error:", err);
      showToast(getApiErrorMessage(err, "Failed to load checkout folio from server."), "error");
    } finally {
      setLoadingFolio(false);
    }
  };

  // Balance calculation strictly uses backend totals + optional cashier discount
  const { computedCheckoutDue, computedRefundDue } = useMemo(() => {
    if (!folioData) return { computedCheckoutDue: 0, computedRefundDue: 0 };
    const total = Number(folioData.grand_total || 0);
    const advance = Number(folioData.advance_paid || 0);
    const disc = Number(settlementForm.discount || 0);
    const effectiveTotal = Math.max(total - disc, 0);

    if (advance > effectiveTotal) {
      return {
        computedCheckoutDue: 0,
        computedRefundDue: Number((advance - effectiveTotal).toFixed(2)),
      };
    }

    return {
      computedCheckoutDue: Number((effectiveTotal - advance).toFixed(2)),
      computedRefundDue: 0,
    };
  }, [folioData, settlementForm.discount]);

  const handleSettleAndCheckout = async (e) => {
    e.preventDefault();
    if (!checkingOutBooking) return;

    try {
      setSubmittingCheckout(true);
      const params = {
        payment_method: settlementForm.payment_method,
        transaction_id: settlementForm.transaction_id.trim() || null,
        discount: Number(settlementForm.discount || 0),
      };

      const res = await api.post(`/payments/checkout-settle/${checkingOutBooking.id}`, null, { params });
      
      if (computedRefundDue > 0 && res.data?.invoice_id) {
        try {
          await api.post("/payments/refund", {
            invoice_id: res.data.invoice_id,
            amount: computedRefundDue,
            payment_method: settlementForm.payment_method === "unpaid" ? "cash" : settlementForm.payment_method,
            transaction_id: settlementForm.transaction_id.trim() || `REF-CO-${checkingOutBooking.id}`,
            reason: "Checkout surplus advance refund disbursement",
          });
        } catch (refErr) {
          console.warn("Automated checkout refund voucher warning:", refErr);
        }
      }

      const identifier = checkingOutBooking.reservation_code || `#${checkingOutBooking.id}`;
      let successMsg = `Reservation ${identifier} checked out! Invoice ${res.data.invoice_number} generated.`;
      if (res.data.extra_nights > 0) {
        successMsg += ` (Overstay: ${res.data.extra_nights} extra night(s) applied)`;
      }

      showToast(successMsg, "success");
      setCheckoutModalOpen(false);
      setCheckingOutBooking(null);
      setFolioData(null);
      await fetchData();
    } catch (err) {
      console.error("Checkout settlement error:", err);
      showToast(getApiErrorMessage(err, "Failed to complete checkout settlement."), "error");
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const stayMetrics = useMemo(() => {
    return calculateHospitalityStay({
      checkinDateStr: walkInForm.checkin_date,
      checkinTimeStr: walkInForm.checkin_time || "11:00",
      checkoutDateStr: walkInForm.checkout_date,
      checkoutTimeStr: walkInForm.checkout_time || "11:00",
      hotelStandardCheckout: "11:00",
      graceMinutes: 60,
    });
  }, [
    walkInForm.checkin_date,
    walkInForm.checkin_time,
    walkInForm.checkout_date,
    walkInForm.checkout_time,
  ]);

  const nightsCount = stayMetrics.nights;

  const extraServicesTotal = useMemo(() => {
    return (walkInForm.extra_services || []).reduce(
      (acc, curr) => acc + Number(curr.amount || 0),
      0
    );
  }, [walkInForm.extra_services]);

  const combinedWalkInRate = useMemo(() => {
    let totalRate = 0;
    (walkInForm.selected_room_ids || []).forEach((roomId) => {
      const found = rooms.find((r) => String(r.id) === String(roomId));
      if (found) {
        totalRate += Number(found.base_price || found.price_per_night || 0);
      }
    });
    return totalRate;
  }, [walkInForm.selected_room_ids, rooms]);

  const activeNightlyRate = useMemo(() => {
    return walkInForm.room_rate !== "" ? Number(walkInForm.room_rate) : combinedWalkInRate;
  }, [walkInForm.room_rate, combinedWalkInRate]);

  const activeTaxRate = useMemo(() => {
    if (walkInForm.tax_rate_type === "auto") {
      return getAutoGstRate(activeNightlyRate);
    }
    return Number(walkInForm.tax_rate || 0);
  }, [activeNightlyRate, walkInForm.tax_rate, walkInForm.tax_rate_type]);

  const amountCalculation = useMemo(() => {
    return calculateTaxAndTotal({
      combinedNightlyRate: activeNightlyRate,
      nights: nightsCount,
      discount: walkInForm.discount,
      taxMode: walkInForm.tax_mode,
      taxRate: activeTaxRate,
      extraServicesTotal,
    });
  }, [activeNightlyRate, nightsCount, walkInForm.discount, walkInForm.tax_mode, activeTaxRate, extraServicesTotal]);

  const calculatedTotalAmount = amountCalculation.totalAmount;

  const handleSelectReturningGuest = (guestId) => {
    if (!guestId) {
      setSelectedReturningGuestId("");
      return;
    }
    const g = guests.find((item) => String(item.id) === String(guestId));
    if (!g) return;

    const isIntl = Boolean(
      (g.nationality && g.nationality.toLowerCase().trim() !== "indian") ||
      g.id_type === "Passport"
    );

    // Look up previous stay history for Form C details
    const pastBookings = bookings.filter((b) => Number(b.guest_id) === Number(g.id));
    let prevFormC = {};
    if (pastBookings.length > 0) {
      const sorted = [...pastBookings].sort(
        (a, b) => new Date(b.created_at || b.checkin_date || 0) - new Date(a.created_at || a.checkin_date || 0)
      );
      const parsed = parseCorporateNotes(sorted[0]?.corporate_notes);
      if (parsed.formC) prevFormC = parsed.formC;
    }

    setWalkInForm((prev) => ({
      ...prev,
      full_name: g.full_name || prev.full_name,
      phone: g.phone || prev.phone,
      email: g.email || prev.email || "",
      address: g.address || prev.address || "",
      nationality: g.nationality || (isIntl ? "Foreign" : "Indian"),
      id_proof_type: g.id_type || (isIntl ? "Passport" : prev.id_proof_type || "Aadhaar"),
      id_proof_number: g.id_number || prev.id_proof_number || "",
      is_international: isIntl || Boolean(prevFormC.visa_number || prevFormC.passport_expiry),
      passport_expiry: prevFormC.passport_expiry || prev.passport_expiry || "",
      visa_number: prevFormC.visa_number || prev.visa_number || "",
      visa_type: prevFormC.visa_type || prev.visa_type || "Tourist (e-Visa / Regular)",
      visa_expiry: prevFormC.visa_expiry || prev.visa_expiry || "",
      date_of_arrival_in_country: prevFormC.date_of_arrival_in_country || prev.date_of_arrival_in_country || "",
      port_of_entry: prevFormC.port_of_entry || prev.port_of_entry || "",
      next_destination: prevFormC.next_destination || prev.next_destination || "",
    }));

    setSelectedReturningGuestId(String(g.id));
    showToast(`Loaded returning guest: ${g.full_name} (${g.phone})`, "info");
  };

  const handleWalkInChange = (e) => {
    const { name, value } = e.target;

    if (name === "rooms_count") {
      const count = Math.max(1, parseInt(value, 10) || 1);
      setWalkInForm((prev) => {
        let currentRooms = [...prev.selected_room_ids];
        if (currentRooms.length < count) {
          while (currentRooms.length < count) currentRooms.push("");
        } else if (currentRooms.length > count) {
          currentRooms = currentRooms.slice(0, count);
        }
        return { ...prev, rooms_count: count, selected_room_ids: currentRooms };
      });
      return;
    }

    if (name === "room_rate") {
      setWalkInForm((prev) => ({
        ...prev,
        room_rate: value,
        tax_rate: prev.tax_rate_type === "auto" ? getAutoGstRate(value) : prev.tax_rate,
      }));
      return;
    }

    if (name === "tax_rate_type") {
      setWalkInForm((prev) => ({
        ...prev,
        tax_rate_type: value,
        tax_rate: value === "auto" ? getAutoGstRate(activeNightlyRate) : Number(value),
      }));
      return;
    }

    if (name === "checkin_date") {
      setWalkInForm((prev) => {
        let newCheckout = prev.checkout_date;
        if (!prev.checkout_date || new Date(value) >= new Date(prev.checkout_date)) {
          const d = new Date(value);
          d.setDate(d.getDate() + 1);
          newCheckout = d.toISOString().split("T")[0];
        }
        return {
          ...prev,
          checkin_date: value,
          checkout_date: newCheckout,
        };
      });
      return;
    }

    if (name === "checkout_date") {
      setWalkInForm((prev) => {
        if (value && prev.checkin_date && new Date(value) <= new Date(prev.checkin_date)) {
          showToast("Checkout date must be after check-in date.", "warning");
        }
        return {
          ...prev,
          checkout_date: value,
        };
      });
      return;
    }

    setWalkInForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleWalkInRoomSlotChange = (index, selectedId) => {
    setWalkInForm((prev) => {
      const updated = [...prev.selected_room_ids];
      updated[index] = selectedId;
      return { ...prev, selected_room_ids: updated };
    });
  };

  const handleAddWalkInService = () => {
    setWalkInForm((prev) => ({
      ...prev,
      extra_services: [...prev.extra_services, { name: "", amount: "" }],
    }));
  };

  const handleCatalogServiceSelect = (index, selectedServiceName) => {
    const matchedService = catalogServices.find((s) => s.name === selectedServiceName);
    setWalkInForm((prev) => {
      const updated = [...prev.extra_services];
      updated[index] = {
        name: selectedServiceName,
        amount: matchedService?.default_price !== undefined ? matchedService.default_price : updated[index]?.amount || "",
      };
      return { ...prev, extra_services: updated };
    });
  };

  const handleServiceChange = (index, field, val) => {
    setWalkInForm((prev) => {
      const updated = [...prev.extra_services];
      updated[index][field] = val;
      return { ...prev, extra_services: updated };
    });
  };

  const handleRemoveService = (index) => {
    setWalkInForm((prev) => ({
      ...prev,
      extra_services: prev.extra_services.filter((_, i) => i !== index),
    }));
  };

  const handleAddWalkInCoGuest = () => {
    setWalkInForm((prev) => ({
      ...prev,
      co_guests: [
        ...prev.co_guests,
        { full_name: "", gender: "male", age: "", id_type: "Aadhaar", id_number: "" },
      ],
    }));
  };

  const handleUpdateWalkInCoGuest = (index, field, val) => {
    setWalkInForm((prev) => {
      const updated = [...prev.co_guests];
      updated[index][field] = val;
      return { ...prev, co_guests: updated };
    });
  };

  const handleRemoveWalkInCoGuest = (index) => {
    setWalkInForm((prev) => ({
      ...prev,
      co_guests: prev.co_guests.filter((_, i) => i !== index),
    }));
  };

  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (savingWalkIn) return;

    const chosenRooms = walkInForm.selected_room_ids.filter(Boolean);
    if (chosenRooms.length < walkInForm.rooms_count) {
      showToast(`Please select all ${walkInForm.rooms_count} room(s).`, "error");
      return;
    }

    const uniqueRooms = new Set(chosenRooms);
    if (uniqueRooms.size !== chosenRooms.length) {
      showToast("Duplicate rooms selected. Please assign distinct rooms.", "error");
      return;
    }

    if (walkInForm.booking_source === "agent" && !walkInForm.agent_name.trim()) {
      showToast("Please enter the Agent Name.", "error");
      return;
    }

    try {
      setSavingWalkIn(true);
      const hotelId = getLoggedInHotelId();
      if (!hotelId) {
        throw new Error("Hotel ID missing. Please log in again.");
      }

      const isWalkInInternational = Boolean(
        walkInForm.is_international ||
        (walkInForm.nationality && walkInForm.nationality.toLowerCase().trim() !== "indian") ||
        walkInForm.id_proof_type === "Passport"
      );

      const notesParts = [];
      if (walkInForm.guest_type === "corporate" && walkInForm.corporate_notes?.trim()) {
        notesParts.push(`[Corporate]: ${walkInForm.corporate_notes.trim()}`);
      }
      if (walkInForm.booking_source === "agent" && walkInForm.agent_name.trim()) {
        let agentStr = `[Agent Referral]: ${walkInForm.agent_name.trim()}`;
        if (walkInForm.agent_phone?.trim()) agentStr += ` | Phone: ${walkInForm.agent_phone.trim()}`;
        if (walkInForm.agent_notes?.trim()) agentStr += ` | Note: ${walkInForm.agent_notes.trim()}`;
        notesParts.push(agentStr);
      }
      if (isWalkInInternational) {
        const formCParts = [];
        if (walkInForm.nationality) formCParts.push(`Nationality: ${walkInForm.nationality}`);
        if (walkInForm.passport_expiry) formCParts.push(`Passport Exp: ${walkInForm.passport_expiry}`);
        if (walkInForm.visa_number) {
          formCParts.push(`Visa: ${walkInForm.visa_number} (${walkInForm.visa_type || "Tourist (e-Visa / Regular)"})`);
        }
        if (walkInForm.visa_expiry) formCParts.push(`Visa Exp: ${walkInForm.visa_expiry}`);
        if (walkInForm.date_of_arrival_in_country) formCParts.push(`Entry Date: ${walkInForm.date_of_arrival_in_country}`);
        if (walkInForm.port_of_entry) formCParts.push(`Port: ${walkInForm.port_of_entry}`);
        if (walkInForm.next_destination) formCParts.push(`Next Dest: ${walkInForm.next_destination}`);
        if (formCParts.length > 0) {
          notesParts.push(`[Form C / International]: ${formCParts.join(" | ")}`);
        }
      }
      const finalCorporateNotes = notesParts.join("\n") || null;

      const advPaid = Number(walkInForm.advance_paid || calculatedTotalAmount);
      const payload = {
        hotel_id: Number(hotelId),
        room_id: Number(chosenRooms[0]),
        rooms_count: Number(walkInForm.rooms_count || 1),
        assigned_room_ids: chosenRooms.map(Number),
        booking_source: walkInForm.booking_source || "walk-in",
        full_name: walkInForm.full_name.trim(),
        phone: walkInForm.phone.trim(),
        email: walkInForm.email.trim() || null,
        address: walkInForm.address.trim() || null,
        nationality: walkInForm.nationality?.trim() || (isWalkInInternational ? "Foreign" : "Indian"),
        guest_type: walkInForm.guest_type,
        company_name: walkInForm.guest_type === "corporate" ? walkInForm.company_name.trim() : null,
        gstin: walkInForm.guest_type === "corporate" ? walkInForm.gstin.trim() : null,
        corporate_notes: finalCorporateNotes,
        id_proof_type: walkInForm.id_proof_type,
        id_proof_number: walkInForm.id_proof_number.trim() || null,
        checkin_date: new Date(`${walkInForm.checkin_date}T${walkInForm.checkin_time || "11:00"}:00`).toISOString(),
        checkout_date: new Date(`${walkInForm.checkout_date}T${walkInForm.checkout_time || "11:00"}:00`).toISOString(),
        adults: Number(walkInForm.adults),
        children: Number(walkInForm.children),
        room_rate: Number(amountCalculation.grossRoomRate || 0),
        total_amount: Number(calculatedTotalAmount),
        advance_paid: advPaid,
        payment_status: walkInForm.payment_status,
        payment_method: walkInForm.payment_method,
        co_guests: walkInForm.co_guests.filter((cg) => cg.full_name.trim() !== ""),
        extra_services: walkInForm.extra_services.filter((s) => s.name && Number(s.amount) > 0),
      };

      const res = await api.post("/bookings/walk-in", payload);
      const resCode = res.data?.reservation_code || `#${res.data?.id}`;

      if (advPaid > 0 && res.data?.id) {
        try {
          await api.post("/payments/advance", {
            booking_id: res.data.id,
            amount: advPaid,
            payment_method: walkInForm.payment_method,
            transaction_id: `ADV-WALKIN-${res.data.id}`,
            remarks: "Immediate walk-in deposit collected",
            customer_gstin: walkInForm.guest_type === "corporate" ? walkInForm.gstin : null,
            tax_rate: activeTaxRate,
          });
        } catch (advErr) {
          console.warn("Walk-in advance receipt voucher creation warning:", advErr);
        }
      }

      showToast(`Walk-in guest checked in successfully! Ref: ${resCode}`, "success");
      setShowWalkInModal(false);
      setWalkInForm(initialWalkInState);
      setSelectedReturningGuestId("");
      await fetchData();
    } catch (err) {
      console.error("Walk-in error:", err);
      showToast(getApiErrorMessage(err, "Failed to process walk-in check-in."), "error");
    } finally {
      setSavingWalkIn(false);
    }
  };

  const availableRoomsForWalkIn = useMemo(() => {
    // Collect all room IDs currently reserved for overlapping active reservations or checked-in guests
    const reservedRoomIds = new Set();

    if (walkInForm.checkin_date && walkInForm.checkout_date) {
      const walkInStart = new Date(`${walkInForm.checkin_date}T${walkInForm.checkin_time || "11:00"}:00`).getTime();
      const walkInEnd = new Date(`${walkInForm.checkout_date}T${walkInForm.checkout_time || "11:00"}:00`).getTime();

      bookings.forEach((b) => {
        const s = String(b.status || "").toLowerCase();
        // Skip cancelled or checked-out bookings
        if (s === "cancelled" || s === "canceled" || s === "checked-out" || s === "checked_out") {
          return;
        }

        // Active in-house guests: rooms currently occupied
        if (s === "checked-in" || s === "checked_in") {
          const ids = getAllBookingRoomIds(b);
          ids.forEach((id) => reservedRoomIds.add(id));
          return;
        }

        // Confirmed, reserved, or pending bookings with overlapping stay windows
        if (b.checkin_date && b.checkout_date) {
          const bStart = new Date(b.checkin_date).getTime();
          const bEnd = new Date(b.checkout_date).getTime();
          // Check overlap: booking starts before walk-in ends AND booking ends after walk-in starts
          if (bStart < walkInEnd && bEnd > walkInStart) {
            const ids = getAllBookingRoomIds(b);
            ids.forEach((id) => reservedRoomIds.add(id));
          }
        }
      });
    }

    const baseList = serverAvailableRooms !== null ? serverAvailableRooms : rooms;

    return baseList.filter((room) => {
      // Must not be reserved for an overlapping booking or checked-in guest
      if (reservedRoomIds.has(Number(room.id))) {
        return false;
      }
      const status = String(room.status || "").toLowerCase();
      return status === "available" || status === "cleaning";
    });
  }, [
    rooms,
    serverAvailableRooms,
    bookings,
    walkInForm.checkin_date,
    walkInForm.checkin_time,
    walkInForm.checkout_date,
    walkInForm.checkout_time,
  ]);

  const stats = useMemo(() => {
    const todaysArrivals = bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return (s === "confirmed" || s === "reserved") && getDateKey(b.checkin_date) === todayKey;
    }).length;

    const allConfirmed = bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "confirmed" || s === "reserved";
    }).length;

    const inHouseGuests = bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "checked-in" || s === "checked_in";
    }).length;

    const dueOutToday = bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return (s === "checked-in" || s === "checked_in") && getDateKey(b.checkout_date) === todayKey;
    }).length;

    const completedCheckoutsToday = bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return (s === "checked-out" || s === "checked_out") && getDateKey(b.checkout_date) === todayKey;
    }).length;

    return { todaysArrivals, allConfirmed, inHouseGuests, dueOutToday, completedCheckoutsToday };
  }, [bookings, todayKey]);

  const tabs = [
    { id: "all", label: "All Check-ins / Outs", count: bookings.length },
    { id: "arrivals", label: "Today's Arrivals", count: stats.todaysArrivals },
    { id: "confirmed", label: "All Confirmed", count: stats.allConfirmed },
    { id: "in-house", label: "In-house Guests", count: stats.inHouseGuests },
    { id: "due-out", label: "Remaining Due Out", count: stats.dueOutToday },
    { id: "checked-out-today", label: "Checked Out Today", count: stats.completedCheckoutsToday },
  ];

  const filteredBookings = useMemo(() => {
    let list = [];

    if (activeTab === "all") {
      list = [...bookings];
    } else if (activeTab === "arrivals") {
      list = bookings.filter((b) => {
        const s = String(b.status || "").toLowerCase();
        return (s === "confirmed" || s === "reserved") && getDateKey(b.checkin_date) === todayKey;
      });
    } else if (activeTab === "confirmed") {
      list = bookings.filter((b) => {
        const s = String(b.status || "").toLowerCase();
        return s === "confirmed" || s === "reserved";
      });
    } else if (activeTab === "in-house") {
      list = bookings.filter((b) => {
        const s = String(b.status || "").toLowerCase();
        return s === "checked-in" || s === "checked_in";
      });
    } else if (activeTab === "due-out") {
      list = bookings.filter((b) => {
        const s = String(b.status || "").toLowerCase();
        return (s === "checked-in" || s === "checked_in") && getDateKey(b.checkout_date) === todayKey;
      });
    } else if (activeTab === "checked-out-today") {
      list = bookings.filter((b) => {
        const s = String(b.status || "").toLowerCase();
        return (s === "checked-out" || s === "checked_out") && getDateKey(b.checkout_date) === todayKey;
      });
    }

    return list
      .filter((booking) => {
        const search = searchText.toLowerCase().trim();
        const guest = getGuest(booking.guest_id);
        const room = getRoom(booking.room_id);

        const guestName = String(guest?.full_name || "").toLowerCase();
        const guestPhone = String(guest?.phone || "").toLowerCase();
        const roomNum = String(room?.room_number || "").toLowerCase();
        const resCode = String(booking.reservation_code || "").toLowerCase();
        const bookingId = String(booking.id || "").toLowerCase();
        const source = String(booking.booking_source || "").toLowerCase();
        const corporateNotes = String(booking.corporate_notes || "").toLowerCase();
        const nationality = String(guest?.nationality || "").toLowerCase();

        const matchesSearch =
          !search ||
          guestName.includes(search) ||
          guestPhone.includes(search) ||
          roomNum.includes(search) ||
          resCode.includes(search) ||
          bookingId.includes(search) ||
          corporateNotes.includes(search) ||
          nationality.includes(search);

        const matchesSource =
          sourceFilter === "all" || source === sourceFilter.toLowerCase();

        return matchesSearch && matchesSource;
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }, [activeTab, bookings, guests, rooms, searchText, sourceFilter, todayKey]);

  const paginatedBookings = useMemo(() => {
    const maxPage = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), maxPage);
    const start = (safePage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, currentPage, pageSize]);

  return (
    <div className="directory-page checkinout-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Check-in / Checkout"
        kicker="FRONT DESK OPERATIONS"
        description="Manage arrivals queue, advance reservations, in-house guests, and room departures."
        icon={Briefcase}
        backPath="/front-desk"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={() => {
              setWalkInForm(initialWalkInState);
              setSelectedReturningGuestId("");
              setShowWalkInModal(true);
            }}
          >
            <Plus size={16} /> Quick Walk-In
          </button>
        }
      />

      {/* STATS GRID - 5 KEY STAGES */}
      <div className="dir-stats-grid cio-stats-five-grid">
        <StatCard
          title="Today's Arrivals"
          value={stats.todaysArrivals}
          Icon={CalendarCheck}
          colorTheme="blue"
        />
        <StatCard
          title="All Confirmed"
          value={stats.allConfirmed}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="In-house Guests"
          value={stats.inHouseGuests}
          Icon={User}
          colorTheme="purple"
        />
        <StatCard
          title="Remaining Due Out"
          value={stats.dueOutToday}
          Icon={LogOut}
          colorTheme="orange"
        />
        <StatCard
          title="Checked Out Today"
          value={stats.completedCheckoutsToday}
          Icon={CheckCircle}
          colorTheme="teal"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Reception Queue"
          description="Operational desk queue for guest check-ins, departures, and active room occupancy."
          badgeCount={filteredBookings.length}
          badgeLabel="records"
        />

        {/* TABS & FILTER CONTROLS */}
        <div className="cio-queue-controls">
          <div className="cio-queue-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`cio-queue-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
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
                placeholder="Search by reservation code (RES-...), guest, room number, phone..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select
                className="dir-filter-select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All Sources</option>
                {bookingSources.map((source) => (
                  <option key={source} value={source}>
                    {source.toUpperCase()}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-cancel"
                style={{ height: "40px", padding: "0 16px" }}
                onClick={() => {
                  setSearchText("");
                  setSourceFilter("all");
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* QUEUE DATA TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th style={{ width: "120px", minWidth: "120px" }}>Ref / Code</th>
                <th className="th-customer">Guest & Contact</th>
                <th className="th-phone">Assigned Room(s)</th>
                <th className="th-address">Dates (Stay)</th>
                <th className="th-identity">Bill / Adv</th>
                <th className="th-bank">Status / Pay</th>
                <th className="th-action" style={{ width: "130px", textAlign: "right" }}>Operation</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading queue records...
                  </td>
                </tr>
              ) : paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No active bookings found in this operational queue.
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((booking) => {
                  const guest = getGuest(booking.guest_id);
                  const status = String(booking.status || "").toLowerCase();
                  const canCheckIn = status === "confirmed" || status === "reserved";
                  const canCheckout = status === "checked-in" || status === "checked_in";
                  const isCheckedOut = status === "checked-out" || status === "checked_out";
                  const payStatus = String(booking.payment_status || "pending").toLowerCase();
                  const roomCount = Number(booking.rooms_count || 1);

                  let rawAssigned = booking.assigned_room_ids;
                  if (typeof rawAssigned === "string") {
                    try {
                      rawAssigned = JSON.parse(rawAssigned);
                    } catch {
                      rawAssigned = [];
                    }
                  }

                  let allocatedRoomsText = "";
                  if (Array.isArray(rawAssigned) && rawAssigned.length > 0) {
                    allocatedRoomsText = rawAssigned
                      .map((id) => `Room ${getRoom(id)?.room_number || id}`)
                      .join(", ");
                  } else {
                    const primaryRoom = getRoom(booking.room_id);
                    allocatedRoomsText = primaryRoom ? `Room ${primaryRoom.room_number}` : `Room ${booking.room_id}`;
                  }

                  const primaryRoomObj = getRoom(booking.room_id);
                  const roomType = primaryRoomObj?.room_type || "Standard";

                  return (
                    <tr
                      key={booking.id}
                      className="dir-table-row clickable-row"
                      onClick={() => openGuestDetailsModal(booking)}
                      title="Click to view full reservation & guest details"
                    >
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                          <span className="booking-id-tag">
                            {booking.reservation_code || `#${booking.id}`}
                          </span>
                          {booking.booking_source && (
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                fontWeight: 700,
                                background:
                                  booking.booking_source === "ota"
                                    ? "#e0f2fe"
                                    : booking.booking_source === "agent"
                                    ? "#fef3c7"
                                    : booking.booking_source === "corporate"
                                    ? "#eef2ff"
                                    : "#f1f5f9",
                                color:
                                  booking.booking_source === "ota"
                                    ? "#0369a1"
                                    : booking.booking_source === "agent"
                                    ? "#b45309"
                                    : booking.booking_source === "corporate"
                                    ? "#3730a3"
                                    : "#475569",
                              }}
                            >
                              {booking.booking_source === "agent"
                                ? "AGENT"
                                : booking.booking_source.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            {String(guest?.full_name || "G").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="customer-name clickable-guest-name">
                              {guest?.full_name || "Guest Record"}
                            </span>
                            <span className="text-muted" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px", fontSize: "11px", marginTop: "2px" }}>
                              <span>{guest?.phone || "No phone listed"}</span>
                              <span>•</span>
                              <span>{booking.guest_type === "corporate" ? "Corporate" : "Individual"}</span>
                              {(() => {
                                const parsedNotes = parseCorporateNotes(booking.corporate_notes);
                                const isForeign = Boolean(
                                  (guest?.nationality && guest.nationality.toLowerCase().trim() !== "indian") ||
                                  (parsedNotes.formC?.nationality && parsedNotes.formC.nationality.toLowerCase().trim() !== "indian") ||
                                  parsedNotes.formC?.visa_number ||
                                  guest?.id_type === "Passport"
                                );
                                if (!isForeign) return null;
                                const nat =
                                  (guest?.nationality && guest.nationality.toLowerCase().trim() !== "indian"
                                    ? guest.nationality
                                    : null) ||
                                  parsedNotes.formC?.nationality ||
                                  "Foreign";
                                return (
                                  <span
                                    style={{
                                      fontSize: "10.5px",
                                      background: "#fdf4ff",
                                      color: "#86198f",
                                      border: "1px solid #f0abfc",
                                      borderRadius: "4px",
                                      padding: "1px 6px",
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                    }}
                                    title={`International Guest: ${nat} (Form C compliance required)`}
                                  >
                                    <Globe size={10} /> {nat}
                                  </span>
                                );
                              })()}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="th-phone">
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span className="mono-pill" title={allocatedRoomsText}>
                            {allocatedRoomsText}
                          </span>
                          <span className="text-muted" style={{ fontSize: "11px" }}>
                            {roomType} • {roomCount} Room{roomCount > 1 ? "s" : ""}
                          </span>
                        </div>
                      </td>

                      <td className="th-address">
                        <div className="bank-cell">
                          <span className="bank-primary">
                            {formatDateWithTime(booking.checkin_date, "12:00 PM")}
                          </span>
                          <span className="bank-sub" style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                            <span>to {formatDateWithTime(booking.checkout_date, "11:00 AM")}</span>
                            {booking.checkin_date && booking.checkout_date && (
                              <span
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  color: "#0369a1",
                                  background: "#e0f2fe",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  marginLeft: "2px",
                                }}
                              >
                                {calculateHospitalityStay({
                                  checkinDateStr: String(booking.checkin_date).split("T")[0],
                                  checkoutDateStr: String(booking.checkout_date).split("T")[0],
                                }).nights}N
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="th-identity">
                        <div className="bank-cell">
                          <span className="bank-primary" style={{ color: "#166962", fontWeight: 700 }}>
                            ₹{Number(booking.total_amount || 0).toFixed(2)}
                          </span>
                          <span className="bank-sub">
                            Adv: ₹{Number(booking.advance_paid || 0).toFixed(2)} (
                            <strong style={{ textTransform: "uppercase" }}>{booking.payment_method || "CASH"}</strong>)
                          </span>
                        </div>
                      </td>

                      <td className="th-bank">
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span
                            className={`mono-pill ${
                              canCheckout
                                ? "pill-normal"
                                : canCheckIn
                                ? "pill-warning"
                                : "pill-urgent"
                            }`}
                          >
                            {status.toUpperCase()}
                          </span>
                          <span
                            className={`mono-pill ${
                              payStatus === "paid"
                                ? "pill-normal"
                                : payStatus === "overpaid"
                                ? "pill-purple"
                                : payStatus === "partial" || payStatus === "partially_paid"
                                ? "pill-warning"
                                : "pill-urgent"
                            }`}
                          >
                            {payStatus === "overpaid" ? "OVERPAID" : payStatus.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                      </td>

                      <td className="th-action" style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        {canCheckIn && (
                          <div style={{ display: "inline-flex", gap: "4px" }}>
                            <button
                              type="button"
                              className="cio-action-btn checkin"
                              onClick={(e) => openCheckInModal(booking, e)}
                              disabled={processingId === booking.id}
                            >
                              <LogIn size={13} /> Check In
                            </button>
                            <button
                              type="button"
                              className="cio-action-btn"
                              style={{
                                background: "#fee2e2",
                                color: "#991b1b",
                                border: "1px solid #fecaca",
                                padding: "4px 8px",
                              }}
                              title="Guest did not arrive. Mark No-Show and release room."
                              onClick={(e) => handleMarkNoShow(booking, e)}
                              disabled={processingId === booking.id}
                            >
                              No-Show
                            </button>
                          </div>
                        )}
                        {canCheckout && (
                          <button
                            type="button"
                            className="cio-action-btn checkout"
                            onClick={(e) => openCheckoutModal(booking, e)}
                            disabled={processingId === booking.id}
                          >
                            <LogOut size={13} /> Check Out
                          </button>
                        )}
                        {isCheckedOut && (
                          <button
                            type="button"
                            className="cio-action-btn"
                            style={{ background: "#059669" }}
                            onClick={() => navigate("/invoices", { state: { booking_id: booking.id, reservation_code: booking.reservation_code } })}
                          >
                            <Receipt size={13} /> Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredBookings.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(Number(size));
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            itemLabel="bookings"
          />
        </div>
      </section>

      {/* 1. GUEST & RESERVATION FULL DETAILS INSPECTOR MODAL */}
      {selectedDetailsBooking && (
        <div className="modal-overlay" onClick={() => setSelectedDetailsBooking(null)}>
          <div
            className="modal-content cio-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="staff-avatar" style={{ width: "42px", height: "42px", fontSize: "15px" }}>
                  {String(getGuest(selectedDetailsBooking.guest_id)?.full_name || "G").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2>Reservation {selectedDetailsBooking.reservation_code || `#${selectedDetailsBooking.id}`} Overview</h2>
                  <p className="modal-kicker">
                    Status: <strong style={{ color: "#2d5696", textTransform: "uppercase" }}>{selectedDetailsBooking.status}</strong> &bull; Source: {selectedDetailsBooking.booking_source === "agent" ? "AGENT REFERRAL" : (selectedDetailsBooking.booking_source || "WALK-IN").toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedDetailsBooking(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ gap: "18px" }}>
              <div className="cio-guest-section-card primary-card">
                <div className="cio-card-badge-header">
                  <span className="cio-badge-tag primary">PRIMARY GUEST PROFILE</span>
                </div>
                <div className="details-two-col-grid" style={{ marginTop: "10px" }}>
                  <div className="info-kv">
                    <span>Full Name</span>
                    <strong>{getGuest(selectedDetailsBooking.guest_id)?.full_name || "-"}</strong>
                  </div>
                  <div className="info-kv">
                    <span>Phone Number</span>
                    <strong>{getGuest(selectedDetailsBooking.guest_id)?.phone || "-"}</strong>
                  </div>
                  <div className="info-kv">
                    <span>Email Address</span>
                    <strong>{getGuest(selectedDetailsBooking.guest_id)?.email || "Not Provided"}</strong>
                  </div>
                  <div className="info-kv">
                    <span>Identity Document</span>
                    <strong>
                      {getGuest(selectedDetailsBooking.guest_id)?.id_type || "Aadhaar"}: {getGuest(selectedDetailsBooking.guest_id)?.id_number ? "[Aadhaar Redacted]" : "Verified"}
                    </strong>
                  </div>
                  <div className="info-kv">
                    <span>Nationality</span>
                    <strong>{getGuest(selectedDetailsBooking.guest_id)?.nationality || inspectorNotes.formC?.nationality || "Indian"}</strong>
                  </div>
                  {selectedDetailsBooking.guest_type === "corporate" && (
                    <>
                      <div className="info-kv">
                        <span>Company Name</span>
                        <strong>{selectedDetailsBooking.company_name || "-"}</strong>
                      </div>
                      <div className="info-kv">
                        <span>Corporate GSTIN</span>
                        <strong className="mono-pill">{selectedDetailsBooking.gstin || "-"}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Agent Referral Details Card */}
              {(selectedDetailsBooking.booking_source === "agent" || inspectorNotes.agent_name) && (
                <div
                  className="cio-guest-section-card"
                  style={{ background: "#fffbeb", borderColor: "#fde68a" }}
                >
                  <div className="cio-card-badge-header">
                    <span
                      className="cio-badge-tag"
                      style={{
                        background: "#fef3c7",
                        color: "#b45309",
                        border: "1px solid #fde68a",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Briefcase size={12} /> AGENT REFERRAL DETAILS
                    </span>
                  </div>
                  <div className="details-two-col-grid" style={{ marginTop: "10px" }}>
                    <div className="info-kv">
                      <span>Agent Name</span>
                      <strong style={{ color: "#92400e" }}>
                        {inspectorNotes.agent_name || "Agent Referral"}
                      </strong>
                    </div>
                    {inspectorNotes.agent_phone && (
                      <div className="info-kv">
                        <span>Agent Contact</span>
                        <strong>{inspectorNotes.agent_phone}</strong>
                      </div>
                    )}
                    {inspectorNotes.agent_notes && (
                      <div className="info-kv" style={{ gridColumn: "1 / -1" }}>
                        <span>Commission / Notes</span>
                        <p style={{ margin: 0, fontSize: "12.5px", color: "#78350f" }}>
                          {inspectorNotes.agent_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* International Guest & Form C Compliance Card */}
              {Boolean(
                (getGuest(selectedDetailsBooking.guest_id)?.nationality && getGuest(selectedDetailsBooking.guest_id).nationality.toLowerCase().trim() !== "indian") ||
                (inspectorNotes.formC?.nationality && inspectorNotes.formC.nationality.toLowerCase().trim() !== "indian") ||
                inspectorNotes.formC?.visa_number ||
                inspectorNotes.formC?.passport_expiry ||
                getGuest(selectedDetailsBooking.guest_id)?.id_type === "Passport"
              ) && (
                <div
                  className="cio-guest-section-card"
                  style={{ background: "#fdf4ff", borderColor: "#f0abfc" }}
                >
                  <div
                    className="cio-card-badge-header"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span
                      className="cio-badge-tag"
                      style={{
                        background: "#fae8ff",
                        color: "#86198f",
                        border: "1px solid #f0abfc",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Globe size={12} /> INTERNATIONAL GUEST • FORM C RECORD (FRRO)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyFormC(selectedDetailsBooking)}
                      style={{
                        padding: "3px 8px",
                        background: "#ffffff",
                        border: "1px solid #e879f9",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#86198f",
                        cursor: "pointer",
                      }}
                      title="Copy details formatted for Bureau of Immigration portal"
                    >
                      Copy Form C
                    </button>
                  </div>
                  <div className="details-two-col-grid" style={{ marginTop: "10px" }}>
                    <div className="info-kv">
                      <span>Nationality</span>
                      <strong style={{ color: "#701a75" }}>
                        {getGuest(selectedDetailsBooking.guest_id)?.nationality || inspectorNotes.formC?.nationality || "Foreign"}
                      </strong>
                    </div>
                    <div className="info-kv">
                      <span>Passport Expiry</span>
                      <strong>{inspectorNotes.formC?.passport_expiry || "Not Specified"}</strong>
                    </div>
                    <div className="info-kv">
                      <span>Visa / e-Visa Number</span>
                      <strong>{inspectorNotes.formC?.visa_number || "On File / e-Visa"}</strong>
                    </div>
                    <div className="info-kv">
                      <span>Visa Type</span>
                      <strong>{inspectorNotes.formC?.visa_type || "Tourist (e-Visa / Regular)"}</strong>
                    </div>
                    <div className="info-kv">
                      <span>Visa Valid Until</span>
                      <strong>{inspectorNotes.formC?.visa_expiry || "-"}</strong>
                    </div>
                    <div className="info-kv">
                      <span>Date of Arrival in India</span>
                      <strong>{inspectorNotes.formC?.date_of_arrival_in_country || "-"}</strong>
                    </div>
                    <div className="info-kv">
                      <span>Port of Entry</span>
                      <strong>{inspectorNotes.formC?.port_of_entry || "-"}</strong>
                    </div>
                    <div className="info-kv">
                      <span>Next Destination</span>
                      <strong>{inspectorNotes.formC?.next_destination || "-"}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="cio-guest-section-card room-stay-card">
                <div className="cio-card-badge-header">
                  <span className="cio-badge-tag room">
                    <BedDouble size={12} /> ROOM ALLOCATION & STAY DATES
                  </span>
                </div>

                <div className="room-allocation-header-strip">
                  <div className="room-pills-row">
                    {Array.isArray(selectedDetailsBooking.assigned_room_ids) && selectedDetailsBooking.assigned_room_ids.length > 0 ? (
                      selectedDetailsBooking.assigned_room_ids.map((id) => {
                        const r = getRoom(id);
                        return (
                          <div key={id} className="room-allocation-badge">
                            <span className="badge-room-num">Room {r?.room_number || id}</span>
                            <span className="badge-room-meta">{r?.room_type || "Std"}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="room-allocation-badge">
                        <span className="badge-room-num">Room {getRoom(selectedDetailsBooking.room_id)?.room_number || selectedDetailsBooking.room_id}</span>
                        <span className="badge-room-meta">{getRoom(selectedDetailsBooking.room_id)?.room_type || "Std"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="details-two-col-grid" style={{ marginTop: "14px" }}>
                  <div className="info-kv">
                    <span>Occupancy Breakdown</span>
                    <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Users size={14} color="#64748b" />
                      {selectedDetailsBooking.adults || 1} Adult(s), {selectedDetailsBooking.children || 0} Child(ren)
                    </strong>
                  </div>
                  <div className="info-kv">
                    <span>Rooms Reserved</span>
                    <strong>{selectedDetailsBooking.rooms_count || 1} Total Room(s)</strong>
                  </div>
                  <div className="info-kv">
                    <span>Check-In Date & Time</span>
                    <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={14} color="#059669" />
                      {new Date(selectedDetailsBooking.checkin_date).toLocaleString()}
                    </strong>
                  </div>
                  <div className="info-kv">
                    <span>Check-Out Date & Time</span>
                    <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={14} color="#ea580c" />
                      {new Date(selectedDetailsBooking.checkout_date).toLocaleString()}
                    </strong>
                  </div>
                  <div className="info-kv">
                    <span>Stay Duration</span>
                    <strong style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1e40af" }}>
                      <Clock size={14} color="#2563eb" />
                      {(() => {
                        if (!selectedDetailsBooking.checkin_date || !selectedDetailsBooking.checkout_date) return "1 Night";
                        const inStr = String(selectedDetailsBooking.checkin_date).split("T")[0];
                        const outStr = String(selectedDetailsBooking.checkout_date).split("T")[0];
                        const stay = calculateHospitalityStay({
                          checkinDateStr: inStr,
                          checkoutDateStr: outStr,
                        });
                        return stay.stay_label;
                      })()}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="cio-co-guests-wrapper">
                <div className="cio-section-title-row">
                  <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                    Accompanying Co-Guests ({selectedDetailsBooking.co_guests?.length || 0})
                  </h4>
                </div>

                {!selectedDetailsBooking.co_guests || selectedDetailsBooking.co_guests.length === 0 ? (
                  <div className="cio-no-co-guests">
                    <Users size={18} color="#94a3b8" />
                    <span>No secondary guests recorded on this reservation.</span>
                  </div>
                ) : (
                  <div className="cio-co-guests-list">
                    {selectedDetailsBooking.co_guests.map((cg, i) => (
                      <div key={i} className="cio-co-guest-card inspector-view">
                        <div className="details-two-col-grid">
                          <div className="info-kv">
                            <span>Guest #{i + 2} Name</span>
                            <strong>{cg.full_name} ({cg.gender?.toUpperCase() || "MALE"}, {cg.age || "-"} Yrs)</strong>
                          </div>
                          <div className="info-kv">
                            <span>ID Document</span>
                            <strong>{cg.id_type || "ID"}: {cg.id_number ? "[Aadhaar Redacted]" : "Document on file"}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cio-payment-settle-card">
                <div className="cio-card-badge-header">
                  <span className="cio-badge-tag financial">
                    <Wallet size={12} /> FINANCIAL BREAKDOWN
                  </span>
                </div>
                <div className="details-two-col-grid" style={{ marginTop: "12px" }}>
                  <div className="info-kv">
                    <span>Total Bill Amount</span>
                    <strong style={{ fontSize: "16px", color: "#166962", fontWeight: 800 }}>
                      ₹{Number(selectedDetailsBooking.total_amount || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="info-kv">
                    <span>Advance Collected</span>
                    <strong style={{ fontSize: "16px", fontWeight: 700 }}>
                      ₹{Number(selectedDetailsBooking.advance_paid || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="info-kv">
                    <span>Payment Method</span>
                    <strong style={{ textTransform: "uppercase" }}>{selectedDetailsBooking.payment_method || "CASH"}</strong>
                  </div>
                  <div className="info-kv">
                    <span>Settlement Status</span>
                    <strong style={{ textTransform: "uppercase", color: selectedDetailsBooking.payment_status === "paid" ? "#166962" : "#dc2626" }}>
                      {selectedDetailsBooking.payment_status}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ background: "#f8fafc" }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setSelectedDetailsBooking(null)}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. RESERVATION PRE-CHECK-IN VERIFICATION MODAL */}
      {checkInModalOpen && checkingInBooking && (
        <div className="modal-overlay nested-modal" onClick={() => !submittingCheckIn && setCheckInModalOpen(false)}>
          <div
            className="modal-content cio-checkin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Check-In Registration &bull; {checkingInBooking.reservation_code || `Booking #${checkingInBooking.id}`}</h2>
                <p className="modal-kicker">Verify guest documents and register accompanying occupants before room allocation.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCheckInModalOpen(false)}
                disabled={submittingCheckIn}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCheckInSubmit}>
              <div className="modal-body" style={{ gap: "18px" }}>
                {/* Stay Timing & Downtime Override Card */}
                <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Clock size={16} color="#0f766e" />
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>Check-In & Stay Timings</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckInForm((prev) => ({
                          ...prev,
                          checkin_date: getTodayInputDate(),
                          checkin_time: getCurrentInputTime(),
                        }));
                      }}
                      disabled={submittingCheckIn}
                      style={{
                        padding: "4px 10px",
                        background: "#f0fdf4",
                        color: "#166534",
                        border: "1px solid #86efac",
                        borderRadius: "6px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                      title="Sync check-in time with the current live clock"
                    >
                      <RotateCcw size={12} /> Auto Current Time
                    </button>
                  </div>
                  <div className="form-row" style={{ gridTemplateColumns: "1.2fr 0.8fr 1.2fr 0.8fr", gap: "10px" }}>
                    <div className="form-group">
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Check-In Date *</label>
                      <input
                        type="date"
                        value={checkInForm.checkin_date || getTodayInputDate()}
                        onChange={(e) => setCheckInForm({ ...checkInForm, checkin_date: e.target.value })}
                        disabled={submittingCheckIn}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Check-In Time *</label>
                      <input
                        type="time"
                        value={checkInForm.checkin_time || "11:00"}
                        onChange={(e) => setCheckInForm({ ...checkInForm, checkin_time: e.target.value })}
                        disabled={submittingCheckIn}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Checkout Date *</label>
                      <input
                        type="date"
                        value={checkInForm.checkout_date || getTomorrowInputDate()}
                        onChange={(e) => setCheckInForm({ ...checkInForm, checkout_date: e.target.value })}
                        disabled={submittingCheckIn}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Checkout Time</label>
                      <input
                        type="time"
                        value={checkInForm.checkout_time || "11:00"}
                        onChange={(e) => setCheckInForm({ ...checkInForm, checkout_time: e.target.value })}
                        disabled={submittingCheckIn}
                      />
                    </div>
                  </div>
                  <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#64748b" }}>
                    💡 Live clock time auto-detected. In case of software downtime or delayed record entry, adjust the check-in time manually.
                  </p>
                </div>

                <div className="cio-guest-section-card primary-card">
                  <div className="cio-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className="cio-guest-avatar">
                        <User size={16} />
                      </div>
                      <div>
                        <span className="cio-badge-tag primary">PRIMARY GUEST</span>
                        <h4 className="cio-guest-title">{getGuest(checkingInBooking.guest_id)?.full_name || "Primary Guest"}</h4>
                      </div>
                    </div>

                    {/* Toggle Foreign Guest / Form C */}
                    {(() => {
                      const isCheckInForeign = Boolean(
                        checkInForm.is_international ||
                        (checkInForm.nationality && checkInForm.nationality.toLowerCase().trim() !== "indian") ||
                        checkInForm.primary_id_type === "Passport"
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (submittingCheckIn) return;
                            const nextVal = !isCheckInForeign;
                            setCheckInForm((prev) => ({
                              ...prev,
                              is_international: nextVal,
                              nationality: nextVal
                                ? prev.nationality && prev.nationality.toLowerCase().trim() !== "indian"
                                  ? prev.nationality
                                  : ""
                                : "Indian",
                              primary_id_type:
                                nextVal && prev.primary_id_type === "Aadhaar" ? "Passport" : prev.primary_id_type,
                            }));
                          }}
                          disabled={submittingCheckIn}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "5px 12px",
                            borderRadius: "20px",
                            border: isCheckInForeign ? "1.5px solid #a855f7" : "1.5px solid #cbd5e1",
                            background: isCheckInForeign ? "#fae8ff" : "#ffffff",
                            color: isCheckInForeign ? "#701a75" : "#475569",
                            fontWeight: 600,
                            fontSize: "11.5px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <Globe size={13} color={isCheckInForeign ? "#9333ea" : "#64748b"} />
                          <span>{isCheckInForeign ? "Foreign Guest (Form C)" : "Foreign Guest / Form C"}</span>
                        </button>
                      );
                    })()}
                  </div>

                  <div className="form-row" style={{ marginTop: "12px", gridTemplateColumns: "1.2fr 1.2fr 1fr" }}>
                    <div className="form-group">
                      <label>ID Proof Type *</label>
                      <select
                        value={checkInForm.primary_id_type}
                        onChange={(e) => setCheckInForm({ ...checkInForm, primary_id_type: e.target.value })}
                        className="dir-select-field"
                        required
                        disabled={submittingCheckIn}
                      >
                        <option value="Aadhaar">Aadhaar Card</option>
                        <option value="Passport">Passport</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Voter ID">Voter ID</option>
                        <option value="Other">Other ID</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>ID Proof Number *</label>
                      <input
                        type="text"
                        value={checkInForm.primary_id_number}
                        onChange={(e) => setCheckInForm({ ...checkInForm, primary_id_number: e.target.value })}
                        placeholder="Enter Government ID Number"
                        required
                        disabled={submittingCheckIn}
                      />
                    </div>
                    <div className="form-group">
                      <label>Nationality</label>
                      <input
                        type="text"
                        value={checkInForm.nationality || "Indian"}
                        onChange={(e) => setCheckInForm({ ...checkInForm, nationality: e.target.value })}
                        placeholder="e.g. Indian, American, British"
                        disabled={submittingCheckIn}
                      />
                    </div>
                  </div>
                </div>

                {/* Form C / International Guest Compliance (Check-In Verification) */}
                {(checkInForm.is_international ||
                  (checkInForm.nationality && checkInForm.nationality.toLowerCase().trim() !== "indian") ||
                  checkInForm.primary_id_type === "Passport") && (
                  <div
                    className="corporate-details-box"
                    style={{
                      background: "#fdf4ff",
                      borderColor: "#f0abfc",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #f0abfc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #fae8ff",
                        paddingBottom: "8px",
                        marginBottom: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#86198f", fontWeight: 700, fontSize: "13px" }}>
                        <Globe size={16} color="#86198f" />
                        <span>International Guest • Form C Registration (Bureau of Immigration / FRRO)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#701a75",
                            background: "#f5d0fe",
                            padding: "2px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          Mandatory &bull; 24h Filing
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyFormC(checkingInBooking)}
                          style={{
                            padding: "3px 8px",
                            background: "#ffffff",
                            border: "1px solid #e879f9",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#86198f",
                            cursor: "pointer",
                          }}
                          title="Copy details formatted for FRRO portal"
                        >
                          Copy Form C
                        </button>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Passport Expiry Date</label>
                        <input
                          type="date"
                          value={checkInForm.passport_expiry || ""}
                          onChange={(e) => setCheckInForm({ ...checkInForm, passport_expiry: e.target.value })}
                          disabled={submittingCheckIn}
                        />
                      </div>
                      <div className="form-group">
                        <label>Visa / e-Visa Number</label>
                        <input
                          type="text"
                          value={checkInForm.visa_number || ""}
                          onChange={(e) => setCheckInForm({ ...checkInForm, visa_number: e.target.value })}
                          placeholder="e.g. V981240 / e-Visa ref"
                          disabled={submittingCheckIn}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Visa Type</label>
                        <select
                          value={checkInForm.visa_type || "Tourist (e-Visa / Regular)"}
                          onChange={(e) => setCheckInForm({ ...checkInForm, visa_type: e.target.value })}
                          disabled={submittingCheckIn}
                          className="dir-select-field"
                        >
                          {VISA_TYPES.map((vt) => (
                            <option key={vt} value={vt}>
                              {vt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Visa Valid Until / Expiry Date</label>
                        <input
                          type="date"
                          value={checkInForm.visa_expiry || ""}
                          onChange={(e) => setCheckInForm({ ...checkInForm, visa_expiry: e.target.value })}
                          disabled={submittingCheckIn}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Port of Entry into India</label>
                        <input
                          type="text"
                          value={checkInForm.port_of_entry || ""}
                          onChange={(e) => setCheckInForm({ ...checkInForm, port_of_entry: e.target.value })}
                          placeholder="e.g. Delhi (DEL), Mumbai (BOM), Bengaluru (BLR)"
                          disabled={submittingCheckIn}
                        />
                      </div>
                      <div className="form-group">
                        <label>Date of Arrival in India</label>
                        <input
                          type="date"
                          value={checkInForm.date_of_arrival_in_country || ""}
                          onChange={(e) => setCheckInForm({ ...checkInForm, date_of_arrival_in_country: e.target.value })}
                          disabled={submittingCheckIn}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: "4px" }}>
                      <label>Next Destination / City & Country</label>
                      <input
                        type="text"
                        value={checkInForm.next_destination || ""}
                        onChange={(e) => setCheckInForm({ ...checkInForm, next_destination: e.target.value })}
                        placeholder="e.g. Agra, India or London, UK"
                        disabled={submittingCheckIn}
                      />
                    </div>
                  </div>
                )}

                <div className="cio-co-guests-wrapper">
                  <div className="cio-section-title-row">
                    <div>
                      <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                        Accompanying Co-Guests ({checkInForm.co_guests.length})
                      </h4>
                      <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                        Register everyone staying in the room for hotel compliance
                      </span>
                    </div>
                    <button
                      type="button"
                      className="cio-btn-add-guest"
                      onClick={() =>
                        setCheckInForm({
                          ...checkInForm,
                          co_guests: [
                            { full_name: "", gender: "male", age: "", id_type: "Aadhaar", id_number: "" },
                            ...checkInForm.co_guests,
                          ],
                        })
                      }
                      disabled={submittingCheckIn}
                    >
                      <Plus size={14} /> Add Co-Guest
                    </button>
                  </div>

                  {checkInForm.co_guests.length === 0 ? (
                    <div className="cio-no-co-guests">
                      <Users size={20} color="#94a3b8" />
                      <span>Single occupant reservation. No additional guest slots needed.</span>
                    </div>
                  ) : (
                    <div className="cio-co-guests-list">
                      {checkInForm.co_guests.map((cg, idx) => (
                        <div key={idx} className="cio-co-guest-card">
                          <div className="cio-card-mini-header">
                            <span className="guest-slot-badge">GUEST #{idx + 2}</span>
                            <button
                              type="button"
                              className="btn-remove-coguest"
                              title="Remove Guest"
                              onClick={() => {
                                const updated = checkInForm.co_guests.filter((_, i) => i !== idx);
                                setCheckInForm({ ...checkInForm, co_guests: updated });
                              }}
                              disabled={submittingCheckIn}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="form-row" style={{ gridTemplateColumns: "1.8fr 1fr 0.8fr", gap: "10px" }}>
                            <div className="form-group">
                              <label>Full Name *</label>
                              <input
                                type="text"
                                placeholder="Full name"
                                value={cg.full_name}
                                onChange={(e) => {
                                  const updated = [...checkInForm.co_guests];
                                  updated[idx].full_name = e.target.value;
                                  setCheckInForm({ ...checkInForm, co_guests: updated });
                                }}
                                disabled={submittingCheckIn}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Gender</label>
                              <select
                                value={cg.gender}
                                onChange={(e) => {
                                  const updated = [...checkInForm.co_guests];
                                  updated[idx].gender = e.target.value;
                                  setCheckInForm({ ...checkInForm, co_guests: updated });
                                }}
                                className="dir-select-field"
                                disabled={submittingCheckIn}
                              >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Age</label>
                              <input
                                type="number"
                                placeholder="Age"
                                min="1"
                                max="120"
                                value={cg.age}
                                onChange={(e) => {
                                  const updated = [...checkInForm.co_guests];
                                  updated[idx].age = e.target.value;
                                  setCheckInForm({ ...checkInForm, co_guests: updated });
                                }}
                                disabled={submittingCheckIn}
                              />
                            </div>
                          </div>

                          <div className="form-row" style={{ gridTemplateColumns: "1fr 1.5fr", gap: "10px", marginTop: "8px" }}>
                            <div className="form-group">
                              <label>ID Proof Type</label>
                              <select
                                value={cg.id_type}
                                onChange={(e) => {
                                  const updated = [...checkInForm.co_guests];
                                  updated[idx].id_type = e.target.value;
                                  setCheckInForm({ ...checkInForm, co_guests: updated });
                                }}
                                className="dir-select-field"
                                disabled={submittingCheckIn}
                              >
                                <option value="Aadhaar">Aadhaar Card</option>
                                <option value="Passport">Passport</option>
                                <option value="Driving License">Driving License</option>
                                <option value="Voter ID">Voter ID</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>ID Document Number</label>
                              <input
                                type="text"
                                placeholder="Document ID number (Optional)"
                                value={cg.id_number}
                                onChange={(e) => {
                                  const updated = [...checkInForm.co_guests];
                                  updated[idx].id_number = e.target.value;
                                  setCheckInForm({ ...checkInForm, co_guests: updated });
                                }}
                                disabled={submittingCheckIn}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(() => {
                  const total = Number(checkingInBooking.total_amount || 0);
                  const adv = Number(checkingInBooking.advance_paid || 0);
                  const due = Math.max(0, total - adv);
                  const nights = checkingInBooking.nights_count || 1;
                  const rate = Number(checkingInBooking.room_rate || (total / nights).toFixed(2));
                  const stayLabel = checkingInBooking.stay_label || `${nights + 1} Days / ${nights} Night(s)`;

                  return (
                    <div className="cio-payment-settle-card" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                          <Wallet size={16} color="#166962" />
                          <span>STAY BILLING & PAYMENT COLLECTION</span>
                        </div>
                        <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 10px", borderRadius: "12px", fontSize: "11.5px", fontWeight: 800 }}>
                          {stayLabel}
                        </span>
                      </div>

                      <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "12px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", fontSize: "12px" }}>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Nightly Rate</span>
                            <strong style={{ fontSize: "14px", color: "#0f172a" }}>₹{rate.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Stay Duration</span>
                            <strong style={{ fontSize: "14px", color: "#0f172a" }}>{nights} Night{nights > 1 ? "s" : ""}</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Total Stay Tariff</span>
                            <strong style={{ fontSize: "14px", color: "#166962" }}>₹{total.toFixed(2)}</strong>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed #cbd5e1" }}>
                          <span style={{ fontSize: "12px", color: "#15803d" }}>Advance Already Paid: <strong>₹{adv.toFixed(2)}</strong></span>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: due > 0 ? "#ea580c" : "#16a34a" }}>
                            Net Due at Check-In: ₹{due.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="form-row" style={{ gridTemplateColumns: "1.2fr 1.8fr" }}>
                        <div className="form-group">
                          <label style={{ fontWeight: 700 }}>Collect Payment Now (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={checkInForm.collect_payment}
                            onChange={(e) => setCheckInForm({ ...checkInForm, collect_payment: e.target.value })}
                            disabled={submittingCheckIn}
                            style={{ fontWeight: 800, fontSize: "16px", color: "#166962" }}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontWeight: 700 }}>Payment Method *</label>
                          <select
                            value={checkInForm.payment_method}
                            onChange={(e) => setCheckInForm({ ...checkInForm, payment_method: e.target.value })}
                            className="dir-select-field"
                            disabled={submittingCheckIn}
                            style={{ fontWeight: 700 }}
                          >
                            {paymentMethods.map((m) => (
                              <option key={m} value={m}>
                                {m.replace("_", " ").toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setCheckInModalOpen(false)}
                  disabled={submittingCheckIn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submittingCheckIn}
                >
                  <LogIn size={14} /> {submittingCheckIn ? "Processing..." : "Complete Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CHECKOUT & FOLIO SETTLEMENT MODAL */}
      {checkoutModalOpen && checkingOutBooking && (
        <div className="modal-overlay nested-modal" onClick={() => !submittingCheckout && setCheckoutModalOpen(false)}>
          <div
            className="modal-content cio-checkout-settle-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="staff-avatar checkout-avatar">
                  <LogOut size={16} />
                </div>
                <div>
                  <h2>Check-Out Folio Settlement &bull; {checkingOutBooking.reservation_code || `Booking #${checkingOutBooking.id}`}</h2>
                  <p className="modal-kicker">Review departmental charges, record final payment or refund, and issue invoice.</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCheckoutModalOpen(false)}
                disabled={submittingCheckout}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSettleAndCheckout}>
              <div className="modal-body" style={{ gap: "16px" }}>
                {loadingFolio ? (
                  <div className="folio-loading-box">
                    <Clock size={20} className="spin-icon" />
                    <span>Consolidating room tariff, food orders, and minibar consumption...</span>
                  </div>
                ) : (
                  <>
                    {/* Live Server Overstay Banner */}
                    {Number(folioData?.extra_nights || 0) > 0 && (
                      <div className="balance-alert-banner due-banner" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <AlertTriangle size={16} color="#2563eb" />
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e40af" }}>
                            Automated Overstay Detected: {folioData.extra_nights} extra day(s) (+₹{Number(folioData.extra_room_charges).toFixed(2)}) applied.
                          </span>
                        </div>
                        <span className="mono-pill pill-warning" style={{ fontSize: "11px" }}>OVERSTAY</span>
                      </div>
                    )}

                    {computedCheckoutDue > 0 && (
                      <div className="balance-alert-banner due-banner">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Shield size={16} color="#c2410c" />
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#9a3412" }}>
                            Outstanding balance remaining: ₹{computedCheckoutDue.toFixed(2)}
                          </span>
                        </div>
                        <span className="mono-pill pill-warning" style={{ fontSize: "11px" }}>
                          PARTIALLY PAID
                        </span>
                      </div>
                    )}

                    {computedRefundDue > 0 && (
                      <div className="balance-alert-banner refund-banner">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <RotateCcw size={16} color="#6d28d9" />
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#6d28d9" }}>
                            Refund due to guest: ₹{computedRefundDue.toFixed(2)} (Advance exceeds folio total)
                          </span>
                        </div>
                        <span className="mono-pill pill-purple" style={{ fontSize: "11px" }}>
                          OVERPAID (REFUND DUE)
                        </span>
                      </div>
                    )}

                    <div className="cio-folio-card">
                      <div className="cio-card-badge-header">
                        <span className="cio-badge-tag financial">
                          <Receipt size={12} /> CONSOLIDATED CHARGES
                        </span>
                        <span className="folio-guest-name">
                          Guest: {getGuest(checkingOutBooking.guest_id)?.full_name} &bull; Ref: {checkingOutBooking.reservation_code || `#${checkingOutBooking.id}`}
                        </span>
                      </div>

                      <div className="folio-breakdown-list">
                        <div className="folio-item-row">
                          <span className="item-label">
                            <BedDouble size={14} color="#2d5696" /> Room Stay Charges ({checkingOutBooking.rooms_count || 1} Room(s))
                          </span>
                          <strong className="item-amt">
                            ₹{Number(folioData?.room_charges || 0).toFixed(2)}
                            {Number(folioData?.extra_nights || 0) > 0 && ` (Incl. ₹${Number(folioData.extra_room_charges).toFixed(2)} Overstay)`}
                          </strong>
                        </div>

                        {Number(folioData?.restaurant_charges || 0) > 0 && (
                          <div className="folio-item-row">
                            <span className="item-label">
                              <Utensils size={14} color="#d97706" /> Restaurant & In-Room Dining
                            </span>
                            <strong className="item-amt">₹{Number(folioData?.restaurant_charges || 0).toFixed(2)}</strong>
                          </div>
                        )}

                        {Number(folioData?.minibar_charges || 0) > 0 && (
                          <div className="folio-item-row">
                            <span className="item-label">
                              <Wine size={14} color="#9333ea" /> Minibar Consumption
                            </span>
                            <strong className="item-amt">₹{Number(folioData?.minibar_charges || 0).toFixed(2)}</strong>
                          </div>
                        )}

                        {Number(folioData?.laundry_charges || 0) > 0 && (
                          <div className="folio-item-row">
                            <span className="item-label">
                              <Shirt size={14} color="#0284c7" /> Laundry Services
                            </span>
                            <strong className="item-amt">₹{Number(folioData?.laundry_charges || 0).toFixed(2)}</strong>
                          </div>
                        )}

                        {Number(folioData?.extra_charges || 0) > 0 && (
                          <div className="folio-item-row">
                            <span className="item-label">
                              <Sparkles size={14} color="#059669" /> Extra Services & Amenities
                            </span>
                            <strong className="item-amt">₹{Number(folioData?.extra_charges || 0).toFixed(2)}</strong>
                          </div>
                        )}
                      </div>

                      <div className="folio-summary-bar">
                        <div className="sum-col">
                          <span>Total Folio</span>
                          <strong>₹{Number(folioData?.grand_total || 0).toFixed(2)}</strong>
                        </div>
                        <div className="sum-col">
                          <span>Advance Paid</span>
                          <strong style={{ color: "#059669" }}>₹{Number(folioData?.advance_paid || 0).toFixed(2)}</strong>
                        </div>
                        <div className="sum-col">
                          <span>Net Balance</span>
                          {computedRefundDue > 0 ? (
                            <strong style={{ color: "#7c3aed", fontSize: "15px" }}>
                              Refund: ₹{computedRefundDue.toFixed(2)}
                            </strong>
                          ) : (
                            <strong style={{ color: computedCheckoutDue > 0 ? "#dc2626" : "#059669", fontSize: "15px" }}>
                              Due: ₹{computedCheckoutDue.toFixed(2)}
                            </strong>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="cio-payment-settle-card">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Checkout Discount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settlementForm.discount}
                            onChange={(e) => setSettlementForm({ ...settlementForm, discount: e.target.value })}
                            disabled={submittingCheckout}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="form-group">
                          <label>
                            {computedRefundDue > 0 ? "Disbursement Method (Refund)" : "Payment Settlement"}
                          </label>
                          <select
                            value={settlementForm.payment_method}
                            onChange={(e) => setSettlementForm({ ...settlementForm, payment_method: e.target.value })}
                            className="dir-select-field"
                            disabled={submittingCheckout}
                          >
                            {paymentMethods.map((m) => (
                              <option key={m} value={m}>
                                {m.replace("_", " ").toUpperCase()}
                              </option>
                            ))}
                            {computedRefundDue === 0 && (
                              <option value="unpaid">LEAVE OUTSTANDING (UNPAID)</option>
                            )}
                          </select>
                        </div>
                      </div>

                      {settlementForm.payment_method !== "cash" && settlementForm.payment_method !== "unpaid" && (
                        <div className="form-group" style={{ marginTop: "10px" }}>
                          <label>Transaction / Reference ID (Optional)</label>
                          <input
                            type="text"
                            placeholder="UPI Ref, Card Auth Code, or Cheque #"
                            value={settlementForm.transaction_id}
                            onChange={(e) => setSettlementForm({ ...settlementForm, transaction_id: e.target.value })}
                            disabled={submittingCheckout}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setCheckoutModalOpen(false)}
                  disabled={submittingCheckout}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cio-action-btn checkout"
                  style={{
                    height: "38px",
                    padding: "0 22px",
                    background: computedRefundDue > 0 ? "#7c3aed" : undefined,
                  }}
                  disabled={submittingCheckout || loadingFolio}
                >
                  <LogOut size={14} />{" "}
                  {submittingCheckout
                    ? "Processing..."
                    : computedRefundDue > 0
                    ? `Settle & Disburse Refund (₹${computedRefundDue.toFixed(2)})`
                    : computedCheckoutDue > 0 && settlementForm.payment_method === "unpaid"
                    ? "Checkout with Outstanding Balance"
                    : "Settle & Complete Checkout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. QUICK MULTI-ROOM WALK-IN MODAL */}
      {showWalkInModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!savingWalkIn) {
              setShowWalkInModal(false);
              setSelectedReturningGuestId("");
            }
          }}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "760px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: "10px" }}>
                <div>
                  <h2>Quick Walk-In Registration</h2>
                  <p className="modal-kicker">Immediate check-in, co-guest compliance & same-day room onboarding</p>
                </div>
                {(() => {
                  const isWalkInForeign = Boolean(
                    walkInForm.is_international ||
                    (walkInForm.nationality && walkInForm.nationality.toLowerCase().trim() !== "indian") ||
                    walkInForm.id_proof_type === "Passport"
                  );
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (savingWalkIn) return;
                        const nextVal = !isWalkInForeign;
                        setWalkInForm((prev) => ({
                          ...prev,
                          is_international: nextVal,
                          nationality: nextVal
                            ? prev.nationality && prev.nationality.toLowerCase().trim() !== "indian"
                              ? prev.nationality
                              : ""
                            : "Indian",
                          id_proof_type:
                            nextVal && prev.id_proof_type === "Aadhaar" ? "Passport" : prev.id_proof_type,
                        }));
                      }}
                      disabled={savingWalkIn}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        borderRadius: "20px",
                        border: isWalkInForeign ? "1.5px solid #a855f7" : "1.5px solid #cbd5e1",
                        background: isWalkInForeign ? "#fae8ff" : "#ffffff",
                        color: isWalkInForeign ? "#701a75" : "#475569",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                        boxShadow: isWalkInForeign ? "0 2px 4px rgba(168, 85, 247, 0.2)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Globe size={14} color={isWalkInForeign ? "#9333ea" : "#64748b"} />
                      <span>{isWalkInForeign ? "Foreign Guest (Form C)" : "Foreign Guest / Form C"}</span>
                    </button>
                  );
                })()}
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowWalkInModal(false);
                  setSelectedReturningGuestId("");
                }}
                disabled={savingWalkIn}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleWalkInSubmit}>
              <div className="modal-body">
                {/* Quick-Select Returning Guest Picker */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Users size={14} color="#2d5696" />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                        Quick-Select Returning Guest
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        (Auto-fills details from directory)
                      </span>
                    </div>
                    {selectedReturningGuestId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReturningGuestId("");
                          setWalkInForm((prev) => ({
                            ...prev,
                            full_name: "",
                            phone: "",
                            email: "",
                            address: "",
                            nationality: "Indian",
                            is_international: false,
                            id_proof_type: "Aadhaar",
                            id_proof_number: "",
                            passport_expiry: "",
                            visa_number: "",
                            visa_expiry: "",
                            date_of_arrival_in_country: "",
                            port_of_entry: "",
                            next_destination: "",
                          }));
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "2px 6px",
                        }}
                      >
                        Clear Profile
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <select
                        className="dir-select-field"
                        style={{ fontSize: "12.5px", width: "100%", height: "36px", padding: "4px 10px" }}
                        value={selectedReturningGuestId}
                        onChange={(e) => handleSelectReturningGuest(e.target.value)}
                        disabled={savingWalkIn}
                      >
                        <option value="">-- Choose Existing Guest from Directory ({guests.length} Available) --</option>
                        {guests.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.full_name} • {g.phone} {g.nationality && g.nationality.toLowerCase().trim() !== "indian" ? `[${g.nationality}]` : ""} {g.address ? `• ${g.address}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedReturningGuestId && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        color: "#065f46",
                      }}
                    >
                      <CheckCircle size={13} color="#059669" />
                      <span>
                        Profile loaded: <strong>{walkInForm.full_name}</strong> • Phone: {walkInForm.phone}
                        {walkInForm.nationality ? ` • ${walkInForm.nationality}` : ""}
                        {walkInForm.id_proof_type ? ` • ${walkInForm.id_proof_type}: ${walkInForm.id_proof_number || "(No ID #)"}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary Guest Details */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Guest Full Name *</label>
                    <input
                      type="text"
                      name="full_name"
                      required
                      placeholder="Enter guest name"
                      value={walkInForm.full_name}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      name="phone"
                      required
                      placeholder="10-digit mobile number"
                      value={walkInForm.phone}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                    {(() => {
                      const cleanPhone = (walkInForm.phone || "").trim();
                      if (cleanPhone.length >= 7 && !selectedReturningGuestId) {
                        const matched = guests.find((g) => String(g.phone || "").trim() === cleanPhone);
                        if (matched) {
                          return (
                            <div
                              style={{
                                marginTop: "5px",
                                fontSize: "11.5px",
                                color: "#1d4ed8",
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>Existing guest found: <strong>{matched.full_name}</strong></span>
                              <button
                                type="button"
                                onClick={() => handleSelectReturningGuest(matched.id)}
                                style={{
                                  background: "#2563eb",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "2px 8px",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Auto-fill Details
                              </button>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      placeholder="guest@example.com"
                      value={walkInForm.email}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>

                  <div className="form-group">
                    <label>Guest Classification</label>
                    <select
                      name="guest_type"
                      value={walkInForm.guest_type}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                      className="dir-select-field"
                    >
                      <option value="individual">Individual Guest</option>
                      <option value="corporate">Corporate (Company GST Billing)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Booking Source</label>
                    <select
                      name="booking_source"
                      value={walkInForm.booking_source}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                      className="dir-select-field"
                    >
                      <option value="walk-in">Direct Walk-In</option>
                      <option value="agent">Agent Referral</option>
                      <option value="phone">Phone Inquiry</option>
                      <option value="corporate">Corporate Direct</option>
                      <option value="ota">OTA / Channel</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Agent Referral Details */}
                {walkInForm.booking_source === "agent" && (
                  <div
                    className="corporate-details-box"
                    style={{
                      background: "#fffbeb",
                      borderColor: "#fde68a",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      marginBottom: "14px",
                      border: "1px solid #fde68a",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "10px",
                        color: "#b45309",
                        fontWeight: 700,
                        fontSize: "13px",
                      }}
                    >
                      <Briefcase size={16} color="#b45309" />
                      <span>Agent Referral Details</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Agent Name *</label>
                        <input
                          type="text"
                          name="agent_name"
                          value={walkInForm.agent_name || ""}
                          onChange={handleWalkInChange}
                          placeholder="e.g. City Travels, Ramesh, Tour Desk"
                          disabled={savingWalkIn}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Agent Phone Number (Optional)</label>
                        <input
                          type="tel"
                          name="agent_phone"
                          value={walkInForm.agent_phone || ""}
                          onChange={handleWalkInChange}
                          placeholder="10-digit mobile number"
                          disabled={savingWalkIn}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginTop: "6px" }}>
                      <label>Commission / Referral Notes (Optional)</label>
                      <input
                        type="text"
                        name="agent_notes"
                        value={walkInForm.agent_notes || ""}
                        onChange={handleWalkInChange}
                        placeholder="e.g. ₹500 referral commission or 10% on checkout"
                        disabled={savingWalkIn}
                      />
                    </div>
                  </div>
                )}

                {/* Corporate Billing Details */}
                {walkInForm.guest_type === "corporate" && (
                  <div className="corporate-details-box" style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", color: "#2d5696", fontWeight: 700, fontSize: "13px" }}>
                      <Building size={15} /> Corporate Billing Information
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Company Name</label>
                        <input
                          type="text"
                          name="company_name"
                          placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                          value={walkInForm.company_name}
                          onChange={handleWalkInChange}
                          disabled={savingWalkIn}
                        />
                      </div>
                      <div className="form-group">
                        <label>Company GSTIN</label>
                        <input
                          type="text"
                          name="gstin"
                          placeholder="15-digit GSTIN number"
                          value={walkInForm.gstin}
                          onChange={handleWalkInChange}
                          disabled={savingWalkIn}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ID Proof Verification */}
                <div className="form-row" style={{ gridTemplateColumns: "1.2fr 1.2fr 1fr" }}>
                  <div className="form-group">
                    <label>ID Proof Type *</label>
                    <select
                      name="id_proof_type"
                      value={walkInForm.id_proof_type}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                      className="dir-select-field"
                    >
                      <option value="Aadhaar">Aadhaar Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter ID">Voter ID</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>ID Proof Number</label>
                    <input
                      type="text"
                      name="id_proof_number"
                      placeholder="Document ID number"
                      value={walkInForm.id_proof_number}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nationality</label>
                    <input
                      type="text"
                      name="nationality"
                      placeholder="e.g. Indian, American, British"
                      value={walkInForm.nationality || "Indian"}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label>Residential / Permanent Address</label>
                  <input
                    type="text"
                    name="address"
                    placeholder="Guest permanent or residential address"
                    value={walkInForm.address || ""}
                    onChange={handleWalkInChange}
                    disabled={savingWalkIn}
                  />
                </div>

                {/* Form C / International Guest Compliance (Walk-In) */}
                {(walkInForm.is_international ||
                  (walkInForm.nationality && walkInForm.nationality.toLowerCase().trim() !== "indian") ||
                  walkInForm.id_proof_type === "Passport") && (
                  <div
                    className="corporate-details-box"
                    style={{
                      background: "#fdf4ff",
                      borderColor: "#f0abfc",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      marginBottom: "14px",
                      border: "1px solid #f0abfc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #fae8ff",
                        paddingBottom: "8px",
                        marginBottom: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#86198f", fontWeight: 700, fontSize: "13px" }}>
                        <Globe size={16} color="#86198f" />
                        <span>International Guest • Form C Registration (Bureau of Immigration / FRRO)</span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#701a75",
                          background: "#f5d0fe",
                          padding: "2px 8px",
                          borderRadius: "12px",
                        }}
                      >
                        Mandatory &bull; 24h Filing
                      </span>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Passport Expiry Date</label>
                        <input
                          type="date"
                          name="passport_expiry"
                          value={walkInForm.passport_expiry || ""}
                          onChange={handleWalkInChange}
                          disabled={savingWalkIn}
                        />
                      </div>
                      <div className="form-group">
                        <label>Visa / e-Visa Number</label>
                        <input
                          type="text"
                          name="visa_number"
                          value={walkInForm.visa_number || ""}
                          onChange={handleWalkInChange}
                          placeholder="e.g. V981240 / e-Visa ref"
                          disabled={savingWalkIn}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Visa Type</label>
                        <select
                          name="visa_type"
                          value={walkInForm.visa_type || "Tourist (e-Visa / Regular)"}
                          onChange={handleWalkInChange}
                          disabled={savingWalkIn}
                          className="dir-select-field"
                        >
                          {VISA_TYPES.map((vt) => (
                            <option key={vt} value={vt}>
                              {vt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Visa Valid Until / Expiry Date</label>
                        <input
                          type="date"
                          name="visa_expiry"
                          value={walkInForm.visa_expiry || ""}
                          onChange={handleWalkInChange}
                          disabled={savingWalkIn}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Port of Entry into India</label>
                        <input
                          type="text"
                          name="port_of_entry"
                          value={walkInForm.port_of_entry || ""}
                          onChange={handleWalkInChange}
                          placeholder="e.g. Delhi (DEL), Mumbai (BOM), Bengaluru (BLR)"
                          disabled={savingWalkIn}
                        />
                      </div>
                      <div className="form-group">
                        <label>Date of Arrival in India</label>
                        <input
                          type="date"
                          name="date_of_arrival_in_country"
                          value={walkInForm.date_of_arrival_in_country || ""}
                          onChange={handleWalkInChange}
                          disabled={savingWalkIn}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: "4px" }}>
                      <label>Next Destination / City & Country</label>
                      <input
                        type="text"
                        name="next_destination"
                        value={walkInForm.next_destination || ""}
                        onChange={handleWalkInChange}
                        placeholder="e.g. Agra, India or London, UK"
                        disabled={savingWalkIn}
                      />
                    </div>
                  </div>
                )}

                {/* Rooms Allocation */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Number of Rooms *</label>
                    <input
                      type="number"
                      name="rooms_count"
                      min="1"
                      max="10"
                      value={walkInForm.rooms_count}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Assigned Room Count Summary</label>
                    <div className="time-select-pill" style={{ height: "42px", background: "#f8fafc", display: "flex", alignItems: "center", gap: "8px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                      <BedDouble size={16} color="#2d5696" />
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>
                        {walkInForm.rooms_count} Room{Number(walkInForm.rooms_count) > 1 ? "s" : ""} Assigned
                      </span>
                    </div>
                  </div>
                </div>

                {/* Multi-Room Selectors */}
                <div className="multi-rooms-section">
                  <div className="multi-rooms-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <BedDouble size={15} color="#2d5696" />
                      <strong>Assign Rooms ({walkInForm.rooms_count} Room{walkInForm.rooms_count > 1 ? "s" : ""} Required)</strong>
                    </div>
                    {loadingAvailableRooms ? (
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        Checking live room availability...
                      </span>
                    ) : (
                      <span style={{ fontSize: "11.5px", color: availableRoomsForWalkIn.length > 0 ? "#059669" : "#b45309", fontWeight: 600 }}>
                        {availableRoomsForWalkIn.length} Unreserved Room{availableRoomsForWalkIn.length !== 1 ? "s" : ""} Available
                      </span>
                    )}
                  </div>

                  {availableRoomsForWalkIn.length === 0 && (
                    <div
                      style={{
                        margin: "10px 0",
                        fontSize: "12px",
                        color: "#b45309",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <AlertTriangle size={15} color="#b45309" />
                      <span>
                        No unreserved rooms available for the selected dates/times. All other rooms are currently occupied or reserved for confirmed arrivals.
                      </span>
                    </div>
                  )}

                  <div
                    className="form-row"
                    style={{
                      gridTemplateColumns: walkInForm.rooms_count > 1 ? "repeat(2, 1fr)" : "1fr",
                      gap: "10px",
                    }}
                  >
                    {Array.from({ length: Number(walkInForm.rooms_count) || 1 }).map((_, slotIndex) => {
                      const currentSelectedId = walkInForm.selected_room_ids[slotIndex] || "";
                      const otherSelectedIds = walkInForm.selected_room_ids.filter(
                        (id, idx) => idx !== slotIndex && Boolean(id)
                      );
                      const selectableRooms = availableRoomsForWalkIn.filter(
                        (r) => !otherSelectedIds.includes(String(r.id))
                      );

                      return (
                        <div key={slotIndex} className="form-group">
                          <label>Room {slotIndex + 1} Assignment *</label>
                          <select
                            value={currentSelectedId}
                            onChange={(e) => handleWalkInRoomSlotChange(slotIndex, e.target.value)}
                            disabled={savingWalkIn || selectableRooms.length === 0}
                            className="dir-select-field"
                            required
                          >
                            <option value="">
                              {selectableRooms.length === 0
                                ? "-- No Available Rooms --"
                                : `-- Select Room ${slotIndex + 1} --`}
                            </option>
                            {selectableRooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                Room {r.room_number} ({r.room_type}) • ₹{r.base_price || r.price_per_night}/night
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Accompanying Co-Guests Registration */}
                <div className="cio-co-guests-wrapper">
                  <div className="cio-section-title-row">
                    <div>
                      <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                        Accompanying Co-Guests ({walkInForm.co_guests.length})
                      </h4>
                      <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                        Register secondary occupants for hotel compliance
                      </span>
                    </div>
                    <button
                      type="button"
                      className="cio-btn-add-guest"
                      onClick={handleAddWalkInCoGuest}
                      disabled={savingWalkIn}
                    >
                      <Plus size={14} /> Add Co-Guest
                    </button>
                  </div>

                  {walkInForm.co_guests.length === 0 ? (
                    <div className="cio-no-co-guests">
                      <Users size={18} color="#94a3b8" />
                      <span>Single occupant walk-in. Click '+ Add Co-Guest' if accompanying guests are staying.</span>
                    </div>
                  ) : (
                    <div className="cio-co-guests-list">
                      {walkInForm.co_guests.map((cg, idx) => (
                        <div key={idx} className="cio-co-guest-card">
                          <div className="cio-card-mini-header">
                            <span className="guest-slot-badge">GUEST #{idx + 2}</span>
                            <button
                              type="button"
                              className="btn-remove-coguest"
                              title="Remove Guest"
                              onClick={() => handleRemoveWalkInCoGuest(idx)}
                              disabled={savingWalkIn}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="form-row" style={{ gridTemplateColumns: "1.8fr 1fr 0.8fr", gap: "10px" }}>
                            <div className="form-group">
                              <label>Full Name *</label>
                              <input
                                type="text"
                                placeholder="Full name"
                                value={cg.full_name}
                                onChange={(e) => handleUpdateWalkInCoGuest(idx, "full_name", e.target.value)}
                                disabled={savingWalkIn}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Gender</label>
                              <select
                                value={cg.gender}
                                onChange={(e) => handleUpdateWalkInCoGuest(idx, "gender", e.target.value)}
                                className="dir-select-field"
                                disabled={savingWalkIn}
                              >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Age</label>
                              <input
                                type="number"
                                placeholder="Age"
                                min="1"
                                max="120"
                                value={cg.age}
                                onChange={(e) => handleUpdateWalkInCoGuest(idx, "age", e.target.value)}
                                disabled={savingWalkIn}
                              />
                            </div>
                          </div>

                          <div className="form-row" style={{ gridTemplateColumns: "1fr 1.5fr", gap: "10px", marginTop: "8px" }}>
                            <div className="form-group">
                              <label>ID Proof Type</label>
                              <select
                                value={cg.id_type}
                                onChange={(e) => handleUpdateWalkInCoGuest(idx, "id_type", e.target.value)}
                                className="dir-select-field"
                                disabled={savingWalkIn}
                              >
                                <option value="Aadhaar">Aadhaar Card</option>
                                <option value="Passport">Passport</option>
                                <option value="Driving License">Driving License</option>
                                <option value="Voter ID">Voter ID</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>ID Document Number</label>
                              <input
                                type="text"
                                placeholder="Document ID number (Optional)"
                                value={cg.id_number}
                                onChange={(e) => handleUpdateWalkInCoGuest(idx, "id_number", e.target.value)}
                                disabled={savingWalkIn}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Extra Services & Add-ons (Catalog Driven) */}
                <div className="extra-services-container" style={{ marginTop: "16px" }}>
                  <div className="extra-services-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Sparkles size={15} color="#2d5696" />
                      <strong>Extra Services & Add-ons (Optional)</strong>
                    </div>
                    <button
                      type="button"
                      className="btn-add-service"
                      onClick={handleAddWalkInService}
                      disabled={savingWalkIn}
                      style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <Plus size={13} /> Add Item
                    </button>
                  </div>

                  {walkInForm.extra_services.length === 0 ? (
                    <p className="no-extra-services" style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                      No add-on services selected.
                    </p>
                  ) : (
                    walkInForm.extra_services.map((svc, idx) => {
                      const hasInCatalog = catalogServices.some((c) => c.name === svc.name);

                      return (
                        <div key={idx} className="service-row-item" style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                          <select
                            value={svc.name}
                            onChange={(e) => handleCatalogServiceSelect(idx, e.target.value)}
                            disabled={savingWalkIn}
                            className="dir-select-field service-input"
                            style={{ flex: 1.5 }}
                          >
                            <option value="">-- Select Service --</option>
                            {catalogServices.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name} (Std: ₹{Number(cat.default_price || 0)})
                              </option>
                            ))}
                            {svc.name && !hasInCatalog && (
                              <option value={svc.name}>{svc.name} (Custom)</option>
                            )}
                          </select>

                          <input
                            type="number"
                            placeholder="Amount (₹)"
                            min="0"
                            step="0.01"
                            value={svc.amount}
                            onChange={(e) => handleServiceChange(idx, "amount", e.target.value)}
                            disabled={savingWalkIn}
                            className="service-input-price"
                            style={{ width: "120px" }}
                          />

                          <button
                            type="button"
                            className="btn-remove-service"
                            onClick={() => handleRemoveService(idx)}
                            disabled={savingWalkIn}
                            style={{ background: "#fee2e2", color: "#dc2626", border: "none", padding: "6px", borderRadius: "6px", cursor: "pointer" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dates & Timing */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", marginBottom: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={14} color="#0f766e" /> Stay Duration & Timings
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setWalkInForm((prev) => ({
                        ...prev,
                        checkin_date: getTodayInputDate(),
                        checkin_time: getCurrentInputTime(),
                      }));
                    }}
                    disabled={savingWalkIn}
                    style={{
                      padding: "3px 8px",
                      background: "#f0fdf4",
                      color: "#166534",
                      border: "1px solid #86efac",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    title="Reset check-in to live computer clock"
                  >
                    <RotateCcw size={11} /> Auto Current Time
                  </button>
                </div>
                <div className="form-row" style={{ marginTop: "4px", gridTemplateColumns: "1.2fr 0.8fr 1.2fr 0.8fr" }}>
                  <div className="form-group">
                    <label>Check-in Date *</label>
                    <input
                      type="date"
                      name="checkin_date"
                      required
                      value={walkInForm.checkin_date}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Check-in Time</label>
                    <input
                      type="time"
                      name="checkin_time"
                      value={walkInForm.checkin_time || "11:00"}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Checkout Date *</label>
                    <input
                      type="date"
                      name="checkout_date"
                      required
                      value={walkInForm.checkout_date}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Checkout Time</label>
                    <input
                      type="time"
                      name="checkout_time"
                      value={walkInForm.checkout_time || "11:00"}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: stayMetrics.is_late_checkout ? "#fffbeb" : "#f1f5f9",
                    border: stayMetrics.is_late_checkout ? "1px solid #fde68a" : "1px solid #e2e8f0",
                    borderRadius: "6px",
                    marginBottom: "14px",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: stayMetrics.is_late_checkout ? "#b45309" : "#334155", fontWeight: 600 }}>
                    <Clock size={14} color={stayMetrics.is_late_checkout ? "#b45309" : "#475569"} />
                    <span>Hospitality Stay: <strong>{stayMetrics.stay_label}</strong></span>
                    <span style={{ fontSize: "11px", fontWeight: 400, color: "#64748b" }}>(11:00 AM standard cycle)</span>
                  </div>
                  {stayMetrics.is_late_checkout && (
                    <span
                      style={{
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      Overstay / Late Checkout Applied (+1 Night)
                    </span>
                  )}
                </div>

                {/* Occupancy, Rate & Payments */}
                <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  <div className="form-group">
                    <label>Adults</label>
                    <input
                      type="number"
                      name="adults"
                      min="1"
                      value={walkInForm.adults}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Children</label>
                    <input
                      type="number"
                      name="children"
                      min="0"
                      value={walkInForm.children}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Payment Method</label>
                    <select
                      name="payment_method"
                      value={walkInForm.payment_method}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                      className="dir-select-field"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payment Status</label>
                    <select
                      name="payment_status"
                      value={walkInForm.payment_status}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                      className="dir-select-field"
                    >
                      <option value="paid">Paid</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div className="form-group">
                    <label>Combined Daily Rate (₹) *</label>
                    <input
                      type="number"
                      name="room_rate"
                      min="0"
                      step="0.01"
                      required
                      value={activeNightlyRate}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>Discount (₹)</label>
                    <input
                      type="number"
                      name="discount"
                      min="0"
                      step="0.01"
                      value={walkInForm.discount}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                    />
                  </div>
                  <div className="form-group">
                    <label>GST Mode</label>
                    <select
                      name="tax_mode"
                      value={walkInForm.tax_mode}
                      onChange={handleWalkInChange}
                      disabled={savingWalkIn}
                      className="dir-select-field"
                    >
                      <option value="inclusive">GST Included</option>
                      <option value="exclusive">GST Extra</option>
                    </select>
                  </div>
                </div>

                <div className="booking-modal-calc-banner">
                  <div className="calc-banner-col">
                    <span>Stay & Rooms</span>
                    <strong>{stayMetrics.stay_label} • {walkInForm.rooms_count} Room(s)</strong>
                  </div>
                  <div className="calc-banner-col">
                    <span>Add-ons</span>
                    <strong>₹{extraServicesTotal.toFixed(2)}</strong>
                  </div>
                  <div className="calc-banner-col">
                    <span>Total Calculated</span>
                    <strong style={{ color: "#166962" }}>₹{calculatedTotalAmount.toFixed(2)}</strong>
                  </div>
                  <div className="calc-banner-col">
                    <span>Advance Received</span>
                    <strong>₹{Number(walkInForm.advance_paid || calculatedTotalAmount).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setShowWalkInModal(false);
                    setSelectedReturningGuestId("");
                  }}
                  disabled={savingWalkIn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={savingWalkIn}
                >
                  <Save size={14} /> {savingWalkIn ? "Processing..." : "Complete Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}