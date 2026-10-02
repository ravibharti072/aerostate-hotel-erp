from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[models.User]:
        return self.db.query(models.User).filter(models.User.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[models.User]:
        return self.db.query(models.User).filter(models.User.username == username).first()

    def get_by_email(self, email: str) -> Optional[models.User]:
        return self.db.query(models.User).filter(models.User.email == email).first()

    def get_duplicate_username(self, username: str, exclude_user_id: int) -> Optional[models.User]:
        return (
            self.db.query(models.User)
            .filter(
                models.User.username == username,
                models.User.id != exclude_user_id,
            )
            .first()
        )

    def get_duplicate_email(self, email: str, exclude_user_id: int) -> Optional[models.User]:
        return (
            self.db.query(models.User)
            .filter(
                models.User.email == email,
                models.User.id != exclude_user_id,
            )
            .first()
        )

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_by_staff_id(self, staff_id: int) -> Optional[models.User]:
        return self.db.query(models.User).filter(models.User.staff_id == staff_id).first()

    def get_staff_by_id(self, staff_id: int) -> Optional[models.Staff]:
        return self.db.query(models.Staff).filter(models.Staff.id == staff_id).first()

    def list_users(
        self,
        hotel_id: Optional[int] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[models.User]:
        query = self.db.query(models.User)

        if hotel_id is not None:
            query = query.filter(models.User.hotel_id == hotel_id)

        if role is not None:
            query = query.filter(models.User.role == role)

        if is_active is not None:
            query = query.filter(models.User.is_active == is_active)

        return query.order_by(models.User.id.desc()).all()

    def create_user(self, user_data: Dict[str, Any]) -> models.User:
        new_user = models.User(**user_data)
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        return new_user

    def update_user(self, user: models.User, update_fields: Dict[str, Any]) -> models.User:
        for key, value in update_fields.items():
            setattr(user, key, value)
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user: models.User) -> None:
        self.db.delete(user)
        self.db.commit()