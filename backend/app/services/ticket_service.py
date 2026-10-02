from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app import models, schemas


class TicketService:
    def __init__(self, db: Session):
        self.db = db

    def _resolve_hotel_id(self, hotel_id: Optional[int], current_user: models.User) -> int:
        if current_user.role == "super-admin":
            if hotel_id:
                return hotel_id
            first_hotel = self.db.query(models.Hotel.id).first()
            return first_hotel[0] if first_hotel else 1
        if not current_user.hotel_id:
            raise HTTPException(status_code=400, detail="Hotel context is required.")
        return current_user.hotel_id

    def _generate_ticket_number(self, hotel_id: int, department: str) -> str:
        dept_prefix = department[:4].upper()
        prefix = f"TCK-{dept_prefix}-"

        latest_ticket = (
            self.db.query(models.DepartmentTicket)
            .filter(
                models.DepartmentTicket.hotel_id == hotel_id,
                models.DepartmentTicket.ticket_number.like(f"{prefix}%"),
            )
            .order_by(models.DepartmentTicket.id.desc())
            .first()
        )

        next_idx = 1
        if latest_ticket and latest_ticket.ticket_number:
            try:
                suffix = latest_ticket.ticket_number.split("-")[-1]
                next_idx = int(suffix) + 1
            except (ValueError, IndexError):
                next_idx = 1

        return f"{prefix}{next_idx:04d}"

    def record_audit_log(
        self,
        hotel_id: int,
        department: str,
        entity_type: str,
        entity_id: int,
        entity_identifier: Optional[str],
        action: str,
        user: models.User,
        details: Optional[Dict[str, Any]] = None,
    ) -> models.DepartmentAuditLog:
        audit = models.DepartmentAuditLog(
            hotel_id=hotel_id,
            department=department.lower(),
            entity_type=entity_type,
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
        self.db.refresh(audit)
        return audit

    def create_ticket(
        self, payload: schemas.DepartmentTicketCreate, current_user: models.User
    ) -> models.DepartmentTicket:
        hotel_id = self._resolve_hotel_id(payload.hotel_id, current_user)
        department = (payload.department or "maintenance").lower().strip()
        ticket_number = self._generate_ticket_number(hotel_id, department)

        ticket = models.DepartmentTicket(
            ticket_number=ticket_number,
            hotel_id=hotel_id,
            department=department,
            title=payload.title.strip(),
            description=payload.description.strip() if payload.description else None,
            category=payload.category or "General",
            priority=payload.priority or "normal",
            status="open",
            source=payload.source or "direct",
            location=payload.location.strip() if payload.location else None,
            room_id=payload.room_id,
            reported_by=payload.reported_by.strip() if payload.reported_by else (current_user.full_name or current_user.username),
            contact_phone=payload.contact_phone.strip() if payload.contact_phone else None,
            created_by_user_id=current_user.id,
            meta_data=payload.meta_data or {},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)

        # Record audit log
        self.record_audit_log(
            hotel_id=hotel_id,
            department=department,
            entity_type="ticket",
            entity_id=ticket.id,
            entity_identifier=ticket.ticket_number,
            action="created",
            user=current_user,
            details={
                "title": ticket.title,
                "priority": ticket.priority,
                "source": ticket.source,
                "category": ticket.category,
                "location": ticket.location,
            },
        )

        return ticket

    def get_tickets(
        self,
        department: Optional[str],
        status: Optional[str],
        priority: Optional[str],
        search: Optional[str],
        hotel_id: Optional[int],
        current_user: models.User,
    ) -> List[models.DepartmentTicket]:
        target_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        query = self.db.query(models.DepartmentTicket).filter(
            models.DepartmentTicket.hotel_id == target_hotel_id
        )

        if department and department != "all":
            query = query.filter(models.DepartmentTicket.department == department.lower().strip())

        if status and status != "all":
            query = query.filter(models.DepartmentTicket.status == status)

        if priority and priority != "all":
            query = query.filter(models.DepartmentTicket.priority == priority)

        if search:
            term = f"%{search.strip().lower()}%"
            query = query.filter(
                (models.DepartmentTicket.title.ilike(term))
                | (models.DepartmentTicket.ticket_number.ilike(term))
                | (models.DepartmentTicket.location.ilike(term))
                | (models.DepartmentTicket.reported_by.ilike(term))
            )

        return query.order_by(desc(models.DepartmentTicket.created_at)).all()

    def get_ticket_by_id(self, ticket_id: int, current_user: models.User) -> models.DepartmentTicket:
        ticket = (
            self.db.query(models.DepartmentTicket)
            .filter(models.DepartmentTicket.id == ticket_id)
            .first()
        )
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found.")

        self._resolve_hotel_id(ticket.hotel_id, current_user)
        return ticket

    def update_ticket(
        self, ticket_id: int, payload: schemas.DepartmentTicketUpdate, current_user: models.User
    ) -> models.DepartmentTicket:
        ticket = self.get_ticket_by_id(ticket_id, current_user)
        changes = {}

        if payload.title is not None and payload.title.strip():
            changes["title"] = (ticket.title, payload.title.strip())
            ticket.title = payload.title.strip()

        if payload.description is not None:
            ticket.description = payload.description.strip() if payload.description else None

        if payload.category is not None:
            changes["category"] = (ticket.category, payload.category)
            ticket.category = payload.category

        if payload.priority is not None:
            changes["priority"] = (ticket.priority, payload.priority)
            ticket.priority = payload.priority

        if payload.location is not None:
            ticket.location = payload.location.strip() if payload.location else None

        if payload.reported_by is not None:
            ticket.reported_by = payload.reported_by.strip() if payload.reported_by else None

        if payload.contact_phone is not None:
            ticket.contact_phone = payload.contact_phone.strip() if payload.contact_phone else None

        if payload.status is not None:
            changes["status"] = (ticket.status, payload.status)
            ticket.status = payload.status
            if payload.status in ["resolved", "closed"]:
                ticket.resolved_at = datetime.utcnow()
                if payload.resolution_notes:
                    ticket.resolution_notes = payload.resolution_notes.strip()

        ticket.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(ticket)

        if changes:
            self.record_audit_log(
                hotel_id=ticket.hotel_id,
                department=ticket.department,
                entity_type="ticket",
                entity_id=ticket.id,
                entity_identifier=ticket.ticket_number,
                action="updated",
                user=current_user,
                details=changes,
            )

        return ticket

    def convert_ticket_to_task(
        self,
        ticket_id: int,
        payload: schemas.DepartmentTicketConvertToTask,
        current_user: models.User,
    ) -> models.DepartmentTask:
        ticket = self.get_ticket_by_id(ticket_id, current_user)

        if ticket.status == "converted_to_task" and ticket.converted_to_task_id:
            # Check if task already exists
            existing_task = (
                self.db.query(models.DepartmentTask)
                .filter(models.DepartmentTask.id == ticket.converted_to_task_id)
                .first()
            )
            if existing_task:
                return existing_task

        # Generate Task Number
        dept_prefix = ticket.department[:4].upper()
        prefix = f"TSK-{dept_prefix}-"
        latest_task = (
            self.db.query(models.DepartmentTask)
            .filter(
                models.DepartmentTask.hotel_id == ticket.hotel_id,
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

        assigned_staff_id = payload.assigned_to_staff_id
        initial_status = "assigned" if assigned_staff_id else "pending"

        task_title = payload.title.strip() if payload.title else ticket.title
        task_desc = ticket.description or ""
        if payload.notes:
            task_desc += f"\n\n[Conversion Notes]: {payload.notes.strip()}"

        task = models.DepartmentTask(
            task_number=task_number,
            hotel_id=ticket.hotel_id,
            department=ticket.department,
            title=task_title,
            description=task_desc.strip() if task_desc.strip() else None,
            category=ticket.category,
            priority=payload.priority or ticket.priority,
            status=initial_status,
            location=ticket.location,
            room_id=ticket.room_id,
            assigned_to_staff_id=assigned_staff_id,
            created_by_user_id=current_user.id,
            due_date=payload.due_date,
            estimated_hours=payload.estimated_hours or 1.0,
            actual_hours=0.0,
            source_ticket_id=ticket.id,
            meta_data={
                "converted_from_ticket": {
                    "ticket_id": ticket.id,
                    "ticket_number": ticket.ticket_number,
                    "converted_at": datetime.utcnow().isoformat(),
                    "converted_by": current_user.full_name or current_user.username,
                }
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.db.add(task)
        self.db.flush()

        # Update Ticket
        ticket.status = "converted_to_task"
        ticket.converted_to_task_id = task.id
        ticket.converted_at = datetime.utcnow()
        ticket.converted_by = current_user.full_name or current_user.username
        ticket.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(task)
        self.db.refresh(ticket)

        # Audit log for ticket conversion
        self.record_audit_log(
            hotel_id=ticket.hotel_id,
            department=ticket.department,
            entity_type="ticket",
            entity_id=ticket.id,
            entity_identifier=ticket.ticket_number,
            action="converted_to_task",
            user=current_user,
            details={
                "task_id": task.id,
                "task_number": task.task_number,
                "assigned_to_staff_id": assigned_staff_id,
            },
        )

        # Audit log for task created from ticket
        self.record_audit_log(
            hotel_id=task.hotel_id,
            department=task.department,
            entity_type="task",
            entity_id=task.id,
            entity_identifier=task.task_number,
            action="created_from_ticket",
            user=current_user,
            details={
                "source_ticket_id": ticket.id,
                "source_ticket_number": ticket.ticket_number,
                "initial_status": initial_status,
            },
        )

        return task

    def get_audit_logs(
        self,
        department: Optional[str],
        entity_type: Optional[str],
        entity_id: Optional[int],
        hotel_id: Optional[int],
        limit: int,
        current_user: models.User,
    ) -> List[models.DepartmentAuditLog]:
        target_hotel_id = self._resolve_hotel_id(hotel_id, current_user)
        query = self.db.query(models.DepartmentAuditLog).filter(
            models.DepartmentAuditLog.hotel_id == target_hotel_id
        )

        if department and department != "all":
            query = query.filter(models.DepartmentAuditLog.department == department.lower().strip())

        if entity_type and entity_type != "all":
            query = query.filter(models.DepartmentAuditLog.entity_type == entity_type)

        if entity_id:
            query = query.filter(models.DepartmentAuditLog.entity_id == entity_id)

        return (
            query.order_by(desc(models.DepartmentAuditLog.created_at))
            .limit(min(limit, 200))
            .all()
        )
