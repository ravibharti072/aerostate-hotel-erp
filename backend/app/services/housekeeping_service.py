from datetime import datetime, date
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.housekeeping_repository import HousekeepingRepository


class HousekeepingService:
    HOUSEKEEPING_ALLOWED_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "housekeeping",
        "maintenance",
        "front-desk",
    ]

    SUPERVISOR_ROLES = ["super-admin", "hotel-admin", "manager", "housekeeping"]

    ROOM_ALLOWED_STATUSES = [
        "available",
        "reserved",
        "occupied",
        "dirty",
        "cleaning",
        "maintenance",
        "out-of-service",
    ]

    HOUSEKEEPING_TASK_TYPES = [
        "checkout-cleaning",
        "stayover-cleaning",
        "deep-cleaning",
        "inspection",
        "special-cleaning",
        "room-cleaning",
        "other",
    ]

    HOUSEKEEPING_PRIORITIES = [
        "low",
        "normal",
        "medium",
        "high",
        "urgent",
    ]

    HOUSEKEEPING_TASK_STATUSES = [
        "pending",
        "assigned",
        "in-progress",
        "completed",
        "inspection-required",
        "approved",
        "rejected",
        "cancelled",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = HousekeepingRepository(db)

    # -------------------------------------------------------------
    # Permission Checks
    # -------------------------------------------------------------

    def _has_housekeeping_module(self, current_user: models.User) -> bool:
        modules = getattr(current_user, "allowed_modules", None)
        if not modules:
            return False
        if isinstance(modules, list):
            return any(str(m).strip().lower() in ["housekeeping", "all", "admin"] for m in modules)
        if isinstance(modules, str):
            parts = [p.strip().lower() for p in modules.split(",")]
            return any(m in ["housekeeping", "all", "admin"] for m in parts)
        return False

    def _assert_housekeeping_access(self, current_user: models.User) -> None:
        if current_user.role in self.HOUSEKEEPING_ALLOWED_ROLES or self._has_housekeeping_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="Access denied. Housekeeping access requires an authorized role or assigned module.",
        )

    def _assert_supervisor_access(self, current_user: models.User) -> None:
        if current_user.role in self.SUPERVISOR_ROLES or self._has_housekeeping_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="Supervisor permission required for task assignment or inspection.",
        )

    def _assert_can_delete_task(self, current_user: models.User) -> None:
        if current_user.role not in ["super-admin", "hotel-admin", "manager"]:
            raise HTTPException(
                status_code=403,
                detail="Only hotel-admin, manager, or super-admin can delete housekeeping tasks.",
            )

    def _assert_same_hotel_or_super_admin(self, hotel_id: int, current_user: models.User) -> None:
        if current_user.role != "super-admin" and hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail="You can access only your own hotel data.")

    # -------------------------------------------------------------
    # Dashboard & Operational Aggregations
    # -------------------------------------------------------------

    def get_dashboard_metrics(self, current_user: models.User) -> Dict[str, Any]:
        self._assert_housekeeping_access(current_user)
        hotel_id = current_user.hotel_id

        rooms_query = self.db.query(models.Room)
        tasks_query = self.db.query(models.HousekeepingTask)
        maintenance_query = self.db.query(models.MaintenanceRequest)

        if current_user.role != "super-admin" and hotel_id:
            rooms_query = rooms_query.filter(models.Room.hotel_id == hotel_id)
            tasks_query = tasks_query.filter(models.HousekeepingTask.hotel_id == hotel_id)
            maintenance_query = maintenance_query.filter(models.MaintenanceRequest.hotel_id == hotel_id)

        all_rooms = rooms_query.all()
        rooms_to_clean = sum(1 for r in all_rooms if r.status in ["dirty", "cleaning"])
        ready_rooms = sum(1 for r in all_rooms if r.status == "available")
        cleaning_in_progress = tasks_query.filter(models.HousekeepingTask.status == "in-progress").count()
        inspection_required = tasks_query.filter(models.HousekeepingTask.status == "inspection-required").count()
        priority_tasks = tasks_query.filter(
            models.HousekeepingTask.priority.in_(["high", "urgent"]),
            models.HousekeepingTask.status.in_(["pending", "assigned", "in-progress"]),
        ).count()
        maintenance_issues = maintenance_query.filter(models.MaintenanceRequest.status == "open").count()

        # Expected arrivals today
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())
        arrivals_query = self.db.query(models.Booking).filter(
            models.Booking.checkin_date >= today_start,
            models.Booking.checkin_date <= today_end,
            models.Booking.status.in_(["confirmed", "reserved"]),
        )
        if current_user.role != "super-admin" and hotel_id:
            arrivals_query = arrivals_query.filter(models.Booking.hotel_id == hotel_id)

        arrivals = []
        for b in arrivals_query.all():
            room = self.db.query(models.Room).filter(models.Room.id == b.room_id).first()
            guest = self.db.query(models.Guest).filter(models.Guest.id == b.guest_id).first()
            task = (
                self.db.query(models.HousekeepingTask)
                .filter(models.HousekeepingTask.room_id == b.room_id)
                .order_by(models.HousekeepingTask.id.desc())
                .first()
            )

            arrivals.append({
                "room_number": room.room_number if room else "N/A",
                "guest_name": guest.full_name if guest else "Unassigned",
                "arrival_time": b.checkin_date.strftime("%I:%M %p"),
                "room_status": room.status if room else "unknown",
                "cleaning_status": task.status if task else "no-task",
            })

        return {
            "rooms_to_clean": rooms_to_clean,
            "cleaning_in_progress": cleaning_in_progress,
            "ready_rooms": ready_rooms,
            "inspection_required": inspection_required,
            "priority_tasks": priority_tasks,
            "maintenance_issues": maintenance_issues,
            "upcoming_arrivals": arrivals,
        }

    # -------------------------------------------------------------
    # Room Cleaning Operations
    # -------------------------------------------------------------

    def update_room_status(
        self,
        room_id: int,
        status_update: schemas.RoomStatusUpdate,
        current_user: models.User,
    ) -> models.Room:
        self._assert_housekeeping_access(current_user)

        room = self.repo.get_room_by_id(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found.")

        self._assert_same_hotel_or_super_admin(room.hotel_id, current_user)

        if status_update.status not in self.ROOM_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ROOM_ALLOWED_STATUSES}",
            )

        # Protect against clearing live occupancy
        if self.repo.is_room_occupied(room.id) and status_update.status == "available":
            raise HTTPException(
                status_code=400,
                detail="Cannot set room to 'available' while an active checked-in booking exists.",
            )

        return self.repo.update_room_status(room, status_update.status)

    def get_housekeeping_rooms(
        self,
        hotel_id: Optional[int],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.Room]:
        self._assert_housekeeping_access(current_user)
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_rooms(hotel_id=target_hotel_id, status=status)

    # -------------------------------------------------------------
    # Task Lifecycle & State Transitions
    # -------------------------------------------------------------

    def create_housekeeping_task(
        self,
        task: schemas.HousekeepingTaskCreate,
        current_user: models.User,
    ) -> models.HousekeepingTask:
        self._assert_housekeeping_access(current_user)
        self._assert_same_hotel_or_super_admin(task.hotel_id, current_user)

        hotel = self.repo.get_hotel_by_id(task.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found.")

        room = self.repo.get_room_in_hotel(task.room_id, task.hotel_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found for this hotel.")

        if task.assigned_staff_id:
            staff = self.repo.get_staff_for_hotel(task.assigned_staff_id, task.hotel_id)
            if not staff:
                raise HTTPException(status_code=404, detail="Assigned staff not found for this hotel.")

        normalized_priority = "normal" if task.priority == "medium" else task.priority
        if normalized_priority not in self.HOUSEKEEPING_PRIORITIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid priority. Allowed priorities are: {self.HOUSEKEEPING_PRIORITIES}",
            )

        task_data = {
            "hotel_id": task.hotel_id,
            "room_id": task.room_id,
            "booking_id": task.booking_id,
            "assigned_staff_id": task.assigned_staff_id,
            "task_type": task.task_type,
            "priority": normalized_priority,
            "status": task.status,
            "assigned_to": task.assigned_to,
            "due_date": task.due_date,
            "notes": task.notes,
            "created_by": task.created_by or current_user.username,
        }

        # Sync room status safely
        if not self.repo.is_room_occupied(room.id):
            if task.status in ["pending", "assigned"]:
                room.status = "dirty"
            elif task.status == "in-progress":
                room.status = "cleaning"

        created_task = self.repo.create_task(task_data)
        self.repo.record_history(
            created_task.id, created_task.hotel_id, None, created_task.status, current_user.username, "Task created"
        )
        return created_task

    def start_cleaning(self, task_id: int, current_user: models.User) -> models.HousekeepingTask:
        self._assert_housekeeping_access(current_user)

        task = self.repo.get_task_by_id_locked(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        self._assert_same_hotel_or_super_admin(task.hotel_id, current_user)

        if task.status == "in-progress":
            raise HTTPException(status_code=409, detail="Task is already in progress by another staff member.")

        if task.status in ["completed", "approved", "cancelled"]:
            raise HTTPException(status_code=400, detail=f"Cannot start task with status '{task.status}'.")

        room = self.repo.get_room_in_hotel(task.room_id, task.hotel_id)
        old_status = task.status

        task.status = "in-progress"
        task.started_at = datetime.utcnow()
        task.started_by = current_user.username
        task.assigned_to = task.assigned_to or current_user.username
        task.updated_at = datetime.utcnow()

        if room and not self.repo.is_room_occupied(room.id):
            room.status = "cleaning"

        self.repo.record_history(
            task.id, task.hotel_id, old_status, "in-progress", current_user.username, "Cleaning started"
        )
        self.db.commit()
        self.db.refresh(task)
        return task

    def complete_cleaning(
        self,
        task_id: int,
        payload: schemas.HousekeepingCompletePayload,
        current_user: models.User,
    ) -> models.HousekeepingTask:
        self._assert_housekeeping_access(current_user)

        task = self.repo.get_task_by_id_locked(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        self._assert_same_hotel_or_super_admin(task.hotel_id, current_user)

        if task.status != "in-progress":
            raise HTTPException(status_code=400, detail="Only in-progress tasks can be completed.")

        room = self.repo.get_room_in_hotel(task.room_id, task.hotel_id)
        old_status = task.status
        new_status = "inspection-required" if payload.requires_inspection else "completed"

        task.status = new_status
        task.completed_at = datetime.utcnow()
        task.completed_by = current_user.username
        if payload.notes:
            task.notes = f"{task.notes or ''}\nNote: {payload.notes}".strip()
        task.updated_at = datetime.utcnow()

        if room:
            if self.repo.is_room_occupied(room.id):
                room.status = "occupied"
            elif payload.requires_inspection:
                room.status = "cleaning"
            else:
                room.status = "available"

        self.repo.record_history(
            task.id, task.hotel_id, old_status, new_status, current_user.username, payload.notes or "Cleaning completed"
        )
        self.db.commit()
        self.db.refresh(task)
        return task

    def inspect_task(
        self,
        task_id: int,
        payload: schemas.HousekeepingInspectionPayload,
        current_user: models.User,
    ) -> models.HousekeepingTask:
        self._assert_supervisor_access(current_user)

        task = self.repo.get_task_by_id_locked(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        self._assert_same_hotel_or_super_admin(task.hotel_id, current_user)

        room = self.repo.get_room_in_hotel(task.room_id, task.hotel_id)
        old_status = task.status
        new_status = "approved" if payload.passed else "rejected"

        task.status = new_status
        task.updated_at = datetime.utcnow()

        if not payload.passed and payload.notes:
            task.notes = f"{task.notes or ''}\n[Rejected during inspection]: {payload.notes}".strip()

        if room and not self.repo.is_room_occupied(room.id):
            room.status = "available" if payload.passed else "cleaning"

        self.repo.create_inspection({
            "hotel_id": task.hotel_id,
            "task_id": task.id,
            "room_id": task.room_id,
            "inspector_id": current_user.id,
            "status": "passed" if payload.passed else "failed",
            "checklist": payload.checklist,
            "notes": payload.notes,
            "inspected_at": datetime.utcnow(),
        })

        self.repo.record_history(
            task.id,
            task.hotel_id,
            old_status,
            new_status,
            current_user.username,
            f"Inspection: {'Approved' if payload.passed else 'Rejected'}",
        )

        self.db.commit()
        self.db.refresh(task)
        return task

    def report_room_problem(
        self,
        payload: schemas.HousekeepingProblemReportPayload,
        current_user: models.User,
    ) -> models.MaintenanceRequest:
        self._assert_housekeeping_access(current_user)

        room = self.repo.get_room_by_id(payload.room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found.")

        self._assert_same_hotel_or_super_admin(room.hotel_id, current_user)

        maint_data = {
            "hotel_id": room.hotel_id,
            "room_id": room.id,
            "category": payload.category,
            "source": "Housekeeping",
            "blocks_room": payload.blocks_room,
            "issue_title": f"[{payload.category.upper()}] {payload.description[:50]}",
            "issue_description": payload.description,
            "priority": payload.priority.lower(),
            "status": "open",
            "reported_by": current_user.full_name or current_user.username,
            "created_by_user_id": current_user.id,
            "created_at": datetime.utcnow(),
        }

        return self.repo.create_maintenance_request(
            req_data=maint_data,
            block_room=payload.blocks_room,
            room=room,
        )

    # -------------------------------------------------------------
    # Standard Task Retrieval & Updates
    # -------------------------------------------------------------

    def get_housekeeping_tasks(
        self,
        hotel_id: Optional[int],
        room_id: Optional[int],
        booking_id: Optional[int],
        task_type: Optional[str],
        priority: Optional[str],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.HousekeepingTask]:
        self._assert_housekeeping_access(current_user)
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_tasks(
            hotel_id=target_hotel_id,
            room_id=room_id,
            booking_id=booking_id,
            task_type=task_type,
            priority=priority,
            status=status,
        )

    def get_housekeeping_task(self, task_id: int, current_user: models.User) -> models.HousekeepingTask:
        self._assert_housekeeping_access(current_user)
        task = self.repo.get_task_by_id(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Housekeeping task not found.")
        self._assert_same_hotel_or_super_admin(task.hotel_id, current_user)
        return task

    def update_housekeeping_task(
        self,
        task_id: int,
        task_update: schemas.HousekeepingTaskUpdate,
        current_user: models.User,
    ) -> models.HousekeepingTask:
        self._assert_housekeeping_access(current_user)
        task = self.repo.get_task_by_id_locked(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Housekeeping task not found.")
        self._assert_same_hotel_or_super_admin(task.hotel_id, current_user)

        update_data = task_update.model_dump(exclude_unset=True)
        old_status = task.status

        room = self.repo.get_room_in_hotel(task.room_id, task.hotel_id)
        target_room_status = None

        if "status" in update_data and update_data["status"] != old_status:
            new_status = update_data["status"]
            if not self.repo.is_room_occupied(room.id):
                if new_status == "in-progress":
                    update_data["started_at"] = datetime.utcnow()
                    target_room_status = "cleaning"
                elif new_status in ["completed", "approved"]:
                    update_data["completed_at"] = datetime.utcnow()
                    target_room_status = "available"
                elif new_status in ["pending", "assigned"]:
                    target_room_status = "dirty"

            self.repo.record_history(
                task.id, task.hotel_id, old_status, new_status, current_user.username, "Status updated"
            )

        return self.repo.update_task_and_room(
            task=task,
            task_updates=update_data,
            room=room,
            room_status=target_room_status,
        )

    def delete_housekeeping_task(self, task_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_delete_task(current_user)
        task = self.repo.get_task_by_id(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Housekeeping task not found.")
        self._assert_same_hotel_or_super_admin(task.hotel_id, current_user)
        self.repo.delete_task(task)
        return {"message": "Housekeeping task deleted successfully"}