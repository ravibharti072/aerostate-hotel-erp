from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.guest_repository import GuestRepository


class GuestService:
    ALLOWED_ROLES = ["super-admin", "hotel-admin", "manager", "front-desk"]
    ALLOWED_DELETE_ROLES = ["super-admin", "hotel-admin", "manager"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = GuestRepository(db)

    def _assert_can_manage(self, current_user: models.User, action_label: str) -> None:
        if current_user.role not in self.ALLOWED_ROLES:
            raise HTTPException(
                status_code=403,
                detail=f"Only front-desk, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_can_delete(self, current_user: models.User) -> None:
        if current_user.role not in self.ALLOWED_DELETE_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only hotel-admin, manager, or super-admin can delete guests",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    def create_guest(
        self, guest: schemas.GuestCreate, current_user: models.User
    ) -> models.Guest:
        self._assert_can_manage(current_user, "create guests")
        self._assert_owns_hotel(
            current_user,
            guest.hotel_id,
            "You can create guests only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(guest.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        existing_guest = self.repo.get_by_phone(guest.hotel_id, guest.phone)
        if existing_guest:
            raise HTTPException(
                status_code=400,
                detail="Guest with this phone number already exists in this hotel",
            )

        return self.repo.create_guest(guest.model_dump())

    def get_guests(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> List[models.Guest]:
        target_hotel_id = (
            hotel_id
            if current_user.role == "super-admin" and hotel_id
            else current_user.hotel_id
        )
        return self.repo.list_guests(target_hotel_id)

    def get_guest(self, guest_id: int, current_user: models.User) -> models.Guest:
        guest = self.repo.get_by_id(guest_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found")

        self._assert_owns_hotel(
            current_user,
            guest.hotel_id,
            "You can view only guests from your own hotel",
        )
        return guest

    def update_guest(
        self,
        guest_id: int,
        guest_update: schemas.GuestUpdate,
        current_user: models.User,
    ) -> models.Guest:
        self._assert_can_manage(current_user, "update guests")

        guest = self.repo.get_by_id(guest_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found")

        self._assert_owns_hotel(
            current_user,
            guest.hotel_id,
            "You can update only guests from your own hotel",
        )

        update_data = guest_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move guest to another hotel",
            )

        if "phone" in update_data:
            duplicate_guest = self.repo.get_duplicate_phone(
                guest.hotel_id, update_data["phone"], guest_id
            )
            if duplicate_guest:
                raise HTTPException(
                    status_code=400,
                    detail="Another guest with this phone number already exists in this hotel",
                )

        return self.repo.update_guest(guest, update_data)

    def delete_guest(self, guest_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_delete(current_user)

        guest = self.repo.get_by_id(guest_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found")

        self._assert_owns_hotel(
            current_user,
            guest.hotel_id,
            "You can delete only guests from your own hotel",
        )

        self.repo.delete_guest(guest)
        return {"message": "Guest deleted successfully"}