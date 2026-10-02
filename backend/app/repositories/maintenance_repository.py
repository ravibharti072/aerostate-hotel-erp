from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class MaintenanceRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Maintenance Requests
    # -------------------------------------------------------------

    def get_by_id(self, request_id: int) -> Optional[models.MaintenanceRequest]:
        return (
            self.db.query(models.MaintenanceRequest)
            .filter(models.MaintenanceRequest.id == request_id)
            .first()
        )

    def list_requests(
        self,
        hotel_id: Optional[int] = None,
        room_id: Optional[int] = None,
        assigned_staff_id: Optional[int] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        source: Optional[str] = None,
        category: Optional[str] = None,
        asset_id: Optional[int] = None,
    ) -> List[models.MaintenanceRequest]:
        query = self.db.query(models.MaintenanceRequest)

        if hotel_id is not None:
            query = query.filter(models.MaintenanceRequest.hotel_id == hotel_id)
        if room_id is not None:
            query = query.filter(models.MaintenanceRequest.room_id == room_id)
        if assigned_staff_id is not None:
            query = query.filter(models.MaintenanceRequest.assigned_staff_id == assigned_staff_id)
        if priority is not None:
            query = query.filter(models.MaintenanceRequest.priority == priority)
        if status is not None:
            query = query.filter(models.MaintenanceRequest.status == status)
        if source is not None:
            query = query.filter(models.MaintenanceRequest.source == source)
        if category is not None:
            query = query.filter(models.MaintenanceRequest.category == category)
        if asset_id is not None:
            query = query.filter(models.MaintenanceRequest.asset_id == asset_id)

        return query.order_by(models.MaintenanceRequest.id.desc()).all()

    def create_request(
        self,
        request_data: Dict[str, Any],
        room: Optional[models.Room] = None,
        blocks_room: bool = False,
    ) -> models.MaintenanceRequest:
        new_request = models.MaintenanceRequest(**request_data)

        # Only block room if blocks_room is True and guest is not actively occupying
        if room and blocks_room:
            active_stay = self.get_active_booking_for_room(room.id, room.hotel_id)
            if not active_stay:
                room.status = "maintenance"

        self.db.add(new_request)
        self.db.commit()
        self.db.refresh(new_request)
        return new_request

    def update_request(
        self,
        maintenance_request: models.MaintenanceRequest,
        update_fields: Dict[str, Any],
        room: Optional[models.Room] = None,
        target_status: Optional[str] = None,
    ) -> models.MaintenanceRequest:
        for key, value in update_fields.items():
            setattr(maintenance_request, key, value)

        # Handle safe room release or blocking
        if room:
            is_blocking = update_fields.get("blocks_room", maintenance_request.blocks_room)
            new_req_status = target_status or maintenance_request.status

            if new_req_status in ["open", "assigned", "in-progress"] and is_blocking:
                active_stay = self.get_active_booking_for_room(room.id, room.hotel_id)
                if not active_stay:
                    room.status = "maintenance"

            elif new_req_status in ["completed", "verified", "closed", "cancelled"]:
                if room.status == "maintenance":
                    other_blocking_requests = (
                        self.db.query(models.MaintenanceRequest)
                        .filter(
                            models.MaintenanceRequest.room_id == room.id,
                            models.MaintenanceRequest.id != maintenance_request.id,
                            models.MaintenanceRequest.blocks_room == True,
                            models.MaintenanceRequest.status.in_(["open", "assigned", "in-progress"]),
                        )
                        .first()
                    )

                    if not other_blocking_requests:
                        active_stay = self.get_active_booking_for_room(room.id, room.hotel_id)
                        if active_stay:
                            room.status = "occupied"
                        else:
                            active_hk = (
                                self.db.query(models.HousekeepingTask)
                                .filter(
                                    models.HousekeepingTask.room_id == room.id,
                                    models.HousekeepingTask.status.in_(["pending", "assigned", "in-progress", "inspection-required"]),
                                )
                                .first()
                            )
                            if active_hk:
                                room.status = "cleaning" if active_hk.status == "in-progress" else "dirty"
                            else:
                                room.status = "available"

        self.db.commit()
        self.db.refresh(maintenance_request)
        return maintenance_request

    def delete_request(self, maintenance_request: models.MaintenanceRequest) -> None:
        self.db.delete(maintenance_request)
        self.db.commit()

    # -------------------------------------------------------------
    # Cross-Domain Lookups
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_room_by_id(self, room_id: int, hotel_id: int) -> Optional[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(
                models.Room.id == room_id,
                models.Room.hotel_id == hotel_id,
            )
            .first()
        )

    def get_staff_by_id(self, staff_id: int, hotel_id: int) -> Optional[models.Staff]:
        return (
            self.db.query(models.Staff)
            .filter(
                models.Staff.id == staff_id,
                models.Staff.hotel_id == hotel_id,
            )
            .first()
        )

    def get_asset_by_id(self, asset_id: int, hotel_id: int) -> Optional[models.MaintenanceAsset]:
        return (
            self.db.query(models.MaintenanceAsset)
            .filter(
                models.MaintenanceAsset.id == asset_id,
                models.MaintenanceAsset.hotel_id == hotel_id,
            )
            .first()
        )

    def get_booking_by_id(self, booking_id: int, hotel_id: int) -> Optional[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.id == booking_id,
                models.Booking.hotel_id == hotel_id,
            )
            .first()
        )

    def get_active_booking_for_room(self, room_id: int, hotel_id: int) -> Optional[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.room_id == room_id,
                models.Booking.hotel_id == hotel_id,
                models.Booking.status.in_(["checked_in", "checked-in", "occupied"]),
            )
            .first()
        )