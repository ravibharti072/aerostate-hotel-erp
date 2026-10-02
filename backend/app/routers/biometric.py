from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.biometric_service import BiometricService

router = APIRouter(
    prefix="/biometric",
    tags=["Biometric Logs"],
)


def get_biometric_service(db: Session = Depends(get_db)) -> BiometricService:
    return BiometricService(db)


# -----------------------------
# HARDWARE TCP PULL API
# -----------------------------
@router.post("/pull-device-sync", status_code=status.HTTP_200_OK)
def pull_sync_from_device(
    hotel_id: int = Query(...),
    device_ip: str = Query("192.168.137.50"),
    device_port: int = Query(5005),
    service: BiometricService = Depends(get_biometric_service),
) -> Dict[str, str]:
    return service.pull_sync_from_device(hotel_id, device_ip, device_port)


# -----------------------------
# BIOMETRIC PUNCH APIS (WEBHOOKS / BATCH)
# -----------------------------
@router.post("/punch", status_code=status.HTTP_201_CREATED)
def record_single_punch(
    punch: schemas.BiometricPunchCreate,
    service: BiometricService = Depends(get_biometric_service),
) -> Dict[str, Any]:
    return service.record_single_punch(punch)


@router.post("/sync-batch", status_code=status.HTTP_201_CREATED)
def record_batch_punches(
    batch: schemas.BiometricBatchSync,
    service: BiometricService = Depends(get_biometric_service),
) -> Dict[str, str]:
    return service.record_batch_punches(batch)


@router.get("/logs", response_model=List[schemas.BiometricLogResponse])
def get_biometric_logs(
    hotel_id: Optional[int] = Query(None),
    staff_id: Optional[int] = Query(None),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    service: BiometricService = Depends(get_biometric_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_biometric_logs(hotel_id, staff_id, date, current_user)