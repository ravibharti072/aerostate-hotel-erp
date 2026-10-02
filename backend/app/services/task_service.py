from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import models, schemas


class TaskService:
    def __init__(self, db: Session):
        self.db = db

    def _resolve_hotel_id(self, hotel_id: Optional[int], current_user: models.User) -> int:
        if current_user.role == "super-admin":
            if hotel_id:
                return hotel_id
            first_hotel = self.db.query(models.Hotel.id).first()
            return first_hotel[0] if first_hotel else 1
        if not current_user.hotel_id:
            raise HTTPException(status_code=400, detail="User is not associated with any hotel.")
        return current_user.hotel_id

    def _verify_department_management_permission(
        self, department: str, current_user: models.User
    ):
        """Ensures that only Hotel Admins or the Department Head for this department can manage tasks."""
        if current_user.role in ["super-admin", "hotel-admin"]:
            return

        user_role_level = getattr(current_user, "role_level", "employee")
        user_dept = ""
        if current_user.staff and current_user.staff.department:
            user_dept = current_user.staff.department.lower()

        is_head = user_role_level == "department_head"
        dept_matches = department.lower() in user_dept or user_dept in department.lower()

        if not (is_head and dept_matches):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Only hotel administrators or the {department} Department Head can manage these tasks.",
            )

    def _record_audit_log(
        self,
        hotel_id: int,
        department: str,
        entity_id: int,
        entity_identifier: str,
        action: str,
        user: models.User,
        details: Optional[Dict[str, Any]] = None,
    ):
        try:
            audit = models.DepartmentAuditLog(
                hotel_id=hotel_id,
                department=department.lower(),
                entity_type="task",
                entity_id=entity_id,
                entity_identifier=entity_identifier,
                action=action,
                performed_by_user_id=user.id,
                performed_by_name=user.full_name or user.username,
                details=details or {},
                created_at=datetime.utcnow(),
            )
            self.db.add(audit)
            self.db.commit()
        except Exception as e:
            print("Audit log error:", e)

    def create_task(
        self, payload: schemas.DepartmentTaskCreate, current_user: models.User
    ) -> models.DepartmentTask:
        target_hotel_id = self._resolve_hotel_id(payload.hotel_id, current_user)
        department = (payload.department or "maintenance").lower().strip()

        # Enforce management permission
        self._verify_department_management_permission(department, current_user)

        # Generate unique task number: e.g. TSK-MAIN-0001
        dept_code = department[:4].upper()
        existing_count = (
            self.db.query(models.DepartmentTask)
            .filter(
                models.DepartmentTask.hotel_id == target_hotel_id,
                models.DepartmentTask.department == department,
            )
            .count()
        )
        task_number = f"TSK-{dept_code}-{(existing_count + 1):04d}"

        # Ensure collision resistance
        clash = (
            self.db.query(models.DepartmentTask.id)
            .filter(models.DepartmentTask.task_number == task_number)
            .first()
        )
        if clash:
            task_number = f"TSK-{dept_code}-{(existing_count + 1):04d}-{int(datetime.utcnow().timestamp()) % 1000}"

        # Initial status calculation
        initial_status = "assigned" if payload.assigned_to_staff_id else "pending"

        task = models.DepartmentTask(
            task_number=task_number,
            hotel_id=target_hotel_id,
            department=department,
            title=payload.title.strip(),
            description=payload.description,
            category=payload.category or "General",
            priority=payload.priority or "normal",
            status=initial_status,
            location=payload.location,
            room_id=payload.room_id,
            asset_id=payload.asset_id,
            assigned_to_staff_id=payload.assigned_to_staff_id,
            created_by_user_id=current_user.id,
            due_date=payload.due_date,
            estimated_hours=payload.estimated_hours or 1.0,
            meta_data=payload.meta_data or {},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="created",
            user=current_user,
            details={
                "title": task.title,
                "priority": task.priority,
                "category": task.category,
                "status": task.status,
                "assigned_to_staff_id": task.assigned_to_staff_id,
            },
        )

        return task

    def get_tasks(
        self,
        hotel_id: Optional[int],
        department: Optional[str],
        status: Optional[str],
        priority: Optional[str],
        assigned_to_staff_id: Optional[int],
        search: Optional[str],
        current_user: models.User,
    ) -> List[models.DepartmentTask]:
        target_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        query = self.db.query(models.DepartmentTask).filter(
            models.DepartmentTask.hotel_id == target_hotel_id
        )

        # Department scoping:
        user_role_level = getattr(current_user, "role_level", "employee")
        user_dept = ""
        if current_user.staff and current_user.staff.department:
            user_dept = current_user.staff.department.lower()

        # Non-hotel-admins can only see their department
        if current_user.role not in ["super-admin", "hotel-admin"]:
            if department and department.lower() != user_dept and user_dept not in department.lower():
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied. You cannot view tasks outside of {user_dept}.",
                )
            query = query.filter(models.DepartmentTask.department.ilike(f"%{user_dept}%"))
        elif department:
            query = query.filter(models.DepartmentTask.department.ilike(f"%{department.strip()}%"))

        # Role-based scoping: regular employees only see tasks assigned to them (unless search or assigned_to_staff_id is requested)
        if user_role_level == "employee" and current_user.staff_id:
            query = query.filter(models.DepartmentTask.assigned_to_staff_id == current_user.staff_id)
        elif assigned_to_staff_id:
            query = query.filter(models.DepartmentTask.assigned_to_staff_id == assigned_to_staff_id)

        # Status filter
        if status and status != "all":
            query = query.filter(models.DepartmentTask.status == status)

        # Priority filter
        if priority and priority != "all":
            query = query.filter(models.DepartmentTask.priority == priority)

        # Search filter
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    models.DepartmentTask.title.ilike(term),
                    models.DepartmentTask.task_number.ilike(term),
                    models.DepartmentTask.location.ilike(term),
                    models.DepartmentTask.description.ilike(term),
                )
            )

        return query.order_by(models.DepartmentTask.created_at.desc()).all()

    def get_task_by_id(
        self, task_id: int, current_user: models.User
    ) -> models.DepartmentTask:
        task = self.db.query(models.DepartmentTask).filter(
            models.DepartmentTask.id == task_id
        ).first()

        if not task:
            raise HTTPException(status_code=404, detail="Department task not found.")

        if current_user.role != "super-admin" and task.hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail="Forbidden.")

        return task

    def update_task(
        self, task_id: int, payload: schemas.DepartmentTaskUpdate, current_user: models.User
    ) -> models.DepartmentTask:
        task = self.get_task_by_id(task_id, current_user)
        self._verify_department_management_permission(task.department, current_user)

        data = payload.model_dump(exclude_unset=True)

        # Handle staff assignment status transitions
        if "assigned_to_staff_id" in data:
            new_staff_id = data["assigned_to_staff_id"]
            if new_staff_id and task.status == "pending":
                task.status = "assigned"
            elif not new_staff_id and task.status == "assigned":
                task.status = "pending"

        for field, value in data.items():
            setattr(task, field, value)

        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)
        return task

    def assign_task(
        self, task_id: int, staff_id: Optional[int], current_user: models.User
    ) -> models.DepartmentTask:
        task = self.get_task_by_id(task_id, current_user)

        my_staff_id = self._resolve_user_staff_id(current_user)
        is_self_claim = (
            staff_id is not None
            and my_staff_id is not None
            and staff_id == my_staff_id
            and (task.assigned_to_staff_id is None or task.assigned_to_staff_id == my_staff_id)
        )
        if not is_self_claim:
            self._verify_department_management_permission(task.department, current_user)

        if staff_id:
            staff = self.db.query(models.Staff).filter(
                models.Staff.id == staff_id,
                models.Staff.hotel_id == task.hotel_id,
            ).first()
            if not staff:
                raise HTTPException(status_code=404, detail="Staff member not found.")

            task.assigned_to_staff_id = staff_id
            if task.status in ["pending", "assigned"]:
                task.status = "assigned"
        else:
            task.assigned_to_staff_id = None
            if task.status == "assigned":
                task.status = "pending"

        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="assigned" if staff_id else "unassigned",
            user=current_user,
            details={"assigned_to_staff_id": staff_id, "status": task.status},
        )

        return task

    def delete_task(self, task_id: int, current_user: models.User) -> Dict[str, Any]:
        task = self.get_task_by_id(task_id, current_user)
        self._verify_department_management_permission(task.department, current_user)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="deleted",
            user=current_user,
            details={"title": task.title},
        )

        self.db.delete(task)
        self.db.commit()
        return {"message": "Task deleted successfully", "id": task_id}

    def convert_maintenance_request_to_task(
        self,
        request_id: int,
        payload: schemas.DepartmentTicketConvertToTask,
        current_user: models.User,
    ) -> models.DepartmentTask:
        req = self.db.query(models.MaintenanceRequest).filter(models.MaintenanceRequest.id == request_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Maintenance request not found.")
        self._verify_department_management_permission("maintenance", current_user)

        # Generate task number
        prefix = "TSK-MAIN-"
        latest_task = (
            self.db.query(models.DepartmentTask)
            .filter(
                models.DepartmentTask.hotel_id == req.hotel_id,
                models.DepartmentTask.task_number.like(f"{prefix}%"),
            )
            .order_by(models.DepartmentTask.id.desc())
            .first()
        )
        next_idx = 1
        if latest_task and latest_task.task_number:
            try:
                suffix = latest_task.task_number.split("-")[-1]
                next_idx = int(suffix) + 1
            except (ValueError, IndexError):
                next_idx = 1
        task_number = f"{prefix}{next_idx:04d}"

        assigned_staff_id = payload.assigned_to_staff_id or req.assigned_staff_id
        initial_status = "assigned" if assigned_staff_id else "pending"

        task = models.DepartmentTask(
            task_number=task_number,
            hotel_id=req.hotel_id,
            department="maintenance",
            title=payload.title.strip() if payload.title else req.issue_title,
            description=req.issue_description or "",
            category=req.category or "General",
            priority=payload.priority or req.priority,
            status=initial_status,
            location=f"Room {req.room.room_number}" if req.room else (req.asset.name if req.asset else None),
            room_id=req.room_id,
            asset_id=req.asset_id,
            assigned_to_staff_id=assigned_staff_id,
            created_by_user_id=current_user.id,
            due_date=payload.due_date,
            estimated_hours=payload.estimated_hours or 1.0,
            actual_hours=0.0,
            meta_data={
                "converted_from_maintenance_request": {
                    "request_id": req.id,
                    "reported_by": req.reported_by,
                    "source": req.source,
                }
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.db.add(task)
        self.db.flush()

        req.converted_to_task_id = task.id
        req.status = "in-progress" if initial_status == "assigned" else "open"
        self.db.commit()
        self.db.refresh(task)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department="maintenance",
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="created_from_request",
            user=current_user,
            details={"maintenance_request_id": req.id, "initial_status": initial_status},
        )
        return task

    def get_department_task_stats(
        self, department: str, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, int]:
        target_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        dept = department.lower().strip()

        tasks = (
            self.db.query(models.DepartmentTask)
            .filter(
                models.DepartmentTask.hotel_id == target_hotel_id,
                models.DepartmentTask.department.ilike(f"%{dept}%"),
            )
            .all()
        )

        return {
            "total": len(tasks),
            "pending": sum(1 for t in tasks if t.status == "pending"),
            "assigned": sum(1 for t in tasks if t.status == "assigned"),
            "in_progress": sum(1 for t in tasks if t.status == "in_progress"),
            "completed": sum(1 for t in tasks if t.status == "completed"),
            "urgent": sum(1 for t in tasks if t.priority == "urgent" and t.status != "completed"),
        }

    def _resolve_user_staff_id(self, current_user: models.User) -> Optional[int]:
        if current_user.staff_id:
            return current_user.staff_id
        # Fallback to check if staff record matches phone or username
        staff = self.db.query(models.Staff.id).filter(
            models.Staff.hotel_id == current_user.hotel_id,
            or_(
                models.Staff.phone == current_user.phone,
                models.Staff.full_name == current_user.full_name,
            ),
        ).first()
        return staff[0] if staff else None

    def get_my_tasks(
        self, status: Optional[str], current_user: models.User
    ) -> List[models.DepartmentTask]:
        staff_id = self._resolve_user_staff_id(current_user)

        # If requesting unassigned pool tasks for this department
        if status == "unassigned":
            user_dept = "maintenance"
            if current_user.staff and current_user.staff.department:
                user_dept = current_user.staff.department.lower()
            return (
                self.db.query(models.DepartmentTask)
                .filter(
                    models.DepartmentTask.hotel_id == current_user.hotel_id,
                    models.DepartmentTask.department.ilike(f"%{user_dept}%"),
                    models.DepartmentTask.assigned_to_staff_id.is_(None),
                    models.DepartmentTask.status == "pending",
                )
                .order_by(models.DepartmentTask.created_at.desc())
                .all()
            )

        if not staff_id:
            # Fallback for admin/superadmin testing: return all department tasks
            if current_user.role in ["super-admin", "hotel-admin"]:
                query = self.db.query(models.DepartmentTask).filter(
                    models.DepartmentTask.hotel_id == current_user.hotel_id
                )
                if status and status != "all":
                    if status == "active":
                        query = query.filter(models.DepartmentTask.status.in_(["assigned", "in_progress"]))
                    else:
                        query = query.filter(models.DepartmentTask.status == status)
                return query.order_by(
                    models.DepartmentTask.due_date.asc().nullslast(),
                    models.DepartmentTask.created_at.desc(),
                ).all()
            return []

        query = self.db.query(models.DepartmentTask).filter(
            models.DepartmentTask.assigned_to_staff_id == staff_id
        )

        if status and status != "all":
            if status == "active":
                query = query.filter(models.DepartmentTask.status.in_(["assigned", "in_progress"]))
            else:
                query = query.filter(models.DepartmentTask.status == status)

        # Priority ordering: urgent (0) -> high (1) -> normal (2) -> low (3)
        return query.order_by(
            models.DepartmentTask.due_date.asc().nullslast(),
            models.DepartmentTask.created_at.desc(),
        ).all()

    def get_my_task_stats(self, current_user: models.User) -> Dict[str, int]:
        staff_id = self._resolve_user_staff_id(current_user)
        user_dept = "maintenance"
        if current_user.staff and current_user.staff.department:
            user_dept = current_user.staff.department.lower()

        unassigned_cnt = (
            self.db.query(models.DepartmentTask)
            .filter(
                models.DepartmentTask.hotel_id == current_user.hotel_id,
                models.DepartmentTask.department.ilike(f"%{user_dept}%"),
                models.DepartmentTask.assigned_to_staff_id.is_(None),
                models.DepartmentTask.status == "pending",
            )
            .count()
        )

        if not staff_id:
            if current_user.role in ["super-admin", "hotel-admin"]:
                tasks = (
                    self.db.query(models.DepartmentTask)
                    .filter(models.DepartmentTask.hotel_id == current_user.hotel_id)
                    .all()
                )
                return {
                    "assigned": sum(1 for t in tasks if t.status == "assigned"),
                    "in_progress": sum(1 for t in tasks if t.status == "in_progress"),
                    "completed_today": sum(1 for t in tasks if t.status == "completed"),
                    "completed_total": sum(1 for t in tasks if t.status == "completed"),
                    "urgent": sum(1 for t in tasks if t.priority in ["urgent", "high"] and t.status != "completed"),
                    "total_active": sum(1 for t in tasks if t.status in ["assigned", "in_progress"]),
                    "unassigned": unassigned_cnt,
                }
            return {
                "assigned": 0,
                "in_progress": 0,
                "completed_today": 0,
                "completed_total": 0,
                "urgent": 0,
                "total_active": 0,
                "unassigned": unassigned_cnt,
            }

        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)

        tasks = (
            self.db.query(models.DepartmentTask)
            .filter(models.DepartmentTask.assigned_to_staff_id == staff_id)
            .all()
        )

        assigned_cnt = sum(1 for t in tasks if t.status == "assigned")
        in_progress_cnt = sum(1 for t in tasks if t.status == "in_progress")
        completed_today_cnt = sum(
            1
            for t in tasks
            if t.status == "completed"
            and t.completed_at
            and t.completed_at >= today_start
        )
        completed_total_cnt = sum(1 for t in tasks if t.status == "completed")
        urgent_cnt = sum(
            1
            for t in tasks
            if t.priority in ["urgent", "high"]
            and t.status in ["assigned", "in_progress"]
        )

        return {
            "assigned": assigned_cnt,
            "in_progress": in_progress_cnt,
            "completed_today": completed_today_cnt,
            "completed_total": completed_total_cnt,
            "urgent": urgent_cnt,
            "total_active": assigned_cnt + in_progress_cnt,
            "unassigned": unassigned_cnt,
        }

    def start_task(
        self, task_id: int, current_user: models.User
    ) -> models.DepartmentTask:
        task = self.get_task_by_id(task_id, current_user)
        staff_id = self._resolve_user_staff_id(current_user)

        # Ownership check: must be assigned to user, or user is hotel admin
        is_assigned_user = staff_id and task.assigned_to_staff_id == staff_id
        is_admin = current_user.role in ["super-admin", "hotel-admin"]

        if not (is_assigned_user or is_admin):
            raise HTTPException(
                status_code=403,
                detail="You can only start tasks that are assigned to you.",
            )

        if task.status == "completed":
            raise HTTPException(
                status_code=400,
                detail="Task is already marked as completed.",
            )

        task.status = "in_progress"
        if not task.started_at:
            task.started_at = datetime.utcnow()
        task.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(task)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="started",
            user=current_user,
            details={"started_at": task.started_at.isoformat() if task.started_at else None},
        )

        return task

    def complete_task(
        self,
        task_id: int,
        payload: schemas.DepartmentTaskComplete,
        current_user: models.User,
    ) -> models.DepartmentTask:
        task = self.get_task_by_id(task_id, current_user)
        staff_id = self._resolve_user_staff_id(current_user)

        # Ownership check
        is_assigned_user = staff_id and task.assigned_to_staff_id == staff_id
        is_admin_or_head = (
            current_user.role in ["super-admin", "hotel-admin"]
            or current_user.role_level == "department_head"
        )

        if not (is_assigned_user or is_admin_or_head):
            raise HTTPException(
                status_code=403,
                detail="You can only complete tasks that are assigned to you.",
            )

        now = datetime.utcnow()
        task.status = "completed"
        task.completed_at = now

        if payload.completion_notes:
            task.completion_notes = payload.completion_notes.strip()

        if payload.actual_hours is not None and payload.actual_hours > 0:
            task.actual_hours = round(payload.actual_hours, 1)
        elif task.started_at:
            elapsed_hours = (now - task.started_at).total_seconds() / 3600.0
            task.actual_hours = round(max(0.1, elapsed_hours), 1)
        elif task.estimated_hours:
            task.actual_hours = task.estimated_hours

        task.updated_at = now
        self.db.commit()
        self.db.refresh(task)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="completed",
            user=current_user,
            details={
                "actual_hours": task.actual_hours,
                "notes": task.completion_notes,
            },
        )

        return task

    def verify_task(
        self,
        task_id: int,
        payload: schemas.DepartmentTaskSignOff,
        current_user: models.User,
    ) -> models.DepartmentTask:
        task = self.get_task_by_id(task_id, current_user)
        self._verify_department_management_permission(task.department, current_user)

        now = datetime.utcnow()
        task.verified_at = now
        task.verified_by = current_user.full_name or current_user.username

        meta = dict(task.meta_data or {})
        meta["sign_off"] = {
            "verified_at": now.isoformat(),
            "verified_by": task.verified_by,
            "notes": payload.notes,
        }
        task.meta_data = meta
        task.updated_at = now

        # If task was converted from a ticket, mark ticket resolved
        if task.source_ticket_id:
            ticket = self.db.query(models.DepartmentTicket).filter(models.DepartmentTicket.id == task.source_ticket_id).first()
            if ticket and ticket.status != "resolved":
                ticket.status = "resolved"
                ticket.resolved_at = now
                ticket.resolution_notes = f"Resolved via completed task {task.task_number} (verified by {task.verified_by})."
                ticket.updated_at = now

        self.db.commit()
        self.db.refresh(task)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="verified",
            user=current_user,
            details={
                "verified_by": task.verified_by,
                "notes": payload.notes,
            },
        )

        return task

    def rework_task(
        self,
        task_id: int,
        payload: schemas.DepartmentTaskRework,
        current_user: models.User,
    ) -> models.DepartmentTask:
        task = self.get_task_by_id(task_id, current_user)
        self._verify_department_management_permission(task.department, current_user)

        now = datetime.utcnow()
        task.status = "assigned"
        task.completed_at = None

        meta = dict(task.meta_data or {})
        history = meta.get("rework_history", [])
        history.append({
            "reason": payload.reason,
            "requested_at": now.isoformat(),
            "requested_by": current_user.full_name or current_user.username,
        })
        meta["rework_history"] = history
        task.meta_data = meta
        task.updated_at = now

        self.db.commit()
        self.db.refresh(task)

        self._record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="rework_requested",
            user=current_user,
            details={"reason": payload.reason},
        )

        return task

    def get_team_overview(
        self, department: str, hotel_id: Optional[int], current_user: models.User
    ) -> List[Dict[str, Any]]:
        target_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        dept = department.lower().strip()

        # Fetch active staff in this department
        staff_members = (
            self.db.query(models.Staff)
            .filter(
                models.Staff.hotel_id == target_hotel_id,
                models.Staff.status == "active",
                models.Staff.department.ilike(f"%{dept}%"),
            )
            .order_by(models.Staff.full_name.asc())
            .all()
        )

        now = datetime.utcnow()
        today_date = datetime(now.year, now.month, now.day)

        # Fetch all tasks for this department to calculate workloads
        dept_tasks = (
            self.db.query(models.DepartmentTask)
            .filter(
                models.DepartmentTask.hotel_id == target_hotel_id,
                models.DepartmentTask.department.ilike(f"%{dept}%"),
            )
            .all()
        )

        # Fetch today's attendance for these staff members
        staff_ids = [s.id for s in staff_members]
        attendances = (
            self.db.query(models.StaffAttendance)
            .filter(
                models.StaffAttendance.hotel_id == target_hotel_id,
                models.StaffAttendance.staff_id.in_(staff_ids),
                models.StaffAttendance.attendance_date == today_date,
            )
            .all()
        )
        attendance_map = {a.staff_id: a.status for a in attendances}

        overview = []
        for staff in staff_members:
            assigned_tasks = [t for t in dept_tasks if t.assigned_to_staff_id == staff.id]
            active_tasks = [t for t in assigned_tasks if t.status in ["assigned", "in_progress"]]
            in_prog_task = next((t for t in assigned_tasks if t.status == "in_progress"), None)
            completed_today = sum(
                1
                for t in assigned_tasks
                if t.status == "completed"
                and t.completed_at
                and t.completed_at >= today_date
            )
            total_completed = sum(1 for t in assigned_tasks if t.status == "completed")

            overview.append({
                "id": staff.id,
                "full_name": staff.full_name,
                "designation": staff.designation or "Technician",
                "phone": staff.phone or "N/A",
                "active_tasks_count": len(active_tasks),
                "in_progress_task_title": in_prog_task.title if in_prog_task else None,
                "in_progress_task_number": in_prog_task.task_number if in_prog_task else None,
                "completed_today": completed_today,
                "total_completed": total_completed,
                "attendance_status": attendance_map.get(staff.id, "present"),
                "status": "busy" if in_prog_task else ("available" if active_tasks else "free"),
            })

        return overview

    def get_department_performance(
        self, department: str, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        target_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        dept = department.lower().strip()

        tasks = (
            self.db.query(models.DepartmentTask)
            .filter(
                models.DepartmentTask.hotel_id == target_hotel_id,
                models.DepartmentTask.department.ilike(f"%{dept}%"),
            )
            .all()
        )

        total_tasks = len(tasks)
        completed_tasks = [t for t in tasks if t.status == "completed"]
        completed_count = len(completed_tasks)
        completion_rate = round((completed_count / total_tasks * 100), 1) if total_tasks > 0 else 0.0

        # Calculate average turnaround hours
        total_hours = sum(t.actual_hours for t in completed_tasks if t.actual_hours > 0)
        avg_turnaround = round(total_hours / completed_count, 1) if completed_count > 0 else 0.0

        # Category breakdown
        category_counts = {}
        for t in tasks:
            cat = t.category or "General"
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # Priority breakdown
        priority_counts = {"urgent": 0, "high": 0, "normal": 0, "low": 0}
        for t in tasks:
            pri = t.priority or "normal"
            if pri in priority_counts:
                priority_counts[pri] += 1

        # Technician metrics
        tech_metrics = {}
        for t in completed_tasks:
            if t.assigned_staff:
                tid = t.assigned_staff.id
                if tid not in tech_metrics:
                    tech_metrics[tid] = {
                        "name": t.assigned_staff.full_name,
                        "designation": t.assigned_staff.designation,
                        "tasks_completed": 0,
                        "hours_logged": 0.0,
                    }
                tech_metrics[tid]["tasks_completed"] += 1
                tech_metrics[tid]["hours_logged"] = round(
                    tech_metrics[tid]["hours_logged"] + (t.actual_hours or 0.0), 1
                )

        return {
            "total_tasks": total_tasks,
            "completed_count": completed_count,
            "completion_rate": completion_rate,
            "avg_turnaround_hours": avg_turnaround,
            "category_breakdown": category_counts,
            "priority_breakdown": priority_counts,
            "technician_metrics": list(tech_metrics.values()),
        }


