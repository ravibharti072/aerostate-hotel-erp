from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class ExtraChargeRepository:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------------
    # Catalog Operations
    # ------------------------------------------------------------------------

    def get_catalog_service_by_name(self, hotel_id: int, name: str) -> Optional[models.ExtraServiceCatalog]:
        return (
            self.db.query(models.ExtraServiceCatalog)
            .filter(
                models.ExtraServiceCatalog.hotel_id == hotel_id,
                models.ExtraServiceCatalog.name.ilike(name),
            )
            .first()
        )

    def get_catalog_service_by_id(self, service_id: int) -> Optional[models.ExtraServiceCatalog]:
        return (
            self.db.query(models.ExtraServiceCatalog)
            .filter(models.ExtraServiceCatalog.id == service_id)
            .first()
        )

    def list_catalog_services(self, hotel_id: int, include_inactive: bool = False) -> List[models.ExtraServiceCatalog]:
        query = self.db.query(models.ExtraServiceCatalog).filter(
            models.ExtraServiceCatalog.hotel_id == hotel_id
        )
        if not include_inactive:
            query = query.filter(models.ExtraServiceCatalog.is_active == True)
        return query.order_by(models.ExtraServiceCatalog.name.asc()).all()

    def create_catalog_service(self, service_data: Dict[str, Any]) -> models.ExtraServiceCatalog:
        catalog_item = models.ExtraServiceCatalog(**service_data)
        self.db.add(catalog_item)
        self.db.commit()
        self.db.refresh(catalog_item)
        return catalog_item

    def update_catalog_service(
        self,
        service: models.ExtraServiceCatalog,
        update_data: Dict[str, Any],
    ) -> models.ExtraServiceCatalog:
        for key, value in update_data.items():
            setattr(service, key, value)
        self.db.commit()
        self.db.refresh(service)
        return service

    def delete_catalog_service(self, service: models.ExtraServiceCatalog) -> None:
        self.db.delete(service)
        self.db.commit()

    # ------------------------------------------------------------------------
    # Extra Charge Operations
    # ------------------------------------------------------------------------

    def get_charge_by_id(self, charge_id: int) -> Optional[models.ExtraCharge]:
        return self.db.query(models.ExtraCharge).filter(models.ExtraCharge.id == charge_id).first()

    def list_charges(self, hotel_id: Optional[int] = None) -> List[models.ExtraCharge]:
        query = self.db.query(models.ExtraCharge)
        if hotel_id is not None:
            query = query.filter(models.ExtraCharge.hotel_id == hotel_id)
        return query.order_by(models.ExtraCharge.id.desc()).all()

    def create_charge(self, charge_data: Dict[str, Any]) -> models.ExtraCharge:
        new_charge = models.ExtraCharge(**charge_data)
        self.db.add(new_charge)
        self.db.commit()
        self.db.refresh(new_charge)
        return new_charge

    def update_charge(
        self,
        charge: models.ExtraCharge,
        update_fields: Dict[str, Any],
    ) -> models.ExtraCharge:
        for key, value in update_fields.items():
            setattr(charge, key, value)
        self.db.commit()
        self.db.refresh(charge)
        return charge

    def delete_charge(self, charge: models.ExtraCharge) -> None:
        self.db.delete(charge)
        self.db.commit()

    # ------------------------------------------------------------------------
    # External Model Lookups (Hotels & Bookings)
    # ------------------------------------------------------------------------

    def get_first_hotel(self) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).first()

    def get_booking_for_hotel(self, booking_id: int, hotel_id: int) -> Optional[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.id == booking_id,
                models.Booking.hotel_id == hotel_id,
            )
            .first()
        )