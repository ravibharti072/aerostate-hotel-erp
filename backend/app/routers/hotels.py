from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user, require_super_admin

router = APIRouter(
    prefix="/hotels",
    tags=["Hotels"]
)

class HotelModulesUpdate(BaseModel):
    modules: list[str]


@router.post("/", response_model=schemas.HotelResponse)
def create_hotel(
    hotel: schemas.HotelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin)
):
    existing_hotel = db.query(models.Hotel).filter(
        models.Hotel.email == hotel.email
    ).first()

    if existing_hotel:
        raise HTTPException(
            status_code=400,
            detail="Hotel with this email already exists"
        )

    new_hotel = models.Hotel(**hotel.model_dump())

    db.add(new_hotel)
    db.commit()
    db.refresh(new_hotel)

    return new_hotel


@router.get("/", response_model=list[schemas.HotelResponse])
def get_hotels(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin)
):
    hotels = db.query(models.Hotel).order_by(models.Hotel.id.desc()).all()

    return hotels


@router.get("/{hotel_id}", response_model=schemas.HotelResponse)
def get_hotel(
    hotel_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    if current_user.role == "super-admin":
        return hotel

    if current_user.hotel_id != hotel_id:
        raise HTTPException(
            status_code=403,
            detail="You can view only your own hotel"
        )

    return hotel


@router.get("/{hotel_id}/modules")
def get_hotel_modules(
    hotel_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    # FIX: Changed assigned_modules to modules to match models.py
    return {"modules": getattr(hotel, "modules", []) or []}


@router.put("/{hotel_id}/modules")
def update_hotel_modules(
    hotel_id: int,
    data: HotelModulesUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin)
):
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    # FIX: Changed assigned_modules to modules to match models.py
    hotel.modules = data.modules
    db.commit()
    db.refresh(hotel)
    
    return {
        "message": "Module permissions updated successfully",
        "modules": hotel.modules
    }