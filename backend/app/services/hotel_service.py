from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.hotel_repository import HotelRepository


class HotelService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = HotelRepository(db)

    def create_hotel(self, hotel: schemas.HotelCreate) -> models.Hotel:
        existing = self.repo.get_by_email(hotel.email)
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Hotel with this email already exists",
            )
        return self.repo.create(hotel.model_dump())

    def get_hotels(self) -> List[models.Hotel]:
        return self.repo.list_all()

    def get_hotel(self, hotel_id: int, current_user: models.User) -> models.Hotel:
        hotel = self.repo.get_by_id(hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        if current_user.role != "super-admin" and current_user.hotel_id != hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only your own hotel",
            )

        return hotel

    def get_hotel_modules(self, hotel_id: int, current_user: models.User) -> Dict[str, List[str]]:
        hotel = self.repo.get_by_id(hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        if current_user.role != "super-admin" and current_user.hotel_id != hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only your own hotel modules",
            )

        modules_list = getattr(hotel, "modules", []) or []
        return {"modules": modules_list}

    def update_hotel_modules(self, hotel_id: int, modules: List[str]) -> Dict[str, Any]:
        hotel = self.repo.get_by_id(hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        updated_hotel = self.repo.update_modules(hotel, modules)
        return {
            "message": "Module permissions updated successfully",
            "modules": updated_hotel.modules,
        }

    def update_hotel(
        self, hotel_id: int, update_data: schemas.HotelUpdate, current_user: models.User
    ) -> models.Hotel:
        if current_user.role != "super-admin" and (
            not current_user.hotel_id or current_user.hotel_id != hotel_id
        ):
            raise HTTPException(status_code=403, detail="You can only update your own hotel")

        if current_user.role not in ["super-admin", "hotel-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only hotel-admin or super-admin can update hotel settings",
            )

        hotel = self.repo.get_by_id(hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        data = update_data.model_dump(exclude_unset=True)
        return self.repo.update(hotel, data)