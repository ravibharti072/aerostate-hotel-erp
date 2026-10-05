from datetime import datetime, timedelta, time
from typing import Any, Dict, List, Optional, Set
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.payment_repository import PaymentRepository


class PaymentService:
    ALLOWED_PAYMENT_CREATORS = [
        "super-admin",
        "hotel-admin",
        "manager",
        "accountant",
        "front-desk",
    ]

    ALLOWED_PAYMENT_METHODS = [
        "cash",
        "upi",
        "card",
        "bank_transfer",
        "cheque",
        "online",
        "other",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = PaymentRepository(db)

    # -------------------------------------------------------------
    # Authorization & Scope Assertions
    # -------------------------------------------------------------

    def _assert_can_create(self, current_user: models.User) -> None:
        if current_user.role not in self.ALLOWED_PAYMENT_CREATORS:
            raise HTTPException(
                status_code=403,
                detail="Only accountant, front-desk, hotel-admin, manager, or super-admin can record payments",
            )

    def _assert_can_checkout_settle(self, current_user: models.User) -> None:
        if current_user.role not in self.ALLOWED_PAYMENT_CREATORS:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized to process check-out settlements",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    def _validate_payment_method(self, payment_method: str) -> str:
        method = (payment_method or "").strip().lower()
        if method not in self.ALLOWED_PAYMENT_METHODS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment method '{payment_method}'. Allowed methods: {', '.join(self.ALLOWED_PAYMENT_METHODS)}",
            )
        return method

    # -------------------------------------------------------------
    # Financial Year Number Generator
    # -------------------------------------------------------------

    def get_current_financial_year_prefix(self) -> str:
        """Computes standard Indian FY representation: April 1 -> March 31. Example: '26-27'."""
        now = datetime.utcnow()
        year = now.year
        if now.month >= 4:
            start_yr = year % 100
            end_yr = (year + 1) % 100
        else:
            start_yr = (year - 1) % 100
            end_yr = year % 100
        return f"{start_yr:02d}-{end_yr:02d}"

    def generate_advance_receipt_number(self, hotel_id: int) -> str:
        fy_prefix = self.get_current_financial_year_prefix()
        count = self.repo.count_advance_payments_in_fy(hotel_id, fy_prefix)
        next_seq = count + 1

        for attempt in range(10):
            receipt_number = f"ADV-{fy_prefix}-{(next_seq + attempt):06d}"
            if not self.repo.get_payment_by_receipt_number(receipt_number):
                return receipt_number

        return f"ADV-{fy_prefix}-{int(datetime.utcnow().timestamp()) % 1000000:06d}"

    # -------------------------------------------------------------
    # Advance Payment & Receipt Voucher Engine (Phase 3)
    # -------------------------------------------------------------

    def record_advance_payment(
        self,
        advance_data: schemas.AdvancePaymentCreate,
        current_user: models.User,
    ) -> schemas.AdvanceReceiptVoucherResponse:
        self._assert_can_create(current_user)

        booking = self.repo.get_booking_by_id(advance_data.booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(current_user, booking.hotel_id, "Access denied to this booking")

        if advance_data.amount <= 0:
            raise HTTPException(status_code=400, detail="Advance amount must be greater than 0")

        validated_method = self._validate_payment_method(advance_data.payment_method)

        if advance_data.transaction_id:
            existing_txn = (
                self.db.query(models.Payment)
                .filter(
                    models.Payment.hotel_id == booking.hotel_id,
                    models.Payment.transaction_id == advance_data.transaction_id.strip(),
                )
                .first()
            )
            if existing_txn:
                raise HTTPException(
                    status_code=409,
                    detail=f"Payment with transaction ID '{advance_data.transaction_id}' has already been processed.",
                )

        hotel = self.repo.get_hotel_by_id(booking.hotel_id)
        guest = self.repo.get_guest_by_id(booking.guest_id)
        room = self.repo.get_room_by_id(booking.room_id)
        folio = self.repo.get_folio_by_booking_id(booking.id)

        amount = round(float(advance_data.amount), 2)
        tax_rate = float(advance_data.tax_rate or 0.0)

        if tax_rate > 0:
            taxable_amount = round(amount / (1.0 + (tax_rate / 100.0)), 2)
            tax_amount = round(amount - taxable_amount, 2)
        else:
            taxable_amount = amount
            tax_amount = 0.0

        place_of_supply = advance_data.place_of_supply or getattr(hotel, "state", "") or "Intra-State"
        hotel_state = (getattr(hotel, "state", "") or "").strip().lower()
        pos_state = place_of_supply.strip().lower()

        is_inter_state = bool(hotel_state and pos_state and hotel_state != pos_state and pos_state != "intra-state")

        if is_inter_state:
            igst = tax_amount
            cgst = 0.0
            sgst = 0.0
        else:
            cgst = round(tax_amount / 2.0, 2)
            sgst = round(tax_amount - cgst, 2)
            igst = 0.0

        receipt_number = self.generate_advance_receipt_number(booking.hotel_id)

        payment_dict = {
            "hotel_id": booking.hotel_id,
            "guest_id": booking.guest_id,
            "booking_id": booking.id,
            "folio_id": folio.id if folio else None,
            "payment_type": "advance",
            "receipt_number": receipt_number,
            "amount": amount,
            "payment_method": validated_method,
            "transaction_id": advance_data.transaction_id.strip() if advance_data.transaction_id else None,
            "payment_status": "success",
            "received_by": current_user.username,
            "remarks": advance_data.remarks or "Advance booking deposit",
            "customer_gstin": advance_data.customer_gstin or getattr(booking, "gstin", None),
            "place_of_supply": place_of_supply,
            "is_reverse_charge": advance_data.is_reverse_charge or False,
            "tax_rate": tax_rate,
            "taxable_amount": taxable_amount,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
        }

        new_advance_total = round(float(booking.advance_paid or 0.0) + amount, 2)
        payment_record = self.repo.create_advance_payment(payment_dict, booking, new_advance_total)

        hotel_addr_parts = [getattr(hotel, "address", ""), getattr(hotel, "city", ""), getattr(hotel, "state", "")]
        resolved_address = ", ".join([p for p in hotel_addr_parts if p and p.strip()])

        return schemas.AdvanceReceiptVoucherResponse(
            receipt_number=receipt_number,
            receipt_date=payment_record.created_at,
            hotel_name=hotel.name if hotel else "Hotel",
            hotel_address=resolved_address,
            hotel_phone=getattr(hotel, "phone", "") or "",
            hotel_email=getattr(hotel, "email", "") or "",
            hotel_gstin=getattr(hotel, "tax_number", "") or "UNREGISTERED",
            guest_name=guest.full_name if guest else "Valued Guest",
            guest_phone=guest.phone if guest else "N/A",
            guest_email=getattr(guest, "email", None),
            customer_gstin=payment_record.customer_gstin,
            reservation_code=booking.reservation_code or f"RES-{booking.id}",
            booking_id=booking.id,
            folio_number=folio.folio_number if folio else None,
            room_number=room.room_number if room else str(booking.room_id),
            stay_label=booking.stay_label or "Stay Accommodation",
            advance_amount=amount,
            taxable_amount=taxable_amount,
            tax_rate=tax_rate,
            cgst=cgst,
            sgst=sgst,
            igst=igst,
            payment_method=payment_record.payment_method,
            transaction_id=payment_record.transaction_id,
            place_of_supply=place_of_supply,
            is_reverse_charge=payment_record.is_reverse_charge,
            received_by=current_user.username,
            remarks=payment_record.remarks,
        )

    def get_advance_receipt_voucher(
        self,
        payment_id: int,
        current_user: models.User,
    ) -> schemas.AdvanceReceiptVoucherResponse:
        payment = self.repo.get_payment_by_id(payment_id)
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")

        self._assert_owns_hotel(current_user, payment.hotel_id, "Access denied")

        if payment.payment_type != "advance":
            raise HTTPException(status_code=400, detail="This payment is not an advance payment voucher")

        booking = self.repo.get_booking_by_id(payment.booking_id) if payment.booking_id else None
        hotel = self.repo.get_hotel_by_id(payment.hotel_id)
        guest = self.repo.get_guest_by_id(payment.guest_id)
        room = self.repo.get_room_by_id(booking.room_id) if booking else None
        folio = self.repo.get_folio_by_booking_id(booking.id) if booking else None

        hotel_addr_parts = [getattr(hotel, "address", ""), getattr(hotel, "city", ""), getattr(hotel, "state", "")]
        resolved_address = ", ".join([p for p in hotel_addr_parts if p and p.strip()])

        return schemas.AdvanceReceiptVoucherResponse(
            receipt_number=payment.receipt_number or f"ADV-{payment.id}",
            receipt_date=payment.created_at,
            hotel_name=hotel.name if hotel else "Hotel",
            hotel_address=resolved_address,
            hotel_phone=getattr(hotel, "phone", "") or "",
            hotel_email=getattr(hotel, "email", "") or "",
            hotel_gstin=getattr(hotel, "tax_number", "") or "UNREGISTERED",
            guest_name=guest.full_name if guest else "Valued Guest",
            guest_phone=guest.phone if guest else "N/A",
            guest_email=getattr(guest, "email", None),
            customer_gstin=payment.customer_gstin,
            reservation_code=booking.reservation_code if booking else f"RES-{payment.booking_id}",
            booking_id=booking.id if booking else 0,
            folio_number=folio.folio_number if folio else None,
            room_number=room.room_number if room else "N/A",
            stay_label=booking.stay_label if booking else "Stay Accommodation",
            advance_amount=payment.amount,
            taxable_amount=payment.taxable_amount or payment.amount,
            tax_rate=payment.tax_rate or 0.0,
            cgst=payment.cgst or 0.0,
            sgst=payment.sgst or 0.0,
            igst=payment.igst or 0.0,
            payment_method=payment.payment_method,
            transaction_id=payment.transaction_id,
            place_of_supply=payment.place_of_supply or "Intra-State",
            is_reverse_charge=payment.is_reverse_charge or False,
            received_by=payment.received_by or "Front Desk",
            remarks=payment.remarks,
        )

    # -------------------------------------------------------------
    # Post-Invoice Payment & Overpayment Settlement
    # -------------------------------------------------------------

    def create_payment(
        self,
        payment: schemas.PaymentCreate,
        current_user: models.User,
    ) -> models.Payment:
        self._assert_can_create(current_user)

        invoice = self.repo.get_invoice_by_id(payment.invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        self._assert_owns_hotel(
            current_user,
            invoice.hotel_id,
            "You can create payments only for your own hotel invoices",
        )

        if payment.amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")

        validated_method = self._validate_payment_method(payment.payment_method)

        clean_txn = payment.transaction_id.strip() if payment.transaction_id else None
        if clean_txn:
            existing_txn = (
                self.db.query(models.Payment)
                .filter(
                    models.Payment.hotel_id == invoice.hotel_id,
                    models.Payment.transaction_id == clean_txn,
                )
                .first()
            )
            if existing_txn:
                raise HTTPException(
                    status_code=409,
                    detail=f"Duplicate payment detected. Transaction ID '{clean_txn}' was already recorded.",
                )
        else:
            recent_cutoff = datetime.utcnow() - timedelta(seconds=60)
            potential_duplicate = (
                self.db.query(models.Payment)
                .filter(
                    models.Payment.invoice_id == invoice.id,
                    models.Payment.amount == round(payment.amount, 2),
                    models.Payment.payment_method == validated_method,
                    models.Payment.created_at >= recent_cutoff,
                )
                .first()
            )
            if potential_duplicate:
                raise HTTPException(
                    status_code=409,
                    detail="A payment for this exact amount was just submitted. Please wait a moment before trying again.",
                )

        new_paid_amount = round(float(invoice.paid_amount or 0.0) + payment.amount, 2)
        grand_total = float(invoice.grand_total or 0.0)

        if new_paid_amount > grand_total:
            new_due_amount = 0.0
            new_payment_status = "overpaid"
        elif new_paid_amount == grand_total:
            new_due_amount = 0.0
            new_payment_status = "paid"
        elif new_paid_amount > 0:
            new_due_amount = round(max(grand_total - new_paid_amount, 0.0), 2)
            new_payment_status = "partially_paid"
        else:
            new_due_amount = grand_total
            new_payment_status = "unpaid"

        booking = self.repo.get_booking_by_id(invoice.booking_id)

        payment_data = {
            "hotel_id": invoice.hotel_id,
            "guest_id": invoice.guest_id,
            "invoice_id": invoice.id,
            "booking_id": invoice.booking_id,
            "folio_id": invoice.folio_id,
            "payment_type": payment.payment_type or "settlement",
            "amount": round(payment.amount, 2),
            "payment_method": validated_method,
            "transaction_id": clean_txn,
            "payment_status": "success",
            "received_by": current_user.username,
            "remarks": payment.remarks or "Invoice settlement payment",
        }

        created_payment = self.repo.create_payment_and_update_balances(
            payment_data=payment_data,
            invoice=invoice,
            booking=booking,
            new_paid_amount=new_paid_amount,
            new_due_amount=new_due_amount,
            new_payment_status=new_payment_status,
        )

        allocation = models.InvoicePaymentAllocation(
            invoice_id=invoice.id,
            payment_id=created_payment.id,
            allocated_amount=round(payment.amount, 2),
        )
        self.db.add(allocation)
        self.db.commit()

        return created_payment

    # -------------------------------------------------------------
    # Refund Disbursement Engine (Phase 6)
    # -------------------------------------------------------------

    def process_refund(
        self,
        refund_data: schemas.RefundCreate,
        current_user: models.User,
    ) -> models.Payment:
        self._assert_can_create(current_user)

        invoice = self.repo.get_invoice_by_id(refund_data.invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        self._assert_owns_hotel(current_user, invoice.hotel_id, "Access denied")

        refund_amt = round(float(refund_data.amount), 2)
        if refund_amt <= 0:
            raise HTTPException(status_code=400, detail="Refund amount must be greater than 0")

        validated_method = self._validate_payment_method(refund_data.payment_method)

        paid = round(float(invoice.paid_amount or 0.0), 2)
        grand_total = round(float(invoice.grand_total or 0.0), 2)
        current_refunded = round(float(invoice.refund_amount or 0.0), 2)

        if invoice.invoice_status == "cancelled":
            refundable_balance = max(round(paid - current_refunded, 2), 0.0)
        else:
            refundable_balance = max(round(paid - grand_total, 2), 0.0)

        if refund_amt > refundable_balance:
            raise HTTPException(
                status_code=400,
                detail=f"Refund amount (₹{refund_amt:.2f}) exceeds available refundable credit (₹{refundable_balance:.2f}).",
            )

        new_paid_amount = round(paid - refund_amt, 2)
        new_refund_total = round(current_refunded + refund_amt, 2)

        if invoice.invoice_status == "cancelled":
            new_due_amount = 0.0
            new_payment_status = "refunded" if new_paid_amount == 0 else "partially_paid"
        else:
            if new_paid_amount > grand_total:
                new_due_amount = 0.0
                new_payment_status = "overpaid"
            elif new_paid_amount == grand_total:
                new_due_amount = 0.0
                new_payment_status = "paid"
            elif new_paid_amount > 0:
                new_due_amount = round(max(grand_total - new_paid_amount, 0.0), 2)
                new_payment_status = "partially_paid"
            else:
                new_due_amount = grand_total
                new_payment_status = "unpaid"

        booking = self.repo.get_booking_by_id(invoice.booking_id)

        clean_txn = refund_data.transaction_id.strip() if refund_data.transaction_id else None
        refund_dict = {
            "hotel_id": invoice.hotel_id,
            "guest_id": invoice.guest_id,
            "invoice_id": invoice.id,
            "booking_id": invoice.booking_id,
            "folio_id": invoice.folio_id,
            "payment_type": "refund",
            "amount": refund_amt,
            "payment_method": validated_method,
            "transaction_id": clean_txn,
            "payment_status": "success",
            "received_by": current_user.username,
            "remarks": refund_data.reason or "Overpayment refund disbursement",
        }

        return self.repo.create_refund_and_update_balances(
            refund_payment_data=refund_dict,
            invoice=invoice,
            booking=booking,
            new_paid_amount=new_paid_amount,
            new_refund_total=new_refund_total,
            new_due_amount=new_due_amount,
            new_payment_status=new_payment_status,
        )

    # -------------------------------------------------------------
    # Automated Overstay Checkout Settlement (Phase 7 Update)
    # -------------------------------------------------------------

    def settle_and_checkout(
        self,
        booking_id: int,
        payment_method: str,
        transaction_id: Optional[str],
        discount: float,
        current_user: models.User,
    ) -> Dict[str, Any]:
        self._assert_can_checkout_settle(current_user)

        booking = self.repo.get_booking_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(current_user, booking.hotel_id, "Access denied")

        if booking.status != "checked-in":
            raise HTTPException(
                status_code=400,
                detail=f"Booking is in '{booking.status}' status, cannot check out",
            )

        hotel = self.repo.get_hotel_by_id(booking.hotel_id)
        require_full_payment = getattr(hotel, "require_full_payment_before_checkout", False)

        is_unpaid_settlement = str(payment_method or "").strip().lower() == "unpaid"
        validated_method = "cash" if is_unpaid_settlement else self._validate_payment_method(payment_method)

        # Automated Overstay & Extra Nights Calculation
        actual_checkout = datetime.utcnow()
        scheduled_checkout = booking.checkout_date
        grace_mins = getattr(hotel, "checkout_grace_minutes", 60)
        cutoff_time = scheduled_checkout + timedelta(minutes=grace_mins)

        extra_room_charges = 0.0
        extra_nights = 0
        if actual_checkout > cutoff_time:
            scheduled_date = scheduled_checkout.date()
            actual_date = actual_checkout.date()
            extra_nights = max(0, (actual_date - scheduled_date).days)

            if extra_nights > 0:
                original_nights = max(int(booking.nights_count or 1), 1)
                original_total = float(booking.total_amount or 0.0)
                rate_per_night = original_total / original_nights
                extra_room_charges = round(rate_per_night * extra_nights, 2)

        base_room_charges = float(booking.total_amount or 0.0)
        total_room_charges = round(base_room_charges + extra_room_charges, 2)

        # Departmental Folio Spends (Restaurant, Laundry, Minibar, Housekeeping)
        restaurant_orders = self.db.query(models.RestaurantOrder).filter(
            models.RestaurantOrder.booking_id == booking.id,
            models.RestaurantOrder.hotel_id == booking.hotel_id,
        ).all()
        restaurant_charges = round(sum(float(o.total_amount or 0.0) for o in restaurant_orders), 2)

        laundry_orders = self.db.query(models.LaundryOrder).filter(
            models.LaundryOrder.booking_id == booking.id,
            models.LaundryOrder.hotel_id == booking.hotel_id,
        ).all()
        laundry_charges = round(sum(float(l.total_amount or 0.0) for l in laundry_orders), 2)

        minibar_charges_list = self.db.query(models.MinibarCharge).filter(
            models.MinibarCharge.booking_id == booking.id,
            models.MinibarCharge.hotel_id == booking.hotel_id,
        ).all()
        minibar_charges = round(sum(float(m.total_amount or 0.0) for m in minibar_charges_list), 2)

        extra_items = self.repo.get_extra_charges_by_booking(booking.id)
        extra_charges = round(sum(float(item.total_amount or 0.0) for item in extra_items), 2)

        gross_spends = round(
            total_room_charges + restaurant_charges + laundry_charges + minibar_charges + extra_charges, 2
        )
        grand_total = max(round(gross_spends - float(discount or 0.0), 2), 0.0)
        already_paid = float(booking.advance_paid or 0.0)
        due_amount = max(round(grand_total - already_paid, 2), 0.0)

        booking.total_amount = grand_total
        booking.nights_count = max(int(booking.nights_count or 1), 1) + extra_nights
        booking.checkout_date = actual_checkout
        booking.is_late_checkout = booking.is_late_checkout or (extra_nights > 0)

        if require_full_payment and due_amount > 0 and is_unpaid_settlement:
            raise HTTPException(
                status_code=400,
                detail="Full payment is required before checkout. This property does not permit checkout with an outstanding balance.",
            )

        invoice = self.repo.get_invoice_by_booking_id(booking.id)
        folio = self.repo.get_folio_by_booking_id(booking.id)

        if already_paid == 0:
            computed_pay_status = "unpaid"
        elif already_paid < grand_total:
            computed_pay_status = "partially_paid"
        elif already_paid == grand_total:
            computed_pay_status = "paid"
        else:
            computed_pay_status = "overpaid"

        if not invoice:
            inv_num = f"INV-{booking.hotel_id}-{booking.id}-{int(datetime.utcnow().timestamp())}"
            invoice = models.Invoice(
                hotel_id=booking.hotel_id,
                guest_id=booking.guest_id,
                booking_id=booking.id,
                folio_id=folio.id if folio else None,
                invoice_number=inv_num,
                room_charges=total_room_charges,
                restaurant_charges=restaurant_charges,
                laundry_charges=laundry_charges,
                minibar_charges=minibar_charges,
                extra_charges=extra_charges,
                discount=float(discount or 0.0),
                tax_amount=float(booking.tax or 0.0),
                taxable_value=round(grand_total - float(booking.tax or 0.0), 2),
                cgst=round(float(booking.tax or 0.0) / 2.0, 2),
                sgst=round(float(booking.tax or 0.0) / 2.0, 2),
                igst=0.0,
                grand_total=grand_total,
                paid_amount=already_paid,
                due_amount=due_amount,
                invoice_status="issued",
                payment_status=computed_pay_status,
            )
        else:
            invoice.room_charges = total_room_charges
            invoice.restaurant_charges = restaurant_charges
            invoice.laundry_charges = laundry_charges
            invoice.minibar_charges = minibar_charges
            invoice.extra_charges = extra_charges
            invoice.discount = float(discount or 0.0)
            invoice.grand_total = grand_total
            invoice.due_amount = due_amount
            invoice.payment_status = computed_pay_status

        payment_data = None
        if due_amount > 0 and not is_unpaid_settlement:
            clean_txn = transaction_id.strip() if transaction_id else None
            payment_data = {
                "hotel_id": booking.hotel_id,
                "guest_id": booking.guest_id,
                "booking_id": booking.id,
                "folio_id": folio.id if folio else None,
                "payment_type": "settlement",
                "amount": due_amount,
                "payment_method": validated_method,
                "transaction_id": clean_txn,
                "payment_status": "success",
                "received_by": current_user.username,
                "remarks": "Final settlement upon checkout (including overstay)",
            }
            invoice.paid_amount = grand_total
            invoice.due_amount = 0.0
            invoice.payment_status = "paid"
            booking.advance_paid = grand_total
            booking.payment_status = "paid"
        else:
            invoice.paid_amount = already_paid
            invoice.due_amount = due_amount
            invoice.payment_status = computed_pay_status
            booking.payment_status = computed_pay_status

        booking.status = "checked-out"
        booking.checkout_date = actual_checkout

        self.db.query(models.RestaurantOrder).filter(
            models.RestaurantOrder.booking_id == booking.id,
            models.RestaurantOrder.hotel_id == booking.hotel_id,
        ).update({models.RestaurantOrder.is_added_to_invoice: True}, synchronize_session=False)

        rooms_to_clean: Set[int] = set()
        if booking.room_id:
            rooms_to_clean.add(booking.room_id)

        if hasattr(booking, "assigned_room_ids") and isinstance(booking.assigned_room_ids, list):
            for rid in booking.assigned_room_ids:
                if rid:
                    rooms_to_clean.add(int(rid))

        housekeeping_tasks_data = []
        for rid in rooms_to_clean:
            room_obj = self.db.query(models.Room).filter(models.Room.id == rid).first()
            staff_id = None
            staff_name = None
            if room_obj and room_obj.assigned_staff_id:
                staff_obj = self.db.query(models.Staff).filter(models.Staff.id == room_obj.assigned_staff_id).first()
                if staff_obj:
                    staff_id = staff_obj.id
                    staff_name = staff_obj.full_name
            if not staff_id:
                last_t = (
                    self.db.query(models.HousekeepingTask)
                    .filter(models.HousekeepingTask.room_id == rid, models.HousekeepingTask.assigned_staff_id.isnot(None))
                    .order_by(models.HousekeepingTask.id.desc())
                    .first()
                )
                if last_t:
                    staff_id = last_t.assigned_staff_id
                    staff_name = last_t.assigned_to
                    if room_obj and not room_obj.assigned_staff_id:
                        room_obj.assigned_staff_id = staff_id

            housekeeping_tasks_data.append({
                "hotel_id": booking.hotel_id,
                "room_id": rid,
                "booking_id": booking.id,
                "task_type": "checkout-cleaning",
                "priority": "normal",
                "status": "pending",
                "assigned_staff_id": staff_id,
                "assigned_to": staff_name,
                "notes": (
                    f"Auto-created after checkout for Booking #{booking.id}"
                    + (f"\nAuto-assigned to {staff_name}" if staff_name else "")
                ),
                "created_by": current_user.username,
            })

        self.repo.complete_checkout_settlement(
            booking=booking,
            invoice=invoice,
            payment_data=payment_data,
            rooms_to_clean=rooms_to_clean,
            housekeeping_tasks_data=housekeeping_tasks_data,
        )

        if folio:
            folio.status = "closed"
            folio.closed_at = datetime.utcnow()
            self.db.commit()

        return {
            "message": "Checkout completed successfully with automated overstay calculation",
            "booking_id": booking.id,
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "extra_nights": extra_nights,
            "extra_room_charges": extra_room_charges,
            "grand_total": invoice.grand_total,
            "paid_amount": invoice.paid_amount,
            "due_amount": invoice.due_amount,
        }

    def get_payments(
        self,
        hotel_id: Optional[int],
        guest_id: Optional[int],
        invoice_id: Optional[int],
        booking_id: Optional[int],
        from_date: Optional[str],
        to_date: Optional[str],
        current_user: models.User,
    ) -> List[models.Payment]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id

        parsed_from = None
        parsed_to = None
        if from_date:
            try:
                parsed_from = datetime.fromisoformat(from_date.strip())
            except ValueError:
                pass
        if to_date:
            try:
                parsed_to = datetime.fromisoformat(to_date.strip())
                if parsed_to.time() == time(0, 0, 0):
                    parsed_to = datetime.combine(parsed_to.date(), time(23, 59, 59, 999999))
            except ValueError:
                pass

        return self.repo.list_payments(
            hotel_id=target_hotel_id,
            guest_id=guest_id,
            invoice_id=invoice_id,
            booking_id=booking_id,
            from_date=parsed_from,
            to_date=parsed_to,
        )