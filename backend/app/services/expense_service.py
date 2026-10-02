from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.expense_repository import ExpenseRepository


class ExpenseService:
    ALLOWED_PAYMENT_STATUSES = ["paid", "pending", "partial", "cancelled"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = ExpenseRepository(db)

    # ------------------------------------------------------------------------
    # Role & Ownership Assertions
    # ------------------------------------------------------------------------

    def _assert_can_manage(self, current_user: models.User, action_label: str) -> None:
        allowed = ["super-admin", "hotel-admin", "manager", "accountant"]
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Only accountant, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # ------------------------------------------------------------------------
    # Business Logic
    # ------------------------------------------------------------------------

    def create_expense(
        self,
        expense: schemas.ExpenseCreate,
        current_user: models.User,
    ) -> models.Expense:
        self._assert_can_manage(current_user, "create expenses")
        self._assert_owns_hotel(
            current_user,
            expense.hotel_id,
            "You can create expenses only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(expense.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        if expense.vendor_id:
            vendor = self.repo.get_vendor_by_id(expense.vendor_id, expense.hotel_id)
            if not vendor:
                raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

        if expense.staff_id:
            staff = self.repo.get_staff_by_id(expense.staff_id, expense.hotel_id)
            if not staff:
                raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        if expense.payment_status not in self.ALLOWED_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_PAYMENT_STATUSES}",
            )

        if expense.amount <= 0:
            raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

        return self.repo.create_expense(expense.model_dump())

    def get_expenses(
        self,
        hotel_id: Optional[int],
        vendor_id: Optional[int],
        staff_id: Optional[int],
        expense_category: Optional[str],
        payment_status: Optional[str],
        current_user: models.User,
    ) -> List[models.Expense]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_expenses(
            hotel_id=target_hotel_id,
            vendor_id=vendor_id,
            staff_id=staff_id,
            expense_category=expense_category,
            payment_status=payment_status,
        )

    def get_expense(self, expense_id: int, current_user: models.User) -> models.Expense:
        expense = self.repo.get_by_id(expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        self._assert_owns_hotel(
            current_user,
            expense.hotel_id,
            "You can view only expenses from your own hotel",
        )
        return expense

    def update_expense(
        self,
        expense_id: int,
        expense_update: schemas.ExpenseUpdate,
        current_user: models.User,
    ) -> models.Expense:
        self._assert_can_manage(current_user, "update expenses")

        expense = self.repo.get_by_id(expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        self._assert_owns_hotel(
            current_user,
            expense.hotel_id,
            "You can update only expenses from your own hotel",
        )

        update_data = expense_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(status_code=403, detail="You cannot move expense to another hotel")

        check_hotel_id = update_data.get("hotel_id", expense.hotel_id)

        if update_data.get("vendor_id"):
            vendor = self.repo.get_vendor_by_id(update_data["vendor_id"], check_hotel_id)
            if not vendor:
                raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

        if update_data.get("staff_id"):
            staff = self.repo.get_staff_by_id(update_data["staff_id"], check_hotel_id)
            if not staff:
                raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        if (
            "payment_status" in update_data
            and update_data["payment_status"] not in self.ALLOWED_PAYMENT_STATUSES
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_PAYMENT_STATUSES}",
            )

        if "amount" in update_data and update_data["amount"] <= 0:
            raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

        return self.repo.update_expense(expense, update_data)

    def delete_expense(self, expense_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user, "delete expenses")

        expense = self.repo.get_by_id(expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        self._assert_owns_hotel(
            current_user,
            expense.hotel_id,
            "You can delete only expenses from your own hotel",
        )

        self.repo.delete_expense(expense)
        return {"message": "Expense deleted successfully"}