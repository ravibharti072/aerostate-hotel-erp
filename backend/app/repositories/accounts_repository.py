from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class AccountsRepository:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------------
    # Salaries
    # ------------------------------------------------------------------------

    def get_salary_by_id(self, salary_id: int) -> Optional[models.StaffSalary]:
        return self.db.query(models.StaffSalary).filter(models.StaffSalary.id == salary_id).first()

    def list_salaries_by_month(
        self,
        active_month: str,
        hotel_id: Optional[int] = None
    ) -> List[models.StaffSalary]:
        query = self.db.query(models.StaffSalary).filter(
            models.StaffSalary.salary_month == active_month
        )
        if hotel_id is not None:
            query = query.filter(models.StaffSalary.hotel_id == hotel_id)
        return query.all()

    def get_linked_approved_advances(
        self,
        hotel_id: int,
        staff_id: int,
        deduct_month: str
    ) -> List[models.SalaryAdvance]:
        return self.db.query(models.SalaryAdvance).filter(
            models.SalaryAdvance.hotel_id == hotel_id,
            models.SalaryAdvance.staff_id == staff_id,
            models.SalaryAdvance.deduct_month == deduct_month,
            models.SalaryAdvance.status == "approved"
        ).all()

    # ------------------------------------------------------------------------
    # Advances
    # ------------------------------------------------------------------------

    def get_advance_by_id(self, advance_id: int) -> Optional[models.SalaryAdvance]:
        return self.db.query(models.SalaryAdvance).filter(models.SalaryAdvance.id == advance_id).first()

    def list_advances_by_month(
        self,
        active_month: str,
        hotel_id: Optional[int] = None
    ) -> List[models.SalaryAdvance]:
        query = self.db.query(models.SalaryAdvance).filter(
            models.SalaryAdvance.deduct_month == active_month
        )
        if hotel_id is not None:
            query = query.filter(models.SalaryAdvance.hotel_id == hotel_id)
        return query.all()

    def list_advances(
        self,
        hotel_id: Optional[int] = None,
        staff_id: Optional[int] = None,
        deduct_month: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[models.SalaryAdvance]:
        query = self.db.query(models.SalaryAdvance)
        if hotel_id is not None:
            query = query.filter(models.SalaryAdvance.hotel_id == hotel_id)
        if staff_id is not None:
            query = query.filter(models.SalaryAdvance.staff_id == staff_id)
        if deduct_month is not None:
            query = query.filter(models.SalaryAdvance.deduct_month == deduct_month)
        if status is not None:
            query = query.filter(models.SalaryAdvance.status == status)
        return query.order_by(models.SalaryAdvance.id.desc()).all()

    def create_advance(self, advance_data: Dict[str, Any]) -> models.SalaryAdvance:
        new_advance = models.SalaryAdvance(**advance_data)
        self.db.add(new_advance)
        self.db.commit()
        self.db.refresh(new_advance)
        return new_advance

    def update_advance(self, advance: models.SalaryAdvance, update_fields: Dict[str, Any]) -> models.SalaryAdvance:
        for key, value in update_fields.items():
            setattr(advance, key, value)
        self.db.commit()
        self.db.refresh(advance)
        return advance

    def delete_advance(self, advance: models.SalaryAdvance) -> None:
        self.db.delete(advance)
        self.db.commit()

    # ------------------------------------------------------------------------
    # External Model References (Staff & Expenses)
    # ------------------------------------------------------------------------

    def get_staff_by_id(self, staff_id: int, hotel_id: int) -> Optional[models.Staff]:
        return self.db.query(models.Staff).filter(
            models.Staff.id == staff_id,
            models.Staff.hotel_id == hotel_id
        ).first()

    def list_expenses(self, hotel_id: Optional[int] = None) -> List[models.Expense]:
        query = self.db.query(models.Expense)
        if hotel_id is not None:
            query = query.filter(models.Expense.hotel_id == hotel_id)
        return query.all()

    # ------------------------------------------------------------------------
    # Session Operations
    # ------------------------------------------------------------------------

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance: Any) -> None:
        self.db.refresh(instance)