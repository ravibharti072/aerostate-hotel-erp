from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session, joinedload

from app import models


class InvoiceRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Invoices Query & CRUD
    # -------------------------------------------------------------

    def get_by_id(self, invoice_id: int) -> Optional[models.Invoice]:
        return (
            self.db.query(models.Invoice)
            .options(
                joinedload(models.Invoice.guest),
                joinedload(models.Invoice.payments),
            )
            .filter(models.Invoice.id == invoice_id)
            .first()
        )

    def get_by_booking_id(self, booking_id: int) -> Optional[models.Invoice]:
        return (
            self.db.query(models.Invoice)
            .options(
                joinedload(models.Invoice.guest),
                joinedload(models.Invoice.payments),
            )
            .filter(models.Invoice.booking_id == booking_id)
            .first()
        )

    def list_invoices(
        self,
        hotel_id: Optional[int] = None,
        guest_id: Optional[int] = None,
        booking_id: Optional[int] = None,
        payment_status: Optional[str] = None,
        from_date: Optional[Any] = None,
        to_date: Optional[Any] = None,
    ) -> List[models.Invoice]:
        query = self.db.query(models.Invoice).options(
            joinedload(models.Invoice.guest),
            joinedload(models.Invoice.payments),
        )

        if hotel_id is not None:
            query = query.filter(models.Invoice.hotel_id == hotel_id)
        if guest_id is not None:
            query = query.filter(models.Invoice.guest_id == guest_id)
        if booking_id is not None:
            query = query.filter(models.Invoice.booking_id == booking_id)
        if payment_status is not None:
            query = query.filter(models.Invoice.payment_status == payment_status)
        if from_date is not None:
            query = query.filter(models.Invoice.created_at >= from_date)
        if to_date is not None:
            query = query.filter(models.Invoice.created_at <= to_date)

        return query.order_by(models.Invoice.id.desc()).all()

    def get_unbilled_bookings(self, hotel_id: int) -> List[models.Booking]:
        """
        Retrieves reservations that do NOT yet have a corresponding record in the invoices table.
        """
        existing_invoice_booking_ids = (
            self.db.query(models.Invoice.booking_id)
            .filter(models.Invoice.hotel_id == hotel_id)
            .subquery()
        )
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.hotel_id == hotel_id,
                models.Booking.status.in_(["checked-in", "checked-out", "confirmed"]),
                ~models.Booking.id.in_(existing_invoice_booking_ids),
            )
            .order_by(models.Booking.id.desc())
            .all()
        )

    def create_invoice(
        self,
        invoice_data: Dict[str, Any],
        advance_payment_data: Optional[Dict[str, Any]] = None,
    ) -> models.Invoice:
        new_invoice = models.Invoice(**invoice_data)
        self.db.add(new_invoice)
        self.db.flush()

        if advance_payment_data:
            advance_payment_data["invoice_id"] = new_invoice.id
            advance_record = models.Payment(**advance_payment_data)
            self.db.add(advance_record)

        self.db.commit()
        self.db.refresh(new_invoice)
        return new_invoice

    def add_payment_and_update_balances(
        self,
        invoice: models.Invoice,
        booking: Optional[models.Booking],
        payment_data: Dict[str, Any],
        new_paid_amount: float,
        new_due_amount: float,
        new_payment_status: str,
    ) -> models.Payment:
        payment = models.Payment(**payment_data)
        self.db.add(payment)

        invoice.paid_amount = new_paid_amount
        invoice.due_amount = new_due_amount
        invoice.payment_status = new_payment_status

        if booking:
            booking.advance_paid = new_paid_amount
            booking.payment_status = new_payment_status

        self.db.commit()
        self.db.refresh(payment)
        return payment

    def delete_invoice(self, invoice: models.Invoice) -> None:
        self.db.delete(invoice)
        self.db.commit()

    # -------------------------------------------------------------
    # Payments & Allocations
    # -------------------------------------------------------------

    def has_payments(self, invoice_id: int) -> bool:
        return (
            self.db.query(models.Payment)
            .filter(models.Payment.invoice_id == invoice_id)
            .first()
            is not None
        )

    # -------------------------------------------------------------
    # Folios & Folio Charges (Phase 1 Foundations)
    # -------------------------------------------------------------

    def get_folio_by_booking_id(self, booking_id: int) -> Optional[models.Folio]:
        return self.db.query(models.Folio).filter(models.Folio.booking_id == booking_id).first()

    def get_folio_by_id(self, folio_id: int) -> Optional[models.Folio]:
        return self.db.query(models.Folio).filter(models.Folio.id == folio_id).first()

    def create_folio(self, folio_data: Dict[str, Any]) -> models.Folio:
        folio = models.Folio(**folio_data)
        self.db.add(folio)
        self.db.commit()
        self.db.refresh(folio)
        return folio

    def add_folio_charge(self, charge_data: Dict[str, Any]) -> models.FolioCharge:
        charge = models.FolioCharge(**charge_data)
        self.db.add(charge)
        self.db.commit()
        self.db.refresh(charge)
        return charge

    def list_folio_charges(self, folio_id: int) -> List[models.FolioCharge]:
        return (
            self.db.query(models.FolioCharge)
            .filter(models.FolioCharge.folio_id == folio_id, models.FolioCharge.status != "reversed")
            .order_by(models.FolioCharge.charge_date.asc())
            .all()
        )

    # -------------------------------------------------------------
    # Cross-Domain Lookups (Booking, Guest, Hotel, Room)
    # -------------------------------------------------------------

    def get_booking_by_id(self, booking_id: int) -> Optional[models.Booking]:
        return self.db.query(models.Booking).filter(models.Booking.id == booking_id).first()

    def get_booking_for_invoice_creation(
        self, booking_id: int, hotel_id: int, guest_id: int
    ) -> Optional[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.id == booking_id,
                models.Booking.hotel_id == hotel_id,
                models.Booking.guest_id == guest_id,
            )
            .first()
        )

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_guest_by_id(self, guest_id: int, hotel_id: int) -> Optional[models.Guest]:
        return (
            self.db.query(models.Guest)
            .filter(
                models.Guest.id == guest_id,
                models.Guest.hotel_id == hotel_id,
            )
            .first()
        )

    def get_room_by_id(self, room_id: int) -> Optional[models.Room]:
        return self.db.query(models.Room).filter(models.Room.id == room_id).first()

    # -------------------------------------------------------------
    # Department Spends & Line Items (Dining, Laundry, Minibar, Extra)
    # -------------------------------------------------------------

    def get_folio_restaurant_orders(self, booking_id: int, include_billed: bool = False) -> List[Any]:
        if not hasattr(models, "RestaurantOrder"):
            return []
        query = self.db.query(models.RestaurantOrder).filter(
            models.RestaurantOrder.booking_id == booking_id,
            models.RestaurantOrder.order_status != "cancelled",
        )
        if not include_billed:
            query = query.filter(
                models.RestaurantOrder.billing_type.in_(["bill-to-room", "transfer_to_booking", "pending_billing"]),
            )
        return query.all()

    def get_folio_minibar_charges(self, booking_id: int) -> List[Any]:
        if not hasattr(models, "MinibarCharge"):
            return []
        return (
            self.db.query(models.MinibarCharge)
            .filter(
                models.MinibarCharge.booking_id == booking_id,
                models.MinibarCharge.payment_status.in_(["bill-to-room", "active", "pending"]),
            )
            .all()
        )

    def get_folio_laundry_orders(self, booking_id: int) -> List[Any]:
        if not hasattr(models, "LaundryOrder"):
            return []
        return (
            self.db.query(models.LaundryOrder)
            .filter(
                models.LaundryOrder.booking_id == booking_id,
                models.LaundryOrder.payment_status.in_(["bill-to-room", "received", "pending"]),
            )
            .all()
        )

    def get_folio_extra_charges(self, booking_id: int) -> List[Any]:
        if not hasattr(models, "ExtraCharge"):
            return []
        return (
            self.db.query(models.ExtraCharge)
            .filter(
                models.ExtraCharge.booking_id == booking_id,
                models.ExtraCharge.status != "cancelled",
            )
            .all()
        )