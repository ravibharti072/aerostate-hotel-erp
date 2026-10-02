from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.payment_service import PaymentService

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


def get_payment_service(db: Session = Depends(get_db)) -> PaymentService:
    return PaymentService(db)


# -------------------------------------------------------------
# ADVANCE PAYMENT & RECEIPT VOUCHER (PHASE 3)
# -------------------------------------------------------------

@router.post("/advance", response_model=schemas.AdvanceReceiptVoucherResponse)
def record_advance_payment(
    advance_data: schemas.AdvancePaymentCreate,
    service: PaymentService = Depends(get_payment_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Records an advance deposit for a reservation, generates a sequential
    FY-aware Advance Receipt Voucher (ADV-26-27-000001), calculates GST breakdown,
    and updates the reservation's advance paid ledger.
    """
    return service.record_advance_payment(advance_data, current_user)


@router.get("/receipt/{payment_id}", response_model=schemas.AdvanceReceiptVoucherResponse)
def get_advance_receipt_voucher(
    payment_id: int,
    service: PaymentService = Depends(get_payment_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves the complete Advance Receipt Voucher document for preview and printing.
    """
    return service.get_advance_receipt_voucher(payment_id, current_user)


# -------------------------------------------------------------
# STANDARD INVOICE PAYMENTS & SETTLEMENT (PHASE 4 & 5)
# -------------------------------------------------------------

@router.post("/", response_model=schemas.PaymentResponse)
def create_payment(
    payment: schemas.PaymentCreate,
    service: PaymentService = Depends(get_payment_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Records an installment or final settlement payment against an issued invoice,
    allocates it with idempotency protection, and updates decoupled payment statuses.
    """
    return service.create_payment(payment, current_user)


@router.post("/checkout-settle/{booking_id}")
def settle_and_checkout(
    booking_id: int,
    payment_method: str = Query("cash"),
    transaction_id: Optional[str] = Query(None),
    discount: float = Query(0.0),
    service: PaymentService = Depends(get_payment_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Executes guest checkout, enforces hotel full payment policies,
    records settlement, marks folio closed, and dispatches room cleaning tasks.
    """
    return service.settle_and_checkout(
        booking_id,
        payment_method,
        transaction_id,
        discount,
        current_user,
    )


@router.get("/", response_model=List[schemas.PaymentResponse])
def get_payments(
    hotel_id: Optional[int] = Query(None),
    guest_id: Optional[int] = Query(None),
    invoice_id: Optional[int] = Query(None),
    booking_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    service: PaymentService = Depends(get_payment_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_payments(hotel_id, guest_id, invoice_id, booking_id, from_date, to_date, current_user)


# -------------------------------------------------------------
# REFUND DISBURSEMENT (PHASE 6)
# -------------------------------------------------------------

@router.post("/refund", response_model=schemas.PaymentResponse)
def process_refund(
    refund_data: schemas.RefundCreate,
    service: PaymentService = Depends(get_payment_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Issues a formal refund against an overpaid or cancelled invoice,
    recording a dedicated financial ledger payment entry (payment_type='refund')
    and reconciling invoice balances without negative dues.
    """
    return service.process_refund(refund_data, current_user)