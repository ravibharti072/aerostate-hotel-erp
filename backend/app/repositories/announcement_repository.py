from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class AnnouncementRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self) -> List[models.SystemAnnouncement]:
        return (
            self.db.query(models.SystemAnnouncement)
            .order_by(models.SystemAnnouncement.id.desc())
            .all()
        )

    def list_active(self) -> List[models.SystemAnnouncement]:
        return (
            self.db.query(models.SystemAnnouncement)
            .filter(models.SystemAnnouncement.is_active == True)
            .order_by(models.SystemAnnouncement.id.desc())
            .all()
        )

    def deactivate_all(self) -> None:
        self.db.query(models.SystemAnnouncement).update({"is_active": False})

    def create_announcement(self, announcement_data: Dict[str, Any]) -> models.SystemAnnouncement:
        new_announcement = models.SystemAnnouncement(**announcement_data)
        self.db.add(new_announcement)
        self.db.commit()
        self.db.refresh(new_announcement)
        return new_announcement