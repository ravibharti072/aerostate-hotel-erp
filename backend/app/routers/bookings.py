from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"]
)

@router.post("/", response_model=schemas.BookingResponse)
def create_booking(
    booking: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only front-desk, hotel-admin, manager, or super-admin can create bookings"
        )

    if current_user.role != "super-admin":
        if booking.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create bookings only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == booking.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    guest = db.query(models.Guest).filter(
        models.Guest.id == booking.guest_id,
        models.Guest.hotel_id == booking.hotel_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found for this hotel"
        )

    room = db.query(models.Room).filter(
        models.Room.id == booking.room_id,
        models.Room.hotel_id == booking.hotel_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found for this hotel"
        )

    if booking.checkout_date <= booking.checkin_date:
        raise HTTPException(
            status_code=400,
            detail="Checkout date must be after check-in date"
        )

    overlapping_booking = db.query(models.Booking).filter(
        models.Booking.room_id == booking.room_id,
        models.Booking.status.in_(["confirmed", "checked-in"]),
        models.Booking.checkin_date < booking.checkout_date,
        models.Booking.checkout_date > booking.checkin_date
    ).first()

    if overlapping_booking:
        raise HTTPException(
            status_code=400,
            detail="Room is already booked for these dates"
        )

    new_booking = models.Booking(**booking.model_dump())

    room.status = "reserved"

    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)

    return new_booking


@router.post("/walk-in", response_model=schemas.BookingResponse)
def create_walk_in_booking(
    walk_in_data: schemas.WalkInBookingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only front-desk, hotel-admin, manager, or super-admin can create walk-in bookings"
        )

    hotel_id = walk_in_data.hotel_id if current_user.role == "super-admin" else current_user.hotel_id

    guest = db.query(models.Guest).filter(
        models.Guest.phone == walk_in_data.phone,
        models.Guest.hotel_id == hotel_id
    ).first()

    if not guest:
        guest = models.Guest(
            hotel_id=hotel_id,
            full_name=walk_in_data.full_name,
            phone=walk_in_data.phone,
            email=walk_in_data.email,
            address=walk_in_data.address,
            id_type=walk_in_data.id_proof_type,
            id_number=walk_in_data.id_proof_number
        )
        db.add(guest)
        db.commit()
        db.refresh(guest)

    room = db.query(models.Room).filter(
        models.Room.id == walk_in_data.room_id,
        models.Room.hotel_id == hotel_id
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found for this hotel")

    if room.status not in ["available", "cleaning"]:
        raise HTTPException(status_code=400, detail=f"Room is currently {room.status} and cannot be checked into")

    new_booking = models.Booking(
        hotel_id=hotel_id,
        guest_id=guest.id,
        room_id=room.id,
        checkin_date=walk_in_data.checkin_date,
        checkout_date=walk_in_data.checkout_date,
        adults=walk_in_data.adults,
        children=walk_in_data.children,
        room_rate=walk_in_data.room_rate,
        total_amount=walk_in_data.total_amount,
        advance_paid=walk_in_data.advance_paid,
        payment_status=walk_in_data.payment_status,
        status="checked-in"
    )

    room.status = "occupied"

    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)

    return new_booking


@router.get("/", response_model=list[schemas.BookingResponse])
def get_bookings(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    room_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Booking)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Booking.hotel_id == hotel_id)
    else:
        query = query.filter(models.Booking.hotel_id == current_user.hotel_id)

    if guest_id:
        query = query.filter(models.Booking.guest_id == guest_id)

    if room_id:
        query = query.filter(models.Booking.room_id == room_id)

    if status:
        query = query.filter(models.Booking.status == status)

    bookings = query.order_by(models.Booking.id.desc()).all()

    return bookings


@router.get("/{booking_id}", response_model=schemas.BookingResponse)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if current_user.role != "super-admin":
        if booking.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only bookings from your own hotel"
            )

    return booking


@router.put("/{booking_id}", response_model=schemas.BookingResponse)
def update_booking(
    booking_id: int,
    booking_update: schemas.BookingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only front-desk, hotel-admin, manager, or super-admin can update bookings"
        )

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if current_user.role != "super-admin":
        if booking.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only bookings from your own hotel"
            )

    update_data = booking_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move booking to another hotel"
            )

    new_hotel_id = update_data.get("hotel_id", booking.hotel_id)
    new_guest_id = update_data.get("guest_id", booking.guest_id)
    new_room_id = update_data.get("room_id", booking.room_id)
    new_checkin_date = update_data.get("checkin_date", booking.checkin_date)
    new_checkout_date = update_data.get("checkout_date", booking.checkout_date)

    if new_checkout_date <= new_checkin_date:
        raise HTTPException(
            status_code=400,
            detail="Checkout date must be after check-in date"
        )

    guest = db.query(models.Guest).filter(
        models.Guest.id == new_guest_id,
        models.Guest.hotel_id == new_hotel_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found for this hotel"
        )

    room = db.query(models.Room).filter(
        models.Room.id == new_room_id,
        models.Room.hotel_id == new_hotel_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found for this hotel"
        )

    overlapping_booking = db.query(models.Booking).filter(
        models.Booking.id != booking_id,
        models.Booking.room_id == new_room_id,
        models.Booking.status.in_(["confirmed", "checked-in"]),
        models.Booking.checkin_date < new_checkout_date,
        models.Booking.checkout_date > new_checkin_date
    ).first()

    if overlapping_booking:
        raise HTTPException(
            status_code=400,
            detail="Room is already booked for these dates"
        )

    old_room_id = booking.room_id

    for key, value in update_data.items():
        setattr(booking, key, value)

    if old_room_id != booking.room_id:
        old_room = db.query(models.Room).filter(
            models.Room.id == old_room_id
        ).first()

        if old_room:
            old_room.status = "available"

        room.status = "reserved"

    db.commit()
    db.refresh(booking)

    return booking


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager, or super-admin can delete bookings"
        )

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if current_user.role != "super-admin":
        if booking.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only bookings from your own hotel"
            )

    room = db.query(models.Room).filter(
        models.Room.id == booking.room_id
    ).first()

    if room:
        room.status = "available"

    db.delete(booking)
    db.commit()

    return {
        "message": "Booking deleted successfully"
    }


@router.post("/{booking_id}/check-in", response_model=schemas.BookingResponse)
def check_in_guest(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only front-desk, hotel-admin, manager, or super-admin can check in guests"
        )

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if current_user.role != "super-admin":
        if booking.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can check in only bookings from your own hotel"
            )

    if booking.status == "checked-in":
        raise HTTPException(
            status_code=400,
            detail="Guest is already checked in"
        )

    if booking.status == "checked-out":
        raise HTTPException(
            status_code=400,
            detail="This booking is already checked out"
        )

    if booking.status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Cancelled booking cannot be checked in"
        )

    room = db.query(models.Room).filter(
        models.Room.id == booking.room_id,
        models.Room.hotel_id == booking.hotel_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    booking.status = "checked-in"
    room.status = "occupied"

    db.commit()
    db.refresh(booking)

    return booking


@router.post("/{booking_id}/check-out", response_model=schemas.BookingResponse)
def check_out_guest(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only front-desk, hotel-admin, manager, or super-admin can check out guests"
        )

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if current_user.role != "super-admin":
        if booking.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can check out only bookings from your own hotel"
            )

    if booking.status != "checked-in":
        raise HTTPException(
            status_code=400,
            detail="Only checked-in booking can be checked out"
        )

    room = db.query(models.Room).filter(
        models.Room.id == booking.room_id,
        models.Room.hotel_id == booking.hotel_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    booking.status = "checked-out"
    room.status = "cleaning"

    existing_open_task = db.query(models.HousekeepingTask).filter(
        models.HousekeepingTask.hotel_id == booking.hotel_id,
        models.HousekeepingTask.room_id == booking.room_id,
        models.HousekeepingTask.status.in_(["pending", "in-progress"])
    ).first()

    if existing_open_task:
        existing_open_task.booking_id = booking.id
        existing_open_task.task_type = "checkout-cleaning"
        existing_open_task.priority = "high"
        existing_open_task.notes = f"Updated after checkout for booking #{booking.id}"
        existing_open_task.updated_at = datetime.utcnow()
    else:
        housekeeping_task = models.HousekeepingTask(
            hotel_id=booking.hotel_id,
            room_id=booking.room_id,
            booking_id=booking.id,
            task_type="checkout-cleaning",
            priority="high",
            status="pending",
            assigned_to=None,
            notes=f"Auto-created after checkout for booking #{booking.id}",
            created_by=current_user.username
        )

        db.add(housekeeping_task)

    db.commit()
    db.refresh(booking)

    return booking


@router.post("/{booking_id}/generate-invoice", response_model=schemas.InvoiceResponse)
def generate_invoice_from_booking(
    booking_id: int,
    invoice_data: schemas.BookingInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only accountant, front-desk, hotel-admin, manager, or super-admin can generate invoice"
        )

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.role != "super-admin":
        if booking.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can generate invoices only for your own hotel bookings"
            )

    existing_invoice = db.query(models.Invoice).filter(
        models.Invoice.booking_id == booking.id
    ).first()

    if existing_invoice:
        raise HTTPException(
            status_code=400,
            detail="Invoice already exists for this booking"
        )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == booking.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    guest = db.query(models.Guest).filter(
        models.Guest.id == booking.guest_id,
        models.Guest.hotel_id == booking.hotel_id
    ).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    room = db.query(models.Room).filter(
        models.Room.id == booking.room_id,
        models.Room.hotel_id == booking.hotel_id
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    room_charges = float(
        getattr(booking, "total_amount", None)
        or getattr(booking, "grand_total", None)
        or getattr(booking, "total_price", None)
        or getattr(booking, "net_amount", None)
        or getattr(booking, "room_rate", None)
        or getattr(booking, "base_price", None)
        or 0
    )

    restaurant_orders = db.query(models.RestaurantOrder).filter(
        models.RestaurantOrder.hotel_id == booking.hotel_id,
        models.RestaurantOrder.booking_id == booking.id if hasattr(models.RestaurantOrder, 'booking_id') else models.RestaurantOrder.room_id == booking.room_id,
        models.RestaurantOrder.billing_type == "transfer_to_booking",
        models.RestaurantOrder.payment_status == "unpaid",
        models.RestaurantOrder.is_added_to_invoice == False,
        models.RestaurantOrder.order_status != "cancelled"
    ).all() if hasattr(models, 'RestaurantOrder') else []

    restaurant_charges = sum(
        float(getattr(order, "total_amount", 0) or 0)
        for order in restaurant_orders
    )

    extra_charge_items = []
    if hasattr(models, "ExtraCharge"):
        extra_charge_items = db.query(models.ExtraCharge).filter(
            models.ExtraCharge.hotel_id == booking.hotel_id,
            models.ExtraCharge.booking_id == booking.id
        ).all()

    extra_charges = sum(
        float(
            getattr(item, "total_amount", None)
            or getattr(item, "amount", None)
            or 0
        )
        for item in extra_charge_items
    )

    advance_payments = db.query(models.Payment).filter(
        models.Payment.hotel_id == booking.hotel_id,
        models.Payment.booking_id == booking.id
    ).all() if hasattr(models.Payment, 'booking_id') else []

    paid_amount = 0
    for payment in advance_payments:
        invoice_id = getattr(payment, "invoice_id", None)
        if invoice_id is None:
            paid_amount += float(
                getattr(payment, "amount", None)
                or getattr(payment, "payment_amount", None)
                or getattr(payment, "paid_amount", None)
                or 0
            )

    discount = float(
        getattr(invoice_data, "discount", None)
        or getattr(invoice_data, "discount_amount", None)
        or 0
    )

    tax_amount = float(
        getattr(invoice_data, "tax_amount", None)
        or getattr(booking, "tax", None)
        or 0
    )

    grand_total = (
        room_charges
        + restaurant_charges
        + extra_charges
        + tax_amount
        - discount
    )

    if grand_total < 0:
        raise HTTPException(
            status_code=400,
            detail="Grand total cannot be negative"
        )

    due_amount = grand_total - paid_amount

    if due_amount < 0:
        due_amount = 0

    if paid_amount <= 0:
        payment_status = "pending"
    elif paid_amount < grand_total:
        payment_status = "partial"
    else:
        payment_status = "paid"

    invoice_number = f"INV-{booking.hotel_id}-{booking.id}-{int(datetime.utcnow().timestamp())}"

    new_invoice = models.Invoice(
        hotel_id=booking.hotel_id,
        guest_id=booking.guest_id,
        booking_id=booking.id,
        invoice_number=invoice_number,

        room_charges=round(room_charges, 2),
        restaurant_charges=round(restaurant_charges, 2),
        laundry_charges=0,
        minibar_charges=0,
        extra_charges=round(extra_charges, 2),

        discount=round(discount, 2),
        tax_amount=round(tax_amount, 2),
        grand_total=round(grand_total, 2),
        paid_amount=round(paid_amount, 2),
        due_amount=round(due_amount, 2),
        payment_status=payment_status
    )

    db.add(new_invoice)

    for order in restaurant_orders:
        order.is_added_to_invoice = True

    db.commit()
    db.refresh(new_invoice)

    return new_invoice