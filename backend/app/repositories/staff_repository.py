from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class StaffRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Staff Records
    # -------------------------------------------------------------

    def get_staff_by_id(self, staff_id: int) -> Optional[models.Staff]:
        return self.db.query(models.Staff).filter(models.Staff.id == staff_id).first()

    def get_staff_by_phone(self, hotel_id: int, phone: str) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.hotel_id == hotel_id,
                models.Staff.phone == phone,
            )
            .first()
        )

    def get_duplicate_staff_phone(
        self, hotel_id: int, phone: str, exclude_staff_id: int
    ) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.hotel_id == hotel_id,
                models.Staff.phone == phone,
                models.Staff.id != exclude_staff_id,
            )
            .first()
        )

    def list_staff(
        self,
        hotel_id: Optional[int] = None,
        department: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[models.Staff]:
        query = self.db.query(models.Staff)

        if hotel_id is not None:
            query = query.filter(models.Staff.hotel_id == hotel_id)
        if department is not None:
            query = query.filter(models.Staff.department == department)
        if status is not None:
            query = query.filter(models.Staff.status == status)

        return query.order_by(models.Staff.id.desc()).all()

    def create_staff(self, staff_data: Dict[str, Any]) -> models.Staff:
        new_staff = models.Staff(**staff_data)
        self.db.add(new_staff)
        self.db.commit()
        self.db.refresh(new_staff)
        return new_staff

    def update_staff(
        self, staff: models.Staff, update_fields: Dict[str, Any]
    ) -> models.Staff:
        for key, value in update_fields.items():
            setattr(staff, key, value)
        self.db.commit()
        self.db.refresh(staff)
        return staff

    def delete_staff(self, staff: models.Staff) -> None:
        self.db.delete(staff)
        self.db.commit()

    # -------------------------------------------------------------
    # Attendance Records
    # -------------------------------------------------------------

    def get_attendance_by_id(self, attendance_id: int) -> Optional[models.StaffAttendance]:
        return (
            self.db.query(models.StaffAttendance)
            .filter(models.StaffAttendance.id == attendance_id)
            .first()
        )

    def get_attendance_by_date(
        self, hotel_id: int, staff_id: int, attendance_date: datetime
    ) -> Optional[models.StaffAttendance]:
        return (
            self.db.query(models.StaffAttendance)
            .filter(
                models.StaffAttendance.hotel_id == hotel_id,
                models.StaffAttendance.staff_id == staff_id,
                models.StaffAttendance.attendance_date == attendance_date,
            )
            .first()
        )

    def get_duplicate_attendance_record(
        self, hotel_id: int, staff_id: int, attendance_date: datetime, exclude_id: int
    ) -> Optional[models.StaffAttendance]:
        return (
            self.db.query(models.StaffAttendance)
            .filter(
                models.StaffAttendance.hotel_id == hotel_id,
                models.StaffAttendance.staff_id == staff_id,
                models.StaffAttendance.attendance_date == attendance_date,
                models.StaffAttendance.id != exclude_id,
            )
            .first()
        )

    def list_attendance(
        self,
        hotel_id: Optional[int] = None,
        staff_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> List[models.StaffAttendance]:
        query = self.db.query(models.StaffAttendance)

        if hotel_id is not None:
            query = query.filter(models.StaffAttendance.hotel_id == hotel_id)
        if staff_id is not None:
            query = query.filter(models.StaffAttendance.staff_id == staff_id)
        if status is not None:
            query = query.filter(models.StaffAttendance.status == status)

        return query.order_by(models.StaffAttendance.id.desc()).all()

    def create_attendance(self, attendance_data: Dict[str, Any]) -> models.StaffAttendance:
        new_attendance = models.StaffAttendance(**attendance_data)
        self.db.add(new_attendance)
        self.db.commit()
        self.db.refresh(new_attendance)
        return new_attendance

    def update_attendance(
        self, attendance: models.StaffAttendance, update_fields: Dict[str, Any]
    ) -> models.StaffAttendance:
        for key, value in update_fields.items():
            setattr(attendance, key, value)
        self.db.commit()
        self.db.refresh(attendance)
        return attendance

    def delete_attendance(self, attendance: models.StaffAttendance) -> None:
        self.db.delete(attendance)
        self.db.commit()

    # -------------------------------------------------------------
    # Staff Salary Records
    # -------------------------------------------------------------

    def get_salary_by_id(self, salary_id: int) -> Optional[models.StaffSalary]:
        return (
            self.db.query(models.StaffSalary)
            .filter(models.StaffSalary.id == salary_id)
            .first()
        )

    def get_salary_by_month(
        self, hotel_id: int, staff_id: int, salary_month: str
    ) -> Optional[models.StaffSalary]:
        return (
            self.db.query(models.StaffSalary)
            .filter(
                models.StaffSalary.hotel_id == hotel_id,
                models.StaffSalary.staff_id == staff_id,
                models.StaffSalary.salary_month == salary_month,
            )
            .first()
        )

    def get_duplicate_salary_record(
        self, hotel_id: int, staff_id: int, salary_month: str, exclude_id: int
    ) -> Optional[models.StaffSalary]:
        return (
            self.db.query(models.StaffSalary)
            .filter(
                models.StaffSalary.hotel_id == hotel_id,
                models.StaffSalary.staff_id == staff_id,
                models.StaffSalary.salary_month == salary_month,
                models.StaffSalary.id != exclude_id,
            )
            .first()
        )

    def list_salaries(
        self,
        hotel_id: Optional[int] = None,
        staff_id: Optional[int] = None,
        salary_month: Optional[str] = None,
        payment_status: Optional[str] = None,
    ) -> List[models.StaffSalary]:
        query = self.db.query(models.StaffSalary)

        if hotel_id is not None:
            query = query.filter(models.StaffSalary.hotel_id == hotel_id)
        if staff_id is not None:
            query = query.filter(models.StaffSalary.staff_id == staff_id)
        if salary_month is not None:
            query = query.filter(models.StaffSalary.salary_month == salary_month)
        if payment_status is not None:
            query = query.filter(models.StaffSalary.payment_status == payment_status)

        return query.order_by(models.StaffSalary.id.desc()).all()

    def create_salary(self, salary_data: Dict[str, Any]) -> models.StaffSalary:
        new_salary = models.StaffSalary(**salary_data)
        self.db.add(new_salary)
        self.db.commit()
        self.db.refresh(new_salary)
        return new_salary

    def update_salary(
        self, salary: models.StaffSalary, update_fields: Dict[str, Any]
    ) -> models.StaffSalary:
        for key, value in update_fields.items():
            setattr(salary, key, value)
        self.db.commit()
        self.db.refresh(salary)
        return salary

    def delete_salary(self, salary: models.StaffSalary) -> None:
        self.db.delete(salary)
        self.db.commit()

    # -------------------------------------------------------------
    # Staff Leaves
    # -------------------------------------------------------------

    def get_leave_by_id(self, leave_id: int) -> Optional[models.StaffLeave]:
        return (
            self.db.query(models.StaffLeave)
            .filter(models.StaffLeave.id == leave_id)
            .first()
        )

    def list_leaves(
        self,
        hotel_id: Optional[int] = None,
        staff_id: Optional[int] = None,
        status: Optional[str] = None,
        leave_type: Optional[str] = None,
    ) -> List[models.StaffLeave]:
        query = self.db.query(models.StaffLeave)

        if hotel_id is not None:
            query = query.filter(models.StaffLeave.hotel_id == hotel_id)
        if staff_id is not None:
            query = query.filter(models.StaffLeave.staff_id == staff_id)
        if status is not None:
            query = query.filter(models.StaffLeave.status == status)
        if leave_type is not None:
            query = query.filter(models.StaffLeave.leave_type == leave_type)

        return query.order_by(models.StaffLeave.id.desc()).all()

    def create_leave(self, leave_data: Dict[str, Any]) -> models.StaffLeave:
        new_leave = models.StaffLeave(**leave_data)
        self.db.add(new_leave)
        self.db.commit()
        self.db.refresh(new_leave)
        return new_leave

    def update_leave(
        self, leave: models.StaffLeave, update_fields: Dict[str, Any]
    ) -> models.StaffLeave:
        for key, value in update_fields.items():
            setattr(leave, key, value)
        self.db.commit()
        self.db.refresh(leave)
        return leave

    def delete_leave(self, leave: models.StaffLeave) -> None:
        self.db.delete(leave)
        self.db.commit()

    # -------------------------------------------------------------
    # Cross-Domain Lookups
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_staff_for_hotel(self, staff_id: int, hotel_id: int) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.id == staff_id,
                models.Staff.hotel_id == hotel_id,
            )
            .first()
        )