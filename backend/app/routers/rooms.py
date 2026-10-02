from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user, require_hotel_admin_or_manager
from app.services.room_service import RoomService

router = APIRouter(
    prefix="/rooms",
    tags=["Rooms"],
)


def get_room_service(db: Session = Depends(get_db)) -> RoomService:
    return RoomService(db)


@router.post("/", response_model=schemas.RoomResponse)
def create_room(
    room: schemas.RoomCreate,
    service: RoomService = Depends(get_room_service),
    current_user: models.User = Depends(require_hotel_admin_or_manager),
):
    return service.create_room(room, current_user)


@router.post("/batch", response_model=schemas.RoomBatchResponse)
def create_rooms_batch(
    batch_data: schemas.RoomBatchCreate,
    service: RoomService = Depends(get_room_service),
    current_user: models.User = Depends(require_hotel_admin_or_manager),
):
    return service.create_rooms_batch(batch_data, current_user)


@router.get("/", response_model=List[schemas.RoomResponse])
def get_rooms(
    hotel_id: Optional[int] = Query(None),
    date: Optional[str] = Query(None),
    service: RoomService = Depends(get_room_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_rooms(hotel_id, date, current_user)


@router.get("/{room_id}", response_model=schemas.RoomResponse)
def get_room(
    room_id: int,
    service: RoomService = Depends(get_room_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_room(room_id, current_user)


@router.put("/{room_id}", response_model=schemas.RoomResponse)
def update_room(
    room_id: int,
    room_update: schemas.RoomUpdate,
    service: RoomService = Depends(get_room_service),
    current_user: models.User = Depends(require_hotel_admin_or_manager),
):
    return service.update_room(room_id, room_update, current_user)


@router.patch("/{room_id}/status", response_model=schemas.RoomResponse)
def update_room_status(
    room_id: int,
    status_update: schemas.RoomStatusUpdate,
    service: RoomService = Depends(get_room_service),
    current_user: models.User = Depends(require_hotel_admin_or_manager),
):
    return service.update_room_status(room_id, status_update.status, current_user)


@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    service: RoomService = Depends(get_room_service),
    current_user: models.User = Depends(require_hotel_admin_or_manager),
) -> Dict[str, str]:
    return service.delete_room(room_id, current_user)