from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.work_order_service import WorkOrderService

router = APIRouter(
    prefix="/work-orders",
    tags=["Maintenance Work Orders"],
)


def get_work_order_service(db: Session = Depends(get_db)) -> WorkOrderService:
    return WorkOrderService(db)


class ProcurementRequestPayload(BaseModel):
    item_id: int
    quantity: float
    notes: Optional[str] = None


@router.post("/", response_model=schemas.MaintenanceWorkOrderResponse)
def create_work_order(
    payload: schemas.MaintenanceWorkOrderCreate,
    service: WorkOrderService = Depends(get_work_order_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_work_order(payload, current_user)


@router.get("/", response_model=List[schemas.MaintenanceWorkOrderResponse])
def get_work_orders(
    hotel_id: Optional[int] = Query(None),
    maintenance_request_id: Optional[int] = Query(None),
    room_id: Optional[int] = Query(None),
    asset_id: Optional[int] = Query(None),
    technician_staff_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    service: WorkOrderService = Depends(get_work_order_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_work_orders(
        hotel_id=hotel_id,
        maintenance_request_id=maintenance_request_id,
        room_id=room_id,
        asset_id=asset_id,
        technician_staff_id=technician_staff_id,
        status=status,
        priority=priority,
        current_user=current_user,
    )


@router.get("/{work_order_id}", response_model=schemas.MaintenanceWorkOrderResponse)
def get_work_order(
    work_order_id: int,
    service: WorkOrderService = Depends(get_work_order_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_work_order(work_order_id, current_user)


@router.put("/{work_order_id}", response_model=schemas.MaintenanceWorkOrderResponse)
def update_work_order(
    work_order_id: int,
    payload: schemas.MaintenanceWorkOrderUpdate,
    service: WorkOrderService = Depends(get_work_order_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_work_order(work_order_id, payload, current_user)


@router.post("/{work_order_id}/parts", response_model=schemas.MaintenancePartUsageResponse)
def add_work_order_part(
    work_order_id: int,
    payload: schemas.MaintenancePartUsageCreate,
    service: WorkOrderService = Depends(get_work_order_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.add_part_usage(work_order_id, payload, current_user)


@router.post("/{work_order_id}/procurement-request", response_model=Dict[str, Any])
def request_part_procurement(
    work_order_id: int,
    payload: ProcurementRequestPayload,
    service: WorkOrderService = Depends(get_work_order_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.request_part_procurement(
        work_order_id=work_order_id,
        item_id=payload.item_id,
        quantity=payload.quantity,
        current_user=current_user,
        notes=payload.notes,
    )


@router.delete("/{work_order_id}")
def delete_work_order(
    work_order_id: int,
    service: WorkOrderService = Depends(get_work_order_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_work_order(work_order_id, current_user)