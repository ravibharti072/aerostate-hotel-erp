from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.expense_service import ExpenseService

router = APIRouter(
    prefix="/expenses",
    tags=["Expenses"],
)


def get_expense_service(db: Session = Depends(get_db)) -> ExpenseService:
    return ExpenseService(db)


@router.post("/", response_model=schemas.ExpenseResponse)
def create_expense(
    expense: schemas.ExpenseCreate,
    service: ExpenseService = Depends(get_expense_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_expense(expense, current_user)


@router.get("/", response_model=List[schemas.ExpenseResponse])
def get_expenses(
    hotel_id: Optional[int] = None,
    vendor_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    expense_category: Optional[str] = None,
    payment_status: Optional[str] = None,
    service: ExpenseService = Depends(get_expense_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_expenses(
        hotel_id,
        vendor_id,
        staff_id,
        expense_category,
        payment_status,
        current_user,
    )


@router.get("/{expense_id}", response_model=schemas.ExpenseResponse)
def get_expense(
    expense_id: int,
    service: ExpenseService = Depends(get_expense_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_expense(expense_id, current_user)


@router.put("/{expense_id}", response_model=schemas.ExpenseResponse)
def update_expense(
    expense_id: int,
    expense_update: schemas.ExpenseUpdate,
    service: ExpenseService = Depends(get_expense_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_expense(expense_id, expense_update, current_user)


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    service: ExpenseService = Depends(get_expense_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_expense(expense_id, current_user)