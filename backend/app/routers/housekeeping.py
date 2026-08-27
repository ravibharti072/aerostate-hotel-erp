from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    tags=["Housekeeping"]
)

HOUSEKEEPING_ALLOWED_ROLES = [
    "super-admin",
    "hotel-admin",
    "manager",
    "housekeeping",
    "maintenance",
    "front-desk"
]

ROOM_ALLOWED_STATUSES = [
    "available",
    "reserved",
    "occupied",
    "dirty",
    "cleaning",
    "maintenance",
    "out-of-service"
]

HOUSEKEEPING_TASK_TYPES = [
    "room-cleaning",
    "checkout-cleaning",
    "inspection",
    "laundry",
    "minibar",
    "maintenance-report",
    "other"
]

HOUSEKEEPING_PRIORITIES = [
    "low",
    "medium",
    "high",
    "urgent"
]

HOUSEKEEPING_TASK_STATUSES = [
    "pending",
    "in-progress",
    "completed",
    "cancelled"
]

def check_housekeeping_access(current_user: models.User):
    if current_user.role not in HOUSEKEEPING_ALLOWED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Only housekeeping, maintenance, front-desk, hotel-admin, manager, or super-admin can access housekeeping"
        )

def check_same_hotel_or_super_admin(hotel_id: int, current_user: models.User):
    if current_user.role != "super-admin":
        if hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can access only your own hotel data"
            )


@router.put("/rooms/{room_id}/status", response_model=schemas.RoomResponse)
def update_room_status(
    room_id: int,
    status_update: schemas.RoomStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_housekeeping_access(current_user)

    room = db.query(models.Room).filter(
        models.Room.id == room_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    check_same_hotel_or_super_admin(room.hotel_id, current_user)

    if status_update.status not in ROOM_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {ROOM_ALLOWED_STATUSES}"
        )

    room.status = status_update.status

    db.commit()
    db.refresh(room)

    return room


@router.get("/housekeeping/rooms", response_model=list[schemas.RoomResponse])
def get_housekeeping_rooms(
    hotel_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_housekeeping_access(current_user)

    query = db.query(models.Room)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Room.hotel_id == hotel_id)
    else:
        query = query.filter(models.Room.hotel_id == current_user.hotel_id)

    if status:
        query = query.filter(models.Room.status == status)

    rooms = query.order_by(models.Room.room_number.asc()).all()

    return rooms


@router.post("/housekeeping/tasks", response_model=schemas.HousekeepingTaskResponse)
def create_housekeeping_task(
    task: schemas.HousekeepingTaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_housekeeping_access(current_user)
    check_same_hotel_or_super_admin(task.hotel_id, current_user)

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == task.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    room = db.query(models.Room).filter(
        models.Room.id == task.room_id,
        models.Room.hotel_id == task.hotel_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found for this hotel"
        )

    if task.booking_id:
        booking = db.query(models.Booking).filter(
            models.Booking.id == task.booking_id,
            models.Booking.hotel_id == task.hotel_id,
            models.Booking.room_id == task.room_id
        ).first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail="Booking not found for this room and hotel"
            )

    if task.assigned_staff_id:
        staff = db.query(models.Staff).filter(
            models.Staff.id == task.assigned_staff_id,
            models.Staff.hotel_id == task.hotel_id
        ).first()

        if not staff:
            raise HTTPException(
                status_code=404,
                detail="Assigned staff not found for this hotel"
            )

    if task.task_type not in HOUSEKEEPING_TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task type. Allowed task types are: {HOUSEKEEPING_TASK_TYPES}"
        )

    if task.priority not in HOUSEKEEPING_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority. Allowed priorities are: {HOUSEKEEPING_PRIORITIES}"
        )

    if task.status not in HOUSEKEEPING_TASK_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {HOUSEKEEPING_TASK_STATUSES}"
        )

    new_task = models.HousekeepingTask(
        hotel_id=task.hotel_id,
        room_id=task.room_id,
        booking_id=task.booking_id,
        assigned_staff_id=task.assigned_staff_id,
        task_type=task.task_type,
        priority=task.priority,
        status=task.status,
        assigned_to=task.assigned_to,
        notes=task.notes,
        created_by=task.created_by or current_user.username
    )

    if task.status == "in-progress":
        new_task.started_at = datetime.utcnow()

    if task.status == "completed":
        new_task.completed_at = datetime.utcnow()

    if task.status in ["pending", "in-progress"]:
        if room.status not in ["occupied", "reserved"]:
            room.status = "cleaning"

    if task.status == "completed":
        room.status = "available"

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@router.get("/housekeeping/tasks", response_model=list[schemas.HousekeepingTaskResponse])
def get_housekeeping_tasks(
    hotel_id: Optional[int] = None,
    room_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    task_type: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_housekeeping_access(current_user)

    query = db.query(models.HousekeepingTask)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.HousekeepingTask.hotel_id == hotel_id)
    else:
        query = query.filter(models.HousekeepingTask.hotel_id == current_user.hotel_id)

    if room_id:
        query = query.filter(models.HousekeepingTask.room_id == room_id)

    if booking_id:
        query = query.filter(models.HousekeepingTask.booking_id == booking_id)

    if task_type:
        query = query.filter(models.HousekeepingTask.task_type == task_type)

    if priority:
        query = query.filter(models.HousekeepingTask.priority == priority)

    if status:
        query = query.filter(models.HousekeepingTask.status == status)

    tasks = query.order_by(models.HousekeepingTask.id.desc()).all()

    return tasks


@router.get("/housekeeping/tasks/{task_id}", response_model=schemas.HousekeepingTaskResponse)
def get_housekeeping_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_housekeeping_access(current_user)

    task = db.query(models.HousekeepingTask).filter(
        models.HousekeepingTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Housekeeping task not found"
        )

    check_same_hotel_or_super_admin(task.hotel_id, current_user)

    return task


@router.put("/housekeeping/tasks/{task_id}", response_model=schemas.HousekeepingTaskResponse)
def update_housekeeping_task(
    task_id: int,
    task_update: schemas.HousekeepingTaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_housekeeping_access(current_user)

    task = db.query(models.HousekeepingTask).filter(
        models.HousekeepingTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Housekeeping task not found"
        )

    check_same_hotel_or_super_admin(task.hotel_id, current_user)

    update_data = task_update.model_dump(exclude_unset=True)

    final_hotel_id = task.hotel_id
    final_room_id = update_data.get("room_id", task.room_id)
    final_booking_id = update_data.get("booking_id", task.booking_id)
    final_staff_id = update_data.get("assigned_staff_id", task.assigned_staff_id)

    room = db.query(models.Room).filter(
        models.Room.id == final_room_id,
        models.Room.hotel_id == final_hotel_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found for this hotel"
        )

    if final_booking_id:
        booking = db.query(models.Booking).filter(
            models.Booking.id == final_booking_id,
            models.Booking.hotel_id == final_hotel_id,
            models.Booking.room_id == final_room_id
        ).first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail="Booking not found for this room and hotel"
            )

    if final_staff_id:
        staff = db.query(models.Staff).filter(
            models.Staff.id == final_staff_id,
            models.Staff.hotel_id == final_hotel_id
        ).first()

        if not staff:
            raise HTTPException(
                status_code=404,
                detail="Assigned staff not found for this hotel"
            )

    if "task_type" in update_data and update_data["task_type"] not in HOUSEKEEPING_TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task type. Allowed task types are: {HOUSEKEEPING_TASK_TYPES}"
        )

    if "priority" in update_data and update_data["priority"] not in HOUSEKEEPING_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority. Allowed priorities are: {HOUSEKEEPING_PRIORITIES}"
        )

    if "status" in update_data and update_data["status"] not in HOUSEKEEPING_TASK_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {HOUSEKEEPING_TASK_STATUSES}"
        )

    old_status = task.status

    for key, value in update_data.items():
        setattr(task, key, value)

    task.updated_at = datetime.utcnow()

    if old_status != task.status:
        if task.status == "in-progress":
            task.started_at = datetime.utcnow()
            room.status = "cleaning"

        elif task.status == "completed":
            task.completed_at = datetime.utcnow()
            room.status = "available"

        elif task.status == "pending":
            if room.status not in ["occupied", "reserved"]:
                room.status = "cleaning"

    db.commit()
    db.refresh(task)

    return task


@router.patch("/housekeeping/tasks/{task_id}/status", response_model=schemas.HousekeepingTaskResponse)
def update_housekeeping_task_status(
    task_id: int,
    status_update: schemas.HousekeepingTaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_housekeeping_access(current_user)

    task = db.query(models.HousekeepingTask).filter(
        models.HousekeepingTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Housekeeping task not found"
        )

    check_same_hotel_or_super_admin(task.hotel_id, current_user)

    if status_update.status not in HOUSEKEEPING_TASK_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {HOUSEKEEPING_TASK_STATUSES}"
        )

    room = db.query(models.Room).filter(
        models.Room.id == task.room_id,
        models.Room.hotel_id == task.hotel_id
    ).first()

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    task.status = status_update.status
    task.updated_at = datetime.utcnow()

    if status_update.status == "in-progress":
        task.started_at = datetime.utcnow()
        room.status = "cleaning"

    elif status_update.status == "completed":
        task.completed_at = datetime.utcnow()
        room.status = "available"

    elif status_update.status == "pending":
        if room.status not in ["occupied", "reserved"]:
            room.status = "cleaning"

    db.commit()
    db.refresh(task)

    return task


@router.delete("/housekeeping/tasks/{task_id}")
def delete_housekeeping_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager, or super-admin can delete housekeeping tasks"
        )

    task = db.query(models.HousekeepingTask).filter(
        models.HousekeepingTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Housekeeping task not found"
        )

    check_same_hotel_or_super_admin(task.hotel_id, current_user)

    db.delete(task)
    db.commit()

    return {
        "message": "Housekeeping task deleted successfully"
    }