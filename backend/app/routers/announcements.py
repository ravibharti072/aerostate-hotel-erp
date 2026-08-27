from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/announcements", tags=["Announcements"])

# NEW: Fetch ALL announcements for the historical list page
@router.get("/", response_model=List[schemas.AnnouncementResponse])
def get_all_announcements(db: Session = Depends(get_db)):
    return db.query(models.SystemAnnouncement).order_by(models.SystemAnnouncement.id.desc()).all()

# EXISTING: Fetch ONLY the active one for the top floating banner
@router.get("/active", response_model=List[schemas.AnnouncementResponse])
def get_active_announcements(db: Session = Depends(get_db)):
    return db.query(models.SystemAnnouncement).filter(
        models.SystemAnnouncement.is_active == True
    ).order_by(models.SystemAnnouncement.id.desc()).all()

# Super-Admin only endpoint to publish alerts
@router.post("/", response_model=schemas.AnnouncementResponse)
def create_announcement(
    announcement: schemas.AnnouncementCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "super-admin":
        raise HTTPException(status_code=403, detail="Only super-admin can broadcast messages.")
    
    # This ensures only the newest alert shows in the floating banner.
    # But it keeps all older alerts in the database for the history list!
    db.query(models.SystemAnnouncement).update({"is_active": False})
    
    new_announcement = models.SystemAnnouncement(**announcement.model_dump())
    db.add(new_announcement)
    db.commit()
    db.refresh(new_announcement)
    return new_announcement