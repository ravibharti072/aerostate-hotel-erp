from typing import Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.guest_service import GuestService

router = APIRouter(
    prefix="/guests",
    tags=["Guests"],
)


def get_guest_service(db: Session = Depends(get_db)) -> GuestService:
    return GuestService(db)


@router.post("/", response_model=schemas.GuestResponse)
def create_guest(
    guest: schemas.GuestCreate,
    service: GuestService = Depends(get_guest_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_guest(guest, current_user)


@router.get("/", response_model=List[schemas.GuestResponse])
def get_guests(
    hotel_id: Optional[int] = None,
    service: GuestService = Depends(get_guest_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_guests(hotel_id, current_user)


@router.get("/{guest_id}", response_model=schemas.GuestResponse)
def get_guest(
    guest_id: int,
    service: GuestService = Depends(get_guest_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_guest(guest_id, current_user)


@router.put("/{guest_id}", response_model=schemas.GuestResponse)
def update_guest(
    guest_id: int,
    guest_update: schemas.GuestUpdate,
    service: GuestService = Depends(get_guest_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_guest(guest_id, guest_update, current_user)


@router.delete("/{guest_id}")
def delete_guest(
    guest_id: int,
    service: GuestService = Depends(get_guest_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_guest(guest_id, current_user)