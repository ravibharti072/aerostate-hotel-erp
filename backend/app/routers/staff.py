from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.staff_service import StaffService

router = APIRouter(
    tags=["Staff & HR"]
)


def get_staff_service(db: Session = Depends(get_db)) -> StaffService:
    return StaffService(db)


# -----------------------------
# STAFF APIs
# -----------------------------

@router.post("/staff", response_model=schemas.StaffResponse)
def create_staff(
    staff: schemas.StaffCreate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_staff(staff, current_user)


@router.get("/staff", response_model=List[schemas.StaffResponse])
def get_staff_members(
    hotel_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_members(hotel_id, department, status, current_user)


@router.get("/staff/unassigned-users", response_model=List[schemas.StaffWithPortalAccessResponse])
def get_staff_unassigned_users(
    hotel_id: Optional[int] = Query(None),
    unassigned_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from app.services.user_service import UserService
    return UserService(db).get_staff_portal_status(hotel_id, unassigned_only, current_user)


@router.get("/staff/active-department-head")
def check_department_head(
    department: str = Query(...),
    hotel_id: Optional[int] = Query(None),
    exclude_staff_id: Optional[int] = Query(None),
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.check_department_head(department, hotel_id, current_user, exclude_staff_id)


@router.get("/staff/{staff_id}", response_model=schemas.StaffResponse)
def get_staff(
    staff_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff(staff_id, current_user)


@router.put("/staff/{staff_id}", response_model=schemas.StaffResponse)
def update_staff(
    staff_id: int,
    staff_update: schemas.StaffUpdate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_staff(staff_id, staff_update, current_user)


@router.delete("/staff/{staff_id}")
def delete_staff(
    staff_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_staff(staff_id, current_user)


# -----------------------------
# STAFF ATTENDANCE APIs
# -----------------------------

@router.post("/staff-attendance", response_model=schemas.StaffAttendanceResponse)
def create_staff_attendance(
    attendance: schemas.StaffAttendanceCreate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_staff_attendance(attendance, current_user)


@router.get("/staff-attendance", response_model=List[schemas.StaffAttendanceResponse])
def get_staff_attendance_records(
    hotel_id: Optional[int] = Query(None),
    staff_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_attendance_records(hotel_id, staff_id, status, current_user)


@router.get("/staff-attendance/{attendance_id}", response_model=schemas.StaffAttendanceResponse)
def get_staff_attendance(
    attendance_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_attendance(attendance_id, current_user)


@router.put("/staff-attendance/{attendance_id}", response_model=schemas.StaffAttendanceResponse)
def update_staff_attendance(
    attendance_id: int,
    attendance_update: schemas.StaffAttendanceUpdate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_staff_attendance(attendance_id, attendance_update, current_user)


@router.delete("/staff-attendance/{attendance_id}")
def delete_staff_attendance(
    attendance_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_staff_attendance(attendance_id, current_user)


# -----------------------------
# STAFF SALARY / PAYROLL APIs
# -----------------------------

@router.post("/staff-salaries", response_model=schemas.StaffSalaryResponse)
def create_staff_salary(
    salary: schemas.StaffSalaryCreate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_staff_salary(salary, current_user)


@router.get("/staff-salaries", response_model=List[schemas.StaffSalaryResponse])
def get_staff_salaries(
    hotel_id: Optional[int] = Query(None),
    staff_id: Optional[int] = Query(None),
    salary_month: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_salaries(hotel_id, staff_id, salary_month, payment_status, current_user)


@router.get("/staff-salaries/{salary_id}", response_model=schemas.StaffSalaryResponse)
def get_staff_salary(
    salary_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_salary(salary_id, current_user)


@router.put("/staff-salaries/{salary_id}", response_model=schemas.StaffSalaryResponse)
def update_staff_salary(
    salary_id: int,
    salary_update: schemas.StaffSalaryUpdate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_staff_salary(salary_id, salary_update, current_user)


@router.delete("/staff-salaries/{salary_id}")
def delete_staff_salary(
    salary_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_staff_salary(salary_id, current_user)


# -----------------------------
# STAFF LEAVE APIs
# -----------------------------

@router.post("/staff-leaves", response_model=schemas.StaffLeaveResponse)
def create_staff_leave(
    leave: schemas.StaffLeaveCreate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_staff_leave(leave, current_user)


@router.get("/staff-leaves", response_model=List[schemas.StaffLeaveResponse])
def get_staff_leaves(
    hotel_id: Optional[int] = Query(None),
    staff_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    leave_type: Optional[str] = Query(None),
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_leaves(hotel_id, staff_id, status, leave_type, current_user)


@router.get("/staff-leaves/{leave_id}", response_model=schemas.StaffLeaveResponse)
def get_staff_leave(
    leave_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_leave(leave_id, current_user)


@router.put("/staff-leaves/{leave_id}", response_model=schemas.StaffLeaveResponse)
def update_staff_leave(
    leave_id: int,
    leave_update: schemas.StaffLeaveUpdate,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_staff_leave(leave_id, leave_update, current_user)


@router.delete("/staff-leaves/{leave_id}")
def delete_staff_leave(
    leave_id: int,
    service: StaffService = Depends(get_staff_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_staff_leave(leave_id, current_user)