from typing import Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.minibar_service import MinibarService

router = APIRouter(
    prefix="/minibar-charges",
    tags=["Minibar"],
)


def get_minibar_service(db: Session = Depends(get_db)) -> MinibarService:
    return MinibarService(db)


@router.post("/", response_model=schemas.MinibarChargeResponse)
def create_minibar_charge(
    charge: schemas.MinibarChargeCreate,
    service: MinibarService = Depends(get_minibar_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_minibar_charge(charge, current_user)


@router.get("/", response_model=List[schemas.MinibarChargeResponse])
def get_minibar_charges(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    room_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    payment_status: Optional[str] = None,
    status: Optional[str] = None,
    service: MinibarService = Depends(get_minibar_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_minibar_charges(
        hotel_id,
        guest_id,
        room_id,
        booking_id,
        payment_status,
        status,
        current_user,
    )


@router.get("/{charge_id}", response_model=schemas.MinibarChargeResponse)
def get_minibar_charge(
    charge_id: int,
    service: MinibarService = Depends(get_minibar_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_minibar_charge(charge_id, current_user)


@router.put("/{charge_id}", response_model=schemas.MinibarChargeResponse)
def update_minibar_charge(
    charge_id: int,
    charge_update: schemas.MinibarChargeUpdate,
    service: MinibarService = Depends(get_minibar_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_minibar_charge(charge_id, charge_update, current_user)


@router.delete("/{charge_id}")
def delete_minibar_charge(
    charge_id: int,
    service: MinibarService = Depends(get_minibar_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_minibar_charge(charge_id, current_user)