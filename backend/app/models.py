from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

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

    go_live_date = Column(DateTime, nullable=True)

    default_checkin_time = Column(String(5), default="11:00", nullable=False)
    default_checkout_time = Column(String(5), default="11:00", nullable=False)
    checkout_grace_minutes = Column(Integer, default=60, nullable=False)
    require_full_payment_before_checkout = Column(Boolean, default=False, nullable=False)

    modules = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    rooms = relationship("Room", back_populates="hotel")
    guests = relationship("Guest", back_populates="hotel")
    bookings = relationship("Booking", back_populates="hotel")
    folios = relationship("Folio", back_populates="hotel")
    folio_charges = relationship("FolioCharge", back_populates="hotel")
    invoices = relationship("Invoice", back_populates="hotel")
    payments = relationship("Payment", back_populates="hotel")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="hotel")
    housekeeping_inspections = relationship("HousekeepingInspection", back_populates="hotel")
    housekeeping_history = relationship("HousekeepingTaskHistory", back_populates="hotel")

    menu_items = relationship("MenuItem", back_populates="hotel")
    restaurant_orders = relationship("RestaurantOrder", back_populates="hotel")
    restaurant_tables = relationship("RestaurantTable", back_populates="hotel")

    inventory_categories = relationship("InventoryCategory", back_populates="hotel")
    inventory_units = relationship("InventoryUnit", back_populates="hotel")
    inventory_stores = relationship("InventoryStore", back_populates="hotel")
    inventory_items = relationship("InventoryItem", back_populates="hotel")
    inventory_receipts = relationship("InventoryReceipt", back_populates="hotel")
    inventory_issues = relationship("InventoryIssue", back_populates="hotel")
    inventory_consumptions = relationship("InventoryConsumption", back_populates="hotel")
    inventory_returns = relationship("InventoryReturn", back_populates="hotel")
    inventory_supplier_returns = relationship("InventorySupplierReturn", back_populates="hotel")
    inventory_transfers = relationship("InventoryTransfer", back_populates="hotel")
    inventory_adjustments = relationship("InventoryAdjustment", back_populates="hotel")
    inventory_wastages = relationship("InventoryWastage", back_populates="hotel")
    physical_stock_counts = relationship("PhysicalStockCount", back_populates="hotel")
    stock_transactions = relationship("StockTransaction", back_populates="hotel")
    stock_ledger_entries = relationship("InventoryStockLedger", back_populates="hotel")

    staff_members = relationship("Staff", back_populates="hotel")
    staff_attendance_records = relationship("StaffAttendance", back_populates="hotel")
    biometric_logs = relationship("BiometricLog", back_populates="hotel")

    staff_salary_structures = relationship("StaffSalaryStructure", back_populates="hotel")
    staff_salaries = relationship("StaffSalary", back_populates="hotel")
    salary_advances = relationship("SalaryAdvance", back_populates="hotel")

    staff_leaves = relationship("StaffLeave", back_populates="hotel")
    laundry_orders = relationship("LaundryOrder", back_populates="hotel")
    minibar_charges = relationship("MinibarCharge", back_populates="hotel")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="hotel")
    maintenance_assets = relationship("MaintenanceAsset", back_populates="hotel")
    maintenance_work_orders = relationship("MaintenanceWorkOrder", back_populates="hotel")
    preventive_maintenance_plans = relationship("PreventiveMaintenancePlan", back_populates="hotel")
    technician_roster = relationship("MaintenanceTechnicianRoster", back_populates="hotel", cascade="all, delete-orphan")
    vendors = relationship("Vendor", back_populates="hotel")
    purchase_orders = relationship("PurchaseOrder", back_populates="hotel")
    expenses = relationship("Expense", back_populates="hotel")
    users = relationship("User", back_populates="hotel")
    extra_charges = relationship("ExtraCharge", back_populates="hotel")
    extra_service_catalog = relationship("ExtraServiceCatalog", back_populates="hotel")


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
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="rooms")
    assigned_staff = relationship("Staff", foreign_keys=[assigned_staff_id])
    bookings = relationship("Booking", back_populates="room")
    folio_charges = relationship("FolioCharge", back_populates="room")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="room")
    maintenance_work_orders = relationship("MaintenanceWorkOrder", back_populates="room")
    maintenance_assets = relationship("MaintenanceAsset", back_populates="room")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="room")
    housekeeping_inspections = relationship("HousekeepingInspection", back_populates="room")

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

    # Statutory Form C (FRRO) & International guest fields
    passport_expiry = Column(String, nullable=True)
    visa_number = Column(String, nullable=True)
    visa_type = Column(String, nullable=True)
    visa_expiry = Column(String, nullable=True)
    port_of_entry = Column(String, nullable=True)
    date_of_arrival = Column(String, nullable=True)
    next_destination = Column(String, nullable=True)

    # Operational VIP, Blacklist, Preferences & Corporate Affiliation
    vip_status = Column(String, default="regular", nullable=True)
    is_blacklisted = Column(Boolean, default=False, nullable=True)
    blacklist_reason = Column(String, nullable=True)
    preferences = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    gstin = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="guests")
    bookings = relationship("Booking", back_populates="guest")
    folios = relationship("Folio", back_populates="guest")
    folio_charges = relationship("FolioCharge", back_populates="guest")
    invoices = relationship("Invoice", back_populates="guest")
    payments = relationship("Payment", back_populates="guest")
    laundry_orders = relationship("LaundryOrder", back_populates="guest")
    minibar_charges = relationship("MinibarCharge", back_populates="guest")
    restaurant_orders = relationship("RestaurantOrder", back_populates="guest")
    extra_charges = relationship("ExtraCharge", back_populates="guest")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)

    reservation_code = Column(String(50), unique=True, index=True, nullable=True)

    rooms_count = Column(Integer, default=1, nullable=False)
    assigned_room_ids = Column(JSON, default=[], nullable=True)

    guest_type = Column(String(50), default="individual", nullable=False)
    company_name = Column(String(255), nullable=True)
    gstin = Column(String(50), nullable=True)
    corporate_notes = Column(Text, nullable=True)

    checkin_date = Column(DateTime, nullable=False, index=True)
    checkout_date = Column(DateTime, nullable=False, index=True)

    nights_count = Column(Integer, default=1, nullable=False)
    days_count = Column(Integer, default=2, nullable=False)
    stay_label = Column(String(100), default="2 Days / 1 Night", nullable=True)
    is_late_checkout = Column(Boolean, default=False, nullable=False)

    adults = Column(Integer, default=1, nullable=False)
    children = Column(Integer, default=0, nullable=False)

    booking_source = Column(String(50), default="walk-in", nullable=False)
    status = Column(String(50), default="confirmed", nullable=False)

    room_rate = Column(Float, nullable=False)
    discount = Column(Float, default=0.0, nullable=False)
    tax = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, nullable=False)
    advance_paid = Column(Float, default=0.0, nullable=False)
    payment_method = Column(String(50), default="cash", nullable=False)
    payment_status = Column(String(50), default="pending", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="bookings")
    guest = relationship("Guest", back_populates="bookings")
    room = relationship("Room", back_populates="bookings")
    folio = relationship("Folio", back_populates="booking", uselist=False)
    folio_charges = relationship("FolioCharge", back_populates="booking")
    invoices = relationship("Invoice", back_populates="booking")
    payments = relationship("Payment", back_populates="booking")
    laundry_orders = relationship("LaundryOrder", back_populates="booking")
    minibar_charges = relationship("MinibarCharge", back_populates="booking")
    restaurant_orders = relationship("RestaurantOrder", back_populates="booking")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="booking")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="booking")
    extra_charges = relationship("ExtraCharge", back_populates="booking", cascade="all, delete-orphan")
    co_guests = relationship("BookingGuest", back_populates="booking", cascade="all, delete-orphan")


class BookingGuest(Base):
    __tablename__ = "booking_guests"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    full_name = Column(String(255), nullable=False)
    gender = Column(String(20), nullable=True)
    age = Column(Integer, nullable=True)
    id_type = Column(String(50), nullable=True)
    id_number = Column(String(100), nullable=True)

    booking = relationship("Booking", back_populates="co_guests")


class Folio(Base):
    __tablename__ = "folios"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True, index=True)

    folio_number = Column(String(50), unique=True, index=True, nullable=True)
    status = Column(String(50), default="open", nullable=False)

    opened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="folios")
    guest = relationship("Guest", back_populates="folios")
    booking = relationship("Booking", back_populates="folio")
    charges = relationship("FolioCharge", back_populates="folio", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="folio")
    invoices = relationship("Invoice", back_populates="folio")


class FolioCharge(Base):
    __tablename__ = "folio_charges"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    folio_id = Column(Integer, ForeignKey("folios.id", ondelete="CASCADE"), nullable=False, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)

    department = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    sac_code = Column(String(50), nullable=True)

    quantity = Column(Float, default=1.0, nullable=False)
    rate = Column(Float, default=0.0, nullable=False)
    discount = Column(Float, default=0.0, nullable=False)

    taxable_amount = Column(Float, default=0.0, nullable=False)
    tax_rate = Column(Float, default=0.0, nullable=False)
    tax_type = Column(String(20), default="GST", nullable=False)
    tax_amount = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)

    charge_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(100), nullable=True)
    status = Column(String(50), default="posted", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="folio_charges")
    folio = relationship("Folio", back_populates="charges")
    guest = relationship("Guest", back_populates="folio_charges")
    booking = relationship("Booking", back_populates="folio_charges")
    room = relationship("Room", back_populates="folio_charges")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    folio_id = Column(Integer, ForeignKey("folios.id"), nullable=True, index=True)

    invoice_number = Column(String, unique=True, index=True, nullable=False)
    reservation_code = Column(String(50), nullable=True, index=True)

    room_charges = Column(Float, default=0)
    restaurant_charges = Column(Float, default=0)
    laundry_charges = Column(Float, default=0)
    minibar_charges = Column(Float, default=0)
    extra_charges = Column(Float, default=0)

    discount = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    taxable_value = Column(Float, default=0.0, nullable=True)
    cgst = Column(Float, default=0.0, nullable=True)
    sgst = Column(Float, default=0.0, nullable=True)
    igst = Column(Float, default=0.0, nullable=True)

    grand_total = Column(Float, nullable=False)

    paid_amount = Column(Float, default=0)
    due_amount = Column(Float, default=0)
    refund_amount = Column(Float, default=0.0, nullable=True)

    invoice_status = Column(String(50), default="issued", nullable=True)
    payment_status = Column(String, default="pending")
    cancellation_reason = Column(String, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="invoices")
    guest = relationship("Guest", back_populates="invoices")
    booking = relationship("Booking", back_populates="invoices")
    folio = relationship("Folio", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice")
    payment_allocations = relationship("InvoicePaymentAllocation", back_populates="invoice", cascade="all, delete-orphan")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    folio_id = Column(Integer, ForeignKey("folios.id"), nullable=True, index=True)

    payment_type = Column(String(50), default="settlement", nullable=True)
    receipt_number = Column(String(50), unique=True, index=True, nullable=True)

    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)
    transaction_id = Column(String, nullable=True)
    payment_status = Column(String, default="success")
    received_by = Column(String, nullable=True)
    remarks = Column(String, nullable=True)

    customer_gstin = Column(String(50), nullable=True)
    place_of_supply = Column(String(100), nullable=True)
    is_reverse_charge = Column(Boolean, default=False, nullable=False)
    tax_rate = Column(Float, default=0.0, nullable=False)
    taxable_amount = Column(Float, default=0.0, nullable=False)
    cgst = Column(Float, default=0.0, nullable=False)
    sgst = Column(Float, default=0.0, nullable=False)
    igst = Column(Float, default=0.0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="payments")
    guest = relationship("Guest", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payments")
    booking = relationship("Booking", back_populates="payments")
    folio = relationship("Folio", back_populates="payments")
    allocations = relationship("InvoicePaymentAllocation", back_populates="payment", cascade="all, delete-orphan")


class InvoicePaymentAllocation(Base):
    __tablename__ = "invoice_payment_allocations"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    allocated_amount = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice", back_populates="payment_allocations")
    payment = relationship("Payment", back_populates="allocations")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    price = Column(Float, nullable=False)
    half_price = Column(Float, nullable=True)
    full_price = Column(Float, nullable=True)

    tax_percent = Column(Float, default=0)
    dietary_type = Column(String, default="veg", nullable=True)
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
    guest_name = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
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
    portion = Column(String, default="full", nullable=True)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    tax_percent = Column(Float, default=0)
    total = Column(Float, default=0)

    order = relationship("RestaurantOrder", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")


class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)

    table_number = Column(String(50), nullable=False)
    section = Column(String(100), nullable=True, default="Main Hall")
    capacity = Column(Integer, default=2, nullable=False)
    status = Column(String(50), default="available", nullable=False)  # available, occupied, reserved, cleaning, out-of-service
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="restaurant_tables")


# -------------------------------------------------------------
# INVENTORY MODULE ENTITIES (PHASES 2 - 9)
# -------------------------------------------------------------

class InventoryCategory(Base):
    __tablename__ = "inventory_categories"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("hotel_id", "name", name="uq_hotel_inventory_category_name"),
    )

    hotel = relationship("Hotel", back_populates="inventory_categories")
    items = relationship("InventoryItem", back_populates="category_rel")


class InventoryUnit(Base):
    __tablename__ = "inventory_units"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    code = Column(String(20), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("hotel_id", "name", name="uq_hotel_inventory_unit_name"),
        UniqueConstraint("hotel_id", "code", name="uq_hotel_inventory_unit_code"),
    )

    hotel = relationship("Hotel", back_populates="inventory_units")
    items = relationship("InventoryItem", back_populates="unit_rel")


class InventoryStore(Base):
    __tablename__ = "inventory_stores"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    store_code = Column(String(50), nullable=False)
    store_name = Column(String(100), nullable=False)
    location = Column(String(150), nullable=True)
    is_main_store = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("hotel_id", "store_code", name="uq_hotel_inventory_store_code"),
        UniqueConstraint("hotel_id", "store_name", name="uq_hotel_inventory_store_name"),
    )

    hotel = relationship("Hotel", back_populates="inventory_stores")
    location_stocks = relationship("InventoryLocationStock", back_populates="store", cascade="all, delete-orphan")
    ledger_entries = relationship("InventoryStockLedger", back_populates="store")
    receipts = relationship("InventoryReceipt", back_populates="store")
    issues = relationship("InventoryIssue", back_populates="store")
    consumptions = relationship("InventoryConsumption", back_populates="store")
    returns = relationship("InventoryReturn", back_populates="store")
    supplier_returns = relationship("InventorySupplierReturn", back_populates="store")
    outgoing_transfers = relationship("InventoryTransfer", foreign_keys="InventoryTransfer.from_store_id", back_populates="from_store")
    incoming_transfers = relationship("InventoryTransfer", foreign_keys="InventoryTransfer.to_store_id", back_populates="to_store")
    adjustments = relationship("InventoryAdjustment", back_populates="store")
    wastages = relationship("InventoryWastage", back_populates="store")
    physical_stock_counts = relationship("PhysicalStockCount", back_populates="store")


class InventoryLocationStock(Base):
    __tablename__ = "inventory_location_stocks"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="CASCADE"), nullable=False, index=True)
    current_stock = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("hotel_id", "item_id", "store_id", name="uq_hotel_item_store_stock"),
    )

    item = relationship("InventoryItem", back_populates="location_stocks")
    store = relationship("InventoryStore", back_populates="location_stocks")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    sku = Column(String, nullable=False, index=True)

    category = Column(String, nullable=True)
    unit = Column(String, nullable=False, default="Piece")

    category_id = Column(Integer, ForeignKey("inventory_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    unit_id = Column(Integer, ForeignKey("inventory_units.id", ondelete="SET NULL"), nullable=True, index=True)
    supplier_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)

    current_stock = Column(Float, default=0.0, nullable=False)
    min_stock_level = Column(Float, default=0.0, nullable=False)
    reorder_level = Column(Float, default=0.0, nullable=False)
    max_stock_level = Column(Float, nullable=True)
    opening_stock = Column(Float, default=0.0, nullable=False)

    purchase_price = Column(Float, default=0.0, nullable=False)
    average_cost = Column(Float, default=0.0, nullable=False)
    last_purchase_cost = Column(Float, default=0.0, nullable=False)
    tax_rate = Column(Float, default=0.0, nullable=False)

    purchase_unit = Column(String(50), nullable=True)
    consumption_unit = Column(String(50), nullable=True)
    conversion_factor = Column(Float, default=1.0, nullable=False)

    supplier_name = Column(String, nullable=True)
    subcategory = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_items")
    category_rel = relationship("InventoryCategory", back_populates="items")
    unit_rel = relationship("InventoryUnit", back_populates="items")
    supplier = relationship("Vendor")
    stock_transactions = relationship("StockTransaction", back_populates="item")
    ledger_entries = relationship("InventoryStockLedger", back_populates="item")
    purchase_order_items = relationship("PurchaseOrderItem", back_populates="item")
    maintenance_part_usages = relationship("MaintenancePartUsage", back_populates="inventory_item")
    location_stocks = relationship("InventoryLocationStock", back_populates="item", cascade="all, delete-orphan")
    receipt_items = relationship("InventoryReceiptItem", back_populates="item")
    issue_items = relationship("InventoryIssueItem", back_populates="item")
    consumptions = relationship("InventoryConsumption", back_populates="item")
    return_items = relationship("InventoryReturnItem", back_populates="item")
    supplier_return_items = relationship("InventorySupplierReturnItem", back_populates="item")
    transfer_items = relationship("InventoryTransferItem", back_populates="item")
    adjustments = relationship("InventoryAdjustment", back_populates="item")
    wastages = relationship("InventoryWastage", back_populates="item")
    physical_count_items = relationship("PhysicalStockCountItem", back_populates="item")


class InventoryReceipt(Base):
    __tablename__ = "inventory_receipts"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    receipt_no = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True)

    invoice_no = Column(String(100), nullable=True)
    invoice_date = Column(DateTime, nullable=True)
    receiving_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    subtotal = Column(Float, default=0.0, nullable=False)
    tax_amount = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)

    status = Column(String(50), default="received", nullable=False)
    notes = Column(Text, nullable=True)
    received_by = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_receipts")
    supplier = relationship("Vendor")
    store = relationship("InventoryStore", back_populates="receipts")
    purchase_order = relationship("PurchaseOrder")
    items = relationship("InventoryReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class InventoryReceiptItem(Base):
    __tablename__ = "inventory_receipt_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("inventory_receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity_received = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    tax_rate = Column(Float, default=0.0, nullable=False)
    tax_amount = Column(Float, default=0.0, nullable=False)
    total_cost = Column(Float, nullable=False)

    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    receipt = relationship("InventoryReceipt", back_populates="items")
    item = relationship("InventoryItem", back_populates="receipt_items")


class InventoryIssue(Base):
    __tablename__ = "inventory_issues"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_no = Column(String(50), unique=True, nullable=False, index=True)
    from_store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    department = Column(String(100), nullable=False, index=True)

    requested_by = Column(String(100), nullable=True)
    issued_by = Column(String(100), nullable=True)
    issue_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    total_value = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="issued", nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_issues")
    store = relationship("InventoryStore", back_populates="issues")
    items = relationship("InventoryIssueItem", back_populates="issue", cascade="all, delete-orphan")


class InventoryIssueItem(Base):
    __tablename__ = "inventory_issue_items"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("inventory_issues.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity_issued = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    issue = relationship("InventoryIssue", back_populates="items")
    item = relationship("InventoryItem", back_populates="issue_items")


class InventoryConsumption(Base):
    __tablename__ = "inventory_consumptions"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    consumption_no = Column(String(50), unique=True, nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    department = Column(String(100), nullable=False, index=True)

    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)

    reason = Column(String(255), nullable=True)
    reference = Column(String(100), nullable=True)
    consumed_by = Column(String(100), nullable=True)
    consumption_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_consumptions")
    store = relationship("InventoryStore", back_populates="consumptions")
    item = relationship("InventoryItem", back_populates="consumptions")


class InventoryReturn(Base):
    __tablename__ = "inventory_returns"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    return_no = Column(String(50), unique=True, nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    department = Column(String(100), nullable=False, index=True)

    returned_by = Column(String(100), nullable=True)
    received_by = Column(String(100), nullable=True)
    return_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    total_value = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="returned", nullable=False)
    reason = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_returns")
    store = relationship("InventoryStore", back_populates="returns")
    items = relationship("InventoryReturnItem", back_populates="return_header", cascade="all, delete-orphan")


class InventoryReturnItem(Base):
    __tablename__ = "inventory_return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("inventory_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity_returned = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    return_header = relationship("InventoryReturn", back_populates="items")
    item = relationship("InventoryItem", back_populates="return_items")


class InventorySupplierReturn(Base):
    __tablename__ = "inventory_supplier_returns"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_return_no = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    receipt_id = Column(Integer, ForeignKey("inventory_receipts.id", ondelete="SET NULL"), nullable=True, index=True)

    return_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="returned", nullable=False)
    reason = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    returned_by = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_supplier_returns")
    supplier = relationship("Vendor")
    store = relationship("InventoryStore", back_populates="supplier_returns")
    receipt = relationship("InventoryReceipt")
    items = relationship("InventorySupplierReturnItem", back_populates="supplier_return_header", cascade="all, delete-orphan")


class InventorySupplierReturnItem(Base):
    __tablename__ = "inventory_supplier_return_items"

    id = Column(Integer, primary_key=True, index=True)
    supplier_return_id = Column(Integer, ForeignKey("inventory_supplier_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity_returned = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    supplier_return_header = relationship("InventorySupplierReturn", back_populates="items")
    item = relationship("InventoryItem", back_populates="supplier_return_items")


class InventoryTransfer(Base):
    __tablename__ = "inventory_transfers"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    transfer_no = Column(String(50), unique=True, nullable=False, index=True)
    from_store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    to_store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)

    transfer_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_value = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="transferred", nullable=False)
    notes = Column(Text, nullable=True)
    transferred_by = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_transfers")
    from_store = relationship("InventoryStore", foreign_keys=[from_store_id], back_populates="outgoing_transfers")
    to_store = relationship("InventoryStore", foreign_keys=[to_store_id], back_populates="incoming_transfers")
    items = relationship("InventoryTransferItem", back_populates="transfer", cascade="all, delete-orphan")


class InventoryTransferItem(Base):
    __tablename__ = "inventory_transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("inventory_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity_transferred = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transfer = relationship("InventoryTransfer", back_populates="items")
    item = relationship("InventoryItem", back_populates="transfer_items")


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    adjustment_no = Column(String(50), unique=True, nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    adjustment_type = Column(String(20), nullable=False)
    old_quantity = Column(Float, nullable=False)
    adjustment_quantity = Column(Float, nullable=False)
    new_quantity = Column(Float, nullable=False)

    unit_cost = Column(Float, nullable=False)
    total_value = Column(Float, nullable=False)
    reason = Column(String(255), nullable=False)
    adjusted_by = Column(String(100), nullable=True)
    adjustment_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_adjustments")
    store = relationship("InventoryStore", back_populates="adjustments")
    item = relationship("InventoryItem", back_populates="adjustments")


class InventoryWastage(Base):
    __tablename__ = "inventory_wastages"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    wastage_no = Column(String(50), unique=True, nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    waste_type = Column(String(50), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)

    department = Column(String(100), nullable=True)
    reason = Column(String(255), nullable=False)
    reported_by = Column(String(100), nullable=True)
    wastage_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="inventory_wastages")
    store = relationship("InventoryStore", back_populates="wastages")
    item = relationship("InventoryItem", back_populates="wastages")


class PhysicalStockCount(Base):
    """
    Phase 9: Physical Stock Count Header
    """
    __tablename__ = "physical_stock_counts"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    count_no = Column(String(50), unique=True, nullable=False, index=True)  # CNT-2026-00001
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="RESTRICT"), nullable=False, index=True)

    status = Column(String(50), default="draft", nullable=False)  # draft, under_review, finalized, cancelled
    count_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    counted_by = Column(String(100), nullable=True)
    approved_by = Column(String(100), nullable=True)
    finalized_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="physical_stock_counts")
    store = relationship("InventoryStore", back_populates="physical_stock_counts")
    items = relationship("PhysicalStockCountItem", back_populates="count_header", cascade="all, delete-orphan")


class PhysicalStockCountItem(Base):
    """
    Phase 9: Physical Stock Count Line Item
    """
    __tablename__ = "physical_stock_count_items"

    id = Column(Integer, primary_key=True, index=True)
    physical_stock_count_id = Column(Integer, ForeignKey("physical_stock_counts.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True)

    system_stock = Column(Float, nullable=False)
    physical_stock = Column(Float, nullable=False)
    variance = Column(Float, nullable=False)  # physical_stock - system_stock
    notes = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    count_header = relationship("PhysicalStockCount", back_populates="items")
    item = relationship("InventoryItem", back_populates="physical_count_items")


class InventoryStockLedger(Base):
    __tablename__ = "inventory_stock_ledger"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("inventory_stores.id", ondelete="CASCADE"), nullable=False, index=True)

    movement_type = Column(String(50), nullable=False, index=True)
    reference_no = Column(String(100), nullable=True, index=True)
    department = Column(String(100), nullable=True, index=True)
    supplier_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)

    quantity_in = Column(Float, default=0.0, nullable=False)
    quantity_out = Column(Float, default=0.0, nullable=False)
    balance_after = Column(Float, nullable=False)

    unit_cost = Column(Float, default=0.0, nullable=False)
    total_value = Column(Float, default=0.0, nullable=False)

    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    hotel = relationship("Hotel", back_populates="stock_ledger_entries")
    item = relationship("InventoryItem", back_populates="ledger_entries")
    store = relationship("InventoryStore", back_populates="ledger_entries")
    supplier = relationship("Vendor")


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


# -------------------------------------------------------------
# MAINTENANCE MODULE ENTITIES
# -------------------------------------------------------------

class MaintenanceTechnicianRoster(Base):
    __tablename__ = "maintenance_technician_roster"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("hotel_id", "staff_id", name="uq_hotel_staff_roster"),
    )

    hotel = relationship("Hotel", back_populates="technician_roster")
    staff = relationship("Staff")


class MaintenanceAsset(Base):
    __tablename__ = "maintenance_assets"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True, index=True)

    asset_code = Column(String(50), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    location = Column(String(100), nullable=True)

    serial_number = Column(String(100), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    installation_date = Column(DateTime, nullable=True)
    warranty_expiry_date = Column(DateTime, nullable=True)

    status = Column(String(50), default="operational", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="maintenance_assets")
    room = relationship("Room", back_populates="maintenance_assets")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="asset")
    work_orders = relationship("MaintenanceWorkOrder", back_populates="asset")
    preventive_plans = relationship("PreventiveMaintenancePlan", back_populates="asset")


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True, index=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True, index=True)

    asset_id = Column(Integer, ForeignKey("maintenance_assets.id"), nullable=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    category = Column(String(50), default="General", nullable=False)
    source = Column(String(50), default="Direct", nullable=False)
    blocks_room = Column(Boolean, default=False, nullable=False)

    issue_title = Column(String, nullable=False)
    issue_description = Column(String, nullable=True)
    priority = Column(String, default="normal")
    status = Column(String, default="open")

    reported_by = Column(String, nullable=True)
    assigned_by = Column(String, nullable=True)

    estimated_cost = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)

    start_date = Column(DateTime, nullable=True)
    completed_date = Column(DateTime, nullable=True)

    remarks = Column(String, nullable=True)
    converted_to_task_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="maintenance_requests")
    room = relationship("Room", back_populates="maintenance_requests")
    assigned_staff = relationship("Staff", back_populates="maintenance_requests")
    asset = relationship("MaintenanceAsset", back_populates="maintenance_requests")
    booking = relationship("Booking", back_populates="maintenance_requests")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    completed_by_user = relationship("User", foreign_keys=[completed_by_user_id])
    work_orders = relationship("MaintenanceWorkOrder", back_populates="request", cascade="all, delete-orphan")

    @property
    def room_number(self) -> Optional[str]:
        return self.room.room_number if self.room else None

    @property
    def guest_name(self) -> Optional[str]:
        if self.booking and self.booking.guest:
            return self.booking.guest.full_name
        return None


class MaintenanceWorkOrder(Base):
    __tablename__ = "maintenance_work_orders"

    id = Column(Integer, primary_key=True, index=True)
    work_order_number = Column(String(50), unique=True, index=True, nullable=False)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    maintenance_request_id = Column(Integer, ForeignKey("maintenance_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    asset_id = Column(Integer, ForeignKey("maintenance_assets.id"), nullable=True)
    technician_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    status = Column(String(50), default="assigned", nullable=False)
    priority = Column(String(50), default="normal", nullable=False)

    diagnosis = Column(Text, nullable=True)
    work_performed = Column(Text, nullable=True)
    labor_hours = Column(Float, default=0.0)
    labor_cost = Column(Float, default=0.0)
    parts_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="maintenance_work_orders")
    request = relationship("MaintenanceRequest", back_populates="work_orders")
    room = relationship("Room", back_populates="maintenance_work_orders")
    asset = relationship("MaintenanceAsset", back_populates="work_orders")
    technician = relationship("Staff")
    parts_used = relationship("MaintenancePartUsage", back_populates="work_order", cascade="all, delete-orphan")


class MaintenancePartUsage(Base):
    __tablename__ = "maintenance_part_usages"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    work_order_id = Column(Integer, ForeignKey("maintenance_work_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False, index=True)

    quantity_used = Column(Float, nullable=False)
    unit_cost = Column(Float, default=0.0, nullable=False)
    total_cost = Column(Float, default=0.0, nullable=False)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    work_order = relationship("MaintenanceWorkOrder", back_populates="parts_used")
    inventory_item = relationship("InventoryItem", back_populates="maintenance_part_usages")


class PreventiveMaintenancePlan(Base):
    __tablename__ = "preventive_maintenance_plans"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("maintenance_assets.id"), nullable=True, index=True)

    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)
    location = Column(String(100), nullable=True)

    frequency = Column(String(50), nullable=False)
    interval_days = Column(Integer, default=30, nullable=False)

    start_date = Column(DateTime, nullable=False)
    last_performed_date = Column(DateTime, nullable=True)
    next_due_date = Column(DateTime, nullable=False, index=True)

    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    checklist = Column(JSON, default=[], nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="preventive_maintenance_plans")
    asset = relationship("MaintenanceAsset", back_populates="preventive_plans")
    assigned_staff = relationship("Staff")


# -------------------------------------------------------------
# GENERIC DEPARTMENT TASKS (WORKFLOW ENGINE)
# -------------------------------------------------------------

class DepartmentTask(Base):
    __tablename__ = "department_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_number = Column(String(50), unique=True, index=True, nullable=False)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    department = Column(String(50), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="General", nullable=False)
    priority = Column(String(20), default="normal", nullable=False)
    status = Column(String(30), default="pending", nullable=False)

    location = Column(String(150), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    asset_id = Column(Integer, nullable=True)

    assigned_to_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    due_date = Column(DateTime, nullable=True)
    estimated_hours = Column(Float, default=1.0)
    actual_hours = Column(Float, default=0.0)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    completion_notes = Column(Text, nullable=True)

    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String(100), nullable=True)

    source_ticket_id = Column(Integer, nullable=True)
    meta_data = Column(JSON, default=dict, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel")
    assigned_staff = relationship("Staff", foreign_keys=[assigned_to_staff_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    room = relationship("Room", foreign_keys=[room_id])


class DepartmentTicket(Base):
    __tablename__ = "department_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, index=True, nullable=False)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    department = Column(String(50), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="General", nullable=False)
    priority = Column(String(20), default="normal", nullable=False)
    status = Column(String(30), default="open", nullable=False)  # open, converted_to_task, resolved, closed, cancelled

    source = Column(String(50), default="direct", nullable=False)  # front_desk, housekeeping, guest, direct, inspection
    location = Column(String(150), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    reported_by = Column(String(150), nullable=True)
    contact_phone = Column(String(50), nullable=True)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    converted_to_task_id = Column(Integer, ForeignKey("department_tasks.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)
    converted_by = Column(String(100), nullable=True)

    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    meta_data = Column(JSON, default=dict, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel")
    room = relationship("Room", foreign_keys=[room_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    converted_task = relationship("DepartmentTask", foreign_keys=[converted_to_task_id])


class DepartmentAuditLog(Base):
    __tablename__ = "department_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    department = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # "task", "ticket", "request"
    entity_id = Column(Integer, nullable=False, index=True)
    entity_identifier = Column(String(100), nullable=True)  # e.g. "TSK-MAIN-0012", "TCK-MAIN-0004"

    action = Column(String(50), nullable=False, index=True)  # created, assigned, started, completed, verified, rework, converted, deleted
    performed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    performed_by_name = Column(String(150), nullable=False)
    details = Column(JSON, default=dict, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    hotel = relationship("Hotel")
    performed_by = relationship("User", foreign_keys=[performed_by_user_id])


# -------------------------------------------------------------
# HOUSEKEEPING & HR ENTITIES
# -------------------------------------------------------------

class HousekeepingTask(Base):
    __tablename__ = "housekeeping_tasks"

    id = Column(Integer, primary_key=True, index=True)

    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    task_type = Column(String, default="checkout-cleaning", nullable=False)
    priority = Column(String, default="normal", nullable=False)
    status = Column(String, default="pending", nullable=False)

    assigned_to = Column(String, nullable=True)
    due_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    created_by = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)
    started_by = Column(String, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    completed_by = Column(String, nullable=True)
    checklist = Column(JSON, default=list, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="housekeeping_tasks")
    room = relationship("Room", back_populates="housekeeping_tasks")
    booking = relationship("Booking", back_populates="housekeeping_tasks")
    assigned_staff = relationship("Staff", back_populates="housekeeping_tasks")
    inspections = relationship("HousekeepingInspection", back_populates="task", cascade="all, delete-orphan")
    history = relationship("HousekeepingTaskHistory", back_populates="task", cascade="all, delete-orphan")


class HousekeepingInspection(Base):
    __tablename__ = "housekeeping_inspections"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("housekeeping_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    status = Column(String(50), default="passed", nullable=False)
    checklist = Column(JSON, default={}, nullable=False)
    notes = Column(Text, nullable=True)
    inspected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="housekeeping_inspections")
    task = relationship("HousekeepingTask", back_populates="inspections")
    room = relationship("Room", back_populates="housekeeping_inspections")
    inspector = relationship("User")


class HousekeepingTaskHistory(Base):
    __tablename__ = "housekeeping_task_history"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("housekeeping_tasks.id", ondelete="CASCADE"), nullable=False, index=True)

    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel", back_populates="housekeeping_history")
    task = relationship("HousekeepingTask", back_populates="history")


class Checklist(Base):
    """A reusable checklist template (e.g. a housekeeping deep-clean or inspection checklist).

    HODs/admins build these once and the items are the points an attendant or inspector ticks off.
    """

    __tablename__ = "checklists"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)

    name = Column(String(150), nullable=False)
    department = Column(String(80), nullable=False, default="housekeeping")
    description = Column(Text, nullable=True)
    # Ordered list of checklist points, each stored as {"text": str, "required": bool}
    items = Column(JSON, default=[], nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_by = Column(String(120), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hotel = relationship("Hotel")
    creator = relationship("User")


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

    aadhaar_no = Column(String, nullable=True)
    pan_no = Column(String, nullable=True)
    dob = Column(String, nullable=True)
    father_name = Column(String, nullable=True)
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    employee_type = Column(String, default="permanent")
    role_level = Column(String(50), default="employee", nullable=False)

    working_hours = Column(Integer, default=8)

    bank_account_no = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)

    legacy_leave_balance = Column(Float, default=0)
    leave_tracking_start_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="staff_members")
    attendance_records = relationship("StaffAttendance", back_populates="staff")
    biometric_logs = relationship("BiometricLog", back_populates="staff")

    salary_structure = relationship("StaffSalaryStructure", back_populates="staff", uselist=False)
    salary_records = relationship("StaffSalary", back_populates="staff")
    salary_advances = relationship("SalaryAdvance", back_populates="staff")

    leave_records = relationship("StaffLeave", back_populates="staff")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="assigned_staff")
    expenses = relationship("Expense", back_populates="staff")
    housekeeping_tasks = relationship("HousekeepingTask", back_populates="assigned_staff")
    user = relationship("User", back_populates="staff", uselist=False)


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


class StaffSalaryStructure(Base):
    __tablename__ = "staff_salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), unique=True, nullable=False)

    basic_salary = Column(Float, default=0)
    hra = Column(Float, default=0)
    special_allowance = Column(Float, default=0)
    other_allowance = Column(Float, default=0)

    epf_deduction = Column(Float, default=0)
    esi_deduction = Column(Float, default=0)

    gross_salary = Column(Float, default=0)
    net_salary = Column(Float, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="staff_salary_structures")
    staff = relationship("Staff", back_populates="salary_structure")


class StaffSalary(Base):
    __tablename__ = "staff_salaries"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)

    salary_month = Column(String, nullable=False)
    status = Column(String, default="Review")

    basic_salary = Column(Float, default=0)
    total_allowances = Column(Float, default=0)
    gross_salary = Column(Float, default=0)

    total_deductions = Column(Float, default=0)
    net_salary = Column(Float, nullable=False)

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
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)

    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, nullable=True)

    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)

    role = Column(String, nullable=False)
    role_level = Column(String(50), default="employee", nullable=False)
    is_active = Column(Boolean, default=True)
    allowed_modules = Column(JSON, default=list, nullable=True)
    must_change_password = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="users")
    staff = relationship("Staff", back_populates="user")


class ExtraCharge(Base):
    __tablename__ = "extra_charges"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)

    charge_name = Column(String, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    rate = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)

    description = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="extra_charges")
    booking = relationship("Booking", back_populates="extra_charges")
    guest = relationship("Guest", back_populates="extra_charges")
    room = relationship("Room", back_populates="extra_charges")


class ExtraServiceCatalog(Base):
    __tablename__ = "extra_service_catalog"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    default_price = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    hotel = relationship("Hotel", back_populates="extra_service_catalog")


class SystemAnnouncement(Base):
    __tablename__ = "system_announcements"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    message = Column(String, nullable=False)

    alert_type = Column(String, default="info")
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)