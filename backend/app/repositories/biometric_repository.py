from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class BiometricRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Biometric Log Queries & Writes
    # -------------------------------------------------------------

    def get_log_by_staff_and_time(
        self, staff_id: int, punch_time: datetime
    ) -> Optional[models.BiometricLog]:
        return (
            self.db.query(models.BiometricLog)
            .filter(
                models.BiometricLog.staff_id == staff_id,
                models.BiometricLog.punch_time == punch_time,
            )
            .first()
        )

    def create_punch_log(self, punch_data: Dict[str, Any]) -> models.BiometricLog:
        new_log = models.BiometricLog(**punch_data)
        self.db.add(new_log)
        self.db.commit()
        self.db.refresh(new_log)
        return new_log

    def create_batch_punches(self, punches_data: List[Dict[str, Any]]) -> int:
        inserted_count = 0
        for p in punches_data:
            existing = self.get_log_by_staff_and_time(p["staff_id"], p["punch_time"])
            if not existing:
                self.db.add(models.BiometricLog(**p))
                inserted_count += 1
        self.db.commit()
        return inserted_count

    def list_logs(
        self,
        hotel_id: Optional[int] = None,
        staff_id: Optional[int] = None,
        date_str: Optional[str] = None,
    ) -> List[models.BiometricLog]:
        query = self.db.query(models.BiometricLog)

        if hotel_id is not None:
            query = query.filter(models.BiometricLog.hotel_id == hotel_id)

        if staff_id is not None:
            query = query.filter(models.BiometricLog.staff_id == staff_id)

        if date_str is not None:
            query = query.filter(self.db.func.date(models.BiometricLog.punch_time) == date_str)

        return query.order_by(models.BiometricLog.punch_time.desc()).all()

    # -------------------------------------------------------------
    # Cross-Domain Lookups (Staff Validation)
    # -------------------------------------------------------------

    def get_staff_in_hotel(self, staff_id: int, hotel_id: int) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.id == staff_id,
                models.Staff.hotel_id == hotel_id,
            )
            .first()
        )

    # -------------------------------------------------------------
    # Session Controls
    # -------------------------------------------------------------

    def rollback(self) -> None:
        self.db.rollback()