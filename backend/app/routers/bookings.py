from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.booking_service import BookingService

router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)


def get_booking_service(db: Session = Depends(get_db)) -> BookingService:
    return BookingService(db)


# -----------------------------
# AVAILABILITY & CYCLE PREVIEW
# -----------------------------

@router.get("/available-rooms", response_model=List[schemas.RoomResponse])
def get_available_rooms(
    checkin_date: datetime = Query(..., description="Check-in datetime (ISO format)"),
    checkout_date: datetime = Query(..., description="Check-out datetime (ISO format)"),
    exclude_booking_id: Optional[int] = Query(None, description="Booking ID to exclude when editing an existing reservation"),
    hotel_id: Optional[int] = Query(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_available_rooms(
        checkin_date=checkin_date,
        checkout_date=checkout_date,
        exclude_booking_id=exclude_booking_id,
        hotel_id=hotel_id,
        current_user=current_user,
    )


@router.get("/calculate-stay-preview")
def preview_stay_calculation(
    checkin_date: datetime = Query(..., description="Check-in datetime (ISO format)"),
    checkout_date: datetime = Query(..., description="Check-out datetime (ISO format)"),
    hotel_id: Optional[int] = Query(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Preview days, nights, and late-checkout status according to the property's 11 AM - 11 AM cycle."""
    target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
    return service.calculate_stay_cycle(
        hotel_id=target_hotel_id,
        checkin_dt=checkin_date,
        checkout_dt=checkout_date,
    )


# -----------------------------
# RESERVATION & WALK-IN CREATION
# -----------------------------

@router.post("/", response_model=schemas.BookingResponse)
def create_booking(
    booking: schemas.BookingCreate,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_booking(booking, current_user)


@router.post("/walk-in", response_model=schemas.BookingResponse)
def create_walk_in_booking(
    walk_in_data: schemas.WalkInBookingCreate,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_walk_in_booking(walk_in_data, current_user)


# -----------------------------
# BOOKING QUERY & DETAILS
# -----------------------------

@router.get("/", response_model=List[schemas.BookingResponse])
def get_bookings(
    hotel_id: Optional[int] = Query(None),
    guest_id: Optional[int] = Query(None),
    room_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_bookings(hotel_id, guest_id, room_id, status, current_user)


@router.get("/in-house", response_model=List[schemas.InHouseGuestResponse])
def get_in_house_guests(
    hotel_id: Optional[int] = Query(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    """Fetch active in-house resident guests (checked-in) directly from database."""
    return service.get_in_house_guests(hotel_id=hotel_id, current_user=current_user)


@router.get("/{booking_id}", response_model=schemas.BookingResponse)
def get_booking(
    booking_id: int,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_booking(booking_id, current_user)


@router.put("/{booking_id}", response_model=schemas.BookingResponse)
def update_booking(
    booking_id: int,
    booking_update: schemas.BookingUpdate,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_booking(booking_id, booking_update, current_user)


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_booking(booking_id, current_user)


@router.post("/process-no-shows")
def process_no_shows(
    hotel_id: Optional[int] = Query(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Sweeps for overdue bookings that never checked in, converts them to No-Show,
    and releases all reserved rooms back to available.
    """
    return service.process_no_shows(hotel_id, current_user)


# -----------------------------
# CHECK-IN, CHECK-OUT & INVOICING
# -----------------------------

@router.post("/{booking_id}/check-in", response_model=schemas.BookingResponse)
def check_in_guest(
    booking_id: int,
    checkin_data: Optional[schemas.BookingCheckInRequest] = Body(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.check_in_guest(booking_id, checkin_data, current_user)


@router.post("/{booking_id}/check-out", response_model=schemas.BookingResponse)
def check_out_guest(
    booking_id: int,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.check_out_guest(booking_id, current_user)


@router.post("/{booking_id}/no-show", response_model=schemas.BookingResponse)
def mark_as_no_show(
    booking_id: int,
    reason: Optional[str] = Query(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Marks an un-arrived reservation as No-Show and releases the room.
    """
    return service.mark_as_no_show(booking_id, current_user, reason)


@router.post("/{booking_id}/cancel", response_model=schemas.BookingResponse)
def cancel_booking(
    booking_id: int,
    reason: Optional[str] = Query(None),
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Cancels a booking and releases the assigned rooms.
    """
    return service.cancel_booking(booking_id, current_user, reason)


@router.post("/{booking_id}/generate-invoice", response_model=schemas.InvoiceResponse)
def generate_invoice_from_booking(
    booking_id: int,
    invoice_data: schemas.BookingInvoiceCreate,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.generate_invoice_from_booking(booking_id, invoice_data, current_user)


# -----------------------------
# FOLIO OPERATIONS (PHASE 2)
# -----------------------------

@router.get("/{booking_id}/folio", response_model=schemas.FolioResponse)
def get_or_create_booking_folio(
    booking_id: int,
    service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns the persistent stay Folio for this booking, initializing it
    if the booking is currently active or checked-in.
    """
    booking = service.get_booking(booking_id, current_user)
    return service.get_or_create_folio_for_booking(booking, current_user.username)