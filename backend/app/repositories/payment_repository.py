from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from sqlalchemy.orm import Session

from app import models


class PaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Payments & Transactions
    # -------------------------------------------------------------

    def list_payments(
        self,
        hotel_id: Optional[int] = None,
        guest_id: Optional[int] = None,
        invoice_id: Optional[int] = None,
        booking_id: Optional[int] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> List[models.Payment]:
        query = self.db.query(models.Payment)

        if hotel_id is not None:
            query = query.filter(models.Payment.hotel_id == hotel_id)
        if guest_id is not None:
            query = query.filter(models.Payment.guest_id == guest_id)
        if invoice_id is not None:
            query = query.filter(models.Payment.invoice_id == invoice_id)
        if booking_id is not None:
            query = query.filter(models.Payment.booking_id == booking_id)
        if from_date is not None:
            query = query.filter(models.Payment.created_at >= from_date)
        if to_date is not None:
            query = query.filter(models.Payment.created_at <= to_date)

        return query.order_by(models.Payment.id.desc()).all()

    def get_payment_by_id(self, payment_id: int) -> Optional[models.Payment]:
        return self.db.query(models.Payment).filter(models.Payment.id == payment_id).first()

    def get_payment_by_receipt_number(self, receipt_number: str) -> Optional[models.Payment]:
        return self.db.query(models.Payment).filter(models.Payment.receipt_number == receipt_number).first()

    def count_advance_payments_in_fy(self, hotel_id: int, fy_prefix: str) -> int:
        return (
            self.db.query(models.Payment)
            .filter(
                models.Payment.hotel_id == hotel_id,
                models.Payment.payment_type == "advance",
                models.Payment.receipt_number.like(f"ADV-{fy_prefix}-%"),
            )
            .count()
        )

    def create_advance_payment(
        self,
        payment_data: Dict[str, Any],
        booking: models.Booking,
        new_advance_paid: float,
    ) -> models.Payment:
        new_payment = models.Payment(**payment_data)
        self.db.add(new_payment)

        booking.advance_paid = new_advance_paid
        total_expected = float(booking.total_amount or 0.0)
        if new_advance_paid >= total_expected and total_expected > 0:
            booking.payment_status = "paid"
        elif new_advance_paid > 0:
            booking.payment_status = "partial"

        self.db.commit()
        self.db.refresh(new_payment)
        return new_payment

    def create_payment_and_update_balances(
        self,
        payment_data: Dict[str, Any],
        invoice: models.Invoice,
        booking: Optional[models.Booking],
        new_paid_amount: float,
        new_due_amount: float,
        new_payment_status: str,
    ) -> models.Payment:
        new_payment = models.Payment(**payment_data)
        self.db.add(new_payment)

        invoice.paid_amount = new_paid_amount
        invoice.due_amount = new_due_amount
        invoice.payment_status = new_payment_status

        if booking:
            booking.advance_paid = new_paid_amount
            booking.payment_status = new_payment_status

        self.db.commit()
        self.db.refresh(new_payment)
        return new_payment

    def create_refund_and_update_balances(
        self,
        refund_payment_data: Dict[str, Any],
        invoice: models.Invoice,
        booking: Optional[models.Booking],
        new_paid_amount: float,
        new_refund_total: float,
        new_due_amount: float,
        new_payment_status: str,
    ) -> models.Payment:
        new_refund = models.Payment(**refund_payment_data)
        self.db.add(new_refund)

        invoice.paid_amount = new_paid_amount
        invoice.refund_amount = new_refund_total
        invoice.due_amount = new_due_amount
        invoice.payment_status = new_payment_status

        if booking:
            booking.advance_paid = new_paid_amount
            booking.payment_status = new_payment_status

        self.db.commit()
        self.db.refresh(new_refund)
        return new_refund

    def complete_checkout_settlement(
        self,
        booking: models.Booking,
        invoice: models.Invoice,
        payment_data: Optional[Dict[str, Any]],
        rooms_to_clean: Set[int],
        housekeeping_tasks_data: List[Dict[str, Any]],
    ) -> None:
        if invoice.id is None:
            self.db.add(invoice)
            self.db.flush()

        if payment_data:
            payment_data["invoice_id"] = invoice.id
            new_payment = models.Payment(**payment_data)
            self.db.add(new_payment)
            self.db.flush()
            alloc = models.InvoicePaymentAllocation(
                invoice_id=invoice.id,
                payment_id=new_payment.id,
                allocated_amount=round(float(payment_data.get("amount", 0.0)), 2),
            )
            self.db.add(alloc)

        # Link all previous advance payments for this booking to this invoice
        existing_pmts = (
            self.db.query(models.Payment)
            .filter(
                models.Payment.booking_id == booking.id,
                models.Payment.hotel_id == booking.hotel_id,
                models.Payment.invoice_id == None,
            )
            .all()
        )
        for p in existing_pmts:
            p.invoice_id = invoice.id
            alloc = models.InvoicePaymentAllocation(
                invoice_id=invoice.id,
                payment_id=p.id,
                allocated_amount=round(float(p.amount or 0.0), 2),
            )
            self.db.add(alloc)

        if rooms_to_clean:
            self.db.query(models.Room).filter(
                models.Room.id.in_(list(rooms_to_clean)),
                models.Room.hotel_id == booking.hotel_id,
            ).update({models.Room.status: "cleaning"}, synchronize_session=False)

        for task_dict in housekeeping_tasks_data:
            self.db.add(models.HousekeepingTask(**task_dict))

        self.db.commit()
        self.db.refresh(invoice)

    # -------------------------------------------------------------
    # Cross-Domain Lookups
    # -------------------------------------------------------------

    def get_invoice_by_id(self, invoice_id: int) -> Optional[models.Invoice]:
        return self.db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()

    def get_invoice_by_booking_id(self, booking_id: int) -> Optional[models.Invoice]:
        return self.db.query(models.Invoice).filter(models.Invoice.booking_id == booking_id).first()

    def get_booking_by_id(self, booking_id: int) -> Optional[models.Booking]:
        return self.db.query(models.Booking).filter(models.Booking.id == booking_id).first()

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_guest_by_id(self, guest_id: int) -> Optional[models.Guest]:
        return self.db.query(models.Guest).filter(models.Guest.id == guest_id).first()

    def get_room_by_id(self, room_id: int) -> Optional[models.Room]:
        return self.db.query(models.Room).filter(models.Room.id == room_id).first()

    def get_folio_by_booking_id(self, booking_id: int) -> Optional[models.Folio]:
        return self.db.query(models.Folio).filter(models.Folio.booking_id == booking_id).first()

    def get_extra_charges_by_booking(self, booking_id: int) -> List[Any]:
        if not hasattr(models, "ExtraCharge"):
            return []
        return (
            self.db.query(models.ExtraCharge)
            .filter(models.ExtraCharge.booking_id == booking_id)
            .all()
        )