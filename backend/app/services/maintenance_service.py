from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.maintenance_repository import MaintenanceRepository


class MaintenanceService:
    ALLOWED_MANAGE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "maintenance",
        "housekeeping",
        "front-desk",
        "restaurant",
        "kitchen",
        "inventory",
        "accountant",
        "staff",
    ]
    ALLOWED_UPDATE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "maintenance",
    ]
    ALLOWED_DELETE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
    ]

    ALLOWED_PRIORITIES = ["low", "normal", "medium", "high", "urgent"]
    ALLOWED_STATUSES = [
        "open",
        "assigned",
        "in-progress",
        "pending_parts",
        "completed",
        "verified",
        "closed",
        "cancelled",
    ]
    ALLOWED_SOURCES = [
        "Housekeeping",
        "Front Desk",
        "Guest",
        "Inspection",
        "Restaurant",
        "Kitchen",
        "Management",
        "Direct",
        "Preventive Maintenance",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = MaintenanceRepository(db)

    # -------------------------------------------------------------
    # Authorization & Scope Assertions
    # -------------------------------------------------------------

    def _has_maintenance_module(self, current_user: models.User) -> bool:
        modules = getattr(current_user, "allowed_modules", None)
        if not modules:
            return False
        if isinstance(modules, list):
            return any(str(m).strip().lower() in ["maintenance", "all", "admin"] for m in modules)
        if isinstance(modules, str):
            parts = [p.strip().lower() for p in modules.split(",")]
            return any(m in ["maintenance", "all", "admin"] for m in parts)
        return False

    def _assert_can_create(self, current_user: models.User) -> None:
        if current_user.role in self.ALLOWED_MANAGE_ROLES or self._has_maintenance_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to report maintenance requests.",
        )

    def _assert_can_update(self, current_user: models.User) -> None:
        if current_user.role in self.ALLOWED_UPDATE_ROLES or self._has_maintenance_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="Only maintenance, hotel-admin, manager, or super-admin can update maintenance requests.",
        )

    def _assert_can_delete(self, current_user: models.User) -> None:
        if current_user.role in self.ALLOWED_DELETE_ROLES or self._has_maintenance_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager, or super-admin can delete maintenance requests.",
        )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Validation Helpers
    # -------------------------------------------------------------

    def _validate_priority(self, priority: str) -> None:
        if priority.lower() not in self.ALLOWED_PRIORITIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid priority. Allowed priorities are: {self.ALLOWED_PRIORITIES}",
            )

    def _validate_status(self, status: str) -> None:
        if status.lower() not in self.ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_STATUSES}",
            )

    # -------------------------------------------------------------
    # Workflows
    # -------------------------------------------------------------

    def create_maintenance_request(
        self,
        request: schemas.MaintenanceRequestCreate,
        current_user: models.User,
    ) -> models.MaintenanceRequest:
        self._assert_can_create(current_user)
        self._assert_owns_hotel(
            current_user,
            request.hotel_id,
            "You can create maintenance requests only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(request.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        room = None
        if request.room_id:
            room = self.repo.get_room_by_id(request.room_id, request.hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Room not found for this hotel")

        if request.assigned_staff_id:
            staff = self.repo.get_staff_by_id(request.assigned_staff_id, request.hotel_id)
            if not staff:
                raise HTTPException(status_code=404, detail="Assigned staff not found for this hotel")

        if request.asset_id:
            asset = self.repo.get_asset_by_id(request.asset_id, request.hotel_id)
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found for this hotel")

        target_booking_id = request.booking_id
        if target_booking_id:
            booking = self.repo.get_booking_by_id(target_booking_id, request.hotel_id)
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found for this hotel")
        elif room:
            # Auto-link active booking if reported from Front Desk, Guest, or Staff
            active_stay = self.repo.get_active_booking_for_room(room.id, request.hotel_id)
            if active_stay:
                target_booking_id = active_stay.id

        self._validate_priority(request.priority)
        self._validate_status(request.status)

        if request.estimated_cost < 0:
            raise HTTPException(status_code=400, detail="Estimated cost cannot be negative")

        if request.actual_cost < 0:
            raise HTTPException(status_code=400, detail="Actual cost cannot be negative")

        if request.completed_date and request.start_date:
            if request.completed_date < request.start_date:
                raise HTTPException(
                    status_code=400,
                    detail="Completed date cannot be before start date",
                )

        payload_data = request.model_dump()
        payload_data["booking_id"] = target_booking_id
        payload_data["created_by_user_id"] = current_user.id
        if not payload_data.get("reported_by"):
            payload_data["reported_by"] = current_user.full_name or current_user.username

        return self.repo.create_request(
            request_data=payload_data,
            room=room,
            blocks_room=request.blocks_room,
        )

    def get_maintenance_requests(
        self,
        hotel_id: Optional[int],
        room_id: Optional[int],
        assigned_staff_id: Optional[int],
        priority: Optional[str],
        status: Optional[str],
        source: Optional[str],
        category: Optional[str],
        asset_id: Optional[int],
        current_user: models.User,
    ) -> List[models.MaintenanceRequest]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_requests(
            hotel_id=target_hotel_id,
            room_id=room_id,
            assigned_staff_id=assigned_staff_id,
            priority=priority,
            status=status,
            source=source,
            category=category,
            asset_id=asset_id,
        )

    def get_maintenance_request(
        self,
        request_id: int,
        current_user: models.User,
    ) -> models.MaintenanceRequest:
        maintenance_request = self.repo.get_by_id(request_id)
        if not maintenance_request:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        self._assert_owns_hotel(
            current_user,
            maintenance_request.hotel_id,
            "You can view only maintenance requests from your own hotel",
        )
        return maintenance_request

    def update_maintenance_request(
        self,
        request_id: int,
        request_update: schemas.MaintenanceRequestUpdate,
        current_user: models.User,
    ) -> models.MaintenanceRequest:
        self._assert_can_update(current_user)

        maintenance_request = self.repo.get_by_id(request_id)
        if not maintenance_request:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        self._assert_owns_hotel(
            current_user,
            maintenance_request.hotel_id,
            "You can update only maintenance requests from your own hotel",
        )

        update_data = request_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move maintenance request to another hotel",
            )

        if "priority" in update_data and update_data["priority"] is not None:
            self._validate_priority(update_data["priority"])

        if "status" in update_data and update_data["status"] is not None:
            self._validate_status(update_data["status"])
            if update_data["status"] in ["completed", "verified", "closed"]:
                update_data["completed_by_user_id"] = current_user.id
                if not update_data.get("completed_date"):
                    update_data["completed_date"] = datetime.utcnow()

        if "estimated_cost" in update_data and update_data["estimated_cost"] is not None and update_data["estimated_cost"] < 0:
            raise HTTPException(status_code=400, detail="Estimated cost cannot be negative")

        if "actual_cost" in update_data and update_data["actual_cost"] is not None and update_data["actual_cost"] < 0:
            raise HTTPException(status_code=400, detail="Actual cost cannot be negative")

        check_hotel_id = update_data.get("hotel_id", maintenance_request.hotel_id)

        if "room_id" in update_data and update_data["room_id"]:
            room = self.repo.get_room_by_id(update_data["room_id"], check_hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Room not found for this hotel")

        if "assigned_staff_id" in update_data and update_data["assigned_staff_id"]:
            staff = self.repo.get_staff_by_id(update_data["assigned_staff_id"], check_hotel_id)
            if not staff:
                raise HTTPException(status_code=404, detail="Assigned staff not found for this hotel")

        if "asset_id" in update_data and update_data["asset_id"]:
            asset = self.repo.get_asset_by_id(update_data["asset_id"], check_hotel_id)
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found for this hotel")

        target_start = update_data.get("start_date", maintenance_request.start_date)
        target_completed = update_data.get("completed_date", maintenance_request.completed_date)

        if target_completed and target_start and target_completed < target_start:
            raise HTTPException(
                status_code=400,
                detail="Completed date cannot be before start date",
            )

        target_room_id = update_data.get("room_id", maintenance_request.room_id)
        target_room = None
        if target_room_id:
            target_room = self.repo.get_room_by_id(target_room_id, check_hotel_id)

        return self.repo.update_request(
            maintenance_request=maintenance_request,
            update_fields=update_data,
            room=target_room,
            target_status=update_data.get("status"),
        )

    def delete_maintenance_request(
        self,
        request_id: int,
        current_user: models.User,
    ) -> Dict[str, str]:
        self._assert_can_delete(current_user)

        maintenance_request = self.repo.get_by_id(request_id)
        if not maintenance_request:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        self._assert_owns_hotel(
            current_user,
            maintenance_request.hotel_id,
            "You can delete only maintenance requests from your own hotel",
        )

        self.repo.delete_request(maintenance_request)
        return {"message": "Maintenance request deleted successfully"}