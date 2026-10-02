from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class GuestRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, guest_id: int) -> Optional[models.Guest]:
        return self.db.query(models.Guest).filter(models.Guest.id == guest_id).first()

    def get_by_phone(self, hotel_id: int, phone: str) -> Optional[models.Guest]:
        return (
            self.db.query(models.Guest)
            .filter(
                models.Guest.hotel_id == hotel_id,
                models.Guest.phone == phone,
            )
            .first()
        )

    def get_duplicate_phone(
        self, hotel_id: int, phone: str, exclude_guest_id: int
    ) -> Optional[models.Guest]:
        return (
            self.db.query(models.Guest)
            .filter(
                models.Guest.hotel_id == hotel_id,
                models.Guest.phone == phone,
                models.Guest.id != exclude_guest_id,
            )
            .first()
        )

    def list_guests(self, hotel_id: Optional[int] = None) -> List[models.Guest]:
        query = self.db.query(models.Guest)
        if hotel_id is not None:
            query = query.filter(models.Guest.hotel_id == hotel_id)
        return query.order_by(models.Guest.id.desc()).all()

    def create_guest(self, guest_data: Dict[str, Any]) -> models.Guest:
        new_guest = models.Guest(**guest_data)
        self.db.add(new_guest)
        self.db.commit()
        self.db.refresh(new_guest)
        return new_guest

    def update_guest(self, guest: models.Guest, update_fields: Dict[str, Any]) -> models.Guest:
        for key, value in update_fields.items():
            setattr(guest, key, value)
        self.db.commit()
        self.db.refresh(guest)
        return guest

    def delete_guest(self, guest: models.Guest) -> None:
        self.db.delete(guest)
        self.db.commit()

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()