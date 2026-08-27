from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/maintenance-requests",
    tags=["Maintenance"]
)

@router.post("/", response_model=schemas.MaintenanceRequestResponse)
def create_maintenance_request(
    request: schemas.MaintenanceRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "maintenance", "housekeeping", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only maintenance, housekeeping, front-desk, hotel-admin, manager, or super-admin can create maintenance requests"
        )

    if current_user.role != "super-admin":
        if request.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create maintenance requests only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == request.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    if request.room_id:
        room = db.query(models.Room).filter(
            models.Room.id == request.room_id,
            models.Room.hotel_id == request.hotel_id
        ).first()

        if not room:
            raise HTTPException(
                status_code=404,
                detail="Room not found for this hotel"
            )

    if request.assigned_staff_id:
        staff = db.query(models.Staff).filter(
            models.Staff.id == request.assigned_staff_id,
            models.Staff.hotel_id == request.hotel_id
        ).first()

        if not staff:
            raise HTTPException(
                status_code=404,
                detail="Assigned staff not found for this hotel"
            )

    allowed_priorities = ["low", "medium", "high", "urgent"]
    allowed_statuses = ["open", "assigned", "in-progress", "completed", "cancelled"]

    if request.priority not in allowed_priorities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority. Allowed priorities are: {allowed_priorities}"
        )

    if request.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {allowed_statuses}"
        )

    if request.estimated_cost < 0:
        raise HTTPException(
            status_code=400,
            detail="Estimated cost cannot be negative"
        )

    if request.actual_cost < 0:
        raise HTTPException(
            status_code=400,
            detail="Actual cost cannot be negative"
        )

    if request.completed_date and request.start_date:
        if request.completed_date < request.start_date:
            raise HTTPException(
                status_code=400,
                detail="Completed date cannot be before start date"
            )

    new_request = models.MaintenanceRequest(**request.model_dump())

    if request.room_id and request.status in ["open", "assigned", "in-progress"]:
        room = db.query(models.Room).filter(
            models.Room.id == request.room_id,
            models.Room.hotel_id == request.hotel_id
        ).first()

        if room:
            room.status = "maintenance"

    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return new_request


@router.get("/", response_model=list[schemas.MaintenanceRequestResponse])
def get_maintenance_requests(
    hotel_id: Optional[int] = None,
    room_id: Optional[int] = None,
    assigned_staff_id: Optional[int] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.MaintenanceRequest)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.MaintenanceRequest.hotel_id == hotel_id)
    else:
        query = query.filter(models.MaintenanceRequest.hotel_id == current_user.hotel_id)

    if room_id:
        query = query.filter(models.MaintenanceRequest.room_id == room_id)

    if assigned_staff_id:
        query = query.filter(models.MaintenanceRequest.assigned_staff_id == assigned_staff_id)

    if priority:
        query = query.filter(models.MaintenanceRequest.priority == priority)

    if status:
        query = query.filter(models.MaintenanceRequest.status == status)

    requests = query.order_by(models.MaintenanceRequest.id.desc()).all()

    return requests


@router.get("/{request_id}", response_model=schemas.MaintenanceRequestResponse)
def get_maintenance_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    maintenance_request = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.id == request_id
    ).first()

    if not maintenance_request:
        raise HTTPException(
            status_code=404,
            detail="Maintenance request not found"
        )

    if current_user.role != "super-admin":
        if maintenance_request.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only maintenance requests from your own hotel"
            )

    return maintenance_request


@router.put("/{request_id}", response_model=schemas.MaintenanceRequestResponse)
def update_maintenance_request(
    request_id: int,
    request_update: schemas.MaintenanceRequestUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "maintenance"]:
        raise HTTPException(
            status_code=403,
            detail="Only maintenance, hotel-admin, manager, or super-admin can update maintenance requests"
        )

    maintenance_request = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.id == request_id
    ).first()

    if not maintenance_request:
        raise HTTPException(
            status_code=404,
            detail="Maintenance request not found"
        )

    if current_user.role != "super-admin":
        if maintenance_request.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only maintenance requests from your own hotel"
            )

    update_data = request_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move maintenance request to another hotel"
            )

    allowed_priorities = ["low", "medium", "high", "urgent"]
    allowed_statuses = ["open", "assigned", "in-progress", "completed", "cancelled"]

    if "priority" in update_data and update_data["priority"] not in allowed_priorities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority. Allowed priorities are: {allowed_priorities}"
        )

    if "status" in update_data and update_data["status"] not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {allowed_statuses}"
        )

    if "estimated_cost" in update_data and update_data["estimated_cost"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Estimated cost cannot be negative"
        )

    if "actual_cost" in update_data and update_data["actual_cost"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Actual cost cannot be negative"
        )

    check_hotel_id = update_data.get("hotel_id", maintenance_request.hotel_id)

    if "room_id" in update_data and update_data["room_id"]:
        room = db.query(models.Room).filter(
            models.Room.id == update_data["room_id"],
            models.Room.hotel_id == check_hotel_id
        ).first()

        if not room:
            raise HTTPException(
                status_code=404,
                detail="Room not found for this hotel"
            )

    if "assigned_staff_id" in update_data and update_data["assigned_staff_id"]:
        staff = db.query(models.Staff).filter(
            models.Staff.id == update_data["assigned_staff_id"],
            models.Staff.hotel_id == check_hotel_id
        ).first()

        if not staff:
            raise HTTPException(
                status_code=404,
                detail="Assigned staff not found for this hotel"
            )

    for key, value in update_data.items():
        setattr(maintenance_request, key, value)

    if maintenance_request.completed_date and maintenance_request.start_date:
        if maintenance_request.completed_date < maintenance_request.start_date:
            raise HTTPException(
                status_code=400,
                detail="Completed date cannot be before start date"
            )

    if maintenance_request.room_id:
        room = db.query(models.Room).filter(
            models.Room.id == maintenance_request.room_id,
            models.Room.hotel_id == maintenance_request.hotel_id
        ).first()

        if room:
            if maintenance_request.status in ["open", "assigned", "in-progress"]:
                room.status = "maintenance"
            elif maintenance_request.status == "completed":
                room.status = "available"

    db.commit()
    db.refresh(maintenance_request)

    return maintenance_request


@router.delete("/{request_id}")
def delete_maintenance_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager, or super-admin can delete maintenance requests"
        )

    maintenance_request = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.id == request_id
    ).first()

    if not maintenance_request:
        raise HTTPException(
            status_code=404,
            detail="Maintenance request not found"
        )

    if current_user.role != "super-admin":
        if maintenance_request.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only maintenance requests from your own hotel"
            )

    db.delete(maintenance_request)
    db.commit()

    return {
        "message": "Maintenance request deleted successfully"
    }