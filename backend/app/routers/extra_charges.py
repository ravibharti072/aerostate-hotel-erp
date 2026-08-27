from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(
    prefix="/extra-charges",
    tags=["Extra Charges"]
)

@router.post("/", response_model=schemas.ExtraChargeResponse)
def create_extra_charge(
    charge: schemas.ExtraChargeCreate,
    db: Session = Depends(get_db)
):
    hotel = db.query(models.Hotel).filter(models.Hotel.id == charge.hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    booking = db.query(models.Booking).filter(
        models.Booking.id == charge.booking_id,
        models.Booking.hotel_id == charge.hotel_id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for this hotel")

    if charge.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    if charge.rate < 0:
        raise HTTPException(status_code=400, detail="Rate cannot be negative")

    total_amount = charge.quantity * charge.rate

    new_charge = models.ExtraCharge(
        hotel_id=charge.hotel_id,
        booking_id=booking.id,
        guest_id=booking.guest_id,
        room_id=booking.room_id,
        charge_name=charge.charge_name,
        quantity=charge.quantity,
        rate=charge.rate,
        total_amount=total_amount,
        description=charge.description,
        status=charge.status
    )

    db.add(new_charge)
    db.commit()
    db.refresh(new_charge)

    return new_charge


@router.get("/", response_model=list[schemas.ExtraChargeResponse])
def get_extra_charges(db: Session = Depends(get_db)):
    return db.query(models.ExtraCharge).order_by(models.ExtraCharge.id.desc()).all()


@router.get("/{charge_id}", response_model=schemas.ExtraChargeResponse)
def get_extra_charge(
    charge_id: int,
    db: Session = Depends(get_db)
):
    charge = db.query(models.ExtraCharge).filter(models.ExtraCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Extra charge not found")

    return charge


@router.put("/{charge_id}", response_model=schemas.ExtraChargeResponse)
def update_extra_charge(
    charge_id: int,
    charge_data: schemas.ExtraChargeUpdate,
    db: Session = Depends(get_db)
):
    charge = db.query(models.ExtraCharge).filter(models.ExtraCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Extra charge not found")

    update_data = charge_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(charge, field, value)

    if charge.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    if charge.rate < 0:
        raise HTTPException(status_code=400, detail="Rate cannot be negative")

    charge.total_amount = charge.quantity * charge.rate

    db.commit()
    db.refresh(charge)

    return charge


@router.delete("/{charge_id}")
def delete_extra_charge(
    charge_id: int,
    db: Session = Depends(get_db)
):
    charge = db.query(models.ExtraCharge).filter(models.ExtraCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Extra charge not found")

    db.delete(charge)
    db.commit()

    return {"message": "Extra charge deleted successfully"}