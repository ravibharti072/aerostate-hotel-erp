from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models


class SystemRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Super Admin Setup
    # -------------------------------------------------------------

    def get_existing_super_admin(self) -> Optional[models.User]:
        return (
            self.db.query(models.User)
            .filter(models.User.role == "super-admin")
            .first()
        )

    def create_user(self, user_data: Dict[str, Any]) -> models.User:
        new_user = models.User(**user_data)
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        return new_user

    # -------------------------------------------------------------
    # Hotel Management
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def update_hotel_go_live_date(
        self, hotel: models.Hotel, go_live_date: datetime
    ) -> models.Hotel:
        hotel.go_live_date = go_live_date
        self.db.commit()
        self.db.refresh(hotel)
        return hotel

    def update_hotel_info(
        self, hotel: models.Hotel, update_fields: Dict[str, Any]
    ) -> models.Hotel:
        for key, value in update_fields.items():
            setattr(hotel, key, value)
        self.db.commit()
        self.db.refresh(hotel)
        return hotel

    # -------------------------------------------------------------
    # Health Check
    # -------------------------------------------------------------

    def check_db_connectivity(self) -> bool:
        try:
            self.db.query(models.Hotel).first()
            return True
        except Exception:
            return False

    # -------------------------------------------------------------
    # System-wide Aggregated Statistics
    # -------------------------------------------------------------

    def get_aggregated_system_stats(self) -> Dict[str, Any]:
        # System & Users
        total_hotels = self.db.query(models.Hotel).count()
        total_users = self.db.query(models.User).count()
        active_users = self.db.query(models.User).filter(models.User.is_active == True).count()
        inactive_users = self.db.query(models.User).filter(models.User.is_active == False).count()

        # Rooms
        total_rooms = self.db.query(models.Room).count()
        available_rooms = self.db.query(models.Room).filter(models.Room.status == "available").count()
        occupied_rooms = self.db.query(models.Room).filter(models.Room.status == "occupied").count()
        dirty_rooms = self.db.query(models.Room).filter(models.Room.status == "dirty").count()
        maintenance_rooms = self.db.query(models.Room).filter(models.Room.status == "maintenance").count()

        # Guests & Bookings
        total_guests = self.db.query(models.Guest).count()
        total_bookings = self.db.query(models.Booking).count()
        confirmed_bookings = self.db.query(models.Booking).filter(models.Booking.status == "confirmed").count()
        checked_in_bookings = self.db.query(models.Booking).filter(models.Booking.status == "checked-in").count()
        checked_out_bookings = self.db.query(models.Booking).filter(models.Booking.status == "checked-out").count()

        # Invoices
        total_invoices = self.db.query(models.Invoice).count()
        pending_invoices = self.db.query(models.Invoice).filter(models.Invoice.payment_status == "pending").count()
        partial_invoices = self.db.query(models.Invoice).filter(models.Invoice.payment_status == "partial").count()
        paid_invoices = self.db.query(models.Invoice).filter(models.Invoice.payment_status == "paid").count()

        total_invoice_amount = self.db.query(func.coalesce(func.sum(models.Invoice.grand_total), 0)).scalar()
        total_paid_amount = self.db.query(func.coalesce(func.sum(models.Invoice.paid_amount), 0)).scalar()
        total_due_amount = self.db.query(func.coalesce(func.sum(models.Invoice.due_amount), 0)).scalar()

        # Payments & Expenses
        total_payments = self.db.query(models.Payment).count()
        total_payment_received = self.db.query(func.coalesce(func.sum(models.Payment.amount), 0)).scalar()

        total_expenses = self.db.query(models.Expense).count()
        total_expense_amount = self.db.query(func.coalesce(func.sum(models.Expense.amount), 0)).scalar()
        paid_expense_amount = self.db.query(func.coalesce(func.sum(models.Expense.amount), 0)).filter(models.Expense.payment_status == "paid").scalar()

        # Inventory
        total_inventory_items = self.db.query(models.InventoryItem).count()
        low_stock_items = self.db.query(models.InventoryItem).filter(models.InventoryItem.current_stock <= models.InventoryItem.min_stock_level).count()
        total_stock_transactions = self.db.query(models.StockTransaction).count()

        # Maintenance
        total_maintenance_requests = self.db.query(models.MaintenanceRequest).count()
        open_maintenance_requests = self.db.query(models.MaintenanceRequest).filter(
            models.MaintenanceRequest.status.in_(["open", "assigned", "in-progress"])
        ).count()

        # Staff & HR
        total_staff = self.db.query(models.Staff).count()
        total_staff_attendance_records = self.db.query(models.StaffAttendance).count()
        total_staff_salary_records = self.db.query(models.StaffSalary).count()
        total_staff_leave_records = self.db.query(models.StaffLeave).count()

        # POS & Other Operations
        total_restaurant_menu_items = self.db.query(models.MenuItem).count()
        total_restaurant_orders = self.db.query(models.RestaurantOrder).count()
        total_laundry_orders = self.db.query(models.LaundryOrder).count()
        total_minibar_charges = self.db.query(models.MinibarCharge).count()
        total_vendors = self.db.query(models.Vendor).count()
        total_purchase_orders = self.db.query(models.PurchaseOrder).count()

        net_profit_loss = total_paid_amount - paid_expense_amount

        return {
            "system": {
                "total_hotels": total_hotels,
                "total_users": total_users,
                "active_users": active_users,
                "inactive_users": inactive_users,
            },
            "rooms": {
                "total_rooms": total_rooms,
                "available_rooms": available_rooms,
                "occupied_rooms": occupied_rooms,
                "dirty_rooms": dirty_rooms,
                "maintenance_rooms": maintenance_rooms,
            },
            "guests_bookings": {
                "total_guests": total_guests,
                "total_bookings": total_bookings,
                "confirmed_bookings": confirmed_bookings,
                "checked_in_bookings": checked_in_bookings,
                "checked_out_bookings": checked_out_bookings,
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
                "net_profit_loss": net_profit_loss,
            },
            "inventory": {
                "total_inventory_items": total_inventory_items,
                "low_stock_items": low_stock_items,
                "total_stock_transactions": total_stock_transactions,
            },
            "maintenance": {
                "total_maintenance_requests": total_maintenance_requests,
                "open_maintenance_requests": open_maintenance_requests,
            },
            "staff_hr": {
                "total_staff": total_staff,
                "total_staff_attendance_records": total_staff_attendance_records,
                "total_staff_salary_records": total_staff_salary_records,
                "total_staff_leave_records": total_staff_leave_records,
            },
            "restaurant_pos": {
                "total_restaurant_menu_items": total_restaurant_menu_items,
                "total_restaurant_orders": total_restaurant_orders,
            },
            "guest_services": {
                "total_laundry_orders": total_laundry_orders,
                "total_minibar_charges": total_minibar_charges,
            },
            "procurement": {
                "total_vendors": total_vendors,
                "total_purchase_orders": total_purchase_orders,
            },
            "generated_at": datetime.utcnow(),
        }