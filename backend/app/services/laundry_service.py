from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.laundry_repository import LaundryRepository


class LaundryService:
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

    ALLOWED_STATUSES = [
        "received",
        "washing",
        "ironing",
        "ready",
        "delivered",
        "cancelled",
    ]
    ALLOWED_PAYMENT_STATUSES = ["bill-to-room", "paid", "pending"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = LaundryRepository(db)

    # -------------------------------------------------------------
    # Authorization & Tenant Assertions
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
                detail="Only housekeeping, hotel-admin, manager, or super-admin can delete laundry orders",
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
                detail=f"Invalid laundry status. Allowed statuses are: {self.ALLOWED_STATUSES}",
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

    def create_laundry_order(
        self,
        laundry: schemas.LaundryOrderCreate,
        current_user: models.User,
    ) -> models.LaundryOrder:
        self._assert_can_manage(current_user, "create laundry orders")
        self._assert_owns_hotel(
            current_user,
            laundry.hotel_id,
            "You can create laundry orders only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(laundry.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        guest = self.repo.get_guest_by_id(laundry.guest_id, laundry.hotel_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found for this hotel")

        if laundry.room_id:
            room = self.repo.get_room_by_id(laundry.room_id, laundry.hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Room not found for this hotel")

        if laundry.booking_id:
            booking = self.repo.get_booking_for_laundry(
                laundry.booking_id, laundry.hotel_id, laundry.guest_id
            )
            if not booking:
                raise HTTPException(
                    status_code=404,
                    detail="Booking not found for this hotel and guest",
                )

        self._validate_status(laundry.status)
        self._validate_payment_status(laundry.payment_status)

        if laundry.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        if laundry.price_per_item < 0:
            raise HTTPException(status_code=400, detail="Price per item cannot be negative")

        total_amount = laundry.quantity * laundry.price_per_item

        order_data = {
            "hotel_id": laundry.hotel_id,
            "guest_id": laundry.guest_id,
            "room_id": laundry.room_id,
            "booking_id": laundry.booking_id,
            "service_type": laundry.service_type,
            "item_name": laundry.item_name,
            "quantity": laundry.quantity,
            "price_per_item": laundry.price_per_item,
            "total_amount": total_amount,
            "status": laundry.status,
            "payment_status": laundry.payment_status,
            "remarks": laundry.remarks,
        }

        return self.repo.create_order(order_data)

    def get_laundry_orders(
        self,
        hotel_id: Optional[int],
        guest_id: Optional[int],
        room_id: Optional[int],
        booking_id: Optional[int],
        status: Optional[str],
        payment_status: Optional[str],
        current_user: models.User,
    ) -> List[models.LaundryOrder]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_orders(
            hotel_id=target_hotel_id,
            guest_id=guest_id,
            room_id=room_id,
            booking_id=booking_id,
            status=status,
            payment_status=payment_status,
        )

    def get_laundry_order(self, laundry_id: int, current_user: models.User) -> models.LaundryOrder:
        laundry_order = self.repo.get_by_id(laundry_id)
        if not laundry_order:
            raise HTTPException(status_code=404, detail="Laundry order not found")

        self._assert_owns_hotel(
            current_user,
            laundry_order.hotel_id,
            "You can view only laundry orders from your own hotel",
        )
        return laundry_order

    def update_laundry_order(
        self,
        laundry_id: int,
        laundry_update: schemas.LaundryOrderUpdate,
        current_user: models.User,
    ) -> models.LaundryOrder:
        self._assert_can_manage(current_user, "update laundry orders")

        laundry_order = self.repo.get_by_id(laundry_id)
        if not laundry_order:
            raise HTTPException(status_code=404, detail="Laundry order not found")

        self._assert_owns_hotel(
            current_user,
            laundry_order.hotel_id,
            "You can update only laundry orders from your own hotel",
        )

        update_data = laundry_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move laundry order to another hotel",
            )

        if "status" in update_data and update_data["status"] is not None:
            self._validate_status(update_data["status"])

        if "payment_status" in update_data and update_data["payment_status"] not in self.ALLOWED_PAYMENT_STATUSES:
            self._validate_payment_status(update_data["payment_status"])

        if "quantity" in update_data and update_data["quantity"] is not None and update_data["quantity"] <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        if "price_per_item" in update_data and update_data["price_per_item"] is not None and update_data["price_per_item"] < 0:
            raise HTTPException(status_code=400, detail="Price per item cannot be negative")

        check_hotel_id = update_data.get("hotel_id", laundry_order.hotel_id)
        check_guest_id = update_data.get("guest_id", laundry_order.guest_id)

        guest = self.repo.get_guest_by_id(check_guest_id, check_hotel_id)
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found for this hotel")

        if "room_id" in update_data and update_data["room_id"]:
            room = self.repo.get_room_by_id(update_data["room_id"], check_hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Room not found for this hotel")

        if "booking_id" in update_data and update_data["booking_id"]:
            booking = self.repo.get_booking_for_laundry(
                update_data["booking_id"], check_hotel_id, check_guest_id
            )
            if not booking:
                raise HTTPException(
                    status_code=404,
                    detail="Booking not found for this hotel and guest",
                )

        target_quantity = update_data.get("quantity", laundry_order.quantity)
        target_price = update_data.get("price_per_item", laundry_order.price_per_item)
        update_data["total_amount"] = target_quantity * target_price

        return self.repo.update_order(laundry_order, update_data)

    def delete_laundry_order(self, laundry_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_delete(current_user)

        laundry_order = self.repo.get_by_id(laundry_id)
        if not laundry_order:
            raise HTTPException(status_code=404, detail="Laundry order not found")

        self._assert_owns_hotel(
            current_user,
            laundry_order.hotel_id,
            "You can delete only laundry orders from your own hotel",
        )

        self.repo.delete_order(laundry_order)
        return {"message": "Laundry order deleted successfully"}