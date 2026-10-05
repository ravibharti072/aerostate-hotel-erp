from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.extra_charge_repository import ExtraChargeRepository


class ExtraChargeService:
    # Extra charges are raised against a guest's stay, so front desk must be
    # able to create them; deleting is narrower.
    MANAGE_ROLES = ["super-admin", "hotel-admin", "manager", "front-desk"]
    DELETE_ROLES = ["super-admin", "hotel-admin", "manager"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = ExtraChargeRepository(db)

    # -------------------------------------------------------------
    # Authorization & Tenant Guards
    # -------------------------------------------------------------

    def _resolve_hotel_id(
        self,
        explicit_hotel_id: Optional[int],
        current_user: Optional[models.User],
    ) -> int:
        """
        Resolve which hotel this operation applies to.

        A client-supplied hotel_id is only honoured for a super-admin. Every
        other caller is pinned to their own hotel, so passing another hotel's
        id can no longer read or write across tenants.
        """
        if current_user is None:
            raise HTTPException(status_code=401, detail="Authentication is required")

        if current_user.role == "super-admin":
            if explicit_hotel_id:
                return explicit_hotel_id
            if current_user.hotel_id:
                return current_user.hotel_id
            first_hotel = self.repo.get_first_hotel()
            if not first_hotel:
                raise HTTPException(
                    status_code=400,
                    detail="No hotel exists; a super-admin must specify hotel_id.",
                )
            return first_hotel.id

        if not current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="Your account is not linked to a hotel.",
            )

        if explicit_hotel_id and explicit_hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can only access data for your own hotel.",
            )

        return current_user.hotel_id

    def _assert_can_manage(self, current_user: Optional[models.User], action_label: str) -> None:
        if current_user is None or current_user.role not in self.MANAGE_ROLES:
            raise HTTPException(
                status_code=403,
                detail=f"Only front-desk, hotel-admin, manager or super-admin can {action_label}",
            )

    def _assert_can_delete(self, current_user: Optional[models.User]) -> None:
        if current_user is None or current_user.role not in self.DELETE_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only hotel-admin, manager or super-admin can delete extra charges",
            )

    def _assert_owns_charge(
        self, charge: models.ExtraCharge, current_user: Optional[models.User]
    ) -> None:
        if current_user is None:
            raise HTTPException(status_code=401, detail="Authentication is required")
        if current_user.role != "super-admin" and charge.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="This extra charge belongs to another hotel.",
            )

    def get_service_catalog(
        self,
        hotel_id: Optional[int],
        include_inactive: bool = False,
        current_user: Optional[models.User] = None,
    ) -> List[models.ExtraServiceCatalog]:
        active_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        return self.repo.list_catalog_services(active_hotel_id, include_inactive=include_inactive)

    def add_service_to_catalog(
        self,
        item: schemas.ExtraServiceCatalogCreate,
        current_user: Optional[models.User] = None,
    ) -> models.ExtraServiceCatalog:
        self._assert_can_manage(current_user, "manage the extra service catalog")
        target_hotel_id = self._resolve_hotel_id(item.hotel_id, current_user)
        clean_name = item.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Service name cannot be empty.")

        existing = self.repo.get_catalog_service_by_name(target_hotel_id, clean_name)
        price = float(item.default_price or 0.0)

        if existing:
            return self.repo.update_catalog_service(existing, {"default_price": price, "is_active": True})

        new_catalog_data = {
            "hotel_id": target_hotel_id,
            "name": clean_name,
            "default_price": price,
            "is_active": True,
        }
        return self.repo.create_catalog_service(new_catalog_data)

    def update_catalog_service(
        self,
        item_id: int,
        item_data: schemas.ExtraServiceCatalogUpdate,
        current_user: Optional[models.User] = None,
    ) -> models.ExtraServiceCatalog:
        self._assert_can_manage(current_user, "manage the extra service catalog")
        catalog_item = self.repo.get_catalog_service_by_id(item_id)
        if not catalog_item:
            raise HTTPException(status_code=404, detail="Catalog item not found")

        if (
            current_user.role != "super-admin"
            and catalog_item.hotel_id != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="This catalog item belongs to another hotel.",
            )

        update_dict = item_data.model_dump(exclude_unset=True)
        if "name" in update_dict:
            clean_name = (update_dict["name"] or "").strip()
            if not clean_name:
                raise HTTPException(status_code=400, detail="Service name cannot be empty.")
            update_dict["name"] = clean_name

        if "default_price" in update_dict and update_dict["default_price"] is not None:
            if float(update_dict["default_price"]) < 0:
                raise HTTPException(status_code=400, detail="Default price cannot be negative.")
            update_dict["default_price"] = float(update_dict["default_price"])

        return self.repo.update_catalog_service(catalog_item, update_dict)

    def delete_catalog_service(
        self,
        item_id: int,
        current_user: Optional[models.User] = None,
    ) -> Dict[str, str]:
        self._assert_can_manage(current_user, "manage the extra service catalog")
        catalog_item = self.repo.get_catalog_service_by_id(item_id)
        if not catalog_item:
            raise HTTPException(status_code=404, detail="Catalog item not found")

        if (
            current_user.role != "super-admin"
            and catalog_item.hotel_id != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="This catalog item belongs to another hotel.",
            )

        self.repo.delete_catalog_service(catalog_item)
        return {"message": "Service removed from master catalog successfully"}

    def create_extra_charge(
        self,
        charge: schemas.ExtraChargeCreate,
        current_user: Optional[models.User],
    ) -> models.ExtraCharge:
        self._assert_can_manage(current_user, "create extra charges")
        target_hotel_id = self._resolve_hotel_id(charge.hotel_id, current_user)

        booking = self.repo.get_booking_for_hotel(charge.booking_id, target_hotel_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found for this hotel")

        if charge.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        if charge.rate < 0:
            raise HTTPException(status_code=400, detail="Rate cannot be negative")

        total_amount = round(float(charge.quantity) * float(charge.rate), 2)

        assigned_room = getattr(charge, "room_id", None) or booking.room_id
        if not assigned_room and booking.assigned_room_ids:
            try:
                import json
                raw_ids = booking.assigned_room_ids
                parsed_ids = json.loads(raw_ids) if isinstance(raw_ids, str) else raw_ids
                if isinstance(parsed_ids, list) and len(parsed_ids) > 0:
                    assigned_room = int(parsed_ids[0])
            except Exception:
                pass

        charge_data = {
            "hotel_id": target_hotel_id,
            "booking_id": booking.id,
            "guest_id": booking.guest_id,
            "room_id": assigned_room,
            "charge_name": charge.charge_name.strip(),
            "quantity": charge.quantity,
            "rate": charge.rate,
            "total_amount": total_amount,
            "description": charge.description,
            "status": charge.status or "pending",
        }
        return self.repo.create_charge(charge_data)

    def get_extra_charges(
        self,
        hotel_id: Optional[int],
        current_user: Optional[models.User],
    ) -> List[models.ExtraCharge]:
        active_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        return self.repo.list_charges(active_hotel_id)

    def get_extra_charge(
        self, charge_id: int, current_user: Optional[models.User] = None
    ) -> models.ExtraCharge:
        charge = self.repo.get_charge_by_id(charge_id)
        if not charge:
            raise HTTPException(status_code=404, detail="Extra charge not found")
        self._assert_owns_charge(charge, current_user)
        return charge

    def update_extra_charge(
        self,
        charge_id: int,
        charge_data: schemas.ExtraChargeUpdate,
        current_user: Optional[models.User] = None,
    ) -> models.ExtraCharge:
        self._assert_can_manage(current_user, "update extra charges")
        charge = self.repo.get_charge_by_id(charge_id)
        if not charge:
            raise HTTPException(status_code=404, detail="Extra charge not found")
        self._assert_owns_charge(charge, current_user)

        update_data = charge_data.model_dump(exclude_unset=True)

        if "booking_id" in update_data and update_data["booking_id"]:
            booking = self.repo.get_booking_by_id(update_data["booking_id"])
            if not booking:
                raise HTTPException(status_code=404, detail="Target booking not found")
            # A charge must not be moved onto another hotel's booking.
            if (
                current_user.role != "super-admin"
                and booking.hotel_id != current_user.hotel_id
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You cannot move a charge to another hotel's booking.",
                )
            charge.booking_id = booking.id
            charge.guest_id = booking.guest_id
            update_data["guest_id"] = booking.guest_id

        for field, value in update_data.items():
            setattr(charge, field, value)

        if charge.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        if charge.rate < 0:
            raise HTTPException(status_code=400, detail="Rate cannot be negative")

        update_data["total_amount"] = round(float(charge.quantity) * float(charge.rate), 2)
        return self.repo.update_charge(charge, update_data)

    def delete_extra_charge(
        self, charge_id: int, current_user: Optional[models.User] = None
    ) -> Dict[str, str]:
        self._assert_can_delete(current_user)
        charge = self.repo.get_charge_by_id(charge_id)
        if not charge:
            raise HTTPException(status_code=404, detail="Extra charge not found")
        self._assert_owns_charge(charge, current_user)
        self.repo.delete_charge(charge)
        return {"message": "Charge deleted successfully"}