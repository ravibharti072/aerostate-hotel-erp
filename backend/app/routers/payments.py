from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

@router.post("/", response_model=schemas.PaymentResponse)
def create_payment(
    payment: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only accountant, front-desk, hotel-admin, manager, or super-admin can create payments"
        )

    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == payment.invoice_id
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
                detail="You can create payments only for your own hotel invoices"
            )

    if payment.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payment amount must be greater than 0"
        )

    if payment.amount > invoice.due_amount:
        raise HTTPException(
            status_code=400,
            detail="Payment amount cannot be greater than due amount"
        )

    new_payment = models.Payment(
        hotel_id=invoice.hotel_id,
        guest_id=invoice.guest_id,
        invoice_id=invoice.id,
        amount=payment.amount,
        payment_method=payment.payment_method,
        transaction_id=payment.transaction_id,
        payment_status="success",
        received_by=payment.received_by,
        remarks=payment.remarks
    )

    invoice.paid_amount = invoice.paid_amount + payment.amount
    invoice.due_amount = invoice.grand_total - invoice.paid_amount

    if invoice.due_amount == 0:
        invoice.payment_status = "paid"
    elif invoice.paid_amount > 0:
        invoice.payment_status = "partial"
    else:
        invoice.payment_status = "pending"

    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    return new_payment


@router.get("/", response_model=list[schemas.PaymentResponse])
def get_payments(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Payment)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Payment.hotel_id == hotel_id)
    else:
        query = query.filter(models.Payment.hotel_id == current_user.hotel_id)

    if guest_id:
        query = query.filter(models.Payment.guest_id == guest_id)

    if invoice_id:
        query = query.filter(models.Payment.invoice_id == invoice_id)

    payments = query.order_by(models.Payment.id.desc()).all()

    return payments