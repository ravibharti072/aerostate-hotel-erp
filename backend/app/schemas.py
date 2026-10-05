from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr


# =============================================================
# HOTEL SCHEMAS
# =============================================================

class HotelBase(BaseModel):
    name: str
    owner_name: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    tax_number: Optional[str] = None
    go_live_date: Optional[datetime] = None

    default_checkin_time: Optional[str] = "11:00"
    default_checkout_time: Optional[str] = "11:00"
    checkout_grace_minutes: Optional[int] = 60
    require_full_payment_before_checkout: Optional[bool] = False


class HotelCreate(HotelBase):
    pass


class HotelUpdate(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    tax_number: Optional[str] = None
    go_live_date: Optional[datetime] = None
    default_checkin_time: Optional[str] = None
    default_checkout_time: Optional[str] = None
    checkout_grace_minutes: Optional[int] = None
    require_full_payment_before_checkout: Optional[bool] = None


class HotelResponse(HotelBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoLiveUpdate(BaseModel):
    go_live_date: str


# =============================================================
# ROOM SCHEMAS
# =============================================================

class RoomBase(BaseModel):
    hotel_id: int
    room_number: str
    floor: Optional[str] = None
    room_type: str
    bed_type: Optional[str] = None
    max_occupancy: int = 2
    base_price: float
    status: str = "available"
    description: Optional[str] = None
    assigned_staff_id: Optional[int] = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    floor: Optional[str] = None
    room_type: Optional[str] = None
    bed_type: Optional[str] = None
    max_occupancy: Optional[int] = None
    base_price: Optional[float] = None
    status: Optional[str] = None
    description: Optional[str] = None
    assigned_staff_id: Optional[int] = None


class RoomResponse(RoomBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomStatusUpdate(BaseModel):
    status: str


class RoomBatchCreate(BaseModel):
    hotel_id: int
    rooms: List[RoomCreate]


class RoomBatchResponse(BaseModel):
    created_count: int
    skipped_count: int
    created_rooms: List[RoomResponse]
    skipped_room_numbers: List[str]


# =============================================================
# GUEST & CO-GUEST SCHEMAS
# =============================================================

class GuestBase(BaseModel):
    hotel_id: int
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None

    # Statutory Form C (FRRO) fields
    passport_expiry: Optional[str] = None
    visa_number: Optional[str] = None
    visa_type: Optional[str] = None
    visa_expiry: Optional[str] = None
    port_of_entry: Optional[str] = None
    date_of_arrival: Optional[str] = None
    next_destination: Optional[str] = None

    # Operational VIP, Blacklist, Preferences & Corporate Affiliation
    vip_status: Optional[str] = "regular"
    is_blacklisted: Optional[bool] = False
    blacklist_reason: Optional[str] = None
    preferences: Optional[str] = None
    company_name: Optional[str] = None
    gstin: Optional[str] = None


class GuestCreate(GuestBase):
    pass


class GuestUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None

    # Statutory Form C (FRRO) fields
    passport_expiry: Optional[str] = None
    visa_number: Optional[str] = None
    visa_type: Optional[str] = None
    visa_expiry: Optional[str] = None
    port_of_entry: Optional[str] = None
    date_of_arrival: Optional[str] = None
    next_destination: Optional[str] = None

    # Operational VIP, Blacklist, Preferences & Corporate Affiliation
    vip_status: Optional[str] = None
    is_blacklisted: Optional[bool] = None
    blacklist_reason: Optional[str] = None
    preferences: Optional[str] = None
    company_name: Optional[str] = None
    gstin: Optional[str] = None


class GuestResponse(GuestBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CoGuestCreate(BaseModel):
    full_name: str
    gender: Optional[str] = "male"
    age: Optional[int] = None
    id_type: Optional[str] = "Government ID"
    id_number: Optional[str] = None


class CoGuestResponse(CoGuestCreate):
    id: int
    booking_id: int
    hotel_id: int

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# BOOKING SCHEMAS
# =============================================================

class ExtraServiceItem(BaseModel):
    name: str
    amount: float


class BookingBase(BaseModel):
    hotel_id: int
    guest_id: int
    room_id: int
    reservation_code: Optional[str] = None

    rooms_count: int = 1
    assigned_room_ids: Optional[List[int]] = []

    guest_type: str = "individual"
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    corporate_notes: Optional[str] = None

    checkin_date: datetime
    checkout_date: datetime

    nights_count: int = 1
    days_count: int = 2
    stay_label: Optional[str] = "2 Days / 1 Night"
    is_late_checkout: bool = False

    adults: int = 1
    children: int = 0

    booking_source: str = "walk-in"
    status: str = "confirmed"

    room_rate: float
    discount: float = 0.0
    tax: float = 0.0
    total_amount: float
    advance_paid: float = 0.0
    payment_method: str = "cash"
    payment_status: str = "pending"


class BookingCreate(BookingBase):
    nights_count: Optional[int] = 1
    days_count: Optional[int] = 2
    stay_label: Optional[str] = "2 Days / 1 Night"
    is_late_checkout: Optional[bool] = False
    extra_services: Optional[List[ExtraServiceItem]] = []


class WalkInBookingCreate(BaseModel):
    hotel_id: int
    room_id: int
    reservation_code: Optional[str] = None
    rooms_count: Optional[int] = 1
    assigned_room_ids: Optional[List[int]] = []

    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    id_proof_type: Optional[str] = None
    id_proof_number: Optional[str] = None

    guest_type: Optional[str] = "individual"
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    corporate_notes: Optional[str] = None
    booking_source: Optional[str] = "walk-in"
    nationality: Optional[str] = "Indian"

    checkin_date: datetime
    checkout_date: datetime

    nights_count: Optional[int] = 1
    days_count: Optional[int] = 2
    stay_label: Optional[str] = "2 Days / 1 Night"
    is_late_checkout: Optional[bool] = False

    adults: int = 1
    children: int = 0
    room_rate: float = 0.0
    total_amount: float = 0.0
    advance_paid: float = 0.0
    payment_status: str = "paid"
    payment_method: str = "cash"

    co_guests: Optional[List[CoGuestCreate]] = []
    extra_services: Optional[List[ExtraServiceItem]] = []


class BookingCheckInRequest(BaseModel):
    primary_id_type: Optional[str] = None
    primary_id_number: Optional[str] = None
    nationality: Optional[str] = None
    corporate_notes: Optional[str] = None
    actual_checkin_time: Optional[datetime] = None
    checkin_date: Optional[datetime] = None
    checkout_date: Optional[datetime] = None
    co_guests: Optional[List[CoGuestCreate]] = []
    collect_payment: Optional[float] = 0.0
    payment_method: Optional[str] = "cash"
    transaction_id: Optional[str] = None


class BookingUpdate(BaseModel):
    hotel_id: Optional[int] = None
    guest_id: Optional[int] = None
    room_id: Optional[int] = None
    reservation_code: Optional[str] = None
    rooms_count: Optional[int] = None
    assigned_room_ids: Optional[List[int]] = None

    guest_type: Optional[str] = None
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    corporate_notes: Optional[str] = None

    checkin_date: Optional[datetime] = None
    checkout_date: Optional[datetime] = None

    nights_count: Optional[int] = None
    days_count: Optional[int] = None
    stay_label: Optional[str] = None
    is_late_checkout: Optional[bool] = None

    adults: Optional[int] = None
    children: Optional[int] = None
    booking_source: Optional[str] = None
    status: Optional[str] = None

    room_rate: Optional[float] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    total_amount: Optional[float] = None
    advance_paid: Optional[float] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None

    extra_services: Optional[List[ExtraServiceItem]] = None


class BookingResponse(BookingBase):
    id: int
    created_at: datetime
    extra_services: Optional[List[ExtraServiceItem]] = []
    co_guests: Optional[List[CoGuestResponse]] = []

    model_config = ConfigDict(from_attributes=True)


class StayPreviewResponse(BaseModel):
    nights_count: int
    days_count: int
    stay_label: str
    is_late_checkout: bool


class InHouseGuestResponse(BaseModel):
    booking_id: int
    guest_id: int
    guest_name: str
    guest_phone: Optional[str] = None
    room_id: int
    room_number: str
    room_type: Optional[str] = None
    reservation_code: Optional[str] = None
    checkin_date: datetime
    checkout_date: datetime
    status: str
    hotel_id: int
    folio_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# FOLIO & CHARGES SCHEMAS
# =============================================================

class FolioChargeBase(BaseModel):
    department: str
    description: str
    sac_code: Optional[str] = None
    quantity: float = 1.0
    rate: float = 0.0
    discount: float = 0.0
    taxable_amount: float = 0.0
    tax_rate: float = 0.0
    tax_type: str = "GST"
    tax_amount: float = 0.0
    total_amount: float = 0.0
    charge_date: Optional[datetime] = None
    status: str = "posted"


class FolioChargeCreate(FolioChargeBase):
    hotel_id: int
    folio_id: int
    guest_id: int
    booking_id: int
    room_id: Optional[int] = None
    created_by: Optional[str] = None


class FolioChargeResponse(FolioChargeBase):
    id: int
    hotel_id: int
    folio_id: int
    guest_id: int
    booking_id: int
    room_id: Optional[int] = None
    created_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FolioBase(BaseModel):
    hotel_id: int
    guest_id: int
    booking_id: int
    folio_number: Optional[str] = None
    status: str = "open"
    opened_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None


class FolioCreate(FolioBase):
    pass


class FolioResponse(FolioBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FolioSummaryResponse(BaseModel):
    booking_id: int
    reservation_code: Optional[str] = None
    room_charges: float
    base_room_charges: float
    extra_nights: int = 0
    extra_room_charges: float = 0.0
    restaurant_charges: float = 0.0
    restaurant_orders_count: int = 0
    minibar_charges: float = 0.0
    laundry_charges: float = 0.0
    extra_charges: float = 0.0
    grand_total: float
    advance_paid: float
    due_amount: float
    refund_due: float = 0.0
    payment_status: str

    model_config = ConfigDict(from_attributes=True)


class InvoicePaymentAllocationResponse(BaseModel):
    id: int
    invoice_id: int
    payment_id: int
    allocated_amount: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# INVOICE SCHEMAS
# =============================================================

class InvoiceCreate(BaseModel):
    hotel_id: int
    guest_id: int
    booking_id: int
    folio_id: Optional[int] = None

    room_charges: float = 0
    restaurant_charges: float = 0
    laundry_charges: float = 0
    minibar_charges: float = 0
    extra_charges: float = 0

    discount: float = 0
    tax_amount: float = 0
    taxable_value: Optional[float] = 0.0
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0


class InvoiceVoidRequest(BaseModel):
    reason: str


class InvoiceResponse(BaseModel):
    id: int
    hotel_id: int
    guest_id: int
    booking_id: int
    folio_id: Optional[int] = None
    invoice_number: str
    reservation_code: Optional[str] = None

    room_charges: float
    restaurant_charges: float
    laundry_charges: float
    minibar_charges: float
    extra_charges: float

    discount: float
    tax_amount: float
    taxable_value: Optional[float] = 0.0
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0

    grand_total: float
    paid_amount: float
    due_amount: float
    refund_amount: Optional[float] = 0.0
    refund_due: Optional[float] = 0.0

    invoice_status: Optional[str] = "issued"
    payment_status: str
    cancellation_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None
    created_at: datetime

    guest: Optional[GuestResponse] = None
    payments: Optional[List[PaymentResponse]] = []

    model_config = ConfigDict(from_attributes=True)


class BookingInvoiceCreate(BaseModel):
    laundry_charges: float = 0
    minibar_charges: float = 0
    extra_charges: float = 0
    discount: float = 0
    tax_amount: float = 0
    include_restaurant_bill_to_room: bool = True


# =============================================================
# PAYMENT & REFUND SCHEMAS
# =============================================================

class PaymentCreate(BaseModel):
    invoice_id: Optional[int] = None
    booking_id: Optional[int] = None
    folio_id: Optional[int] = None
    payment_type: Optional[str] = "settlement"
    amount: float
    payment_method: str
    transaction_id: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    hotel_id: int
    guest_id: int
    invoice_id: Optional[int] = None
    booking_id: Optional[int] = None
    folio_id: Optional[int] = None
    payment_type: Optional[str] = "settlement"
    receipt_number: Optional[str] = None
    amount: float
    payment_method: str
    transaction_id: Optional[str] = None
    payment_status: str
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    customer_gstin: Optional[str] = None
    place_of_supply: Optional[str] = None
    is_reverse_charge: Optional[bool] = False
    tax_rate: Optional[float] = 0.0
    taxable_amount: Optional[float] = 0.0
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


InvoiceResponse.model_rebuild()


class AdvancePaymentCreate(BaseModel):
    booking_id: int
    amount: float
    payment_method: str = "cash"
    transaction_id: Optional[str] = None
    remarks: Optional[str] = "Advance booking deposit"
    customer_gstin: Optional[str] = None
    place_of_supply: Optional[str] = None
    tax_rate: Optional[float] = 0.0
    is_reverse_charge: Optional[bool] = False


class AdvanceReceiptVoucherResponse(BaseModel):
    receipt_number: str
    receipt_date: datetime
    hotel_name: str
    hotel_address: str
    hotel_phone: str
    hotel_email: str
    hotel_gstin: str

    guest_name: str
    guest_phone: str
    guest_email: Optional[str] = None
    customer_gstin: Optional[str] = None

    reservation_code: str
    booking_id: int
    folio_number: Optional[str] = None
    room_number: str
    stay_label: str

    advance_amount: float
    taxable_amount: float
    tax_rate: float
    cgst: float
    sgst: float
    igst: float
    payment_method: str
    transaction_id: Optional[str] = None
    place_of_supply: str
    is_reverse_charge: bool
    received_by: str
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RefundCreate(BaseModel):
    invoice_id: int
    amount: float
    payment_method: str = "cash"
    transaction_id: Optional[str] = None
    reason: Optional[str] = "Overpayment refund disbursement"


class RefundResponse(BaseModel):
    id: int
    hotel_id: int
    guest_id: int
    invoice_id: int
    booking_id: Optional[int] = None
    folio_id: Optional[int] = None
    amount: float
    payment_method: str
    transaction_id: Optional[str] = None
    payment_status: str
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# HOUSEKEEPING SCHEMAS
# =============================================================

class HousekeepingTaskBase(BaseModel):
    hotel_id: int
    room_id: int
    booking_id: Optional[int] = None
    assigned_staff_id: Optional[int] = None

    task_type: str = "checkout-cleaning"
    priority: str = "normal"
    status: str = "pending"

    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    checklist: Optional[Any] = None


class HousekeepingTaskCreate(HousekeepingTaskBase):
    pass


class HousekeepingTaskUpdate(BaseModel):
    room_id: Optional[int] = None
    booking_id: Optional[int] = None
    assigned_staff_id: Optional[int] = None

    task_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class HousekeepingTaskStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class HousekeepingTaskResponse(HousekeepingTaskBase):
    id: int
    started_at: Optional[datetime] = None
    started_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HousekeepingCompletePayload(BaseModel):
    notes: Optional[str] = None
    requires_inspection: bool = False
    checklist: Optional[Any] = None


class HousekeepingInspectionPayload(BaseModel):
    passed: bool
    checklist: Dict[str, bool] = {}
    notes: Optional[str] = None


class HousekeepingProblemReportPayload(BaseModel):
    room_id: int
    category: str
    description: str
    priority: str = "normal"
    blocks_room: bool = False


# -------------------------------------------------------------
# Checklist templates (HOD builds these, attendants tick them off)
# -------------------------------------------------------------

class ChecklistItemPayload(BaseModel):
    text: str
    required: bool = True


class ChecklistCreatePayload(BaseModel):
    name: str
    department: str = "housekeeping"
    description: Optional[str] = None
    items: List[ChecklistItemPayload] = []
    is_active: bool = True
    hotel_id: Optional[int] = None


class ChecklistUpdatePayload(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[ChecklistItemPayload]] = None
    is_active: Optional[bool] = None


class ChecklistItemResponse(BaseModel):
    text: str
    required: bool = True


class ChecklistResponse(BaseModel):
    id: int
    hotel_id: int
    name: str
    department: str
    description: Optional[str] = None
    items: List[ChecklistItemResponse] = []
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HousekeepingDashboardArrivalItem(BaseModel):
    room_number: str
    guest_name: str
    arrival_time: str
    room_status: str
    cleaning_status: str


class HousekeepingDashboardResponse(BaseModel):
    rooms_to_clean: int
    cleaning_in_progress: int
    ready_rooms: int
    inspection_required: int
    priority_tasks: int
    maintenance_issues: int
    upcoming_arrivals: List[HousekeepingDashboardArrivalItem] = []


# =============================================================
# INVENTORY MODULE SCHEMAS (PHASES 2 - 11 COMPLETE)
# =============================================================

class InventoryCategoryBase(BaseModel):
    hotel_id: int
    name: str
    description: Optional[str] = None
    is_active: bool = True


class InventoryCategoryCreate(InventoryCategoryBase):
    pass


class InventoryCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class InventoryCategoryResponse(InventoryCategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryUnitBase(BaseModel):
    hotel_id: int
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True


class InventoryUnitCreate(InventoryUnitBase):
    pass


class InventoryUnitUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class InventoryUnitResponse(InventoryUnitBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryStoreBase(BaseModel):
    hotel_id: int
    store_code: str
    store_name: str
    location: Optional[str] = None
    is_main_store: bool = False
    is_active: bool = True


class InventoryStoreCreate(InventoryStoreBase):
    pass


class InventoryStoreUpdate(BaseModel):
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    location: Optional[str] = None
    is_main_store: Optional[bool] = None
    is_active: Optional[bool] = None


class InventoryStoreResponse(InventoryStoreBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LocationStockResponse(BaseModel):
    id: int
    hotel_id: int
    item_id: int
    store_id: int
    store_code: str
    store_name: str
    current_stock: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemBase(BaseModel):
    hotel_id: Optional[int] = None
    name: str
    sku: str

    category: Optional[str] = None
    unit: str = "Piece"

    category_id: Optional[int] = None
    unit_id: Optional[int] = None
    supplier_id: Optional[int] = None

    current_stock: float = 0.0
    min_stock_level: float = 0.0
    reorder_level: float = 0.0
    max_stock_level: Optional[float] = None
    opening_stock: float = 0.0

    purchase_price: float = 0.0
    average_cost: float = 0.0
    last_purchase_cost: float = 0.0
    tax_rate: float = 0.0

    purchase_unit: Optional[str] = None
    consumption_unit: Optional[str] = None
    conversion_factor: float = 1.0

    supplier_name: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    category_id: Optional[int] = None
    unit_id: Optional[int] = None
    supplier_id: Optional[int] = None

    min_stock_level: Optional[float] = None
    reorder_level: Optional[float] = None
    max_stock_level: Optional[float] = None
    purchase_price: Optional[float] = None
    average_cost: Optional[float] = None
    last_purchase_cost: Optional[float] = None
    tax_rate: Optional[float] = None

    purchase_unit: Optional[str] = None
    consumption_unit: Optional[str] = None
    conversion_factor: Optional[float] = None

    supplier_name: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class InventoryItemResponse(InventoryItemBase):
    id: int
    category_name: Optional[str] = None
    unit_name: Optional[str] = None
    unit_code: Optional[str] = None
    preferred_supplier_name: Optional[str] = None
    locations: List[LocationStockResponse] = []
    total_stock_value: float = 0.0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Goods Receipt Note (GRN) Schemas ---

class InventoryReceiptItemCreate(BaseModel):
    item_id: int
    quantity_received: float
    unit_cost: float
    tax_rate: float = 0.0
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None


class InventoryReceiptItemResponse(BaseModel):
    id: int
    receipt_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    quantity_received: float
    unit_cost: float
    tax_rate: float
    tax_amount: float
    total_cost: float
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryReceiptCreate(BaseModel):
    supplier_id: int
    store_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    receiving_date: Optional[datetime] = None
    notes: Optional[str] = None
    received_by: Optional[str] = None
    items: List[InventoryReceiptItemCreate]


class InventoryReceiptResponse(BaseModel):
    id: int
    hotel_id: int
    receipt_no: str
    supplier_id: int
    supplier_name: Optional[str] = None
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    purchase_order_id: Optional[int] = None
    po_number: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    receiving_date: datetime
    subtotal: float
    tax_amount: float
    total_amount: float
    status: str
    notes: Optional[str] = None
    received_by: Optional[str] = None
    items: List[InventoryReceiptItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryReceiptResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventoryReceiptResponse]


# --- Department Issue Schemas ---

class InventoryIssueItemCreate(BaseModel):
    item_id: int
    quantity_issued: float


class InventoryIssueItemResponse(BaseModel):
    id: int
    issue_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    quantity_issued: float
    unit_cost: float
    total_cost: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryIssueCreate(BaseModel):
    from_store_id: Optional[int] = None
    department: str
    requested_by: Optional[str] = None
    issued_by: Optional[str] = None
    issue_date: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[InventoryIssueItemCreate]


class InventoryIssueResponse(BaseModel):
    id: int
    hotel_id: int
    issue_no: str
    from_store_id: int
    from_store_code: Optional[str] = None
    from_store_name: Optional[str] = None
    department: str
    requested_by: Optional[str] = None
    issued_by: Optional[str] = None
    issue_date: datetime
    total_value: float
    status: str
    notes: Optional[str] = None
    items: List[InventoryIssueItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryIssueResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventoryIssueResponse]


# --- Department Consumption Schemas ---

class InventoryConsumptionCreate(BaseModel):
    store_id: Optional[int] = None
    item_id: int
    department: str
    quantity: float
    reason: Optional[str] = None
    reference: Optional[str] = None
    consumed_by: Optional[str] = None
    consumption_date: Optional[datetime] = None


class InventoryConsumptionResponse(BaseModel):
    id: int
    hotel_id: int
    consumption_no: str
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    department: str
    quantity: float
    unit_cost: float
    total_cost: float
    reason: Optional[str] = None
    reference: Optional[str] = None
    consumed_by: Optional[str] = None
    consumption_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryConsumptionResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventoryConsumptionResponse]


# --- Department Return Schemas ---

class InventoryReturnItemCreate(BaseModel):
    item_id: int
    quantity_returned: float


class InventoryReturnItemResponse(BaseModel):
    id: int
    return_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    quantity_returned: float
    unit_cost: float
    total_cost: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryReturnCreate(BaseModel):
    store_id: Optional[int] = None
    department: str
    returned_by: Optional[str] = None
    received_by: Optional[str] = None
    return_date: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    items: List[InventoryReturnItemCreate]


class InventoryReturnResponse(BaseModel):
    id: int
    hotel_id: int
    return_no: str
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    department: str
    returned_by: Optional[str] = None
    received_by: Optional[str] = None
    return_date: datetime
    total_value: float
    status: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    items: List[InventoryReturnItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryReturnResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventoryReturnResponse]


# --- Supplier Return Schemas ---

class InventorySupplierReturnItemCreate(BaseModel):
    item_id: int
    quantity_returned: float
    reason: Optional[str] = None


class InventorySupplierReturnItemResponse(BaseModel):
    id: int
    supplier_return_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    quantity_returned: float
    unit_cost: float
    total_cost: float
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventorySupplierReturnCreate(BaseModel):
    supplier_id: int
    store_id: Optional[int] = None
    receipt_id: Optional[int] = None
    return_date: Optional[datetime] = None
    reason: str
    notes: Optional[str] = None
    returned_by: Optional[str] = None
    items: List[InventorySupplierReturnItemCreate]


class InventorySupplierReturnResponse(BaseModel):
    id: int
    hotel_id: int
    supplier_return_no: str
    supplier_id: int
    supplier_name: Optional[str] = None
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    receipt_id: Optional[int] = None
    receipt_no: Optional[str] = None
    return_date: datetime
    total_amount: float
    status: str
    reason: str
    notes: Optional[str] = None
    returned_by: Optional[str] = None
    items: List[InventorySupplierReturnItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventorySupplierReturnResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventorySupplierReturnResponse]


# --- Inter-Store Transfer Schemas ---

class InventoryTransferItemCreate(BaseModel):
    item_id: int
    quantity_transferred: float


class InventoryTransferItemResponse(BaseModel):
    id: int
    transfer_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    quantity_transferred: float
    unit_cost: float
    total_cost: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryTransferCreate(BaseModel):
    from_store_id: int
    to_store_id: int
    transfer_date: Optional[datetime] = None
    notes: Optional[str] = None
    transferred_by: Optional[str] = None
    items: List[InventoryTransferItemCreate]


class InventoryTransferResponse(BaseModel):
    id: int
    hotel_id: int
    transfer_no: str
    from_store_id: int
    from_store_code: Optional[str] = None
    from_store_name: Optional[str] = None
    to_store_id: int
    to_store_code: Optional[str] = None
    to_store_name: Optional[str] = None
    transfer_date: datetime
    total_value: float
    status: str
    notes: Optional[str] = None
    transferred_by: Optional[str] = None
    items: List[InventoryTransferItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryTransferResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventoryTransferResponse]


# --- Stock Adjustment Schemas (Phase 8) ---

class InventoryAdjustmentCreate(BaseModel):
    store_id: Optional[int] = None
    item_id: int
    adjustment_type: Literal["increase", "decrease"]
    adjustment_quantity: float
    reason: str
    adjusted_by: Optional[str] = None
    adjustment_date: Optional[datetime] = None


class InventoryAdjustmentResponse(BaseModel):
    id: int
    hotel_id: int
    adjustment_no: str
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    adjustment_type: str
    old_quantity: float
    adjustment_quantity: float
    new_quantity: float
    unit_cost: float
    total_value: float
    reason: str
    adjusted_by: Optional[str] = None
    adjustment_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryAdjustmentResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventoryAdjustmentResponse]


# --- Wastage & Damage Schemas (Phase 8) ---

class InventoryWastageCreate(BaseModel):
    store_id: Optional[int] = None
    item_id: int
    waste_type: Literal["DAMAGE", "WASTAGE", "EXPIRY", "BREAKAGE", "SPOILAGE"]
    quantity: float
    department: Optional[str] = None
    reason: str
    reported_by: Optional[str] = None
    wastage_date: Optional[datetime] = None


class InventoryWastageResponse(BaseModel):
    id: int
    hotel_id: int
    wastage_no: str
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    waste_type: str
    quantity: float
    unit_cost: float
    total_cost: float
    department: Optional[str] = None
    reason: str
    reported_by: Optional[str] = None
    wastage_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedInventoryWastageResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[InventoryWastageResponse]


# --- Physical Stock Count Schemas (Phase 9) ---

class PhysicalStockCountItemCreate(BaseModel):
    item_id: int
    physical_stock: float
    notes: Optional[str] = None


class PhysicalStockCountItemResponse(BaseModel):
    id: int
    physical_stock_count_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    system_stock: float
    physical_stock: float
    variance: float
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PhysicalStockCountCreate(BaseModel):
    store_id: int
    count_date: Optional[datetime] = None
    counted_by: Optional[str] = None
    notes: Optional[str] = None
    items: List[PhysicalStockCountItemCreate]


class PhysicalStockCountUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[Literal["draft", "under_review", "finalized", "cancelled"]] = None
    items: Optional[List[PhysicalStockCountItemCreate]] = None


class PhysicalStockCountResponse(BaseModel):
    id: int
    hotel_id: int
    count_no: str
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    status: str
    count_date: datetime
    counted_by: Optional[str] = None
    approved_by: Optional[str] = None
    finalized_at: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[PhysicalStockCountItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedPhysicalStockCountResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[PhysicalStockCountResponse]


# --- Dashboard Analytics Schemas (Phase 10) ---

class DashboardKPIs(BaseModel):
    total_items: int
    total_stock_value: float
    low_stock_items: int
    out_of_stock_items: int
    today_stock_in: float
    today_stock_out: float
    today_consumption_value: float
    pending_reorders: int


class DashboardDepartmentConsumption(BaseModel):
    department: str
    total_quantity: float
    total_value: float


class DashboardCategoryValuation(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    item_count: int
    total_stock: float
    total_value: float


class DashboardTopConsumedItem(BaseModel):
    item_id: int
    item_name: str
    item_sku: str
    unit: str
    total_quantity: float
    total_cost: float


class DashboardLowStockAlert(BaseModel):
    item_id: int
    item_name: str
    item_sku: str
    current_stock: float
    min_stock_level: float
    reorder_level: float
    deficit: float
    unit: str
    preferred_supplier_name: Optional[str] = None


class InventoryDashboardSummaryResponse(BaseModel):
    kpis: DashboardKPIs
    department_consumption: List[DashboardDepartmentConsumption]
    category_valuations: List[DashboardCategoryValuation]
    top_consumed_items: List[DashboardTopConsumedItem]
    low_stock_alerts: List[DashboardLowStockAlert]
    recent_activity: List[Dict[str, Any]]


# --- Phase 11: Inventory Reports Schemas ---

class StockReportRow(BaseModel):
    item_id: int
    sku: str
    name: str
    category: str
    unit: str
    current_stock: float
    reorder_level: float
    average_cost: float
    total_value: float
    status: str


class StockReportSummary(BaseModel):
    total_items: int
    total_quantity: float
    total_value: float
    low_stock_count: int
    out_of_stock_count: int


class StockReportResponse(BaseModel):
    summary: StockReportSummary
    rows: List[StockReportRow]


class LowStockReportRow(BaseModel):
    item_id: int
    sku: str
    name: str
    category: str
    unit: str
    current_stock: float
    reorder_level: float
    min_stock_level: float
    reorder_deficit: float
    average_cost: float
    estimated_reorder_cost: float
    preferred_supplier: Optional[str] = None


class LowStockReportResponse(BaseModel):
    total_low_stock_items: int
    total_estimated_reorder_cost: float
    rows: List[LowStockReportRow]


class DepartmentConsumptionReportRow(BaseModel):
    department: str
    item_id: int
    sku: str
    name: str
    unit: str
    total_quantity: float
    average_cost: float
    total_cost: float


class DepartmentConsumptionReportResponse(BaseModel):
    total_cost: float
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    rows: List[DepartmentConsumptionReportRow]


class WastageReportRow(BaseModel):
    id: int
    wastage_no: str
    wastage_date: datetime
    waste_type: str
    item_id: int
    item_name: str
    item_sku: str
    store_name: str
    department: Optional[str] = None
    quantity: float
    unit_cost: float
    total_cost: float
    reason: str
    reported_by: Optional[str] = None


class WastageReportResponse(BaseModel):
    total_loss_value: float
    rows: List[WastageReportRow]


class ReconciliationReportRow(BaseModel):
    count_id: int
    count_no: str
    count_date: datetime
    store_name: str
    item_id: int
    item_name: str
    item_sku: str
    system_stock: float
    physical_stock: float
    variance: float
    unit_cost: float
    variance_value: float
    status: str


class ReconciliationReportResponse(BaseModel):
    total_variance_value: float
    rows: List[ReconciliationReportRow]


# --- Stock Movement & Ledger Schemas ---

class StockMovementRequest(BaseModel):
    item_id: int
    store_id: Optional[int] = None
    quantity: float
    unit_cost: Optional[float] = None
    movement_type: Literal[
        "OPENING",
        "PURCHASE_RECEIVE",
        "DEPT_ISSUE",
        "CONSUMPTION",
        "RETURN_TO_STORE",
        "SUPPLIER_RETURN",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "ADJUSTMENT_IN",
        "ADJUSTMENT_OUT",
        "DAMAGE",
        "WASTE",
        "EXPIRY",
        "PHYSICAL_COUNT_RECON",
    ]
    reference_no: Optional[str] = None
    department: Optional[str] = None
    supplier_id: Optional[int] = None
    notes: Optional[str] = None


class StockLedgerResponse(BaseModel):
    id: int
    hotel_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    store_id: int
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    movement_type: str
    reference_no: Optional[str] = None
    department: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    quantity_in: float
    quantity_out: float
    balance_after: float
    unit_cost: float
    total_value: float
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedStockLedgerResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[StockLedgerResponse]


class StockTransactionCreate(BaseModel):
    item_id: int
    transaction_type: str
    quantity: float
    store_id: Optional[int] = None
    reason: Optional[str] = None
    reference: Optional[str] = None
    created_by: Optional[str] = None


class StockTransactionResponse(BaseModel):
    id: int
    hotel_id: int
    item_id: int
    transaction_type: str
    quantity: float
    reason: Optional[str] = None
    reference: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# MAINTENANCE SCHEMAS
# -----------------------------

class MaintenanceRequestBase(BaseModel):
    hotel_id: int
    room_id: Optional[int] = None
    assigned_staff_id: Optional[int] = None
    asset_id: Optional[int] = None
    booking_id: Optional[int] = None

    issue_title: str
    issue_description: Optional[str] = None
    category: Optional[str] = "General"
    source: Optional[str] = "Direct"
    blocks_room: Optional[bool] = False
    priority: str = "medium"

    status: str = "open"

    reported_by: Optional[str] = None
    assigned_by: Optional[str] = None

    estimated_cost: float = 0
    actual_cost: float = 0

    start_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None

    remarks: Optional[str] = None


class MaintenanceRequestCreate(MaintenanceRequestBase):
    pass


class MaintenanceRequestUpdate(BaseModel):
    room_id: Optional[int] = None
    assigned_staff_id: Optional[int] = None
    asset_id: Optional[int] = None
    booking_id: Optional[int] = None

    issue_title: Optional[str] = None
    issue_description: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    blocks_room: Optional[bool] = None
    priority: Optional[str] = None

    status: Optional[str] = None

    reported_by: Optional[str] = None
    assigned_by: Optional[str] = None

    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None

    start_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None

    remarks: Optional[str] = None


class MaintenanceRequestResponse(MaintenanceRequestBase):
    id: int
    room_number: Optional[str] = None
    guest_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# MAINTENANCE ASSETS & EQUIPMENT SCHEMAS
# =============================================================

class MaintenanceAssetBase(BaseModel):
    hotel_id: Optional[int] = None
    room_id: Optional[int] = None
    asset_code: Optional[str] = None
    name: str
    category: str
    location: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    installation_date: Optional[datetime] = None
    warranty_expiry_date: Optional[datetime] = None
    status: str = "operational"
    notes: Optional[str] = None


class MaintenanceAssetCreate(MaintenanceAssetBase):
    pass


class MaintenanceAssetUpdate(BaseModel):
    room_id: Optional[int] = None
    asset_code: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    installation_date: Optional[datetime] = None
    warranty_expiry_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceAssetResponse(MaintenanceAssetBase):
    id: int
    asset_code: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# MAINTENANCE WORK ORDERS & PART USAGE SCHEMAS
# =============================================================

class MaintenancePartUsageBase(BaseModel):
    hotel_id: Optional[int] = None
    inventory_item_id: int
    quantity_used: float
    unit_cost: Optional[float] = 0.0
    total_cost: Optional[float] = 0.0
    notes: Optional[str] = None


class MaintenancePartUsageCreate(BaseModel):
    hotel_id: Optional[int] = None
    inventory_item_id: int
    quantity_used: float
    unit_cost: Optional[float] = None
    notes: Optional[str] = None


class MaintenancePartUsageResponse(MaintenancePartUsageBase):
    id: int
    work_order_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaintenanceWorkOrderBase(BaseModel):
    hotel_id: Optional[int] = None
    maintenance_request_id: int
    room_id: Optional[int] = None
    asset_id: Optional[int] = None
    technician_staff_id: Optional[int] = None

    status: str = "assigned"
    priority: str = "normal"

    diagnosis: Optional[str] = None
    work_performed: Optional[str] = None
    labor_hours: float = 0.0
    labor_cost: float = 0.0
    parts_cost: float = 0.0
    total_cost: float = 0.0

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceWorkOrderCreate(MaintenanceWorkOrderBase):
    work_order_number: Optional[str] = None


class MaintenanceWorkOrderUpdate(BaseModel):
    room_id: Optional[int] = None
    asset_id: Optional[int] = None
    technician_staff_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    diagnosis: Optional[str] = None
    work_performed: Optional[str] = None
    labor_hours: Optional[float] = None
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    total_cost: Optional[float] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceWorkOrderResponse(MaintenanceWorkOrderBase):
    id: int
    work_order_number: str
    created_at: datetime
    updated_at: datetime
    parts_used: List[MaintenancePartUsageResponse] = []

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# PREVENTIVE MAINTENANCE PLANS SCHEMAS
# =============================================================

class PreventiveMaintenancePlanBase(BaseModel):
    hotel_id: Optional[int] = None
    asset_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    category: str
    location: Optional[str] = None
    frequency: str
    interval_days: int = 30
    start_date: datetime
    last_performed_date: Optional[datetime] = None
    next_due_date: Optional[datetime] = None
    assigned_staff_id: Optional[int] = None
    checklist: Optional[List[Any]] = []
    is_active: bool = True


class PreventiveMaintenancePlanCreate(PreventiveMaintenancePlanBase):
    pass


class PreventiveMaintenancePlanUpdate(BaseModel):
    asset_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    frequency: Optional[str] = None
    interval_days: Optional[int] = None
    start_date: Optional[datetime] = None
    last_performed_date: Optional[datetime] = None
    next_due_date: Optional[datetime] = None
    assigned_staff_id: Optional[int] = None
    checklist: Optional[List[Any]] = None
    is_active: Optional[bool] = None


class PreventiveMaintenancePlanResponse(PreventiveMaintenancePlanBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# STAFF / HR SCHEMAS
# -----------------------------

class StaffBase(BaseModel):
    hotel_id: Optional[int] = None
    full_name: str
    phone: str
    email: Optional[str] = None

    department: str
    designation: str
    salary: float = 0

    joining_date: Optional[datetime] = None
    status: str = "active"

    address: Optional[str] = None
    id_proof_type: Optional[str] = None
    id_proof_number: Optional[str] = None

    # --- STAFF DETAILS ---
    aadhaar_no: Optional[str] = None
    pan_no: Optional[str] = None
    dob: Optional[str] = None
    father_name: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    employee_type: str = "permanent"
    role_level: Optional[str] = "employee"
    working_hours: int = 8

    # --- BANK DETAILS ---
    bank_account_no: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None

    # --- EXCEL MIGRATION FIELDS ---
    legacy_leave_balance: float = 0
    leave_tracking_start_date: Optional[datetime] = None


class StaffCreate(StaffBase):
    create_portal_access: Optional[bool] = False
    portal_username: Optional[str] = None
    portal_password: Optional[str] = None
    portal_role: Optional[str] = "staff"
    force_department_head: Optional[bool] = False


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    department: Optional[str] = None
    designation: Optional[str] = None
    role_level: Optional[str] = None
    force_department_head: Optional[bool] = False
    salary: Optional[float] = None

    joining_date: Optional[datetime] = None
    status: Optional[str] = None

    address: Optional[str] = None
    id_proof_type: Optional[str] = None
    id_proof_number: Optional[str] = None

    # --- STAFF DETAILS ---
    aadhaar_no: Optional[str] = None
    pan_no: Optional[str] = None
    dob: Optional[str] = None
    father_name: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    employee_type: Optional[str] = None
    working_hours: Optional[int] = None

    # --- BANK DETAILS ---
    bank_account_no: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None

    # --- EXCEL MIGRATION FIELDS ---
    legacy_leave_balance: Optional[float] = None
    leave_tracking_start_date: Optional[datetime] = None


class StaffResponse(StaffBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# STAFF ATTENDANCE SCHEMAS
# -----------------------------

class StaffAttendanceBase(BaseModel):
    hotel_id: Optional[int] = None
    staff_id: int
    attendance_date: datetime
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: Literal["present", "absent", "half-day", "on-leave", "off-day"] = "present"
    remarks: Optional[str] = None


class StaffAttendanceCreate(StaffAttendanceBase):
    pass


class StaffAttendanceUpdate(BaseModel):
    attendance_date: Optional[datetime] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: Optional[Literal["present", "absent", "half-day", "on-leave", "off-day"]] = None
    remarks: Optional[str] = None


class StaffAttendanceResponse(StaffAttendanceBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# STAFF SALARY STRUCTURE (NEW)
# -----------------------------

class StaffSalaryStructureBase(BaseModel):
    hotel_id: Optional[int] = None
    staff_id: int
    
    # Earnings
    basic_salary: float = 0
    hra: float = 0
    special_allowance: float = 0
    other_allowance: float = 0
    
    # Deductions
    epf_deduction: float = 0
    esi_deduction: float = 0
    
    # Totals (Calculated from above)
    gross_salary: float = 0
    net_salary: float = 0

class StaffSalaryStructureCreate(StaffSalaryStructureBase):
    pass

class StaffSalaryStructureUpdate(BaseModel):
    basic_salary: Optional[float] = None
    hra: Optional[float] = None
    special_allowance: Optional[float] = None
    other_allowance: Optional[float] = None
    epf_deduction: Optional[float] = None
    esi_deduction: Optional[float] = None
    gross_salary: Optional[float] = None
    net_salary: Optional[float] = None

class StaffSalaryStructureResponse(StaffSalaryStructureBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# STAFF MONTHLY PAYROLL / SALARY SCHEMAS
# -----------------------------

class StaffSalaryBase(BaseModel):
    hotel_id: Optional[int] = None
    staff_id: int
    salary_month: str
    status: str = "Review"
    
    # Totals
    basic_salary: float = 0
    total_allowances: float = 0
    gross_salary: float = 0
    
    total_deductions: float = 0
    net_salary: float = 0

    # JSON Structure Match
    breakdown: Dict[str, Any] = {}
    adjustments: List[Dict[str, Any]] = []

    payment_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    disbursed_by: Optional[str] = None
    remarks: Optional[str] = None


class StaffSalaryCreate(StaffSalaryBase):
    pass


class StaffSalaryUpdate(BaseModel):
    status: Optional[str] = None
    
    basic_salary: Optional[float] = None
    total_allowances: Optional[float] = None
    gross_salary: Optional[float] = None
    
    total_deductions: Optional[float] = None
    net_salary: Optional[float] = None

    breakdown: Optional[Dict[str, Any]] = None
    adjustments: Optional[List[Dict[str, Any]]] = None

    payment_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    disbursed_by: Optional[str] = None
    remarks: Optional[str] = None


class StaffSalaryResponse(StaffSalaryBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# SALARY ADVANCE SCHEMAS
# -----------------------------

class SalaryAdvanceBase(BaseModel):
    hotel_id: Optional[int] = None
    staff_id: int
    amount: float
    deduct_month: str
    status: Literal["pending", "approved", "rejected", "recovered"] = "pending"
    payment_method: str = "cash"
    approved_by: Optional[str] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None


class SalaryAdvanceCreate(SalaryAdvanceBase):
    advance_date: Optional[datetime] = None


class SalaryAdvanceUpdate(BaseModel):
    amount: Optional[float] = None
    deduct_month: Optional[str] = None
    status: Optional[Literal["pending", "approved", "rejected", "recovered"]] = None
    payment_method: Optional[str] = None
    approved_by: Optional[str] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None


class SalaryAdvanceResponse(SalaryAdvanceBase):
    id: int
    advance_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# STAFF LEAVE SCHEMAS
# -----------------------------

class StaffLeaveBase(BaseModel):
    hotel_id: Optional[int] = None
    staff_id: int
    leave_type: str
    start_date: datetime
    end_date: datetime
    total_days: float
    reason: Optional[str] = None
    status: str = "pending"
    approved_by: Optional[str] = None
    remarks: Optional[str] = None


class StaffLeaveCreate(StaffLeaveBase):
    pass


class StaffLeaveUpdate(BaseModel):
    leave_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    total_days: Optional[float] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    approved_by: Optional[str] = None
    remarks: Optional[str] = None


class StaffLeaveResponse(StaffLeaveBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# LAUNDRY SCHEMAS
# -----------------------------

class LaundryOrderBase(BaseModel):
    hotel_id: int
    guest_id: int
    room_id: Optional[int] = None
    booking_id: Optional[int] = None

    service_type: str
    item_name: str
    quantity: float
    price_per_item: float

    status: str = "received"
    payment_status: str = "bill-to-room"
    remarks: Optional[str] = None


class LaundryOrderCreate(LaundryOrderBase):
    pass


class LaundryOrderUpdate(BaseModel):
    room_id: Optional[int] = None
    booking_id: Optional[int] = None
    service_type: Optional[str] = None
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    price_per_item: Optional[float] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None
    remarks: Optional[str] = None


class LaundryOrderResponse(LaundryOrderBase):
    id: int
    total_amount: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# MINIBAR SCHEMAS
# -----------------------------

class MinibarChargeBase(BaseModel):
    hotel_id: int
    guest_id: int
    room_id: Optional[int] = None
    booking_id: Optional[int] = None

    item_name: str
    quantity: float
    price_per_item: float

    status: str = "active"
    payment_status: str = "bill-to-room"
    remarks: Optional[str] = None


class MinibarChargeCreate(MinibarChargeBase):
    pass


class MinibarChargeUpdate(BaseModel):
    room_id: Optional[int] = None
    booking_id: Optional[int] = None
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    price_per_item: Optional[float] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None
    remarks: Optional[str] = None


class MinibarChargeResponse(MinibarChargeBase):
    id: int
    total_amount: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# RESTAURANT / POS SCHEMAS
# -----------------------------

class MenuItemBase(BaseModel):
    hotel_id: int
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    price: float
    half_price: Optional[float] = None
    full_price: Optional[float] = None
    tax_percent: float = 5
    dietary_type: Optional[str] = "veg"
    is_available: bool = True


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    half_price: Optional[float] = None
    full_price: Optional[float] = None
    tax_percent: Optional[float] = None
    dietary_type: Optional[str] = None
    is_available: Optional[bool] = None


class MenuItemResponse(MenuItemBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RestaurantOrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: float
    portion: Optional[str] = "full"
    price: Optional[float] = None


class RestaurantOrderItemResponse(BaseModel):
    id: int
    order_id: int
    menu_item_id: int
    item_name: str
    portion: Optional[str] = "full"
    quantity: float
    price: float
    tax_percent: float
    total: float

    model_config = ConfigDict(from_attributes=True)


class RestaurantOrderCreate(BaseModel):
    hotel_id: int
    guest_id: Optional[int] = None
    room_id: Optional[int] = None
    booking_id: Optional[int] = None

    order_type: str
    table_number: Optional[str] = None
    guest_name: Optional[str] = None
    notes: Optional[str] = None
    order_status: str = "pending"
    status: Optional[str] = None
    billing_type: str = "pending_billing"
    payment_method: Optional[str] = None
    payment_status: str = "unpaid"

    discount: float = 0
    paid_amount: float = 0
    is_added_to_invoice: bool = False

    created_by: Optional[str] = None

    items: list[RestaurantOrderItemCreate]


class RestaurantOrderUpdate(BaseModel):
    guest_id: Optional[int] = None
    room_id: Optional[int] = None
    booking_id: Optional[int] = None

    order_type: Optional[str] = None
    table_number: Optional[str] = None
    guest_name: Optional[str] = None
    notes: Optional[str] = None
    order_status: Optional[str] = None
    status: Optional[str] = None
    billing_type: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None

    discount: Optional[float] = None
    paid_amount: Optional[float] = None
    is_added_to_invoice: Optional[bool] = None

    created_by: Optional[str] = None
    items: Optional[list[RestaurantOrderItemCreate]] = None


class RestaurantOrderResponse(BaseModel):
    id: int
    hotel_id: int
    guest_id: Optional[int] = None
    room_id: Optional[int] = None
    booking_id: Optional[int] = None

    order_type: str
    table_number: Optional[str] = None
    guest_name: Optional[str] = None
    notes: Optional[str] = None
    order_status: str
    billing_type: str
    payment_method: Optional[str] = None
    payment_status: str

    subtotal: float
    tax_amount: float
    discount: float
    total_amount: float

    paid_amount: float
    is_added_to_invoice: bool

    created_by: Optional[str] = None
    created_at: datetime

    items: list[RestaurantOrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class RestaurantTableBase(BaseModel):
    hotel_id: int
    table_number: str
    section: Optional[str] = "Main Hall"
    capacity: int = 2
    status: str = "available"
    notes: Optional[str] = None


class RestaurantTableCreate(RestaurantTableBase):
    pass


class RestaurantTableUpdate(BaseModel):
    table_number: Optional[str] = None
    section: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class RestaurantTableResponse(RestaurantTableBase):
    id: int
    created_at: datetime
    updated_at: datetime
    active_order_id: Optional[int] = None
    active_order_amount: Optional[float] = None
    active_guest_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RestaurantStatsResponse(BaseModel):
    today_orders: int
    active_tables: int
    pending_kitchen: int
    today_revenue: float
    active_room_service: int
    total_menu_items: int
    total_tables: int



# =============================================================
# VENDOR / SUPPLIER SCHEMAS
# =============================================================

class VendorBase(BaseModel):
    hotel_id: Optional[int] = None

    vendor_name: str
    contact_person: Optional[str] = None
    phone: str
    email: Optional[EmailStr] = None

    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

    gst_number: Optional[str] = None
    vendor_type: Optional[str] = None

    payment_terms: Optional[str] = None
    status: str = "active"

    remarks: Optional[str] = None


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    vendor_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

    gst_number: Optional[str] = None
    vendor_type: Optional[str] = None

    payment_terms: Optional[str] = None
    status: Optional[str] = None

    remarks: Optional[str] = None


class VendorResponse(VendorBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# PURCHASE / PROCUREMENT SCHEMAS
# =============================================================

class PurchaseOrderItemCreate(BaseModel):
    item_id: int
    quantity: float
    unit_price: float
    tax_percent: float = 0


class PurchaseOrderItemResponse(BaseModel):
    id: int
    purchase_order_id: int
    item_id: int
    item_name: str
    quantity: float
    unit_price: float
    tax_percent: float
    total: float

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderCreate(BaseModel):
    hotel_id: Optional[int] = None
    vendor_id: int

    expected_delivery_date: Optional[datetime] = None

    status: str = "draft"
    payment_status: str = "pending"

    discount: float = 0
    notes: Optional[str] = None
    created_by: Optional[str] = None

    items: List[PurchaseOrderItemCreate]


class PurchaseOrderUpdate(BaseModel):
    vendor_id: Optional[int] = None
    expected_delivery_date: Optional[datetime] = None

    status: Optional[str] = None
    payment_status: Optional[str] = None

    discount: Optional[float] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    id: int
    hotel_id: int
    vendor_id: int
    po_number: str

    order_date: datetime
    expected_delivery_date: Optional[datetime] = None

    status: str
    payment_status: str

    subtotal: float
    tax_amount: float
    discount: float
    grand_total: float

    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    items: List[PurchaseOrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderReceive(BaseModel):
    received_by: Optional[str] = None
    remarks: Optional[str] = None


# =============================================================
# EXPENSE MANAGEMENT SCHEMAS
# =============================================================

class ExpenseBase(BaseModel):
    hotel_id: int

    vendor_id: Optional[int] = None
    staff_id: Optional[int] = None

    expense_title: str
    expense_category: str

    amount: float

    payment_method: Optional[str] = None
    payment_status: str = "pending"

    expense_date: Optional[datetime] = None

    paid_by: Optional[str] = None
    remarks: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    vendor_id: Optional[int] = None
    staff_id: Optional[int] = None

    expense_title: Optional[str] = None
    expense_category: Optional[str] = None

    amount: Optional[float] = None

    payment_method: Optional[str] = None
    payment_status: Optional[str] = None

    expense_date: Optional[datetime] = None

    paid_by: Optional[str] = None
    remarks: Optional[str] = None


class ExpenseResponse(ExpenseBase):
    id: int
    expense_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# USER / ROLE / AUTH SCHEMAS
# =============================================================

class UserCreate(BaseModel):
    hotel_id: Optional[int] = None
    staff_id: Optional[int] = None

    username: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    full_name: str
    password: str

    role: str
    is_active: bool = True
    allowed_modules: Optional[List[str]] = []


class UserUpdate(BaseModel):
    hotel_id: Optional[int] = None
    staff_id: Optional[int] = None

    username: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    full_name: Optional[str] = None
    password: Optional[str] = None

    role: Optional[str] = None
    is_active: Optional[bool] = None
    allowed_modules: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: int
    hotel_id: Optional[int] = None
    staff_id: Optional[int] = None

    username: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    full_name: str
    role: str
    role_level: Optional[str] = "employee"
    is_active: bool
    allowed_modules: Optional[List[str]] = []
    must_change_password: Optional[bool] = False

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    message: str

    access_token: str
    token_type: str = "bearer"

    user_id: int
    hotel_id: Optional[int] = None
    hotel_name: Optional[str] = None
    hotel_phone: Optional[str] = None
    hotel_address: Optional[str] = None
    hotel_tax_number: Optional[str] = None
    hotel: Optional[Dict[str, Any]] = None
    staff_id: Optional[int] = None
    username: str
    full_name: str
    role: str
    role_level: Optional[str] = "employee"
    is_active: bool
    allowed_modules: Optional[List[str]] = []
    department: Optional[str] = None
    designation: Optional[str] = None
    must_change_password: Optional[bool] = False


class CurrentUserResponse(BaseModel):
    user_id: int
    hotel_id: Optional[int] = None
    hotel_name: Optional[str] = None
    hotel_phone: Optional[str] = None
    hotel_address: Optional[str] = None
    hotel_tax_number: Optional[str] = None
    hotel: Optional[Dict[str, Any]] = None
    staff_id: Optional[int] = None
    username: str
    full_name: str
    role: str
    role_level: Optional[str] = "employee"
    is_active: bool
    allowed_modules: Optional[List[str]] = []
    department: Optional[str] = None
    designation: Optional[str] = None
    must_change_password: Optional[bool] = False



class ChangePasswordFirstLoginRequest(BaseModel):
    new_password: str


class EmployeePortalAccessCreate(BaseModel):
    staff_id: int
    username: str
    password: Optional[str] = None
    role: str = "staff"
    role_level: Optional[str] = "employee"
    department: Optional[str] = None
    designation: Optional[str] = None
    allowed_modules: Optional[List[str]] = []
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    must_change_password: Optional[bool] = False


class UserPortalsUpdate(BaseModel):
    allowed_modules: List[str]


class StaffLinkedUserBrief(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    role_level: Optional[str] = "employee"
    is_active: bool
    allowed_modules: Optional[List[str]] = []
    must_change_password: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class StaffWithPortalAccessResponse(BaseModel):
    id: int
    hotel_id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    department: str
    designation: str
    role_level: Optional[str] = "employee"
    status: str
    employee_type: Optional[str] = "permanent"
    is_assigned: bool
    user: Optional[StaffLinkedUserBrief] = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# EXTRA CHARGES SCHEMAS
# =============================================================

class ExtraChargeCreate(BaseModel):
    hotel_id: int
    booking_id: int
    room_id: Optional[int] = None
    charge_name: str
    quantity: int = 1
    rate: float
    description: Optional[str] = None
    status: str = "pending"


class ExtraChargeUpdate(BaseModel):
    booking_id: Optional[int] = None
    room_id: Optional[int] = None
    charge_name: Optional[str] = None
    quantity: Optional[int] = None
    rate: Optional[float] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ExtraChargeResponse(BaseModel):
    id: int
    hotel_id: int
    booking_id: int
    guest_id: Optional[int] = None
    room_id: Optional[int] = None
    charge_name: str
    quantity: int
    rate: float
    total_amount: float
    description: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# MASTER EXTRA SERVICE CATALOG SCHEMAS
# =============================================================

class ExtraServiceCatalogBase(BaseModel):
    hotel_id: int
    name: str
    default_price: float = 0.0
    is_active: bool = True


class ExtraServiceCatalogCreate(BaseModel):
    hotel_id: Optional[int] = None
    name: str
    default_price: float = 0.0


class ExtraServiceCatalogUpdate(BaseModel):
    name: Optional[str] = None
    default_price: Optional[float] = None
    is_active: Optional[bool] = None


class ExtraServiceCatalogResponse(ExtraServiceCatalogBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================
# ANNOUNCEMENTS & HR PAYROLL / BIOMETRICS SCHEMAS
# =============================================================

class AnnouncementBase(BaseModel):
    title: str
    message: str
    alert_type: str = "info"
    is_active: bool = True


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    alert_type: Optional[str] = None
    is_active: Optional[bool] = None


class AnnouncementResponse(AnnouncementBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProcessPayrollRequest(BaseModel):
    month: str


class PayrollStatusUpdate(BaseModel):
    status: str
    month: str
    staff_id: int


class AdjustmentRequest(BaseModel):
    type: str
    amount: float
    reason: str
    month: str


class BiometricPunchCreate(BaseModel):
    hotel_id: int
    staff_id: int
    punch_time: datetime
    device_id: Optional[str] = "DEVICE-01"
    punch_type: Optional[str] = "auto"


class BiometricBatchSync(BaseModel):
    hotel_id: int
    punches: List[BiometricPunchCreate]


class BiometricLogResponse(BaseModel):
    id: int
    hotel_id: int
    staff_id: int
    punch_time: datetime
    device_id: Optional[str] = None
    punch_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# DEPARTMENT TASKS SCHEMAS
# -------------------------------------------------------------

class DepartmentTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = "General"
    priority: Optional[str] = "normal"
    location: Optional[str] = None
    room_id: Optional[int] = None
    asset_id: Optional[int] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = 1.0


class DepartmentTaskCreate(DepartmentTaskBase):
    department: Optional[str] = "maintenance"
    hotel_id: Optional[int] = None
    assigned_to_staff_id: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = None


class DepartmentTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    room_id: Optional[int] = None
    asset_id: Optional[int] = None
    assigned_to_staff_id: Optional[int] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None


class DepartmentTaskAssign(BaseModel):
    staff_id: Optional[int] = None


class DepartmentTaskStatusUpdate(BaseModel):
    status: str
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None


class DepartmentTaskStaffBrief(BaseModel):
    id: int
    full_name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DepartmentTaskResponse(BaseModel):
    id: int
    task_number: str
    hotel_id: int
    department: str
    title: str
    description: Optional[str] = None
    category: str
    priority: str
    status: str
    location: Optional[str] = None
    room_id: Optional[int] = None
    asset_id: Optional[int] = None
    assigned_to_staff_id: Optional[int] = None
    assigned_staff: Optional[DepartmentTaskStaffBrief] = None
    created_by_user_id: Optional[int] = None
    due_date: Optional[datetime] = None
    estimated_hours: float
    actual_hours: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    source_ticket_id: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentTaskSignOff(BaseModel):
    notes: Optional[str] = None


class DepartmentTaskRework(BaseModel):
    reason: str


class DepartmentTaskStatsResponse(BaseModel):
    total: int
    pending: int
    assigned: int
    in_progress: int
    completed: int
    urgent: int


class DepartmentTaskComplete(BaseModel):
    completion_notes: Optional[str] = None
    actual_hours: Optional[float] = None


# -------------------------------------------------------------
# DEPARTMENT TICKETS & AUDIT LOG SCHEMAS (PHASE 6)
# -------------------------------------------------------------

class DepartmentTicketCreate(BaseModel):
    title: str
    description: Optional[str] = None
    department: Optional[str] = "maintenance"
    category: Optional[str] = "General"
    priority: Optional[str] = "normal"
    source: Optional[str] = "direct"
    location: Optional[str] = None
    room_id: Optional[int] = None
    reported_by: Optional[str] = None
    contact_phone: Optional[str] = None
    hotel_id: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = None


class DepartmentTicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    reported_by: Optional[str] = None
    contact_phone: Optional[str] = None
    resolution_notes: Optional[str] = None


class DepartmentTicketConvertToTask(BaseModel):
    assigned_to_staff_id: Optional[int] = None
    estimated_hours: Optional[float] = 1.0
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None


class DepartmentTicketResponse(BaseModel):
    id: int
    ticket_number: str
    hotel_id: int
    department: str
    title: str
    description: Optional[str] = None
    category: str
    priority: str
    status: str
    source: str
    location: Optional[str] = None
    room_id: Optional[int] = None
    reported_by: Optional[str] = None
    contact_phone: Optional[str] = None
    created_by_user_id: Optional[int] = None
    converted_to_task_id: Optional[int] = None
    converted_at: Optional[datetime] = None
    converted_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentAuditLogResponse(BaseModel):
    id: int
    hotel_id: int
    department: str
    entity_type: str
    entity_id: int
    entity_identifier: Optional[str] = None
    action: str
    performed_by_user_id: Optional[int] = None
    performed_by_name: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)