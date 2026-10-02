from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.extra_charge_service import ExtraChargeService

router = APIRouter(
    prefix="/extra-charges",
    tags=["Extra Services & Charges"],
)


def get_extra_charge_service(db: Session = Depends(get_db)) -> ExtraChargeService:
    return ExtraChargeService(db)


# -------------------------------------------------------------
# MASTER EXTRA SERVICE CATALOG
# -------------------------------------------------------------

@router.get("/catalog", response_model=List[schemas.ExtraServiceCatalogResponse])
def get_service_catalog(
    hotel_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    service: ExtraChargeService = Depends(get_extra_charge_service),
    current_user: Optional[models.User] = Depends(get_current_user),
):
    return service.get_service_catalog(hotel_id, include_inactive, current_user)


@router.post("/catalog", response_model=schemas.ExtraServiceCatalogResponse)
def add_service_to_catalog(
    item: schemas.ExtraServiceCatalogCreate,
    service: ExtraChargeService = Depends(get_extra_charge_service),
    current_user: Optional[models.User] = Depends(get_current_user),
):
    return service.add_service_to_catalog(item, current_user)


@router.put("/catalog/{item_id}", response_model=schemas.ExtraServiceCatalogResponse)
def update_service_in_catalog(
    item_id: int,
    item_data: schemas.ExtraServiceCatalogUpdate,
    service: ExtraChargeService = Depends(get_extra_charge_service),
    current_user: Optional[models.User] = Depends(get_current_user),
):
    return service.update_catalog_service(item_id, item_data, current_user)


@router.delete("/catalog/{item_id}")
def delete_service_from_catalog(
    item_id: int,
    service: ExtraChargeService = Depends(get_extra_charge_service),
    current_user: Optional[models.User] = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_catalog_service(item_id, current_user)


# -------------------------------------------------------------
# TRANSACTIONAL CHARGES (Billed to a Stay)
# -------------------------------------------------------------

@router.post("/", response_model=schemas.ExtraChargeResponse)
def create_extra_charge(
    charge: schemas.ExtraChargeCreate,
    service: ExtraChargeService = Depends(get_extra_charge_service),
    current_user: Optional[models.User] = Depends(get_current_user),
):
    return service.create_extra_charge(charge, current_user)


@router.get("/", response_model=List[schemas.ExtraChargeResponse])
def get_extra_charges(
    hotel_id: Optional[int] = Query(None),
    service: ExtraChargeService = Depends(get_extra_charge_service),
    current_user: Optional[models.User] = Depends(get_current_user),
):
    return service.get_extra_charges(hotel_id, current_user)


@router.get("/{charge_id}", response_model=schemas.ExtraChargeResponse)
def get_extra_charge(
    charge_id: int,
    service: ExtraChargeService = Depends(get_extra_charge_service),
):
    return service.get_extra_charge(charge_id)


@router.put("/{charge_id}", response_model=schemas.ExtraChargeResponse)
def update_extra_charge(
    charge_id: int,
    charge_data: schemas.ExtraChargeUpdate,
    service: ExtraChargeService = Depends(get_extra_charge_service),
):
    return service.update_extra_charge(charge_id, charge_data)


@router.delete("/{charge_id}")
def delete_extra_charge(
    charge_id: int,
    service: ExtraChargeService = Depends(get_extra_charge_service),
) -> Dict[str, str]:
    return service.delete_extra_charge(charge_id)