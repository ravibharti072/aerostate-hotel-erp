from datetime import date, datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class ReportRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Hotel Queries
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    # -------------------------------------------------------------
    # Financial Record Queries
    # -------------------------------------------------------------

    def get_invoices(self, hotel_id: Optional[int] = None) -> List[models.Invoice]:
        query = self.db.query(models.Invoice)
        if hotel_id:
            query = query.filter(models.Invoice.hotel_id == hotel_id)
        return query.all()

    def get_payments(self, hotel_id: Optional[int] = None) -> List[models.Payment]:
        query = self.db.query(models.Payment)
        if hotel_id:
            query = query.filter(models.Payment.hotel_id == hotel_id)
        return query.all()

    def get_expenses(self, hotel_id: Optional[int] = None) -> List[models.Expense]:
        query = self.db.query(models.Expense)
        if hotel_id:
            query = query.filter(models.Expense.hotel_id == hotel_id)
        return query.all()

    # -------------------------------------------------------------
    # Phase 7 Audit & Reporting Queries
    # -------------------------------------------------------------

    def get_payments_by_date_range(
        self,
        hotel_id: Optional[int],
        start_datetime: datetime,
        end_datetime: datetime,
        cashier_username: Optional[str] = None,
        payment_type: Optional[str] = None,
        payment_method: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[models.Payment]:
        query = self.db.query(models.Payment).filter(
            models.Payment.created_at >= start_datetime,
            models.Payment.created_at <= end_datetime,
        )

        if hotel_id:
            query = query.filter(models.Payment.hotel_id == hotel_id)
        if cashier_username:
            query = query.filter(models.Payment.received_by == cashier_username)
        if payment_type:
            query = query.filter(models.Payment.payment_type == payment_type)
        if payment_method:
            query = query.filter(models.Payment.payment_method == payment_method)

        query = query.order_by(models.Payment.id.desc())

        if limit:
            query = query.limit(limit)

        return query.all()

    def get_invoices_by_date_range(
        self,
        hotel_id: Optional[int],
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> List[models.Invoice]:
        query = self.db.query(models.Invoice).filter(
            models.Invoice.created_at >= start_datetime,
            models.Invoice.created_at <= end_datetime,
        )
        if hotel_id:
            query = query.filter(models.Invoice.hotel_id == hotel_id)
        return query.order_by(models.Invoice.id.desc()).all()

    def get_expenses_by_date_range(
        self,
        hotel_id: Optional[int],
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> List[models.Expense]:
        query = self.db.query(models.Expense).filter(
            models.Expense.expense_date >= start_datetime,
            models.Expense.expense_date <= end_datetime,
        )
        if hotel_id:
            query = query.filter(models.Expense.hotel_id == hotel_id)
        return query.order_by(models.Expense.id.desc()).all()

    # -------------------------------------------------------------
    # Dashboard Aggregation Queries
    # -------------------------------------------------------------

    def get_dashboard_collections(self, hotel_id: Optional[int] = None) -> Dict[str, List[Any]]:
        room_q = self.db.query(models.Room)
        guest_q = self.db.query(models.Guest)
        booking_q = self.db.query(models.Booking)
        invoice_q = self.db.query(models.Invoice)
        expense_q = self.db.query(models.Expense)
        inventory_q = self.db.query(models.InventoryItem)
        maintenance_q = self.db.query(models.MaintenanceRequest)

        if hotel_id:
            room_q = room_q.filter(models.Room.hotel_id == hotel_id)
            guest_q = guest_q.filter(models.Guest.hotel_id == hotel_id)
            booking_q = booking_q.filter(models.Booking.hotel_id == hotel_id)
            invoice_q = invoice_q.filter(models.Invoice.hotel_id == hotel_id)
            expense_q = expense_q.filter(models.Expense.hotel_id == hotel_id)
            inventory_q = inventory_q.filter(models.InventoryItem.hotel_id == hotel_id)
            maintenance_q = maintenance_q.filter(models.MaintenanceRequest.hotel_id == hotel_id)

        return {
            "rooms": room_q.all(),
            "guests": guest_q.all(),
            "bookings": booking_q.all(),
            "invoices": invoice_q.all(),
            "expenses": expense_q.all(),
            "inventory_items": inventory_q.all(),
            "maintenance_requests": maintenance_q.all(),
        }

    def get_rooms(self, hotel_id: Optional[int] = None) -> List[models.Room]:
        query = self.db.query(models.Room)
        if hotel_id:
            query = query.filter(models.Room.hotel_id == hotel_id)
        return query.all()

    def get_today_records(self, hotel_id: Optional[int] = None) -> Dict[str, List[Any]]:
        booking_q = self.db.query(models.Booking)
        invoice_q = self.db.query(models.Invoice)
        payment_q = self.db.query(models.Payment)
        expense_q = self.db.query(models.Expense)

        if hotel_id:
            booking_q = booking_q.filter(models.Booking.hotel_id == hotel_id)
            invoice_q = invoice_q.filter(models.Invoice.hotel_id == hotel_id)
            payment_q = payment_q.filter(models.Payment.hotel_id == hotel_id)
            expense_q = expense_q.filter(models.Expense.hotel_id == hotel_id)

        return {
            "bookings": booking_q.all(),
            "invoices": invoice_q.all(),
            "payments": payment_q.all(),
            "expenses": expense_q.all(),
        }

    def get_recent_entities(self, hotel_id: Optional[int], limit: int) -> Dict[str, List[Any]]:
        booking_q = self.db.query(models.Booking)
        invoice_q = self.db.query(models.Invoice)
        payment_q = self.db.query(models.Payment)
        expense_q = self.db.query(models.Expense)
        maintenance_q = self.db.query(models.MaintenanceRequest)

        if hotel_id:
            booking_q = booking_q.filter(models.Booking.hotel_id == hotel_id)
            invoice_q = invoice_q.filter(models.Invoice.hotel_id == hotel_id)
            payment_q = payment_q.filter(models.Payment.hotel_id == hotel_id)
            expense_q = expense_q.filter(models.Expense.hotel_id == hotel_id)
            maintenance_q = maintenance_q.filter(models.MaintenanceRequest.hotel_id == hotel_id)

        return {
            "bookings": booking_q.order_by(models.Booking.id.desc()).limit(limit).all(),
            "invoices": invoice_q.order_by(models.Invoice.id.desc()).limit(limit).all(),
            "payments": payment_q.order_by(models.Payment.id.desc()).limit(limit).all(),
            "expenses": expense_q.order_by(models.Expense.id.desc()).limit(limit).all(),
            "maintenance": maintenance_q.order_by(models.MaintenanceRequest.id.desc()).limit(limit).all(),
        }