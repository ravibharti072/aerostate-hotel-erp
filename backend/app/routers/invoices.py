# backend/app/routers/invoices.py
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.invoice_service import InvoiceService

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices & Folios"],
)


def get_invoice_service(db: Session = Depends(get_db)) -> InvoiceService:
    return InvoiceService(db)


# -------------------------------------------------------------
# Unbilled Bookings & Guest Folio Endpoints
# -------------------------------------------------------------

@router.get("/unbilled-bookings")
def get_unbilled_bookings(
    hotel_id: Optional[int] = Query(None),
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns checked-in, checked-out, or confirmed bookings that have not yet had a final invoice issued.
    """
    return service.get_pending_unbilled_bookings(current_user, hotel_id)


@router.get("/guest-folio/{booking_id}")
def get_guest_folio(
    booking_id: int,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns the comprehensive itemized line items across all hotel departments
    (Accommodation, Restaurant, Laundry, Minibar, Housekeeping) for A4 print and review.
    """
    return service.get_guest_folio_ledger(booking_id, current_user)


@router.get("/folio/{booking_id}", response_model=schemas.FolioSummaryResponse)
def get_folio_summary(
    booking_id: int,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns real-time aggregated departmental charges, server-calculated overstay,
    actual advance payments, and accurate balance due for the Checkout Modal.
    """
    return service.get_booking_folio_summary(booking_id, current_user)


@router.post("/generate/{booking_id}", response_model=schemas.InvoiceResponse)
def generate_invoice(
    booking_id: int,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generates and commits a finalized Tax Invoice directly from a booking folio.
    """
    return service.generate_invoice_for_booking(booking_id, current_user)


# -------------------------------------------------------------
# Standard Invoice CRUD & Settlements
# -------------------------------------------------------------

@router.post("/", response_model=schemas.InvoiceResponse)
def create_invoice(
    invoice: schemas.InvoiceCreate,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_invoice(invoice, current_user)


@router.get("/", response_model=List[schemas.InvoiceResponse])
def get_invoices(
    hotel_id: Optional[int] = Query(None),
    guest_id: Optional[int] = Query(None),
    booking_id: Optional[int] = Query(None),
    payment_status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_invoices(hotel_id, guest_id, booking_id, payment_status, from_date, to_date, current_user)


@router.get("/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_invoice(
    invoice_id: int,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_invoice(invoice_id, current_user)


@router.post("/{invoice_id}/payments", response_model=schemas.PaymentResponse)
def add_invoice_payment(
    invoice_id: int,
    payment_data: schemas.PaymentCreate,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.add_invoice_payment(invoice_id, payment_data, current_user)


@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_invoice(invoice_id, current_user)


@router.post("/{invoice_id}/void", response_model=schemas.InvoiceResponse)
def void_invoice(
    invoice_id: int,
    payload: schemas.InvoiceVoidRequest,
    service: InvoiceService = Depends(get_invoice_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Auditor-compliant void/cancel invoice guard.
    Only allowed for unpaid or partially paid invoices.
    Prevents voiding settled invoices without an approved credit note.
    """
    return service.void_invoice(invoice_id, payload.reason, current_user)