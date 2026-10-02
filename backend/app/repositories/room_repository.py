from datetime import date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class RoomRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Room Queries & Mutations
    # -------------------------------------------------------------

    def get_by_id(self, room_id: int) -> Optional[models.Room]:
        return self.db.query(models.Room).filter(models.Room.id == room_id).first()

    def get_by_room_number(self, hotel_id: int, room_number: str) -> Optional[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(
                models.Room.hotel_id == hotel_id,
                models.Room.room_number == room_number,
            )
            .first()
        )

    def list_rooms_by_hotel(self, hotel_id: int) -> List[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(models.Room.hotel_id == hotel_id)
            .order_by(models.Room.id.desc())
            .all()
        )

    def create_room(self, room_data: Dict[str, Any]) -> models.Room:
        new_room = models.Room(**room_data)
        self.db.add(new_room)
        self.db.commit()
        self.db.refresh(new_room)
        return new_room

    def create_rooms_bulk(self, rooms_data: List[Dict[str, Any]]) -> List[models.Room]:
        instances = [models.Room(**data) for data in rooms_data]
        self.db.add_all(instances)
        self.db.commit()
        for inst in instances:
            self.db.refresh(inst)
        return instances

    def update_room(self, room: models.Room, update_fields: Dict[str, Any]) -> models.Room:
        for key, value in update_fields.items():
            setattr(room, key, value)
        self.db.commit()
        self.db.refresh(room)
        return room

    def delete_room(self, room: models.Room) -> None:
        self.db.delete(room)
        self.db.commit()

    # -------------------------------------------------------------
    # Cross-Domain Lookups (Hotel, Bookings)
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def list_hotel_bookings(self, hotel_id: int) -> List[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(models.Booking.hotel_id == hotel_id)
            .all()
        )