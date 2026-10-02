from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.asset_service import AssetService

router = APIRouter(
    prefix="/maintenance-assets",
    tags=["Maintenance Assets & Equipment"],
)


def get_asset_service(db: Session = Depends(get_db)) -> AssetService:
    return AssetService(db)


@router.post("/", response_model=schemas.MaintenanceAssetResponse)
def create_asset(
    payload: schemas.MaintenanceAssetCreate,
    service: AssetService = Depends(get_asset_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_asset(payload, current_user)


@router.get("/", response_model=List[schemas.MaintenanceAssetResponse])
def get_assets(
    hotel_id: Optional[int] = Query(None),
    room_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service: AssetService = Depends(get_asset_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_assets(
        hotel_id=hotel_id,
        room_id=room_id,
        category=category,
        status=status,
        current_user=current_user,
    )


@router.get("/{asset_id}", response_model=schemas.MaintenanceAssetResponse)
def get_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_asset(asset_id, current_user)


@router.get("/{asset_id}/history", response_model=Dict[str, Any])
def get_asset_history(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_asset_history(asset_id, current_user)


@router.put("/{asset_id}", response_model=schemas.MaintenanceAssetResponse)
def update_asset(
    asset_id: int,
    payload: schemas.MaintenanceAssetUpdate,
    service: AssetService = Depends(get_asset_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_asset(asset_id, payload, current_user)


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_asset(asset_id, current_user)