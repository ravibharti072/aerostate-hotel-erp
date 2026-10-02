from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user, require_super_admin
from app.services.hotel_service import HotelService

router = APIRouter(
    prefix="/hotels",
    tags=["Hotels"],
)


class HotelModulesUpdate(BaseModel):
    modules: List[str]


def get_hotel_service(db: Session = Depends(get_db)) -> HotelService:
    return HotelService(db)


@router.post("/", response_model=schemas.HotelResponse)
def create_hotel(
    hotel: schemas.HotelCreate,
    service: HotelService = Depends(get_hotel_service),
    current_user: models.User = Depends(require_super_admin),
):
    return service.create_hotel(hotel)


@router.get("/", response_model=List[schemas.HotelResponse])
def get_hotels(
    service: HotelService = Depends(get_hotel_service),
    current_user: models.User = Depends(require_super_admin),
):
    return service.get_hotels()


@router.get("/{hotel_id}", response_model=schemas.HotelResponse)
def get_hotel(
    hotel_id: int,
    service: HotelService = Depends(get_hotel_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_hotel(hotel_id, current_user)


@router.put("/{hotel_id}", response_model=schemas.HotelResponse)
def update_hotel(
    hotel_id: int,
    hotel_update: schemas.HotelUpdate,
    service: HotelService = Depends(get_hotel_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_hotel(hotel_id, hotel_update, current_user)


@router.get("/{hotel_id}/modules")
def get_hotel_modules(
    hotel_id: int,
    service: HotelService = Depends(get_hotel_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, List[str]]:
    return service.get_hotel_modules(hotel_id, current_user)


@router.put("/{hotel_id}/modules")
def update_hotel_modules(
    hotel_id: int,
    data: HotelModulesUpdate,
    service: HotelService = Depends(get_hotel_service),
    current_user: models.User = Depends(require_super_admin),
) -> Dict[str, Any]:
    return service.update_hotel_modules(hotel_id, data.modules)