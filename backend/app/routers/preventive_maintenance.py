from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.preventive_maintenance_service import PreventiveMaintenanceService

router = APIRouter(
    prefix="/preventive-maintenance",
    tags=["Preventive Maintenance"],
)


def get_pm_service(db: Session = Depends(get_db)) -> PreventiveMaintenanceService:
    return PreventiveMaintenanceService(db)


@router.post("/", response_model=schemas.PreventiveMaintenancePlanResponse)
def create_plan(
    payload: schemas.PreventiveMaintenancePlanCreate,
    service: PreventiveMaintenanceService = Depends(get_pm_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_plan(payload, current_user)


@router.get("/", response_model=List[schemas.PreventiveMaintenancePlanResponse])
def get_plans(
    hotel_id: Optional[int] = Query(None),
    asset_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    service: PreventiveMaintenanceService = Depends(get_pm_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_plans(
        hotel_id=hotel_id,
        asset_id=asset_id,
        category=category,
        is_active=is_active,
        current_user=current_user,
    )


@router.get("/{plan_id}", response_model=schemas.PreventiveMaintenancePlanResponse)
def get_plan(
    plan_id: int,
    service: PreventiveMaintenanceService = Depends(get_pm_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_plan(plan_id, current_user)


@router.put("/{plan_id}", response_model=schemas.PreventiveMaintenancePlanResponse)
def update_plan(
    plan_id: int,
    payload: schemas.PreventiveMaintenancePlanUpdate,
    service: PreventiveMaintenanceService = Depends(get_pm_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_plan(plan_id, payload, current_user)


@router.post("/{plan_id}/complete", response_model=schemas.PreventiveMaintenancePlanResponse)
def complete_plan_occurrence(
    plan_id: int,
    service: PreventiveMaintenanceService = Depends(get_pm_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.complete_plan_occurrence(plan_id, current_user)


@router.post("/generate-due", response_model=Dict[str, Any])
def generate_due_work_orders(
    hotel_id: Optional[int] = Query(None),
    service: PreventiveMaintenanceService = Depends(get_pm_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.generate_due_work_orders(hotel_id, current_user)


@router.delete("/{plan_id}")
def delete_plan(
    plan_id: int,
    service: PreventiveMaintenanceService = Depends(get_pm_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_plan(plan_id, current_user)