from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/guests",
    tags=["Guests"]
)

@router.post("/", response_model=schemas.GuestResponse)
def create_guest(
    guest: schemas.GuestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only front-desk, hotel-admin, manager, or super-admin can create guests"
        )

    if current_user.role != "super-admin":
        if guest.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create guests only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == guest.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    existing_guest = db.query(models.Guest).filter(
        models.Guest.phone == guest.phone,
        models.Guest.hotel_id == guest.hotel_id
    ).first()

    if existing_guest:
        raise HTTPException(
            status_code=400,
            detail="Guest with this phone number already exists in this hotel"
        )

    new_guest = models.Guest(**guest.model_dump())

    db.add(new_guest)
    db.commit()
    db.refresh(new_guest)

    return new_guest


@router.get("/", response_model=list[schemas.GuestResponse])
def get_guests(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Guest)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Guest.hotel_id == hotel_id)
    else:
        query = query.filter(models.Guest.hotel_id == current_user.hotel_id)

    guests = query.order_by(models.Guest.id.desc()).all()

    return guests


@router.get("/{guest_id}", response_model=schemas.GuestResponse)
def get_guest(
    guest_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    guest = db.query(models.Guest).filter(
        models.Guest.id == guest_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found"
        )

    if current_user.role != "super-admin":
        if guest.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only guests from your own hotel"
            )

    return guest


@router.put("/{guest_id}", response_model=schemas.GuestResponse)
def update_guest(
    guest_id: int,
    guest_update: schemas.GuestUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only front-desk, hotel-admin, manager, or super-admin can update guests"
        )

    guest = db.query(models.Guest).filter(
        models.Guest.id == guest_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found"
        )

    if current_user.role != "super-admin":
        if guest.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only guests from your own hotel"
            )

    update_data = guest_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move guest to another hotel"
            )

    if "phone" in update_data:
        duplicate_guest = db.query(models.Guest).filter(
            models.Guest.phone == update_data["phone"],
            models.Guest.hotel_id == guest.hotel_id,
            models.Guest.id != guest_id
        ).first()

        if duplicate_guest:
            raise HTTPException(
                status_code=400,
                detail="Another guest with this phone number already exists in this hotel"
            )

    for key, value in update_data.items():
        setattr(guest, key, value)

    db.commit()
    db.refresh(guest)

    return guest


@router.delete("/{guest_id}")
def delete_guest(
    guest_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager, or super-admin can delete guests"
        )

    guest = db.query(models.Guest).filter(
        models.Guest.id == guest_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found"
        )

    if current_user.role != "super-admin":
        if guest.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only guests from your own hotel"
            )

    db.delete(guest)
    db.commit()

    return {
        "message": "Guest deleted successfully"
    }