from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.housekeeping_service import HousekeepingService

router = APIRouter(tags=["Housekeeping"])


def get_housekeeping_service(db: Session = Depends(get_db)) -> HousekeepingService:
    return HousekeepingService(db)


def _to_utc_iso(dt):
    if not dt:
        return None
    iso = dt.isoformat()
    return iso + "Z" if not iso.endswith("Z") else iso


# -------------------------------------------------------------
# Action & Roster Payloads
# -------------------------------------------------------------

class CleaningRosterUpdatePayload(BaseModel):
    staff_ids: List[int]


class CleaningStaffResponse(BaseModel):
    id: int
    full_name: str
    department: str
    designation: str
    phone: Optional[str] = None
    role_level: Optional[str] = None
    hotel_id: Optional[int] = None
    is_cleaning_active: bool = True


class TaskAssignPayload(BaseModel):
    staff_id: int
    assigned_to_name: Optional[str] = None
    notes: Optional[str] = None


class TaskInspectionPayload(BaseModel):
    action: str  # "pass" or "fail"
    notes: Optional[str] = None


# -------------------------------------------------------------
# Auto-Sync: Ensure All Dirty / Vacated Rooms Have Turnover Tasks
# -------------------------------------------------------------

def ensure_turnover_tasks_for_hotel(db: Session, hotel_id: Optional[int]):
    """
    Scans for any room that needs cleaning ('dirty', 'cleaning', 'turnover')
    and guarantees an active turnover cleaning task exists.
    """
    if not hotel_id:
        return

    unclean_rooms = (
        db.query(models.Room)
        .filter(
            models.Room.hotel_id == hotel_id,
            or_(
                models.Room.status == "dirty",
                models.Room.status == "cleaning",
                models.Room.status.ilike("%dirty%"),
                models.Room.status.ilike("%turnover%"),
                models.Room.status.ilike("%cleaning%"),
            ),
        )
        .all()
    )

    for room in unclean_rooms:
        # Check if there is an active task (pending, assigned, in-progress) OR a completed task awaiting inspection
        existing_task = (
            db.query(models.HousekeepingTask)
            .filter(
                models.HousekeepingTask.hotel_id == hotel_id,
                models.HousekeepingTask.room_id == room.id,
                models.HousekeepingTask.task_type.in_(["checkout-cleaning", "room-cleaning", "cleaning", "turnover", "deep-cleaning"]),
                or_(
                    models.HousekeepingTask.status.in_(["pending", "assigned", "in-progress", "in_progress"]),
                    and_(
                        models.HousekeepingTask.status == "completed",
                        ~models.HousekeepingTask.notes.ilike("%inspection passed%")
                    )
                )
            )
            .first()
        )

        if not existing_task:
            # Find the most recently checked-out booking for this room to link
            recent_booking = (
                db.query(models.Booking)
                .filter(
                    models.Booking.hotel_id == hotel_id,
                    models.Booking.room_id == room.id,
                )
                .order_by(models.Booking.id.desc())
                .first()
            )

            new_task = models.HousekeepingTask(
                hotel_id=hotel_id,
                room_id=room.id,
                booking_id=recent_booking.id if recent_booking else None,
                task_type="checkout-cleaning",
                priority="high" if room.status == "dirty" else "normal",
                status="pending",
                notes=f"Turnover cleaning for Room {room.room_number}",
                created_by="Front Desk Checkout",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(new_task)

    db.commit()


# -------------------------------------------------------------
# Room Status Endpoints
# -------------------------------------------------------------

@router.put("/rooms/{room_id}/status", response_model=schemas.RoomResponse)
def update_room_status(
    room_id: int,
    status_update: schemas.RoomStatusUpdate,
    service: HousekeepingService = Depends(get_housekeeping_service),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    res = service.update_room_status(room_id, status_update, current_user)
    target_hid = getattr(res, "hotel_id", None) or current_user.hotel_id
    if status_update.status in ["dirty", "cleaning"]:
        if target_hid:
            ensure_turnover_tasks_for_hotel(db, target_hid)
    return res


@router.get("/housekeeping/rooms", response_model=List[schemas.RoomResponse])
def get_housekeeping_rooms(
    hotel_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    service: HousekeepingService = Depends(get_housekeeping_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_housekeeping_rooms(hotel_id, status, current_user)


@router.post("/housekeeping/report-problem")
def report_housekeeping_problem(
    payload: schemas.HousekeepingProblemReportPayload,
    service: HousekeepingService = Depends(get_housekeeping_service),
    current_user: models.User = Depends(get_current_user),
):
    req = service.report_room_problem(payload, current_user)
    return {"message": "Maintenance problem reported successfully", "id": req.id}


# -------------------------------------------------------------
# Cleaning Staff Roster Endpoints
# -------------------------------------------------------------

@router.get("/housekeeping/cleaning-staff", response_model=List[CleaningStaffResponse])
def get_designated_cleaning_staff(
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id
    if not target_hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        target_hotel_id = first_hotel[0] if first_hotel else 1

    cleaning_staff = (
        db.query(models.Staff)
        .outerjoin(models.User, models.User.staff_id == models.Staff.id)
        .filter(
            models.Staff.hotel_id == target_hotel_id,
            models.Staff.status == "active",
            or_(
                models.Staff.department.ilike("%housekeeping%"),
                models.Staff.department.ilike("%clean%"),
                models.Staff.designation.ilike("%clean%"),
                models.Staff.designation.ilike("%attendant%"),
                models.Staff.designation.ilike("%housekeep%"),
                models.User.role == "housekeeping",
            ),
        )
        .distinct()
        .order_by(models.Staff.full_name.asc())
        .all()
    )

    if not cleaning_staff:
        # Fallback to any active staff for this hotel so attendants can always be assigned
        cleaning_staff = (
            db.query(models.Staff)
            .filter(
                models.Staff.hotel_id == target_hotel_id,
                models.Staff.status == "active",
            )
            .order_by(models.Staff.full_name.asc())
            .all()
        )

    return [
        CleaningStaffResponse(
            id=s.id,
            full_name=s.full_name,
            department=s.department,
            designation=s.designation or "Room Attendant",
            phone=s.phone,
            role_level=getattr(s, "role_level", None) or "employee",
            hotel_id=s.hotel_id,
            is_cleaning_active=True,
        )
        for s in cleaning_staff
    ]


@router.get("/housekeeping/cleaning-roster", response_model=List[CleaningStaffResponse])
def get_cleaning_roster_pool(
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id
    if not target_hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        target_hotel_id = first_hotel[0] if first_hotel else 1

    housekeeping_staff = (
        db.query(models.Staff)
        .filter(
            models.Staff.hotel_id == target_hotel_id,
            models.Staff.status == "active",
        )
        .order_by(models.Staff.full_name.asc())
        .all()
    )

    return [
        CleaningStaffResponse(
            id=s.id,
            full_name=s.full_name,
            department=s.department,
            designation=s.designation or "Attendant",
            phone=s.phone,
            is_cleaning_active=(
                "clean" in (s.designation or "").lower()
                or "attendant" in (s.designation or "").lower()
                or "housekeeping" in (s.department or "").lower()
            ),
        )
        for s in housekeeping_staff
    ]


@router.post("/housekeeping/cleaning-roster")
def update_cleaning_roster(
    payload: CleaningRosterUpdatePayload,
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id
    if not target_hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        target_hotel_id = first_hotel[0] if first_hotel else 1

    selected_staff = (
        db.query(models.Staff)
        .filter(
            models.Staff.hotel_id == target_hotel_id,
            models.Staff.id.in_(payload.staff_ids),
        )
        .all()
    )

    for s in selected_staff:
        if "clean" not in (s.designation or "").lower():
            s.designation = "Housekeeping Cleaning"

    db.commit()
    return {
        "message": f"Updated cleaning roster with {len(selected_staff)} attendants.",
        "assigned_count": len(selected_staff),
    }


# -------------------------------------------------------------
# Housekeeping Tasks: Retrieval & Creation
# -------------------------------------------------------------

@router.get("/housekeeping/tasks")
def get_housekeeping_tasks(
    hotel_id: Optional[int] = Query(None),
    room_id: Optional[int] = Query(None),
    booking_id: Optional[int] = Query(None),
    task_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    room_id = None if hasattr(room_id, "default") else room_id
    booking_id = None if hasattr(booking_id, "default") else booking_id
    task_type = None if hasattr(task_type, "default") else task_type
    priority = None if hasattr(priority, "default") else priority
    status = None if hasattr(status, "default") else status

    target_hotel_id = hotel_id or current_user.hotel_id
    if target_hotel_id:
        ensure_turnover_tasks_for_hotel(db, target_hotel_id)
        query = db.query(models.HousekeepingTask).filter(
            models.HousekeepingTask.hotel_id == target_hotel_id
        )
        rooms_map = {r.id: r for r in db.query(models.Room).filter(models.Room.hotel_id == target_hotel_id).all()}
        staff_map = {s.id: s for s in db.query(models.Staff).filter(models.Staff.hotel_id == target_hotel_id).all()}
    else:
        # Super-admin with unspecified hotel: ensure for all hotels and query all
        all_hotels = db.query(models.Hotel.id).all()
        for (hid,) in all_hotels:
            ensure_turnover_tasks_for_hotel(db, hid)
        query = db.query(models.HousekeepingTask)
        rooms_map = {r.id: r for r in db.query(models.Room).all()}
        staff_map = {s.id: s for s in db.query(models.Staff).all()}

    if room_id:
        query = query.filter(models.HousekeepingTask.room_id == room_id)
    if booking_id:
        query = query.filter(models.HousekeepingTask.booking_id == booking_id)
    if task_type and task_type != "all":
        query = query.filter(models.HousekeepingTask.task_type == task_type)
    if priority and priority != "all":
        query = query.filter(models.HousekeepingTask.priority == priority)
    if status and status != "all":
        query = query.filter(models.HousekeepingTask.status == status)

    tasks = query.order_by(models.HousekeepingTask.id.desc()).all()

    output = []
    for t in tasks:
        room = rooms_map.get(t.room_id)
        staff = staff_map.get(t.assigned_staff_id)

        output.append({
            "id": t.id,
            "hotel_id": t.hotel_id,
            "room_id": t.room_id,
            "room_number": room.room_number if room else str(t.room_id),
            "floor": room.floor if room else "-",
            "room_type": room.room_type if room else "Room",
            "room_status": room.status if room else "dirty",
            "booking_id": t.booking_id,
            "assigned_staff_id": t.assigned_staff_id,
            "assigned_to": staff.full_name if staff else (t.assigned_to or "Unassigned"),
            "task_type": t.task_type or "checkout-cleaning",
            "priority": t.priority or "normal",
            "status": t.status or "pending",
            "notes": t.notes,
            "due_date": _to_utc_iso(t.due_date),
            "created_by": t.created_by,
            "started_by": t.started_by,
            "started_at": _to_utc_iso(t.started_at),
            "completed_by": t.completed_by,
            "completed_at": _to_utc_iso(t.completed_at),
            "created_at": _to_utc_iso(t.created_at),
            "updated_at": _to_utc_iso(t.updated_at),
        })

    return output


@router.post("/housekeeping/tasks")
def create_housekeeping_task(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = data.get("hotel_id") or current_user.hotel_id
    if not hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        hotel_id = first_hotel[0] if first_hotel else 1

    room_id = data.get("room_id")
    assigned_staff_id = data.get("assigned_staff_id")
    assigned_to = data.get("assigned_to")
    task_type = data.get("task_type") or "checkout-cleaning"
    task_status = data.get("status") or "in-progress"

    if assigned_staff_id and not assigned_to:
        staff = db.query(models.Staff).filter(models.Staff.id == assigned_staff_id).first()
        if staff:
            assigned_to = staff.full_name

    existing_task = None
    if room_id:
        existing_task = (
            db.query(models.HousekeepingTask)
            .filter(
                models.HousekeepingTask.hotel_id == hotel_id,
                models.HousekeepingTask.room_id == room_id,
                models.HousekeepingTask.status.in_(["pending", "assigned", "in-progress"]),
            )
            .order_by(models.HousekeepingTask.id.desc())
            .first()
        )

    if existing_task:
        task = existing_task
        task.assigned_staff_id = assigned_staff_id or task.assigned_staff_id
        task.assigned_to = assigned_to or task.assigned_to
        task.task_type = task_type
        if data.get("priority"):
            task.priority = data.get("priority")
        task.status = task_status
        if data.get("notes"):
            task.notes = data.get("notes")
        task.updated_at = datetime.utcnow()
        db.query(models.HousekeepingTask).filter(
            models.HousekeepingTask.hotel_id == hotel_id,
            models.HousekeepingTask.room_id == room_id,
            models.HousekeepingTask.id != task.id,
            models.HousekeepingTask.status.in_(["pending", "assigned"]),
        ).delete(synchronize_session=False)
    else:
        task = models.HousekeepingTask(
            hotel_id=hotel_id,
            room_id=room_id,
            booking_id=data.get("booking_id"),
            assigned_staff_id=assigned_staff_id,
            assigned_to=assigned_to,
            task_type=task_type,
            priority=data.get("priority", "normal"),
            status=task_status,
            notes=data.get("notes"),
            created_by=current_user.full_name or current_user.username,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(task)

    # Synchronize room status
    if room_id:
        room = db.query(models.Room).filter(models.Room.id == room_id).first()
        if room:
            if task_status in ["in-progress", "cleaning"]:
                room.status = "cleaning"
            elif task_status in ["completed", "approved"]:
                room.status = "available"
            elif task_status in ["pending", "assigned"] and room.status != "occupied":
                room.status = "dirty"

    db.commit()
    db.refresh(task)
    return {"message": "Housekeeping task recorded", "id": task.id, "status": task.status}


@router.put("/housekeeping/tasks/{task_id}")
def update_housekeeping_task(
    task_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if "room_id" in data and data["room_id"]:
        task.room_id = int(data["room_id"])
    if "booking_id" in data:
        task.booking_id = int(data["booking_id"]) if data["booking_id"] else None
    if "assigned_staff_id" in data:
        task.assigned_staff_id = int(data["assigned_staff_id"]) if data["assigned_staff_id"] else None
        if task.assigned_staff_id and not data.get("assigned_to"):
            st = db.query(models.Staff).filter(models.Staff.id == task.assigned_staff_id).first()
            if st:
                task.assigned_to = st.full_name
    if "assigned_to" in data:
        task.assigned_to = data["assigned_to"]
    if "task_type" in data and data["task_type"]:
        task.task_type = data["task_type"]
    if "priority" in data and data["priority"]:
        task.priority = data["priority"]
    if "notes" in data:
        task.notes = data["notes"]
    if "due_date" in data:
        task.due_date = data["due_date"]

    if "status" in data and data["status"]:
        new_status = data["status"]
        task.status = new_status
        if new_status in ["in-progress", "cleaning"] and not task.started_at:
            task.started_at = datetime.utcnow()
            task.started_by = current_user.full_name or current_user.username
        elif new_status in ["completed", "approved"]:
            task.completed_at = datetime.utcnow()
            task.completed_by = current_user.full_name or current_user.username

        # Sync room status
        if task.room_id:
            room = db.query(models.Room).filter(models.Room.id == task.room_id).first()
            if room:
                if new_status in ["in-progress", "cleaning"]:
                    room.status = "cleaning"
                elif new_status in ["completed", "approved"]:
                    room.status = "available"
                elif new_status in ["pending", "assigned"] and room.status != "occupied":
                    room.status = "dirty"

    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return {"message": "Housekeeping task updated", "id": task.id, "status": task.status}


# -------------------------------------------------------------
# Cleaning Actions
# -------------------------------------------------------------

@router.post("/housekeeping/tasks/{task_id}/start")
def start_cleaning(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "in-progress"
    task.started_at = datetime.utcnow()
    task.started_by = current_user.full_name or current_user.username
    task.updated_at = datetime.utcnow()

    # Audit log entry for starting cleaning
    start_iso = _to_utc_iso(task.started_at)
    if task.notes and "Inspection FAILED" in task.notes:
        task.notes = f"{task.notes}\n[Turnover Re-cleaning Started by {task.started_by} at {start_iso}]"
    else:
        task.notes = f"{task.notes or ''}\n[Cleaning Started by {task.started_by} at {start_iso}]".strip()

    # Sync room status to cleaning
    if task.room_id:
        room = db.query(models.Room).filter(models.Room.id == task.room_id).first()
        if room:
            room.status = "cleaning"

    db.commit()
    return {"message": "Cleaning started", "status": "in-progress", "room_status": "cleaning"}


@router.post("/housekeeping/tasks/{task_id}/complete")
def complete_cleaning(
    task_id: int,
    payload: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "completed"
    task.completed_at = datetime.utcnow()
    if not task.started_at:
        task.started_at = datetime.utcnow()
    task.completed_by = current_user.full_name or current_user.username
    task.updated_at = datetime.utcnow()

    comp_iso = _to_utc_iso(task.completed_at)
    completion_text = f"[Cleaning Completed & Submitted for HOD Clearance by {task.completed_by} at {comp_iso}]"
    if payload and payload.get("notes"):
        cleaned_note = payload["notes"].strip()
        if cleaned_note:
            completion_text += f"\nCompletion remarks: {cleaned_note}"
    task.notes = f"{task.notes or ''}\n{completion_text}".strip()

    # Clean up ANY other open/pending tasks for this room so no orphaned pending tasks remain
    if task.room_id:
        db.query(models.HousekeepingTask).filter(
            models.HousekeepingTask.room_id == task.room_id,
            models.HousekeepingTask.id != task.id,
            models.HousekeepingTask.status.in_(["pending", "assigned", "in-progress"]),
        ).delete(synchronize_session=False)

        room = db.query(models.Room).filter(models.Room.id == task.room_id).first()
        if room and room.status != "maintenance":
            room.status = "cleaning"

    db.commit()
    return {"message": "Cleaning completed by attendant. Awaiting HOD inspection.", "status": "completed", "room_status": "cleaning"}


@router.post("/housekeeping/tasks/{task_id}/assign")
@router.patch("/housekeeping/tasks/{task_id}/assign")
def assign_task_to_staff(
    task_id: int,
    payload: TaskAssignPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Housekeeping task not found")

    staff = db.query(models.Staff).filter(models.Staff.id == payload.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    task.assigned_staff_id = staff.id
    task.assigned_to = payload.assigned_to_name or staff.full_name
    task.status = "pending"

    if payload.notes:
        task.notes = f"{task.notes or ''}\nAssignment: {payload.notes}".strip()

    # Clean up any duplicate open tasks for this room
    if task.room_id:
        db.query(models.HousekeepingTask).filter(
            models.HousekeepingTask.room_id == task.room_id,
            models.HousekeepingTask.id != task.id,
            models.HousekeepingTask.status.in_(["pending", "assigned"]),
        ).delete(synchronize_session=False)

        room = db.query(models.Room).filter(models.Room.id == task.room_id).first()
        if room and room.status != "maintenance":
            room.status = "dirty"

    task.updated_at = datetime.utcnow()
    db.commit()
    return {"message": f"Task assigned to {task.assigned_to} as Pending Turnover", "assigned_to": task.assigned_to, "status": "pending"}


@router.delete("/housekeeping/tasks/{task_id}")
def delete_housekeeping_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    deleted_by = current_user.full_name or current_user.username or "Housekeeping HOD"
    task.status = "archived"
    archive_note = f"[Soft-Deleted / Archived by {deleted_by} at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC]"
    task.notes = f"{task.notes or ''}\n{archive_note}".strip()
    task.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Task soft-deleted and moved to Deleted section", "id": task.id, "status": "archived"}


@router.post("/housekeeping/tasks/{task_id}/restore")
def restore_housekeeping_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    restored_by = current_user.full_name or current_user.username or "Housekeeping HOD"
    task.status = "completed"
    restore_note = f"[Restored by {restored_by} at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC]"
    task.notes = f"{task.notes or ''}\n{restore_note}".strip()
    task.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Task restored to Completed section", "id": task.id, "status": "completed"}


@router.post("/housekeeping/tasks/{task_id}/inspect")
def inspect_task(
    task_id: int,
    payload: TaskInspectionPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Housekeeping task not found")

    inspector_name = current_user.full_name or current_user.username or "Housekeeping HOD"
    act = (payload.action or "").lower().strip()

    now_iso = _to_utc_iso(datetime.utcnow())
    if act == "pass":
        task.status = "completed"
        task.completed_at = datetime.utcnow()
        task.completed_by = inspector_name
        task.updated_at = datetime.utcnow()
        inspection_note = f"[Inspection PASSED by {inspector_name} at {now_iso}]: Room ready for guest."
        if payload.notes:
            inspection_note += f" Remarks: {payload.notes}"
        task.notes = f"{task.notes or ''}\n{inspection_note}".strip()

        # Clean up any other open tasks for this room and ensure room is available
        if task.room_id:
            db.query(models.HousekeepingTask).filter(
                models.HousekeepingTask.room_id == task.room_id,
                models.HousekeepingTask.id != task.id,
                models.HousekeepingTask.status.in_(["pending", "assigned", "in-progress"]),
            ).delete(synchronize_session=False)

            room = db.query(models.Room).filter(models.Room.id == task.room_id).first()
            if room:
                room.status = "available"

        db.commit()
        return {
            "message": "Inspection passed. Room is now Ready.",
            "status": "completed",
            "room_status": "available",
            "task_id": task.id,
        }

    elif act == "fail":
        task.status = "pending"
        task.updated_at = datetime.utcnow()
        inspection_note = f"[Inspection FAILED by {inspector_name} at {now_iso}]: Moved to Dirty / Departed for turnover."
        if payload.notes:
            inspection_note += f" Reason: {payload.notes}"
        task.notes = f"{task.notes or ''}\n{inspection_note}".strip()

        # Room goes back to dirty
        if task.room_id:
            room = db.query(models.Room).filter(models.Room.id == task.room_id).first()
            if room:
                room.status = "dirty"

        db.commit()
        return {
            "message": "Inspection failed. Room returned to Dirty / Departed.",
            "status": "pending",
            "room_status": "dirty",
            "task_id": task.id,
        }

    else:
        raise HTTPException(status_code=400, detail="Action must be 'pass' or 'fail'")


@router.post("/housekeeping/tasks/{task_id}/claim")
def claim_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.HousekeepingTask).filter(models.HousekeepingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Housekeeping task not found")

    staff = None
    if getattr(current_user, "staff_id", None):
        staff = db.query(models.Staff).filter(models.Staff.id == current_user.staff_id).first()
    if not staff and current_user.full_name:
        staff = db.query(models.Staff).filter(
            models.Staff.hotel_id == task.hotel_id,
            models.Staff.full_name.ilike(current_user.full_name),
        ).first()

    staff_id = staff.id if staff else None
    staff_name = staff.full_name if staff else (current_user.full_name or current_user.username)

    task.assigned_staff_id = staff_id
    task.assigned_to = staff_name
    task.status = "assigned"
    task.updated_at = datetime.utcnow()
    db.commit()

    return {
        "message": f"Task claimed by {staff_name}",
        "assigned_to": staff_name,
        "assigned_staff_id": staff_id,
        "status": "assigned",
    }