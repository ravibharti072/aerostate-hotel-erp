from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/laundry-orders",
    tags=["Laundry"]
)

@router.post("/", response_model=schemas.LaundryOrderResponse)
def create_laundry_order(
    laundry: schemas.LaundryOrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "housekeeping", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only housekeeping, front-desk, hotel-admin, manager, or super-admin can create laundry orders"
        )

    if current_user.role != "super-admin":
        if laundry.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create laundry orders only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == laundry.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    guest = db.query(models.Guest).filter(
        models.Guest.id == laundry.guest_id,
        models.Guest.hotel_id == laundry.hotel_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found for this hotel"
        )

    if laundry.room_id:
        room = db.query(models.Room).filter(
            models.Room.id == laundry.room_id,
            models.Room.hotel_id == laundry.hotel_id
        ).first()

        if not room:
            raise HTTPException(
                status_code=404,
                detail="Room not found for this hotel"
            )

    if laundry.booking_id:
        booking = db.query(models.Booking).filter(
            models.Booking.id == laundry.booking_id,
            models.Booking.hotel_id == laundry.hotel_id,
            models.Booking.guest_id == laundry.guest_id
        ).first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail="Booking not found for this hotel and guest"
            )

    allowed_statuses = [
        "received",
        "washing",
        "ironing",
        "ready",
        "delivered",
        "cancelled"
    ]

    if laundry.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid laundry status. Allowed statuses are: {allowed_statuses}"
        )

    allowed_payment_statuses = ["bill-to-room", "paid", "pending"]

    if laundry.payment_status not in allowed_payment_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}"
        )

    if laundry.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    if laundry.price_per_item < 0:
        raise HTTPException(
            status_code=400,
            detail="Price per item cannot be negative"
        )

    total_amount = laundry.quantity * laundry.price_per_item

    new_laundry_order = models.LaundryOrder(
        hotel_id=laundry.hotel_id,
        guest_id=laundry.guest_id,
        room_id=laundry.room_id,
        booking_id=laundry.booking_id,
        service_type=laundry.service_type,
        item_name=laundry.item_name,
        quantity=laundry.quantity,
        price_per_item=laundry.price_per_item,
        total_amount=total_amount,
        status=laundry.status,
        payment_status=laundry.payment_status,
        remarks=laundry.remarks
    )

    db.add(new_laundry_order)
    db.commit()
    db.refresh(new_laundry_order)

    return new_laundry_order


@router.get("/", response_model=list[schemas.LaundryOrderResponse])
def get_laundry_orders(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    room_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.LaundryOrder)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.LaundryOrder.hotel_id == hotel_id)
    else:
        query = query.filter(models.LaundryOrder.hotel_id == current_user.hotel_id)

    if guest_id:
        query = query.filter(models.LaundryOrder.guest_id == guest_id)

    if room_id:
        query = query.filter(models.LaundryOrder.room_id == room_id)

    if booking_id:
        query = query.filter(models.LaundryOrder.booking_id == booking_id)

    if status:
        query = query.filter(models.LaundryOrder.status == status)

    if payment_status:
        query = query.filter(models.LaundryOrder.payment_status == payment_status)

    laundry_orders = query.order_by(models.LaundryOrder.id.desc()).all()

    return laundry_orders


@router.get("/{laundry_id}", response_model=schemas.LaundryOrderResponse)
def get_laundry_order(
    laundry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    laundry_order = db.query(models.LaundryOrder).filter(
        models.LaundryOrder.id == laundry_id
    ).first()

    if not laundry_order:
        raise HTTPException(status_code=404, detail="Laundry order not found")

    if current_user.role != "super-admin":
        if laundry_order.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only laundry orders from your own hotel"
            )

    return laundry_order


@router.put("/{laundry_id}", response_model=schemas.LaundryOrderResponse)
def update_laundry_order(
    laundry_id: int,
    laundry_update: schemas.LaundryOrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "housekeeping", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only housekeeping, front-desk, hotel-admin, manager, or super-admin can update laundry orders"
        )

    laundry_order = db.query(models.LaundryOrder).filter(
        models.LaundryOrder.id == laundry_id
    ).first()

    if not laundry_order:
        raise HTTPException(status_code=404, detail="Laundry order not found")

    if current_user.role != "super-admin":
        if laundry_order.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only laundry orders from your own hotel"
            )

    update_data = laundry_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move laundry order to another hotel"
            )

    allowed_statuses = [
        "received",
        "washing",
        "ironing",
        "ready",
        "delivered",
        "cancelled"
    ]

    allowed_payment_statuses = ["bill-to-room", "paid", "pending"]

    if "status" in update_data and update_data["status"] not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid laundry status. Allowed statuses are: {allowed_statuses}"
        )

    if "payment_status" in update_data and update_data["payment_status"] not in allowed_payment_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}"
        )

    if "quantity" in update_data and update_data["quantity"] <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    if "price_per_item" in update_data and update_data["price_per_item"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Price per item cannot be negative"
        )

    check_hotel_id = update_data.get("hotel_id", laundry_order.hotel_id)
    check_guest_id = update_data.get("guest_id", laundry_order.guest_id)

    guest = db.query(models.Guest).filter(
        models.Guest.id == check_guest_id,
        models.Guest.hotel_id == check_hotel_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found for this hotel"
        )

    if "room_id" in update_data and update_data["room_id"]:
        room = db.query(models.Room).filter(
            models.Room.id == update_data["room_id"],
            models.Room.hotel_id == check_hotel_id
        ).first()

        if not room:
            raise HTTPException(
                status_code=404,
                detail="Room not found for this hotel"
            )

    if "booking_id" in update_data and update_data["booking_id"]:
        booking = db.query(models.Booking).filter(
            models.Booking.id == update_data["booking_id"],
            models.Booking.hotel_id == check_hotel_id,
            models.Booking.guest_id == check_guest_id
        ).first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail="Booking not found for this hotel and guest"
            )

    for key, value in update_data.items():
        setattr(laundry_order, key, value)

    laundry_order.total_amount = laundry_order.quantity * laundry_order.price_per_item

    db.commit()
    db.refresh(laundry_order)

    return laundry_order


@router.delete("/{laundry_id}")
def delete_laundry_order(
    laundry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "housekeeping"]:
        raise HTTPException(
            status_code=403,
            detail="Only housekeeping, hotel-admin, manager, or super-admin can delete laundry orders"
        )

    laundry_order = db.query(models.LaundryOrder).filter(
        models.LaundryOrder.id == laundry_id
    ).first()

    if not laundry_order:
        raise HTTPException(status_code=404, detail="Laundry order not found")

    if current_user.role != "super-admin":
        if laundry_order.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only laundry orders from your own hotel"
            )

    db.delete(laundry_order)
    db.commit()

    return {
        "message": "Laundry order deleted successfully"
    }