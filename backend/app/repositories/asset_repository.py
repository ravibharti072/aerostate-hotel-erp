from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class AssetRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Asset Code Generator
    # -------------------------------------------------------------

    def generate_asset_code(self, hotel_id: int, category: Optional[str] = None) -> str:
        current_year = datetime.utcnow().year
        prefix_cat = (category[:3].upper() if category else "AST").strip()
        prefix = f"{prefix_cat}-{current_year}-"

        last_asset = (
            self.db.query(models.MaintenanceAsset)
            .filter(
                models.MaintenanceAsset.hotel_id == hotel_id,
                models.MaintenanceAsset.asset_code.like(f"{prefix}%"),
            )
            .order_by(models.MaintenanceAsset.id.desc())
            .first()
        )

        if not last_asset or not last_asset.asset_code:
            return f"{prefix}0001"

        try:
            last_seq = int(last_asset.asset_code.split("-")[-1])
            new_seq = str(last_seq + 1).zfill(4)
            return f"{prefix}{new_seq}"
        except Exception:
            return f"{prefix}0001"

    # -------------------------------------------------------------
    # Asset Queries & Mutations
    # -------------------------------------------------------------

    def get_by_id(self, asset_id: int) -> Optional[models.MaintenanceAsset]:
        return (
            self.db.query(models.MaintenanceAsset)
            .filter(models.MaintenanceAsset.id == asset_id)
            .first()
        )

    def get_by_code(self, hotel_id: int, asset_code: str) -> Optional[models.MaintenanceAsset]:
        return (
            self.db.query(models.MaintenanceAsset)
            .filter(
                models.MaintenanceAsset.hotel_id == hotel_id,
                models.MaintenanceAsset.asset_code == asset_code,
            )
            .first()
        )

    def list_assets(
        self,
        hotel_id: Optional[int] = None,
        room_id: Optional[int] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[models.MaintenanceAsset]:
        query = self.db.query(models.MaintenanceAsset)

        if hotel_id is not None:
            query = query.filter(models.MaintenanceAsset.hotel_id == hotel_id)
        if room_id is not None:
            query = query.filter(models.MaintenanceAsset.room_id == room_id)
        if category is not None:
            query = query.filter(models.MaintenanceAsset.category == category)
        if status is not None:
            query = query.filter(models.MaintenanceAsset.status == status)

        return query.order_by(models.MaintenanceAsset.id.desc()).all()

    def create_asset(self, asset_data: Dict[str, Any]) -> models.MaintenanceAsset:
        asset = models.MaintenanceAsset(**asset_data)
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def update_asset(
        self,
        asset: models.MaintenanceAsset,
        update_fields: Dict[str, Any],
    ) -> models.MaintenanceAsset:
        for key, value in update_fields.items():
            setattr(asset, key, value)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def delete_asset(self, asset: models.MaintenanceAsset) -> None:
        self.db.delete(asset)
        self.db.commit()

    # -------------------------------------------------------------
    # Maintenance History Lookups
    # -------------------------------------------------------------

    def get_asset_requests(self, asset_id: int) -> List[models.MaintenanceRequest]:
        return (
            self.db.query(models.MaintenanceRequest)
            .filter(models.MaintenanceRequest.asset_id == asset_id)
            .order_by(models.MaintenanceRequest.id.desc())
            .all()
        )

    def get_asset_work_orders(self, asset_id: int) -> List[models.MaintenanceWorkOrder]:
        return (
            self.db.query(models.MaintenanceWorkOrder)
            .filter(models.MaintenanceWorkOrder.asset_id == asset_id)
            .order_by(models.MaintenanceWorkOrder.id.desc())
            .all()
        )

    # -------------------------------------------------------------
    # Cross-Domain Lookups
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_room_by_id(self, room_id: int, hotel_id: int) -> Optional[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(
                models.Room.id == room_id,
                models.Room.hotel_id == hotel_id,
            )
            .first()
        )