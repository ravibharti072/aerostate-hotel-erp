from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Department Tasks"])


def get_task_service(db: Session = Depends(get_db)) -> TaskService:
    return TaskService(db)


@router.post("", response_model=schemas.DepartmentTaskResponse)
def create_task(
    payload: schemas.DepartmentTaskCreate,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.create_task(payload, current_user)


@router.post("/convert-from-request/{request_id}", response_model=schemas.DepartmentTaskResponse)
def convert_maintenance_request_to_task(
    request_id: int,
    payload: schemas.DepartmentTicketConvertToTask,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.convert_maintenance_request_to_task(request_id, payload, current_user)


@router.get("/stats", response_model=schemas.DepartmentTaskStatsResponse)
def get_task_stats(
    department: str = Query("maintenance"),
    hotel_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_department_task_stats(department, hotel_id, current_user)


@router.get("/team-overview")
def get_team_overview(
    department: str = Query("maintenance"),
    hotel_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_team_overview(department, hotel_id, current_user)


@router.get("/performance")
def get_department_performance(
    department: str = Query("maintenance"),
    hotel_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_department_performance(department, hotel_id, current_user)


@router.get("", response_model=List[schemas.DepartmentTaskResponse])
def get_tasks(
    department: Optional[str] = Query("maintenance"),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to_staff_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    hotel_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_tasks(
        hotel_id=hotel_id,
        department=department,
        status=status,
        priority=priority,
        assigned_to_staff_id=assigned_to_staff_id,
        search=search,
        current_user=current_user,
    )


# -------------------------------------------------------------
# EMPLOYEE SELF-SERVICE TASK ENDPOINTS
# -------------------------------------------------------------

@router.get("/my-tasks", response_model=List[schemas.DepartmentTaskResponse])
def get_my_tasks(
    status: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_my_tasks(status=status, current_user=current_user)


@router.get("/my-stats")
def get_my_task_stats(
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_my_task_stats(current_user=current_user)


@router.post("/{task_id}/start", response_model=schemas.DepartmentTaskResponse)
def start_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.start_task(task_id, current_user)


@router.post("/{task_id}/complete", response_model=schemas.DepartmentTaskResponse)
def complete_task(
    task_id: int,
    payload: schemas.DepartmentTaskComplete,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.complete_task(task_id, payload, current_user)


@router.get("/{task_id}", response_model=schemas.DepartmentTaskResponse)
def get_task_by_id(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_task_by_id(task_id, current_user)


@router.put("/{task_id}", response_model=schemas.DepartmentTaskResponse)
def update_task(
    task_id: int,
    payload: schemas.DepartmentTaskUpdate,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.update_task(task_id, payload, current_user)


@router.post("/{task_id}/assign", response_model=schemas.DepartmentTaskResponse)
def assign_task(
    task_id: int,
    payload: schemas.DepartmentTaskAssign,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.assign_task(task_id, payload.staff_id, current_user)


@router.post("/{task_id}/verify", response_model=schemas.DepartmentTaskResponse)
def verify_task(
    task_id: int,
    payload: schemas.DepartmentTaskSignOff,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.verify_task(task_id, payload, current_user)


@router.post("/{task_id}/rework", response_model=schemas.DepartmentTaskResponse)
def rework_task(
    task_id: int,
    payload: schemas.DepartmentTaskRework,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.rework_task(task_id, payload, current_user)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.delete_task(task_id, current_user)
