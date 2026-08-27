from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine

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
    biometric,          # <-- NEW
    attendance_engine   # <-- NEW
)

# Bind database models
Base.metadata.create_all(bind=engine)

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
app.include_router(biometric.router)          # <-- NEW
app.include_router(attendance_engine.router)  # <-- NEW