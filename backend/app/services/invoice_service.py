# backend/app/services/invoice_service.py
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.repositories.invoice_repository import InvoiceRepository


class InvoiceService:
    ALLOWED_INVOICE_MANAGERS = [
        "super-admin",
        "hotel-admin",
        "manager",
        "accountant",
        "front-desk",
    ]
    ALLOWED_INVOICE_DELETERS = [
        "super-admin",
        "hotel-admin",
        "manager",
        "accountant",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = InvoiceRepository(db)

    # -------------------------------------------------------------
    # Authorization & Scope Assertions
    # -------------------------------------------------------------

    def _assert_can_manage(self, current_user: models.User, action_label: str) -> None:
        if current_user.role not in self.ALLOWED_INVOICE_MANAGERS:
            raise HTTPException(
                status_code=403,
                detail=f"Only accountant, front-desk, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_can_delete(self, current_user: models.User) -> None:
        if current_user.role not in self.ALLOWED_INVOICE_DELETERS:
            raise HTTPException(
                status_code=403,
                detail="Only accountant, hotel-admin, manager, or super-admin can delete invoices",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Real-Time Checkout Folio Summary (Live Overstay & Actual Advance)
    # -------------------------------------------------------------

    def get_booking_folio_summary(self, booking_id: int, current_user: models.User) -> Dict[str, Any]:
        self._assert_can_manage(current_user, "view checkout folio summary")

        booking = self.repo.get_booking_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(current_user, booking.hotel_id, "Access denied to booking folio")

        hotel = self.repo.get_hotel_by_id(booking.hotel_id)
        grace_mins = getattr(hotel, "checkout_grace_minutes", 60)

        # 1. Overstay Calculation
        now = datetime.utcnow()
        scheduled_checkout = booking.checkout_date
        cutoff_time = scheduled_checkout + timedelta(minutes=grace_mins)

        extra_nights = 0
        extra_room_charges = 0.0

        if now > cutoff_time:
            scheduled_date = scheduled_checkout.date()
            actual_date = now.date()
            extra_nights = max(0, (actual_date - scheduled_date).days)
            if extra_nights > 0:
                original_nights = max(int(booking.nights_count or 1), 1)
                original_total = float(booking.total_amount or 0.0)
                rate_per_night = original_total / original_nights
                extra_room_charges = round(rate_per_night * extra_nights, 2)

        base_room_charges = float(booking.total_amount or 0.0)
        total_room_charges = round(base_room_charges + extra_room_charges, 2)

        # 2. Departmental Charges
        restaurant_orders = self.repo.get_folio_restaurant_orders(booking.id)
        restaurant_total = sum(float(order.total_amount or 0.0) for order in restaurant_orders)

        minibar_charges = self.repo.get_folio_minibar_charges(booking.id)
        minibar_total = sum(float(mb.total_amount or 0.0) for mb in minibar_charges)

        laundry_orders = self.repo.get_folio_laundry_orders(booking.id)
        laundry_total = sum(float(lo.total_amount or 0.0) for lo in laundry_orders)

        extra_items = self.repo.get_folio_extra_charges(booking.id)
        extra_total = sum(float(ec.total_amount or 0.0) for ec in extra_items)

        grand_total = round(
            total_room_charges + restaurant_total + minibar_total + laundry_total + extra_total,
            2,
        )

        # 3. Ledger Advance Verification
        # Sum payments tied to booking (advance + settlements) minus refunds
        payments = (
            self.db.query(models.Payment)
            .filter(
                models.Payment.hotel_id == booking.hotel_id,
                models.Payment.booking_id == booking.id,
                models.Payment.payment_status == "success",
            )
            .all()
        )

        total_collected = sum(
            float(p.amount or 0.0) for p in payments if p.payment_type != "refund"
        )
        total_refunded = sum(
            float(p.amount or 0.0) for p in payments if p.payment_type == "refund"
        )
        net_advance = round(max(total_collected - total_refunded, float(booking.advance_paid or 0.0)), 2)

        if net_advance > grand_total:
            due_amount = 0.0
            refund_due = round(net_advance - grand_total, 2)
            payment_status = "overpaid"
        elif net_advance == grand_total:
            due_amount = 0.0
            refund_due = 0.0
            payment_status = "paid"
        elif net_advance > 0:
            due_amount = round(grand_total - net_advance, 2)
            refund_due = 0.0
            payment_status = "partially_paid"
        else:
            due_amount = grand_total
            refund_due = 0.0
            payment_status = "unpaid"

        return {
            "booking_id": booking.id,
            "reservation_code": booking.reservation_code or f"RES-{booking.id}",
            "room_charges": total_room_charges,
            "base_room_charges": base_room_charges,
            "extra_nights": extra_nights,
            "extra_room_charges": extra_room_charges,
            "restaurant_charges": round(restaurant_total, 2),
            "restaurant_orders_count": len(restaurant_orders),
            "minibar_charges": round(minibar_total, 2),
            "laundry_charges": round(laundry_total, 2),
            "extra_charges": round(extra_total, 2),
            "grand_total": grand_total,
            "advance_paid": net_advance,
            "due_amount": due_amount,
            "refund_due": refund_due,
            "payment_status": payment_status,
        }

    # -------------------------------------------------------------
    # Unbilled Booking Queue & Comprehensive Guest Folio
    # -------------------------------------------------------------

    def get_pending_unbilled_bookings(self, current_user: models.User, hotel_id: Optional[int] = None) -> List[Dict[str, Any]]:
        self._assert_can_manage(current_user, "view pending folios")
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id

        existing_invoice_booking_ids = (
            self.db.query(models.Invoice.booking_id)
            .filter(models.Invoice.hotel_id == target_hotel_id)
            .subquery()
        )

        bookings = (
            self.db.query(models.Booking)
            .options(
                joinedload(models.Booking.guest),
                joinedload(models.Booking.room),
            )
            .filter(
                models.Booking.hotel_id == target_hotel_id,
                models.Booking.status.in_(["checked-in", "checked-out", "confirmed"]),
                ~models.Booking.id.in_(existing_invoice_booking_ids),
            )
            .order_by(models.Booking.id.desc())
            .all()
        )

        # Build room map for quick multi-room number lookup
        rooms = self.db.query(models.Room).filter(models.Room.hotel_id == target_hotel_id).all()
        room_map = {r.id: r.room_number for r in rooms}
        room_type_map = {r.id: r.room_type for r in rooms}

        result = []
        for b in bookings:
            assigned_ids = b.assigned_room_ids
            if isinstance(assigned_ids, str):
                import json
                try:
                    assigned_ids = json.loads(assigned_ids)
                except Exception:
                    assigned_ids = [int(x.strip()) for x in assigned_ids.split(",") if x.strip().isdigit()]
            if not isinstance(assigned_ids, list):
                assigned_ids = [assigned_ids] if assigned_ids else []
            if not assigned_ids and b.room_id:
                assigned_ids = [b.room_id]

            assigned_room_numbers = [str(room_map.get(int(rid), rid)) for rid in assigned_ids if rid is not None]
            primary_room_number = b.room.room_number if b.room else room_map.get(b.room_id)
            primary_room_type = b.room.room_type if b.room else room_type_map.get(b.room_id)

            g = b.guest
            result.append({
                "id": b.id,
                "hotel_id": b.hotel_id,
                "reservation_code": b.reservation_code or f"RES-{b.id}",
                "guest_id": b.guest_id,
                "guest_name": g.full_name if g else "Unknown Guest",
                "guest_phone": g.phone if g else None,
                "guest_email": g.email if g else None,
                "guest_vip_status": getattr(g, "vip_status", "regular") or "regular",
                "guest_type": b.guest_type or "individual",
                "company_name": b.company_name or (g.company_name if g else None),
                "gstin": b.gstin or (g.gstin if g else None),
                "room_id": b.room_id,
                "room_number": primary_room_number,
                "room_type": primary_room_type,
                "rooms_count": b.rooms_count or len(assigned_ids) or 1,
                "assigned_room_ids": assigned_ids,
                "assigned_room_numbers": assigned_room_numbers,
                "checkin_date": b.checkin_date.isoformat() if b.checkin_date else None,
                "checkout_date": b.checkout_date.isoformat() if b.checkout_date else None,
                "nights_count": b.nights_count or 1,
                "days_count": b.days_count or 1,
                "stay_label": b.stay_label or f"{b.nights_count or 1} Night(s)",
                "is_late_checkout": b.is_late_checkout or False,
                "adults": b.adults or 1,
                "children": b.children or 0,
                "booking_source": b.booking_source or "walk-in",
                "status": b.status,
                "room_rate": float(b.room_rate or 0.0),
                "discount": float(b.discount or 0.0),
                "tax": float(b.tax or 0.0),
                "total_amount": float(b.total_amount or 0.0),
                "advance_paid": float(b.advance_paid or 0.0),
                "balance_due": float(max((b.total_amount or 0.0) - (b.advance_paid or 0.0), 0.0)),
                "payment_method": b.payment_method or "cash",
                "payment_status": b.payment_status or "pending",
                "corporate_notes": b.corporate_notes,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            })

        return result

    def get_guest_folio_ledger(self, booking_id: int, current_user: models.User) -> Dict[str, Any]:
        self._assert_can_manage(current_user, "view guest folios")

        booking = self.repo.get_booking_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(current_user, booking.hotel_id, "Access denied to booking folio")

        hotel = self.repo.get_hotel_by_id(booking.hotel_id)
        guest = self.repo.get_guest_by_id(booking.guest_id, booking.hotel_id)
        room = self.db.query(models.Room).filter(models.Room.id == booking.room_id).first()

        line_items: List[Dict[str, Any]] = []

        # 1. Room Stay Line Item (SAC 996311 - Room Accommodation Services)
        nights = max(booking.nights_count or 1, 1)
        base_rate = float(booking.room_rate or 0.0)
        unit_rate = round(base_rate / nights, 2) if nights > 0 else base_rate

        line_items.append({
            "category": "Accommodation",
            "sac_code": "996311",
            "description": f"Room {room.room_number if room else booking.room_id} ({booking.stay_label or f'{nights} Night(s)'})",
            "quantity": nights,
            "unit_price": unit_rate,
            "total": round(base_rate, 2),
        })

        # 2. Restaurant & Dining Orders (SAC 996331 - Restaurant & Food Services)
        restaurant_orders = self.repo.get_folio_restaurant_orders(booking.id)
        restaurant_total = 0.0
        for order in restaurant_orders:
            amt = float(order.total_amount or 0.0)
            restaurant_total += amt
            line_items.append({
                "category": "Restaurant",
                "sac_code": "996331",
                "description": f"Dining Order #{order.id} (Table: {order.table_number or 'In-Room'})",
                "quantity": 1,
                "unit_price": amt,
                "total": amt,
            })

        # 3. Laundry Department (SAC 999799 - Laundry & Dry Cleaning Services)
        laundry_orders = self.repo.get_folio_laundry_orders(booking.id)
        laundry_total = 0.0
        for item in laundry_orders:
            amt = float(item.total_amount or 0.0)
            laundry_total += amt
            line_items.append({
                "category": "Laundry",
                "sac_code": "999799",
                "description": f"{item.item_name} ({item.service_type})",
                "quantity": item.quantity or 1,
                "unit_price": item.price_per_item or amt,
                "total": amt,
            })

        # 4. Minibar Department (SAC 996331 - Beverage & Confectionery Sales)
        minibar_charges = self.repo.get_folio_minibar_charges(booking.id)
        minibar_total = 0.0
        for mb in minibar_charges:
            amt = float(mb.total_amount or 0.0)
            minibar_total += amt
            line_items.append({
                "category": "Minibar",
                "sac_code": "996331",
                "description": mb.item_name,
                "quantity": mb.quantity or 1,
                "unit_price": mb.price_per_item or amt,
                "total": amt,
            })

        # 5. Housekeeping Extra Amenities & Catalog Charges (SAC 999799 - Other Miscellaneous Hospitality Services)
        extra_items = self.repo.get_folio_extra_charges(booking.id)
        extra_total = 0.0
        for ec in extra_items:
            amt = float(ec.total_amount or 0.0)
            extra_total += amt
            line_items.append({
                "category": "Housekeeping",
                "sac_code": "999799",
                "description": ec.charge_name,
                "quantity": ec.quantity or 1,
                "unit_price": ec.rate or amt,
                "total": amt,
            })

        gross_spends = round(base_rate + restaurant_total + laundry_total + minibar_total + extra_total, 2)
        discount_amount = round(float(booking.discount or 0.0), 2)
        net_after_discount = max(gross_spends - discount_amount, 0.0)

        # Statutory Hospitality GST Determination: <= ₹7,500/night = 12%, > ₹7,500 = 18%
        default_gst = 12.0 if (unit_rate <= 7500) else 18.0
        gst_percent = float(booking.tax) if float(booking.tax or 0.0) > 0 else default_gst

        subtotal_excl_tax = round(net_after_discount / (1.0 + (gst_percent / 100.0)), 2)
        tax_amount = round(net_after_discount - subtotal_excl_tax, 2)
        grand_total = round(net_after_discount, 2)

        # Extract State Codes for Statutory Inter-State (IGST) vs Intra-State (CGST + SGST)
        hotel_tax_num = (hotel.tax_number if hotel and hotel.tax_number else "").strip()
        hotel_state = (hotel.state if hotel and hotel.state else "").strip()
        hotel_state_code = hotel_tax_num[:2] if len(hotel_tax_num) >= 2 and hotel_tax_num[:2].isdigit() else ""

        client_gstin = (booking.gstin or (guest.gstin if guest else None) or "").strip()
        client_company = (booking.company_name or (guest.company_name if guest else None) or "").strip()
        client_state_code = client_gstin[:2] if len(client_gstin) >= 2 and client_gstin[:2].isdigit() else ""

        is_inter_state = bool(client_state_code and hotel_state_code and client_state_code != hotel_state_code)

        if is_inter_state:
            igst_rate = gst_percent
            cgst_rate = 0.0
            sgst_rate = 0.0
            igst_amount = tax_amount
            cgst_amount = 0.0
            sgst_amount = 0.0
        else:
            igst_rate = 0.0
            cgst_rate = round(gst_percent / 2.0, 2)
            sgst_rate = round(gst_percent / 2.0, 2)
            cgst_amount = round(tax_amount / 2.0, 2)
            sgst_amount = round(tax_amount - cgst_amount, 2)
            igst_amount = 0.0

        # Build Statutory Tax Schedule aggregated by SAC Code
        sac_summary: Dict[str, Dict[str, Any]] = {}
        for item in line_items:
            sac = item["sac_code"]
            if sac not in sac_summary:
                desc = (
                    "Room Accommodation Service" if sac == "996311"
                    else ("Restaurant & Food Service" if sac == "996331"
                    else "Laundry & Housekeeping Services")
                )
                sac_summary[sac] = {
                    "sac_code": sac,
                    "description": desc,
                    "gross_total": 0.0,
                }
            sac_summary[sac]["gross_total"] += float(item["total"] or 0.0)

        tax_schedule = []
        for sac, s_data in sac_summary.items():
            sac_ratio = (s_data["gross_total"] / gross_spends) if gross_spends > 0 else 0
            sac_taxable = round(subtotal_excl_tax * sac_ratio, 2)
            sac_tax = round(tax_amount * sac_ratio, 2)
            if is_inter_state:
                sac_cgst = 0.0
                sac_sgst = 0.0
                sac_igst = sac_tax
            else:
                sac_cgst = round(sac_tax / 2.0, 2)
                sac_sgst = round(sac_tax - sac_cgst, 2)
                sac_igst = 0.0

            tax_schedule.append({
                "sac_code": sac,
                "description": s_data["description"],
                "taxable_amount": sac_taxable,
                "tax_rate": gst_percent,
                "cgst_rate": cgst_rate,
                "cgst_amount": sac_cgst,
                "sgst_rate": sgst_rate,
                "sgst_amount": sac_sgst,
                "igst_rate": igst_rate,
                "igst_amount": sac_igst,
                "total_tax": sac_tax,
            })

        existing_invoice = self.repo.get_by_booking_id(booking.id)
        existing_folio = self.repo.get_folio_by_booking_id(booking.id)

        # Strictly filter payments for this specific booking or its issued invoice
        if existing_invoice:
            payment_filter = (models.Payment.booking_id == booking.id) | (models.Payment.invoice_id == existing_invoice.id)
        else:
            payment_filter = (models.Payment.booking_id == booking.id)

        payment_records = (
            self.db.query(models.Payment)
            .filter(
                models.Payment.hotel_id == booking.hotel_id,
                payment_filter,
                models.Payment.payment_status == "success",
            )
            .order_by(models.Payment.created_at.asc())
            .all()
        )

        # Derive accurate paid and refunded sums from verified payments
        total_payments_amt = round(sum(float(p.amount or 0.0) for p in payment_records if p.payment_type != "refund"), 2)
        total_refunds_amt = round(sum(float(p.amount or 0.0) for p in payment_records if p.payment_type == "refund"), 2)
        net_payments = round(total_payments_amt - total_refunds_amt, 2)

        booking_adv = round(float(booking.advance_paid or 0.0), 2)
        invoice_paid = round(float(existing_invoice.paid_amount or 0.0), 2) if existing_invoice else 0.0

        effective_paid = max(net_payments, invoice_paid, booking_adv)
        due_balance = round(max(grand_total - effective_paid, 0.0), 2)

        if existing_invoice and existing_invoice.payment_status:
            payment_status = existing_invoice.payment_status
        else:
            payment_status = "paid" if due_balance <= 0 else ("partial" if effective_paid > 0 else "pending")

        itemized_payments = []
        for p in payment_records:
            itemized_payments.append({
                "id": p.id,
                "receipt_number": p.receipt_number or (f"ADV-{p.id}" if p.payment_type == "advance" else f"REC-{p.id}"),
                "payment_type": p.payment_type or "settlement",
                "payment_method": p.payment_method or "cash",
                "transaction_id": p.transaction_id or "—",
                "amount": float(p.amount or 0.0),
                "received_by": p.received_by or "Front Desk",
                "remarks": p.remarks or "",
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

        hotel_addr_parts = [getattr(hotel, "address", ""), getattr(hotel, "city", ""), getattr(hotel, "state", "")]
        resolved_address = ", ".join([p for p in hotel_addr_parts if p and p.strip()])

        return {
            "folio_id": existing_folio.id if existing_folio else None,
            "folio_number": existing_folio.folio_number if existing_folio else None,
            "is_invoiced": existing_invoice is not None,
            "invoice_number": existing_invoice.invoice_number if existing_invoice else None,
            "hotel": {
                "id": hotel.id if hotel else booking.hotel_id,
                "name": hotel.name if hotel else "Hotel",
                "address": resolved_address,
                "city": getattr(hotel, "city", "") or "",
                "state": hotel_state,
                "state_code": hotel_state_code,
                "phone": getattr(hotel, "phone", "") or "",
                "email": getattr(hotel, "email", "") or "",
                "tax_number": hotel_tax_num,
                "place_of_supply": f"{hotel_state} ({hotel_state_code})" if hotel_state and hotel_state_code else (hotel_state or "Hotel Location"),
            },
            "booking": {
                "id": booking.id,
                "reservation_code": booking.reservation_code or f"RES-{booking.id}",
                "checkin_date": booking.checkin_date.isoformat() if booking.checkin_date else None,
                "checkout_date": booking.checkout_date.isoformat() if booking.checkout_date else None,
                "stay_label": booking.stay_label,
                "nights_count": booking.nights_count,
                "days_count": booking.days_count,
                "is_late_checkout": booking.is_late_checkout,
                "room_number": room.room_number if room else str(booking.room_id),
                "room_type": room.room_type if room else "Standard",
                "guest_type": booking.guest_type or ("corporate" if client_gstin else "individual"),
                "company_name": client_company,
                "gstin": client_gstin,
                "client_state_code": client_state_code,
                "billing_type": "B2B (Registered Corporate)" if client_gstin else "B2C (Consumer)",
                "reverse_charge": "No",
                "payment_method": booking.payment_method or "cash",
            },
            "guest": {
                "id": guest.id if guest else booking.guest_id,
                "name": guest.full_name if guest else "Valued Guest",
                "phone": guest.phone if guest else "N/A",
                "email": guest.email if guest else "",
                "address": getattr(guest, "address", "") or "",
                "nationality": getattr(guest, "nationality", "Indian") or "Indian",
                "id_type": guest.id_type if guest else "",
                "id_number": guest.id_number if guest else "",
            },
            "line_items": line_items,
            "payments": itemized_payments,
            "financials": {
                "gross_spends": gross_spends,
                "subtotal": subtotal_excl_tax,
                "taxable_value": subtotal_excl_tax,
                "room_charges": round(base_rate, 2),
                "restaurant_charges": round(restaurant_total, 2),
                "laundry_charges": round(laundry_total, 2),
                "minibar_charges": round(minibar_total, 2),
                "extra_charges": round(extra_total, 2),
                "discount": discount_amount,
                "tax_percent": gst_percent,
                "tax_amount": tax_amount,
                "is_inter_state": is_inter_state,
                "cgst_rate": cgst_rate,
                "cgst": cgst_amount,
                "sgst_rate": sgst_rate,
                "sgst": sgst_amount,
                "igst_rate": igst_rate,
                "igst": igst_amount,
                "grand_total": grand_total,
                "advance_paid": effective_paid,
                "due_balance": due_balance,
                "payment_status": payment_status,
                "tax_schedule": tax_schedule,
            },
        }

    # -------------------------------------------------------------
    # Invoice Generation & Settlements
    # -------------------------------------------------------------

    def generate_invoice_for_booking(self, booking_id: int, current_user: models.User) -> models.Invoice:
        self._assert_can_manage(current_user, "generate invoices")

        existing_invoice = self.repo.get_by_booking_id(booking_id)
        if existing_invoice:
            raise HTTPException(status_code=400, detail="An invoice has already been generated for this booking")

        ledger = self.get_guest_folio_ledger(booking_id, current_user)
        fin = ledger["financials"]
        booking_data = ledger["booking"]
        guest_data = ledger["guest"]

        target_hotel_id = (
            current_user.hotel_id
            or (ledger.get("hotel") or {}).get("id")
            or self.db.query(models.Booking.hotel_id).filter(models.Booking.id == booking_id).scalar()
            or 1
        )

        existing_folio = self.repo.get_folio_by_booking_id(booking_id)
        invoice_number = f"INV-{target_hotel_id}-{booking_id}-{int(datetime.utcnow().timestamp())}"

        invoice_data = {
            "hotel_id": target_hotel_id,
            "guest_id": guest_data["id"],
            "booking_id": booking_id,
            "folio_id": existing_folio.id if existing_folio else None,
            "invoice_number": invoice_number,
            "reservation_code": booking_data["reservation_code"],
            "room_charges": fin["room_charges"],
            "restaurant_charges": fin["restaurant_charges"],
            "laundry_charges": fin["laundry_charges"],
            "minibar_charges": fin["minibar_charges"],
            "extra_charges": fin["extra_charges"],
            "discount": fin["discount"],
            "tax_amount": fin["tax_amount"],
            "taxable_value": fin["subtotal"],
            "cgst": fin.get("cgst", 0.0),
            "sgst": fin.get("sgst", 0.0),
            "igst": fin.get("igst", 0.0),
            "grand_total": fin["grand_total"],
            "paid_amount": fin["advance_paid"],
            "due_amount": fin["due_balance"],
            "invoice_status": "issued",
            "payment_status": fin["payment_status"],
        }

        existing_booking_payments = (
            self.db.query(models.Payment)
            .filter(
                models.Payment.booking_id == booking_id,
            )
            .all()
        )

        advance_payment_data = None
        if len(existing_booking_payments) == 0 and fin["advance_paid"] > 0:
            advance_payment_data = {
                "hotel_id": target_hotel_id,
                "guest_id": guest_data["id"],
                "booking_id": booking_id,
                "folio_id": existing_folio.id if existing_folio else None,
                "payment_type": "advance",
                "amount": fin["advance_paid"],
                "payment_method": booking_data.get("payment_method") or "cash",
                "transaction_id": f"ADV-{booking_id}",
                "payment_status": "success",
                "received_by": current_user.username,
                "remarks": "Advance payment transferred from reservation",
            }

        self.db.query(models.RestaurantOrder).filter(
            models.RestaurantOrder.booking_id == booking_id,
        ).update({models.RestaurantOrder.is_added_to_invoice: True}, synchronize_session=False)

        new_invoice = self.repo.create_invoice(invoice_data, advance_payment_data)

        for p in existing_booking_payments:
            if not p.invoice_id:
                p.invoice_id = new_invoice.id
        self.db.commit()
        self.db.refresh(new_invoice)

        return new_invoice

    def create_invoice(self, invoice: schemas.InvoiceCreate, current_user: models.User) -> models.Invoice:
        self._assert_can_manage(current_user, "create invoices")
        self._assert_owns_hotel(current_user, invoice.hotel_id, "Access denied")

        hotel = self.repo.get_hotel_by_id(invoice.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        guest = self.repo.get_guest_by_id(invoice.guest_id, invoice.hotel_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found for this hotel")

        booking = self.repo.get_booking_for_invoice_creation(
            invoice.booking_id, invoice.hotel_id, invoice.guest_id
        )
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found for this guest and hotel")

        existing_invoice = self.repo.get_by_booking_id(invoice.booking_id)
        if existing_invoice:
            raise HTTPException(status_code=400, detail="Invoice already exists for this booking")

        grand_total = (
            invoice.room_charges
            + invoice.restaurant_charges
            + invoice.laundry_charges
            + invoice.minibar_charges
            + invoice.extra_charges
            + invoice.tax_amount
            - invoice.discount
        )

        if grand_total < 0:
            raise HTTPException(status_code=400, detail="Grand total cannot be negative")

        advance_paid = float(booking.advance_paid or 0.0)
        due_amount = max(round(grand_total - advance_paid, 2), 0.0)
        payment_status = "paid" if due_amount == 0 else ("partial" if advance_paid > 0 else "pending")

        invoice_number = f"INV-{invoice.hotel_id}-{invoice.booking_id}-{int(datetime.utcnow().timestamp())}"
        existing_folio = self.repo.get_folio_by_booking_id(invoice.booking_id)

        invoice_data = {
            "hotel_id": invoice.hotel_id,
            "guest_id": invoice.guest_id,
            "booking_id": invoice.booking_id,
            "folio_id": invoice.folio_id or (existing_folio.id if existing_folio else None),
            "invoice_number": invoice_number,
            "reservation_code": booking.reservation_code,
            "room_charges": invoice.room_charges,
            "restaurant_charges": invoice.restaurant_charges,
            "laundry_charges": invoice.laundry_charges,
            "minibar_charges": invoice.minibar_charges,
            "extra_charges": invoice.extra_charges,
            "discount": invoice.discount,
            "tax_amount": invoice.tax_amount,
            "taxable_value": getattr(invoice, "taxable_value", 0.0) or round(grand_total - invoice.tax_amount, 2),
            "cgst": getattr(invoice, "cgst", 0.0) or round(invoice.tax_amount / 2.0, 2),
            "sgst": getattr(invoice, "sgst", 0.0) or round(invoice.tax_amount / 2.0, 2),
            "igst": getattr(invoice, "igst", 0.0) or 0.0,
            "grand_total": grand_total,
            "paid_amount": advance_paid,
            "due_amount": due_amount,
            "invoice_status": "issued",
            "payment_status": payment_status,
        }

        advance_payment_data = None
        if advance_paid > 0:
            advance_payment_data = {
                "hotel_id": invoice.hotel_id,
                "guest_id": invoice.guest_id,
                "booking_id": invoice.booking_id,
                "folio_id": invoice_data["folio_id"],
                "payment_type": "advance",
                "amount": advance_paid,
                "payment_method": booking.payment_method or "cash",
                "transaction_id": f"ADV-{booking.id}",
                "payment_status": "success",
                "received_by": current_user.username,
                "remarks": "Advance payment recorded from booking",
            }

        return self.repo.create_invoice(invoice_data, advance_payment_data)

    def add_invoice_payment(
        self,
        invoice_id: int,
        payment_data: schemas.PaymentCreate,
        current_user: models.User,
    ) -> models.Payment:
        if current_user.role not in self.ALLOWED_INVOICE_MANAGERS:
            raise HTTPException(status_code=403, detail="Unauthorized to collect payments")

        invoice = self.repo.get_by_id(invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        self._assert_owns_hotel(current_user, invoice.hotel_id, "Access denied")

        if invoice.due_amount <= 0:
            raise HTTPException(status_code=400, detail="Invoice is already fully settled")

        collect_amount = min(float(payment_data.amount), float(invoice.due_amount))
        new_paid_amount = round(float(invoice.paid_amount or 0) + collect_amount, 2)
        new_due_amount = round(max(float(invoice.grand_total) - new_paid_amount, 0.0), 2)
        new_payment_status = "paid" if new_due_amount == 0 else "partial"

        booking = self.repo.get_booking_by_id(invoice.booking_id)

        payment_record_data = {
            "hotel_id": invoice.hotel_id,
            "guest_id": invoice.guest_id,
            "invoice_id": invoice.id,
            "booking_id": invoice.booking_id,
            "folio_id": invoice.folio_id,
            "payment_type": payment_data.payment_type or "settlement",
            "amount": collect_amount,
            "payment_method": payment_data.payment_method,
            "transaction_id": payment_data.transaction_id,
            "payment_status": "success",
            "received_by": current_user.username,
            "remarks": payment_data.remarks or "Checkout balance payment",
        }

        payment = self.repo.add_payment_and_update_balances(
            invoice=invoice,
            booking=booking,
            payment_data=payment_record_data,
            new_paid_amount=new_paid_amount,
            new_due_amount=new_due_amount,
            new_payment_status=new_payment_status,
        )

        allocation = models.InvoicePaymentAllocation(
            invoice_id=invoice.id,
            payment_id=payment.id,
            allocated_amount=collect_amount,
        )
        self.db.add(allocation)
        self.db.commit()

        return payment

    def get_invoices(
        self,
        hotel_id: Optional[int],
        guest_id: Optional[int],
        booking_id: Optional[int],
        payment_status: Optional[str],
        from_date: Optional[str],
        to_date: Optional[str],
        current_user: models.User,
    ) -> List[models.Invoice]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id

        parsed_from = None
        if from_date:
            try:
                parsed_from = datetime.fromisoformat(from_date)
            except Exception:
                pass

        parsed_to = None
        if to_date:
            try:
                parsed_to = datetime.fromisoformat(to_date)
                if len(to_date) <= 10:
                    parsed_to = parsed_to.replace(hour=23, minute=59, second=59)
            except Exception:
                pass

        return self.repo.list_invoices(
            hotel_id=target_hotel_id,
            guest_id=guest_id,
            booking_id=booking_id,
            payment_status=payment_status,
            from_date=parsed_from,
            to_date=parsed_to,
        )

    def get_invoice(self, invoice_id: int, current_user: models.User) -> models.Invoice:
        invoice = self.repo.get_by_id(invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        self._assert_owns_hotel(current_user, invoice.hotel_id, "Access denied")
        return invoice

    def delete_invoice(self, invoice_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_delete(current_user)

        invoice = self.repo.get_by_id(invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        self._assert_owns_hotel(current_user, invoice.hotel_id, "Access denied")

        if self.repo.has_payments(invoice.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete invoice because payment transactions exist for this invoice",
            )

        self.repo.delete_invoice(invoice)
        return {"message": "Invoice deleted successfully"}

    def void_invoice(self, invoice_id: int, reason: str, current_user: models.User) -> models.Invoice:
        self._assert_can_manage(current_user, "void or cancel invoices")

        invoice = self.repo.get_by_id(invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        self._assert_owns_hotel(current_user, invoice.hotel_id, "Access denied to this invoice")

        if invoice.invoice_status == "cancelled":
            raise HTTPException(status_code=400, detail="This invoice has already been cancelled/voided.")

        # Auditor compliance guard: Fully settled invoices CANNOT be voided directly without an approved Credit Note
        st = str(invoice.payment_status or "").lower()
        if st == "paid" or (invoice.due_amount <= 0 and invoice.paid_amount > 0):
            raise HTTPException(
                status_code=400,
                detail="Fully settled invoices cannot be voided directly without issuing an approved Credit Note as per GST audit guidelines.",
            )

        if not reason or len(reason.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="A valid audit cancellation reason (minimum 5 characters) is required.",
            )

        invoice.invoice_status = "cancelled"
        invoice.payment_status = "cancelled"
        invoice.cancellation_reason = reason.strip()
        invoice.cancelled_at = datetime.utcnow()
        invoice.cancelled_by = getattr(current_user, "username", "admin")
        invoice.due_amount = 0.0

        # Unlock any restaurant orders previously marked as added to invoice
        if hasattr(models, "RestaurantOrder"):
            self.db.query(models.RestaurantOrder).filter(
                models.RestaurantOrder.booking_id == invoice.booking_id,
                models.RestaurantOrder.hotel_id == invoice.hotel_id,
            ).update({models.RestaurantOrder.is_added_to_invoice: False}, synchronize_session=False)

        self.db.commit()
        self.db.refresh(invoice)
        return invoice