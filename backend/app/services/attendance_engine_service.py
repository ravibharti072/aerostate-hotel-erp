from datetime import datetime, date, time
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.repositories.attendance_engine_repository import AttendanceEngineRepository


class AttendanceEngineService:
    ALLOWED_ROLES = ["super-admin", "hotel-admin", "manager", "hr"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = AttendanceEngineRepository(db)

    # -------------------------------------------------------------
    # Authorization Assertions
    # -------------------------------------------------------------

    def _assert_can_process(self, current_user: models.User) -> None:
        if current_user.role not in self.ALLOWED_ROLES:
            allowed = getattr(current_user, "allowed_modules", None) or []
            if not isinstance(allowed, list) or not any(m in allowed for m in ["staff", "hr", "attendance"]):
                raise HTTPException(
                    status_code=403,
                    detail="Unauthorized to trigger attendance calculations",
                )

    # -------------------------------------------------------------
    # Calculation & Processing Logic
    # -------------------------------------------------------------

    def process_staff_day_punches(
        self, staff: models.Staff, target_date: date
    ) -> Dict[str, Any]:
        """
        Calculates total hours worked from split punches (e.g., 7 AM-12 PM & 4 PM-9 PM)
        and determines attendance status against designated hours.
        """
        start_datetime = datetime.combine(target_date, time.min)
        end_datetime = datetime.combine(target_date, time.max)

        punches = self.repo.get_staff_punches_between(staff.id, start_datetime, end_datetime)

        if not punches:
            return {
                "status": "absent",
                "total_hours": 0.0,
                "check_in_time": None,
                "check_out_time": None,
                "remarks": "No biometric punches found.",
            }

        total_seconds = 0.0
        punch_times = [p.punch_time for p in punches]

        for i in range(0, len(punch_times) - 1, 2):
            in_time = punch_times[i]
            out_time = punch_times[i + 1]
            if out_time > in_time:
                total_seconds += (out_time - in_time).total_seconds()

        total_hours = round(total_seconds / 3600.0, 2)
        first_in = punch_times[0]
        last_out = punch_times[-1] if len(punch_times) > 1 else None

        designated_hours = getattr(staff, "working_hours", None) or getattr(staff, "shift_hours", 8.0)
        try:
            designated_hours = float(designated_hours)
        except (ValueError, TypeError):
            designated_hours = 8.0

        has_odd_punches = len(punch_times) % 2 != 0

        if total_hours >= (designated_hours - 0.25):  # 15 min grace period
            status = "present"
            remarks = f"Completed {total_hours}h / {designated_hours}h"
        elif total_hours >= (designated_hours / 2.0):
            status = "half-day"
            remarks = f"Half day: {total_hours}h / {designated_hours}h"
        else:
            status = "absent"
            remarks = f"Under-hours: {total_hours}h / {designated_hours}h"

        if has_odd_punches:
            remarks += " (Warning: Missing odd check-out punch)"

        return {
            "status": status,
            "total_hours": total_hours,
            "check_in_time": first_in,
            "check_out_time": last_out,
            "remarks": remarks,
        }

    def process_hotel_daily_attendance(
        self,
        target_date_str: Optional[str],
        hotel_id: Optional[int],
        current_user: models.User,
    ) -> Dict[str, Any]:
        self._assert_can_process(current_user)

        target_hotel_id = (
            hotel_id
            if current_user.role == "super-admin" and hotel_id
            else current_user.hotel_id
        )

        if target_date_str:
            calc_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        else:
            calc_date = datetime.now().date()

        active_staff = self.repo.list_active_staff(target_hotel_id)
        processed_summary: List[Dict[str, Any]] = []

        for staff in active_staff:
            res = self.process_staff_day_punches(staff, calc_date)
            self.repo.save_or_update_daily_attendance(
                hotel_id=target_hotel_id or staff.hotel_id,
                staff_id=staff.id,
                target_date=calc_date,
                result=res,
            )
            processed_summary.append({
                "staff_id": staff.id,
                "staff_name": staff.full_name,
                "status": res["status"],
                "total_hours": res["total_hours"],
                "remarks": res["remarks"],
            })

        return {
            "message": f"Processed attendance for {len(processed_summary)} staff members on {calc_date}",
            "summary": processed_summary,
        }