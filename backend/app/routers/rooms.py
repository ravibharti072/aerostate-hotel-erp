from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user, require_hotel_admin_or_manager

router = APIRouter(
    prefix="/rooms",
    tags=["Rooms"]
)

@router.post("/", response_model=schemas.RoomResponse)
def create_room(
    room: schemas.RoomCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_hotel_admin_or_manager)
):
    if current_user.role != "super-admin":
        if room.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create rooms only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == room.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    existing_room = db.query(models.Room).filter(
        models.Room.hotel_id == room.hotel_id,
        models.Room.room_number == room.room_number
    ).first()

    if existing_room:
        raise HTTPException(
            status_code=400,
            detail="Room number already exists for this hotel"
        )

    new_room = models.Room(**room.model_dump())

    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    return new_room


@router.get("/", response_model=list[schemas.RoomResponse])
def get_rooms(
    hotel_id: Optional[int] = None,
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Room)
    target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
    query = query.filter(models.Room.hotel_id == target_hotel_id)
    rooms = query.order_by(models.Room.id.desc()).all()

    # Parse target date safely
    target_date = datetime.strptime(date.split("T")[0], "%Y-%m-%d").date() if date else datetime.today().date()

    try:
        all_bookings = db.query(models.Booking).filter(
            models.Booking.hotel_id == target_hotel_id
        ).all()

        booking_map = {}
        for b in all_bookings:
            raw_ci = getattr(b, "checkin_date", None)
            raw_co = getattr(b, "checkout_date", None)
            b_status = str(getattr(b, "status", "")).lower().strip()

            if b_status in ["confirmed", "checked_in", "reserved", "advance", "pending"]:
                if raw_ci and raw_co:
                    # Safely handle both string timestamps and datetime objects from SQLAlchemy
                    ci_str = str(raw_ci).replace("T", " ").split()[0]
                    co_str = str(raw_co).replace("T", " ").split()[0]
                    
                    ci = datetime.strptime(ci_str, "%Y-%m-%d").date()
                    co = datetime.strptime(co_str, "%Y-%m-%d").date()
                    
                    # Target date must fall strictly within [checkin_date, checkout_date)
                    if ci <= target_date < co:
                        booking_map[b.room_id] = b_status

        # Assign dynamic status based on the specific target date
        for room in rooms:
            if room.status in ["maintenance", "out-of-service"]:
                continue

            room.status = "available"  # Default to available

            b_status = booking_map.get(room.id)
            if b_status in ["checked_in", "occupied"]:
                room.status = "occupied"
            elif b_status in ["confirmed", "reserved", "advance", "pending"]:
                room.status = "reserved"

    except Exception as e:
        print(f"DEBUG Error matching bookings: {e}")

    return rooms


@router.get("/{room_id}", response_model=schemas.RoomResponse)
def get_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    room = db.query(models.Room).filter(
        models.Room.id == room_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    if current_user.role != "super-admin":
        if room.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view rooms only from your own hotel"
            )

    return room


@router.put("/{room_id}", response_model=schemas.RoomResponse)
def update_room(
    room_id: int,
    room_update: schemas.RoomUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_hotel_admin_or_manager)
):
    room = db.query(models.Room).filter(
        models.Room.id == room_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    if current_user.role != "super-admin":
        if room.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update rooms only from your own hotel"
            )

    update_data = room_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(room, key, value)

    db.commit()
    db.refresh(room)

    return room


@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_hotel_admin_or_manager)
):
    room = db.query(models.Room).filter(
        models.Room.id == room_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    if current_user.role != "super-admin":
        if room.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete rooms only from your own hotel"
            )

    db.delete(room)
    db.commit()

    return {
        "message": "Room deleted successfully"
    }