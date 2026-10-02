from datetime import datetime, date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class AttendanceEngineRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Staff & Biometric Queries
    # -------------------------------------------------------------

    def list_active_staff(self, hotel_id: int) -> List[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.hotel_id == hotel_id,
                models.Staff.status == "active",
            )
            .all()
        )

    def get_staff_punches_between(
        self, staff_id: int, start_datetime: datetime, end_datetime: datetime
    ) -> List[models.BiometricLog]:
        return (
            self.db.query(models.BiometricLog)
            .filter(
                models.BiometricLog.staff_id == staff_id,
                models.BiometricLog.punch_time >= start_datetime,
                models.BiometricLog.punch_time <= end_datetime,
            )
            .order_by(models.BiometricLog.punch_time.asc())
            .all()
        )

    # -------------------------------------------------------------
    # Attendance Record Sync
    # -------------------------------------------------------------

    def get_daily_attendance(
        self, hotel_id: int, staff_id: int, target_date: date
    ) -> Optional[models.StaffAttendance]:
        return (
            self.db.query(models.StaffAttendance)
            .filter(
                models.StaffAttendance.hotel_id == hotel_id,
                models.StaffAttendance.staff_id == staff_id,
                models.StaffAttendance.attendance_date == target_date,
            )
            .first()
        )

    def save_or_update_daily_attendance(
        self,
        hotel_id: int,
        staff_id: int,
        target_date: date,
        result: Dict[str, Any],
    ) -> None:
        existing = self.get_daily_attendance(hotel_id, staff_id, target_date)

        if existing:
            existing.status = result["status"]
            existing.check_in_time = result["check_in_time"]
            existing.check_out_time = result["check_out_time"]
            existing.remarks = result["remarks"]
        else:
            new_attendance = models.StaffAttendance(
                hotel_id=hotel_id,
                staff_id=staff_id,
                attendance_date=target_date,
                status=result["status"],
                check_in_time=result["check_in_time"],
                check_out_time=result["check_out_time"],
                remarks=result["remarks"],
            )
            self.db.add(new_attendance)

        self.db.commit()