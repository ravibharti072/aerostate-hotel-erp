from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Hotel(Base):
    __tablename__ = "hotels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    tax_number = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # --- NEW: SYSTEM GO-LIVE DATE ---
    go_live_date = Column(DateTime, nullable=True)
    
    # Stores the assigned ERP modules for this specific hotel
    modules = Column(JSON, default=[]) 
    
    created_at = Column(DateTime, default=datetime.utcnow)

    rooms = relationship("Room", back_populates="hotel")
    guests = relationship("Guest", back_populates="hotel")
    bookings = relationship("Booking", back_populates="hotel")
    invoices = relationship("Invoice", back_populates="hotel")
    payments = relationship("Payment", back_populates="hotel")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="hotel")

    menu_items = relationship("MenuItem", back_populates="hotel")
    restaurant_orders = relationship("RestaurantOrder", back_populates="hotel")

    inventory_items = relationship("InventoryItem", back_populates="hotel")
    stock_transactions = relationship("StockTransaction", back_populates="hotel")
    
    staff_members = relationship("Staff", back_populates="hotel")
    staff_attendance_records = relationship("StaffAttendance", back_populates="hotel")
    biometric_logs = relationship("BiometricLog", back_populates="hotel") # --- NEW ---
    
    # --- SALARY RELATIONS ---
    staff_salary_structures = relationship("StaffSalaryStructure", back_populates="hotel")
    staff_salaries = relationship("StaffSalary", back_populates="hotel")
    salary_advances = relationship("SalaryAdvance", back_populates="hotel")
    
    staff_leaves = relationship("StaffLeave", back_populates="hotel")
    laundry_orders = relationship("LaundryOrder", back_populates="hotel")
    minibar_charges = relationship("MinibarCharge", back_populates="hotel")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="hotel")
    vendors = relationship("Vendor", back_populates="hotel")
    purchase_orders = relationship("PurchaseOrder", back_populates="hotel")
    expenses = relationship("Expense", back_populates="hotel")
    users = relationship("User", back_populates="hotel")
    extra_charges = relationship("ExtraCharge", back_populates="hotel")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    room_number = Column(String, nullable=False)
    floor = Column(String, nullable=True)
    room_type = Column(String, nullable=False)
    bed_type = Column(String, nullable=True)
    max_occupancy = Column(Integer, default=2)
    base_price = Column(Float, nullable=False)
    status = Column(String, default="available")
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="rooms")
    bookings = relationship("Booking", back_populates="room")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="room")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="room")
    
    restaurant_orders = relationship("RestaurantOrder", back_populates="room")
    laundry_orders = relationship("LaundryOrder", back_populates="room")
    minibar_charges = relationship("MinibarCharge", back_populates="room")
    extra_charges = relationship("ExtraCharge", back_populates="room")


class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    full_name = Column(String, nullable=False)
    phone = Column(String, index=True, nullable=False)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    nationality = Column(String, nullable=True)
    id_type = Column(String, nullable=True)
    id_number = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="guests")
    bookings = relationship("Booking", back_populates="guest")
    invoices = relationship("Invoice", back_populates="guest")
    payments = relationship("Payment", back_populates="guest")
    laundry_orders = relationship("LaundryOrder", back_populates="guest")
    minibar_charges = relationship("MinibarCharge", back_populates="guest")
    restaurant_orders = relationship("RestaurantOrder", back_populates="guest")
    extra_charges = relationship("ExtraCharge", back_populates="guest")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)

    checkin_date = Column(DateTime, nullable=False)
    checkout_date = Column(DateTime, nullable=False)
    adults = Column(Integer, default=1)
    children = Column(Integer, default=0)

    booking_source = Column(String, default="walk-in")
    status = Column(String, default="confirmed")

    room_rate = Column(Float, nullable=False)
    discount = Column(Float, default=0)
    tax = Column(Float, default=0)
    total_amount = Column(Float, nullable=False)
    advance_paid = Column(Float, default=0)
    payment_status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="bookings")
    guest = relationship("Guest", back_populates="bookings")
    room = relationship("Room", back_populates="bookings")
    invoices = relationship("Invoice", back_populates="booking")
    laundry_orders = relationship("LaundryOrder", back_populates="booking")
    minibar_charges = relationship("MinibarCharge", back_populates="booking")
    restaurant_orders = relationship("RestaurantOrder", back_populates="booking")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="booking")
    extra_charges = relationship("ExtraCharge", back_populates="booking")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)

    invoice_number = Column(String, unique=True, index=True, nullable=False)

    room_charges = Column(Float, default=0)
    restaurant_charges = Column(Float, default=0)
    laundry_charges = Column(Float, default=0)
    minibar_charges = Column(Float, default=0)
    extra_charges = Column(Float, default=0)

    discount = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    grand_total = Column(Float, nullable=False)

    paid_amount = Column(Float, default=0)
    due_amount = Column(Float, default=0)

    payment_status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="invoices")
    guest = relationship("Guest", back_populates="invoices")
    booking = relationship("Booking", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)

    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)
    transaction_id = Column(String, nullable=True)
    payment_status = Column(String, default="success")
    received_by = Column(String, nullable=True)
    remarks = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="payments")
    guest = relationship("Guest", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payments")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    
    price = Column(Float, nullable=False)
    half_price = Column(Float, nullable=True) 
    full_price = Column(Float, nullable=True) 
    
    tax_percent = Column(Float, default=0)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="menu_items")
    order_items = relationship("RestaurantOrderItem", back_populates="menu_item")


class RestaurantOrder(Base):
    __tablename__ = "restaurant_orders"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)

    order_type = Column(String, nullable=False)

    table_number = Column(String, nullable=True)
    order_status = Column(String, default="pending")
    billing_type = Column(String, default="pending_billing")
    payment_method = Column(String, nullable=True)
    payment_status = Column(String, default="unpaid")

    subtotal = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    discount = Column(Float, default=0)
    total_amount = Column(Float, default=0)

    paid_amount = Column(Float, default=0)
    is_added_to_invoice = Column(Boolean, default=False)

    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="restaurant_orders")
    guest = relationship("Guest", back_populates="restaurant_orders")
    room = relationship("Room", back_populates="restaurant_orders")
    booking = relationship("Booking", back_populates="restaurant_orders")
    items = relationship("RestaurantOrderItem", back_populates="order")


class RestaurantOrderItem(Base):
    __tablename__ = "restaurant_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("restaurant_orders.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)

    item_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    tax_percent = Column(Float, default=0)
    total = Column(Float, default=0)

    order = relationship("RestaurantOrder", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    name = Column(String, nullable=False)
    sku = Column(String, nullable=False)
    category = Column(String, nullable=True)
    unit = Column(String, nullable=False)

    current_stock = Column(Float, default=0)
    min_stock_level = Column(Float, default=0)

    purchase_price = Column(Float, default=0)
    supplier_name = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="inventory_items")
    stock_transactions = relationship("StockTransaction", back_populates="item")
    purchase_order_items = relationship("PurchaseOrderItem", back_populates="item")


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    issue_title = Column(String, nullable=False)
    issue_description = Column(String, nullable=True)
    priority = Column(String, default="medium")

    status = Column(String, default="open")

    reported_by = Column(String, nullable=True)
    assigned_by = Column(String, nullable=True)

    estimated_cost = Column(Float, default=0)
    actual_cost = Column(Float, default=0)

    start_date = Column(DateTime, nullable=True)
    completed_date = Column(DateTime, nullable=True)

    remarks = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="maintenance_requests")
    room = relationship("Room", back_populates="maintenance_requests")
    assigned_staff = relationship("Staff", back_populates="maintenance_requests")


class HousekeepingTask(Base):
    __tablename__ = "housekeeping_tasks"

    id = Column(Integer, primary_key=True, index=True)

    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    task_type = Column(String, default="room-cleaning", nullable=False)
    priority = Column(String, default="medium", nullable=False)

    status = Column(String, default="pending", nullable=False)

    assigned_to = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    created_by = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="housekeeping_tasks")
    room = relationship("Room", back_populates="housekeeping_tasks")
    booking = relationship("Booking", back_populates="housekeeping_tasks")
    assigned_staff = relationship("Staff", back_populates="housekeeping_tasks")


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)

    transaction_type = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)

    reason = Column(String, nullable=True)
    reference = Column(String, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="stock_transactions")
    item = relationship("InventoryItem", back_populates="stock_transactions")


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)

    department = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    salary = Column(Float, default=0)

    joining_date = Column(DateTime, nullable=True)
    status = Column(String, default="active")

    address = Column(String, nullable=True)
    id_proof_type = Column(String, nullable=True)
    id_proof_number = Column(String, nullable=True)

    # --- STAFF DETAILS ---
    aadhaar_no = Column(String, nullable=True)
    pan_no = Column(String, nullable=True)
    dob = Column(String, nullable=True) 
    father_name = Column(String, nullable=True)
    employee_type = Column(String, default="permanent")

    # --- WORKING HOURS ---
    working_hours = Column(Integer, default=8)

    # --- BANK DETAILS ---
    bank_account_no = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)

    # --- EXCEL MIGRATION FIELDS ---
    legacy_leave_balance = Column(Float, default=0)
    leave_tracking_start_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="staff_members")
    attendance_records = relationship("StaffAttendance", back_populates="staff")
    biometric_logs = relationship("BiometricLog", back_populates="staff") # --- NEW ---
    
    # --- SALARY RELATIONS ---
    salary_structure = relationship("StaffSalaryStructure", back_populates="staff", uselist=False)
    salary_records = relationship("StaffSalary", back_populates="staff")
    salary_advances = relationship("SalaryAdvance", back_populates="staff")
    
    leave_records = relationship("StaffLeave", back_populates="staff")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="assigned_staff")
    expenses = relationship("Expense", back_populates="staff")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="assigned_staff")


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)

    attendance_date = Column(DateTime, nullable=False)
    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)

    status = Column(String, default="present")
    remarks = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="staff_attendance_records")
    staff = relationship("Staff", back_populates="attendance_records")


# ----------------------------------------------------
# NEW: BIOMETRIC LOGS (RAW PUNCHES)
# ----------------------------------------------------
class BiometricLog(Base):
    __tablename__ = "biometric_logs"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    
    punch_time = Column(DateTime, nullable=False, index=True)
    device_id = Column(String, default="DEVICE-01", nullable=True)
    punch_type = Column(String, default="auto", nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="biometric_logs")
    staff = relationship("Staff", back_populates="biometric_logs")


# ----------------------------------------------------
# STAFF SALARY STRUCTURE (FIXED ASSIGNMENT)
# ----------------------------------------------------
class StaffSalaryStructure(Base):
    __tablename__ = "staff_salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), unique=True, nullable=False)

    # Earnings
    basic_salary = Column(Float, default=0)
    hra = Column(Float, default=0)
    special_allowance = Column(Float, default=0)
    other_allowance = Column(Float, default=0)

    # Deductions
    epf_deduction = Column(Float, default=0)
    esi_deduction = Column(Float, default=0)

    # Totals
    gross_salary = Column(Float, default=0)
    net_salary = Column(Float, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="staff_salary_structures")
    staff = relationship("Staff", back_populates="salary_structure")


# ----------------------------------------------------
# UPDATED: STAFF SALARY (MONTHLY LEDGER PAYOUTS)
# ----------------------------------------------------
class StaffSalary(Base):
    __tablename__ = "staff_salaries"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)

    salary_month = Column(String, nullable=False)
    status = Column(String, default="Review") # Added for UI Mapping (Review, Finalized, Paid)

    # Totals
    basic_salary = Column(Float, default=0)
    total_allowances = Column(Float, default=0)
    gross_salary = Column(Float, default=0)
    
    total_deductions = Column(Float, default=0)
    net_salary = Column(Float, nullable=False)

    # Added JSON fields to match our dynamic backend structure
    breakdown = Column(JSON, default={})
    adjustments = Column(JSON, default=[])

    payment_date = Column(DateTime, nullable=True)
    payment_method = Column(String, nullable=True)
    transaction_id = Column(String, nullable=True)
    disbursed_by = Column(String, nullable=True)

    remarks = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="staff_salaries")
    staff = relationship("Staff", back_populates="salary_records")


class SalaryAdvance(Base):
    __tablename__ = "salary_advances"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)

    amount = Column(Float, nullable=False)
    advance_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    deduct_month = Column(String, nullable=False)
    
    status = Column(String, default="pending")
    
    payment_method = Column(String, default="cash")
    approved_by = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    remarks = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="salary_advances")
    staff = relationship("Staff", back_populates="salary_advances")


class StaffLeave(Base):
    __tablename__ = "staff_leaves"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)

    leave_type = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    total_days = Column(Float, nullable=False)

    reason = Column(String, nullable=True)
    status = Column(String, default="pending")

    approved_by = Column(String, nullable=True)
    remarks = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="staff_leaves")
    staff = relationship("Staff", back_populates="leave_records")


class LaundryOrder(Base):
    __tablename__ = "laundry_orders"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)

    service_type = Column(String, nullable=False)
    item_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price_per_item = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)

    status = Column(String, default="received")
    payment_status = Column(String, default="bill-to-room")

    remarks = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="laundry_orders")
    guest = relationship("Guest", back_populates="laundry_orders")
    room = relationship("Room", back_populates="laundry_orders")
    booking = relationship("Booking", back_populates="laundry_orders")


class MinibarCharge(Base):
    __tablename__ = "minibar_charges"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)

    item_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price_per_item = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)

    status = Column(String, default="active")
    payment_status = Column(String, default="bill-to-room")

    remarks = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="minibar_charges")
    guest = relationship("Guest", back_populates="minibar_charges")
    room = relationship("Room", back_populates="minibar_charges")
    booking = relationship("Booking", back_populates="minibar_charges")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    vendor_name = Column(String, nullable=False)
    contact_person = Column(String, nullable=True)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)

    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)

    gst_number = Column(String, nullable=True)
    vendor_type = Column(String, nullable=True)

    payment_terms = Column(String, nullable=True)
    status = Column(String, default="active")

    remarks = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="vendors")
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")
    expenses = relationship("Expense", back_populates="vendor")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)

    po_number = Column(String, unique=True, index=True, nullable=False)

    order_date = Column(DateTime, default=datetime.utcnow)
    expected_delivery_date = Column(DateTime, nullable=True)

    status = Column(String, default="draft")
    payment_status = Column(String, default="pending")

    subtotal = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    discount = Column(Float, default=0)
    grand_total = Column(Float, default=0)

    notes = Column(String, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="purchase_orders")
    vendor = relationship("Vendor", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)

    item_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    tax_percent = Column(Float, default=0)
    total = Column(Float, default=0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    item = relationship("InventoryItem", back_populates="purchase_order_items")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    expense_title = Column(String, nullable=False)
    expense_category = Column(String, nullable=False)

    amount = Column(Float, nullable=False)

    payment_method = Column(String, nullable=True)
    payment_status = Column(String, default="pending")

    expense_date = Column(DateTime, default=datetime.utcnow)

    paid_by = Column(String, nullable=True)
    remarks = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="expenses")
    vendor = relationship("Vendor", back_populates="expenses")
    staff = relationship("Staff", back_populates="expenses")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True)

    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, nullable=True)

    full_name = Column(String, nullable=False)

    password_hash = Column(String, nullable=False)

    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="users")


class ExtraCharge(Base):
    __tablename__ = "extra_charges"

    id = Column(Integer, primary_key=True, index=True)

    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)

    charge_name = Column(String, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    rate = Column(Float, default=0, nullable=False)
    total_amount = Column(Float, default=0, nullable=False)

    description = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="extra_charges")
    booking = relationship("Booking", back_populates="extra_charges")
    guest = relationship("Guest", back_populates="extra_charges")
    room = relationship("Room", back_populates="extra_charges")


class SystemAnnouncement(Base):
    __tablename__ = "system_announcements"

    id = Column(Integer, primary_key=True, index=True)
    
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    
    alert_type = Column(String, default="info") 
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)