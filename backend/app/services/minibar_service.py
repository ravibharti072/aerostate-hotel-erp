from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.minibar_repository import MinibarRepository


class MinibarService:
    ALLOWED_MANAGE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "housekeeping",
        "front-desk",
    ]
    ALLOWED_DELETE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "housekeeping",
    ]

    ALLOWED_STATUSES = ["active", "cancelled"]
    ALLOWED_PAYMENT_STATUSES = ["bill-to-room", "paid", "pending"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = MinibarRepository(db)

    # -------------------------------------------------------------
    # Authorization & Scope Assertions
    # -------------------------------------------------------------

    def _assert_can_manage(self, current_user: models.User, action_label: str) -> None:
        if current_user.role not in self.ALLOWED_MANAGE_ROLES:
            raise HTTPException(
                status_code=403,
                detail=f"Only housekeeping, front-desk, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_can_delete(self, current_user: models.User) -> None:
        if current_user.role not in self.ALLOWED_DELETE_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only housekeeping, hotel-admin, manager, or super-admin can delete minibar charges",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Validation Helpers
    # -------------------------------------------------------------

    def _validate_status(self, status: str) -> None:
        if status not in self.ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_STATUSES}",
            )

    def _validate_payment_status(self, payment_status: str) -> None:
        if payment_status not in self.ALLOWED_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_PAYMENT_STATUSES}",
            )

    # -------------------------------------------------------------
    # Core Service Workflows
    # -------------------------------------------------------------

    def create_minibar_charge(
        self,
        charge: schemas.MinibarChargeCreate,
        current_user: models.User,
    ) -> models.MinibarCharge:
        self._assert_can_manage(current_user, "create minibar charges")
        self._assert_owns_hotel(
            current_user,
            charge.hotel_id,
            "You can create minibar charges only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(charge.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        guest = self.repo.get_guest_by_id(charge.guest_id, charge.hotel_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found for this hotel")

        room = self.repo.get_room_by_id(charge.room_id, charge.hotel_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found for this hotel")

        booking = self.repo.get_booking_for_minibar(
            charge.booking_id, charge.hotel_id, charge.guest_id, charge.room_id
        )
        if not booking:
            raise HTTPException(
                status_code=404,
                detail="Booking not found for this hotel, guest and room",
            )

        self._validate_payment_status(charge.payment_status)
        self._validate_status(charge.status)

        if charge.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        if charge.price_per_item < 0:
            raise HTTPException(status_code=400, detail="Price per item cannot be negative")

        total_amount = charge.quantity * charge.price_per_item

        charge_data = {
            "hotel_id": charge.hotel_id,
            "guest_id": charge.guest_id,
            "room_id": charge.room_id,
            "booking_id": charge.booking_id,
            "item_name": charge.item_name,
            "quantity": charge.quantity,
            "price_per_item": charge.price_per_item,
            "total_amount": total_amount,
            "payment_status": charge.payment_status,
            "status": charge.status,
            "remarks": charge.remarks,
        }

        return self.repo.create_charge(charge_data)

    def get_minibar_charges(
        self,
        hotel_id: Optional[int],
        guest_id: Optional[int],
        room_id: Optional[int],
        booking_id: Optional[int],
        payment_status: Optional[str],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.MinibarCharge]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_charges(
            hotel_id=target_hotel_id,
            guest_id=guest_id,
            room_id=room_id,
            booking_id=booking_id,
            payment_status=payment_status,
            status=status,
        )

    def get_minibar_charge(self, charge_id: int, current_user: models.User) -> models.MinibarCharge:
        charge = self.repo.get_by_id(charge_id)
        if not charge:
            raise HTTPException(status_code=404, detail="Minibar charge not found")

        self._assert_owns_hotel(
            current_user,
            charge.hotel_id,
            "You can view only minibar charges from your own hotel",
        )
        return charge

    def update_minibar_charge(
        self,
        charge_id: int,
        charge_update: schemas.MinibarChargeUpdate,
        current_user: models.User,
    ) -> models.MinibarCharge:
        self._assert_can_manage(current_user, "update minibar charges")

        charge = self.repo.get_by_id(charge_id)
        if not charge:
            raise HTTPException(status_code=404, detail="Minibar charge not found")

        self._assert_owns_hotel(
            current_user,
            charge.hotel_id,
            "You can update only minibar charges from your own hotel",
        )

        update_data = charge_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move minibar charge to another hotel",
            )

        if "payment_status" in update_data and update_data["payment_status"] is not None:
            self._validate_payment_status(update_data["payment_status"])

        if "status" in update_data and update_data["status"] is not None:
            self._validate_status(update_data["status"])

        if "quantity" in update_data and update_data["quantity"] is not None and update_data["quantity"] <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        if "price_per_item" in update_data and update_data["price_per_item"] is not None and update_data["price_per_item"] < 0:
            raise HTTPException(status_code=400, detail="Price per item cannot be negative")

        check_hotel_id = update_data.get("hotel_id", charge.hotel_id)
        check_guest_id = update_data.get("guest_id", charge.guest_id)
        check_room_id = update_data.get("room_id", charge.room_id)
        check_booking_id = update_data.get("booking_id", charge.booking_id)

        guest = self.repo.get_guest_by_id(check_guest_id, check_hotel_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found for this hotel")

        room = self.repo.get_room_by_id(check_room_id, check_hotel_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found for this hotel")

        booking = self.repo.get_booking_for_minibar(
            check_booking_id, check_hotel_id, check_guest_id, check_room_id
        )
        if not booking:
            raise HTTPException(
                status_code=404,
                detail="Booking not found for this hotel, guest and room",
            )

        target_quantity = update_data.get("quantity", charge.quantity)
        target_price = update_data.get("price_per_item", charge.price_per_item)
        update_data["total_amount"] = target_quantity * target_price

        return self.repo.update_charge(charge, update_data)

    def delete_minibar_charge(self, charge_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_delete(current_user)

        charge = self.repo.get_by_id(charge_id)
        if not charge:
            raise HTTPException(status_code=404, detail="Minibar charge not found")

        self._assert_owns_hotel(
            current_user,
            charge.hotel_id,
            "You can delete only minibar charges from your own hotel",
        )

        self.repo.delete_charge(charge)
        return {"message": "Minibar charge deleted successfully"}