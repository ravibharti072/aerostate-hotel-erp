from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Literal, Dict, List, Any
from datetime import datetime


# -----------------------------
# HOTEL SCHEMAS
# -----------------------------

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
    go_live_date: Optional[datetime] = None # <-- NEW: Added to expose to frontend


class HotelCreate(HotelBase):
    pass


class HotelResponse(HotelBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoLiveUpdate(BaseModel):
    go_live_date: str  # Expected format: YYYY-MM-DD


# -----------------------------
# ROOM SCHEMAS
# -----------------------------

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


class RoomResponse(RoomBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# GUEST SCHEMAS
# -----------------------------

class GuestBase(BaseModel):
    hotel_id: int
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None


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


class GuestResponse(GuestBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# BOOKING SCHEMAS
# -----------------------------

class BookingBase(BaseModel):
    hotel_id: int
    guest_id: int
    room_id: int

    checkin_date: datetime
    checkout_date: datetime

    adults: int = 1
    children: int = 0

    booking_source: str = "walk-in"
    status: str = "confirmed"

    room_rate: float
    discount: float = 0
    tax: float = 0
    total_amount: float
    advance_paid: float = 0
    payment_status: str = "pending"


class BookingCreate(BookingBase):
    pass


# WALK-IN SCHEMA FOR QUICK CHECK-IN
class WalkInBookingCreate(BaseModel):
    hotel_id: int
    room_id: int
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    id_proof_type: Optional[str] = None
    id_proof_number: Optional[str] = None
    checkin_date: datetime
    checkout_date: datetime
    adults: int = 1
    children: int = 0
    room_rate: float = 0.0
    total_amount: float = 0.0
    advance_paid: float = 0.0
    payment_status: str = "paid"
    payment_method: str = "cash"


class BookingUpdate(BaseModel):
    checkin_date: Optional[datetime] = None
    checkout_date: Optional[datetime] = None
    adults: Optional[int] = None
    children: Optional[int] = None
    booking_source: Optional[str] = None
    status: Optional[str] = None
    room_rate: Optional[float] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    total_amount: Optional[float] = None
    advance_paid: Optional[float] = None
    payment_status: Optional[str] = None


class BookingResponse(BookingBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# HOUSEKEEPING SCHEMAS
# -----------------------------

class RoomStatusUpdate(BaseModel):
    status: str


class HousekeepingTaskCreate(BaseModel):
    hotel_id: int
    room_id: int
    booking_id: Optional[int] = None
    assigned_staff_id: Optional[int] = None

    task_type: str = "room-cleaning"
    priority: str = "medium"
    status: str = "pending"

    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None


class HousekeepingTaskUpdate(BaseModel):
    room_id: Optional[int] = None
    booking_id: Optional[int] = None
    assigned_staff_id: Optional[int] = None

    task_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class HousekeepingTaskStatusUpdate(BaseModel):
    status: str


class HousekeepingTaskResponse(BaseModel):
    id: int

    hotel_id: int
    room_id: int
    booking_id: Optional[int] = None
    assigned_staff_id: Optional[int] = None

    task_type: str
    priority: str
    status: str

    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# INVOICE SCHEMAS
# -----------------------------

class InvoiceCreate(BaseModel):
    hotel_id: int
    guest_id: int
    booking_id: int

    room_charges: float = 0
    restaurant_charges: float = 0
    laundry_charges: float = 0
    minibar_charges: float = 0
    extra_charges: float = 0

    discount: float = 0
    tax_amount: float = 0


class InvoiceResponse(BaseModel):
    id: int
    hotel_id: int
    guest_id: int
    booking_id: int
    invoice_number: str

    room_charges: float
    restaurant_charges: float
    laundry_charges: float
    minibar_charges: float
    extra_charges: float

    discount: float
    tax_amount: float
    grand_total: float
    paid_amount: float
    due_amount: float
    payment_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# PAYMENT SCHEMAS
# -----------------------------

class PaymentCreate(BaseModel):
    invoice_id: int
    amount: float
    payment_method: str
    transaction_id: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    hotel_id: int
    guest_id: int
    invoice_id: int
    amount: float
    payment_method: str
    transaction_id: Optional[str] = None
    payment_status: str
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# AUTO INVOICE FROM BOOKING SCHEMA
# -----------------------------

class BookingInvoiceCreate(BaseModel):
    laundry_charges: float = 0
    minibar_charges: float = 0
    extra_charges: float = 0
    discount: float = 0
    tax_amount: float = 0
    include_restaurant_bill_to_room: bool = True


# -----------------------------
# INVENTORY SCHEMAS
# -----------------------------

class InventoryItemBase(BaseModel):
    hotel_id: int
    name: str
    sku: str
    category: Optional[str] = None
    unit: str
    current_stock: float = 0
    min_stock_level: float = 0
    purchase_price: float = 0
    supplier_name: Optional[str] = None
    is_active: bool = True


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    min_stock_level: Optional[float] = None
    purchase_price: Optional[float] = None
    supplier_name: Optional[str] = None
    is_active: Optional[bool] = None


class InventoryItemResponse(InventoryItemBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockTransactionCreate(BaseModel):
    item_id: int
    transaction_type: str
    quantity: float
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

    issue_title: str
    issue_description: Optional[str] = None
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

    issue_title: Optional[str] = None
    issue_description: Optional[str] = None
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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# STAFF / HR SCHEMAS
# -----------------------------

class StaffBase(BaseModel):
    hotel_id: int
    full_name: str
    phone: str
    email: Optional[EmailStr] = None

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
    employee_type: str = "permanent"
    working_hours: int = 8

    # --- BANK DETAILS ---
    bank_account_no: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None

    # --- EXCEL MIGRATION FIELDS ---
    legacy_leave_balance: float = 0
    leave_tracking_start_date: Optional[datetime] = None


class StaffCreate(StaffBase):
    pass


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

    department: Optional[str] = None
    designation: Optional[str] = None
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
    hotel_id: int
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
    hotel_id: int
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
    hotel_id: int
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
    hotel_id: int
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
    hotel_id: int
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
    price: float
    half_price: Optional[float] = None
    full_price: Optional[float] = None
    tax_percent: float = 5
    is_available: bool = True


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    half_price: Optional[float] = None
    full_price: Optional[float] = None
    tax_percent: Optional[float] = None
    is_available: Optional[bool] = None


class MenuItemResponse(MenuItemBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RestaurantOrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: float


class RestaurantOrderItemResponse(BaseModel):
    id: int
    order_id: int
    menu_item_id: int
    item_name: str
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
    order_status: str = "pending"
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
    order_status: Optional[str] = None
    billing_type: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None

    discount: Optional[float] = None
    paid_amount: Optional[float] = None
    is_added_to_invoice: Optional[bool] = None

    created_by: Optional[str] = None


class RestaurantOrderResponse(BaseModel):
    id: int
    hotel_id: int
    guest_id: Optional[int] = None
    room_id: Optional[int] = None
    booking_id: Optional[int] = None

    order_type: str
    table_number: Optional[str] = None
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


# -----------------------------
# VENDOR / SUPPLIER SCHEMAS
# -----------------------------

class VendorBase(BaseModel):
    hotel_id: int

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


# -----------------------------
# PURCHASE / PROCUREMENT SCHEMAS
# -----------------------------

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
    hotel_id: int
    vendor_id: int

    expected_delivery_date: Optional[datetime] = None

    status: str = "draft"
    payment_status: str = "pending"

    discount: float = 0
    notes: Optional[str] = None
    created_by: Optional[str] = None

    items: list[PurchaseOrderItemCreate]


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

    items: list[PurchaseOrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderReceive(BaseModel):
    received_by: Optional[str] = None
    remarks: Optional[str] = None


# -----------------------------
# EXPENSE MANAGEMENT SCHEMAS
# -----------------------------

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


# -----------------------------
# USER / ROLE / AUTH SCHEMAS
# -----------------------------

class UserCreate(BaseModel):
    hotel_id: Optional[int] = None

    username: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    full_name: str
    password: str

    role: str
    is_active: bool = True


class UserUpdate(BaseModel):
    hotel_id: Optional[int] = None

    username: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    full_name: Optional[str] = None
    password: Optional[str] = None

    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    hotel_id: Optional[int] = None

    username: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    full_name: str
    role: str
    is_active: bool

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
    username: str
    full_name: str
    role: str
    is_active: bool


class CurrentUserResponse(BaseModel):
    user_id: int
    hotel_id: Optional[int] = None
    username: str
    full_name: str
    role: str
    is_active: bool


# -----------------------------
# EXTRA CHARGES SCHEMAS
# -----------------------------

class ExtraChargeCreate(BaseModel):
    hotel_id: int
    booking_id: int
    charge_name: str
    quantity: int = 1
    rate: float
    description: Optional[str] = None
    status: str = "pending"


class ExtraChargeUpdate(BaseModel):
    charge_name: Optional[str] = None
    quantity: Optional[int] = None
    rate: Optional[float] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ExtraChargeResponse(BaseModel):
    id: int
    hotel_id: int
    booking_id: int
    guest_id: int
    room_id: int
    charge_name: str
    quantity: int
    rate: float
    total_amount: float
    description: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ANNOUNCEMENT SCHEMAS ---
class AnnouncementBase(BaseModel):
    title: str
    message: str
    alert_type: str = "info"
    is_active: bool = True

class AnnouncementCreate(AnnouncementBase):
    pass

class AnnouncementResponse(AnnouncementBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# PAYROLL PROCESSING SCHEMAS
# -----------------------------

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


# -----------------------------
# BIOMETRIC PUNCH SCHEMAS (NEW)
# -----------------------------

class BiometricPunchCreate(BaseModel):
    hotel_id: int
    staff_id: int
    punch_time: datetime
    device_id: Optional[str] = "DEVICE-01"
    punch_type: Optional[str] = "auto"  # 'in', 'out', or 'auto'

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