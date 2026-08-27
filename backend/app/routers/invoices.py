from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"]
)

@router.post("/", response_model=schemas.InvoiceResponse)
def create_invoice(
    invoice: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only accountant, front-desk, hotel-admin, manager, or super-admin can create invoices"
        )

    if current_user.role != "super-admin":
        if invoice.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create invoices only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == invoice.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    guest = db.query(models.Guest).filter(
        models.Guest.id == invoice.guest_id,
        models.Guest.hotel_id == invoice.hotel_id
    ).first()

    if not guest:
        raise HTTPException(
            status_code=404,
            detail="Guest not found for this hotel"
        )

    booking = db.query(models.Booking).filter(
        models.Booking.id == invoice.booking_id,
        models.Booking.hotel_id == invoice.hotel_id,
        models.Booking.guest_id == invoice.guest_id
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found for this guest and hotel"
        )

    existing_invoice = db.query(models.Invoice).filter(
        models.Invoice.booking_id == invoice.booking_id
    ).first()

    if existing_invoice:
        raise HTTPException(
            status_code=400,
            detail="Invoice already exists for this booking"
        )

    grand_total = (
        invoice.room_charges
        + invoice.restaurant_charges
        + invoice.laundry_charges
        + invoice.minibar_charges
        + invoice.extra_charges
        + invoice.tax_amount
        - invoice.discount
    )

    if grand_total < 0:
        raise HTTPException(
            status_code=400,
            detail="Grand total cannot be negative"
        )

    invoice_number = f"INV-{invoice.hotel_id}-{invoice.booking_id}-{int(datetime.utcnow().timestamp())}"

    new_invoice = models.Invoice(
        hotel_id=invoice.hotel_id,
        guest_id=invoice.guest_id,
        booking_id=invoice.booking_id,
        invoice_number=invoice_number,

        room_charges=invoice.room_charges,
        restaurant_charges=invoice.restaurant_charges,
        laundry_charges=invoice.laundry_charges,
        minibar_charges=invoice.minibar_charges,
        extra_charges=invoice.extra_charges,

        discount=invoice.discount,
        tax_amount=invoice.tax_amount,
        grand_total=grand_total,
        paid_amount=0,
        due_amount=grand_total,
        payment_status="pending"
    )

    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)

    return new_invoice


@router.get("/", response_model=list[schemas.InvoiceResponse])
def get_invoices(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Invoice)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Invoice.hotel_id == hotel_id)
    else:
        query = query.filter(models.Invoice.hotel_id == current_user.hotel_id)

    if guest_id:
        query = query.filter(models.Invoice.guest_id == guest_id)

    if booking_id:
        query = query.filter(models.Invoice.booking_id == booking_id)

    if payment_status:
        query = query.filter(models.Invoice.payment_status == payment_status)

    invoices = query.order_by(models.Invoice.id.desc()).all()

    return invoices


@router.get("/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    if current_user.role != "super-admin":
        if invoice.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only invoices from your own hotel"
            )

    return invoice


@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant"]:
        raise HTTPException(
            status_code=403,
            detail="Only accountant, hotel-admin, manager, or super-admin can delete invoices"
        )

    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    if current_user.role != "super-admin":
        if invoice.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only invoices from your own hotel"
            )

    existing_payment = db.query(models.Payment).filter(
        models.Payment.invoice_id == invoice.id
    ).first()

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete invoice because payment already exists for this invoice"
        )

    db.delete(invoice)
    db.commit()

    return {
        "message": "Invoice deleted successfully"
    }