from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app import models  # Registers ExtraServiceCatalog & all tables in Base.metadata

# Bind database models
Base.metadata.create_all(bind=engine)

def _ensure_guest_columns():
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            res = conn.execute(text("PRAGMA table_info(guests)")).fetchall()
            existing_cols = {row[1] for row in res}
            new_cols = [
                ("passport_expiry", "VARCHAR"),
                ("visa_number", "VARCHAR"),
                ("visa_type", "VARCHAR"),
                ("visa_expiry", "VARCHAR"),
                ("port_of_entry", "VARCHAR"),
                ("date_of_arrival", "VARCHAR"),
                ("next_destination", "VARCHAR"),
                ("vip_status", "VARCHAR"),
                ("is_blacklisted", "BOOLEAN"),
                ("blacklist_reason", "VARCHAR"),
                ("preferences", "VARCHAR"),
                ("company_name", "VARCHAR"),
                ("gstin", "VARCHAR"),
            ]
            for col_name, col_type in new_cols:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE guests ADD COLUMN {col_name} {col_type}"))
    except Exception:
        pass

_ensure_guest_columns()

def _ensure_invoice_columns():
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            res = conn.execute(text("PRAGMA table_info(invoices)")).fetchall()
            existing_cols = {row[1] for row in res}
            new_cols = [
                ("cancellation_reason", "VARCHAR"),
                ("cancelled_at", "DATETIME"),
                ("cancelled_by", "VARCHAR"),
            ]
            for col_name, col_type in new_cols:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE invoices ADD COLUMN {col_name} {col_type}"))
    except Exception:
        pass

_ensure_invoice_columns()

def _ensure_role_columns():
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            # staff table
            res = conn.execute(text("PRAGMA table_info(staff)")).fetchall()
            existing_cols = {row[1] for row in res}
            if "role_level" not in existing_cols:
                conn.execute(text("ALTER TABLE staff ADD COLUMN role_level VARCHAR DEFAULT 'employee'"))
            if "emergency_contact_name" not in existing_cols:
                conn.execute(text("ALTER TABLE staff ADD COLUMN emergency_contact_name VARCHAR"))
            if "emergency_contact_phone" not in existing_cols:
                conn.execute(text("ALTER TABLE staff ADD COLUMN emergency_contact_phone VARCHAR"))

            # users table
            res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            existing_cols = {row[1] for row in res}
            if "role_level" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN role_level VARCHAR DEFAULT 'employee'"))
            if "must_change_password" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0"))
    except Exception as e:
        print("Role columns ensure error:", e)

_ensure_role_columns()

def _ensure_task_columns():
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            # department_tasks
            res = conn.execute(text("PRAGMA table_info(department_tasks)")).fetchall()
            existing_cols = {row[1] for row in res}
            if existing_cols:
                if "verified_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE department_tasks ADD COLUMN verified_at DATETIME"))
                if "verified_by" not in existing_cols:
                    conn.execute(text("ALTER TABLE department_tasks ADD COLUMN verified_by VARCHAR(100)"))
                if "source_ticket_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE department_tasks ADD COLUMN source_ticket_id INTEGER"))

            # maintenance_requests
            res_req = conn.execute(text("PRAGMA table_info(maintenance_requests)")).fetchall()
            existing_req_cols = {row[1] for row in res_req}
            if existing_req_cols and "converted_to_task_id" not in existing_req_cols:
                conn.execute(text("ALTER TABLE maintenance_requests ADD COLUMN converted_to_task_id INTEGER"))
    except Exception as e:
        print("Task columns ensure error:", e)

_ensure_task_columns()

def _ensure_restaurant_columns():
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            # menu_items
            res = conn.execute(text("PRAGMA table_info(menu_items)")).fetchall()
            existing_cols = {row[1] for row in res}
            if "description" not in existing_cols:
                conn.execute(text("ALTER TABLE menu_items ADD COLUMN description TEXT"))
            if "dietary_type" not in existing_cols:
                conn.execute(text("ALTER TABLE menu_items ADD COLUMN dietary_type VARCHAR DEFAULT 'veg'"))

            # restaurant_orders
            res = conn.execute(text("PRAGMA table_info(restaurant_orders)")).fetchall()
            existing_cols = {row[1] for row in res}
            for col_name, col_type in [("guest_name", "VARCHAR"), ("notes", "TEXT")]:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE restaurant_orders ADD COLUMN {col_name} {col_type}"))

            # restaurant_order_items
            res = conn.execute(text("PRAGMA table_info(restaurant_order_items)")).fetchall()
            existing_cols = {row[1] for row in res}
            if "portion" not in existing_cols:
                conn.execute(text("ALTER TABLE restaurant_order_items ADD COLUMN portion VARCHAR DEFAULT 'full'"))
    except Exception:
        pass

_ensure_restaurant_columns()
 
def _ensure_user_columns():
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            existing_cols = {row[1] for row in res}
            if "staff_id" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN staff_id INTEGER"))
            if "allowed_modules" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN allowed_modules JSON"))
    except Exception:
        pass

_ensure_user_columns()

# Import all modular routers
from app.routers import (
    hotels,
    rooms,
    guests,
    bookings,
    housekeeping,
    invoices,
    payments,
    restaurant,
    inventory,
    maintenance,
    work_orders,
    preventive_maintenance,
    assets,
    staff,
    accounts,
    laundry,
    minibar,
    procurement,
    expenses,
    extra_charges,
    reports,
    users,
    system,
    announcements,
    payroll,
    biometric,
    attendance_engine,
    tasks,
    tickets,
)

# Initialize FastAPI application
app = FastAPI(
    title="Hotel ERP Backend",
    description="Backend API for Hotel Management ERP System",
    version="1.0.0",
)

# Enable CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# ROOT / HEALTH ENDPOINTS
# -----------------------------

@app.get("/", tags=["Health"])
def home():
    return {
        "message": "Hotel ERP Backend is running successfully"
    }

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok"
    }

# -----------------------------
# REGISTER ALL API ROUTERS
# -----------------------------

app.include_router(system.router)
app.include_router(users.router)
app.include_router(hotels.router)
app.include_router(rooms.router)
app.include_router(guests.router)
app.include_router(bookings.router)
app.include_router(housekeeping.router)
app.include_router(invoices.router)
app.include_router(payments.router)
app.include_router(restaurant.router)
app.include_router(inventory.router)
app.include_router(maintenance.router)
app.include_router(work_orders.router)
app.include_router(preventive_maintenance.router)
app.include_router(assets.router)
app.include_router(staff.router)
app.include_router(accounts.router)
app.include_router(laundry.router)
app.include_router(minibar.router)
app.include_router(procurement.router)
app.include_router(expenses.router)
app.include_router(extra_charges.router)
app.include_router(reports.router)
app.include_router(announcements.router)  
app.include_router(payroll.router)
app.include_router(biometric.router)
app.include_router(attendance_engine.router)
app.include_router(tasks.router)
app.include_router(tickets.router)