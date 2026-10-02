from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class HotelRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_by_email(self, email: str) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.email == email).first()

    def list_all(self) -> List[models.Hotel]:
        return self.db.query(models.Hotel).order_by(models.Hotel.id.desc()).all()

    def create(self, hotel_data: Dict[str, Any]) -> models.Hotel:
        new_hotel = models.Hotel(**hotel_data)
        if not new_hotel.modules:
            new_hotel.modules = [
                "front-desk",
                "rooms",
                "restaurant",
                "housekeeping",
                "maintenance",
                "inventory",
                "laundry",
                "minibar",
                "accounts",
                "staff",
                "reports",
            ]
        self.db.add(new_hotel)
        self.db.commit()
        self.db.refresh(new_hotel)
        return new_hotel

    def update_modules(self, hotel: models.Hotel, modules: List[str]) -> models.Hotel:
        hotel.modules = modules
        self.db.commit()
        self.db.refresh(hotel)
        return hotel

    def update(self, hotel: models.Hotel, update_data: Dict[str, Any]) -> models.Hotel:
        for key, value in update_data.items():
            setattr(hotel, key, value)
        self.db.commit()
        self.db.refresh(hotel)
        return hotel