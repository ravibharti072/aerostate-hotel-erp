from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.preventive_maintenance_repository import PreventiveMaintenanceRepository
from app.repositories.maintenance_repository import MaintenanceRepository
from app.repositories.work_order_repository import WorkOrderRepository


class PreventiveMaintenanceService:
    ALLOWED_MANAGE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "maintenance",
    ]

    FREQUENCY_INTERVALS = {
        "daily": 1,
        "weekly": 7,
        "bi-weekly": 14,
        "monthly": 30,
        "quarterly": 90,
        "semi-annual": 180,
        "annual": 365,
    }

    def __init__(self, db: Session):
        self.db = db
        self.repo = PreventiveMaintenanceRepository(db)
        self.maint_repo = MaintenanceRepository(db)
        self.wo_repo = WorkOrderRepository(db)

    # -------------------------------------------------------------
    # Authorization & Tenant Guards
    # -------------------------------------------------------------

    def _has_maintenance_module(self, current_user: models.User) -> bool:
        modules = getattr(current_user, "allowed_modules", None)
        if not modules:
            return False
        if isinstance(modules, list):
            return any(str(m).strip().lower() in ["maintenance", "all", "admin"] for m in modules)
        if isinstance(modules, str):
            parts = [p.strip().lower() for p in modules.split(",")]
            return any(m in ["maintenance", "all", "admin"] for m in parts)
        return False

    def _assert_can_manage(self, current_user: models.User) -> None:
        if current_user.role in self.ALLOWED_MANAGE_ROLES or self._has_maintenance_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only maintenance, hotel-admin, manager, or super-admin can manage preventive maintenance plans.",
        )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Date Calculations
    # -------------------------------------------------------------

    def calculate_next_due_date(self, from_date: datetime, frequency: str, interval_days: Optional[int] = None) -> datetime:
        freq_lower = (frequency or "monthly").lower().strip()
        days_to_add = interval_days if interval_days and interval_days > 0 else self.FREQUENCY_INTERVALS.get(freq_lower, 30)
        return from_date + timedelta(days=days_to_add)

    # -------------------------------------------------------------
    # Plan Workflows
    # -------------------------------------------------------------

    def create_plan(
        self,
        payload: schemas.PreventiveMaintenancePlanCreate,
        current_user: models.User,
    ) -> models.PreventiveMaintenancePlan:
        self._assert_can_manage(current_user)
        target_hotel_id = payload.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            first_hotel = self.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
            if first_hotel:
                target_hotel_id = first_hotel.id
            else:
                first_hotel = self.db.query(models.Hotel).first()
                target_hotel_id = first_hotel.id if first_hotel else 1

        self._assert_owns_hotel(
            current_user,
            target_hotel_id,
            "You can create preventive maintenance plans only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        if payload.asset_id:
            asset = self.repo.get_asset_by_id(payload.asset_id, target_hotel_id)
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found for this hotel")

        if payload.assigned_staff_id:
            staff = self.repo.get_staff_by_id(payload.assigned_staff_id, target_hotel_id)
            if not staff:
                raise HTTPException(status_code=404, detail="Assigned staff not found for this hotel")

        plan_data = payload.model_dump()
        plan_data["hotel_id"] = target_hotel_id
        freq_key = payload.frequency.lower()
        if not plan_data.get("interval_days"):
            plan_data["interval_days"] = self.FREQUENCY_INTERVALS.get(freq_key, 30)

        # If next_due_date is not explicitly set, calculate from start_date
        if not plan_data.get("next_due_date"):
            plan_data["next_due_date"] = self.calculate_next_due_date(
                payload.start_date,
                payload.frequency,
                plan_data["interval_days"],
            )

        return self.repo.create_plan(plan_data)

    def get_plans(
        self,
        hotel_id: Optional[int],
        asset_id: Optional[int],
        category: Optional[str],
        is_active: Optional[bool],
        current_user: models.User,
    ) -> List[models.PreventiveMaintenancePlan]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_plans(
            hotel_id=target_hotel_id,
            asset_id=asset_id,
            category=category,
            is_active=is_active,
        )

    def get_plan(self, plan_id: int, current_user: models.User) -> models.PreventiveMaintenancePlan:
        plan = self.repo.get_by_id(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Preventive maintenance plan not found")

        self._assert_owns_hotel(
            current_user,
            plan.hotel_id,
            "You can view only preventive maintenance plans from your own hotel",
        )
        return plan

    def update_plan(
        self,
        plan_id: int,
        payload: schemas.PreventiveMaintenancePlanUpdate,
        current_user: models.User,
    ) -> models.PreventiveMaintenancePlan:
        self._assert_can_manage(current_user)

        plan = self.repo.get_by_id(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Preventive maintenance plan not found")

        self._assert_owns_hotel(
            current_user,
            plan.hotel_id,
            "You can update only preventive maintenance plans from your own hotel",
        )

        update_data = payload.model_dump(exclude_unset=True)

        if "asset_id" in update_data and update_data["asset_id"]:
            asset = self.repo.get_asset_by_id(update_data["asset_id"], plan.hotel_id)
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found for this hotel")

        if "assigned_staff_id" in update_data and update_data["assigned_staff_id"]:
            staff = self.repo.get_staff_by_id(update_data["assigned_staff_id"], plan.hotel_id)
            if not staff:
                raise HTTPException(status_code=404, detail="Assigned staff not found for this hotel")

        return self.repo.update_plan(plan, update_data)

    def complete_plan_occurrence(
        self,
        plan_id: int,
        current_user: models.User,
        notes: Optional[str] = None,
    ) -> models.PreventiveMaintenancePlan:
        self._assert_can_manage(current_user)

        plan = self.repo.get_by_id(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Preventive maintenance plan not found")

        self._assert_owns_hotel(
            current_user,
            plan.hotel_id,
            "You can complete preventive maintenance plans only for your own hotel",
        )

        now = datetime.utcnow()
        new_next_due = self.calculate_next_due_date(now, plan.frequency, plan.interval_days)

        update_fields = {
            "last_performed_date": now,
            "next_due_date": new_next_due,
        }

        return self.repo.update_plan(plan, update_fields)

    def generate_due_work_orders(
        self,
        hotel_id: Optional[int],
        current_user: models.User,
    ) -> Dict[str, Any]:
        """
        Batch triggers work order and maintenance request generation for all
        active plans where next_due_date <= now.
        """
        self._assert_can_manage(current_user)
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id

        now = datetime.utcnow()
        due_plans = self.repo.list_plans(
            hotel_id=target_hotel_id,
            is_active=True,
            due_before=now,
        )

        generated_count = 0
        work_orders = []

        for plan in due_plans:
            # 1. Create central MaintenanceRequest
            maint_req_data = {
                "hotel_id": plan.hotel_id,
                "room_id": plan.asset.room_id if plan.asset else None,
                "asset_id": plan.asset_id,
                "category": plan.category,
                "source": "Preventive Maintenance",
                "blocks_room": False,
                "issue_title": f"[PM] {plan.title}",
                "issue_description": plan.description or f"Scheduled recurring preventive maintenance: {plan.title}",
                "priority": "normal",
                "status": "assigned" if plan.assigned_staff_id else "open",
                "assigned_staff_id": plan.assigned_staff_id,
                "reported_by": "PM Scheduler Engine",
                "created_by_user_id": current_user.id,
                "created_at": now,
            }

            maint_req = self.maint_repo.create_request(maint_req_data, blocks_room=False)

            # 2. Create concrete MaintenanceWorkOrder
            wo_number = self.wo_repo.generate_work_order_number(plan.hotel_id)
            wo_data = {
                "hotel_id": plan.hotel_id,
                "work_order_number": wo_number,
                "maintenance_request_id": maint_req.id,
                "room_id": plan.asset.room_id if plan.asset else None,
                "asset_id": plan.asset_id,
                "technician_staff_id": plan.assigned_staff_id,
                "status": "assigned" if plan.assigned_staff_id else "assigned",
                "priority": "normal",
                "diagnosis": f"Preventive Maintenance Plan: {plan.title}",
                "notes": f"Checklist: {', '.join(plan.checklist) if plan.checklist else 'Standard Service'}",
                "created_at": now,
            }

            created_wo = self.wo_repo.create_work_order(wo_data)
            work_orders.append(created_wo.work_order_number)

            # 3. Advance plan next_due_date
            new_due = self.calculate_next_due_date(now, plan.frequency, plan.interval_days)
            self.repo.update_plan(plan, {
                "last_performed_date": now,
                "next_due_date": new_due,
            })

            generated_count += 1

        return {
            "message": f"Successfully processed due plans. Generated {generated_count} maintenance task(s).",
            "generated_count": generated_count,
            "work_orders": work_orders,
        }

    def delete_plan(self, plan_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user)

        plan = self.repo.get_by_id(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Preventive maintenance plan not found")

        self._assert_owns_hotel(
            current_user,
            plan.hotel_id,
            "You can delete only preventive maintenance plans from your own hotel",
        )

        self.repo.delete_plan(plan)
        return {"message": "Preventive maintenance plan deleted successfully"}