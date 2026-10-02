from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class PreventiveMaintenanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, plan_id: int) -> Optional[models.PreventiveMaintenancePlan]:
        return (
            self.db.query(models.PreventiveMaintenancePlan)
            .filter(models.PreventiveMaintenancePlan.id == plan_id)
            .first()
        )

    def list_plans(
        self,
        hotel_id: Optional[int] = None,
        asset_id: Optional[int] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        due_before: Optional[datetime] = None,
    ) -> List[models.PreventiveMaintenancePlan]:
        query = self.db.query(models.PreventiveMaintenancePlan)

        if hotel_id is not None:
            query = query.filter(models.PreventiveMaintenancePlan.hotel_id == hotel_id)
        if asset_id is not None:
            query = query.filter(models.PreventiveMaintenancePlan.asset_id == asset_id)
        if category is not None:
            query = query.filter(models.PreventiveMaintenancePlan.category == category)
        if is_active is not None:
            query = query.filter(models.PreventiveMaintenancePlan.is_active == is_active)
        if due_before is not None:
            query = query.filter(models.PreventiveMaintenancePlan.next_due_date <= due_before)

        return query.order_by(models.PreventiveMaintenancePlan.next_due_date.asc()).all()

    def create_plan(self, plan_data: Dict[str, Any]) -> models.PreventiveMaintenancePlan:
        plan = models.PreventiveMaintenancePlan(**plan_data)
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def update_plan(
        self,
        plan: models.PreventiveMaintenancePlan,
        update_fields: Dict[str, Any],
    ) -> models.PreventiveMaintenancePlan:
        for key, value in update_fields.items():
            setattr(plan, key, value)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def delete_plan(self, plan: models.PreventiveMaintenancePlan) -> None:
        self.db.delete(plan)
        self.db.commit()

    # -------------------------------------------------------------
    # Cross-Domain Lookups
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_asset_by_id(self, asset_id: int, hotel_id: int) -> Optional[models.MaintenanceAsset]:
        return (
            self.db.query(models.MaintenanceAsset)
            .filter(
                models.MaintenanceAsset.id == asset_id,
                models.MaintenanceAsset.hotel_id == hotel_id,
            )
            .first()
        )

    def get_staff_by_id(self, staff_id: int, hotel_id: int) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.id == staff_id,
                models.Staff.hotel_id == hotel_id,
            )
            .first()
        )