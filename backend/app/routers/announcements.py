from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.announcement_service import AnnouncementService

router = APIRouter(
    prefix="/announcements",
    tags=["Announcements"],
)


def get_announcement_service(db: Session = Depends(get_db)) -> AnnouncementService:
    return AnnouncementService(db)


@router.get("/", response_model=List[schemas.AnnouncementResponse])
def get_all_announcements(
    service: AnnouncementService = Depends(get_announcement_service),
):
    return service.get_all_announcements()


@router.get("/active", response_model=List[schemas.AnnouncementResponse])
def get_active_announcements(
    service: AnnouncementService = Depends(get_announcement_service),
):
    return service.get_active_announcements()


@router.post("/", response_model=schemas.AnnouncementResponse)
def create_announcement(
    announcement: schemas.AnnouncementCreate,
    service: AnnouncementService = Depends(get_announcement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_announcement(announcement, current_user)