# File: backend/app/routers/system.py

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app import models, schemas
from app.dependencies import (
    hash_password,
    require_super_admin,
    require_hotel_admin_or_manager,
    require_accountant,
    require_front_desk,
    require_inventory_user
)

router = APIRouter(
    tags=["System & Admin Utilities"]
)

# -----------------------------
# SETUP SUPER ADMIN API
# -----------------------------

@router.post("/setup/create-super-admin", response_model=schemas.UserResponse)
def setup_create_super_admin(
    user: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    existing_super_admin = db.query(models.User).filter(
        models.User.role == "super-admin"
    ).first()

    if existing_super_admin:
        raise HTTPException(status_code=400, detail="Super admin already exists")

    if user.role != "super-admin":
        raise HTTPException(status_code=400, detail="Only super-admin role is allowed from this setup API")

    new_user = models.User(
        hotel_id=None,
        username=user.username,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        password_hash=hash_password(user.password),
        role="super-admin",
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# -----------------------------
# HOTEL GO-LIVE SETTINGS API
# -----------------------------

class GoLiveUpdate(BaseModel):
    go_live_date: str # Expected format: YYYY-MM-DD

@router.put("/system/hotels/{hotel_id}/go-live")
@router.put("/system/hotels/{hotel_id}/go-live/")
def update_hotel_go_live_date(
    hotel_id: int,
    payload: GoLiveUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin)
):
    """Secure endpoint for Super Admins to set the historical tracking cut-off date"""
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    try:
        parsed_date = datetime.strptime(payload.go_live_date, "%Y-%m-%d")
        hotel.go_live_date = parsed_date
        db.commit()
        return {
            "message": "Go-Live Date successfully updated!", 
            "go_live_date": payload.go_live_date
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")

@router.get("/system/hotels/{hotel_id}/go-live")
@router.get("/system/hotels/{hotel_id}/go-live/")
def get_hotel_go_live_date(
    hotel_id: int,
    db: Session = Depends(get_db)
):
    """Publicly accessible endpoint for frontend to check the active go-live date"""
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    go_live_str = hotel.go_live_date.strftime("%Y-%m-%d") if hotel.go_live_date else None
    return {"go_live_date": go_live_str}


# -----------------------------
# HOTEL UPDATE API
# -----------------------------

class HotelUpdatePayload(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    tax_number: Optional[str] = None

@router.put("/hotels/{hotel_id}")
@router.put("/hotels/{hotel_id}/")
def update_hotel_info(
    hotel_id: int,
    payload: HotelUpdatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin)
):
    """Allows Super Admin to update hotel information from the directory"""
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(hotel, key, value)
        
    db.commit()
    db.refresh(hotel)
    return {"message": "Hotel updated successfully", "hotel": hotel}


# -----------------------------
# SYSTEM MODULES API
# -----------------------------

# Master list of available modules in the ERP
SYSTEM_MODULES = [
    { "id": "front-desk", "name": "Front Desk & Bookings", "description": "Manage rooms, check-in/out, guests, and folios." },
    { "id": "rooms", "name": "Room Management", "description": "Status tracking, housekeeping updates, and room types." },
    { "id": "restaurant", "name": "Restaurant & POS", "description": "Table management, kitchen display, orders, and billing." },
    { "id": "housekeeping", "name": "Housekeeping & Maintenance", "description": "Staff task allocation, cleaning logs, and maintenance logs." },
    { "id": "inventory", "name": "Inventory & Procurement", "description": "Stock items, supply chain tracking, and vendor purchase." },
    { "id": "laundry", "name": "Laundry Services", "description": "Guest and in-house laundry tracking and charges." },
    { "id": "minibar", "name": "Minibar & Extras", "description": "Minibar consumption billing and extra charge postings." },
    { "id": "accounts", "name": "Accounts & Financial Reports", "description": "Revenue reports, daily audit, and expense summaries." },
    { "id": "staff", "name": "Staff / HR", "description": "Employee management, attendance, and payroll." },
    { "id": "reports", "name": "Reports & Analytics", "description": "Comprehensive hotel performance and audit reports." }
]

@router.get("/modules")
def get_all_system_modules():
    """
    Returns the list of all available ERP modules that can be assigned to a hotel.
    """
    return {"modules": SYSTEM_MODULES}


# -----------------------------
# SYSTEM HEALTH & STATS APIs
# -----------------------------

@router.get("/system/health")
def get_system_health(db: Session = Depends(get_db)):
    database_status = "connected"
    try:
        db.query(models.Hotel).first()
    except Exception:
        database_status = "disconnected"

    return {
        "status": "ok" if database_status == "connected" else "error",
        "app_name": "Hotel ERP Backend",
        "version": "1.0.0",
        "database": database_status,
        "timestamp": datetime.utcnow()
    }


@router.get("/system/stats")
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin)
):
    total_hotels = db.query(models.Hotel).count()
    total_users = db.query(models.User).count()
    active_users = db.query(models.User).filter(models.User.is_active == True).count()
    inactive_users = db.query(models.User).filter(models.User.is_active == False).count()

    total_rooms = db.query(models.Room).count()
    available_rooms = db.query(models.Room).filter(models.Room.status == "available").count()
    occupied_rooms = db.query(models.Room).filter(models.Room.status == "occupied").count()
    dirty_rooms = db.query(models.Room).filter(models.Room.status == "dirty").count()
    maintenance_rooms = db.query(models.Room).filter(models.Room.status == "maintenance").count()

    total_guests = db.query(models.Guest).count()
    total_bookings = db.query(models.Booking).count()
    confirmed_bookings = db.query(models.Booking).filter(models.Booking.status == "confirmed").count()
    checked_in_bookings = db.query(models.Booking).filter(models.Booking.status == "checked-in").count()
    checked_out_bookings = db.query(models.Booking).filter(models.Booking.status == "checked-out").count()

    total_invoices = db.query(models.Invoice).count()
    pending_invoices = db.query(models.Invoice).filter(models.Invoice.payment_status == "pending").count()
    partial_invoices = db.query(models.Invoice).filter(models.Invoice.payment_status == "partial").count()
    paid_invoices = db.query(models.Invoice).filter(models.Invoice.payment_status == "paid").count()

    total_invoice_amount = db.query(func.coalesce(func.sum(models.Invoice.grand_total), 0)).scalar()
    total_paid_amount = db.query(func.coalesce(func.sum(models.Invoice.paid_amount), 0)).scalar()
    total_due_amount = db.query(func.coalesce(func.sum(models.Invoice.due_amount), 0)).scalar()

    total_payments = db.query(models.Payment).count()
    total_payment_received = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).scalar()

    total_expenses = db.query(models.Expense).count()
    total_expense_amount = db.query(func.coalesce(func.sum(models.Expense.amount), 0)).scalar()
    paid_expense_amount = db.query(func.coalesce(func.sum(models.Expense.amount), 0)).filter(models.Expense.payment_status == "paid").scalar()

    total_inventory_items = db.query(models.InventoryItem).count()
    low_stock_items = db.query(models.InventoryItem).filter(models.InventoryItem.current_stock <= models.InventoryItem.min_stock_level).count()

    total_stock_transactions = db.query(models.StockTransaction).count()

    total_maintenance_requests = db.query(models.MaintenanceRequest).count()
    open_maintenance_requests = db.query(models.MaintenanceRequest).filter(models.MaintenanceRequest.status.in_(["open", "assigned", "in-progress"])).count()

    total_staff = db.query(models.Staff).count()
    total_staff_attendance_records = db.query(models.StaffAttendance).count()
    total_staff_salary_records = db.query(models.StaffSalary).count()
    total_staff_leave_records = db.query(models.StaffLeave).count()

    total_restaurant_menu_items = db.query(models.MenuItem).count()
    total_restaurant_orders = db.query(models.RestaurantOrder).count()

    total_laundry_orders = db.query(models.LaundryOrder).count()
    total_minibar_charges = db.query(models.MinibarCharge).count()

    total_vendors = db.query(models.Vendor).count()
    total_purchase_orders = db.query(models.PurchaseOrder).count()

    net_profit_loss = total_paid_amount - paid_expense_amount

    return {
        "system": {
            "total_hotels": total_hotels,
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users
        },
        "rooms": {
            "total_rooms": total_rooms,
            "available_rooms": available_rooms,
            "occupied_rooms": occupied_rooms,
            "dirty_rooms": dirty_rooms,
            "maintenance_rooms": maintenance_rooms
        },
        "guests_bookings": {
            "total_guests": total_guests,
            "total_bookings": total_bookings,
            "confirmed_bookings": confirmed_bookings,
            "checked_in_bookings": checked_in_bookings,
            "checked_out_bookings": checked_out_bookings
        },
        "finance": {
            "total_invoices": total_invoices,
            "pending_invoices": pending_invoices,
            "partial_invoices": partial_invoices,
            "paid_invoices": paid_invoices,
            "total_invoice_amount": total_invoice_amount,
            "total_paid_amount": total_paid_amount,
            "total_due_amount": total_due_amount,
            "total_payments": total_payments,
            "total_payment_received": total_payment_received,
            "total_expenses": total_expenses,
            "total_expense_amount": total_expense_amount,
            "paid_expense_amount": paid_expense_amount,
            "net_profit_loss": net_profit_loss
        },
        "inventory": {
            "total_inventory_items": total_inventory_items,
            "low_stock_items": low_stock_items,
            "total_stock_transactions": total_stock_transactions
        },
        "maintenance": {
            "total_maintenance_requests": total_maintenance_requests,
            "open_maintenance_requests": open_maintenance_requests
        },
        "staff_hr": {
            "total_staff": total_staff,
            "total_staff_attendance_records": total_staff_attendance_records,
            "total_staff_salary_records": total_staff_salary_records,
            "total_staff_leave_records": total_staff_leave_records
        },
        "restaurant_pos": {
            "total_restaurant_menu_items": total_restaurant_menu_items,
            "total_restaurant_orders": total_restaurant_orders
        },
        "guest_services": {
            "total_laundry_orders": total_laundry_orders,
            "total_minibar_charges": total_minibar_charges
        },
        "procurement": {
            "total_vendors": total_vendors,
            "total_purchase_orders": total_purchase_orders
        },
        "generated_at": datetime.utcnow()
    }


# -----------------------------
# ROLE PERMISSION TEST APIs
# -----------------------------

@router.get("/protected/super-admin")
def protected_super_admin(current_user: models.User = Depends(require_super_admin)):
    return {
        "message": "Super admin access granted",
        "user_id": current_user.id,
        "role": current_user.role
    }


@router.get("/protected/hotel-admin-manager")
def protected_hotel_admin_manager(current_user: models.User = Depends(require_hotel_admin_or_manager)):
    return {
        "message": "Hotel admin / manager access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role
    }


@router.get("/protected/accountant")
def protected_accountant(current_user: models.User = Depends(require_accountant)):
    return {
        "message": "Accountant access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role
    }


@router.get("/protected/front-desk")
def protected_front_desk(current_user: models.User = Depends(require_front_desk)):
    return {
        "message": "Front desk access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role
    }


@router.get("/protected/inventory")
def protected_inventory(current_user: models.User = Depends(require_inventory_user)):
    return {
        "message": "Inventory access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role
    }