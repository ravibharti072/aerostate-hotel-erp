from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date, time
from typing import Optional, List, Dict, Any

from app.database import get_db
from app import models
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/attendance-engine",
    tags=["Attendance Processing Engine"]
)

# -----------------------------
# CORE CALCULATION ENGINE
# -----------------------------
def process_staff_day_punches(
    staff: models.Staff,
    target_date: date,
    db: Session
) -> Dict[str, Any]:
    """
    Calculates total hours worked from split punches (e.g., 7 AM-12 PM & 4 PM-9 PM)
    and determines attendance status against designated hours.
    """
    # 1. Fetch raw biometric punches for this staff & date ordered chronologically
    start_datetime = datetime.combine(target_date, time.min)
    end_datetime = datetime.combine(target_date, time.max)

    punches = db.query(models.BiometricLog).filter(
        models.BiometricLog.staff_id == staff.id,
        models.BiometricLog.punch_time >= start_datetime,
        models.BiometricLog.punch_time <= end_datetime
    ).order_by(models.BiometricLog.punch_time.asc()).all()

    if not punches:
        return {
            "status": "absent",
            "total_hours": 0.0,
            "check_in_time": None,
            "check_out_time": None,
            "remarks": "No biometric punches found."
        }

    # 2. Pair punches chronologically (In1 -> Out1, In2 -> Out2, ...)
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

    # 3. Retrieve designated hours (defaults to 8 or 10 if not set on staff model)
    designated_hours = getattr(staff, "working_hours", None) or getattr(staff, "shift_hours", 8.0)
    try:
        designated_hours = float(designated_hours)
    except (ValueError, TypeError):
        designated_hours = 8.0

    # 4. Determine Attendance Status based on designated hours
    # If punches are odd (e.g., missed punch-out), flag it
    has_odd_punches = (len(punch_times) % 2 != 0)

    if total_hours >= (designated_hours - 0.25):  # 15 min grace period allowed
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
        "remarks": remarks
    }


def sync_daily_attendance_record(
    hotel_id: int,
    staff_id: int,
    target_date: date,
    result: Dict[str, Any],
    db: Session
):
    """
    Saves or updates the record in models.StaffAttendance
    """
    existing_attendance = db.query(models.StaffAttendance).filter(
        models.StaffAttendance.hotel_id == hotel_id,
        models.StaffAttendance.staff_id == staff_id,
        models.StaffAttendance.attendance_date == target_date
    ).first()

    if existing_attendance:
        existing_attendance.status = result["status"]
        existing_attendance.check_in_time = result["check_in_time"]
        existing_attendance.check_out_time = result["check_out_time"]
        existing_attendance.remarks = result["remarks"]
    else:
        new_attendance = models.StaffAttendance(
            hotel_id=hotel_id,
            staff_id=staff_id,
            attendance_date=target_date,
            status=result["status"],
            check_in_time=result["check_in_time"],
            check_out_time=result["check_out_time"],
            remarks=result["remarks"]
        )
        db.add(new_attendance)

    db.commit()


# -----------------------------
# ENGINE ENDPOINTS
# -----------------------------
@router.post("/process-daily")
def process_hotel_daily_attendance(
    target_date_str: Optional[str] = Query(None, description="YYYY-MM-DD (Defaults to today)"),
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Processes all active employees for the day, calculates split shifts,
    and updates final attendance.
    """
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized to trigger attendance calculations"
        )

    target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id

    if target_date_str:
        calc_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    else:
        calc_date = datetime.now().date()

    active_staff = db.query(models.Staff).filter(
        models.Staff.hotel_id == target_hotel_id,
        models.Staff.status == "active"
    ).all()

    processed_summary = []

    for staff in active_staff:
        res = process_staff_day_punches(staff, calc_date, db)
        sync_daily_attendance_record(
            hotel_id=target_hotel_id,
            staff_id=staff.id,
            target_date=calc_date,
            result=res,
            db=db
        )
        processed_summary.append({
            "staff_id": staff.id,
            "staff_name": staff.full_name,
            "status": res["status"],
            "total_hours": res["total_hours"],
            "remarks": res["remarks"]
        })

    return {
        "message": f"Processed attendance for {len(processed_summary)} staff members on {calc_date}",
        "summary": processed_summary
    }