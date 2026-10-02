from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.announcement_repository import AnnouncementRepository


class AnnouncementService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnnouncementRepository(db)

    def _assert_super_admin(self, current_user: models.User) -> None:
        if current_user.role != "super-admin":
            raise HTTPException(
                status_code=403,
                detail="Only super-admin can broadcast messages.",
            )

    def get_all_announcements(self) -> List[models.SystemAnnouncement]:
        return self.repo.list_all()

    def get_active_announcements(self) -> List[models.SystemAnnouncement]:
        return self.repo.list_active()

    def create_announcement(
        self,
        announcement: schemas.AnnouncementCreate,
        current_user: models.User,
    ) -> models.SystemAnnouncement:
        self._assert_super_admin(current_user)

        # Deactivates existing alerts so only the latest alert shows in the active floating banner
        self.repo.deactivate_all()

        return self.repo.create_announcement(announcement.model_dump())