from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# Import the ZK library for direct hardware communication
try:
    from zk import ZK
except ImportError:
    ZK = None

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/biometric",
    tags=["Biometric Logs"]
)

# -----------------------------
# PYDANTIC SCHEMAS FOR BIOMETRIC
# -----------------------------
class BiometricPunchCreate(BaseModel):
    hotel_id: int
    staff_id: int
    punch_time: datetime
    device_id: Optional[str] = "DEVICE-01"
    punch_type: Optional[str] = "auto"  # 'in', 'out', or 'auto'

class BiometricBatchSync(BaseModel):
    hotel_id: int
    punches: List[BiometricPunchCreate]

class BiometricLogResponse(BaseModel):
    id: int
    hotel_id: int
    staff_id: int
    punch_time: datetime
    device_id: Optional[str] = None
    punch_type: Optional[str] = None

    class Config:
        from_attributes = True


# -----------------------------
# HARDWARE TCP PULL API
# -----------------------------
@router.post("/pull-device-sync", status_code=status.HTTP_200_OK)
def pull_sync_from_device(
    hotel_id: int,
    device_ip: str = "192.168.137.50",
    device_port: int = 5005,
    db: Session = Depends(get_db)
):
    """
    Connects directly to the biometric device over the local network to pull raw attendance logs.
    """
    if ZK is None:
        raise HTTPException(
            status_code=500, 
            detail="The 'pyzk' library is not installed. Run 'pip install pyzk'."
        )

    zk_instance = ZK(device_ip, port=device_port, timeout=10)
    
    try:
        conn = zk_instance.connect()
        conn.disable_device() # Prevent punches while reading
        
        attendances = conn.get_attendance()
        inserted_count = 0
        
        for att in attendances:
            # Map the hardware User ID to the ERP Staff ID
            staff_id_from_device = int(att.user_id)
            
            # Verify staff belongs to this hotel to maintain multi-tenant integrity
            staff_exists = db.query(models.Staff).filter(
                models.Staff.id == staff_id_from_device,
                models.Staff.hotel_id == hotel_id
            ).first()

            if not staff_exists:
                continue # Skip logs for unmapped IDs

            # Avoid duplicate inserts
            existing_log = db.query(models.BiometricLog).filter(
                models.BiometricLog.staff_id == staff_id_from_device,
                models.BiometricLog.punch_time == att.timestamp
            ).first()
            
            if not existing_log:
                new_punch = models.BiometricLog(
                    hotel_id=hotel_id,
                    staff_id=staff_id_from_device,
                    punch_time=att.timestamp,
                    device_id=device_ip,
                    punch_type=str(att.punch)
                )
                db.add(new_punch)
                inserted_count += 1
                
        db.commit()
        conn.enable_device()
        
        return {
            "status": "success", 
            "message": f"Successfully pulled and saved {inserted_count} new punches from {device_ip}."
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Device connection failed: {str(e)}")
        
    finally:
        if 'conn' in locals():
            conn.disconnect()


# -----------------------------
# BIOMETRIC PUNCH APIS (WEBHOOKS / BATCH)
# -----------------------------
@router.post("/punch", status_code=status.HTTP_201_CREATED)
def record_single_punch(
    punch: BiometricPunchCreate,
    db: Session = Depends(get_db)
):
    """
    Receives a single punch event from biometric hardware or webhook.
    """
    staff = db.query(models.Staff).filter(
        models.Staff.id == punch.staff_id,
        models.Staff.hotel_id == punch.hotel_id
    ).first()

    if not staff:
        raise HTTPException(
            status_code=404,
            detail=f"Staff ID {punch.staff_id} not found for hotel {punch.hotel_id}"
        )

    # Avoid exact duplicate punches within the same minute
    existing_punch = db.query(models.BiometricLog).filter(
        models.BiometricLog.staff_id == punch.staff_id,
        models.BiometricLog.punch_time == punch.punch_time
    ).first()

    if existing_punch:
        return {"message": "Punch already logged", "id": existing_punch.id}

    new_log = models.BiometricLog(
        hotel_id=punch.hotel_id,
        staff_id=punch.staff_id,
        punch_time=punch.punch_time,
        device_id=punch.device_id,
        punch_type=punch.punch_type
    )

    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    return {"message": "Punch logged successfully", "log_id": new_log.id}


@router.post("/sync-batch", status_code=status.HTTP_201_CREATED)
def record_batch_punches(
    batch: BiometricBatchSync,
    db: Session = Depends(get_db)
):
    """
    Receives multiple punches in batch from an external biometric sync script.
    """
    inserted_count = 0
    for p in batch.punches:
        existing = db.query(models.BiometricLog).filter(
            models.BiometricLog.staff_id == p.staff_id,
            models.BiometricLog.punch_time == p.punch_time
        ).first()

        if not existing:
            new_log = models.BiometricLog(
                hotel_id=batch.hotel_id,
                staff_id=p.staff_id,
                punch_time=p.punch_time,
                device_id=p.device_id,
                punch_type=p.punch_type
            )
            db.add(new_log)
            inserted_count += 1

    db.commit()
    return {"message": f"Successfully processed batch. Inserted {inserted_count} new punches."}


@router.get("/logs", response_model=List[BiometricLogResponse])
def get_biometric_logs(
    hotel_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    date: Optional[str] = None,  # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetch raw punch records.
    """
    query = db.query(models.BiometricLog)

    if current_user.role != "super-admin":
        query = query.filter(models.BiometricLog.hotel_id == current_user.hotel_id)
    elif hotel_id:
        query = query.filter(models.BiometricLog.hotel_id == hotel_id)

    if staff_id:
        query = query.filter(models.BiometricLog.staff_id == staff_id)

    if date:
        query = query.filter(db.func.date(models.BiometricLog.punch_time) == date)

    logs = query.order_by(models.BiometricLog.punch_time.desc()).all()
    return logs