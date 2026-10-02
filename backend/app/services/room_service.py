from datetime import datetime, date
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.room_repository import RoomRepository


class RoomService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = RoomRepository(db)

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    def create_room(self, room: schemas.RoomCreate, current_user: models.User) -> models.Room:
        self._assert_owns_hotel(
            current_user,
            room.hotel_id,
            "You can create rooms only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(room.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        existing_room = self.repo.get_by_room_number(room.hotel_id, room.room_number)
        if existing_room:
            raise HTTPException(
                status_code=400,
                detail="Room number already exists for this hotel",
            )

        return self.repo.create_room(room.model_dump())

    def create_rooms_batch(
        self,
        batch_data: schemas.RoomBatchCreate,
        current_user: models.User,
    ) -> schemas.RoomBatchResponse:
        self._assert_owns_hotel(
            current_user,
            batch_data.hotel_id,
            "You can create rooms only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(batch_data.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        existing_rooms = self.repo.list_rooms_by_hotel(batch_data.hotel_id)
        existing_numbers = {
            str(r.room_number).strip().lower() for r in existing_rooms if r.room_number
        }

        to_create: List[Dict[str, Any]] = []
        skipped_numbers: List[str] = []
        seen_in_batch = set()

        for room in batch_data.rooms:
            r_num = str(room.room_number).strip()
            r_num_lower = r_num.lower()
            if r_num_lower in existing_numbers or r_num_lower in seen_in_batch:
                skipped_numbers.append(r_num)
            else:
                seen_in_batch.add(r_num_lower)
                room_dict = room.model_dump()
                room_dict["hotel_id"] = batch_data.hotel_id
                to_create.append(room_dict)

        created_instances = self.repo.create_rooms_bulk(to_create) if to_create else []

        return schemas.RoomBatchResponse(
            created_count=len(created_instances),
            skipped_count=len(skipped_numbers),
            created_rooms=created_instances,
            skipped_room_numbers=skipped_numbers,
        )

    def get_rooms(
        self,
        hotel_id: Optional[int],
        date_str: Optional[str],
        current_user: models.User,
    ) -> List[models.Room]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        rooms = self.repo.list_rooms_by_hotel(target_hotel_id)

        # 1. Parse target date
        if date_str:
            try:
                target_date = datetime.strptime(date_str.split("T")[0], "%Y-%m-%d").date()
            except Exception:
                target_date = datetime.today().date()
        else:
            target_date = datetime.today().date()

        try:
            # 2. Query active hotel bookings
            all_bookings = self.repo.list_hotel_bookings(target_hotel_id)
            booking_map: Dict[int, str] = {}

            for b in all_bookings:
                raw_ci = getattr(b, "checkin_date", None)
                raw_co = getattr(b, "checkout_date", None)
                b_status = str(getattr(b, "status", "")).lower().strip()

                if not raw_ci:
                    continue

                try:
                    ci_str = str(raw_ci).replace("T", " ").split()[0]
                    ci = datetime.strptime(ci_str, "%Y-%m-%d").date()
                except Exception:
                    continue

                co = None
                if raw_co:
                    try:
                        co_str = str(raw_co).replace("T", " ").split()[0]
                        co = datetime.strptime(co_str, "%Y-%m-%d").date()
                    except Exception:
                        co = None

                room_ids = [b.room_id] if b.room_id else []
                assigned = getattr(b, "assigned_room_ids", [])
                if isinstance(assigned, list):
                    room_ids.extend([r for r in assigned if r])

                # Priority logic: Checked-in guests are actively in the room!
                # Even if target_date >= co (overstay / overdue checkout), they haven't checked out yet.
                if b_status in ["checked_in", "checked-in"]:
                    if target_date >= ci:
                        for r_id in room_ids:
                            booking_map[r_id] = "checked-in"
                elif b_status in ["confirmed", "reserved", "advance", "pending"]:
                    if co and ci <= target_date < co:
                        for r_id in room_ids:
                            if booking_map.get(r_id) not in ["checked_in", "checked-in"]:
                                booking_map[r_id] = b_status

            # 3. Query active housekeeping tasks for this hotel
            active_tasks = (
                self.db.query(models.HousekeepingTask)
                .filter(
                    models.HousekeepingTask.hotel_id == target_hotel_id,
                    models.HousekeepingTask.status.in_(["pending", "assigned", "in-progress", "inspection-required"]),
                )
                .all()
            )
            task_map = {t.room_id: t for t in active_tasks}

            # 4. Compute and stamp real operational status into each room object
            for room in rooms:
                # Priority 1: Persistent maintenance or out-of-service locks
                if room.status in ["maintenance", "out-of-service"]:
                    continue

                b_status = booking_map.get(room.id)
                hk_task = task_map.get(room.id)

                # Priority 2: Checked-in guest currently occupying the room
                if b_status in ["checked_in", "checked-in", "occupied"]:
                    room.status = "occupied"
                # Priority 3: Active Housekeeping turnover or cleaning
                elif hk_task:
                    if hk_task.status in ["in-progress"]:
                        room.status = "cleaning"
                    else:
                        room.status = "dirty"
                # Priority 4: Confirmed upcoming reservation
                elif b_status in ["confirmed", "reserved", "advance", "pending"]:
                    room.status = "reserved"
                # Priority 5: Vacant and clean
                else:
                    room.status = "available"

        except Exception as e:
            print(f"Error calculating unified room status: {e}")

        return rooms

    def get_room(self, room_id: int, current_user: models.User) -> models.Room:
        room = self.repo.get_by_id(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        self._assert_owns_hotel(
            current_user,
            room.hotel_id,
            "You can view rooms only from your own hotel",
        )
        return room

    def update_room(
        self,
        room_id: int,
        room_update: schemas.RoomUpdate,
        current_user: models.User,
    ) -> models.Room:
        room = self.repo.get_by_id(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        self._assert_owns_hotel(
            current_user,
            room.hotel_id,
            "You can update rooms only from your own hotel",
        )

        update_data = room_update.model_dump(exclude_unset=True)
        if "room_number" in update_data and update_data["room_number"] != room.room_number:
            existing = self.repo.get_by_room_number(room.hotel_id, update_data["room_number"])
            if existing and existing.id != room.id:
                raise HTTPException(
                    status_code=400,
                    detail="Room number already exists for this hotel",
                )

        return self.repo.update_room(room, update_data)

    def update_room_status(
        self,
        room_id: int,
        status: str,
        current_user: models.User,
    ) -> models.Room:
        room = self.repo.get_by_id(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        self._assert_owns_hotel(
            current_user,
            room.hotel_id,
            "You can update rooms only from your own hotel",
        )

        clean_status = status.strip().lower()
        return self.repo.update_room(room, {"status": clean_status})

    def delete_room(self, room_id: int, current_user: models.User) -> Dict[str, str]:
        room = self.repo.get_by_id(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        self._assert_owns_hotel(
            current_user,
            room.hotel_id,
            "You can delete rooms only for your own hotel",
        )

        self.repo.delete_room(room)
        return {"message": "Room deleted successfully"}