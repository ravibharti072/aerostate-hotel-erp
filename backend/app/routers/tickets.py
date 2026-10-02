from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/tickets", tags=["Department Tickets & Audit Logs"])


def get_ticket_service(db: Session = Depends(get_db)) -> TicketService:
    return TicketService(db)


@router.post("", response_model=schemas.DepartmentTicketResponse)
def create_ticket(
    payload: schemas.DepartmentTicketCreate,
    current_user: models.User = Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    return service.create_ticket(payload, current_user)


@router.get("/audit-logs", response_model=List[schemas.DepartmentAuditLogResponse])
def get_audit_logs(
    department: Optional[str] = Query("maintenance"),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    hotel_id: Optional[int] = Query(None),
    limit: int = Query(100),
    current_user: models.User = Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    return service.get_audit_logs(
        department=department,
        entity_type=entity_type,
        entity_id=entity_id,
        hotel_id=hotel_id,
        limit=limit,
        current_user=current_user,
    )


@router.get("", response_model=List[schemas.DepartmentTicketResponse])
def get_tickets(
    department: Optional[str] = Query("maintenance"),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    hotel_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    return service.get_tickets(
        department=department,
        status=status,
        priority=priority,
        search=search,
        hotel_id=hotel_id,
        current_user=current_user,
    )


@router.get("/{ticket_id}", response_model=schemas.DepartmentTicketResponse)
def get_ticket_by_id(
    ticket_id: int,
    current_user: models.User = Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    return service.get_ticket_by_id(ticket_id, current_user)


@router.put("/{ticket_id}", response_model=schemas.DepartmentTicketResponse)
def update_ticket(
    ticket_id: int,
    payload: schemas.DepartmentTicketUpdate,
    current_user: models.User = Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    return service.update_ticket(ticket_id, payload, current_user)


@router.post("/{ticket_id}/convert-to-task", response_model=schemas.DepartmentTaskResponse)
def convert_ticket_to_task(
    ticket_id: int,
    payload: schemas.DepartmentTicketConvertToTask,
    current_user: models.User = Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    return service.convert_ticket_to_task(ticket_id, payload, current_user)
