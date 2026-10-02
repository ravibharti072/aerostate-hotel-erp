from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import (
    require_super_admin,
    require_hotel_admin_or_manager,
    require_accountant,
    require_front_desk,
    require_inventory_user,
)
from app.services.system_service import SystemService

router = APIRouter(
    tags=["System & Admin Utilities"]
)


class GoLiveUpdate(BaseModel):
    go_live_date: str  # Expected format: YYYY-MM-DD


class HotelUpdatePayload(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    tax_number: Optional[str] = None


def get_system_service(db: Session = Depends(get_db)) -> SystemService:
    return SystemService(db)


# -----------------------------
# SETUP SUPER ADMIN API
# -----------------------------

@router.post("/setup/create-super-admin", response_model=schemas.UserResponse)
def setup_create_super_admin(
    user: schemas.UserCreate,
    service: SystemService = Depends(get_system_service),
):
    return service.setup_create_super_admin(user)


# -----------------------------
# HOTEL GO-LIVE SETTINGS API
# -----------------------------

@router.put("/system/hotels/{hotel_id}/go-live")
@router.put("/system/hotels/{hotel_id}/go-live/")
def update_hotel_go_live_date(
    hotel_id: int,
    payload: GoLiveUpdate,
    service: SystemService = Depends(get_system_service),
    current_user: models.User = Depends(require_super_admin),
) -> Dict[str, Any]:
    return service.update_hotel_go_live_date(hotel_id, payload.go_live_date)


@router.get("/system/hotels/{hotel_id}/go-live")
@router.get("/system/hotels/{hotel_id}/go-live/")
def get_hotel_go_live_date(
    hotel_id: int,
    service: SystemService = Depends(get_system_service),
) -> Dict[str, Optional[str]]:
    return service.get_hotel_go_live_date(hotel_id)


# -----------------------------
# HOTEL UPDATE API
# -----------------------------

@router.put("/hotels/{hotel_id}")
@router.put("/hotels/{hotel_id}/")
def update_hotel_info(
    hotel_id: int,
    payload: HotelUpdatePayload,
    service: SystemService = Depends(get_system_service),
    current_user: models.User = Depends(require_super_admin),
) -> Dict[str, Any]:
    return service.update_hotel_info(hotel_id, payload.model_dump(exclude_unset=True))


# -----------------------------
# SYSTEM MODULES API
# -----------------------------

@router.get("/modules")
def get_all_system_modules(
    service: SystemService = Depends(get_system_service),
) -> Dict[str, List[Dict[str, str]]]:
    return service.get_all_system_modules()


# -----------------------------
# SYSTEM HEALTH & STATS APIs
# -----------------------------

@router.get("/system/health")
def get_system_health(
    service: SystemService = Depends(get_system_service),
) -> Dict[str, Any]:
    return service.get_system_health()


@router.get("/system/stats")
def get_system_stats(
    service: SystemService = Depends(get_system_service),
    current_user: models.User = Depends(require_super_admin),
) -> Dict[str, Any]:
    return service.get_system_stats()


# -----------------------------
# ROLE PERMISSION TEST APIs
# -----------------------------

@router.get("/protected/super-admin")
def protected_super_admin(current_user: models.User = Depends(require_super_admin)):
    return {
        "message": "Super admin access granted",
        "user_id": current_user.id,
        "role": current_user.role,
    }


@router.get("/protected/hotel-admin-manager")
def protected_hotel_admin_manager(current_user: models.User = Depends(require_hotel_admin_or_manager)):
    return {
        "message": "Hotel admin / manager access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role,
    }


@router.get("/protected/accountant")
def protected_accountant(current_user: models.User = Depends(require_accountant)):
    return {
        "message": "Accountant access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role,
    }


@router.get("/protected/front-desk")
def protected_front_desk(current_user: models.User = Depends(require_front_desk)):
    return {
        "message": "Front desk access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role,
    }


@router.get("/protected/inventory")
def protected_inventory(current_user: models.User = Depends(require_inventory_user)):
    return {
        "message": "Inventory access granted",
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "role": current_user.role,
    }