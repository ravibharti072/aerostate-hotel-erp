from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.user_service import UserService

router = APIRouter(
    tags=["Users & Auth"]
)


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(db)


# -----------------------------
# AUTH / USER REGISTRATION
# -----------------------------

@router.post("/auth/register-user", response_model=schemas.UserResponse)
def register_user(
    user: schemas.UserCreate,
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.register_user(user, current_user)


@router.post("/auth/login", response_model=schemas.LoginResponse)
def login_user(
    login_data: schemas.LoginRequest,
    service: UserService = Depends(get_user_service),
):
    return service.login_user(login_data)


@router.get("/auth/me", response_model=schemas.CurrentUserResponse)
def get_logged_in_user(
    current_user: models.User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    return service.get_current_user_profile(current_user)


@router.post("/auth/change-password-first-login")
def change_password_first_login(
    payload: schemas.ChangePasswordFirstLoginRequest,
    current_user: models.User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    return service.change_password_first_login(payload, current_user)


# -----------------------------
# USER MANAGEMENT APIs
# -----------------------------

@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(
    hotel_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_users(hotel_id, role, is_active, current_user)


@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_user(user_id, current_user)


@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_user(user_id, user_update, current_user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_user(user_id, current_user)


# -----------------------------
# EMPLOYEE PORTAL ACCESS APIs
# -----------------------------

@router.get("/staff/unassigned-users", response_model=List[schemas.StaffWithPortalAccessResponse])
def get_staff_unassigned_users(
    hotel_id: Optional[int] = Query(None),
    unassigned_only: bool = Query(False),
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_staff_portal_status(hotel_id, unassigned_only, current_user)


@router.post("/auth/create-employee-portal-access", response_model=schemas.UserResponse)
def create_employee_portal_access(
    payload: schemas.EmployeePortalAccessCreate,
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_employee_portal_access(payload, current_user)


@router.put("/users/{user_id}/portals", response_model=schemas.UserResponse)
def update_user_portals(
    user_id: int,
    payload: schemas.UserPortalsUpdate,
    service: UserService = Depends(get_user_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_user_portals(user_id, payload, current_user)