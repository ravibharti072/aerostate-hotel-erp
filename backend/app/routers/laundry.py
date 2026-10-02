from typing import Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.laundry_service import LaundryService

router = APIRouter(
    prefix="/laundry-orders",
    tags=["Laundry"]
)


def get_laundry_service(db: Session = Depends(get_db)) -> LaundryService:
    return LaundryService(db)


@router.post("/", response_model=schemas.LaundryOrderResponse)
def create_laundry_order(
    laundry: schemas.LaundryOrderCreate,
    service: LaundryService = Depends(get_laundry_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_laundry_order(laundry, current_user)


@router.get("/", response_model=List[schemas.LaundryOrderResponse])
def get_laundry_orders(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    room_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    service: LaundryService = Depends(get_laundry_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_laundry_orders(
        hotel_id,
        guest_id,
        room_id,
        booking_id,
        status,
        payment_status,
        current_user,
    )


@router.get("/{laundry_id}", response_model=schemas.LaundryOrderResponse)
def get_laundry_order(
    laundry_id: int,
    service: LaundryService = Depends(get_laundry_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_laundry_order(laundry_id, current_user)


@router.put("/{laundry_id}", response_model=schemas.LaundryOrderResponse)
def update_laundry_order(
    laundry_id: int,
    laundry_update: schemas.LaundryOrderUpdate,
    service: LaundryService = Depends(get_laundry_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_laundry_order(laundry_id, laundry_update, current_user)


@router.delete("/{laundry_id}")
def delete_laundry_order(
    laundry_id: int,
    service: LaundryService = Depends(get_laundry_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_laundry_order(laundry_id, current_user)