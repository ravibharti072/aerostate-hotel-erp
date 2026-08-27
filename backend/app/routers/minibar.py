from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/minibar-charges",
    tags=["Minibar"]
)

@router.post("/", response_model=schemas.MinibarChargeResponse)
def create_minibar_charge(
    charge: schemas.MinibarChargeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "housekeeping", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only housekeeping, front-desk, hotel-admin, manager, or super-admin can create minibar charges"
        )

    if current_user.role != "super-admin":
        if charge.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create minibar charges only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(models.Hotel.id == charge.hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    guest = db.query(models.Guest).filter(
        models.Guest.id == charge.guest_id,
        models.Guest.hotel_id == charge.hotel_id
    ).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found for this hotel")

    room = db.query(models.Room).filter(
        models.Room.id == charge.room_id,
        models.Room.hotel_id == charge.hotel_id
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found for this hotel")

    booking = db.query(models.Booking).filter(
        models.Booking.id == charge.booking_id,
        models.Booking.hotel_id == charge.hotel_id,
        models.Booking.guest_id == charge.guest_id,
        models.Booking.room_id == charge.room_id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for this hotel, guest and room")

    allowed_payment_statuses = ["bill-to-room", "paid", "pending"]
    if charge.payment_status not in allowed_payment_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}")

    allowed_statuses = ["active", "cancelled"]
    if charge.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed statuses are: {allowed_statuses}")

    if charge.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    if charge.price_per_item < 0:
        raise HTTPException(status_code=400, detail="Price per item cannot be negative")

    total_amount = charge.quantity * charge.price_per_item

    new_charge = models.MinibarCharge(
        hotel_id=charge.hotel_id,
        guest_id=charge.guest_id,
        room_id=charge.room_id,
        booking_id=charge.booking_id,
        item_name=charge.item_name,
        quantity=charge.quantity,
        price_per_item=charge.price_per_item,
        total_amount=total_amount,
        payment_status=charge.payment_status,
        status=charge.status,
        remarks=charge.remarks
    )

    db.add(new_charge)
    db.commit()
    db.refresh(new_charge)

    return new_charge


@router.get("/", response_model=list[schemas.MinibarChargeResponse])
def get_minibar_charges(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    room_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    payment_status: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.MinibarCharge)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.MinibarCharge.hotel_id == hotel_id)
    else:
        query = query.filter(models.MinibarCharge.hotel_id == current_user.hotel_id)

    if guest_id:
        query = query.filter(models.MinibarCharge.guest_id == guest_id)
    if room_id:
        query = query.filter(models.MinibarCharge.room_id == room_id)
    if booking_id:
        query = query.filter(models.MinibarCharge.booking_id == booking_id)
    if payment_status:
        query = query.filter(models.MinibarCharge.payment_status == payment_status)
    if status:
        query = query.filter(models.MinibarCharge.status == status)

    return query.order_by(models.MinibarCharge.id.desc()).all()


@router.get("/{charge_id}", response_model=schemas.MinibarChargeResponse)
def get_minibar_charge(
    charge_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    charge = db.query(models.MinibarCharge).filter(models.MinibarCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Minibar charge not found")

    if current_user.role != "super-admin" and charge.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can view only minibar charges from your own hotel")

    return charge


@router.put("/{charge_id}", response_model=schemas.MinibarChargeResponse)
def update_minibar_charge(
    charge_id: int,
    charge_update: schemas.MinibarChargeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "housekeeping", "front-desk"]:
        raise HTTPException(status_code=403, detail="Only housekeeping, front-desk, hotel-admin, manager, or super-admin can update minibar charges")

    charge = db.query(models.MinibarCharge).filter(models.MinibarCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Minibar charge not found")

    if current_user.role != "super-admin" and charge.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can update only minibar charges from your own hotel")

    update_data = charge_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin" and "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You cannot move minibar charge to another hotel")

    allowed_payment_statuses = ["bill-to-room", "paid", "pending"]
    allowed_statuses = ["active", "cancelled"]

    if "payment_status" in update_data and update_data["payment_status"] not in allowed_payment_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}")

    if "status" in update_data and update_data["status"] not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed statuses are: {allowed_statuses}")

    if "quantity" in update_data and update_data["quantity"] <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    if "price_per_item" in update_data and update_data["price_per_item"] < 0:
        raise HTTPException(status_code=400, detail="Price per item cannot be negative")

    check_hotel_id = update_data.get("hotel_id", charge.hotel_id)
    check_guest_id = update_data.get("guest_id", charge.guest_id)
    check_room_id = update_data.get("room_id", charge.room_id)
    check_booking_id = update_data.get("booking_id", charge.booking_id)

    guest = db.query(models.Guest).filter(models.Guest.id == check_guest_id, models.Guest.hotel_id == check_hotel_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found for this hotel")

    room = db.query(models.Room).filter(models.Room.id == check_room_id, models.Room.hotel_id == check_hotel_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found for this hotel")

    booking = db.query(models.Booking).filter(
        models.Booking.id == check_booking_id,
        models.Booking.hotel_id == check_hotel_id,
        models.Booking.guest_id == check_guest_id,
        models.Booking.room_id == check_room_id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for this hotel, guest and room")

    for key, value in update_data.items():
        setattr(charge, key, value)

    charge.total_amount = charge.quantity * charge.price_per_item

    db.commit()
    db.refresh(charge)

    return charge


@router.delete("/{charge_id}")
def delete_minibar_charge(
    charge_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "housekeeping"]:
        raise HTTPException(status_code=403, detail="Only housekeeping, hotel-admin, manager, or super-admin can delete minibar charges")

    charge = db.query(models.MinibarCharge).filter(models.MinibarCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Minibar charge not found")

    if current_user.role != "super-admin" and charge.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can delete only minibar charges from your own hotel")

    db.delete(charge)
    db.commit()

    return {"message": "Minibar charge deleted successfully"}