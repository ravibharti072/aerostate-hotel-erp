from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class MinibarRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Minibar Charges
    # -------------------------------------------------------------

    def get_by_id(self, charge_id: int) -> Optional[models.MinibarCharge]:
        return (
            self.db.query(models.MinibarCharge)
            .filter(models.MinibarCharge.id == charge_id)
            .first()
        )

    def list_charges(
        self,
        hotel_id: Optional[int] = None,
        guest_id: Optional[int] = None,
        room_id: Optional[int] = None,
        booking_id: Optional[int] = None,
        payment_status: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[models.MinibarCharge]:
        query = self.db.query(models.MinibarCharge)

        if hotel_id is not None:
            query = query.filter(models.MinibarCharge.hotel_id == hotel_id)
        if guest_id is not None:
            query = query.filter(models.MinibarCharge.guest_id == guest_id)
        if room_id is not None:
            query = query.filter(models.MinibarCharge.room_id == room_id)
        if booking_id is not None:
            query = query.filter(models.MinibarCharge.booking_id == booking_id)
        if payment_status is not None:
            query = query.filter(models.MinibarCharge.payment_status == payment_status)
        if status is not None:
            query = query.filter(models.MinibarCharge.status == status)

        return query.order_by(models.MinibarCharge.id.desc()).all()

    def create_charge(self, charge_data: Dict[str, Any]) -> models.MinibarCharge:
        new_charge = models.MinibarCharge(**charge_data)
        self.db.add(new_charge)
        self.db.commit()
        self.db.refresh(new_charge)
        return new_charge

    def update_charge(
        self,
        charge: models.MinibarCharge,
        update_fields: Dict[str, Any],
    ) -> models.MinibarCharge:
        for key, value in update_fields.items():
            setattr(charge, key, value)
        self.db.commit()
        self.db.refresh(charge)
        return charge

    def delete_charge(self, charge: models.MinibarCharge) -> None:
        self.db.delete(charge)
        self.db.commit()

    # -------------------------------------------------------------
    # Cross-Domain Lookups (Hotel, Guest, Room, Booking)
    # -------------------------------------------------------------

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

    def get_room_by_id(self, room_id: int, hotel_id: int) -> Optional[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(
                models.Room.id == room_id,
                models.Room.hotel_id == hotel_id,
            )
            .first()
        )

    def get_booking_for_minibar(
        self, booking_id: int, hotel_id: int, guest_id: int, room_id: int
    ) -> Optional[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.id == booking_id,
                models.Booking.hotel_id == hotel_id,
                models.Booking.guest_id == guest_id,
                models.Booking.room_id == room_id,
            )
            .first()
        )