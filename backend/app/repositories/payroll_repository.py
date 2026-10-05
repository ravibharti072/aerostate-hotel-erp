from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class PayrollRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Salary Structures
    # -------------------------------------------------------------

    def list_salary_structures(
        self, hotel_id: Optional[int] = None
    ) -> List[models.StaffSalaryStructure]:
        query = self.db.query(models.StaffSalaryStructure)
        if hotel_id is not None:
            query = query.filter(models.StaffSalaryStructure.hotel_id == hotel_id)
        return query.all()

    def get_salary_structure_by_staff_id(
        self, staff_id: int, hotel_id: Optional[int] = None
    ) -> Optional[models.StaffSalaryStructure]:
        query = self.db.query(models.StaffSalaryStructure).filter(
            models.StaffSalaryStructure.staff_id == staff_id
        )
        if hotel_id is not None:
            query = query.filter(models.StaffSalaryStructure.hotel_id == hotel_id)
        return query.first()

    def save_salary_structure(
        self,
        existing: Optional[models.StaffSalaryStructure],
        payload_data: Dict[str, Any],
    ) -> models.StaffSalaryStructure:
        if existing:
            for key, value in payload_data.items():
                setattr(existing, key, value)
            structure = existing
        else:
            structure = models.StaffSalaryStructure(**payload_data)
            self.db.add(structure)

        self.db.commit()
        self.db.refresh(structure)
        return structure

    # -------------------------------------------------------------
    # Payroll Records (StaffSalary)
    # -------------------------------------------------------------

    def list_payroll_by_month(
        self, month: str, hotel_id: Optional[int] = None
    ) -> List[models.StaffSalary]:
        query = self.db.query(models.StaffSalary).filter(
            models.StaffSalary.salary_month == month
        )
        if hotel_id is not None:
            query = query.filter(models.StaffSalary.hotel_id == hotel_id)
        return query.all()

    def get_payroll_record_by_id(
        self, record_id: int, hotel_id: Optional[int] = None
    ) -> Optional[models.StaffSalary]:
        query = self.db.query(models.StaffSalary).filter(
            models.StaffSalary.id == record_id
        )
        if hotel_id is not None:
            query = query.filter(models.StaffSalary.hotel_id == hotel_id)
        return query.first()

    def get_payroll_record_by_staff_and_month(
        self, staff_id: int, month: str, hotel_id: Optional[int] = None
    ) -> Optional[models.StaffSalary]:
        query = self.db.query(models.StaffSalary).filter(
            models.StaffSalary.staff_id == staff_id,
            models.StaffSalary.salary_month == month,
        )
        if hotel_id is not None:
            query = query.filter(models.StaffSalary.hotel_id == hotel_id)
        return query.first()

    def update_payroll_record(
        self,
        record: models.StaffSalary,
        updates: Dict[str, Any],
    ) -> models.StaffSalary:
        for key, value in updates.items():
            setattr(record, key, value)
        self.db.commit()
        self.db.refresh(record)
        return record

    def save_bulk_payroll(
        self,
        updates: List[tuple[models.StaffSalary, Dict[str, Any]]],
        new_records: List[Dict[str, Any]],
    ) -> None:
        for record, fields in updates:
            for key, value in fields.items():
                setattr(record, key, value)

        for record_dict in new_records:
            self.db.add(models.StaffSalary(**record_dict))

        self.db.commit()

    # -------------------------------------------------------------
    # Attendance, Leave & Staff Lookups
    # -------------------------------------------------------------

    def list_active_staff(self, hotel_id: Optional[int] = None) -> List[models.Staff]:
        query = self.db.query(models.Staff).filter(models.Staff.status == "active")
        if hotel_id is not None:
            query = query.filter(models.Staff.hotel_id == hotel_id)
        return query.all()

    def list_staff_attendance(self, staff_id: int) -> List[models.StaffAttendance]:
        return (
            self.db.query(models.StaffAttendance)
            .filter(models.StaffAttendance.staff_id == staff_id)
            .all()
        )

    def list_staff_approved_leaves(self, staff_id: int) -> List[models.StaffLeave]:
        return (
            self.db.query(models.StaffLeave)
            .filter(
                models.StaffLeave.staff_id == staff_id,
                models.StaffLeave.status == "approved",
            )
            .all()
        )

    # -------------------------------------------------------------
    # Session Controls
    # -------------------------------------------------------------

    def rollback(self) -> None:
        self.db.rollback()