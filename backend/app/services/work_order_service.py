from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.work_order_repository import WorkOrderRepository


class WorkOrderService:
    ALLOWED_MANAGE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "maintenance",
    ]
    ALLOWED_UPDATE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "maintenance",
    ]
    ALLOWED_STATUSES = [
        "assigned",
        "in_progress",
        "pending_parts",
        "completed",
        "verified",
        "closed",
        "cancelled",
    ]
    ALLOWED_PRIORITIES = ["low", "normal", "medium", "high", "urgent"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = WorkOrderRepository(db)

    # -------------------------------------------------------------
    # Authorization & Scope Assertions
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
            detail="Access denied. Only maintenance, hotel-admin, manager, or super-admin can manage work orders",
        )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Work Order Workflows
    # -------------------------------------------------------------

    def create_work_order(
        self,
        payload: schemas.MaintenanceWorkOrderCreate,
        current_user: models.User,
    ) -> models.MaintenanceWorkOrder:
        self._assert_can_manage(current_user)
        target_hotel_id = payload.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            if payload.maintenance_request_id:
                req = self.db.query(models.MaintenanceRequest).filter(models.MaintenanceRequest.id == payload.maintenance_request_id).first()
                if req and req.hotel_id:
                    target_hotel_id = req.hotel_id
            if not target_hotel_id:
                first_hotel = self.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
                target_hotel_id = first_hotel.id if first_hotel else 1

        self._assert_owns_hotel(
            current_user,
            target_hotel_id,
            "You can create work orders only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        request = self.repo.get_request_by_id(payload.maintenance_request_id, target_hotel_id)
        if not request:
            raise HTTPException(status_code=404, detail="Parent maintenance request not found for this hotel")

        room_id = payload.room_id or request.room_id
        asset_id = payload.asset_id or request.asset_id

        if room_id:
            room = self.repo.get_room_by_id(room_id, target_hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Room not found for this hotel")

        if asset_id:
            asset = self.repo.get_asset_by_id(asset_id, target_hotel_id)
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found for this hotel")

        if payload.technician_staff_id:
            tech = self.repo.get_staff_by_id(payload.technician_staff_id, target_hotel_id)
            if not tech:
                raise HTTPException(status_code=404, detail="Technician staff member not found")

        if payload.status not in self.ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_STATUSES}",
            )

        if payload.priority not in self.ALLOWED_PRIORITIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid priority. Allowed priorities are: {self.ALLOWED_PRIORITIES}",
            )

        order_data = payload.model_dump()
        order_data["hotel_id"] = target_hotel_id
        order_data["room_id"] = room_id
        order_data["asset_id"] = asset_id
        
        # Generate unique serial work order identifier (WO-YYYY-XXXX)
        if not order_data.get("work_order_number"):
            order_data["work_order_number"] = self.repo.generate_work_order_number(target_hotel_id)

        # Calculate initial costs
        order_data["total_cost"] = float(order_data.get("labor_cost", 0.0)) + float(order_data.get("parts_cost", 0.0))

        # Sync request status to assigned
        if request.status == "open":
            request.status = "assigned"
            if payload.technician_staff_id:
                request.assigned_staff_id = payload.technician_staff_id
            self.db.commit()

        return self.repo.create_work_order(order_data)

    def get_work_orders(
        self,
        hotel_id: Optional[int],
        maintenance_request_id: Optional[int],
        room_id: Optional[int],
        asset_id: Optional[int],
        technician_staff_id: Optional[int],
        status: Optional[str],
        priority: Optional[str],
        current_user: models.User,
    ) -> List[models.MaintenanceWorkOrder]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_work_orders(
            hotel_id=target_hotel_id,
            maintenance_request_id=maintenance_request_id,
            room_id=room_id,
            asset_id=asset_id,
            technician_staff_id=technician_staff_id,
            status=status,
            priority=priority,
        )

    def get_work_order(
        self,
        work_order_id: int,
        current_user: models.User,
    ) -> models.MaintenanceWorkOrder:
        order = self.repo.get_by_id(work_order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Work order not found")

        self._assert_owns_hotel(
            current_user,
            order.hotel_id,
            "You can view only work orders from your own hotel",
        )
        return order

    def update_work_order(
        self,
        work_order_id: int,
        payload: schemas.MaintenanceWorkOrderUpdate,
        current_user: models.User,
    ) -> models.MaintenanceWorkOrder:
        self._assert_can_manage(current_user)

        order = self.repo.get_by_id(work_order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Work order not found")

        self._assert_owns_hotel(
            current_user,
            order.hotel_id,
            "You can update only work orders from your own hotel",
        )

        update_data = payload.model_dump(exclude_unset=True)

        if "status" in update_data and update_data["status"] is not None:
            if update_data["status"] not in self.ALLOWED_STATUSES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_STATUSES}",
                )

        if "priority" in update_data and update_data["priority"] is not None:
            if update_data["priority"] not in self.ALLOWED_PRIORITIES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid priority. Allowed priorities are: {self.ALLOWED_PRIORITIES}",
                )

        if "technician_staff_id" in update_data and update_data["technician_staff_id"]:
            tech = self.repo.get_staff_by_id(update_data["technician_staff_id"], order.hotel_id)
            if not tech:
                raise HTTPException(status_code=404, detail="Assigned technician staff not found")

        # Recalculate total cost if labor or parts cost changed
        labor_cost = update_data.get("labor_cost", order.labor_cost)
        parts_cost = update_data.get("parts_cost", order.parts_cost)
        update_data["total_cost"] = float(labor_cost) + float(parts_cost)

        # Synchronize status transitions
        target_status = update_data.get("status")
        if target_status == "in_progress" and not order.started_at:
            update_data["started_at"] = datetime.utcnow()
        elif target_status in ["completed", "verified", "closed"] and not order.completed_at:
            update_data["completed_at"] = datetime.utcnow()

        if target_status == "verified":
            update_data["verified_at"] = datetime.utcnow()
            update_data["verified_by"] = current_user.full_name or current_user.username

        # Synchronize parent maintenance request status
        parent_request = self.repo.get_request_by_id(order.maintenance_request_id, order.hotel_id)
        if parent_request and target_status:
            if target_status == "in_progress":
                parent_request.status = "in-progress"
            elif target_status == "pending_parts":
                parent_request.status = "pending_parts"
            elif target_status in ["completed", "verified", "closed"]:
                parent_request.status = "completed"
                parent_request.actual_cost = float(parent_request.actual_cost or 0.0) + float(update_data["total_cost"])
            self.db.commit()

        return self.repo.update_work_order(order, update_data)

    # -------------------------------------------------------------
    # Inventory Deduction & Procurement Workflows
    # -------------------------------------------------------------

    def add_part_usage(
        self,
        work_order_id: int,
        payload: schemas.MaintenancePartUsageCreate,
        current_user: models.User,
    ) -> models.MaintenancePartUsage:
        self._assert_can_manage(current_user)

        order = self.repo.get_by_id(work_order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Work order not found")

        self._assert_owns_hotel(
            current_user,
            order.hotel_id,
            "You can log parts only for your own hotel",
        )

        item = self.repo.get_inventory_item(payload.inventory_item_id, order.hotel_id)
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found for this hotel")

        if payload.quantity_used <= 0:
            raise HTTPException(status_code=400, detail="Quantity used must be greater than zero")

        # Check stock availability
        if item.current_stock < payload.quantity_used:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient inventory stock. Available: {item.current_stock} {item.unit}, Requested: {payload.quantity_used} {item.unit}. Please generate a procurement request.",
            )

        unit_cost = float(payload.unit_cost or item.purchase_price or 0.0)
        total_cost = round(unit_cost * float(payload.quantity_used), 2)
        new_item_stock = item.current_stock - float(payload.quantity_used)

        part_data = {
            "hotel_id": order.hotel_id,
            "work_order_id": order.id,
            "inventory_item_id": item.id,
            "quantity_used": float(payload.quantity_used),
            "unit_cost": unit_cost,
            "total_cost": total_cost,
            "notes": payload.notes,
            "created_at": datetime.utcnow(),
        }

        stock_tx_data = {
            "hotel_id": order.hotel_id,
            "item_id": item.id,
            "transaction_type": "issue",
            "quantity": float(payload.quantity_used),
            "reason": f"Maintenance Work Order {order.work_order_number}",
            "reference": order.work_order_number,
            "created_by": current_user.username,
            "created_at": datetime.utcnow(),
        }

        # Atomically record usage, adjust stock, and record stock transaction
        usage = self.repo.add_part_usage_with_stock_deduction(
            part_data=part_data,
            item=item,
            new_stock=new_item_stock,
            stock_transaction_data=stock_tx_data,
        )

        # Update work order parts_cost and total_cost
        order.parts_cost = float(order.parts_cost or 0.0) + total_cost
        order.total_cost = float(order.labor_cost or 0.0) + float(order.parts_cost)
        self.db.commit()
        self.db.refresh(order)

        return usage

    def request_part_procurement(
        self,
        work_order_id: int,
        item_id: int,
        quantity: float,
        current_user: models.User,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Creates a draft PurchaseOrder in the Procurement module when stock is depleted or missing.
        """
        self._assert_can_manage(current_user)

        order = self.repo.get_by_id(work_order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Work order not found")

        self._assert_owns_hotel(
            current_user,
            order.hotel_id,
            "You can request procurement only for your own hotel",
        )

        item = self.repo.get_inventory_item(item_id, order.hotel_id)
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Requested procurement quantity must be greater than zero")

        vendor = self.repo.find_vendor_for_item(order.hotel_id, item.supplier_name)
        if not vendor:
            raise HTTPException(
                status_code=400,
                detail="No registered vendor found for this item. Please add an active vendor in the Procurement module first.",
            )

        po_number = self.repo.generate_po_number(order.hotel_id)
        unit_price = float(item.purchase_price or 0.0)
        subtotal = round(unit_price * quantity, 2)

        po_data = {
            "hotel_id": order.hotel_id,
            "vendor_id": vendor.id,
            "po_number": po_number,
            "order_date": datetime.utcnow(),
            "status": "draft",
            "payment_status": "pending",
            "subtotal": subtotal,
            "tax_amount": 0.0,
            "discount": 0.0,
            "grand_total": subtotal,
            "notes": f"Auto-generated from Maintenance Work Order {order.work_order_number}. {notes or ''}".strip(),
            "created_by": current_user.username,
            "created_at": datetime.utcnow(),
        }

        item_data = {
            "item_id": item.id,
            "item_name": item.name,
            "quantity": quantity,
            "unit_price": unit_price,
            "tax_percent": 0.0,
            "total": subtotal,
        }

        created_po = self.repo.create_procurement_draft_for_work_order(po_data, item_data)

        # Update work order and parent maintenance request status to pending_parts
        order.status = "pending_parts"
        parent_request = self.repo.get_request_by_id(order.maintenance_request_id, order.hotel_id)
        if parent_request:
            parent_request.status = "pending_parts"

        self.db.commit()

        return {
            "message": f"Procurement draft purchase order {created_po.po_number} created successfully.",
            "purchase_order_id": created_po.id,
            "po_number": created_po.po_number,
            "vendor_name": vendor.vendor_name,
            "item_name": item.name,
            "quantity_ordered": quantity,
            "work_order_number": order.work_order_number,
        }

    def delete_work_order(
        self,
        work_order_id: int,
        current_user: models.User,
    ) -> Dict[str, str]:
        self._assert_can_manage(current_user)

        order = self.repo.get_by_id(work_order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Work order not found")

        self._assert_owns_hotel(
            current_user,
            order.hotel_id,
            "You can delete only work orders from your own hotel",
        )

        self.repo.delete_work_order(order)
        return {"message": "Work order deleted successfully"}