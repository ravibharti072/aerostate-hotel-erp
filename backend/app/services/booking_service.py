import json
import random
import string
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.booking_repository import BookingRepository
from app.services.housekeeping_service import get_last_cleaner_for_room


def get_all_booking_room_ids(booking: models.Booking) -> Set[int]:
    """Helper to reliably extract all room IDs associated with a booking."""
    room_ids = set()
    if booking.room_id:
        room_ids.add(int(booking.room_id))

    raw_assigned = getattr(booking, "assigned_room_ids", None)
    if isinstance(raw_assigned, str):
        try:
            raw_assigned = json.loads(raw_assigned)
        except Exception:
            raw_assigned = []

    if isinstance(raw_assigned, list):
        for rid in raw_assigned:
            if rid is not None:
                try:
                    room_ids.add(int(rid))
                except (ValueError, TypeError):
                    continue

    return room_ids


class BookingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = BookingRepository(db)

    # -------------------------------------------------------------
    # Authorization & Tenant Guards
    # -------------------------------------------------------------

    def _assert_can_manage(self, current_user: models.User, action_label: str = "manage bookings") -> None:
        allowed = ["super-admin", "hotel-admin", "manager", "front-desk"]
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Only front-desk, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_can_delete(self, current_user: models.User) -> None:
        if current_user.role not in ["super-admin", "hotel-admin", "manager"]:
            raise HTTPException(
                status_code=403,
                detail="Only hotel-admin, manager, or super-admin can delete bookings",
            )

    def _assert_can_generate_invoice(self, current_user: models.User) -> None:
        allowed = ["super-admin", "hotel-admin", "manager", "accountant", "front-desk"]
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Only accountant, front-desk, hotel-admin, manager, or super-admin can generate invoice",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    def _resolve_target_hotel_id(self, current_user: models.User, requested_hotel_id: Optional[int]) -> int:
        if current_user.role == "super-admin":
            return requested_hotel_id if requested_hotel_id else current_user.hotel_id
        return current_user.hotel_id

    def generate_reservation_code(self, hotel_id: int) -> str:
        year = datetime.utcnow().strftime("%y")
        for _ in range(10):
            random_digits = "".join(random.choices(string.digits, k=4))
            code = f"RES-{year}-{random_digits}"
            if not self.repo.reservation_code_exists(hotel_id, code):
                return code
        return f"RES-{year}-{int(datetime.utcnow().timestamp()) % 100000:05d}"

    def generate_folio_number(self, hotel_id: int) -> str:
        year = datetime.utcnow().strftime("%y")
        for _ in range(10):
            random_digits = "".join(random.choices(string.digits, k=4))
            code = f"FOL-{year}-{random_digits}"
            exists = self.db.query(models.Folio).filter(
                models.Folio.hotel_id == hotel_id,
                models.Folio.folio_number == code,
            ).first()
            if not exists:
                return code
        return f"FOL-{year}-{int(datetime.utcnow().timestamp()) % 100000:05d}"

    # -------------------------------------------------------------
    # Folio Provisioning Engine (Phase 2)
    # -------------------------------------------------------------

    def get_or_create_folio_for_booking(
        self,
        booking: models.Booking,
        created_by_user: Optional[str] = None,
    ) -> models.Folio:
        """
        Ensures a persistent Folio exists for this booking stay.
        Synchronizes accommodation and extra service charges into FolioCharge records.
        """
        folio = self.db.query(models.Folio).filter(models.Folio.booking_id == booking.id).first()
        if not folio:
            folio_number = self.generate_folio_number(booking.hotel_id)
            folio = models.Folio(
                hotel_id=booking.hotel_id,
                guest_id=booking.guest_id,
                booking_id=booking.id,
                folio_number=folio_number,
                status="open",
                opened_at=datetime.utcnow(),
                notes=f"Folio initialized on check-in for {booking.reservation_code or booking.id}",
            )
            self.db.add(folio)
            self.db.flush()

        # 1. Post/Update Accommodation FolioCharge
        existing_acc_charge = self.db.query(models.FolioCharge).filter(
            models.FolioCharge.folio_id == folio.id,
            models.FolioCharge.department == "Accommodation",
            models.FolioCharge.status != "reversed",
        ).first()

        nights = max(booking.nights_count or 1, 1)
        total_rate = float(booking.room_rate or 0.0)
        nightly_unit_rate = round(total_rate / nights, 2) if nights > 0 else total_rate

        gst_rate = 5.0 if nightly_unit_rate <= 7500 else 18.0
        taxable_amt = round(total_rate / (1.0 + (gst_rate / 100.0)), 2)
        tax_amt = round(total_rate - taxable_amt, 2)

        room = self.db.query(models.Room).filter(models.Room.id == booking.room_id).first()
        room_label = f"Room {room.room_number if room else booking.room_id}"

        if not existing_acc_charge:
            acc_charge = models.FolioCharge(
                hotel_id=booking.hotel_id,
                folio_id=folio.id,
                guest_id=booking.guest_id,
                booking_id=booking.id,
                room_id=booking.room_id,
                department="Accommodation",
                description=f"{room_label} - Stay Charges ({booking.stay_label or f'{nights} Night(s)'})",
                sac_code="996311",
                quantity=nights,
                rate=nightly_unit_rate,
                discount=float(booking.discount or 0.0),
                taxable_amount=taxable_amt,
                tax_rate=gst_rate,
                tax_type="GST",
                tax_amount=tax_amt,
                total_amount=total_rate,
                charge_date=datetime.utcnow(),
                created_by=created_by_user or "System",
                status="posted",
            )
            self.db.add(acc_charge)
        else:
            existing_acc_charge.quantity = nights
            existing_acc_charge.rate = nightly_unit_rate
            existing_acc_charge.taxable_amount = taxable_amt
            existing_acc_charge.tax_rate = gst_rate
            existing_acc_charge.tax_amount = tax_amt
            existing_acc_charge.total_amount = total_rate
            existing_acc_charge.description = f"{room_label} - Stay Charges ({booking.stay_label or f'{nights} Night(s)'})"

        # 2. Sync Extra Charges to FolioCharges
        extra_charges = self.db.query(models.ExtraCharge).filter(
            models.ExtraCharge.booking_id == booking.id,
            models.ExtraCharge.status != "cancelled",
        ).all()

        for ec in extra_charges:
            existing_ec_folio = self.db.query(models.FolioCharge).filter(
                models.FolioCharge.folio_id == folio.id,
                models.FolioCharge.description == ec.charge_name,
                models.FolioCharge.status != "reversed",
            ).first()

            if not existing_ec_folio:
                ec_amt = float(ec.total_amount or 0.0)
                ec_taxable = round(ec_amt / 1.18, 2)
                ec_tax = round(ec_amt - ec_taxable, 2)
                self.db.add(
                    models.FolioCharge(
                        hotel_id=booking.hotel_id,
                        folio_id=folio.id,
                        guest_id=booking.guest_id,
                        booking_id=booking.id,
                        room_id=booking.room_id,
                        department="Extra Bed / Amenities",
                        description=ec.charge_name,
                        sac_code="996331",
                        quantity=ec.quantity or 1,
                        rate=float(ec.rate or ec_amt),
                        discount=0.0,
                        taxable_amount=ec_taxable,
                        tax_rate=18.0,
                        tax_type="GST",
                        tax_amount=ec_tax,
                        total_amount=ec_amt,
                        charge_date=datetime.utcnow(),
                        created_by=created_by_user or "System",
                        status="posted",
                    )
                )

        self.db.commit()
        self.db.refresh(folio)
        return folio

    # -------------------------------------------------------------
    # 11 AM - 11 AM Hospitality Cycle Engine
    # -------------------------------------------------------------

    def calculate_stay_cycle(
        self,
        hotel_id: int,
        checkin_dt: datetime,
        checkout_dt: datetime,
    ) -> Dict[str, Any]:
        """
        Calculates stay metrics based on the hotel's configured check-in/checkout times
        and grace window (defaults to 11:00 AM -> 11:00 AM, 60 min grace).
        """
        if checkin_dt.tzinfo is not None:
            checkin_dt = checkin_dt.replace(tzinfo=None)
        if checkout_dt.tzinfo is not None:
            checkout_dt = checkout_dt.replace(tzinfo=None)

        if checkout_dt <= checkin_dt:
            return {
                "nights_count": 1,
                "days_count": 2,
                "stay_label": "2 Days / 1 Night",
                "is_late_checkout": False,
            }

        hotel = self.repo.get_hotel_by_id(hotel_id)
        checkout_time_str = getattr(hotel, "default_checkout_time", "11:00") or "11:00"
        grace_mins = getattr(hotel, "checkout_grace_minutes", 60)
        if grace_mins is None:
            grace_mins = 60

        try:
            co_hour, co_min = map(int, checkout_time_str.split(":"))
        except Exception:
            co_hour, co_min = 11, 0

        calendar_nights = (checkout_dt.date() - checkin_dt.date()).days
        base_nights = max(calendar_nights, 1)

        cutoff_dt = datetime.combine(
            checkout_dt.date(),
            time(hour=co_hour, minute=co_min)
        ) + timedelta(minutes=grace_mins)

        is_late = False
        billable_nights = base_nights

        if checkout_dt > cutoff_dt:
            billable_nights += 1
            is_late = True

        days_count = billable_nights + 1
        stay_label = f"{days_count} Days / {billable_nights} Night{'s' if billable_nights > 1 else ''}"

        return {
            "nights_count": billable_nights,
            "days_count": days_count,
            "stay_label": stay_label,
            "is_late_checkout": is_late,
        }

    # -------------------------------------------------------------
    # Room Availability
    # -------------------------------------------------------------

    def get_available_rooms(
        self,
        checkin_date: datetime,
        checkout_date: datetime,
        exclude_booking_id: Optional[int],
        hotel_id: Optional[int],
        current_user: models.User,
    ) -> List[models.Room]:
        target_hotel_id = self._resolve_target_hotel_id(current_user, hotel_id)

        ci = checkin_date.replace(tzinfo=None) if checkin_date.tzinfo is not None else checkin_date
        co = checkout_date.replace(tzinfo=None) if checkout_date.tzinfo is not None else checkout_date

        if co <= ci:
            raise HTTPException(
                status_code=400,
                detail="Checkout date must be strictly after check-in date",
            )

        active_bookings = self.repo.get_overlapping_bookings(
            hotel_id=target_hotel_id,
            checkin_date=ci,
            checkout_date=co,
            exclude_booking_id=exclude_booking_id,
        )

        booked_room_ids: Set[int] = set()
        for b in active_bookings:
            booked_room_ids.update(get_all_booking_room_ids(b))

        return self.repo.list_operational_rooms(target_hotel_id, booked_room_ids)

    def get_bookings(
        self,
        hotel_id: Optional[int],
        guest_id: Optional[int],
        room_id: Optional[int],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.Booking]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_bookings(
            hotel_id=target_hotel_id,
            guest_id=guest_id,
            room_id=room_id,
            status=status,
        )

    def get_in_house_guests(
        self,
        hotel_id: Optional[int],
        current_user: models.User,
    ) -> List[Dict[str, Any]]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        bookings = self.repo.list_in_house_bookings(hotel_id=target_hotel_id)
        results = []
        for b in bookings:
            guest = b.guest
            room = b.room
            results.append({
                "booking_id": b.id,
                "guest_id": b.guest_id,
                "guest_name": (guest.full_name if guest and guest.full_name else (guest.name if guest and hasattr(guest, "name") and guest.name else f"Guest #{b.guest_id}")),
                "guest_phone": guest.phone if guest else None,
                "room_id": b.room_id,
                "room_number": room.room_number if room else str(b.room_id),
                "room_type": room.room_type if room else None,
                "reservation_code": b.reservation_code,
                "checkin_date": b.checkin_date,
                "checkout_date": b.checkout_date,
                "status": b.status,
                "hotel_id": b.hotel_id,
                "folio_id": b.folio.id if b.folio else None,
            })
        return results

    def get_booking(self, booking_id: int, current_user: models.User) -> models.Booking:
        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can view only bookings from your own hotel",
        )
        return booking

    # -------------------------------------------------------------
    # Booking Creation (Standard & Direct Check-in)
    # -------------------------------------------------------------

    def create_booking(
        self,
        booking: schemas.BookingCreate,
        current_user: models.User,
    ) -> models.Booking:
        self._assert_can_manage(current_user, "create bookings")
        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can create bookings only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(booking.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        guest = self.repo.get_guest_by_id(booking.guest_id, booking.hotel_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found for this hotel")

        ci = booking.checkin_date.replace(tzinfo=None) if booking.checkin_date.tzinfo is not None else booking.checkin_date
        co = booking.checkout_date.replace(tzinfo=None) if booking.checkout_date.tzinfo is not None else booking.checkout_date

        if co <= ci:
            raise HTTPException(status_code=400, detail="Checkout date must be after check-in date")

        booking_dict = booking.model_dump()
        extra_services = booking_dict.pop("extra_services", [])
        raw_assigned = booking_dict.get("assigned_room_ids") or []

        rooms_to_book = [int(r) for r in raw_assigned if r]
        if not rooms_to_book and booking.room_id:
            rooms_to_book = [int(booking.room_id)]

        if len(rooms_to_book) != len(set(rooms_to_book)):
            raise HTTPException(status_code=400, detail="Duplicate rooms selected for the same reservation")

        matched_rooms = self.repo.get_rooms_by_ids(rooms_to_book, booking.hotel_id)
        if len(matched_rooms) != len(rooms_to_book):
            raise HTTPException(status_code=404, detail="One or more selected rooms were not found for this hotel")

        overlapping_bookings = self.repo.get_overlapping_bookings(
            booking.hotel_id, ci, co
        )
        for ob in overlapping_bookings:
            ob_rooms = get_all_booking_room_ids(ob)
            if any(r in ob_rooms for r in rooms_to_book):
                raise HTTPException(
                    status_code=400,
                    detail="One or more selected rooms are already booked for these dates",
                )

        stay_calc = self.calculate_stay_cycle(
            hotel_id=booking.hotel_id,
            checkin_dt=ci,
            checkout_dt=co,
        )

        valid_booking_fields = {c.name for c in models.Booking.__table__.columns}
        filtered_booking_data = {k: v for k, v in booking_dict.items() if k in valid_booking_fields}
        filtered_booking_data["checkin_date"] = ci
        filtered_booking_data["checkout_date"] = co
        filtered_booking_data["room_id"] = rooms_to_book[0]
        filtered_booking_data["rooms_count"] = len(rooms_to_book)
        filtered_booking_data["assigned_room_ids"] = rooms_to_book
        filtered_booking_data["nights_count"] = stay_calc["nights_count"]
        filtered_booking_data["days_count"] = stay_calc["days_count"]
        filtered_booking_data["stay_label"] = stay_calc["stay_label"]
        filtered_booking_data["is_late_checkout"] = stay_calc["is_late_checkout"]

        if not filtered_booking_data.get("reservation_code"):
            filtered_booking_data["reservation_code"] = self.generate_reservation_code(booking.hotel_id)

        is_direct_checkin = filtered_booking_data.get("status", "").lower() in ["checked-in", "checked_in"]
        room_status_target = "occupied" if is_direct_checkin else "reserved"
        self.repo.update_room_status_by_ids(rooms_to_book, booking.hotel_id, room_status_target)

        initial_advance = round(float(booking.advance_paid or 0.0), 2)
        filtered_booking_data["advance_paid"] = 0.0

        created_booking = self.repo.create_booking(filtered_booking_data, extra_services=extra_services)

        # Automatically record advance payment voucher if advance was collected
        if initial_advance > 0:
            try:
                from app.services.payment_service import PaymentService
                pay_svc = PaymentService(self.db)
                pay_svc.record_advance_payment(
                    schemas.AdvancePaymentCreate(
                        booking_id=created_booking.id,
                        amount=initial_advance,
                        payment_method=created_booking.payment_method or "cash",
                        transaction_id=f"ADV-INIT-{created_booking.id}",
                        remarks="Advance collected at reservation booking time",
                        customer_gstin=created_booking.gstin or None,
                    ),
                    current_user=current_user,
                )
            except Exception as adv_err:
                print(f"Warning: Auto advance voucher creation failed: {adv_err}")

        # If created directly with checked-in status, open Folio immediately
        if is_direct_checkin:
            self.get_or_create_folio_for_booking(created_booking, current_user.username)

        return created_booking

    def create_walk_in_booking(
        self,
        walk_in_data: schemas.WalkInBookingCreate,
        current_user: models.User,
    ) -> models.Booking:
        self._assert_can_manage(current_user, "create walk-in bookings")
        hotel_id = walk_in_data.hotel_id if current_user.role == "super-admin" else current_user.hotel_id

        guest = self.repo.get_guest_by_phone(walk_in_data.phone, hotel_id)
        if not guest:
            guest = self.repo.create_guest({
                "hotel_id": hotel_id,
                "full_name": walk_in_data.full_name,
                "phone": walk_in_data.phone,
                "email": walk_in_data.email,
                "address": walk_in_data.address,
                "nationality": getattr(walk_in_data, "nationality", "Indian") or "Indian",
                "id_type": walk_in_data.id_proof_type,
                "id_number": walk_in_data.id_proof_number,
            })
        else:
            if getattr(walk_in_data, "nationality", None):
                guest.nationality = walk_in_data.nationality
            if walk_in_data.id_proof_type:
                guest.id_type = walk_in_data.id_proof_type
            if walk_in_data.id_proof_number:
                guest.id_number = walk_in_data.id_proof_number
            if walk_in_data.full_name:
                guest.full_name = walk_in_data.full_name
            if walk_in_data.email:
                guest.email = walk_in_data.email
            if walk_in_data.address:
                guest.address = walk_in_data.address
            self.repo.commit()

        raw_assigned = getattr(walk_in_data, "assigned_room_ids", None) or []
        rooms_to_occupy = [int(r) for r in raw_assigned if r]
        if not rooms_to_occupy and walk_in_data.room_id:
            rooms_to_occupy = [int(walk_in_data.room_id)]

        if not rooms_to_occupy:
            raise HTTPException(status_code=400, detail="At least one room must be assigned")

        rooms = self.repo.get_rooms_by_ids(rooms_to_occupy, hotel_id)
        if len(rooms) != len(rooms_to_occupy):
            raise HTTPException(status_code=404, detail="One or more selected rooms were not found")

        for rm in rooms:
            if rm.status in ["occupied", "maintenance", "out-of-order"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Room {rm.room_number} is currently {rm.status} and cannot be checked into",
                )

        ci = walk_in_data.checkin_date.replace(tzinfo=None) if walk_in_data.checkin_date.tzinfo is not None else walk_in_data.checkin_date
        co = walk_in_data.checkout_date.replace(tzinfo=None) if walk_in_data.checkout_date.tzinfo is not None else walk_in_data.checkout_date

        if co <= ci:
            raise HTTPException(status_code=400, detail="Checkout date must be after check-in date")

        overlapping_bookings = self.repo.get_overlapping_bookings(
            hotel_id, ci, co
        )
        for ob in overlapping_bookings:
            ob_rooms = get_all_booking_room_ids(ob)
            if any(r in ob_rooms for r in rooms_to_occupy):
                raise HTTPException(
                    status_code=400,
                    detail="One or more selected rooms are already booked or occupied for these dates",
                )

        stay_calc = self.calculate_stay_cycle(
            hotel_id=hotel_id,
            checkin_dt=ci,
            checkout_dt=co,
        )

        reservation_code = walk_in_data.reservation_code or self.generate_reservation_code(hotel_id)

        booking_dict = {
            "hotel_id": hotel_id,
            "guest_id": guest.id,
            "room_id": rooms_to_occupy[0],
            "reservation_code": reservation_code,
            "rooms_count": len(rooms_to_occupy),
            "assigned_room_ids": rooms_to_occupy,
            "guest_type": getattr(walk_in_data, "guest_type", "individual"),
            "company_name": getattr(walk_in_data, "company_name", None),
            "gstin": getattr(walk_in_data, "gstin", None),
            "corporate_notes": getattr(walk_in_data, "corporate_notes", None),
            "checkin_date": ci,
            "checkout_date": co,
            "nights_count": stay_calc["nights_count"],
            "days_count": stay_calc["days_count"],
            "stay_label": stay_calc["stay_label"],
            "is_late_checkout": stay_calc["is_late_checkout"],
            "adults": walk_in_data.adults,
            "children": walk_in_data.children,
            "booking_source": getattr(walk_in_data, "booking_source", "walk-in") or "walk-in",
            "room_rate": walk_in_data.room_rate,
            "total_amount": walk_in_data.total_amount,
            "advance_paid": 0.0,
            "payment_status": "partial" if float(walk_in_data.advance_paid or 0.0) < float(walk_in_data.total_amount or 0.0) else "paid",
            "payment_method": getattr(walk_in_data, "payment_method", "cash"),
            "status": "checked-in",
        }

        valid_booking_fields = {c.name for c in models.Booking.__table__.columns}
        filtered_booking_dict = {k: v for k, v in booking_dict.items() if k in valid_booking_fields}

        self.repo.update_room_status_by_ids(rooms_to_occupy, hotel_id, "occupied")
        co_guests = getattr(walk_in_data, "co_guests", [])
        booking = self.repo.create_walk_in_booking(filtered_booking_dict, co_guests=co_guests)

        # Walk-in is immediately checked-in: initialize its persistent Folio
        self.get_or_create_folio_for_booking(booking, current_user.username)

        # Auto-create advance payment voucher if advance payment was provided
        initial_walkin_advance = round(float(walk_in_data.advance_paid or 0.0), 2)
        if initial_walkin_advance > 0:
            try:
                from app.services.payment_service import PaymentService
                pay_svc = PaymentService(self.db)
                pay_svc.record_advance_payment(
                    schemas.AdvancePaymentCreate(
                        booking_id=booking.id,
                        amount=initial_walkin_advance,
                        payment_method=booking.payment_method or "cash",
                        transaction_id=f"ADV-WALKIN-{booking.id}",
                        remarks="Advance collected during walk-in check-in",
                        customer_gstin=booking.gstin or None,
                    ),
                    current_user=current_user,
                )
            except Exception as adv_err:
                print(f"Warning: Walk-in advance voucher creation failed: {adv_err}")

        return booking

    # -------------------------------------------------------------
    # Update & Operations
    # -------------------------------------------------------------

    def update_booking(
        self,
        booking_id: int,
        booking_update: schemas.BookingUpdate,
        current_user: models.User,
    ) -> models.Booking:
        self._assert_can_manage(current_user, "update bookings")

        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can update only bookings from your own hotel",
        )

        update_data = booking_update.model_dump(exclude_unset=True)
        extra_services = update_data.pop("extra_services", None)
        raw_assigned = update_data.get("assigned_room_ids") or []

        if current_user.role != "super-admin":
            if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
                raise HTTPException(status_code=403, detail="You cannot move booking to another hotel")

        new_hotel_id = update_data.get("hotel_id", booking.hotel_id)
        new_checkin_date = update_data.get("checkin_date", booking.checkin_date)
        new_checkout_date = update_data.get("checkout_date", booking.checkout_date)

        if new_checkin_date and new_checkin_date.tzinfo is not None:
            new_checkin_date = new_checkin_date.replace(tzinfo=None)
            update_data["checkin_date"] = new_checkin_date

        if new_checkout_date and new_checkout_date.tzinfo is not None:
            new_checkout_date = new_checkout_date.replace(tzinfo=None)
            update_data["checkout_date"] = new_checkout_date

        if new_checkout_date <= new_checkin_date:
            raise HTTPException(status_code=400, detail="Checkout date must be after check-in date")

        target_rooms = [int(r) for r in raw_assigned if r]
        if not target_rooms and update_data.get("room_id"):
            target_rooms = [int(update_data["room_id"])]
        elif not target_rooms:
            target_rooms = list(get_all_booking_room_ids(booking))

        overlapping_bookings = self.repo.get_overlapping_bookings(
            hotel_id=new_hotel_id,
            checkin_date=new_checkin_date,
            checkout_date=new_checkout_date,
            exclude_booking_id=booking_id,
        )
        for ob in overlapping_bookings:
            ob_rooms = get_all_booking_room_ids(ob)
            if any(r in ob_rooms for r in target_rooms):
                raise HTTPException(
                    status_code=400,
                    detail="One or more selected rooms are already booked for these dates",
                )

        old_rooms = get_all_booking_room_ids(booking)
        rooms_to_release = old_rooms - set(target_rooms)
        if rooms_to_release:
            self.repo.update_room_status_by_ids(
                list(rooms_to_release),
                booking.hotel_id,
                "available",
                current_statuses=["reserved"],
            )

        stay_calc = self.calculate_stay_cycle(new_hotel_id, new_checkin_date, new_checkout_date)
        update_data["nights_count"] = stay_calc["nights_count"]
        update_data["days_count"] = stay_calc["days_count"]
        update_data["stay_label"] = stay_calc["stay_label"]
        update_data["is_late_checkout"] = stay_calc["is_late_checkout"]

        new_status = update_data.get("status", booking.status)
        if new_status in ["checked-in", "checked_in"]:
            room_target_status = "occupied"
        elif new_status in ["cancelled", "no-show", "checked-out"]:
            room_target_status = "available"
        else:
            room_target_status = "reserved"
        self.repo.update_room_status_by_ids(target_rooms, booking.hotel_id, room_target_status)

        valid_booking_fields = {c.name for c in models.Booking.__table__.columns}
        filtered_updates = {k: v for k, v in update_data.items() if k in valid_booking_fields}
        filtered_updates["room_id"] = target_rooms[0]
        filtered_updates["rooms_count"] = len(target_rooms)
        filtered_updates["assigned_room_ids"] = target_rooms

        if not booking.reservation_code and not filtered_updates.get("reservation_code"):
            filtered_updates["reservation_code"] = self.generate_reservation_code(booking.hotel_id)

        updated_booking = self.repo.update_booking_and_extra_services(
            booking=booking,
            updates=filtered_updates,
            extra_services=extra_services,
        )

        # If already checked in, keep folio synced
        if updated_booking.status in ["checked-in", "checked_in"]:
            self.get_or_create_folio_for_booking(updated_booking, current_user.username)

        return updated_booking

    def delete_booking(self, booking_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_delete(current_user)

        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can delete only bookings from your own hotel",
        )

        rooms_to_release = get_all_booking_room_ids(booking)
        self.repo.update_room_status_by_ids(
            list(rooms_to_release),
            booking.hotel_id,
            "available",
            current_statuses=["reserved", "occupied"],
        )

        self.repo.delete_booking(booking)
        return {"message": "Booking deleted successfully"}

    def check_in_guest(
        self,
        booking_id: int,
        checkin_data: Optional[schemas.BookingCheckInRequest],
        current_user: models.User,
    ) -> models.Booking:
        self._assert_can_manage(current_user, "check in guests")

        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can check in only bookings from your own hotel",
        )

        if booking.status == "checked-in":
            raise HTTPException(status_code=400, detail="Guest is already checked in")
        if booking.status == "checked-out":
            raise HTTPException(status_code=400, detail="This booking is already checked out")
        if booking.status == "cancelled":
            raise HTTPException(status_code=400, detail="Cancelled booking cannot be checked in")

        if checkin_data:
            guest = self.repo.get_guest_by_id_only(booking.guest_id)
            if guest:
                if checkin_data.primary_id_type:
                    guest.id_type = checkin_data.primary_id_type
                if checkin_data.primary_id_number:
                    guest.id_number = checkin_data.primary_id_number
                if checkin_data.nationality:
                    guest.nationality = checkin_data.nationality

            if checkin_data.corporate_notes is not None:
                booking.corporate_notes = checkin_data.corporate_notes

            if checkin_data.co_guests:
                self.repo.replace_co_guests(booking.id, booking.hotel_id, checkin_data.co_guests)

            if checkin_data.payment_method:
                booking.payment_method = checkin_data.payment_method

        now_dt = datetime.utcnow()
        if checkin_data and (checkin_data.checkin_date or checkin_data.actual_checkin_time):
            custom_ci = checkin_data.checkin_date or checkin_data.actual_checkin_time
            if custom_ci.tzinfo is not None:
                custom_ci = custom_ci.replace(tzinfo=None)
            booking.checkin_date = custom_ci

            if checkin_data.checkout_date:
                custom_co = checkin_data.checkout_date
                if custom_co.tzinfo is not None:
                    custom_co = custom_co.replace(tzinfo=None)
                if custom_co > booking.checkin_date:
                    booking.checkout_date = custom_co

            stay_calc = self.calculate_stay_cycle(booking.hotel_id, booking.checkin_date, booking.checkout_date)
            booking.nights_count = stay_calc["nights_count"]
            booking.days_count = stay_calc["days_count"]
            booking.stay_label = stay_calc["stay_label"]
            booking.is_late_checkout = stay_calc["is_late_checkout"]
        elif booking.checkout_date <= now_dt:
            # If the reservation dates were in the past (overdue / late arrival),
            # rollover stay dates to start from NOW so tape chart and calendar reflect active stay.
            duration_days = max(1, (booking.checkout_date.date() - booking.checkin_date.date()).days)
            booking.checkin_date = now_dt
            booking.checkout_date = now_dt + timedelta(days=duration_days)
            stay_calc = self.calculate_stay_cycle(booking.hotel_id, booking.checkin_date, booking.checkout_date)
            booking.nights_count = stay_calc["nights_count"]
            booking.days_count = stay_calc["days_count"]
            booking.stay_label = stay_calc["stay_label"]
            booking.is_late_checkout = stay_calc["is_late_checkout"]

        rooms_to_occupy = list(get_all_booking_room_ids(booking))
        self.repo.update_room_status_by_ids(rooms_to_occupy, booking.hotel_id, "occupied")

        booking.status = "checked-in"
        if not booking.reservation_code:
            booking.reservation_code = self.generate_reservation_code(booking.hotel_id)

        self.repo.commit()
        self.repo.refresh(booking)

        # Initialize Guest Folio on Check-in
        folio = self.get_or_create_folio_for_booking(booking, current_user.username)

        # Record payment receipt if payment collected during check-in
        if checkin_data and checkin_data.collect_payment and checkin_data.collect_payment > 0:
            try:
                from app.services.payment_service import PaymentService
                collect_amt = float(checkin_data.collect_payment)
                pay_method = checkin_data.payment_method or booking.payment_method or "cash"
                txn_id = getattr(checkin_data, "transaction_id", None) or f"ADV-CHECKIN-{booking.id}"
                pay_svc = PaymentService(self.db)
                pay_svc.record_advance_payment(
                    schemas.AdvancePaymentCreate(
                        booking_id=booking.id,
                        amount=collect_amt,
                        payment_method=pay_method,
                        transaction_id=txn_id,
                        remarks="Payment collected during check-in registration",
                        customer_gstin=booking.gstin or None,
                    ),
                    current_user=current_user,
                )
            except Exception as pay_err:
                print(f"Warning: Failed to create payment record on check-in: {pay_err}")


        return booking

    def check_out_guest(self, booking_id: int, current_user: models.User) -> models.Booking:
        self._assert_can_manage(current_user, "check out guests")

        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can check out only bookings from your own hotel",
        )

        if booking.status != "checked-in":
            raise HTTPException(status_code=400, detail="Only checked-in booking can be checked out")

        now = datetime.utcnow()
        stay_calc = self.calculate_stay_cycle(booking.hotel_id, booking.checkin_date, now)

        rooms_to_clean = get_all_booking_room_ids(booking)
        # The guest has left, so the room belongs in the dirty / departed queue — not in
        # "in cleaning" (that state means an attendant has actually started the turnover).
        self.repo.update_room_status_by_ids(list(rooms_to_clean), booking.hotel_id, "dirty")

        booking.status = "checked-out"
        booking.checkout_date = now
        booking.nights_count = stay_calc["nights_count"]
        booking.days_count = stay_calc["days_count"]
        booking.stay_label = stay_calc["stay_label"]
        booking.is_late_checkout = stay_calc["is_late_checkout"]

        for r_id in rooms_to_clean:
            # Whoever cleaned this room last takes it again — the guest has just left, so the
            # turnover should land in that attendant's queue automatically.
            last_cleaner = get_last_cleaner_for_room(self.db, r_id)
            existing_task = self.repo.get_open_housekeeping_task(booking.hotel_id, r_id)
            if existing_task:
                existing_task.booking_id = booking.id
                existing_task.task_type = "checkout-cleaning"
                existing_task.priority = "high"
                if last_cleaner and not existing_task.assigned_staff_id:
                    existing_task.assigned_staff_id = last_cleaner.assigned_staff_id
                    existing_task.assigned_to = last_cleaner.assigned_to
                existing_task.notes = f"Updated after checkout for booking #{booking.id}"
                existing_task.updated_at = datetime.utcnow()
            else:
                self.repo.create_housekeeping_task({
                    "hotel_id": booking.hotel_id,
                    "room_id": r_id,
                    "booking_id": booking.id,
                    "task_type": "checkout-cleaning",
                    "priority": "high",
                    "status": "pending",
                    "assigned_staff_id": last_cleaner.assigned_staff_id if last_cleaner else None,
                    "assigned_to": last_cleaner.assigned_to if last_cleaner else None,
                    "notes": (
                        f"Auto-created after checkout for booking #{booking.id}"
                        + (f"\nAuto-assigned to {last_cleaner.assigned_to} (last attendant for this room)"
                           if last_cleaner and last_cleaner.assigned_to else "")
                    ),
                    "created_by": current_user.username,
                })

        # Close Folio on checkout
        folio = self.db.query(models.Folio).filter(models.Folio.booking_id == booking.id).first()
        if folio:
            folio.status = "closed"
            folio.closed_at = now

        self.repo.commit()
        self.repo.refresh(booking)
        return booking

    def mark_as_no_show(
        self,
        booking_id: int,
        current_user: models.User,
        reason: Optional[str] = None,
    ) -> models.Booking:
        """
        Marks an un-arrived reservation as No-Show and immediately releases the reserved room(s).
        """
        self._assert_can_manage(current_user, "mark bookings as no-show")

        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can update only bookings from your own hotel",
        )

        if booking.status in ["checked-in", "checked_in"]:
            raise HTTPException(
                status_code=400,
                detail="Checked-in guest cannot be marked as No-Show. Check out or cancel instead.",
            )
        if booking.status == "checked-out":
            raise HTTPException(
                status_code=400,
                detail="Completed booking cannot be marked as No-Show.",
            )

        booking.status = "no-show"
        note_text = f"Marked as No-Show by {current_user.username} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}."
        if reason:
            note_text += f" Reason: {reason}"
        if booking.corporate_notes:
            booking.corporate_notes += f"\n{note_text}"
        else:
            booking.corporate_notes = note_text

        rooms_to_release = list(get_all_booking_room_ids(booking))
        self.repo.update_room_status_by_ids(
            rooms_to_release,
            booking.hotel_id,
            "available",
            current_statuses=["reserved"],
        )

        self.repo.commit()
        self.repo.refresh(booking)
        return booking

    def cancel_booking(
        self,
        booking_id: int,
        current_user: models.User,
        reason: Optional[str] = None,
    ) -> models.Booking:
        """
        Cancels a booking and immediately releases the assigned room(s).
        """
        self._assert_can_manage(current_user, "cancel bookings")

        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can cancel only bookings from your own hotel",
        )

        if booking.status == "checked-out":
            raise HTTPException(status_code=400, detail="Completed booking cannot be cancelled.")

        booking.status = "cancelled"
        cancel_note = f"Cancelled by {current_user.username} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}."
        if reason:
            cancel_note += f" Reason: {reason}"
        if booking.corporate_notes:
            booking.corporate_notes += f"\n{cancel_note}"
        else:
            booking.corporate_notes = cancel_note

        rooms_to_release = list(get_all_booking_room_ids(booking))
        self.repo.update_room_status_by_ids(
            rooms_to_release,
            booking.hotel_id,
            "available",
            current_statuses=["reserved", "occupied"],
        )

        self.repo.commit()
        self.repo.refresh(booking)
        return booking

    def process_no_shows(
        self,
        hotel_id: Optional[int],
        current_user: models.User,
    ) -> Dict[str, Any]:
        """
        Scans for overdue bookings (checkout_date in past, never checked in) and
        automatically marks them as No-Show, releasing reserved rooms.
        """
        self._assert_can_manage(current_user, "process no-shows")

        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        if not target_hotel_id:
            target_hotel_id = 1

        now_dt = datetime.utcnow()

        stale_bookings = (
            self.db.query(models.Booking)
            .filter(
                models.Booking.hotel_id == target_hotel_id,
                models.Booking.status.in_(["confirmed", "reserved", "advance", "pending"]),
                models.Booking.checkout_date < now_dt,
            )
            .all()
        )

        processed_ids = []
        for b in stale_bookings:
            b.status = "no-show"
            auto_note = f"Auto-marked as No-Show on {now_dt.strftime('%Y-%m-%d')}: Guest did not arrive during scheduled reservation window."
            if b.corporate_notes:
                b.corporate_notes += f"\n{auto_note}"
            else:
                b.corporate_notes = auto_note

            rooms_to_release = list(get_all_booking_room_ids(b))
            self.repo.update_room_status_by_ids(
                rooms_to_release,
                b.hotel_id,
                "available",
                current_statuses=["reserved"],
            )
            processed_ids.append(b.id)

        if processed_ids:
            self.db.commit()

        return {
            "processed_count": len(processed_ids),
            "processed_booking_ids": processed_ids,
            "message": f"Successfully processed {len(processed_ids)} overdue bookings into No-Show.",
        }

    # -------------------------------------------------------------
    # Invoice Generation (Phase 1 / Legacy Compatibility)
    # -------------------------------------------------------------

    def generate_invoice_from_booking(
        self,
        booking_id: int,
        invoice_data: schemas.BookingInvoiceCreate,
        current_user: models.User,
    ) -> models.Invoice:
        self._assert_can_generate_invoice(current_user)

        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        self._assert_owns_hotel(
            current_user,
            booking.hotel_id,
            "You can generate invoices only for your own hotel bookings",
        )

        if self.repo.get_invoice_by_booking_id(booking.id):
            raise HTTPException(status_code=400, detail="Invoice already exists for this booking")

        hotel = self.repo.get_hotel_by_id(booking.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        guest = self.repo.get_guest_by_id(booking.guest_id, booking.hotel_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found")

        room_charges = float(booking.total_amount or 0.0)
        restaurant_orders = self.repo.get_unbilled_restaurant_orders(booking.hotel_id, booking.id)
        restaurant_charges = sum(float(order.total_amount or 0.0) for order in restaurant_orders)

        extra_charge_items = self.repo.get_extra_charges_by_booking(booking.hotel_id, booking.id)
        extra_charges = sum(float(item.total_amount or 0.0) for item in extra_charge_items)

        paid_amount = float(booking.advance_paid or 0.0)
        discount = float(invoice_data.discount or 0.0)
        tax_amount = float(invoice_data.tax_amount or booking.tax or 0.0)

        grand_total = room_charges + restaurant_charges + extra_charges + tax_amount - discount
        if grand_total < 0:
            raise HTTPException(status_code=400, detail="Grand total cannot be negative")

        due_amount = max(grand_total - paid_amount, 0.0)

        if paid_amount <= 0:
            payment_status = "pending"
        elif paid_amount < grand_total:
            payment_status = "partial"
        else:
            payment_status = "paid"

        folio = self.db.query(models.Folio).filter(models.Folio.booking_id == booking.id).first()

        invoice_number = f"INV-{booking.hotel_id}-{booking.id}-{int(datetime.utcnow().timestamp())}"

        new_invoice_data = {
            "hotel_id": booking.hotel_id,
            "guest_id": booking.guest_id,
            "booking_id": booking.id,
            "folio_id": folio.id if folio else None,
            "invoice_number": invoice_number,
            "reservation_code": booking.reservation_code,
            "room_charges": round(room_charges, 2),
            "restaurant_charges": round(restaurant_charges, 2),
            "laundry_charges": 0.0,
            "minibar_charges": 0.0,
            "extra_charges": round(extra_charges, 2),
            "discount": round(discount, 2),
            "tax_amount": round(tax_amount, 2),
            "taxable_value": round(grand_total - tax_amount, 2),
            "cgst": round(tax_amount / 2.0, 2),
            "sgst": round(tax_amount / 2.0, 2),
            "igst": 0.0,
            "grand_total": round(grand_total, 2),
            "paid_amount": round(paid_amount, 2),
            "due_amount": round(due_amount, 2),
            "invoice_status": "issued",
            "payment_status": payment_status,
        }

        return self.repo.create_invoice(new_invoice_data, restaurant_orders)