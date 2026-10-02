from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.dependencies import hash_password
from app.repositories.system_repository import SystemRepository


class SystemService:
    SYSTEM_MODULES = [
        {"id": "front-desk", "name": "Front Desk & Bookings", "description": "Manage rooms, check-in/out, guests, and folios."},
        {"id": "rooms", "name": "Room Management", "description": "Status tracking, housekeeping updates, and room types."},
        {"id": "restaurant", "name": "Restaurant & POS", "description": "Table management, kitchen display, orders, and billing."},
        {"id": "housekeeping", "name": "Housekeeping & Cleaning", "description": "Staff task allocation, checkout cleaning, and room readiness."},
        {"id": "maintenance", "name": "Maintenance & Engineering", "description": "Work orders, preventive schedules, requests, and assets."},
        {"id": "inventory", "name": "Inventory & Procurement", "description": "Stock items, supply chain tracking, and vendor purchase."},
        {"id": "laundry", "name": "Laundry Services", "description": "Guest and in-house laundry tracking and charges."},
        {"id": "minibar", "name": "Minibar & Extras", "description": "Minibar consumption billing and extra charge postings."},
        {"id": "accounts", "name": "Accounts & Financial Reports", "description": "Revenue reports, daily audit, and expense summaries."},
        {"id": "staff", "name": "Staff / HR", "description": "Employee management, attendance, and payroll."},
        {"id": "reports", "name": "Reports & Analytics", "description": "Comprehensive hotel performance and audit reports."},
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = SystemRepository(db)

    # -------------------------------------------------------------
    # Setup Super Admin
    # -------------------------------------------------------------

    def setup_create_super_admin(self, user: schemas.UserCreate) -> models.User:
        existing_super_admin = self.repo.get_existing_super_admin()
        if existing_super_admin:
            raise HTTPException(status_code=400, detail="Super admin already exists")

        if user.role != "super-admin":
            raise HTTPException(status_code=400, detail="Only super-admin role is allowed from this setup API")

        user_data = {
            "hotel_id": None,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "full_name": user.full_name,
            "password_hash": hash_password(user.password),
            "role": "super-admin",
            "is_active": True,
        }
        return self.repo.create_user(user_data)

    # -------------------------------------------------------------
    # Hotel Go-Live Date
    # -------------------------------------------------------------

    def update_hotel_go_live_date(self, hotel_id: int, go_live_date_str: str) -> Dict[str, Any]:
        hotel = self.repo.get_hotel_by_id(hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        try:
            parsed_date = datetime.strptime(go_live_date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")

        self.repo.update_hotel_go_live_date(hotel, parsed_date)
        return {
            "message": "Go-Live Date successfully updated!",
            "go_live_date": go_live_date_str,
        }

    def get_hotel_go_live_date(self, hotel_id: int) -> Dict[str, Optional[str]]:
        hotel = self.repo.get_hotel_by_id(hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        go_live_str = hotel.go_live_date.strftime("%Y-%m-%d") if hotel.go_live_date else None
        return {"go_live_date": go_live_str}

    # -------------------------------------------------------------
    # Hotel Profile Update
    # -------------------------------------------------------------

    def update_hotel_info(self, hotel_id: int, payload_data: Dict[str, Any]) -> Dict[str, Any]:
        hotel = self.repo.get_hotel_by_id(hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        updated_hotel = self.repo.update_hotel_info(hotel, payload_data)
        return {"message": "Hotel updated successfully", "hotel": updated_hotel}

    # -------------------------------------------------------------
    # Modules & Health
    # -------------------------------------------------------------

    def get_all_system_modules(self) -> Dict[str, List[Dict[str, str]]]:
        return {"modules": self.SYSTEM_MODULES}

    def get_system_health(self) -> Dict[str, Any]:
        is_connected = self.repo.check_db_connectivity()
        db_status = "connected" if is_connected else "disconnected"

        return {
            "status": "ok" if is_connected else "error",
            "app_name": "Hotel ERP Backend",
            "version": "1.0.0",
            "database": db_status,
            "timestamp": datetime.utcnow(),
        }

    def get_system_stats(self) -> Dict[str, Any]:
        return self.repo.get_aggregated_system_stats()