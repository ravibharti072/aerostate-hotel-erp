from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class ExpenseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, expense_id: int) -> Optional[models.Expense]:
        return self.db.query(models.Expense).filter(models.Expense.id == expense_id).first()

    def list_expenses(
        self,
        hotel_id: Optional[int] = None,
        vendor_id: Optional[int] = None,
        staff_id: Optional[int] = None,
        expense_category: Optional[str] = None,
        payment_status: Optional[str] = None,
    ) -> List[models.Expense]:
        query = self.db.query(models.Expense)

        if hotel_id is not None:
            query = query.filter(models.Expense.hotel_id == hotel_id)
        if vendor_id is not None:
            query = query.filter(models.Expense.vendor_id == vendor_id)
        if staff_id is not None:
            query = query.filter(models.Expense.staff_id == staff_id)
        if expense_category is not None:
            query = query.filter(models.Expense.expense_category == expense_category)
        if payment_status is not None:
            query = query.filter(models.Expense.payment_status == payment_status)

        return query.order_by(models.Expense.id.desc()).all()

    def create_expense(self, expense_data: Dict[str, Any]) -> models.Expense:
        new_expense = models.Expense(**expense_data)
        self.db.add(new_expense)
        self.db.commit()
        self.db.refresh(new_expense)
        return new_expense

    def update_expense(
        self,
        expense: models.Expense,
        update_fields: Dict[str, Any]
    ) -> models.Expense:
        for key, value in update_fields.items():
            setattr(expense, key, value)
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def delete_expense(self, expense: models.Expense) -> None:
        self.db.delete(expense)
        self.db.commit()

    # ------------------------------------------------------------------------
    # Cross-Model Reference Checks (Hotel, Vendor, Staff)
    # ------------------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_vendor_by_id(self, vendor_id: int, hotel_id: int) -> Optional[models.Vendor]:
        return (
            self.db.query(models.Vendor)
            .filter(
                models.Vendor.id == vendor_id,
                models.Vendor.hotel_id == hotel_id,
            )
            .first()
        )

    def get_staff_by_id(self, staff_id: int, hotel_id: int) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.id == staff_id,
                models.Staff.hotel_id == hotel_id,
            )
            .first()
        )