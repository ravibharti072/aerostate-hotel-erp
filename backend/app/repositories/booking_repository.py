from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from sqlalchemy.orm import Session

from app import models


class BookingRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Fetch Entities & Cross-Domain Lookups
    # -------------------------------------------------------------

    def get_by_id(self, booking_id: int) -> Optional[models.Booking]:
        return self.db.query(models.Booking).filter(models.Booking.id == booking_id).first()

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_room_by_id(self, room_id: int) -> Optional[models.Room]:
        return self.db.query(models.Room).filter(models.Room.id == room_id).first()

    def get_guest_by_id(self, guest_id: int, hotel_id: int) -> Optional[models.Guest]:
        return (
            self.db.query(models.Guest)
            .filter(
                models.Guest.id == guest_id,
                models.Guest.hotel_id == hotel_id,
            )
            .first()
        )

    def get_guest_by_id_only(self, guest_id: int) -> Optional[models.Guest]:
        return self.db.query(models.Guest).filter(models.Guest.id == guest_id).first()

    def get_guest_by_phone(self, phone: str, hotel_id: int) -> Optional[models.Guest]:
        return (
            self.db.query(models.Guest)
            .filter(
                models.Guest.phone == phone,
                models.Guest.hotel_id == hotel_id,
            )
            .first()
        )

    def get_rooms_by_ids(self, room_ids: List[int], hotel_id: int) -> List[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(
                models.Room.id.in_(room_ids),
                models.Room.hotel_id == hotel_id,
            )
            .all()
        )

    # -------------------------------------------------------------
    # Query Bookings & Availability
    # -------------------------------------------------------------

    def list_bookings(
        self,
        hotel_id: Optional[int] = None,
        guest_id: Optional[int] = None,
        room_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> List[models.Booking]:
        query = self.db.query(models.Booking)
        if hotel_id is not None:
            query = query.filter(models.Booking.hotel_id == hotel_id)
        if guest_id is not None:
            query = query.filter(models.Booking.guest_id == guest_id)
        if room_id is not None:
            query = query.filter(models.Booking.room_id == room_id)
        if status is not None:
            status_clean = status.strip().lower()
            if status_clean in ["checked-in", "checked_in"]:
                query = query.filter(models.Booking.status.in_(["checked-in", "checked_in"]))
            elif status_clean in ["checked-out", "checked_out"]:
                query = query.filter(models.Booking.status.in_(["checked-out", "checked_out"]))
            else:
                query = query.filter(models.Booking.status.ilike(status))
        return query.order_by(models.Booking.id.desc()).all()

    def list_in_house_bookings(
        self,
        hotel_id: Optional[int] = None,
    ) -> List[models.Booking]:
        query = self.db.query(models.Booking).filter(
            models.Booking.status.in_(["checked-in", "checked_in"])
        )
        if hotel_id is not None:
            query = query.filter(models.Booking.hotel_id == hotel_id)
        return query.order_by(models.Booking.checkin_date.desc()).all()

    def get_overlapping_bookings(
        self,
        hotel_id: int,
        checkin_date: datetime,
        checkout_date: datetime,
        exclude_booking_id: Optional[int] = None,
    ) -> List[models.Booking]:
        query = self.db.query(models.Booking).filter(
            models.Booking.hotel_id == hotel_id,
            models.Booking.status.in_(["confirmed", "checked-in", "reserved"]),
            models.Booking.checkin_date < checkout_date,
            models.Booking.checkout_date > checkin_date,
        )
        if exclude_booking_id is not None:
            query = query.filter(models.Booking.id != exclude_booking_id)
        return query.all()

    def list_operational_rooms(
        self,
        hotel_id: int,
        booked_room_ids: Set[int],
    ) -> List[models.Room]:
        query = self.db.query(models.Room).filter(
            models.Room.hotel_id == hotel_id,
            models.Room.status.notin_(["maintenance", "out-of-order"]),
        )
        if booked_room_ids:
            query = query.filter(models.Room.id.notin_(list(booked_room_ids)))
        return query.order_by(models.Room.room_number.asc()).all()

    def reservation_code_exists(self, hotel_id: int, code: str) -> bool:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.hotel_id == hotel_id,
                models.Booking.reservation_code == code,
            )
            .first()
            is not None
        )

    # -------------------------------------------------------------
    # Room Status Management
    # -------------------------------------------------------------

    def update_room_status_by_ids(
        self,
        room_ids: List[int],
        hotel_id: int,
        status: str,
        current_statuses: Optional[List[str]] = None,
    ) -> None:
        if not room_ids:
            return
        query = self.db.query(models.Room).filter(
            models.Room.id.in_(room_ids),
            models.Room.hotel_id == hotel_id,
        )
        if current_statuses:
            query = query.filter(models.Room.status.in_(current_statuses))
        query.update({models.Room.status: status}, synchronize_session=False)
        self.db.commit()

    # -------------------------------------------------------------
    # Booking Creation, Mutation & Guest Management
    # -------------------------------------------------------------

    def create_booking(
        self,
        booking_data: Dict[str, Any],
        extra_services: Optional[List[Dict[str, Any]]] = None,
        auto_occupy_rooms: bool = False,
    ) -> models.Booking:
        new_booking = models.Booking(**booking_data)
        self.db.add(new_booking)
        self.db.flush()

        # Persist extra services if provided
        if extra_services and hasattr(models, "ExtraCharge"):
            for svc in extra_services:
                name = svc.get("name")
                amount = float(svc.get("amount", 0.0))
                if name and amount > 0:
                    self.db.add(
                        models.ExtraCharge(
                            hotel_id=new_booking.hotel_id,
                            booking_id=new_booking.id,
                            guest_id=new_booking.guest_id,
                            room_id=new_booking.room_id,
                            charge_name=name,
                            rate=amount,
                            total_amount=amount,
                            status="pending",
                        )
                    )

        # Direct Check-in Handler: mark assigned rooms as occupied
        if auto_occupy_rooms or new_booking.status.lower() in ["checked-in", "checked_in"]:
            assigned_rooms = new_booking.assigned_room_ids or [new_booking.room_id]
            valid_ids = [int(rid) for rid in assigned_rooms if rid]
            if valid_ids:
                self.db.query(models.Room).filter(
                    models.Room.id.in_(valid_ids),
                    models.Room.hotel_id == new_booking.hotel_id,
                ).update({models.Room.status: "occupied"}, synchronize_session=False)

        self.db.commit()
        self.db.refresh(new_booking)
        return new_booking

    def create_walk_in_booking(
        self,
        booking_data: Dict[str, Any],
        co_guests: Optional[List[Any]] = None,
    ) -> models.Booking:
        booking_data["status"] = "checked-in"
        new_booking = models.Booking(**booking_data)
        self.db.add(new_booking)
        self.db.flush()

        # Handle Co-Guests
        if co_guests and hasattr(models, "BookingGuest"):
            for cg in co_guests:
                name = cg.full_name if hasattr(cg, "full_name") else cg.get("full_name")
                if name:
                    self.db.add(
                        models.BookingGuest(
                            booking_id=new_booking.id,
                            hotel_id=new_booking.hotel_id,
                            full_name=name,
                            gender=cg.gender if hasattr(cg, "gender") else cg.get("gender"),
                            age=cg.age if hasattr(cg, "age") else cg.get("age"),
                            id_type=cg.id_type if hasattr(cg, "id_type") else cg.get("id_type"),
                            id_number=cg.id_number if hasattr(cg, "id_number") else cg.get("id_number"),
                        )
                    )

        # Occupy assigned rooms directly
        assigned_rooms = new_booking.assigned_room_ids or [new_booking.room_id]
        valid_ids = [int(rid) for rid in assigned_rooms if rid]
        if valid_ids:
            self.db.query(models.Room).filter(
                models.Room.id.in_(valid_ids),
                models.Room.hotel_id == new_booking.hotel_id,
            ).update({models.Room.status: "occupied"}, synchronize_session=False)

        self.db.commit()
        self.db.refresh(new_booking)
        return new_booking

    def update_booking_and_extra_services(
        self,
        booking: models.Booking,
        updates: Dict[str, Any],
        extra_services: Optional[List[Dict[str, Any]]] = None,
    ) -> models.Booking:
        for key, value in updates.items():
            setattr(booking, key, value)

        if extra_services is not None and hasattr(models, "ExtraCharge"):
            self.db.query(models.ExtraCharge).filter(
                models.ExtraCharge.booking_id == booking.id
            ).delete()
            for svc in extra_services:
                name = svc.get("name")
                amount = float(svc.get("amount", 0.0))
                if name and amount > 0:
                    self.db.add(
                        models.ExtraCharge(
                            hotel_id=booking.hotel_id,
                            booking_id=booking.id,
                            guest_id=booking.guest_id,
                            room_id=booking.room_id,
                            charge_name=name,
                            rate=amount,
                            total_amount=amount,
                            status="pending",
                        )
                    )

        # If booking status transitioned to checked-in during update
        if updates.get("status") in ["checked-in", "checked_in"]:
            assigned_rooms = booking.assigned_room_ids or [booking.room_id]
            valid_ids = [int(rid) for rid in assigned_rooms if rid]
            if valid_ids:
                self.db.query(models.Room).filter(
                    models.Room.id.in_(valid_ids),
                    models.Room.hotel_id == booking.hotel_id,
                ).update({models.Room.status: "occupied"}, synchronize_session=False)

        self.db.commit()
        self.db.refresh(booking)
        return booking

    def delete_booking(self, booking: models.Booking) -> None:
        assigned_rooms = booking.assigned_room_ids or [booking.room_id]
        valid_ids = [int(rid) for rid in assigned_rooms if rid]
        if valid_ids:
            self.db.query(models.Room).filter(
                models.Room.id.in_(valid_ids),
                models.Room.hotel_id == booking.hotel_id,
                models.Room.status.in_(["occupied", "reserved"]),
            ).update({models.Room.status: "available"}, synchronize_session=False)

        self.db.delete(booking)
        self.db.commit()

    def create_guest(self, guest_data: Dict[str, Any]) -> models.Guest:
        guest = models.Guest(**guest_data)
        self.db.add(guest)
        self.db.commit()
        self.db.refresh(guest)
        return guest

    def replace_co_guests(self, booking_id: int, hotel_id: int, co_guests: List[Any]) -> None:
        if not hasattr(models, "BookingGuest"):
            return
        self.db.query(models.BookingGuest).filter(
            models.BookingGuest.booking_id == booking_id
        ).delete()
        for cg in co_guests:
            name = cg.full_name if hasattr(cg, "full_name") else cg.get("full_name")
            if name and name.strip():
                self.db.add(
                    models.BookingGuest(
                        booking_id=booking_id,
                        hotel_id=hotel_id,
                        full_name=name.strip(),
                        gender=cg.gender if hasattr(cg, "gender") else cg.get("gender"),
                        age=cg.age if hasattr(cg, "age") else cg.get("age"),
                        id_type=cg.id_type if hasattr(cg, "id_type") else cg.get("id_type"),
                        id_number=cg.id_number if hasattr(cg, "id_number") else cg.get("id_number"),
                    )
                )
        self.db.commit()

    # -------------------------------------------------------------
    # Folio & Charge Operations (Phase 2)
    # -------------------------------------------------------------

    def get_folio_by_booking_id(self, booking_id: int) -> Optional[models.Folio]:
        return self.db.query(models.Folio).filter(models.Folio.booking_id == booking_id).first()

    def get_folio_charge(self, folio_id: int, department: str) -> Optional[models.FolioCharge]:
        return (
            self.db.query(models.FolioCharge)
            .filter(
                models.FolioCharge.folio_id == folio_id,
                models.FolioCharge.department == department,
                models.FolioCharge.status != "reversed",
            )
            .first()
        )

    def list_folio_charges(self, folio_id: int) -> List[models.FolioCharge]:
        return (
            self.db.query(models.FolioCharge)
            .filter(
                models.FolioCharge.folio_id == folio_id,
                models.FolioCharge.status != "reversed",
            )
            .order_by(models.FolioCharge.charge_date.asc())
            .all()
        )

    # -------------------------------------------------------------
    # Housekeeping & Billing Integrations
    # -------------------------------------------------------------

    def get_open_housekeeping_task(self, hotel_id: int, room_id: int) -> Optional[models.HousekeepingTask]:
        return (
            self.db.query(models.HousekeepingTask)
            .filter(
                models.HousekeepingTask.hotel_id == hotel_id,
                models.HousekeepingTask.room_id == room_id,
                models.HousekeepingTask.status.in_(["pending", "in-progress"]),
            )
            .first()
        )

    def create_housekeeping_task(self, task_data: Dict[str, Any]) -> models.HousekeepingTask:
        task = models.HousekeepingTask(**task_data)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_invoice_by_booking_id(self, booking_id: int) -> Optional[models.Invoice]:
        return self.db.query(models.Invoice).filter(models.Invoice.booking_id == booking_id).first()

    def get_unbilled_restaurant_orders(self, hotel_id: int, booking_id: int) -> List[Any]:
        if not hasattr(models, "RestaurantOrder"):
            return []
        return (
            self.db.query(models.RestaurantOrder)
            .filter(
                models.RestaurantOrder.hotel_id == hotel_id,
                models.RestaurantOrder.booking_id == booking_id,
                models.RestaurantOrder.billing_type == "transfer_to_booking",
                models.RestaurantOrder.payment_status == "unpaid",
                models.RestaurantOrder.is_added_to_invoice == False,
                models.RestaurantOrder.order_status != "cancelled",
            )
            .all()
        )

    def get_extra_charges_by_booking(self, hotel_id: int, booking_id: int) -> List[Any]:
        if not hasattr(models, "ExtraCharge"):
            return []
        return (
            self.db.query(models.ExtraCharge)
            .filter(
                models.ExtraCharge.hotel_id == hotel_id,
                models.ExtraCharge.booking_id == booking_id,
            )
            .all()
        )

    def create_invoice(self, invoice_data: Dict[str, Any], restaurant_orders: List[Any]) -> models.Invoice:
        invoice = models.Invoice(**invoice_data)
        self.db.add(invoice)
        for order in restaurant_orders:
            order.is_added_to_invoice = True
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance: Any) -> None:
        self.db.refresh(instance)