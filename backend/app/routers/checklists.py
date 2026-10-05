"""Checklist templates.

HODs and admins build reusable checklists (for example a deep-clean or inspection checklist) and the
points are what an attendant or inspector ticks off. One row per template, items stored as JSON.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(tags=["Checklists"])

# Roles allowed to build / edit checklist templates
ADMIN_ROLES = {"super-admin", "hotel-admin", "manager"}


def _assert_can_manage(current_user: models.User) -> None:
    """Only department HODs or administrators may create, edit, or activate/deactivate checklist templates."""
    is_admin = (current_user.role or "") in ADMIN_ROLES
    is_department_head = (getattr(current_user, "role_level", "") or "") == "department_head"
    if not (is_admin or is_department_head):
        raise HTTPException(
            status_code=403,
            detail="Only a housekeeping HOD or an administrator has permission to manage, edit, or activate/deactivate checklists.",
        )


def _resolve_hotel_id(hotel_id: Optional[int], current_user: models.User, db: Session) -> int:
    target = hotel_id or current_user.hotel_id
    if not target and current_user.role == "super-admin":
        first = db.query(models.Hotel.id).first()
        target = first[0] if first else 1
    if not target:
        raise HTTPException(status_code=400, detail="A hotel is required to manage checklists.")
    if current_user.role != "super-admin" and current_user.hotel_id and int(target) != int(current_user.hotel_id):
        raise HTTPException(status_code=403, detail="You can only manage checklists for your own hotel.")
    return int(target)


def _normalise_items(items) -> list:
    """Accept either ChecklistItemPayload objects or plain dicts and store a clean list."""
    out = []
    for item in items or []:
        if item is None:
            continue
        if isinstance(item, dict):
            text = str(item.get("text") or "").strip()
            required = bool(item.get("required", True))
        else:
            text = str(getattr(item, "text", "") or "").strip()
            required = bool(getattr(item, "required", True))
        if text:
            out.append({"text": text, "required": required})
    return out


def _serialise(row: models.Checklist) -> dict:
    items = row.items if isinstance(row.items, list) else []
    clean = []
    for item in items:
        if isinstance(item, dict):
            clean.append({"text": str(item.get("text") or ""), "required": bool(item.get("required", True))})
        elif isinstance(item, str):
            clean.append({"text": item, "required": True})
    return {
        "id": row.id,
        "hotel_id": row.hotel_id,
        "name": row.name,
        "department": row.department or "housekeeping",
        "description": row.description,
        "items": clean,
        "is_active": bool(row.is_active),
        "created_by": row.created_by,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/checklists", response_model=List[schemas.ChecklistResponse])
def list_checklists(
    hotel_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target = _resolve_hotel_id(hotel_id, current_user, db)
    query = db.query(models.Checklist).filter(models.Checklist.hotel_id == target)
    if department and department != "all":
        query = query.filter(models.Checklist.department == department)
    if not include_inactive:
        query = query.filter(models.Checklist.is_active.is_(True))
    rows = query.order_by(models.Checklist.id.desc()).all()
    return [_serialise(r) for r in rows]


@router.get("/checklists/{checklist_id}", response_model=schemas.ChecklistResponse)
def get_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = db.query(models.Checklist).filter(models.Checklist.id == checklist_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Checklist not found")
    _resolve_hotel_id(row.hotel_id, current_user, db)
    return _serialise(row)


@router.post("/checklists", response_model=schemas.ChecklistResponse)
def create_checklist(
    payload: schemas.ChecklistCreatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_can_manage(current_user)

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Checklist name is required.")
    items = _normalise_items(payload.items)
    if not items:
        raise HTTPException(status_code=400, detail="Add at least one checklist point.")

    target = _resolve_hotel_id(payload.hotel_id, current_user, db)
    row = models.Checklist(
        hotel_id=target,
        name=name,
        department=(payload.department or "housekeeping").strip(),
        description=(payload.description or "").strip() or None,
        items=items,
        is_active=bool(payload.is_active),
        created_by=current_user.full_name or current_user.username,
        created_by_user_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialise(row)


@router.put("/checklists/{checklist_id}", response_model=schemas.ChecklistResponse)
def update_checklist(
    checklist_id: int,
    payload: schemas.ChecklistUpdatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_can_manage(current_user)

    row = db.query(models.Checklist).filter(models.Checklist.id == checklist_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Checklist not found")
    _resolve_hotel_id(row.hotel_id, current_user, db)

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Checklist name cannot be empty.")
        row.name = name
    if payload.department is not None:
        row.department = payload.department.strip() or "housekeeping"
    if payload.description is not None:
        row.description = payload.description.strip() or None
    if payload.items is not None:
        items = _normalise_items(payload.items)
        if not items:
            raise HTTPException(status_code=400, detail="A checklist needs at least one point.")
        row.items = items
    if payload.is_active is not None:
        row.is_active = bool(payload.is_active)

    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _serialise(row)


@router.delete("/checklists/{checklist_id}")
def delete_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_can_manage(current_user)

    row = db.query(models.Checklist).filter(models.Checklist.id == checklist_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Checklist not found")
    _resolve_hotel_id(row.hotel_id, current_user, db)

    db.delete(row)
    db.commit()
    return {"message": "Checklist deleted", "id": checklist_id}
