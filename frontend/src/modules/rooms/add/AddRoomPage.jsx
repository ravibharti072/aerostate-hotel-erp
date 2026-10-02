import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  BedDouble,
  CheckCircle,
  Key,
  Wrench,
  Edit2,
  Trash2,
  X,
  Save,
  Briefcase,
  Lock,
  Shield,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Check,
  Layers,
  Download,
  Users,
  Building2,
  SlidersHorizontal,
  Filter,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./addRoom.css";

const roomStatuses = [
  "available",
  "occupied",
  "cleaning",
  "dirty",
  "maintenance",
  "out-of-service",
];

const roomTypePresets = [
  "Standard Room",
  "Deluxe Room",
  "Super Deluxe",
  "Executive Suite",
  "Presidential Suite",
  "Family Room",
];

const bedTypeOptions = [
  "King Bed",
  "Queen Bed",
  "Twin Beds",
  "Double Bed",
  "Single Bed",
];

const standardAmenities = [
  "Air Conditioning (AC)",
  "High-Speed Wi-Fi",
  "Balcony / View",
  "Smart TV",
  "Mini Bar / Fridge",
  "Geyser / Hot Water",
  "Electronic Safe",
  "Bathtub",
  "Work Desk",
  "Tea / Coffee Maker",
];

function inferFloorFromRoomNumber(roomNum) {
  if (!roomNum) return "";
  const clean = String(roomNum).trim();
  const match = clean.match(/^(\d+)/);
  if (match) {
    const num = match[1];
    if (num.length >= 3) {
      return num.slice(0, num.length - 2);
    } else if (num.length === 2) {
      return num.charAt(0);
    }
  }
  return "";
}

function calculateRoomGst(price) {
  const p = Number(price) || 0;
  if (p <= 0) {
    return { rate: 0, taxAmount: 0, total: 0, slabLabel: "Enter tariff to calculate GST" };
  }
  if (p < 1000) {
    return {
      rate: 0,
      taxAmount: 0,
      total: p,
      slabLabel: "GST Exempt (0% - Under ₹1,000)",
    };
  }
  if (p < 7500) {
    const tax = Math.round(p * 0.12 * 100) / 100;
    return {
      rate: 12,
      taxAmount: tax,
      total: Math.round((p + tax) * 100) / 100,
      slabLabel: "Standard Slab (12% GST)",
    };
  }
  const tax = Math.round(p * 0.18 * 100) / 100;
  return {
    rate: 18,
    taxAmount: tax,
    total: Math.round((p + tax) * 100) / 100,
    slabLabel: "Luxury Slab (18% GST)",
  };
}

function parseAmenitiesFromDescription(desc) {
  if (!desc) return [];
  const lower = desc.toLowerCase();
  return standardAmenities.filter((amenity) => {
    const kw = amenity.split("/")[0].split("(")[0].trim().toLowerCase();
    return lower.includes(kw);
  });
}

const emptyRoomForm = {
  room_number: "",
  room_type: "Deluxe Room",
  bed_type: "King Bed",
  max_occupancy: 2,
  floor: "",
  price_per_night: "",
  status: "available",
  notes: "",
  amenities: ["Air Conditioning (AC)", "High-Speed Wi-Fi"],
};

const emptyBatchForm = {
  floor: "1",
  start_num: "101",
  end_num: "110",
  prefix: "",
  room_type: "Deluxe Room",
  bed_type: "King Bed",
  max_occupancy: 2,
  price_per_night: "2500",
  amenities: ["Air Conditioning (AC)", "High-Speed Wi-Fi"],
  notes: "",
};

export default function AddRoomPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [formData, setFormData] = useState(emptyRoomForm);

  // Modal & Edit State (Issue 2)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Batch Generator Modal State (Issue 3)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchFormData, setBatchFormData] = useState(emptyBatchForm);
  const [batchSaving, setBatchSaving] = useState(false);

  // Quick Status Change State (Issue 4)
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Filter & Queue Tab State (Issue 1 & 5)
  const [activeTab, setActiveTab] = useState("all"); // "all" | "available" | "occupied" | "cleaning" | "maintenance"
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [bedTypeFilter, setBedTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("room_asc");

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

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await api.get("/rooms");
      setRooms(normalizeList(response.data, "rooms"));
    } catch (err) {
      console.error("Fetch rooms error:", err);
      showToast(getApiErrorMessage(err, "Failed to load hotel rooms."), "error");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const summary = useMemo(() => {
    const total = rooms.length;
    const available = rooms.filter(
      (r) => String(r.status || "").toLowerCase() === "available"
    ).length;
    const occupied = rooms.filter(
      (r) => String(r.status || "").toLowerCase() === "occupied"
    ).length;
    const cleaning = rooms.filter((r) => {
      const st = String(r.status || "").toLowerCase();
      return st === "cleaning" || st === "dirty";
    }).length;
    const maintenance = rooms.filter((r) => {
      const st = String(r.status || "").toLowerCase();
      return st === "maintenance" || st === "out-of-service" || st === "blocked";
    }).length;

    return { total, available, occupied, cleaning, maintenance };
  }, [rooms]);

  // Distinct Floors & Room Types extracted dynamically (Issue 5)
  const availableFloors = useMemo(() => {
    const set = new Set();
    rooms.forEach((r) => {
      const fl = String(r.floor ?? inferFloorFromRoomNumber(r.room_number) ?? "").trim();
      if (fl) set.add(fl);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rooms]);

  const availableRoomTypes = useMemo(() => {
    const set = new Set(roomTypePresets);
    rooms.forEach((r) => {
      if (r.room_type) set.add(String(r.room_type).trim());
    });
    return Array.from(set);
  }, [rooms]);

  // Batch Generation Preview Calculation (Issue 3)
  const batchPreview = useMemo(() => {
    const start = parseInt(batchFormData.start_num, 10);
    const end = parseInt(batchFormData.end_num, 10);
    if (isNaN(start) || isNaN(end) || start > end) {
      return { list: [], toCreateCount: 0, skippedCount: 0, error: "Please enter valid starting and ending room numbers." };
    }
    const count = end - start + 1;
    if (count > 80) {
      return { list: [], toCreateCount: 0, skippedCount: 0, error: "Maximum 80 rooms can be generated in a single batch." };
    }

    const existingSet = new Set(
      rooms.map((r) => String(r.room_number || "").trim().toLowerCase())
    );
    const prefix = String(batchFormData.prefix || "").trim();

    const list = [];
    let toCreateCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < count; i++) {
      const rawNum = start + i;
      const numStr = prefix ? `${prefix}${rawNum}` : String(rawNum);
      const exists = existingSet.has(numStr.toLowerCase());
      if (exists) {
        skippedCount++;
      } else {
        toCreateCount++;
      }
      list.push({ room_number: numStr, exists });
    }

    return { list, toCreateCount, skippedCount, error: null };
  }, [batchFormData.start_num, batchFormData.end_num, batchFormData.prefix, rooms]);

  const batchGstPreview = useMemo(() => {
    return calculateRoomGst(batchFormData.price_per_night);
  }, [batchFormData.price_per_night]);

  // Enhanced Filtered Rooms (Issue 1 & 5)
  const filteredRooms = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    let list = rooms.filter((room) => {
      const roomNum = String(room.room_number || "").toLowerCase();
      const type = String(room.room_type || "").toLowerCase();
      const bed = String(room.bed_type || "").toLowerCase();
      const floorStr = String(room.floor ?? inferFloorFromRoomNumber(room.room_number) ?? "").toLowerCase();
      const desc = String(room.description || "").toLowerCase();

      return (
        !search ||
        roomNum.includes(search) ||
        type.includes(search) ||
        bed.includes(search) ||
        floorStr.includes(search) ||
        desc.includes(search)
      );
    });

    list = list.filter((room) => {
      const status = String(room.status || "available").toLowerCase();
      if (activeTab === "available") return status === "available";
      if (activeTab === "occupied") return status === "occupied";
      if (activeTab === "cleaning") return status === "cleaning" || status === "dirty";
      if (activeTab === "maintenance") return status === "maintenance" || status === "out-of-service" || status === "blocked";
      return true; // "all"
    });

    list = list.filter((room) => {
      const status = String(room.status || "").toLowerCase();
      if (statusFilter === "all") return true;
      return status === statusFilter.toLowerCase();
    });

    list = list.filter((room) => {
      if (floorFilter === "all") return true;
      const fl = String(room.floor ?? inferFloorFromRoomNumber(room.room_number) ?? "").trim().toLowerCase();
      return fl === floorFilter.toLowerCase();
    });

    list = list.filter((room) => {
      if (roomTypeFilter === "all") return true;
      return String(room.room_type || "").toLowerCase() === roomTypeFilter.toLowerCase();
    });

    list = list.filter((room) => {
      if (bedTypeFilter === "all") return true;
      return String(room.bed_type || "King Bed").toLowerCase() === bedTypeFilter.toLowerCase();
    });

    list.sort((a, b) => {
      const numA = a.room_number || "";
      const numB = b.room_number || "";

      if (sortBy === "room_desc") return numB.localeCompare(numA, undefined, { numeric: true });
      if (sortBy === "floor_asc") {
        const fA = String(a.floor ?? inferFloorFromRoomNumber(a.room_number) ?? "");
        const fB = String(b.floor ?? inferFloorFromRoomNumber(b.room_number) ?? "");
        return fA.localeCompare(fB, undefined, { numeric: true });
      }
      if (sortBy === "floor_desc") {
        const fA = String(a.floor ?? inferFloorFromRoomNumber(a.room_number) ?? "");
        const fB = String(b.floor ?? inferFloorFromRoomNumber(b.room_number) ?? "");
        return fB.localeCompare(fA, undefined, { numeric: true });
      }
      if (sortBy === "price_high") {
        return Number(b.base_price || b.price_per_night || 0) - Number(a.base_price || a.price_per_night || 0);
      }
      if (sortBy === "price_low") {
        return Number(a.base_price || a.price_per_night || 0) - Number(b.base_price || b.price_per_night || 0);
      }
      if (sortBy === "status") {
        return String(a.status || "").localeCompare(String(b.status || ""));
      }
      return numA.localeCompare(numB, undefined, { numeric: true });
    });

    return list;
  }, [rooms, searchTerm, activeTab, statusFilter, floorFilter, roomTypeFilter, bedTypeFilter, sortBy]);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    statusFilter !== "all" ||
    floorFilter !== "all" ||
    roomTypeFilter !== "all" ||
    bedTypeFilter !== "all" ||
    activeTab !== "all";

  const gstPreview = useMemo(() => {
    return calculateRoomGst(formData.price_per_night);
  }, [formData.price_per_night]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "room_number") {
      setFormData((prev) => {
        const oldInferred = inferFloorFromRoomNumber(prev.room_number);
        const shouldAutoFloor = !prev.floor || prev.floor === oldInferred;
        const newInferred = inferFloorFromRoomNumber(value);

        return {
          ...prev,
          room_number: value,
          floor: shouldAutoFloor && newInferred ? newInferred : prev.floor,
        };
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleToggleAmenity = (amenity) => {
    if (!isEditing || saving) return;
    setFormData((prev) => {
      const exists = (prev.amenities || []).includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...(prev.amenities || []), amenity],
      };
    });
  };

  const openCreateModal = () => {
    setEditingRoom(null);
    setFormData(emptyRoomForm);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetailsModal = (room) => {
    setEditingRoom(room);
    const parsedAmenities = parseAmenitiesFromDescription(room.description);
    let notes = room.description || "";
    if (notes.includes("|")) {
      notes = notes.split("|").slice(1).join("|").trim();
    } else {
      parsedAmenities.forEach((a) => {
        notes = notes.replace(a, "").replace(/,\s*,/g, ",").trim();
      });
    }

    setFormData({
      room_number: room.room_number || "",
      room_type: room.room_type || "Deluxe Room",
      bed_type: room.bed_type || "King Bed",
      max_occupancy: Number(room.max_occupancy) || 2,
      floor: room.floor ?? "",
      price_per_night: room.base_price ?? room.price_per_night ?? "",
      status: room.status || "available",
      notes: notes,
      amenities: parsedAmenities.length > 0 ? parsedAmenities : ["Air Conditioning (AC)", "High-Speed Wi-Fi"],
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving || deleting) return;
    setIsModalOpen(false);
    setEditingRoom(null);
    setIsEditing(false);
    setFormData(emptyRoomForm);
  };

  const handleCancelEdit = () => {
    if (editingRoom) {
      openDetailsModal(editingRoom);
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

    const rNum = String(formData.room_number).trim();
    const rType = String(formData.room_type).trim();

    if (!rNum || !rType) {
      showToast("Room Number and Room Type are required.", "error");
      return;
    }

    // Client-side duplicate check
    const duplicate = rooms.some(
      (r) =>
        (!editingRoom || Number(r.id) !== Number(editingRoom.id)) &&
        String(r.room_number).trim().toLowerCase() === rNum.toLowerCase()
    );
    if (duplicate) {
      showToast(`Room number "${rNum}" is already registered in this hotel.`, "error");
      return;
    }

    const amenitiesStr = formData.amenities?.length > 0 ? formData.amenities.join(", ") : "";
    const customNotes = formData.notes?.trim() || "";
    const finalDescription = customNotes
      ? (amenitiesStr && !customNotes.includes(amenitiesStr) ? `${amenitiesStr} | ${customNotes}` : customNotes)
      : amenitiesStr;

    const payload = {
      hotel_id: Number(hotelId),
      room_number: rNum,
      room_type: rType,
      bed_type: String(formData.bed_type || "King Bed").trim(),
      max_occupancy: Number(formData.max_occupancy) || 2,
      floor: String(formData.floor || "").trim(),
      base_price: formData.price_per_night === "" ? 0 : Number(formData.price_per_night),
      status: editingRoom ? formData.status : "available",
      description: finalDescription,
    };

    try {
      setSaving(true);
      if (editingRoom?.id) {
        await api.put(`/rooms/${editingRoom.id}`, payload);
        showToast(`Room ${rNum} updated successfully.`, "success");
      } else {
        await api.post("/rooms", payload);
        showToast(`Room ${rNum} registered successfully.`, "success");
      }
      closeModal();
      fetchRooms();
    } catch (err) {
      console.error("Save room error:", err);
      showToast(getApiErrorMessage(err, "Failed to save room."), "error");
    } finally {
      setSaving(false);
    }
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
      await api.delete(`/rooms/${editingRoom.id}`, {
        data: { admin_password: adminPassword },
      });
      showToast("Room deleted successfully.", "success");
      setIsDeleteModalOpen(false);
      closeModal();
      fetchRooms();
    } catch (err) {
      console.error("Delete room error:", err);
      showToast(getApiErrorMessage(err, "Failed to delete room. Verify admin credentials."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteForRoom = (room, e) => {
    if (e) e.stopPropagation();
    setEditingRoom(room);
    setAdminPassword("");
    setIsDeleteModalOpen(true);
  };

  const handleQuickStatusChange = async (roomId, newStatus) => {
    if (!roomId || !newStatus) return;
    try {
      setUpdatingStatusId(roomId);
      // Optimistic state update
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r))
      );
      try {
        await api.patch(`/rooms/${roomId}/status`, { status: newStatus });
      } catch (patchErr) {
        // Fallback to standard PUT /rooms/{id}
        await api.put(`/rooms/${roomId}`, { status: newStatus });
      }
      showToast(`Room status updated to ${newStatus.replace("-", " ").toUpperCase()}`, "success");
    } catch (err) {
      console.error("Quick status update error:", err);
      showToast(getApiErrorMessage(err, "Failed to update room status."), "error");
      fetchRooms();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredRooms.length === 0) {
      showToast("No rooms to export for current filter criteria.", "error");
      return;
    }

    const headers = [
      "Room Number",
      "Floor",
      "Room Type",
      "Bed Configuration",
      "Max Occupancy",
      "Base Tariff (INR)",
      "Statutory GST Rate",
      "GST Tax Amount (INR)",
      "Total Guest Tariff (INR)",
      "Operational Status",
      "Amenities",
      "Notes",
    ];

    const rows = filteredRooms.map((room) => {
      const price = Number(room.base_price ?? room.price_per_night ?? 0);
      const gst = calculateRoomGst(price);
      const amenities = parseAmenitiesFromDescription(room.description).join("; ");
      let notes = room.description || "";
      if (notes.includes("|")) {
        notes = notes.split("|").slice(1).join("|").trim();
      }

      return [
        `"${String(room.room_number || "").replace(/"/g, '""')}"`,
        `"${String(room.floor || inferFloorFromRoomNumber(room.room_number) || "").replace(/"/g, '""')}"`,
        `"${String(room.room_type || "").replace(/"/g, '""')}"`,
        `"${String(room.bed_type || "King Bed").replace(/"/g, '""')}"`,
        room.max_occupancy || 2,
        price.toFixed(2),
        `"${gst.rate}%"`,
        gst.taxAmount.toFixed(2),
        gst.total.toFixed(2),
        `"${String(room.status || "available").toUpperCase()}"`,
        `"${amenities.replace(/"/g, '""')}"`,
        `"${notes.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `hotel_room_inventory_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filteredRooms.length} rooms to CSV successfully!`, "success");
  };

  const openBatchModal = () => {
    setBatchFormData(emptyBatchForm);
    setIsBatchModalOpen(true);
  };

  const closeBatchModal = () => {
    if (batchSaving) return;
    setIsBatchModalOpen(false);
    setBatchFormData(emptyBatchForm);
  };

  const handleToggleBatchAmenity = (amenity) => {
    if (batchSaving) return;
    setBatchFormData((prev) => {
      const exists = (prev.amenities || []).includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...(prev.amenities || []), amenity],
      };
    });
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    const hotelId = getLoggedInHotelId();
    if (!hotelId) {
      showToast("Hotel ID missing. Please log in again.", "error");
      return;
    }

    if (batchPreview.toCreateCount === 0) {
      showToast("No new rooms to create. All generated room numbers already exist in the inventory.", "error");
      return;
    }

    const amenitiesStr = batchFormData.amenities?.length > 0 ? batchFormData.amenities.join(", ") : "";
    const customNotes = batchFormData.notes?.trim() || "";
    const finalDescription = customNotes
      ? (amenitiesStr && !customNotes.includes(amenitiesStr) ? `${amenitiesStr} | ${customNotes}` : customNotes)
      : amenitiesStr;

    const payloadRooms = batchPreview.list
      .filter((item) => !item.exists)
      .map((item) => ({
        hotel_id: Number(hotelId),
        room_number: item.room_number,
        floor: String(batchFormData.floor || inferFloorFromRoomNumber(item.room_number) || "1").trim(),
        room_type: String(batchFormData.room_type).trim(),
        bed_type: String(batchFormData.bed_type || "King Bed").trim(),
        max_occupancy: Number(batchFormData.max_occupancy) || 2,
        base_price: batchFormData.price_per_night === "" ? 0 : Number(batchFormData.price_per_night),
        status: "available",
        description: finalDescription,
      }));

    try {
      setBatchSaving(true);
      try {
        const res = await api.post("/rooms/batch", {
          hotel_id: Number(hotelId),
          rooms: payloadRooms,
        });
        showToast(
          `Batch created ${res.data.created_count} rooms successfully! ${res.data.skipped_count > 0 ? `(${res.data.skipped_count} skipped)` : ""
          }`,
          "success"
        );
      } catch (batchErr) {
        let successCount = 0;
        for (const rm of payloadRooms) {
          try {
            await api.post("/rooms", rm);
            successCount++;
          } catch (singleErr) {
            console.warn("Single room creation failed in fallback:", rm.room_number, singleErr);
          }
        }
        showToast(`Batch created ${successCount} rooms successfully!`, "success");
      }
      setIsBatchModalOpen(false);
      fetchRooms();
    } catch (err) {
      console.error("Batch save error:", err);
      showToast(getApiErrorMessage(err, "Failed to batch create rooms."), "error");
    } finally {
      setBatchSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setActiveTab("all");
    setStatusFilter("all");
    setFloorFilter("all");
    setRoomTypeFilter("all");
    setBedTypeFilter("all");
    setSortBy("room_asc");
  };

  return (
    <div className="directory-page rooms-add-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Add & Manage Rooms"
        kicker="ROOMS MANAGEMENT"
        description="Register hotel rooms, assign floor layouts, manage pricing tiers, and track availability."
        icon={BedDouble}
        backPath="/rooms"
        rightAction={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="portal-header-badge">
              {summary.available} of {summary.total} rooms available
            </span>

            <button
              type="button"
              className="btn-preview-outline"
              onClick={openBatchModal}
              title="Fast multi-room batch generator"
            >
              <Layers size={15} /> Batch Generator
            </button>
            <button
              type="button"
              className="portal-action-btn"
              onClick={openCreateModal}
            >
              <Plus size={16} /> Register Room
            </button>
          </div>
        }
      />

      {/* 5-CARD OPERATIONAL LIFECYCLE KPI STRIP */}
      <div className="dir-stats-grid cio-stats-five-grid">
        <StatCard
          title="Total Rooms"
          value={summary.total}
          Icon={BedDouble}
          colorTheme="purple"
          onClick={() => setActiveTab("all")}
          isActive={activeTab === "all"}
        />
        <StatCard
          title="Available & Ready"
          value={summary.available}
          Icon={CheckCircle2}
          colorTheme="green"
          onClick={() => setActiveTab("available")}
          isActive={activeTab === "available"}
        />
        <StatCard
          title="Currently Occupied"
          value={summary.occupied}
          Icon={Key}
          colorTheme="blue"
          onClick={() => setActiveTab("occupied")}
          isActive={activeTab === "occupied"}
        />
        <StatCard
          title="Housekeeping Queue"
          value={summary.cleaning}
          Icon={Sparkles}
          colorTheme="amber"
          onClick={() => setActiveTab("cleaning")}
          isActive={activeTab === "cleaning"}
        />
        <StatCard
          title="Maintenance / Blocked"
          value={summary.maintenance}
          Icon={Wrench}
          colorTheme="red"
          onClick={() => setActiveTab("maintenance")}
          isActive={activeTab === "maintenance"}
        />
      </div>

      {/* STANDARDIZED SEGMENTED STATUS QUEUE TABS */}
      <div className="cio-queue-controls">
        <div className="cio-queue-tabs">
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <BedDouble size={15} /> All Rooms
            <span className="cio-tab-count">{summary.total}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "available" ? "active" : ""}`}
            onClick={() => setActiveTab("available")}
          >
            <CheckCircle2 size={15} /> Available & Ready
            <span className="cio-tab-count">{summary.available}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "occupied" ? "active" : ""}`}
            onClick={() => setActiveTab("occupied")}
          >
            <Key size={15} /> Occupied Stays
            <span className="cio-tab-count">{summary.occupied}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "cleaning" ? "active" : ""}`}
            onClick={() => setActiveTab("cleaning")}
          >
            <Sparkles size={15} /> Housekeeping Queue
            <span className="cio-tab-count">{summary.cleaning}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "maintenance" ? "active" : ""}`}
            onClick={() => setActiveTab("maintenance")}
          >
            <Wrench size={15} /> Maintenance & Blocked
            <span className="cio-tab-count">{summary.maintenance}</span>
          </button>
        </div>
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title={
            activeTab === "all"
              ? "Room Inventory Ledger"
              : activeTab === "available"
                ? "Available & Ready Rooms"
                : activeTab === "occupied"
                  ? "Occupied Rooms"
                  : activeTab === "cleaning"
                    ? "Housekeeping & Turnover Queue"
                    : "Maintenance & Blocked Rooms"
          }
          description="Catalog of guest rooms, types, assigned floors, and standard nightly rates."
          badgeCount={filteredRooms.length}
          badgeLabel={
            activeTab === "all"
              ? "rooms"
              : activeTab === "available"
                ? "ready rooms"
                : activeTab === "occupied"
                  ? "occupied rooms"
                  : activeTab === "cleaning"
                    ? "cleaning tasks"
                    : "blocked rooms"
          }
        />

        {/* ISSUE 5: MULTI-FILTER TOOLBAR & CSV EXPORT */}
        <div className="rm-controls-wrapper">
          <div className="dir-controls">
            <div className="dir-search-box" style={{ flex: 1.4 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search room no, type, floor, bed, amenities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Floor Filter */}
              <select
                className="dir-filter-select"
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                title="Filter by Floor"
              >
                <option value="all">All Floors</option>
                {availableFloors.map((fl) => (
                  <option key={fl} value={fl}>
                    Floor {fl}
                  </option>
                ))}
              </select>

              {/* Room Type Filter */}
              <select
                className="dir-filter-select"
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                title="Filter by Room Type"
              >
                <option value="all">All Room Types</option>
                {availableRoomTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Bed Type Filter */}
              <select
                className="dir-filter-select"
                value={bedTypeFilter}
                onChange={(e) => setBedTypeFilter(e.target.value)}
                title="Filter by Bed Configuration"
              >
                <option value="all">All Beds</option>
                {bedTypeOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="dir-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                title="Filter by Status"
              >
                <option value="all">All Statuses</option>
                {roomStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>

              {/* Sort By Dropdown */}
              <select
                className="dir-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                title="Sort Room Directory"
              >
                <option value="room_asc">Room No: Low to High</option>
                <option value="room_desc">Room No: High to Low</option>
                <option value="floor_asc">Floor: Low to High</option>
                <option value="floor_desc">Floor: High to Low</option>
                <option value="price_high">Price: High to Low</option>
                <option value="price_low">Price: Low to High</option>
                <option value="status">Status Priority</option>
              </select>

              {/* CSV Export Button */}
              <button
                type="button"
                className="btn-export-csv"
                onClick={handleExportCSV}
                title="Export filtered room directory to CSV"
              >
                <Download size={14} /> Export CSV
              </button>

              {/* Clear button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-cancel"
                  style={{ height: "40px", padding: "0 14px" }}
                  onClick={clearFilters}
                  title="Reset all active filters"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Bar */}
          {hasActiveFilters && (
            <div className="rm-active-filters-bar">
              <span className="rm-active-filter-label">Active Filters:</span>
              {searchTerm && (
                <span className="rm-filter-chip">
                  Search: "{searchTerm}"
                  <button
                    type="button"
                    className="rm-filter-chip-remove"
                    onClick={() => setSearchTerm("")}
                    title="Remove search"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {floorFilter !== "all" && (
                <span className="rm-filter-chip">
                  Floor: {floorFilter}
                  <button
                    type="button"
                    className="rm-filter-chip-remove"
                    onClick={() => setFloorFilter("all")}
                    title="Remove floor filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {roomTypeFilter !== "all" && (
                <span className="rm-filter-chip">
                  Type: {roomTypeFilter}
                  <button
                    type="button"
                    className="rm-filter-chip-remove"
                    onClick={() => setRoomTypeFilter("all")}
                    title="Remove room type filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {bedTypeFilter !== "all" && (
                <span className="rm-filter-chip">
                  Bed: {bedTypeFilter}
                  <button
                    type="button"
                    className="rm-filter-chip-remove"
                    onClick={() => setBedTypeFilter("all")}
                    title="Remove bed filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="rm-filter-chip">
                  Status: {statusFilter.toUpperCase()}
                  <button
                    type="button"
                    className="rm-filter-chip-remove"
                    onClick={() => setStatusFilter("all")}
                    title="Remove status filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {activeTab !== "all" && (
                <span className="rm-filter-chip">
                  Queue: {activeTab.toUpperCase()}
                  <button
                    type="button"
                    className="rm-filter-chip-remove"
                    onClick={() => setActiveTab("all")}
                    title="Reset queue tab"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                type="button"
                className="rm-clear-all-link"
                onClick={clearFilters}
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* ISSUE 4: ENHANCED ROOM INVENTORY LEDGER TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th className="th-customer">Room Identity</th>
                <th className="th-phone">Type & Amenities</th>
                <th className="th-address">Floor</th>
                <th className="th-identity">Tariff & GST</th>
                <th className="th-bank">Operational Status</th>
                <th className="th-action" style={{ width: "80px", minWidth: "80px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Loading hotel room inventory...
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No matching rooms found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => {
                  const status = String(room.status || "available").toLowerCase();
                  const price = Number(room.base_price ?? room.price_per_night ?? 0);
                  const gst = calculateRoomGst(price);
                  const roomAmenities = parseAmenitiesFromDescription(room.description);

                  return (
                    <tr
                      key={room.id}
                      className="dir-table-row"
                      onClick={() => openDetailsModal(room)}
                    >
                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            {String(room.room_number || "R").slice(0, 4)}
                          </div>
                          <div>
                            <span className="customer-name">Room {room.room_number}</span>
                            <div className="rm-room-subtext">
                              <span className="rm-room-subpill">
                                <BedDouble size={11} /> {room.bed_type || "King Bed"}
                              </span>
                              <span className="rm-room-subpill">
                                <Users size={11} /> {room.max_occupancy || 2} Max
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="th-phone">
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span className="mono-pill" title="Room Type">
                            {room.room_type || "Standard Room"}
                          </span>
                          <span className="text-muted" style={{ fontSize: "11px" }}>
                            {roomAmenities.length > 0
                              ? `${roomAmenities.length} Amenities (${roomAmenities.slice(0, 2).map((a) => a.split('/')[0].split('(')[0].trim()).join(', ')}${roomAmenities.length > 2 ? '...' : ''})`
                              : "Standard amenities"}
                          </span>
                        </div>
                      </td>

                      <td className="th-address">
                        <span className="rm-floor-tag">
                          <Building2 size={12} />
                          Floor {room.floor || inferFloorFromRoomNumber(room.room_number) || "1"}
                        </span>
                      </td>

                      <td className="th-identity">
                        <div className="rm-tariff-box">
                          <span className="rm-base-rate">₹{price.toFixed(2)}</span>
                          <span className="rm-gst-sub text-muted">
                            {gst.rate > 0 ? `+${gst.rate}% GST (₹${gst.taxAmount.toFixed(0)})` : "GST Exempt"}
                          </span>
                          <span className="rm-total-tariff">
                            ₹{gst.total.toFixed(2)} / nt
                          </span>
                        </div>
                      </td>

                      <td className="th-bank" onClick={(e) => e.stopPropagation()}>
                        <div className="rm-status-cell">
                          <span className={`rm-status-pill rm-status-${status}`}>
                            <span className="rm-status-dot"></span>
                            {status.toUpperCase()}
                          </span>
                          <select
                            className="rm-quick-status-dropdown"
                            value={status}
                            disabled={updatingStatusId === room.id}
                            onChange={(e) => handleQuickStatusChange(room.id, e.target.value)}
                            title="Quick change operational status"
                          >
                            {roomStatuses.map((st) => (
                              <option key={st} value={st}>
                                {st.replace("-", " ").toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td
                        className="th-action"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="rm-row-action-group">
                          <button
                            type="button"
                            className="rm-action-btn"
                            onClick={() => openDetailsModal(room)}
                            title="View / Edit Room Specifications"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="rm-action-btn delete"
                            onClick={(e) => openDeleteForRoom(room, e)}
                            title="Delete Room (Admin Password Protected)"
                          >
                            <Trash2 size={14} />
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
      </section>

      {/* ROOM DETAILS & EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content rm-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {!editingRoom
                    ? "Register New Room"
                    : isEditing
                      ? `Edit Room ${editingRoom.room_number}`
                      : `Room ${editingRoom.room_number} Overview`}
                </h2>
                <p className="modal-kicker">
                  {!editingRoom
                    ? "Configure specifications, floor location, bedding & nightly tariff"
                    : !isEditing
                      ? "Read-Only Overview • Click 'Edit Details' below to update configuration"
                      : "Update room parameters, tariff tiers, and amenities"}
                </p>
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

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ gap: "16px" }}>
                {/* SECTION 1: IDENTITY & LOCATION */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <BedDouble size={14} /> 1. Room Identity & Floor Location
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Room Number *</label>
                      <input
                        type="text"
                        name="room_number"
                        value={formData.room_number}
                        onChange={handleInputChange}
                        placeholder="e.g. 101, 204, 305"
                        disabled={!isEditing || saving}
                        className={!isEditing ? "input-locked" : ""}
                        required
                      />
                      <span className="text-muted" style={{ fontSize: "11px", marginTop: "2px" }}>
                        Auto-detects floor level from room number digits
                      </span>
                    </div>

                    <div className="form-group">
                      <label>Floor / Level *</label>
                      <input
                        type="text"
                        name="floor"
                        value={formData.floor}
                        onChange={handleInputChange}
                        placeholder="e.g. 1, 2, 3, Ground, Mezzanine"
                        disabled={!isEditing || saving}
                        className={!isEditing ? "input-locked" : ""}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: CLASSIFICATION & BEDDING */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Key size={14} /> 2. Classification, Bedding & Capacity
                  </div>

                  <div className="form-group">
                    <label>Room Category / Type *</label>
                    <input
                      type="text"
                      name="room_type"
                      value={formData.room_type}
                      onChange={handleInputChange}
                      placeholder="e.g. Deluxe Room"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />

                    {isEditing && (
                      <div className="rm-type-chips">
                        {roomTypePresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className={`rm-type-chip ${formData.room_type === preset ? "active" : ""}`}
                            onClick={() => setFormData((prev) => ({ ...prev, room_type: preset }))}
                            disabled={saving}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Bed Configuration *</label>
                      <select
                        name="bed_type"
                        value={formData.bed_type}
                        onChange={handleInputChange}
                        disabled={!isEditing || saving}
                        className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                        required
                      >
                        {bedTypeOptions.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Max Guest Occupancy *</label>
                      <div className="rm-occupancy-row">
                        <select
                          name="max_occupancy"
                          value={formData.max_occupancy}
                          onChange={handleInputChange}
                          disabled={!isEditing || saving}
                          className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                          style={{ flex: 1 }}
                          required
                        >
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <option key={num} value={num}>
                              {num} {num === 1 ? "Guest (Single)" : num === 2 ? "Guests (Standard Double)" : "Guests"}
                            </option>
                          ))}
                        </select>
                        {isEditing && (
                          <div style={{ display: "flex", gap: "4px" }}>
                            {[1, 2, 3, 4].map((num) => (
                              <button
                                key={num}
                                type="button"
                                className={`rm-occ-chip ${Number(formData.max_occupancy) === num ? "active" : ""}`}
                                onClick={() => setFormData((prev) => ({ ...prev, max_occupancy: num }))}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: PRICING & GST SLAB PREVIEW */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Briefcase size={14} /> 3. Base Tariff & GST Tier Preview
                  </div>

                  <div className="form-group">
                    <label>Base Tariff / Night (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="price_per_night"
                      value={formData.price_per_night}
                      onChange={handleInputChange}
                      placeholder="e.g. 2500"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>

                  {/* Live GST Tier Calculation Strip */}
                  {formData.price_per_night !== "" && Number(formData.price_per_night) > 0 && (
                    <div className="rm-gst-preview-box">
                      <div className="rm-gst-stat">
                        <span>Base Tariff</span>
                        <strong>₹{Number(formData.price_per_night).toFixed(2)}</strong>
                      </div>
                      <div className="rm-gst-stat">
                        <span>Statutory GST Bracket</span>
                        <strong style={{ color: gstPreview.rate === 0 ? "#059669" : gstPreview.rate === 12 ? "#2563eb" : "#7c3aed" }}>
                          {gstPreview.slabLabel}
                        </strong>
                      </div>
                      <div className="rm-gst-stat">
                        <span>Tax Amount</span>
                        <strong style={{ color: "#d97706" }}>₹{gstPreview.taxAmount.toFixed(2)}</strong>
                      </div>
                      <div className="rm-gst-stat">
                        <span>Estimated Guest Total</span>
                        <strong style={{ color: "#059669", fontSize: "13.5px" }}>
                          ₹{gstPreview.total.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 4: FACILITIES & AMENITIES */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Sparkles size={14} /> 4. Facilities & Room Amenities
                  </div>

                  <div className="rm-amenities-grid">
                    {standardAmenities.map((amenity) => {
                      const isSelected = formData.amenities?.includes(amenity);
                      return (
                        <div
                          key={amenity}
                          className={`rm-amenity-chip ${isSelected ? "active" : ""}`}
                          onClick={() => handleToggleAmenity(amenity)}
                          style={{ cursor: !isEditing ? "default" : "pointer" }}
                        >
                          <div className="rm-amenity-checkbox">
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <span>{amenity}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="form-group" style={{ marginTop: "6px" }}>
                    <label>Additional Notes / View / Features</label>
                    <textarea
                      name="notes"
                      rows="2"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="e.g. Garden facing, high floor, extra pillow set on request"
                      disabled={!isEditing || saving}
                      className={`asr-modal-textarea ${!isEditing ? "input-locked" : ""}`}
                    />
                  </div>
                </div>

                {/* SECTION 5: OPERATIONAL STATUS (EDIT MODE) */}
                {editingRoom && (
                  <div className="rm-form-section">
                    <div className="rm-section-title">
                      <CheckCircle2 size={14} /> 5. Operational Status
                    </div>
                    <div className="form-group">
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        disabled={!isEditing || saving}
                        className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                        required
                      >
                        {roomStatuses.map((st) => (
                          <option key={st} value={st}>
                            {st.replace("-", " ").toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="info-box-note">
                  <Briefcase size={15} color="#2d5696" style={{ flexShrink: 0 }} />
                  <span>
                    New rooms initialize with an 'Available' status. Front Desk check-ins and Housekeeping tasks update status real-time across the PMS.
                  </span>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                {editingRoom ? (
                  <>
                    <div className="footer-left">
                      <button
                        type="button"
                        className="btn-danger-outline"
                        onClick={(e) => {
                          e.preventDefault();
                          openDeleteConfirmation();
                        }}
                        disabled={saving}
                      >
                        <Trash2 size={14} /> Delete Room
                      </button>
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
                  <div className="footer-right" style={{ width: "100%", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={closeModal}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={saving}>
                      <Save size={14} /> {saving ? "Saving..." : "Register Room"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN PASSWORD DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="modal-overlay nested-modal" onClick={closeDeleteConfirmation}>
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

            <form onSubmit={handleConfirmDelete}>
              <div className="modal-body" style={{ gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
                  Are you sure you want to permanently delete room{" "}
                  <strong>{editingRoom?.room_number}</strong>? Active guest reservations mapped to this room may be affected.
                </p>

                <div className="form-group" style={{ marginTop: "6px" }}>
                  <label style={{ fontSize: "12px", color: "#0f172a" }}>
                    Enter Admin Password to proceed *
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
                  <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RAPID BATCH ROOM GENERATOR MODAL (Issue 3) */}
      {isBatchModalOpen && (
        <div className="modal-overlay" onClick={closeBatchModal}>
          <div
            className="modal-content rm-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "720px" }}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="portal-header-icon-box" style={{ width: "36px", height: "36px" }}>
                  <Layers size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: "700" }}>
                    Rapid Batch Room Generator
                  </h2>
                  <p className="modal-kicker">
                    Generate an entire floor, wing, or sequence of rooms in one click with automatic duplicate skipping
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeBatchModal}
                disabled={batchSaving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBatchSubmit}>
              <div className="modal-body" style={{ gap: "16px" }}>
                {/* SECTION 1: SEQUENCE & FLOOR */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Building2 size={14} /> 1. Floor & Room Number Sequence
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Floor / Level *</label>
                      <input
                        type="text"
                        name="floor"
                        value={batchFormData.floor}
                        onChange={(e) => {
                          const fl = e.target.value;
                          setBatchFormData((prev) => {
                            const cleanFl = fl.replace(/\D/g, "");
                            let newStart = prev.start_num;
                            let newEnd = prev.end_num;
                            if (cleanFl && (!prev.floor || prev.floor !== fl)) {
                              newStart = `${cleanFl}01`;
                              newEnd = `${cleanFl}10`;
                            }
                            return { ...prev, floor: fl, start_num: newStart, end_num: newEnd };
                          });
                        }}
                        placeholder="e.g. 2, Ground, Mezzanine"
                        disabled={batchSaving}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Optional Room Prefix</label>
                      <input
                        type="text"
                        name="prefix"
                        value={batchFormData.prefix}
                        onChange={(e) => setBatchFormData((prev) => ({ ...prev, prefix: e.target.value }))}
                        placeholder="e.g. A-, W-, or leave blank"
                        disabled={batchSaving}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Starting Room Number *</label>
                      <input
                        type="number"
                        min="1"
                        max="99999"
                        value={batchFormData.start_num}
                        onChange={(e) => setBatchFormData((prev) => ({ ...prev, start_num: e.target.value }))}
                        placeholder="e.g. 201"
                        disabled={batchSaving}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Ending Room Number *</label>
                      <input
                        type="number"
                        min="1"
                        max="99999"
                        value={batchFormData.end_num}
                        onChange={(e) => setBatchFormData((prev) => ({ ...prev, end_num: e.target.value }))}
                        placeholder="e.g. 210"
                        disabled={batchSaving}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: SPECIFICATIONS */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Key size={14} /> 2. Classification & Bed Configuration
                  </div>

                  <div className="form-group">
                    <label>Room Category / Type *</label>
                    <input
                      type="text"
                      value={batchFormData.room_type}
                      onChange={(e) => setBatchFormData((prev) => ({ ...prev, room_type: e.target.value }))}
                      placeholder="e.g. Deluxe Room"
                      disabled={batchSaving}
                      required
                    />
                    <div className="rm-type-chips">
                      {roomTypePresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`rm-type-chip ${batchFormData.room_type === preset ? "active" : ""}`}
                          onClick={() => setBatchFormData((prev) => ({ ...prev, room_type: preset }))}
                          disabled={batchSaving}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Bed Configuration *</label>
                      <select
                        value={batchFormData.bed_type}
                        onChange={(e) => setBatchFormData((prev) => ({ ...prev, bed_type: e.target.value }))}
                        disabled={batchSaving}
                        className="dir-select-field"
                        required
                      >
                        {bedTypeOptions.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Max Guest Occupancy *</label>
                      <div className="rm-occupancy-row">
                        <select
                          value={batchFormData.max_occupancy}
                          onChange={(e) => setBatchFormData((prev) => ({ ...prev, max_occupancy: Number(e.target.value) }))}
                          disabled={batchSaving}
                          className="dir-select-field"
                          style={{ flex: 1 }}
                          required
                        >
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <option key={num} value={num}>
                              {num} {num === 1 ? "Guest (Single)" : num === 2 ? "Guests (Double)" : "Guests"}
                            </option>
                          ))}
                        </select>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {[1, 2, 3, 4].map((num) => (
                            <button
                              key={num}
                              type="button"
                              className={`rm-occ-chip ${Number(batchFormData.max_occupancy) === num ? "active" : ""}`}
                              onClick={() => setBatchFormData((prev) => ({ ...prev, max_occupancy: num }))}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: TARIFF & GST PREVIEW */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Briefcase size={14} /> 3. Nightly Tariff & Statutory GST Slab
                  </div>

                  <div className="form-group">
                    <label>Base Tariff / Night (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={batchFormData.price_per_night}
                      onChange={(e) => setBatchFormData((prev) => ({ ...prev, price_per_night: e.target.value }))}
                      placeholder="e.g. 2500"
                      disabled={batchSaving}
                      required
                    />
                  </div>

                  {batchFormData.price_per_night !== "" && Number(batchFormData.price_per_night) > 0 && (
                    <div className="rm-gst-preview-box">
                      <div className="rm-gst-stat">
                        <span>Base Tariff</span>
                        <strong>₹{Number(batchFormData.price_per_night).toFixed(2)}</strong>
                      </div>
                      <div className="rm-gst-stat">
                        <span>Statutory GST Bracket</span>
                        <strong style={{ color: batchGstPreview.rate === 0 ? "#059669" : batchGstPreview.rate === 12 ? "#2563eb" : "#7c3aed" }}>
                          {batchGstPreview.slabLabel}
                        </strong>
                      </div>
                      <div className="rm-gst-stat">
                        <span>Tax Amount</span>
                        <strong style={{ color: "#d97706" }}>₹{batchGstPreview.taxAmount.toFixed(2)}</strong>
                      </div>
                      <div className="rm-gst-stat">
                        <span>Estimated Guest Total</span>
                        <strong style={{ color: "#059669", fontSize: "13.5px" }}>
                          ₹{batchGstPreview.total.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 4: FACILITIES */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Sparkles size={14} /> 4. Standard Room Amenities
                  </div>

                  <div className="rm-amenities-grid">
                    {standardAmenities.map((amenity) => {
                      const isSelected = batchFormData.amenities?.includes(amenity);
                      return (
                        <div
                          key={amenity}
                          className={`rm-amenity-chip ${isSelected ? "active" : ""}`}
                          onClick={() => handleToggleBatchAmenity(amenity)}
                        >
                          <div className="rm-amenity-checkbox">
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <span>{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 5: LIVE GENERATION PREVIEW & COLLISION AVOIDANCE */}
                <div className="rm-form-section">
                  <div className="rm-section-title">
                    <Layers size={14} /> 5. Generation Sequence & Duplicate Detection
                  </div>

                  {batchPreview.error ? (
                    <div style={{ color: "#dc2626", fontSize: "12px", fontWeight: "600" }}>
                      {batchPreview.error}
                    </div>
                  ) : (
                    <>
                      <div className={`rm-batch-summary-strip ${batchPreview.skippedCount > 0 ? "has-skips" : ""}`}>
                        <span>
                          <strong>{batchPreview.toCreateCount} New Rooms</strong> ready to register
                        </span>
                        {batchPreview.skippedCount > 0 && (
                          <span style={{ fontSize: "11.5px" }}>
                            ({batchPreview.skippedCount} existing rooms will be skipped)
                          </span>
                        )}
                      </div>

                      <div className="rm-batch-preview-container">
                        <div className="rm-batch-pills">
                          {batchPreview.list.map((item) => (
                            <span
                              key={item.room_number}
                              className={`rm-batch-pill ${item.exists ? "exists" : "available"}`}
                              title={item.exists ? `Room ${item.room_number} already exists - will skip` : `Room ${item.room_number} will be created`}
                            >
                              Room {item.room_number}
                              {item.exists ? " (Exists - Skip)" : " ✓"}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeBatchModal}
                  disabled={batchSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={batchSaving || batchPreview.toCreateCount === 0 || Boolean(batchPreview.error)}
                >
                  <Layers size={14} /> {batchSaving ? "Generating..." : `Generate ${batchPreview.toCreateCount} Rooms`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}