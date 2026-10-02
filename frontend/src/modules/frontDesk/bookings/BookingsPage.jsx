import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CheckCircle,
  LogIn,
  CreditCard,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Lock,
  Shield,
  Briefcase,
  User,
  BedDouble,
  LogOut,
  Building,
  Clock,
  Sparkles,
  Users,
  CalendarDays,
  AlertTriangle,
  Globe,
  FileText,
  XCircle,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader, Pagination } from "@components";
import "./bookings.css";

const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getAutoGstRate = (amount) => {
  const roomAmount = Number(amount || 0);
  if (roomAmount <= 1000) return 0;
  if (roomAmount <= 7500) return 5;
  return 18;
};

// --- 11 AM - 11 AM HOSPITALITY STAY CYCLE ENGINE ---
export const calculateHospitalityStay = ({
  checkinDateStr,
  checkinTimeStr = "11:00",
  checkoutDateStr,
  checkoutTimeStr = "11:00",
  hotelStandardCheckout = "11:00",
  graceMinutes = 60,
}) => {
  if (!checkinDateStr || !checkoutDateStr) {
    return {
      nights: 1,
      days: 2,
      stay_label: "2 Days / 1 Night",
      is_late_checkout: false,
    };
  }

  const checkin = new Date(`${checkinDateStr}T${checkinTimeStr || "11:00"}:00`);
  const checkout = new Date(`${checkoutDateStr}T${checkoutTimeStr || "11:00"}:00`);

  if (checkout <= checkin) {
    return {
      nights: 1,
      days: 2,
      stay_label: "2 Days / 1 Night",
      is_late_checkout: false,
    };
  }

  // Base calendar night count
  const startDay = new Date(checkinDateStr);
  const endDay = new Date(checkoutDateStr);
  let baseNights = Math.max(1, Math.round((endDay - startDay) / (1000 * 60 * 60 * 24)));

  // Parse property cutoff threshold
  const [coH, coM] = (hotelStandardCheckout || "11:00").split(":").map(Number);
  const cutoff = new Date(`${checkoutDateStr}T${hotelStandardCheckout || "11:00"}:00`);
  cutoff.setMinutes(cutoff.getMinutes() + (Number(graceMinutes) || 60));

  let isLateCheckout = false;
  let billableNights = baseNights;

  // Overstay check (e.g. 11:00 AM standard checkout + 60m grace = 12:00 PM cutoff, checkout at 9:00 PM)
  if (checkout > cutoff) {
    billableNights += 1;
    isLateCheckout = true;
  }

  const billableDays = billableNights + 1;

  return {
    nights: billableNights,
    days: billableDays,
    stay_label: `${billableDays} Days / ${billableNights} Night${billableNights > 1 ? "s" : ""}`,
    is_late_checkout: isLateCheckout,
  };
};

const calculateTaxAndTotal = ({
  combinedNightlyRate,
  nights,
  discount,
  taxMode,
  taxRate,
  extraServicesTotal,
}) => {
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
      ota_channel: "Booking.com",
      ota_reference: "",
      agent_name: "",
      agent_phone: "",
      agent_notes: "",
      co_guests: [],
      formC: {},
    };
  }

  let corporate = "";
  let special = "";
  let otaChan = "Booking.com";
  let otaRef = "";
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
    } else if (trimmed.startsWith("[OTA]:")) {
      const match = trimmed.match(/\[OTA\]:\s*([^\s]+)\s*Ref:\s*(.*)/i);
      if (match) {
        otaChan = match[1].trim();
        otaRef = match[2].trim();
      } else {
        otaRef = trimmed.replace("[OTA]:", "").trim();
      }
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
        if (seg.startsWith("Passport Exp:")) formC.passport_expiry = seg.replace("Passport Exp:", "").trim();
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
    ota_channel: otaChan,
    ota_reference: otaRef,
    agent_name: agentName,
    agent_phone: agentPhone,
    agent_notes: agentNotes,
    co_guests: coGuests,
    formC,
  };
};

const POPULAR_NATIONALITIES = [
  "Indian",
  "American (USA)",
  "British (UK)",
  "Australian",
  "Canadian",
  "German",
  "French",
  "Japanese",
  "Russian",
  "Chinese",
  "Singaporean",
  "Emirati (UAE)",
  "Saudi",
  "Italian",
  "Spanish",
  "Dutch",
  "Swiss",
  "South Korean",
  "Malaysian",
  "Thai",
  "New Zealander",
  "Other National",
];

const VISA_TYPES = [
  "Tourist (e-Visa / Regular)",
  "Business (e-Business / Regular)",
  "Employment",
  "Conference",
  "Medical (e-Medical)",
  "Student",
  "Journalist",
  "Research",
  "Diplomatic / Official",
  "OCI / PIO Card Holder",
  "Other",
];

const emptyBookingForm = {
  reservation_code: "",
  primary_guest_name: "",
  phone: "",
  email: "",
  address: "",
  nationality: "Indian",
  is_international: false,
  passport_expiry: "",
  visa_number: "",
  visa_type: "Tourist (e-Visa / Regular)",
  visa_expiry: "",
  port_of_entry: "",
  date_of_arrival_in_country: "",
  next_destination: "",
  id_proof_type: "Aadhaar",
  id_proof_number: "",
  rooms_count: 1,
  selected_room_ids: [""],
  guest_type: "individual",
  company_name: "",
  gstin: "",
  corporate_notes: "",
  special_requests: "",
  checkin_date: getTodayDate(),
  checkin_time: "11:00",
  checkout_date: getTomorrowDate(),
  checkout_time: "11:00",
  adults: 1,
  children: 0,
  booking_source: "walk-in",
  agent_name: "",
  agent_phone: "",
  agent_notes: "",
  ota_channel: "Booking.com",
  ota_reference: "",
  status: "confirmed",
  room_rate: "",
  discount: 0,
  tax_mode: "inclusive",
  tax_rate_type: "auto",
  tax_rate: 0,
  advance_paid: 0,
  payment_method: "cash",
  payment_status: "pending",
  extra_services: [],
  co_guests: [],
};

const bookingStatuses = ["confirmed", "checked-in", "checked-out", "cancelled", "no-show"];
const paymentStatuses = ["pending", "partial", "paid"];
const paymentMethods = ["cash", "upi", "card", "bank_transfer", "cheque", "ota_virtual"];
const bookingSources = ["walk-in", "phone", "website", "agent", "ota", "corporate"];
const OTA_PLATFORMS = [
  "Booking.com",
  "MakeMyTrip",
  "Agoda",
  "Expedia",
  "Goibibo",
  "Airbnb",
  "Direct Agent",
  "Other OTA",
];

export default function BookingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [hotelConfig, setHotelConfig] = useState({
    default_checkin_time: "11:00",
    default_checkout_time: "11:00",
    checkout_grace_minutes: 60,
  });
  const [catalogServices, setCatalogServices] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [formData, setFormData] = useState(emptyBookingForm);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilterDate, setSelectedFilterDate] = useState("");
  const [activeSection, setActiveSection] = useState("all");
  const [sortBy, setSortBy] = useState("id_desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilterDate, activeSection, sortBy]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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

  const getApiErrorMessage = (err, fallbackMessage = "Failed to process request.") => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc.join(" → ") : "field";
          return `${field}: ${item.msg}`;
        })
        .join("\n");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail, null, 2);
    return err.message || fallbackMessage;
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await api.post("/bookings/process-no-shows").catch(() => {});
      const hotelId = getLoggedInHotelId();

      const [bookingsResponse, guestsResponse, roomsResponse, catalogResponse, hotelResponse] =
        await Promise.all([
          api.get("/bookings"),
          api.get("/guests"),
          api.get("/rooms"),
          api.get("/extra-charges/catalog").catch((err) => {
            console.warn("Could not fetch extra services catalog:", err);
            return { data: [] };
          }),
          hotelId ? api.get(`/hotels/${hotelId}`).catch(() => ({ data: {} })) : Promise.resolve({ data: {} }),
        ]);

      const bookingsList = normalizeList(bookingsResponse.data, "bookings");
      const guestsList = normalizeList(guestsResponse.data, "guests");
      const roomsList = normalizeList(roomsResponse.data, "rooms");
      const catalogList = normalizeList(catalogResponse.data, "catalog");

      if (hotelResponse.data) {
        setHotelConfig({
          default_checkin_time: hotelResponse.data.default_checkin_time || "11:00",
          default_checkout_time: hotelResponse.data.default_checkout_time || "11:00",
          checkout_grace_minutes: hotelResponse.data.checkout_grace_minutes ?? 60,
        });
      }

      if (hotelId) {
        setBookings(bookingsList.filter((b) => Number(b.hotel_id) === Number(hotelId)));
        setGuests(guestsList.filter((g) => Number(g.hotel_id) === Number(hotelId)));
        setRooms(roomsList.filter((r) => Number(r.hotel_id) === Number(hotelId)));
        setCatalogServices(
          catalogList.filter(
            (c) => !c.hotel_id || Number(c.hotel_id) === Number(hotelId)
          )
        );
      } else {
        setBookings(bookingsList);
        setGuests(guestsList);
        setRooms(roomsList);
        setCatalogServices(catalogList);
      }
    } catch (err) {
      console.error("Fetch booking data error:", err);
      showToast(getApiErrorMessage(err, "Failed to load booking data."), "error");
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

  const fetchAvailableRooms = async (
    checkinDateStr,
    checkinTimeStr,
    checkoutDateStr,
    checkoutTimeStr,
    excludeBookingId = null
  ) => {
    if (!checkinDateStr || !checkoutDateStr) return;
    try {
      setLoadingRooms(true);
      const params = {
        checkin_date: new Date(`${checkinDateStr}T${checkinTimeStr || "11:00"}:00`).toISOString(),
        checkout_date: new Date(`${checkoutDateStr}T${checkoutTimeStr || "11:00"}:00`).toISOString(),
      };
      if (excludeBookingId) {
        params.exclude_booking_id = excludeBookingId;
      }
      const res = await api.get("/bookings/available-rooms", { params });
      const available = normalizeList(res.data, "rooms");
      setAvailableRooms(available);
    } catch (err) {
      console.error("Failed to query available rooms:", err);
      setAvailableRooms(rooms);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isModalOpen && formData.checkin_date && formData.checkout_date) {
      fetchAvailableRooms(
        formData.checkin_date,
        formData.checkin_time,
        formData.checkout_date,
        formData.checkout_time,
        editingBooking?.id
      );
    }
  }, [
    formData.checkin_date,
    formData.checkin_time,
    formData.checkout_date,
    formData.checkout_time,
    isModalOpen,
    editingBooking?.id,
  ]);

  const getGuest = (guestId) => guests.find((item) => Number(item.id) === Number(guestId));
  const getRoom = (roomId) => rooms.find((item) => Number(item.id) === Number(roomId));

  const extractDateOnly = (val) => (val ? String(val).split("T")[0].split(" ")[0].trim() : "");
  const extractTimeOnly = (val) => {
    if (!val) return "11:00";
    const s = String(val);
    if (s.includes("T")) return s.split("T")[1].substring(0, 5);
    if (s.includes(" ")) return s.split(" ")[1].substring(0, 5);
    return "11:00";
  };

  const formatTimeDisplay = (isoStr) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const isInternationalActive = useMemo(() => {
    return Boolean(
      formData.is_international ||
        (formData.nationality &&
          formData.nationality.toLowerCase().trim() !== "indian" &&
          formData.nationality.trim() !== "") ||
        formData.id_proof_type === "Passport"
    );
  }, [formData.is_international, formData.nationality, formData.id_proof_type]);

  const extraServicesTotal = useMemo(() => {
    return (formData.extra_services || []).reduce(
      (acc, curr) => acc + Number(curr.amount || 0),
      0
    );
  }, [formData.extra_services]);

  const stayMetrics = useMemo(() => {
    return calculateHospitalityStay({
      checkinDateStr: formData.checkin_date,
      checkinTimeStr: formData.checkin_time,
      checkoutDateStr: formData.checkout_date,
      checkoutTimeStr: formData.checkout_time,
      hotelStandardCheckout: hotelConfig.default_checkout_time,
      graceMinutes: hotelConfig.checkout_grace_minutes,
    });
  }, [
    formData.checkin_date,
    formData.checkin_time,
    formData.checkout_date,
    formData.checkout_time,
    hotelConfig,
  ]);

  const nightsCount = stayMetrics.nights;

  const combinedRoomsRate = useMemo(() => {
    const allRooms = [...availableRooms, ...rooms];
    let totalRate = 0;
    (formData.selected_room_ids || []).forEach((roomId) => {
      const found = allRooms.find((r) => String(r.id) === String(roomId));
      if (found) {
        totalRate += Number(found.base_price || found.price_per_night || 0);
      }
    });
    return totalRate;
  }, [formData.selected_room_ids, availableRooms, rooms]);

  const activeNightlyRate = useMemo(() => {
    return formData.room_rate !== "" ? Number(formData.room_rate) : combinedRoomsRate;
  }, [formData.room_rate, combinedRoomsRate]);

  const activeTaxRate = useMemo(() => {
    if (formData.tax_rate_type === "auto") {
      return getAutoGstRate(activeNightlyRate);
    }
    return Number(formData.tax_rate || 0);
  }, [activeNightlyRate, formData.tax_rate, formData.tax_rate_type]);

  const amountCalculation = useMemo(() => {
    return calculateTaxAndTotal({
      combinedNightlyRate: activeNightlyRate,
      nights: nightsCount,
      discount: formData.discount,
      taxMode: formData.tax_mode,
      taxRate: activeTaxRate,
      extraServicesTotal,
    });
  }, [
    activeNightlyRate,
    nightsCount,
    formData.discount,
    formData.tax_mode,
    activeTaxRate,
    extraServicesTotal,
  ]);

  const calculatedGrossRoomRate = amountCalculation.grossRoomRate;
  const calculatedTaxAmount = amountCalculation.taxAmount;
  const calculatedTotalAmount = amountCalculation.totalAmount;
  const advancePaidAmount = Number(formData.advance_paid || 0);
  const balanceAmount = Math.max(calculatedTotalAmount - advancePaidAmount, 0);

  useEffect(() => {
    if (advancePaidAmount <= 0) {
      setFormData((prev) => ({ ...prev, payment_status: "pending" }));
    } else if (advancePaidAmount >= calculatedTotalAmount && calculatedTotalAmount > 0) {
      setFormData((prev) => ({ ...prev, payment_status: "paid" }));
    } else {
      setFormData((prev) => ({ ...prev, payment_status: "partial" }));
    }
  }, [advancePaidAmount, calculatedTotalAmount]);

  const counts = useMemo(() => {
    let upcoming = 0;
    let inHouse = 0;
    let checkedOut = 0;

    bookings.forEach((b) => {
      const st = String(b.status || "").toLowerCase();
      if (st === "checked-in" || st === "checked_in") {
        inHouse++;
      } else if (st === "checked-out" || st === "checked_out") {
        checkedOut++;
      } else if (st === "confirmed" || st === "reserved") {
        upcoming++;
      }
    });

    return { total: bookings.length, upcoming, inHouse, checkedOut };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return bookings
      .filter((booking) => {
        const guest = getGuest(booking.guest_id);
        const room = getRoom(booking.room_id);

        const guestName = String(guest?.full_name || "").toLowerCase();
        const guestPhone = String(guest?.phone || "").toLowerCase();
        const roomNum = String(room?.room_number || "").toLowerCase();
        const idStr = String(booking.id || "").toLowerCase();
        const resCode = String(booking.reservation_code || "").toLowerCase();
        const compName = String(booking.company_name || "").toLowerCase();
        const gstinStr = String(booking.gstin || "").toLowerCase();

        const matchesSearch =
          !search ||
          guestName.includes(search) ||
          guestPhone.includes(search) ||
          roomNum.includes(search) ||
          resCode.includes(search) ||
          idStr.includes(search) ||
          compName.includes(search) ||
          gstinStr.includes(search);

        if (!matchesSearch) return false;

        if (selectedFilterDate) {
          const inDate = extractDateOnly(booking.checkin_date);
          const outDate = extractDateOnly(booking.checkout_date);
          const matchesDate =
            selectedFilterDate >= inDate && selectedFilterDate <= outDate;
          if (!matchesDate) return false;
        }

        const st = String(booking.status || "").toLowerCase();
        if (activeSection === "upcoming") {
          return st === "confirmed" || st === "reserved";
        }
        if (activeSection === "in_house") {
          return st === "checked-in" || st === "checked_in";
        }
        if (activeSection === "checked_out") {
          return st === "checked-out" || st === "checked_out";
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "id_asc") return Number(a.id || 0) - Number(b.id || 0);
        if (sortBy === "total_high") return Number(b.total_amount || 0) - Number(a.total_amount || 0);
        if (sortBy === "total_low") return Number(a.total_amount || 0) - Number(b.total_amount || 0);
        return Number(b.id || 0) - Number(a.id || 0);
      });
  }, [bookings, guests, rooms, searchTerm, selectedFilterDate, activeSection, sortBy]);

  const paginatedBookings = useMemo(() => {
    if (pageSize === "all") return filteredBookings;
    const start = (currentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, currentPage, pageSize]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "rooms_count") {
      const count = Math.max(1, parseInt(value, 10) || 1);
      setFormData((prev) => {
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
      setFormData((prev) => ({
        ...prev,
        room_rate: value,
        tax_rate: prev.tax_rate_type === "auto" ? getAutoGstRate(value) : prev.tax_rate,
      }));
      return;
    }

    if (name === "tax_rate_type") {
      setFormData((prev) => ({
        ...prev,
        tax_rate_type: value,
        tax_rate: value === "auto" ? getAutoGstRate(activeNightlyRate) : Number(value),
      }));
      return;
    }

    if (name === "nationality") {
      const isForeign = value.toLowerCase().trim() !== "indian";
      setFormData((prev) => ({
        ...prev,
        nationality: value,
        is_international: isForeign,
        id_proof_type: isForeign && prev.id_proof_type === "Aadhaar" ? "Passport" : prev.id_proof_type,
      }));
      return;
    }

    if (name === "id_proof_type") {
      setFormData((prev) => ({
        ...prev,
        id_proof_type: value,
        is_international: value === "Passport" ? true : prev.is_international,
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSpecificRoomChange = (index, selectedId) => {
    setFormData((prev) => {
      const nextRooms = [...prev.selected_room_ids];
      nextRooms[index] = selectedId;
      return { ...prev, selected_room_ids: nextRooms };
    });
  };

  const handleAddService = () => {
    setFormData((prev) => ({
      ...prev,
      extra_services: [...prev.extra_services, { name: "", amount: "" }],
    }));
  };

  const handleCatalogServiceSelect = (index, selectedServiceName) => {
    const matchedService = catalogServices.find((s) => s.name === selectedServiceName);
    setFormData((prev) => {
      const updated = [...prev.extra_services];
      updated[index] = {
        name: selectedServiceName,
        amount: matchedService?.default_price !== undefined ? matchedService.default_price : updated[index]?.amount || "",
      };
      return { ...prev, extra_services: updated };
    });
  };

  const handleServiceChange = (index, field, val) => {
    setFormData((prev) => {
      const updated = [...prev.extra_services];
      updated[index][field] = val;
      return { ...prev, extra_services: updated };
    });
  };

  const handleRemoveService = (index) => {
    setFormData((prev) => ({
      ...prev,
      extra_services: prev.extra_services.filter((_, i) => i !== index),
    }));
  };

  const openCreateModal = () => {
    setEditingBooking(null);
    setFormData({
      ...emptyBookingForm,
      checkin_time: hotelConfig.default_checkin_time || "11:00",
      checkout_time: hotelConfig.default_checkout_time || "11:00",
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetailsModal = (booking) => {
    setEditingBooking(booking);
    const guest = getGuest(booking.guest_id);
    const calculatedNights = booking.nights_count || 1;

    let rawAssigned = booking.assigned_room_ids;
    if (typeof rawAssigned === "string") {
      try {
        rawAssigned = JSON.parse(rawAssigned);
      } catch {
        rawAssigned = [];
      }
    }

    let loadedRoomIds = [];
    if (Array.isArray(rawAssigned) && rawAssigned.length > 0) {
      loadedRoomIds = rawAssigned.map(String);
    } else if (booking.room_id) {
      loadedRoomIds = [String(booking.room_id)];
    }

    let count = parseInt(booking.rooms_count, 10);
    if (!count || isNaN(count)) {
      count = loadedRoomIds.length || 1;
    }

    while (loadedRoomIds.length < count) {
      loadedRoomIds.push("");
    }

    const totalStoredRate = booking.room_rate ?? 0;
    const nightlyRate = calculatedNights > 0 ? totalStoredRate / calculatedNights : totalStoredRate;

    const parsedNotes = parseCorporateNotes(booking.corporate_notes);
    const resolvedCoGuests =
      Array.isArray(booking.co_guests) && booking.co_guests.length > 0
        ? booking.co_guests
        : parsedNotes.co_guests;

    const isForeignNational =
      (guest?.nationality && guest.nationality.toLowerCase().trim() !== "indian") ||
      guest?.id_type === "Passport" ||
      Boolean(parsedNotes.formC?.visa_number || parsedNotes.formC?.passport_expiry);

    setFormData({
      reservation_code: booking.reservation_code || "",
      primary_guest_name: guest?.full_name || "",
      phone: guest?.phone || "",
      email: guest?.email || "",
      address: guest?.address || "",
      nationality: guest?.nationality || "Indian",
      is_international: isForeignNational,
      passport_expiry: parsedNotes.formC?.passport_expiry || "",
      visa_number: parsedNotes.formC?.visa_number || "",
      visa_type: parsedNotes.formC?.visa_type || "Tourist (e-Visa / Regular)",
      visa_expiry: parsedNotes.formC?.visa_expiry || "",
      port_of_entry: parsedNotes.formC?.port_of_entry || "",
      date_of_arrival_in_country: parsedNotes.formC?.date_of_arrival_in_country || "",
      next_destination: parsedNotes.formC?.next_destination || "",
      id_proof_type: guest?.id_type || (isForeignNational ? "Passport" : "Aadhaar"),
      id_proof_number: guest?.id_number || "",
      rooms_count: count,
      selected_room_ids: loadedRoomIds,
      guest_type: booking.guest_type || "individual",
      company_name: booking.company_name || "",
      gstin: booking.gstin || "",
      corporate_notes: parsedNotes.corporate_notes,
      special_requests: parsedNotes.special_requests,
      checkin_date: extractDateOnly(booking.checkin_date) || getTodayDate(),
      checkin_time: extractTimeOnly(booking.checkin_date) || hotelConfig.default_checkin_time,
      checkout_date: extractDateOnly(booking.checkout_date) || getTomorrowDate(),
      checkout_time: extractTimeOnly(booking.checkout_date) || hotelConfig.default_checkout_time,
      adults: booking.adults ?? 1,
      children: booking.children ?? 0,
      booking_source: booking.booking_source || "walk-in",
      agent_name: parsedNotes.agent_name || "",
      agent_phone: parsedNotes.agent_phone || "",
      agent_notes: parsedNotes.agent_notes || "",
      ota_channel: parsedNotes.ota_channel || "Booking.com",
      ota_reference: parsedNotes.ota_reference || "",
      status: booking.status || "confirmed",
      room_rate: nightlyRate,
      discount: booking.discount ?? 0,
      tax_mode: "inclusive",
      tax_rate_type: "auto",
      tax_rate: getAutoGstRate(nightlyRate),
      advance_paid: booking.advance_paid ?? 0,
      payment_method: booking.payment_method || "cash",
      payment_status: booking.payment_status || "pending",
      extra_services: booking.extra_services || [],
      co_guests: resolvedCoGuests,
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleSelectReturningGuest = (guestId) => {
    if (!guestId) return;
    const g = guests.find((item) => String(item.id) === String(guestId));
    if (g) {
      const isIntl =
        (g.nationality && g.nationality.toLowerCase().trim() !== "indian") ||
        g.id_type === "Passport";
      setFormData((prev) => ({
        ...prev,
        primary_guest_name: g.full_name || prev.primary_guest_name,
        phone: g.phone || prev.phone,
        email: g.email || prev.email,
        address: g.address || prev.address,
        nationality: g.nationality || prev.nationality || "Indian",
        id_proof_type: g.id_type || prev.id_proof_type || (isIntl ? "Passport" : "Aadhaar"),
        id_proof_number: g.id_number || prev.id_proof_number || "",
        is_international: isIntl,
      }));
      showToast(`Selected guest profile: ${g.full_name} (${g.nationality || "Indian"})`, "info");
    }
  };

  const handleCopyFormC = () => {
    const text = [
      `=== FORM C / BUREAU OF IMMIGRATION (FRRO) RECORD ===`,
      `Full Name (as in Passport): ${formData.primary_guest_name || "N/A"}`,
      `Nationality / Citizenship: ${formData.nationality || "N/A"}`,
      `Passport Number: ${formData.id_proof_number || "N/A"}`,
      `Passport Expiry Date: ${formData.passport_expiry || "N/A"}`,
      `Visa / e-Visa Number: ${formData.visa_number || "N/A"}`,
      `Visa Type: ${formData.visa_type || "N/A"}`,
      `Visa Valid Until: ${formData.visa_expiry || "N/A"}`,
      `Date of Arrival in Country: ${formData.date_of_arrival_in_country || "N/A"}`,
      `Port of Entry / Airport: ${formData.port_of_entry || "N/A"}`,
      `Next Destination: ${formData.next_destination || "N/A"}`,
      `Residential / Permanent Address: ${formData.address || "N/A"}`,
      `Contact Phone: ${formData.phone || "N/A"}`,
      `Check-In Date & Time: ${formData.checkin_date} @ ${formData.checkin_time || "11:00"}`,
      `Check-Out Date & Time: ${formData.checkout_date} @ ${formData.checkout_time || "11:00"}`,
      `Room Allocated: ${formData.selected_room_ids.filter(Boolean).map(id => getRoom(id)?.room_number || id).join(", ")}`,
      `====================================================`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    showToast("Form C immigration details copied to clipboard!", "success");
  };

  const handleAddCoGuest = () => {
    setFormData((prev) => ({
      ...prev,
      co_guests: [
        ...(prev.co_guests || []),
        { full_name: "", gender: "male", age: "", id_type: "Aadhaar", id_number: "" },
      ],
    }));
  };

  const handleUpdateCoGuest = (index, field, val) => {
    setFormData((prev) => {
      const updated = [...(prev.co_guests || [])];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, co_guests: updated };
    });
  };

  const handleRemoveCoGuest = (index) => {
    setFormData((prev) => ({
      ...prev,
      co_guests: (prev.co_guests || []).filter((_, i) => i !== index),
    }));
  };

  const handleQuickCancelBooking = async () => {
    if (!editingBooking?.id) return;
    if (!window.confirm("Are you sure you want to cancel this reservation?")) return;
    try {
      setSaving(true);
      await api.put(`/bookings/${editingBooking.id}`, { status: "cancelled" });
      showToast("Reservation has been marked as cancelled.", "success");
      closeModal();
      await fetchData();
    } catch (err) {
      console.error("Cancel booking error:", err);
      showToast(getApiErrorMessage(err, "Failed to cancel booking."), "error");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (saving || deleting) return;
    setIsModalOpen(false);
    setEditingBooking(null);
    setIsEditing(false);
    setFormData(emptyBookingForm);
  };

  const handleCancelEdit = () => {
    if (editingBooking) {
      openDetailsModal(editingBooking);
    } else {
      closeModal();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hotelId = getLoggedInHotelId();
    if (!hotelId) {
      showToast("Hotel ID missing. Please log in again.", "error");
      return;
    }

    const activeSelectedRoomIds = formData.selected_room_ids.filter(Boolean);
    if (activeSelectedRoomIds.length < formData.rooms_count) {
      showToast(`Please assign all ${formData.rooms_count} room(s) before saving.`, "error");
      return;
    }

    const uniqueRooms = new Set(activeSelectedRoomIds);
    if (uniqueRooms.size !== activeSelectedRoomIds.length) {
      showToast("Duplicate rooms selected. Please select distinct rooms.", "error");
      return;
    }

    try {
      setSaving(true);
      let guestId = editingBooking?.guest_id;

      const matchedGuest = guests.find(
        (g) =>
          String(g.phone).trim() === String(formData.phone).trim() &&
          Number(g.hotel_id) === Number(hotelId)
      );

      if (matchedGuest) {
        guestId = matchedGuest.id;
        try {
          await api.put(`/guests/${matchedGuest.id}`, {
            full_name: formData.primary_guest_name.trim(),
            email: formData.email.trim() || null,
            address: formData.address?.trim() || matchedGuest.address || null,
            nationality: formData.nationality?.trim() || matchedGuest.nationality || "Indian",
            id_type: formData.id_proof_type || matchedGuest.id_type,
            id_number: formData.id_proof_number.trim() || matchedGuest.id_number || null,
          });
        } catch (updateErr) {
          console.warn("Could not update matched guest details:", updateErr);
        }
      } else {
        const guestRes = await api.post("/guests", {
          hotel_id: Number(hotelId),
          full_name: formData.primary_guest_name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          address: formData.address?.trim() || null,
          nationality: formData.nationality?.trim() || "Indian",
          id_type: formData.id_proof_type,
          id_number: formData.id_proof_number.trim() || null,
        });
        guestId = guestRes.data.id;
      }

      let notesParts = [];
      if (formData.guest_type === "corporate" && formData.corporate_notes?.trim()) {
        notesParts.push(`[Corporate]: ${formData.corporate_notes.trim()}`);
      }
      if (formData.booking_source === "ota" && (formData.ota_reference?.trim() || formData.ota_channel)) {
        notesParts.push(`[OTA]: ${formData.ota_channel || "OTA"} Ref: ${formData.ota_reference?.trim() || "N/A"}`);
      }
      if (formData.booking_source === "agent" && (formData.agent_name?.trim() || formData.agent_phone?.trim() || formData.agent_notes?.trim())) {
        let agentStr = `[Agent Referral]: ${formData.agent_name?.trim() || "Local Agent"}`;
        if (formData.agent_phone?.trim()) agentStr += ` | Phone: ${formData.agent_phone.trim()}`;
        if (formData.agent_notes?.trim()) agentStr += ` | Note: ${formData.agent_notes.trim()}`;
        notesParts.push(agentStr);
      }
      if (
        formData.is_international ||
        (formData.nationality && formData.nationality.toLowerCase().trim() !== "indian") ||
        formData.id_proof_type === "Passport"
      ) {
        const formCParts = [];
        if (formData.passport_expiry) formCParts.push(`Passport Exp: ${formData.passport_expiry}`);
        if (formData.visa_number)
          formCParts.push(
            `Visa: ${formData.visa_number} (${formData.visa_type || "Tourist (e-Visa / Regular)"})`
          );
        if (formData.visa_expiry) formCParts.push(`Visa Exp: ${formData.visa_expiry}`);
        if (formData.date_of_arrival_in_country)
          formCParts.push(`Entry Date: ${formData.date_of_arrival_in_country}`);
        if (formData.port_of_entry) formCParts.push(`Port: ${formData.port_of_entry}`);
        if (formData.next_destination) formCParts.push(`Next Dest: ${formData.next_destination}`);
        if (formCParts.length > 0) {
          notesParts.push(`[Form C / International]: ${formCParts.join(" | ")}`);
        }
      }
      if (formData.special_requests?.trim()) {
        notesParts.push(`[Special Requests]: ${formData.special_requests.trim()}`);
      }
      if (formData.co_guests?.length > 0) {
        const coGuestsList = formData.co_guests
          .filter((cg) => cg.full_name?.trim())
          .map(
            (cg) =>
              `${cg.full_name} (${cg.gender || "male"}, ${cg.age || "?"}y, ${cg.id_type || "ID"}: ${
                cg.id_number || "N/A"
              })`
          )
          .join("; ");
        if (coGuestsList) {
          notesParts.push(`[Co-Guests]: ${coGuestsList}`);
        }
      }
      const finalCorporateNotes = notesParts.length > 0 ? notesParts.join("\n") : (formData.corporate_notes?.trim() || null);

      const payload = {
        hotel_id: Number(hotelId),
        guest_id: Number(guestId),
        room_id: Number(activeSelectedRoomIds[0]),
        rooms_count: Number(formData.rooms_count || 1),
        assigned_room_ids: activeSelectedRoomIds.map(Number),
        guest_type: formData.guest_type,
        company_name: formData.guest_type === "corporate" ? formData.company_name.trim() : null,
        gstin: formData.guest_type === "corporate" ? formData.gstin.trim() : null,
        corporate_notes: finalCorporateNotes,
        checkin_date: new Date(
          `${formData.checkin_date}T${formData.checkin_time || "11:00"}:00`
        ).toISOString(),
        checkout_date: new Date(
          `${formData.checkout_date}T${formData.checkout_time || "11:00"}:00`
        ).toISOString(),
        nights_count: Number(stayMetrics.nights),
        days_count: Number(stayMetrics.days),
        stay_label: stayMetrics.stay_label,
        is_late_checkout: Boolean(stayMetrics.is_late_checkout),
        adults: Number(formData.adults || 1),
        children: Number(formData.children || 0),
        booking_source: formData.booking_source,
        status: formData.status,
        room_rate: Number(calculatedGrossRoomRate || 0),
        discount: Number(formData.discount || 0),
        tax: Number(calculatedTaxAmount || 0),
        total_amount: Number(calculatedTotalAmount || 0),
        advance_paid: Number(formData.advance_paid || 0),
        payment_method: formData.payment_method,
        payment_status: formData.payment_status,
        extra_services: formData.extra_services.filter(
          (s) => s.name && Number(s.amount) > 0
        ),
      };

      let res;
      if (editingBooking?.id) {
        res = await api.put(`/bookings/${editingBooking.id}`, payload);
        showToast("Booking updated successfully.", "success");
      } else {
        res = await api.post("/bookings", payload);
        showToast("Reservation created successfully.", "success");
      }

      const savedBooking = res.data;

      closeModal();
      fetchData();
    } catch (err) {
      console.error("Save booking error:", err);
      showToast(getApiErrorMessage(err, "Failed to save booking."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = (booking, e) => {
    e.stopPropagation();
    navigate("/check-in-out", {
      state: { autoCheckInBookingId: booking.id },
    });
  };

  const openDeleteConfirmation = () => {
    setAdminPassword("");
    setIsDeleteModalOpen(true);
  };

  const closeDeleteConfirmation = () => {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setAdminPassword("");
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      showToast("Please enter admin password.", "error");
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/bookings/${editingBooking.id}`, {
        data: { admin_password: adminPassword },
      });
      showToast("Booking deleted successfully.", "success");
      setIsDeleteModalOpen(false);
      closeModal();
      fetchData();
    } catch (err) {
      console.error("Delete booking error:", err);
      showToast(getApiErrorMessage(err, "Failed to delete booking. Verify credentials."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedFilterDate("");
    setActiveSection("all");
    setSortBy("id_desc");
  };

  return (
    <div className="directory-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Bookings"
        kicker="BOOKINGS MANAGEMENT"
        description="Create reservations, assign guests to rooms, manage check-in, check-out, and payment status."
        icon={CalendarCheck}
        backPath="/front-desk"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={openCreateModal}
          >
            <Plus size={16} /> Create Booking
          </button>
        }
      />

      {/* 4 CORE STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Bookings"
          value={counts.total}
          Icon={CalendarCheck}
          colorTheme="blue"
        />
        <StatCard
          title="Upcoming Confirmed"
          value={counts.upcoming}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="In-House Guests"
          value={counts.inHouse}
          Icon={LogIn}
          colorTheme="purple"
        />
        <StatCard
          title="Checked-Out"
          value={counts.checkedOut}
          Icon={LogOut}
          colorTheme="orange"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Reservation Records"
          description="Catalog of room bookings, stay duration, financial breakdown, and guest info."
          badgeCount={filteredBookings.length}
          badgeLabel="bookings"
        />

        {/* 3 CORE SECTIONS / CATEGORY TABS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeSection === "all" ? "active" : ""}`}
            onClick={() => setActiveSection("all")}
          >
            All Bookings <span className="tab-count-badge">{counts.total}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeSection === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveSection("upcoming")}
          >
            Upcoming Bookings <span className="tab-count-badge">{counts.upcoming}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeSection === "in_house" ? "active" : ""}`}
            onClick={() => setActiveSection("in_house")}
          >
            In-House Guests <span className="tab-count-badge">{counts.inHouse}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeSection === "checked_out" ? "active" : ""}`}
            onClick={() => setActiveSection("checked_out")}
          >
            Checked-Out Guests <span className="tab-count-badge">{counts.checkedOut}</span>
          </button>
        </div>

        {/* TOOLBAR, DATE FILTER & CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by reservation code (RES-...), guest, phone, room, or GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <div className="booking-date-filter-box" title="Filter by date of stay">
              <CalendarDays size={16} className="date-icon" />
              <input
                type="date"
                value={selectedFilterDate}
                onChange={(e) => setSelectedFilterDate(e.target.value)}
              />
            </div>

            <select
              className="dir-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="id_desc">Newest First</option>
              <option value="id_asc">Oldest First</option>
              <option value="total_high">Total: High to Low</option>
              <option value="total_low">Total: Low to High</option>
            </select>

            <button
              type="button"
              className="btn-cancel"
              style={{ height: "40px", padding: "0 16px" }}
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>

        {/* BOOKINGS TABLE */}
        <div className="dir-table-container bookings-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th style={{ width: "120px", minWidth: "120px" }}>Ref / Code</th>
                <th className="th-customer" style={{ minWidth: "200px" }}>Primary Guest & Profile</th>
                <th className="th-phone" style={{ minWidth: "170px" }}>Allocated Room(s)</th>
                <th className="th-address" style={{ minWidth: "180px" }}>Dates & Timing</th>
                <th className="th-identity" style={{ minWidth: "170px" }}>Financial Breakdown</th>
                <th className="th-bank" style={{ minWidth: "130px" }}>Status / Pay</th>
                <th className="th-action" style={{ minWidth: "90px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading booking records...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No reservations matching current criteria.
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((booking) => {
                  const guest = getGuest(booking.guest_id);
                  const status = String(booking.status || "confirmed").toLowerCase();
                  const payStatus = String(booking.payment_status || "pending").toLowerCase();
                  const isCorp = booking.guest_type === "corporate";

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
                      .map((id) => {
                        const r = getRoom(id);
                        return r ? `Room ${r.room_number}` : `Room ${id}`;
                      })
                      .join(", ");
                  } else {
                    const primaryRoom = getRoom(booking.room_id);
                    allocatedRoomsText = primaryRoom ? `Room ${primaryRoom.room_number}` : `Room ${booking.room_id}`;
                  }

                  const primaryRoomObj = getRoom(booking.room_id);
                  const roomTypeDisplay = primaryRoomObj?.room_type || "Standard";
                  const roomCount = Number(booking.rooms_count || (Array.isArray(rawAssigned) && rawAssigned.length) || 1);

                  const checkinDateFormatted = booking.checkin_date
                    ? new Date(booking.checkin_date).toLocaleDateString()
                    : "-";
                  const checkoutDateFormatted = booking.checkout_date
                    ? new Date(booking.checkout_date).toLocaleDateString()
                    : "-";
                  const checkinTimeFormatted = formatTimeDisplay(booking.checkin_date);
                  const checkoutTimeFormatted = formatTimeDisplay(booking.checkout_date);

                  const totalAmt = Number(booking.total_amount || 0);
                  const advAmt = Number(booking.advance_paid || 0);
                  const balAmt = Math.max(totalAmt - advAmt, 0);

                  const stayBadgeText =
                    booking.stay_label ||
                    `${(booking.nights_count || 1) + 1} Days / ${booking.nights_count || 1} Night${(booking.nights_count || 1) > 1 ? "s" : ""}`;

                  return (
                    <tr
                      key={booking.id}
                      className="dir-table-row"
                      onClick={() => openDetailsModal(booking)}
                    >
                      <td>
                        <span className="booking-id-tag">
                          {booking.reservation_code || `#${booking.id}`}
                        </span>
                        {booking.booking_source && (
                          <div style={{ marginTop: "4px" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                textTransform: "uppercase",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: 700,
                                display: "inline-block",
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
                          </div>
                        )}
                      </td>

                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className={`staff-avatar ${isCorp ? "avatar-corporate" : ""}`}>
                            {isCorp ? (
                              <Building size={16} />
                            ) : (
                              String(guest?.full_name || "G").slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="customer-name">
                              {guest?.full_name || "Unknown Guest"}
                            </span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {guest?.phone || "No phone"} •{" "}
                              <span className={isCorp ? "tag-corporate" : "tag-individual"}>
                                {isCorp ? "Corporate" : "Individual"}
                              </span>
                              {guest?.nationality && guest.nationality.toLowerCase().trim() !== "indian" && (
                                <span
                                  style={{
                                    marginLeft: "4px",
                                    fontSize: "10.5px",
                                    background: "#fdf4ff",
                                    color: "#86198f",
                                    border: "1px solid #f0abfc",
                                    padding: "1px 6px",
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                  }}
                                  title={`International Guest: ${guest.nationality} (Form C compliance required)`}
                                >
                                  <Globe size={10} /> {guest.nationality}
                                </span>
                              )}
                            </span>
                            {isCorp && booking.company_name && (
                              <div className="corporate-sub-tag">
                                <strong>{booking.company_name}</strong>
                                {booking.gstin && (
                                  <span className="gstin-badge">GST: {booking.gstin}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="th-phone">
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span className="mono-pill" title={allocatedRoomsText}>
                            {allocatedRoomsText}
                          </span>
                          <span className="text-muted" style={{ fontSize: "11px" }}>
                            {roomTypeDisplay} • {roomCount} Room{roomCount > 1 ? "s" : ""}
                          </span>
                          <span className="text-muted" style={{ fontSize: "10.5px", color: "#64748b" }}>
                            <Users size={11} style={{ display: "inline", verticalAlign: "-1px" }} />{" "}
                            {booking.adults || 1} Adult{(booking.adults || 1) > 1 ? "s" : ""}, {booking.children || 0} Child
                          </span>
                        </div>
                      </td>

                      <td className="th-address">
                        <div className="bank-cell">
                          <span className="bank-primary">
                            {checkinDateFormatted}
                            {checkinTimeFormatted && (
                              <span className="time-sub-tag"> @ {checkinTimeFormatted}</span>
                            )}
                          </span>
                          <span className="bank-sub">
                            to {checkoutDateFormatted}
                            {checkoutTimeFormatted && (
                              <span className="time-sub-tag"> @ {checkoutTimeFormatted}</span>
                            )}
                          </span>
                          <div style={{ marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span className="hospitality-cycle-pill">
                              {stayBadgeText}
                            </span>
                            {booking.is_late_checkout && (
                              <span className="late-checkout-chip" title="Departed after standard checkout cutoff">
                                Late Check-out
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="th-identity">
                        <div className="bank-cell">
                          <span className="bank-primary" style={{ color: "#166962", fontWeight: 700 }}>
                            ₹{totalAmt.toFixed(2)}
                          </span>
                          <span className="bank-sub" style={{ fontSize: "11px" }}>
                            Adv: ₹{advAmt.toFixed(2)} (
                            <strong style={{ textTransform: "uppercase" }}>
                              {booking.payment_method || "CASH"}
                            </strong>
                            )
                          </span>
                          {balAmt > 0 ? (
                            <span className="balance-due-text">Due: ₹{balAmt.toFixed(2)}</span>
                          ) : (
                            <span className="balance-paid-text">Fully Paid</span>
                          )}
                        </div>
                      </td>

                      <td className="th-bank">
                        <div style={{ display: "flex", gap: "5px", flexDirection: "column", alignItems: "flex-start" }}>
                          <span
                            className={`mono-pill ${
                              status === "checked-in"
                                ? "pill-normal"
                                : status === "confirmed"
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
                                : payStatus === "partial" || payStatus === "partially_paid"
                                ? "pill-warning"
                                : "pill-urgent"
                            }`}
                          >
                            {payStatus.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      <td className="th-action" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          {status === "confirmed" && (
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="Proceed to Check In"
                              onClick={(e) => handleCheckIn(booking, e)}
                            >
                              <LogIn size={13} color="#166962" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="dir-row-edit-btn"
                            title="View / Edit Details"
                            onClick={() => openDetailsModal(booking)}
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION (20 items per page with Next / Previous & sizing) */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredBookings.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          itemLabel="bookings"
        />
      </section>

      {/* CREATE & EDIT RESERVATION MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ maxWidth: "760px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {!editingBooking
                    ? "Create New Reservation"
                    : isEditing
                    ? `Edit Reservation • ${editingBooking.reservation_code || `#${editingBooking.id}`}`
                    : `Reservation ${editingBooking.reservation_code || `#${editingBooking.id}`} Overview`}
                </h2>
                {editingBooking && !isEditing && (
                  <p className="modal-kicker">Read-Only Mode • Click 'Edit Details' to make changes</p>
                )}
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="modal-body">
                {/* Top Quick Actions Strip: Returning Guest & Foreign / Form C Toggle */}
                {isEditing && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      background: isInternationalActive ? "#fdf4ff" : "#f8fafc",
                      border: isInternationalActive ? "1.5px solid #f0abfc" : "1px dashed #cbd5e1",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      marginBottom: "16px",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {guests.length > 0 ? (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            marginBottom: "5px",
                          }}
                        >
                          <Users size={13} color="#2d5696" />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                            Quick-Select Returning Guest
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            (Auto-fills details from directory)
                          </span>
                        </div>
                        <select
                          className="dir-select-field"
                          style={{ fontSize: "12.5px", width: "100%", height: "34px", padding: "4px 8px" }}
                          onChange={(e) => handleSelectReturningGuest(e.target.value)}
                          defaultValue=""
                          disabled={!isEditing || saving}
                        >
                          <option value="">-- Choose Existing Guest from Directory --</option>
                          {guests.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.full_name} • {g.phone} {g.address ? `(${g.address})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                          Guest Registration
                        </span>
                      </div>
                    )}

                    {/* Foreign Guest / Form C Pill Button */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isEditing || saving) return;
                          const nextVal = !isInternationalActive;
                          setFormData((prev) => ({
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
                        disabled={!isEditing || saving}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "7px 14px",
                          borderRadius: "20px",
                          border: isInternationalActive ? "1.5px solid #a855f7" : "1.5px solid #cbd5e1",
                          background: isInternationalActive ? "#fae8ff" : "#ffffff",
                          color: isInternationalActive ? "#701a75" : "#475569",
                          fontWeight: 600,
                          fontSize: "12px",
                          cursor: isEditing && !saving ? "pointer" : "default",
                          boxShadow: isInternationalActive
                            ? "0 2px 4px rgba(168, 85, 247, 0.2)"
                            : "0 1px 2px rgba(0, 0, 0, 0.05)",
                          transition: "all 0.2s ease",
                        }}
                        title="Toggle for Non-Indian Citizen / International Passport Holder (Form C Required)"
                      >
                        <Globe size={14} color={isInternationalActive ? "#9333ea" : "#64748b"} />
                        <span>Foreign Guest (Form C)</span>
                        <span
                          style={{
                            display: "inline-block",
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            background: isInternationalActive ? "#a855f7" : "#cbd5e1",
                            boxShadow: isInternationalActive ? "0 0 5px #a855f7" : "none",
                          }}
                        />
                      </button>
                      {isInternationalActive && (
                        <span
                          style={{
                            fontSize: "10.5px",
                            color: "#86198f",
                            fontWeight: 600,
                            marginTop: "3px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          Form C active
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Read-only notification badge when viewing an international guest */}
                {!isEditing && isInternationalActive && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "#fdf4ff",
                      border: "1px solid #f0abfc",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      marginBottom: "14px",
                      fontSize: "12px",
                      color: "#86198f",
                      fontWeight: 600,
                    }}
                  >
                    <Globe size={15} color="#86198f" />
                    <span>International Guest • Bureau of Immigration Form C Profile</span>
                  </div>
                )}

                {/* Primary Guest Details */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Primary Guest Name *</label>
                    <input
                      type="text"
                      name="primary_guest_name"
                      value={formData.primary_guest_name}
                      onChange={handleInputChange}
                      placeholder="Enter primary guest full name"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="10-digit mobile number"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="primary.guest@example.com"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>Guest Classification</label>
                    <select
                      name="guest_type"
                      value={formData.guest_type}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="individual">Individual Guest</option>
                      <option value="corporate">Corporate (Company GST Billing)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Guest Address / City</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address || ""}
                      onChange={handleInputChange}
                      placeholder="Residential address / city"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>Nationality</label>
                    <input
                      type="text"
                      name="nationality"
                      value={formData.nationality || "Indian"}
                      onChange={handleInputChange}
                      placeholder="e.g. Indian, American, British"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                {/* Corporate Details */}
                {formData.guest_type === "corporate" && (
                  <div className="corporate-details-box">
                    <div className="corporate-header">
                      <Building size={16} color="#2d5696" />
                      <span>Corporate Billing Details</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Company Name</label>
                        <input
                          type="text"
                          name="company_name"
                          value={formData.company_name}
                          onChange={handleInputChange}
                          placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : ""}
                        />
                      </div>
                      <div className="form-group">
                        <label>Company GSTIN</label>
                        <input
                          type="text"
                          name="gstin"
                          value={formData.gstin}
                          onChange={handleInputChange}
                          placeholder="15-digit GSTIN number"
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : ""}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginTop: "8px" }}>
                      <label>Corporate Notes / Billing Instructions</label>
                      <input
                        type="text"
                        name="corporate_notes"
                        value={formData.corporate_notes}
                        onChange={handleInputChange}
                        placeholder="e.g. Bill to company account, PO #1042"
                        disabled={!isEditing || saving}
                        className={!isEditing ? "input-locked" : ""}
                      />
                    </div>
                  </div>
                )}

                {/* Identity Verification */}
                <div className="form-row">
                  <div className="form-group">
                    <label>ID Proof Type</label>
                    <select
                      name="id_proof_type"
                      value={formData.id_proof_type}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="Aadhaar">Aadhaar</option>
                      <option value="Passport">Passport</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter ID">Voter ID</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>ID Proof Number</label>
                    <input
                      type="text"
                      name="id_proof_number"
                      value={formData.id_proof_number}
                      onChange={handleInputChange}
                      placeholder="Enter identity number"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                {/* International Guest / Form C Registration (Bureau of Immigration) */}
                {isInternationalActive && (
                  <div
                    className="corporate-details-box"
                    style={{
                      background: "#fdf4ff",
                      borderColor: "#f0abfc",
                      marginBottom: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #fae8ff",
                        paddingBottom: "8px",
                      }}
                    >
                      <div className="corporate-header" style={{ color: "#86198f" }}>
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
                          onClick={handleCopyFormC}
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

                    <div className="form-row" style={{ marginTop: "6px" }}>
                      <div className="form-group">
                        <label>Passport Expiry Date</label>
                        <input
                          type="date"
                          name="passport_expiry"
                          value={formData.passport_expiry || ""}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : "clean-date-input"}
                        />
                      </div>
                      <div className="form-group">
                        <label>Visa / e-Visa Number</label>
                        <input
                          type="text"
                          name="visa_number"
                          value={formData.visa_number || ""}
                          onChange={handleInputChange}
                          placeholder="e.g. V981240 / e-Visa ref"
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : ""}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Visa Type</label>
                        <select
                          name="visa_type"
                          value={formData.visa_type || "Tourist (e-Visa / Regular)"}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                          className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
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
                          value={formData.visa_expiry || ""}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : "clean-date-input"}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Port of Entry into India</label>
                        <input
                          type="text"
                          name="port_of_entry"
                          value={formData.port_of_entry || ""}
                          onChange={handleInputChange}
                          placeholder="e.g. Delhi (DEL), Mumbai (BOM), Bengaluru (BLR)"
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : ""}
                        />
                      </div>
                      <div className="form-group">
                        <label>Date of Arrival in India</label>
                        <input
                          type="date"
                          name="date_of_arrival_in_country"
                          value={formData.date_of_arrival_in_country || ""}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : "clean-date-input"}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: "4px" }}>
                      <label>Next Destination / City & Country</label>
                      <input
                        type="text"
                        name="next_destination"
                        value={formData.next_destination || ""}
                        onChange={handleInputChange}
                        placeholder="e.g. Agra, India or London, UK"
                        disabled={!isEditing || saving}
                        className={!isEditing ? "input-locked" : ""}
                      />
                    </div>
                  </div>
                )}

                {/* Multi-Room Setup */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Number of Rooms *</label>
                    <input
                      type="number"
                      name="rooms_count"
                      min="1"
                      max="20"
                      value={formData.rooms_count}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Assigned Room Count Summary</label>
                    <div className="time-select-pill" style={{ height: "42px", background: "#f8fafc" }}>
                      <BedDouble size={16} color="#2d5696" />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                        {formData.rooms_count} Room{Number(formData.rooms_count) > 1 ? "s" : ""} Selected
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Room Selectors */}
                <div className="multi-rooms-section">
                  <div className="multi-rooms-header">
                    <BedDouble size={15} color="#2d5696" />
                    <strong>
                      Room Allocations ({formData.rooms_count} Room
                      {Number(formData.rooms_count) > 1 ? "s" : ""} Required){" "}
                      {loadingRooms ? "(Checking availability...)" : ""}
                    </strong>
                  </div>

                  <div
                    className="form-row"
                    style={{
                      gridTemplateColumns:
                        Number(formData.rooms_count) > 1 ? "repeat(2, 1fr)" : "1fr",
                      gap: "10px",
                    }}
                  >
                    {Array.from({ length: Number(formData.rooms_count) || 1 }).map((_, slotIndex) => {
                      const currentSelectedId = formData.selected_room_ids[slotIndex] || "";

                      const otherSelectedIds = formData.selected_room_ids.filter(
                        (id, idx) => idx !== slotIndex && Boolean(id)
                      );

                      const selectableRooms = availableRooms.filter(
                        (r) => !otherSelectedIds.includes(String(r.id))
                      );

                      return (
                        <div key={slotIndex} className="form-group">
                          <label>Room {slotIndex + 1} Allocation *</label>
                          <select
                            value={currentSelectedId}
                            onChange={(e) =>
                              handleSpecificRoomChange(slotIndex, e.target.value)
                            }
                            disabled={!isEditing || saving || loadingRooms}
                            className={`dir-select-field ${
                              !isEditing ? "input-locked" : ""
                            }`}
                            required
                          >
                            <option value="">
                              {loadingRooms
                                ? "Verifying..."
                                : `-- Select Room ${slotIndex + 1} --`}
                            </option>
                            {selectableRooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                Room {r.room_number} - {r.room_type} (₹
                                {Number(r.base_price || r.price_per_night || 0)}/night)
                              </option>
                            ))}
                            {currentSelectedId &&
                              !selectableRooms.some(
                                (r) => String(r.id) === String(currentSelectedId)
                              ) && (
                                <option value={currentSelectedId}>
                                  Room{" "}
                                  {getRoom(currentSelectedId)?.room_number || currentSelectedId}{" "}
                                  (Currently Assigned)
                                </option>
                              )}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Time with Hospitality standard checkout indicators */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Check-in Date & Time *</label>
                    <div className="date-time-combined-row">
                      <input
                        type="date"
                        name="checkin_date"
                        value={formData.checkin_date}
                        onChange={handleInputChange}
                        disabled={!isEditing || saving}
                        className={!isEditing ? "input-locked" : "clean-date-input"}
                        required
                      />
                      <div className="time-select-pill">
                        <Clock size={14} color="#2d5696" />
                        <input
                          type="time"
                          name="checkin_time"
                          value={formData.checkin_time}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Check-out Date & Time *</label>
                    <div className="date-time-combined-row">
                      <input
                        type="date"
                        name="checkout_date"
                        value={formData.checkout_date}
                        onChange={handleInputChange}
                        disabled={!isEditing || saving}
                        className={!isEditing ? "input-locked" : "clean-date-input"}
                        required
                      />
                      <div className="time-select-pill">
                        <Clock size={14} color="#2d5696" />
                        <input
                          type="time"
                          name="checkout_time"
                          value={formData.checkout_time}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Occupancy, Source & Status */}
                <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  <div className="form-group">
                    <label>Adults</label>
                    <input
                      type="number"
                      name="adults"
                      min="1"
                      value={formData.adults}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Children</label>
                    <input
                      type="number"
                      name="children"
                      min="0"
                      value={formData.children}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Booking Source</label>
                    <select
                      name="booking_source"
                      value={formData.booking_source}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      {bookingSources.map((source) => (
                        <option key={source} value={source}>
                          {source.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Booking Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      {bookingStatuses.map((st) => (
                        <option key={st} value={st}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* OTA Booking Platform Details */}
                {formData.booking_source === "ota" && (
                  <div
                    className="corporate-details-box"
                    style={{ background: "#f0f9ff", borderColor: "#bae6fd", marginBottom: "14px" }}
                  >
                    <div className="corporate-header" style={{ color: "#0369a1" }}>
                      <Globe size={16} color="#0369a1" />
                      <span>Online Travel Agent (OTA) Booking Details</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>OTA Platform / Partner</label>
                        <select
                          name="ota_channel"
                          value={formData.ota_channel || "Booking.com"}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                          className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                        >
                          {OTA_PLATFORMS.map((plat) => (
                            <option key={plat} value={plat}>
                              {plat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>OTA Voucher / Confirmation Ref #</label>
                        <input
                          type="text"
                          name="ota_reference"
                          value={formData.ota_reference || ""}
                          onChange={handleInputChange}
                          placeholder="e.g. BKG-9921841 / MMT-77412"
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : ""}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Agent Referral Details */}
                {formData.booking_source === "agent" && (
                  <div
                    className="corporate-details-box"
                    style={{ background: "#fffbeb", borderColor: "#fde68a", marginBottom: "14px" }}
                  >
                    <div className="corporate-header" style={{ color: "#b45309" }}>
                      <Briefcase size={16} color="#b45309" />
                      <span>Agent Referral Details</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Agent Name *</label>
                        <input
                          type="text"
                          name="agent_name"
                          value={formData.agent_name || ""}
                          onChange={handleInputChange}
                          placeholder="e.g. City Travels, Ramesh, Tour Desk"
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : ""}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Agent Phone Number (Optional)</label>
                        <input
                          type="tel"
                          name="agent_phone"
                          value={formData.agent_phone || ""}
                          onChange={handleInputChange}
                          placeholder="10-digit mobile number"
                          disabled={!isEditing || saving}
                          className={!isEditing ? "input-locked" : ""}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginTop: "6px" }}>
                      <label>Commission / Referral Notes (Optional)</label>
                      <input
                        type="text"
                        name="agent_notes"
                        value={formData.agent_notes || ""}
                        onChange={handleInputChange}
                        placeholder="e.g. ₹500 referral commission or 10% on checkout"
                        disabled={!isEditing || saving}
                        className={!isEditing ? "input-locked" : ""}
                      />
                    </div>
                  </div>
                )}

                {/* Extra Services & Add-ons */}
                <div className="extra-services-container">
                  <div className="extra-services-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Sparkles size={15} color="#2d5696" />
                      <strong>Extra Services & Add-ons (Optional)</strong>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        className="btn-add-service"
                        onClick={handleAddService}
                      >
                        <Plus size={13} /> Add Item
                      </button>
                    )}
                  </div>

                  {formData.extra_services.length === 0 ? (
                    <p className="no-extra-services">
                      No add-on services selected.
                    </p>
                  ) : (
                    formData.extra_services.map((svc, idx) => {
                      const hasInCatalog = catalogServices.some((c) => c.name === svc.name);

                      return (
                        <div key={idx} className="service-row-item">
                          <select
                            value={svc.name}
                            onChange={(e) => handleCatalogServiceSelect(idx, e.target.value)}
                            disabled={!isEditing || saving}
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
                            disabled={!isEditing || saving}
                            className="service-input-price"
                            style={{ width: "120px" }}
                          />

                          {isEditing && (
                            <button
                              type="button"
                              className="btn-remove-service"
                              onClick={() => handleRemoveService(idx)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Additional Co-Guests / Occupants */}
                <div className="extra-services-container" style={{ marginTop: "14px" }}>
                  <div className="extra-services-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Users size={15} color="#2d5696" />
                      <strong>Additional Co-Guests / Occupants ({formData.co_guests?.length || 0})</strong>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        className="btn-add-service"
                        onClick={handleAddCoGuest}
                      >
                        <Plus size={13} /> Add Co-Guest
                      </button>
                    )}
                  </div>

                  {(!formData.co_guests || formData.co_guests.length === 0) ? (
                    <p className="no-extra-services">
                      No additional co-guests recorded for this reservation.
                    </p>
                  ) : (
                    formData.co_guests.map((cg, idx) => (
                      <div
                        key={idx}
                        className="service-row-item"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 0.8fr 0.6fr 1fr 1fr auto",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Co-Guest Name *"
                          value={cg.full_name || ""}
                          onChange={(e) => handleUpdateCoGuest(idx, "full_name", e.target.value)}
                          disabled={!isEditing || saving}
                          className="service-input"
                          style={{ flex: "none" }}
                          required
                        />
                        <select
                          value={cg.gender || "male"}
                          onChange={(e) => handleUpdateCoGuest(idx, "gender", e.target.value)}
                          disabled={!isEditing || saving}
                          className="dir-select-field service-input"
                          style={{ flex: "none" }}
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="number"
                          placeholder="Age"
                          min="1"
                          max="120"
                          value={cg.age || ""}
                          onChange={(e) => handleUpdateCoGuest(idx, "age", e.target.value)}
                          disabled={!isEditing || saving}
                          className="service-input"
                          style={{ flex: "none" }}
                        />
                        <select
                          value={cg.id_type || "Aadhaar"}
                          onChange={(e) => handleUpdateCoGuest(idx, "id_type", e.target.value)}
                          disabled={!isEditing || saving}
                          className="dir-select-field service-input"
                          style={{ flex: "none" }}
                        >
                          <option value="Aadhaar">Aadhaar</option>
                          <option value="Passport">Passport</option>
                          <option value="Driving License">DL</option>
                          <option value="Voter ID">Voter ID</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="text"
                          placeholder="ID Number"
                          value={cg.id_number || ""}
                          onChange={(e) => handleUpdateCoGuest(idx, "id_number", e.target.value)}
                          disabled={!isEditing || saving}
                          className="service-input"
                          style={{ flex: "none" }}
                        />
                        {isEditing && (
                          <button
                            type="button"
                            className="btn-remove-service"
                            onClick={() => handleRemoveCoGuest(idx)}
                            title="Remove Co-Guest"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Special Requests & Front Desk Notes */}
                <div className="form-group" style={{ marginTop: "14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText size={14} color="#2d5696" />
                    Special Requests & Operational Notes
                  </label>
                  <textarea
                    name="special_requests"
                    rows="2"
                    value={formData.special_requests || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. High floor preference, airport pick-up requested, quiet room, late check-in notice..."
                    disabled={!isEditing || saving}
                    className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>

                {/* Pricing & Tax */}
                <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div className="form-group">
                    <label>Combined Daily Rate (₹) *</label>
                    <input
                      type="number"
                      name="room_rate"
                      step="0.01"
                      min="0"
                      value={activeNightlyRate}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Discount (₹)</label>
                    <input
                      type="number"
                      name="discount"
                      step="0.01"
                      min="0"
                      value={formData.discount}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>GST Mode</label>
                    <select
                      name="tax_mode"
                      value={formData.tax_mode}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="inclusive">GST Included</option>
                      <option value="exclusive">GST Extra</option>
                    </select>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div className="form-group">
                    <label>Advance / Paid Amount (₹)</label>
                    <input
                      type="number"
                      name="advance_paid"
                      step="0.01"
                      min="0"
                      value={formData.advance_paid}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Method</label>
                    <select
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      {paymentMethods.map((m) => (
                        <option key={m} value={m}>
                          {m.replace("_", " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Payment Status</label>
                    <select
                      name="payment_status"
                      value={formData.payment_status}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      {paymentStatuses.map((p) => (
                        <option key={p} value={p}>
                          {p.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Summary Banner with Late Checkout Indicator */}
                <div className="booking-modal-calc-banner">
                  <div className="calc-banner-col">
                    <span>Stay Plan</span>
                    <strong>{stayMetrics.stay_label}</strong>
                    {stayMetrics.is_late_checkout && (
                      <span className="late-notice-text">
                        <AlertTriangle size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> Late check-out (+1 Night)
                      </span>
                    )}
                  </div>
                  <div className="calc-banner-col">
                    <span>Rooms</span>
                    <strong>{formData.rooms_count} Room{Number(formData.rooms_count) > 1 ? "s" : ""}</strong>
                  </div>
                  <div className="calc-banner-col">
                    <span>Tax ({activeTaxRate}%)</span>
                    <strong>₹{calculatedTaxAmount.toFixed(2)}</strong>
                  </div>
                  <div className="calc-banner-col">
                    <span>Total Bill</span>
                    <strong style={{ color: "#166962" }}>
                      ₹{calculatedTotalAmount.toFixed(2)}
                    </strong>
                  </div>
                  <div className="calc-banner-col">
                    <span>Balance Due</span>
                    <strong
                      style={{
                        color: balanceAmount > 0 ? "#dc2626" : "#166962",
                      }}
                    >
                      ₹{balanceAmount.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                {editingBooking ? (
                  <>
                    <div className="footer-left" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-danger-outline"
                        onClick={openDeleteConfirmation}
                        disabled={saving}
                      >
                        <Trash2 size={14} /> Delete Booking
                      </button>

                      {editingBooking.status !== "cancelled" && (
                        <button
                          type="button"
                          className="btn-secondary-action"
                          style={{
                            borderColor: "#fca5a5",
                            color: "#b91c1c",
                            background: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            border: "1px solid #fca5a5",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                          onClick={handleQuickCancelBooking}
                          disabled={saving}
                        >
                          <XCircle size={14} /> Cancel Reservation
                        </button>
                      )}
                    </div>

                    <div className="footer-right">
                      {!isEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={closeModal}
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            onClick={(e) => {
                              e.preventDefault();
                              setIsEditing(true);
                            }}
                          >
                            <Edit2 size={14} /> Edit Details
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn-submit"
                            disabled={saving}
                          >
                            <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div
                    className="footer-right"
                    style={{ width: "100%", justifyContent: "flex-end" }}
                  >
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={closeModal}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-submit"
                      disabled={saving}
                    >
                      <Save size={14} /> {saving ? "Saving..." : "Create Reservation"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="modal-overlay nested-modal">
          <div
            className="modal-content delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} color="#dc2626" />
                <h2 style={{ fontSize: "16px", color: "#dc2626" }}>Confirm Deletion</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeDeleteConfirmation}
                disabled={deleting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} onClick={(e) => e.stopPropagation()}>
              <div className="modal-body" style={{ gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
                  Are you sure you want to permanently delete reservation{" "}
                  <strong>{editingBooking?.reservation_code || `#${editingBooking?.id}`}</strong>?
                </p>

                <div className="form-group" style={{ marginTop: "6px" }}>
                  <label style={{ fontSize: "12px", color: "#0f172a" }}>
                    Enter Admin Password *
                  </label>
                  <div className="password-input-wrap">
                    <Lock size={14} className="password-icon" />
                    <input
                      type="password"
                      className="asr-input"
                      style={{ paddingLeft: "34px" }}
                      placeholder="Admin Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      disabled={deleting}
                      autoFocus
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ background: "#f8fafc" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeDeleteConfirmation}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={deleting || !adminPassword.trim()}
                >
                  <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}