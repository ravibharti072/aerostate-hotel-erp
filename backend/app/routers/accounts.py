from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.accounts_service import AccountsService

router = APIRouter(
    prefix="/accounts",
    tags=["Accounts & Financials"]
)


def get_accounts_service(db: Session = Depends(get_db)) -> AccountsService:
    return AccountsService(db)


# ============================================================================
# 1. ACCOUNTS OVERVIEW & METRICS
# ============================================================================

@router.get("/overview")
def get_accounts_overview(
    salary_month: Optional[str] = Query(None, description="Format: YYYY-MM"),
    service: AccountsService = Depends(get_accounts_service),
    current_user: models.User = Depends(get_current_user)
) -> Dict[str, Any]:
    return service.get_overview(salary_month, current_user)


# ============================================================================
# 2. SALARY DISBURSEMENT & PAYOUT WORKFLOW
# ============================================================================

@router.put("/disburse-salary/{salary_id}", response_model=schemas.StaffSalaryResponse)
def disburse_salary(
    salary_id: int,
    payment_method: str = Query(..., description="cash / bank_transfer / upi / cheque"),
    transaction_id: Optional[str] = Query(None),
    remarks: Optional[str] = Query(None),
    service: AccountsService = Depends(get_accounts_service),
    current_user: models.User = Depends(get_current_user)
):
    return service.disburse_salary(salary_id, payment_method, transaction_id, remarks, current_user)


# ============================================================================
# 3. SALARY ADVANCE MANAGEMENT
# ============================================================================

@router.post("/advances", response_model=schemas.SalaryAdvanceResponse)
def create_salary_advance(
    advance: schemas.SalaryAdvanceCreate,
    service: AccountsService = Depends(get_accounts_service),
    current_user: models.User = Depends(get_current_user)
):
    return service.create_salary_advance(advance, current_user)


@router.get("/advances", response_model=List[schemas.SalaryAdvanceResponse])
def get_salary_advances(
    hotel_id: Optional[int] = Query(None),
    staff_id: Optional[int] = Query(None),
    deduct_month: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service: AccountsService = Depends(get_accounts_service),
    current_user: models.User = Depends(get_current_user)
):
    return service.get_salary_advances(hotel_id, staff_id, deduct_month, status, current_user)


@router.put("/advances/{advance_id}", response_model=schemas.SalaryAdvanceResponse)
def update_salary_advance(
    advance_id: int,
    advance_update: schemas.SalaryAdvanceUpdate,
    service: AccountsService = Depends(get_accounts_service),
    current_user: models.User = Depends(get_current_user)
):
    return service.update_salary_advance(advance_id, advance_update, current_user)


@router.delete("/advances/{advance_id}")
def delete_salary_advance(
    advance_id: int,
    service: AccountsService = Depends(get_accounts_service),
    current_user: models.User = Depends(get_current_user)
):
    return service.delete_salary_advance(advance_id, current_user)