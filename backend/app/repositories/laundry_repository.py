from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class LaundryRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Laundry Orders
    # -------------------------------------------------------------

    def get_by_id(self, laundry_id: int) -> Optional[models.LaundryOrder]:
        return (
            self.db.query(models.LaundryOrder)
            .filter(models.LaundryOrder.id == laundry_id)
            .first()
        )

    def list_orders(
        self,
        hotel_id: Optional[int] = None,
        guest_id: Optional[int] = None,
        room_id: Optional[int] = None,
        booking_id: Optional[int] = None,
        status: Optional[str] = None,
        payment_status: Optional[str] = None,
    ) -> List[models.LaundryOrder]:
        query = self.db.query(models.LaundryOrder)

        if hotel_id is not None:
            query = query.filter(models.LaundryOrder.hotel_id == hotel_id)
        if guest_id is not None:
            query = query.filter(models.LaundryOrder.guest_id == guest_id)
        if room_id is not None:
            query = query.filter(models.LaundryOrder.room_id == room_id)
        if booking_id is not None:
            query = query.filter(models.LaundryOrder.booking_id == booking_id)
        if status is not None:
            query = query.filter(models.LaundryOrder.status == status)
        if payment_status is not None:
            query = query.filter(models.LaundryOrder.payment_status == payment_status)

        return query.order_by(models.LaundryOrder.id.desc()).all()

    def create_order(self, order_data: Dict[str, Any]) -> models.LaundryOrder:
        new_order = models.LaundryOrder(**order_data)
        self.db.add(new_order)
        self.db.commit()
        self.db.refresh(new_order)
        return new_order

    def update_order(
        self,
        order: models.LaundryOrder,
        update_fields: Dict[str, Any],
    ) -> models.LaundryOrder:
        for key, value in update_fields.items():
            setattr(order, key, value)
        self.db.commit()
        self.db.refresh(order)
        return order

    def delete_order(self, order: models.LaundryOrder) -> None:
        self.db.delete(order)
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

    def get_booking_for_laundry(
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