from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.services.attendance_engine_service import AttendanceEngineService

router = APIRouter(
    prefix="/attendance-engine",
    tags=["Attendance Processing Engine"],
)


def get_attendance_engine_service(db: Session = Depends(get_db)) -> AttendanceEngineService:
    return AttendanceEngineService(db)


@router.post("/process-daily")
def process_hotel_daily_attendance(
    target_date_str: Optional[str] = Query(None, description="YYYY-MM-DD (Defaults to today)"),
    hotel_id: Optional[int] = Query(None),
    service: AttendanceEngineService = Depends(get_attendance_engine_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.process_hotel_daily_attendance(target_date_str, hotel_id, current_user)