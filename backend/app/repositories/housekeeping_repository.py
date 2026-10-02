from datetime import datetime, date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models


class HousekeepingRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Room Lookups & Updates
    # -------------------------------------------------------------

    def get_room_by_id(self, room_id: int) -> Optional[models.Room]:
        return self.db.query(models.Room).filter(models.Room.id == room_id).first()

    def get_room_in_hotel(self, room_id: int, hotel_id: int) -> Optional[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(
                models.Room.id == room_id,
                models.Room.hotel_id == hotel_id,
            )
            .first()
        )

    def list_rooms(
        self,
        hotel_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> List[models.Room]:
        query = self.db.query(models.Room)
        if hotel_id is not None:
            query = query.filter(models.Room.hotel_id == hotel_id)
        if status is not None:
            query = query.filter(models.Room.status == status)
        return query.order_by(models.Room.room_number.asc()).all()

    def update_room_status(self, room: models.Room, status: str) -> models.Room:
        room.status = status
        self.db.commit()
        self.db.refresh(room)
        return room

    # -------------------------------------------------------------
    # Task Operations
    # -------------------------------------------------------------

    def get_task_by_id(self, task_id: int) -> Optional[models.HousekeepingTask]:
        return (
            self.db.query(models.HousekeepingTask)
            .filter(models.HousekeepingTask.id == task_id)
            .first()
        )

    def get_task_by_id_locked(self, task_id: int) -> Optional[models.HousekeepingTask]:
        """Pessimistic locking to prevent race conditions during state transitions."""
        return (
            self.db.query(models.HousekeepingTask)
            .filter(models.HousekeepingTask.id == task_id)
            .with_for_update()
            .first()
        )

    def list_tasks(
        self,
        hotel_id: Optional[int] = None,
        room_id: Optional[int] = None,
        booking_id: Optional[int] = None,
        task_type: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[models.HousekeepingTask]:
        query = self.db.query(models.HousekeepingTask)

        if hotel_id is not None:
            query = query.filter(models.HousekeepingTask.hotel_id == hotel_id)
        if room_id is not None:
            query = query.filter(models.HousekeepingTask.room_id == room_id)
        if booking_id is not None:
            query = query.filter(models.HousekeepingTask.booking_id == booking_id)
        if task_type is not None:
            query = query.filter(models.HousekeepingTask.task_type == task_type)
        if priority is not None:
            query = query.filter(models.HousekeepingTask.priority == priority)
        if status is not None:
            query = query.filter(models.HousekeepingTask.status == status)

        return query.order_by(
            func.case(
                (models.HousekeepingTask.priority == "urgent", 1),
                (models.HousekeepingTask.priority == "high", 2),
                (models.HousekeepingTask.priority == "normal", 3),
                (models.HousekeepingTask.priority == "low", 4),
                else_=5,
            ),
            models.HousekeepingTask.id.desc(),
        ).all()

    def create_task(self, task_data: Dict[str, Any]) -> models.HousekeepingTask:
        new_task = models.HousekeepingTask(**task_data)
        self.db.add(new_task)
        self.db.commit()
        self.db.refresh(new_task)
        return new_task

    def update_task_and_room(
        self,
        task: models.HousekeepingTask,
        task_updates: Dict[str, Any],
        room: Optional[models.Room] = None,
        room_status: Optional[str] = None,
    ) -> models.HousekeepingTask:
        for key, value in task_updates.items():
            setattr(task, key, value)

        task.updated_at = datetime.utcnow()

        if room and room_status:
            room.status = room_status

        self.db.commit()
        self.db.refresh(task)
        return task

    def delete_task(self, task: models.HousekeepingTask) -> None:
        self.db.delete(task)
        self.db.commit()

    # -------------------------------------------------------------
    # Inspections, History & Maintenance Integration
    # -------------------------------------------------------------

    def record_history(
        self,
        task_id: int,
        hotel_id: int,
        old_status: Optional[str],
        new_status: str,
        changed_by: str,
        notes: Optional[str] = None,
    ) -> models.HousekeepingTaskHistory:
        hist = models.HousekeepingTaskHistory(
            task_id=task_id,
            hotel_id=hotel_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            notes=notes,
            created_at=datetime.utcnow(),
        )
        self.db.add(hist)
        self.db.commit()
        return hist

    def create_inspection(self, inspection_data: Dict[str, Any]) -> models.HousekeepingInspection:
        insp = models.HousekeepingInspection(**inspection_data)
        self.db.add(insp)
        self.db.commit()
        self.db.refresh(insp)
        return insp

    def create_maintenance_request(
        self,
        req_data: Dict[str, Any],
        block_room: bool,
        room: Optional[models.Room] = None,
    ) -> models.MaintenanceRequest:
        maintenance = models.MaintenanceRequest(**req_data)
        self.db.add(maintenance)

        # Only block room if explicitly requested and room is not currently occupied
        if block_room and room:
            if not self.is_room_occupied(room.id):
                room.status = "maintenance"

        self.db.commit()
        self.db.refresh(maintenance)
        return maintenance

    # -------------------------------------------------------------
    # Cross-Entity Lookups
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_booking_for_room(
        self, booking_id: int, hotel_id: int, room_id: int
    ) -> Optional[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.id == booking_id,
                models.Booking.hotel_id == hotel_id,
                models.Booking.room_id == room_id,
            )
            .first()
        )

    def get_staff_for_hotel(self, staff_id: int, hotel_id: int) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.id == staff_id,
                models.Staff.hotel_id == hotel_id,
            )
            .first()
        )

    def is_room_occupied(self, room_id: int) -> bool:
        active_booking = (
            self.db.query(models.Booking)
            .filter(
                models.Booking.room_id == room_id,
                models.Booking.status.in_(["checked_in", "checked-in"]),
            )
            .first()
        )
        return active_booking is not None