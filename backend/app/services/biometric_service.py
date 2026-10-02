from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

# Import the ZK library for direct hardware communication
try:
    from zk import ZK
except ImportError:
    ZK = None

from app import models, schemas
from app.repositories.biometric_repository import BiometricRepository


class BiometricService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = BiometricRepository(db)

    # -------------------------------------------------------------
    # Hardware Pull Workflow
    # -------------------------------------------------------------

    def pull_sync_from_device(
        self,
        hotel_id: int,
        device_ip: str = "192.168.137.50",
        device_port: int = 5005,
    ) -> Dict[str, str]:
        if ZK is None:
            raise HTTPException(
                status_code=500,
                detail="The 'pyzk' library is not installed. Run 'pip install pyzk'.",
            )

        zk_instance = ZK(device_ip, port=device_port, timeout=10)
        conn = None

        try:
            conn = zk_instance.connect()
            conn.disable_device()  # Prevent punches while reading

            attendances = conn.get_attendance()
            valid_punches: List[Dict[str, Any]] = []

            for att in attendances:
                staff_id_from_device = int(att.user_id)

                # Verify staff belongs to this hotel to maintain multi-tenant integrity
                staff_exists = self.repo.get_staff_in_hotel(staff_id_from_device, hotel_id)
                if not staff_exists:
                    continue  # Skip logs for unmapped IDs

                valid_punches.append({
                    "hotel_id": hotel_id,
                    "staff_id": staff_id_from_device,
                    "punch_time": att.timestamp,
                    "device_id": device_ip,
                    "punch_type": str(att.punch),
                })

            inserted_count = self.repo.create_batch_punches(valid_punches)
            conn.enable_device()

            return {
                "status": "success",
                "message": f"Successfully pulled and saved {inserted_count} new punches from {device_ip}.",
            }

        except HTTPException:
            self.repo.rollback()
            raise
        except Exception as e:
            self.repo.rollback()
            raise HTTPException(status_code=500, detail=f"Device connection failed: {str(e)}")
        finally:
            if conn:
                conn.disconnect()

    # -------------------------------------------------------------
    # Webhook / API Ingestion Workflows
    # -------------------------------------------------------------

    def record_single_punch(self, punch: schemas.BiometricPunchCreate) -> Dict[str, Any]:
        staff = self.repo.get_staff_in_hotel(punch.staff_id, punch.hotel_id)
        if not staff:
            raise HTTPException(
                status_code=404,
                detail=f"Staff ID {punch.staff_id} not found for hotel {punch.hotel_id}",
            )

        # Avoid exact duplicate punches
        existing_punch = self.repo.get_log_by_staff_and_time(punch.staff_id, punch.punch_time)
        if existing_punch:
            return {"message": "Punch already logged", "id": existing_punch.id}

        punch_data = {
            "hotel_id": punch.hotel_id,
            "staff_id": punch.staff_id,
            "punch_time": punch.punch_time,
            "device_id": punch.device_id,
            "punch_type": punch.punch_type,
        }

        new_log = self.repo.create_punch_log(punch_data)
        return {"message": "Punch logged successfully", "log_id": new_log.id}

    def record_batch_punches(self, batch: schemas.BiometricBatchSync) -> Dict[str, str]:
        punches_to_insert: List[Dict[str, Any]] = []

        for p in batch.punches:
            punches_to_insert.append({
                "hotel_id": batch.hotel_id,
                "staff_id": p.staff_id,
                "punch_time": p.punch_time,
                "device_id": p.device_id,
                "punch_type": p.punch_type,
            })

        inserted_count = self.repo.create_batch_punches(punches_to_insert)
        return {"message": f"Successfully processed batch. Inserted {inserted_count} new punches."}

    def get_biometric_logs(
        self,
        hotel_id: Optional[int],
        staff_id: Optional[int],
        date_str: Optional[str],
        current_user: models.User,
    ) -> List[models.BiometricLog]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_logs(
            hotel_id=target_hotel_id,
            staff_id=staff_id,
            date_str=date_str,
        )