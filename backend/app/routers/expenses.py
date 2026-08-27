from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/expenses",
    tags=["Expenses"]
)

@router.post("/", response_model=schemas.ExpenseResponse)
def create_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant"]:
        raise HTTPException(status_code=403, detail="Only accountant, hotel-admin, manager, or super-admin can create expenses")

    if current_user.role != "super-admin" and expense.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can create expenses only for your own hotel")

    hotel = db.query(models.Hotel).filter(models.Hotel.id == expense.hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    if expense.vendor_id:
        vendor = db.query(models.Vendor).filter(
            models.Vendor.id == expense.vendor_id,
            models.Vendor.hotel_id == expense.hotel_id
        ).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

    if expense.staff_id:
        staff = db.query(models.Staff).filter(
            models.Staff.id == expense.staff_id,
            models.Staff.hotel_id == expense.hotel_id
        ).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

    allowed_payment_statuses = ["paid", "pending", "partial", "cancelled"]
    if expense.payment_status not in allowed_payment_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}")

    if expense.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

    new_expense = models.Expense(**expense.model_dump())
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    return new_expense


@router.get("/", response_model=list[schemas.ExpenseResponse])
def get_expenses(
    hotel_id: Optional[int] = None,
    vendor_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    expense_category: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Expense)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Expense.hotel_id == hotel_id)
    else:
        query = query.filter(models.Expense.hotel_id == current_user.hotel_id)

    if vendor_id:
        query = query.filter(models.Expense.vendor_id == vendor_id)
    if staff_id:
        query = query.filter(models.Expense.staff_id == staff_id)
    if expense_category:
        query = query.filter(models.Expense.expense_category == expense_category)
    if payment_status:
        query = query.filter(models.Expense.payment_status == payment_status)

    return query.order_by(models.Expense.id.desc()).all()


@router.get("/{expense_id}", response_model=schemas.ExpenseResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if current_user.role != "super-admin" and expense.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can view only expenses from your own hotel")

    return expense


@router.put("/{expense_id}", response_model=schemas.ExpenseResponse)
def update_expense(
    expense_id: int,
    expense_update: schemas.ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant"]:
        raise HTTPException(status_code=403, detail="Only accountant, hotel-admin, manager, or super-admin can update expenses")

    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if current_user.role != "super-admin" and expense.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can update only expenses from your own hotel")

    update_data = expense_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin" and "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You cannot move expense to another hotel")

    check_hotel_id = update_data.get("hotel_id", expense.hotel_id)

    if "vendor_id" in update_data and update_data["vendor_id"]:
        vendor = db.query(models.Vendor).filter(models.Vendor.id == update_data["vendor_id"], models.Vendor.hotel_id == check_hotel_id).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

    if "staff_id" in update_data and update_data["staff_id"]:
        staff = db.query(models.Staff).filter(models.Staff.id == update_data["staff_id"], models.Staff.hotel_id == check_hotel_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

    allowed_payment_statuses = ["paid", "pending", "partial", "cancelled"]
    if "payment_status" in update_data and update_data["payment_status"] not in allowed_payment_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}")

    if "amount" in update_data and update_data["amount"] <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

    for key, value in update_data.items():
        setattr(expense, key, value)

    db.commit()
    db.refresh(expense)

    return expense


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant"]:
        raise HTTPException(status_code=403, detail="Only accountant, hotel-admin, manager, or super-admin can delete expenses")

    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if current_user.role != "super-admin" and expense.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can delete only expenses from your own hotel")

    db.delete(expense)
    db.commit()

    return {"message": "Expense deleted successfully"}