from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.asset_repository import AssetRepository


class AssetService:
    ALLOWED_MANAGE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "maintenance",
    ]

    ALLOWED_STATUSES = [
        "operational",
        "degraded",
        "broken",
        "under_repair",
        "disposed",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = AssetRepository(db)

    # -------------------------------------------------------------
    # Authorization & Tenant Guards
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

    def _assert_can_manage(self, current_user: models.User) -> None:
        if current_user.role in self.ALLOWED_MANAGE_ROLES or self._has_maintenance_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only maintenance, hotel-admin, manager, or super-admin can manage equipment and assets.",
        )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Asset Workflows
    # -------------------------------------------------------------

    def create_asset(
        self,
        payload: schemas.MaintenanceAssetCreate,
        current_user: models.User,
    ) -> models.MaintenanceAsset:
        self._assert_can_manage(current_user)
        target_hotel_id = payload.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            first_hotel = self.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
            if first_hotel:
                target_hotel_id = first_hotel.id
            else:
                first_hotel = self.db.query(models.Hotel).first()
                target_hotel_id = first_hotel.id if first_hotel else 1

        self._assert_owns_hotel(
            current_user,
            target_hotel_id,
            "You can register assets only for your own hotel.",
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found.")

        if payload.room_id:
            room = self.repo.get_room_by_id(payload.room_id, target_hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Assigned room not found for this hotel.")

        if payload.status not in self.ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid asset status. Allowed values: {self.ALLOWED_STATUSES}",
            )

        asset_data = payload.model_dump()
        asset_data["hotel_id"] = target_hotel_id

        # Generate unique serial tag if not explicitly set
        if not asset_data.get("asset_code") or not asset_data["asset_code"].strip():
            asset_data["asset_code"] = self.repo.generate_asset_code(target_hotel_id, payload.category)
        else:
            existing = self.repo.get_by_code(target_hotel_id, asset_data["asset_code"].strip())
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Asset with code '{asset_data['asset_code']}' already exists in this hotel.",
                )

        return self.repo.create_asset(asset_data)

    def get_assets(
        self,
        hotel_id: Optional[int],
        room_id: Optional[int],
        category: Optional[str],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.MaintenanceAsset]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_assets(
            hotel_id=target_hotel_id,
            room_id=room_id,
            category=category,
            status=status,
        )

    def get_asset(self, asset_id: int, current_user: models.User) -> models.MaintenanceAsset:
        asset = self.repo.get_by_id(asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found.")

        self._assert_owns_hotel(
            current_user,
            asset.hotel_id,
            "You can view only assets from your own hotel.",
        )
        return asset

    def update_asset(
        self,
        asset_id: int,
        payload: schemas.MaintenanceAssetUpdate,
        current_user: models.User,
    ) -> models.MaintenanceAsset:
        self._assert_can_manage(current_user)

        asset = self.repo.get_by_id(asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found.")

        self._assert_owns_hotel(
            current_user,
            asset.hotel_id,
            "You can update only assets from your own hotel.",
        )

        update_data = payload.model_dump(exclude_unset=True)

        if "room_id" in update_data and update_data["room_id"]:
            room = self.repo.get_room_by_id(update_data["room_id"], asset.hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Assigned room not found for this hotel.")

        if "status" in update_data and update_data["status"] is not None:
            if update_data["status"] not in self.ALLOWED_STATUSES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid asset status. Allowed values: {self.ALLOWED_STATUSES}",
                )

        return self.repo.update_asset(asset, update_data)

    def get_asset_history(self, asset_id: int, current_user: models.User) -> Dict[str, Any]:
        """
        Retrieves complete service history (requests, work orders, parts, and costs).
        """
        asset = self.repo.get_by_id(asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found.")

        self._assert_owns_hotel(
            current_user,
            asset.hotel_id,
            "You can view history only for assets in your own hotel.",
        )

        requests = self.repo.get_asset_requests(asset_id)
        work_orders = self.repo.get_asset_work_orders(asset_id)

        total_maintenance_cost = sum(wo.total_cost or 0.0 for wo in work_orders)
        total_downtime_events = len(requests)

        return {
            "asset_id": asset.id,
            "asset_code": asset.asset_code,
            "asset_name": asset.name,
            "category": asset.category,
            "status": asset.status,
            "total_maintenance_cost": round(total_maintenance_cost, 2),
            "total_service_records": total_downtime_events,
            "requests": [
                {
                    "id": r.id,
                    "title": r.issue_title,
                    "priority": r.priority,
                    "status": r.status,
                    "reported_by": r.reported_by,
                    "created_at": r.created_at,
                    "completed_date": r.completed_date,
                }
                for r in requests
            ],
            "work_orders": [
                {
                    "id": wo.id,
                    "work_order_number": wo.work_order_number,
                    "status": wo.status,
                    "diagnosis": wo.diagnosis,
                    "work_performed": wo.work_performed,
                    "total_cost": wo.total_cost,
                    "completed_at": wo.completed_at,
                    "verified_by": wo.verified_by,
                }
                for wo in work_orders
            ],
        }

    def delete_asset(self, asset_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user)

        asset = self.repo.get_by_id(asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found.")

        self._assert_owns_hotel(
            current_user,
            asset.hotel_id,
            "You can delete only assets from your own hotel.",
        )

        self.repo.delete_asset(asset)
        return {"message": "Asset deleted successfully"}