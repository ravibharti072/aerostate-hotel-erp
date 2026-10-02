from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.inventory_repository import InventoryRepository


class InventoryService:
    ALLOWED_ROLES = ["super-admin", "hotel-admin", "manager", "inventory"]
    ALLOWED_TRANSACTION_TYPES = ["receive", "issue", "adjust"]

    INWARD_MOVEMENTS = [
        "OPENING",
        "PURCHASE_RECEIVE",
        "RETURN_TO_STORE",
        "TRANSFER_IN",
        "ADJUSTMENT_IN",
    ]

    OUTWARD_MOVEMENTS = [
        "DEPT_ISSUE",
        "CONSUMPTION",
        "SUPPLIER_RETURN",
        "TRANSFER_OUT",
        "ADJUSTMENT_OUT",
        "DAMAGE",
        "WASTE",
        "EXPIRY",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = InventoryRepository(db)

    # -------------------------------------------------------------
    # Authorization & Scope Assertions
    # -------------------------------------------------------------

    def _has_inventory_module(self, current_user: models.User) -> bool:
        modules = getattr(current_user, "allowed_modules", None)
        if not modules:
            return False
        if isinstance(modules, list):
            return any(str(m).strip().lower() in ["inventory", "all", "admin"] for m in modules)
        if isinstance(modules, str):
            parts = [p.strip().lower() for p in modules.split(",")]
            return any(m in ["inventory", "all", "admin"] for m in parts)
        return False

    def _assert_can_manage(self, current_user: models.User, action_label: str) -> None:
        if current_user.role in self.ALLOWED_ROLES or self._has_inventory_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail=f"Only inventory, hotel-admin, manager, or super-admin can {action_label}",
        )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Dashboard Analytics (Phase 10)
    # -------------------------------------------------------------

    def get_dashboard_summary(
        self,
        hotel_id: Optional[int],
        current_user: models.User,
    ) -> schemas.InventoryDashboardSummaryResponse:
        target_hotel_id = hotel_id or current_user.hotel_id
        if not target_hotel_id and current_user.role == "super-admin":
            first_hotel = self.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
            target_hotel_id = first_hotel.id if first_hotel else 1
        self._assert_owns_hotel(current_user, target_hotel_id, "Access denied to inventory dashboard")

        kpis_data = self.repo.get_dashboard_kpis(target_hotel_id)
        dept_data = self.repo.get_dashboard_department_consumption(target_hotel_id)
        cat_data = self.repo.get_dashboard_category_valuations(target_hotel_id)
        top_items = self.repo.get_dashboard_top_consumed_items(target_hotel_id, limit=5)
        low_alerts = self.repo.get_dashboard_low_stock_alerts(target_hotel_id, limit=10)
        recent_act = self.repo.get_dashboard_recent_activity(target_hotel_id, limit=10)

        return schemas.InventoryDashboardSummaryResponse(
            kpis=schemas.DashboardKPIs(**kpis_data),
            department_consumption=[schemas.DashboardDepartmentConsumption(**d) for d in dept_data],
            category_valuations=[schemas.DashboardCategoryValuation(**c) for c in cat_data],
            top_consumed_items=[schemas.DashboardTopConsumedItem(**t) for t in top_items],
            low_stock_alerts=[schemas.DashboardLowStockAlert(**a) for a in low_alerts],
            recent_activity=recent_act,
        )

    # -------------------------------------------------------------
    # Physical Stock Count & Reconciliation Workflows (Phase 9)
    # -------------------------------------------------------------

    def create_physical_count(
        self,
        payload: schemas.PhysicalStockCountCreate,
        current_user: models.User,
    ) -> schemas.PhysicalStockCountResponse:
        self._assert_can_manage(current_user, "create physical stock counts")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.store_id).hotel_id if payload.store_id else current_user.hotel_id
        )

        store = self.repo.get_store_by_id(payload.store_id)
        if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
            raise HTTPException(status_code=400, detail="Invalid store selected for physical count")

        if not payload.items:
            raise HTTPException(status_code=400, detail="Cannot create physical count without items")

        count_no = self.repo.generate_count_number(hotel_id)

        count_data = {
            "hotel_id": hotel_id,
            "count_no": count_no,
            "store_id": payload.store_id,
            "status": "draft",
            "count_date": payload.count_date or datetime.utcnow(),
            "counted_by": payload.counted_by or current_user.full_name or current_user.username,
            "notes": payload.notes,
        }
        count_rec = self.repo.create_physical_count_record(count_data)

        for line in payload.items:
            item = self.repo.get_item_by_id(line.item_id)
            if not item or item.hotel_id != hotel_id:
                raise HTTPException(status_code=404, detail=f"Item {line.item_id} not found")

            loc_stock = self.repo.get_location_stock(hotel_id, item.id, payload.store_id)
            system_stock = loc_stock.current_stock if loc_stock else 0.0
            variance = round(line.physical_stock - system_stock, 4)

            item_data = {
                "physical_stock_count_id": count_rec.id,
                "item_id": line.item_id,
                "system_stock": system_stock,
                "physical_stock": line.physical_stock,
                "variance": variance,
                "notes": line.notes,
            }
            self.repo.create_physical_count_item_record(item_data)

        self.db.commit()
        self.db.refresh(count_rec)
        return self._enrich_physical_count_response(count_rec)

    def finalize_physical_count(
        self,
        count_id: int,
        current_user: models.User,
    ) -> schemas.PhysicalStockCountResponse:
        self._assert_can_manage(current_user, "finalize physical stock counts")

        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        count_rec = self.repo.get_physical_count_by_id(count_id, target_hotel_id or current_user.hotel_id)
        if not count_rec:
            raise HTTPException(status_code=404, detail="Physical count record not found")

        if count_rec.status == "finalized":
            raise HTTPException(status_code=400, detail="Physical stock count has already been finalized")
        if count_rec.status == "cancelled":
            raise HTTPException(status_code=400, detail="Cannot finalize a cancelled physical count")

        for it in count_rec.items:
            if it.variance != 0.0:
                movement_req = schemas.StockMovementRequest(
                    item_id=it.item_id,
                    store_id=count_rec.store_id,
                    quantity=it.variance,
                    movement_type="PHYSICAL_COUNT_RECON",
                    reference_no=count_rec.count_no,
                    notes=f"Physical stock reconciliation count {count_rec.count_no}. Variance: {it.variance}",
                )
                self.execute_stock_movement(movement_req, current_user)

        count_rec.status = "finalized"
        count_rec.approved_by = current_user.full_name or current_user.username
        count_rec.finalized_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(count_rec)
        return self._enrich_physical_count_response(count_rec)

    def get_physical_counts(
        self,
        hotel_id: Optional[int],
        store_id: Optional[int],
        status: Optional[str],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedPhysicalStockCountResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        counts, total = self.repo.list_physical_counts(
            hotel_id=target_hotel_id,
            store_id=store_id,
            status=status,
            page=page,
            page_size=page_size,
        )

        return schemas.PaginatedPhysicalStockCountResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._enrich_physical_count_response(c) for c in counts],
        )

    def get_physical_count(self, count_id: int, current_user: models.User) -> schemas.PhysicalStockCountResponse:
        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        count_rec = self.repo.get_physical_count_by_id(count_id, target_hotel_id or current_user.hotel_id)
        if not count_rec:
            raise HTTPException(status_code=404, detail="Physical count record not found")
        return self._enrich_physical_count_response(count_rec)

    def _enrich_physical_count_response(self, count_rec: models.PhysicalStockCount) -> schemas.PhysicalStockCountResponse:
        data = schemas.PhysicalStockCountResponse(
            id=count_rec.id,
            hotel_id=count_rec.hotel_id,
            count_no=count_rec.count_no,
            store_id=count_rec.store_id,
            store_code=count_rec.store.store_code if count_rec.store else None,
            store_name=count_rec.store.store_name if count_rec.store else None,
            status=count_rec.status,
            count_date=count_rec.count_date,
            counted_by=count_rec.counted_by,
            approved_by=count_rec.approved_by,
            finalized_at=count_rec.finalized_at,
            notes=count_rec.notes,
            created_at=count_rec.created_at,
            items=[],
        )
        for it in count_rec.items:
            data.items.append(
                schemas.PhysicalStockCountItemResponse(
                    id=it.id,
                    physical_stock_count_id=it.physical_stock_count_id,
                    item_id=it.item_id,
                    item_name=it.item.name if it.item else None,
                    item_sku=it.item.sku if it.item else None,
                    system_stock=it.system_stock,
                    physical_stock=it.physical_stock,
                    variance=it.variance,
                    notes=it.notes,
                    created_at=it.created_at,
                )
            )
        return data

    # -------------------------------------------------------------
    # Stock Adjustments & Wastage Workflows (Phase 8)
    # -------------------------------------------------------------

    def adjust_stock(
        self,
        payload: schemas.InventoryAdjustmentCreate,
        current_user: models.User,
    ) -> schemas.InventoryAdjustmentResponse:
        self._assert_can_manage(current_user, "adjust inventory quantities")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.store_id).hotel_id if payload.store_id else current_user.hotel_id
        )

        store_id = payload.store_id
        if not store_id:
            store = self.repo.get_or_create_default_store(hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
                raise HTTPException(status_code=400, detail="Invalid store selected for adjustment")

        if payload.adjustment_quantity <= 0:
            raise HTTPException(status_code=400, detail="Adjustment quantity must be greater than 0")

        item = self.repo.get_item_by_id(payload.item_id)
        if not item or item.hotel_id != hotel_id:
            raise HTTPException(status_code=404, detail="Inventory item not found for this hotel")

        loc_stock = self.repo.get_location_stock(hotel_id, item.id, store_id)
        old_qty = loc_stock.current_stock if loc_stock else 0.0

        if payload.adjustment_type == "increase":
            new_qty = old_qty + payload.adjustment_quantity
            movement_type = "ADJUSTMENT_IN"
        elif payload.adjustment_type == "decrease":
            if old_qty < payload.adjustment_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot decrease below 0. Current store stock: {old_qty}, decrease requested: {payload.adjustment_quantity}",
                )
            new_qty = old_qty - payload.adjustment_quantity
            movement_type = "ADJUSTMENT_OUT"
        else:
            raise HTTPException(status_code=400, detail="Adjustment type must be 'increase' or 'decrease'")

        adj_no = self.repo.generate_adjustment_number(hotel_id)
        unit_cost = item.average_cost
        total_val = round(payload.adjustment_quantity * unit_cost, 2)

        adj_data = {
            "hotel_id": hotel_id,
            "adjustment_no": adj_no,
            "store_id": store_id,
            "item_id": item.id,
            "adjustment_type": payload.adjustment_type,
            "old_quantity": old_qty,
            "adjustment_quantity": payload.adjustment_quantity,
            "new_quantity": new_qty,
            "unit_cost": unit_cost,
            "total_value": total_val,
            "reason": payload.reason,
            "adjusted_by": payload.adjusted_by or current_user.full_name or current_user.username,
            "adjustment_date": payload.adjustment_date or datetime.utcnow(),
        }
        adj = self.repo.create_adjustment_record(adj_data)

        movement_req = schemas.StockMovementRequest(
            item_id=item.id,
            store_id=store_id,
            quantity=payload.adjustment_quantity,
            unit_cost=unit_cost,
            movement_type=movement_type,
            reference_no=adj.adjustment_no,
            notes=f"Stock adjustment: {payload.reason}",
        )
        self.execute_stock_movement(movement_req, current_user)

        self.db.commit()
        self.db.refresh(adj)

        return schemas.InventoryAdjustmentResponse(
            id=adj.id,
            hotel_id=adj.hotel_id,
            adjustment_no=adj.adjustment_no,
            store_id=adj.store_id,
            store_code=adj.store.store_code,
            store_name=adj.store.store_name,
            item_id=adj.item_id,
            item_name=item.name,
            item_sku=item.sku,
            adjustment_type=adj.adjustment_type,
            old_quantity=adj.old_quantity,
            adjustment_quantity=adj.adjustment_quantity,
            new_quantity=adj.new_quantity,
            unit_cost=adj.unit_cost,
            total_value=adj.total_value,
            reason=adj.reason,
            adjusted_by=adj.adjusted_by,
            adjustment_date=adj.adjustment_date,
            created_at=adj.created_at,
        )

    def get_adjustments(
        self,
        hotel_id: Optional[int],
        store_id: Optional[int],
        item_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventoryAdjustmentResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        adjs, total = self.repo.list_adjustments(
            hotel_id=target_hotel_id,
            store_id=store_id,
            item_id=item_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        annotated = []
        for a in adjs:
            annotated.append(
                schemas.InventoryAdjustmentResponse(
                    id=a.id,
                    hotel_id=a.hotel_id,
                    adjustment_no=a.adjustment_no,
                    store_id=a.store_id,
                    store_code=a.store.store_code if a.store else None,
                    store_name=a.store.store_name if a.store else None,
                    item_id=a.item_id,
                    item_name=a.item.name if a.item else None,
                    item_sku=a.item.sku if a.item else None,
                    adjustment_type=a.adjustment_type,
                    old_quantity=a.old_quantity,
                    adjustment_quantity=a.adjustment_quantity,
                    new_quantity=a.new_quantity,
                    unit_cost=a.unit_cost,
                    total_value=a.total_value,
                    reason=a.reason,
                    adjusted_by=a.adjusted_by,
                    adjustment_date=a.adjustment_date,
                    created_at=a.created_at,
                )
            )

        return schemas.PaginatedInventoryAdjustmentResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=annotated,
        )

    def record_wastage(
        self,
        payload: schemas.InventoryWastageCreate,
        current_user: models.User,
    ) -> schemas.InventoryWastageResponse:
        self._assert_can_manage(current_user, "record inventory wastage/damage")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.store_id).hotel_id if payload.store_id else current_user.hotel_id
        )

        store_id = payload.store_id
        if not store_id:
            store = self.repo.get_or_create_default_store(hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
                raise HTTPException(status_code=400, detail="Invalid store selected for wastage entry")

        if payload.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        item = self.repo.get_item_by_id(payload.item_id)
        if not item or item.hotel_id != hotel_id:
            raise HTTPException(status_code=404, detail="Inventory item not found for this hotel")

        loc_stock = self.repo.get_location_stock(hotel_id, item.id, store_id)
        avail = loc_stock.current_stock if loc_stock else 0.0
        if avail < payload.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot write off more than available in store '{store.store_name}'. Available: {avail}, requested: {payload.quantity}",
            )

        wst_no = self.repo.generate_wastage_number(hotel_id)
        unit_cost = item.average_cost
        total_cost = round(payload.quantity * unit_cost, 2)

        wst_data = {
            "hotel_id": hotel_id,
            "wastage_no": wst_no,
            "store_id": store_id,
            "item_id": item.id,
            "waste_type": payload.waste_type,
            "quantity": payload.quantity,
            "unit_cost": unit_cost,
            "total_cost": total_cost,
            "department": payload.department,
            "reason": payload.reason,
            "reported_by": payload.reported_by or current_user.full_name or current_user.username,
            "wastage_date": payload.wastage_date or datetime.utcnow(),
        }
        wst = self.repo.create_wastage_record(wst_data)

        movement_type = payload.waste_type if payload.waste_type in ["DAMAGE", "WASTE", "EXPIRY"] else "DAMAGE"

        movement_req = schemas.StockMovementRequest(
            item_id=item.id,
            store_id=store_id,
            quantity=payload.quantity,
            unit_cost=unit_cost,
            movement_type=movement_type,
            reference_no=wst.wastage_no,
            department=payload.department,
            notes=f"Inventory loss ({payload.waste_type}): {payload.reason}",
        )
        self.execute_stock_movement(movement_req, current_user)

        self.db.commit()
        self.db.refresh(wst)

        return schemas.InventoryWastageResponse(
            id=wst.id,
            hotel_id=wst.hotel_id,
            wastage_no=wst.wastage_no,
            store_id=wst.store_id,
            store_code=store.store_code,
            store_name=store.store_name,
            item_id=wst.item_id,
            item_name=item.name,
            item_sku=item.sku,
            waste_type=wst.waste_type,
            quantity=wst.quantity,
            unit_cost=wst.unit_cost,
            total_cost=wst.total_cost,
            department=wst.department,
            reason=wst.reason,
            reported_by=wst.reported_by,
            wastage_date=wst.wastage_date,
            created_at=wst.created_at,
        )

    def get_wastages(
        self,
        hotel_id: Optional[int],
        waste_type: Optional[str],
        store_id: Optional[int],
        item_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventoryWastageResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        wsts, total = self.repo.list_wastages(
            hotel_id=target_hotel_id,
            waste_type=waste_type,
            store_id=store_id,
            item_id=item_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        annotated = []
        for w in wsts:
            annotated.append(
                schemas.InventoryWastageResponse(
                    id=w.id,
                    hotel_id=w.hotel_id,
                    wastage_no=w.wastage_no,
                    store_id=w.store_id,
                    store_code=w.store.store_code if w.store else None,
                    store_name=w.store.store_name if w.store else None,
                    item_id=w.item_id,
                    item_name=w.item.name if w.item else None,
                    item_sku=w.item.sku if w.item else None,
                    waste_type=w.waste_type,
                    quantity=w.quantity,
                    unit_cost=w.unit_cost,
                    total_cost=w.total_cost,
                    department=w.department,
                    reason=w.reason,
                    reported_by=w.reported_by,
                    wastage_date=w.wastage_date,
                    created_at=w.created_at,
                )
            )

        return schemas.PaginatedInventoryWastageResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=annotated,
        )

    # -------------------------------------------------------------
    # Returns & Transfers Workflows (Phase 7)
    # -------------------------------------------------------------

    def return_stock_from_department(
        self,
        payload: schemas.InventoryReturnCreate,
        current_user: models.User,
    ) -> schemas.InventoryReturnResponse:
        self._assert_can_manage(current_user, "process department returns")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.store_id).hotel_id if payload.store_id else current_user.hotel_id
        )

        store_id = payload.store_id
        if not store_id:
            store = self.repo.get_or_create_default_store(hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
                raise HTTPException(status_code=400, detail="Invalid store selected for returning stock")

        if not payload.items:
            raise HTTPException(status_code=400, detail="Cannot create return note without items")

        return_no = self.repo.generate_return_number(hotel_id)
        total_value = 0.0

        return_data = {
            "hotel_id": hotel_id,
            "return_no": return_no,
            "store_id": store_id,
            "department": payload.department,
            "returned_by": payload.returned_by,
            "received_by": payload.received_by or current_user.full_name or current_user.username,
            "return_date": payload.return_date or datetime.utcnow(),
            "total_value": 0.0,
            "status": "returned",
            "reason": payload.reason,
            "notes": payload.notes,
        }

        ret = self.repo.create_return_record(return_data)

        for line in payload.items:
            if line.quantity_returned <= 0:
                raise HTTPException(status_code=400, detail="Returned quantity must be greater than 0")

            item = self.repo.get_item_by_id(line.item_id)
            if not item or item.hotel_id != hotel_id:
                raise HTTPException(status_code=404, detail=f"Item {line.item_id} not found")

            unit_cost = item.average_cost
            line_cost = round(line.quantity_returned * unit_cost, 2)
            total_value += line_cost

            item_data = {
                "return_id": ret.id,
                "item_id": line.item_id,
                "quantity_returned": line.quantity_returned,
                "unit_cost": unit_cost,
                "total_cost": line_cost,
            }
            self.repo.create_return_item_record(item_data)

            movement_req = schemas.StockMovementRequest(
                item_id=line.item_id,
                store_id=store_id,
                quantity=line.quantity_returned,
                unit_cost=unit_cost,
                movement_type="RETURN_TO_STORE",
                reference_no=ret.return_no,
                department=payload.department,
                notes=f"Unused items returned by {payload.department}. Reason: {payload.reason or 'N/A'}",
            )
            self.execute_stock_movement(movement_req, current_user)

        ret.total_value = round(total_value, 2)
        self.db.commit()
        self.db.refresh(ret)

        return self._enrich_return_response(ret)

    def get_returns(
        self,
        hotel_id: Optional[int],
        department: Optional[str],
        store_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventoryReturnResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        returns, total = self.repo.list_returns(
            hotel_id=target_hotel_id,
            department=department,
            store_id=store_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        return schemas.PaginatedInventoryReturnResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._enrich_return_response(r) for r in returns],
        )

    def get_return(self, return_id: int, current_user: models.User) -> schemas.InventoryReturnResponse:
        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        ret = self.repo.get_return_by_id(return_id, target_hotel_id or current_user.hotel_id)
        if not ret:
            raise HTTPException(status_code=404, detail="Department return record not found")
        return self._enrich_return_response(ret)

    def _enrich_return_response(self, ret: models.InventoryReturn) -> schemas.InventoryReturnResponse:
        data = schemas.InventoryReturnResponse(
            id=ret.id,
            hotel_id=ret.hotel_id,
            return_no=ret.return_no,
            store_id=ret.store_id,
            store_code=ret.store.store_code if ret.store else None,
            store_name=ret.store.store_name if ret.store else None,
            department=ret.department,
            returned_by=ret.returned_by,
            received_by=ret.received_by,
            return_date=ret.return_date,
            total_value=ret.total_value,
            status=ret.status,
            reason=ret.reason,
            notes=ret.notes,
            created_at=ret.created_at,
            items=[],
        )
        for it in ret.items:
            data.items.append(
                schemas.InventoryReturnItemResponse(
                    id=it.id,
                    return_id=it.return_id,
                    item_id=it.item_id,
                    item_name=it.item.name if it.item else None,
                    item_sku=it.item.sku if it.item else None,
                    quantity_returned=it.quantity_returned,
                    unit_cost=it.unit_cost,
                    total_cost=it.total_cost,
                    created_at=it.created_at,
                )
            )
        return data

    def return_goods_to_supplier(
        self,
        payload: schemas.InventorySupplierReturnCreate,
        current_user: models.User,
    ) -> schemas.InventorySupplierReturnResponse:
        self._assert_can_manage(current_user, "process supplier returns")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.store_id).hotel_id if payload.store_id else current_user.hotel_id
        )

        store_id = payload.store_id
        if not store_id:
            store = self.repo.get_or_create_default_store(hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
                raise HTTPException(status_code=400, detail="Invalid store selected for supplier return")

        supplier = self.repo.get_vendor_by_id(payload.supplier_id, hotel_id)
        if not supplier:
            raise HTTPException(status_code=400, detail="Supplier not found for this hotel")

        if not payload.items:
            raise HTTPException(status_code=400, detail="Cannot create supplier return without items")

        for line in payload.items:
            if line.quantity_returned <= 0:
                raise HTTPException(status_code=400, detail="Returned quantity must be greater than 0")
            loc_stock = self.repo.get_location_stock(hotel_id, line.item_id, store_id)
            avail = loc_stock.current_stock if loc_stock else 0.0
            if avail < line.quantity_returned:
                item_obj = self.repo.get_item_by_id(line.item_id)
                name = item_obj.name if item_obj else f"ID {line.item_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{name}' in store '{store.store_name}'. Available: {avail}, returning: {line.quantity_returned}",
                )

        sret_no = self.repo.generate_supplier_return_number(hotel_id)
        total_amount = 0.0

        sret_data = {
            "hotel_id": hotel_id,
            "supplier_return_no": sret_no,
            "supplier_id": payload.supplier_id,
            "store_id": store_id,
            "receipt_id": payload.receipt_id,
            "return_date": payload.return_date or datetime.utcnow(),
            "total_amount": 0.0,
            "status": "returned",
            "reason": payload.reason,
            "notes": payload.notes,
            "returned_by": payload.returned_by or current_user.full_name or current_user.username,
        }

        sret = self.repo.create_supplier_return_record(sret_data)

        for line in payload.items:
            item = self.repo.get_item_by_id(line.item_id)
            unit_cost = item.last_purchase_cost if item and item.last_purchase_cost > 0 else (item.average_cost if item else 0.0)
            line_cost = round(line.quantity_returned * unit_cost, 2)
            total_amount += line_cost

            item_data = {
                "supplier_return_id": sret.id,
                "item_id": line.item_id,
                "quantity_returned": line.quantity_returned,
                "unit_cost": unit_cost,
                "total_cost": line_cost,
                "reason": line.reason or payload.reason,
            }
            self.repo.create_supplier_return_item_record(item_data)

            movement_req = schemas.StockMovementRequest(
                item_id=line.item_id,
                store_id=store_id,
                quantity=line.quantity_returned,
                unit_cost=unit_cost,
                movement_type="SUPPLIER_RETURN",
                reference_no=sret.supplier_return_no,
                supplier_id=payload.supplier_id,
                notes=f"Returned to supplier {supplier.vendor_name}. Reason: {line.reason or payload.reason}",
            )
            self.execute_stock_movement(movement_req, current_user)

        sret.total_amount = round(total_amount, 2)
        self.db.commit()
        self.db.refresh(sret)

        return self._enrich_supplier_return_response(sret)

    def get_supplier_returns(
        self,
        hotel_id: Optional[int],
        supplier_id: Optional[int],
        store_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventorySupplierReturnResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        srets, total = self.repo.list_supplier_returns(
            hotel_id=target_hotel_id,
            supplier_id=supplier_id,
            store_id=store_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        return schemas.PaginatedInventorySupplierReturnResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._enrich_supplier_return_response(s) for s in srets],
        )

    def get_supplier_return(self, sret_id: int, current_user: models.User) -> schemas.InventorySupplierReturnResponse:
        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        sret = self.repo.get_supplier_return_by_id(sret_id, target_hotel_id or current_user.hotel_id)
        if not sret:
            raise HTTPException(status_code=404, detail="Supplier return record not found")
        return self._enrich_supplier_return_response(sret)

    def _enrich_supplier_return_response(self, sret: models.InventorySupplierReturn) -> schemas.InventorySupplierReturnResponse:
        data = schemas.InventorySupplierReturnResponse(
            id=sret.id,
            hotel_id=sret.hotel_id,
            supplier_return_no=sret.supplier_return_no,
            supplier_id=sret.supplier_id,
            supplier_name=sret.supplier.vendor_name if sret.supplier else None,
            store_id=sret.store_id,
            store_code=sret.store.store_code if sret.store else None,
            store_name=sret.store.store_name if sret.store else None,
            receipt_id=sret.receipt_id,
            receipt_no=sret.receipt.receipt_no if sret.receipt else None,
            return_date=sret.return_date,
            total_amount=sret.total_amount,
            status=sret.status,
            reason=sret.reason,
            notes=sret.notes,
            returned_by=sret.returned_by,
            created_at=sret.created_at,
            items=[],
        )
        for it in sret.items:
            data.items.append(
                schemas.InventorySupplierReturnItemResponse(
                    id=it.id,
                    supplier_return_id=it.supplier_return_id,
                    item_id=it.item_id,
                    item_name=it.item.name if it.item else None,
                    item_sku=it.item.sku if it.item else None,
                    quantity_returned=it.quantity_returned,
                    unit_cost=it.unit_cost,
                    total_cost=it.total_cost,
                    reason=it.reason,
                    created_at=it.created_at,
                )
            )
        return data

    def transfer_stock(
        self,
        payload: schemas.InventoryTransferCreate,
        current_user: models.User,
    ) -> schemas.InventoryTransferResponse:
        self._assert_can_manage(current_user, "transfer stock between stores")

        if payload.from_store_id == payload.to_store_id:
            raise HTTPException(status_code=400, detail="Source and destination store cannot be the same")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.from_store_id).hotel_id if payload.from_store_id else current_user.hotel_id
        )

        from_store = self.repo.get_store_by_id(payload.from_store_id)
        to_store = self.repo.get_store_by_id(payload.to_store_id)

        if not from_store or not to_store:
            raise HTTPException(status_code=404, detail="Source or destination store not found")

        if current_user.role != "super-admin":
            if from_store.hotel_id != hotel_id or to_store.hotel_id != hotel_id:
                raise HTTPException(status_code=403, detail="Both stores must belong to your hotel")

        if not payload.items:
            raise HTTPException(status_code=400, detail="Cannot execute transfer without items")

        for line in payload.items:
            if line.quantity_transferred <= 0:
                raise HTTPException(status_code=400, detail="Transferred quantity must be greater than 0")

            loc_stock = self.repo.get_location_stock(hotel_id, line.item_id, payload.from_store_id)
            avail = loc_stock.current_stock if loc_stock else 0.0
            if avail < line.quantity_transferred:
                item_obj = self.repo.get_item_by_id(line.item_id)
                name = item_obj.name if item_obj else f"ID {line.item_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{name}' in source store '{from_store.store_name}'. Available: {avail}, transferring: {line.quantity_transferred}",
                )

        transfer_no = self.repo.generate_transfer_number(hotel_id)
        total_value = 0.0

        trf_data = {
            "hotel_id": hotel_id,
            "transfer_no": transfer_no,
            "from_store_id": payload.from_store_id,
            "to_store_id": payload.to_store_id,
            "transfer_date": payload.transfer_date or datetime.utcnow(),
            "total_value": 0.0,
            "status": "transferred",
            "notes": payload.notes,
            "transferred_by": payload.transferred_by or current_user.full_name or current_user.username,
        }

        trf = self.repo.create_transfer_record(trf_data)

        for line in payload.items:
            item = self.repo.get_item_by_id(line.item_id)
            unit_cost = item.average_cost if item else 0.0
            line_cost = round(line.quantity_transferred * unit_cost, 2)
            total_value += line_cost

            item_data = {
                "transfer_id": trf.id,
                "item_id": line.item_id,
                "quantity_transferred": line.quantity_transferred,
                "unit_cost": unit_cost,
                "total_cost": line_cost,
            }
            self.repo.create_transfer_item_record(item_data)

            src_loc = self.repo.get_location_stock_for_update(hotel_id, line.item_id, payload.from_store_id)
            src_loc.current_stock -= line.quantity_transferred

            dst_loc = self.repo.get_location_stock_for_update(hotel_id, line.item_id, payload.to_store_id)
            if not dst_loc:
                dst_loc = models.InventoryLocationStock(
                    hotel_id=hotel_id,
                    item_id=line.item_id,
                    store_id=payload.to_store_id,
                    current_stock=0.0,
                )
                self.db.add(dst_loc)
                self.db.flush()
            dst_loc.current_stock += line.quantity_transferred

            self.repo.record_ledger_entry({
                "hotel_id": hotel_id,
                "item_id": line.item_id,
                "store_id": payload.from_store_id,
                "movement_type": "TRANSFER_OUT",
                "reference_no": trf.transfer_no,
                "department": f"To: {to_store.store_name}",
                "quantity_in": 0.0,
                "quantity_out": line.quantity_transferred,
                "balance_after": src_loc.current_stock,
                "unit_cost": unit_cost,
                "total_value": line_cost,
                "notes": f"Transferred to {to_store.store_name}",
                "created_by": current_user.username,
            })

            self.repo.record_ledger_entry({
                "hotel_id": hotel_id,
                "item_id": line.item_id,
                "store_id": payload.to_store_id,
                "movement_type": "TRANSFER_IN",
                "reference_no": trf.transfer_no,
                "department": f"From: {from_store.store_name}",
                "quantity_in": line.quantity_transferred,
                "quantity_out": 0.0,
                "balance_after": dst_loc.current_stock,
                "unit_cost": unit_cost,
                "total_value": line_cost,
                "notes": f"Transferred from {from_store.store_name}",
                "created_by": current_user.username,
            })

        trf.total_value = round(total_value, 2)
        self.db.commit()
        self.db.refresh(trf)

        return self._enrich_transfer_response(trf)

    def get_transfers(
        self,
        hotel_id: Optional[int],
        from_store_id: Optional[int],
        to_store_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventoryTransferResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        transfers, total = self.repo.list_transfers(
            hotel_id=target_hotel_id,
            from_store_id=from_store_id,
            to_store_id=to_store_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        return schemas.PaginatedInventoryTransferResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._enrich_transfer_response(t) for t in transfers],
        )

    def get_transfer(self, transfer_id: int, current_user: models.User) -> schemas.InventoryTransferResponse:
        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        trf = self.repo.get_transfer_by_id(transfer_id, target_hotel_id or current_user.hotel_id)
        if not trf:
            raise HTTPException(status_code=404, detail="Stock transfer record not found")
        return self._enrich_transfer_response(trf)

    def _enrich_transfer_response(self, trf: models.InventoryTransfer) -> schemas.InventoryTransferResponse:
        data = schemas.InventoryTransferResponse(
            id=trf.id,
            hotel_id=trf.hotel_id,
            transfer_no=trf.transfer_no,
            from_store_id=trf.from_store_id,
            from_store_code=trf.from_store.store_code if trf.from_store else None,
            from_store_name=trf.from_store.store_name if trf.from_store else None,
            to_store_id=trf.to_store_id,
            to_store_code=trf.to_store.store_code if trf.to_store else None,
            to_store_name=trf.to_store.store_name if trf.to_store else None,
            transfer_date=trf.transfer_date,
            total_value=trf.total_value,
            status=trf.status,
            notes=trf.notes,
            transferred_by=trf.transferred_by,
            created_at=trf.created_at,
            items=[],
        )
        for it in trf.items:
            data.items.append(
                schemas.InventoryTransferItemResponse(
                    id=it.id,
                    transfer_id=it.transfer_id,
                    item_id=it.item_id,
                    item_name=it.item.name if it.item else None,
                    item_sku=it.item.sku if it.item else None,
                    quantity_transferred=it.quantity_transferred,
                    unit_cost=it.unit_cost,
                    total_cost=it.total_cost,
                    created_at=it.created_at,
                )
            )
        return data

    def issue_stock(
        self,
        payload: schemas.InventoryIssueCreate,
        current_user: models.User,
    ) -> schemas.InventoryIssueResponse:
        self._assert_can_manage(current_user, "issue stock to departments")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.from_store_id).hotel_id if payload.from_store_id else current_user.hotel_id
        )

        store_id = payload.from_store_id
        if not store_id:
            store = self.repo.get_or_create_default_store(hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
                raise HTTPException(status_code=400, detail="Invalid source store selected for issuing stock")

        if not payload.items:
            raise HTTPException(status_code=400, detail="Cannot create issue note without items")

        issue_no = self.repo.generate_issue_number(hotel_id)

        for line in payload.items:
            if line.quantity_issued <= 0:
                raise HTTPException(status_code=400, detail="Issued quantity must be greater than 0")
            loc_stock = self.repo.get_location_stock(hotel_id, line.item_id, store_id)
            avail = loc_stock.current_stock if loc_stock else 0.0
            if avail < line.quantity_issued:
                item_obj = self.repo.get_item_by_id(line.item_id)
                name = item_obj.name if item_obj else f"ID {line.item_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{name}' in store '{store.store_name}'. Available: {avail}, requested: {line.quantity_issued}",
                )

        total_value = 0.0
        issue_data = {
            "hotel_id": hotel_id,
            "issue_no": issue_no,
            "from_store_id": store_id,
            "department": payload.department,
            "requested_by": payload.requested_by,
            "issued_by": payload.issued_by or current_user.full_name or current_user.username,
            "issue_date": payload.issue_date or datetime.utcnow(),
            "total_value": 0.0,
            "status": "issued",
            "notes": payload.notes,
        }

        issue = self.repo.create_issue_record(issue_data)

        for line in payload.items:
            item = self.repo.get_item_by_id(line.item_id)
            unit_cost = item.average_cost if item else 0.0
            line_cost = round(line.quantity_issued * unit_cost, 2)
            total_value += line_cost

            item_data = {
                "issue_id": issue.id,
                "item_id": line.item_id,
                "quantity_issued": line.quantity_issued,
                "unit_cost": unit_cost,
                "total_cost": line_cost,
            }
            self.repo.create_issue_item_record(item_data)

            movement_req = schemas.StockMovementRequest(
                item_id=line.item_id,
                store_id=store_id,
                quantity=line.quantity_issued,
                unit_cost=unit_cost,
                movement_type="DEPT_ISSUE",
                reference_no=issue.issue_no,
                department=payload.department,
                notes=f"Stock issued to {payload.department}. Requested by: {payload.requested_by or 'N/A'}",
            )
            self.execute_stock_movement(movement_req, current_user)

        issue.total_value = round(total_value, 2)
        self.db.commit()
        self.db.refresh(issue)

        return self._enrich_issue_response(issue)

    def get_issues(
        self,
        hotel_id: Optional[int],
        department: Optional[str],
        store_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventoryIssueResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        issues, total = self.repo.list_issues(
            hotel_id=target_hotel_id,
            department=department,
            store_id=store_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        return schemas.PaginatedInventoryIssueResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._enrich_issue_response(i) for i in issues],
        )

    def get_issue(self, issue_id: int, current_user: models.User) -> schemas.InventoryIssueResponse:
        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        issue = self.repo.get_issue_by_id(issue_id, target_hotel_id or current_user.hotel_id)
        if not issue:
            raise HTTPException(status_code=404, detail="Stock Issue Note not found")
        return self._enrich_issue_response(issue)

    def _enrich_issue_response(self, issue: models.InventoryIssue) -> schemas.InventoryIssueResponse:
        data = schemas.InventoryIssueResponse(
            id=issue.id,
            hotel_id=issue.hotel_id,
            issue_no=issue.issue_no,
            from_store_id=issue.from_store_id,
            from_store_code=issue.store.store_code if issue.store else None,
            from_store_name=issue.store.store_name if issue.store else None,
            department=issue.department,
            requested_by=issue.requested_by,
            issued_by=issue.issued_by,
            issue_date=issue.issue_date,
            total_value=issue.total_value,
            status=issue.status,
            notes=issue.notes,
            created_at=issue.created_at,
            items=[],
        )

        for it in issue.items:
            data.items.append(
                schemas.InventoryIssueItemResponse(
                    id=it.id,
                    issue_id=it.issue_id,
                    item_id=it.item_id,
                    item_name=it.item.name if it.item else None,
                    item_sku=it.item.sku if it.item else None,
                    quantity_issued=it.quantity_issued,
                    unit_cost=it.unit_cost,
                    total_cost=it.total_cost,
                    created_at=it.created_at,
                )
            )
        return data

    def record_consumption(
        self,
        payload: schemas.InventoryConsumptionCreate,
        current_user: models.User,
    ) -> schemas.InventoryConsumptionResponse:
        self._assert_can_manage(current_user, "record stock consumption")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.store_id).hotel_id if payload.store_id else current_user.hotel_id
        )

        store_id = payload.store_id
        if not store_id:
            store = self.repo.get_or_create_default_store(hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
                raise HTTPException(status_code=400, detail="Invalid store selected for consumption")

        if payload.quantity <= 0:
            raise HTTPException(status_code=400, detail="Consumption quantity must be greater than 0")

        item = self.repo.get_item_by_id(payload.item_id)
        if not item or item.hotel_id != hotel_id:
            raise HTTPException(status_code=404, detail="Inventory item not found for this hotel")

        loc_stock = self.repo.get_location_stock(hotel_id, item.id, store_id)
        avail = loc_stock.current_stock if loc_stock else 0.0
        if avail < payload.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{item.name}' in store '{store.store_name}'. Available: {avail}, requested: {payload.quantity}",
            )

        consumption_no = self.repo.generate_consumption_number(hotel_id)
        unit_cost = item.average_cost
        total_cost = round(payload.quantity * unit_cost, 2)

        csm_data = {
            "hotel_id": hotel_id,
            "consumption_no": consumption_no,
            "store_id": store_id,
            "item_id": item.id,
            "department": payload.department,
            "quantity": payload.quantity,
            "unit_cost": unit_cost,
            "total_cost": total_cost,
            "reason": payload.reason,
            "reference": payload.reference,
            "consumed_by": payload.consumed_by or current_user.full_name or current_user.username,
            "consumption_date": payload.consumption_date or datetime.utcnow(),
        }

        csm = self.repo.create_consumption_record(csm_data)

        movement_req = schemas.StockMovementRequest(
            item_id=item.id,
            store_id=store_id,
            quantity=payload.quantity,
            unit_cost=unit_cost,
            movement_type="CONSUMPTION",
            reference_no=consumption_no,
            department=payload.department,
            notes=f"Operational consumption by {payload.department}. Reason: {payload.reason or 'N/A'}",
        )
        self.execute_stock_movement(movement_req, current_user)

        self.db.commit()
        self.db.refresh(csm)

        return schemas.InventoryConsumptionResponse(
            id=csm.id,
            hotel_id=csm.hotel_id,
            consumption_no=csm.consumption_no,
            store_id=csm.store_id,
            store_code=store.store_code,
            store_name=store.store_name,
            item_id=csm.item_id,
            item_name=item.name,
            item_sku=item.sku,
            department=csm.department,
            quantity=csm.quantity,
            unit_cost=csm.unit_cost,
            total_cost=csm.total_cost,
            reason=csm.reason,
            reference=csm.reference,
            consumed_by=csm.consumed_by,
            consumption_date=csm.consumption_date,
            created_at=csm.created_at,
        )

    def get_consumptions(
        self,
        hotel_id: Optional[int],
        department: Optional[str],
        store_id: Optional[int],
        item_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventoryConsumptionResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        consumptions, total = self.repo.list_consumptions(
            hotel_id=target_hotel_id,
            department=department,
            store_id=store_id,
            item_id=item_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        annotated = []
        for c in consumptions:
            annotated.append(
                schemas.InventoryConsumptionResponse(
                    id=c.id,
                    hotel_id=c.hotel_id,
                    consumption_no=c.consumption_no,
                    store_id=c.store_id,
                    store_code=c.store.store_code if c.store else None,
                    store_name=c.store.store_name if c.store else None,
                    item_id=c.item_id,
                    item_name=c.item.name if c.item else None,
                    item_sku=c.item.sku if c.item else None,
                    department=c.department,
                    quantity=c.quantity,
                    unit_cost=c.unit_cost,
                    total_cost=c.total_cost,
                    reason=c.reason,
                    reference=c.reference,
                    consumed_by=c.consumed_by,
                    consumption_date=c.consumption_date,
                    created_at=c.created_at,
                )
            )

        return schemas.PaginatedInventoryConsumptionResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=annotated,
        )

    # -------------------------------------------------------------
    # Goods Receipt Note (GRN) / Receiving
    # -------------------------------------------------------------

    def receive_goods(
        self,
        payload: schemas.InventoryReceiptCreate,
        current_user: models.User,
    ) -> schemas.InventoryReceiptResponse:
        self._assert_can_manage(current_user, "receive purchased stock (GRN)")

        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else (
            self.repo.get_store_by_id(payload.store_id).hotel_id if payload.store_id else current_user.hotel_id
        )

        store_id = payload.store_id
        if not store_id:
            store = self.repo.get_or_create_default_store(hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != hotel_id):
                raise HTTPException(status_code=400, detail="Invalid store selected for receiving goods")

        supplier = self.repo.get_vendor_by_id(payload.supplier_id, hotel_id)
        if not supplier:
            raise HTTPException(status_code=400, detail="Supplier not found for this hotel")

        if not payload.items:
            raise HTTPException(status_code=400, detail="Cannot create goods receipt without items")

        receipt_no = self.repo.generate_receipt_number(hotel_id)

        subtotal = 0.0
        tax_total = 0.0

        for line in payload.items:
            if line.quantity_received <= 0:
                raise HTTPException(status_code=400, detail="Received quantity must be greater than 0")
            if line.unit_cost < 0:
                raise HTTPException(status_code=400, detail="Unit cost cannot be negative")

            line_subtotal = round(line.quantity_received * line.unit_cost, 2)
            line_tax = round(line_subtotal * (line.tax_rate / 100.0), 2)
            subtotal += line_subtotal
            tax_total += line_tax

        total_amount = round(subtotal + tax_total, 2)

        receipt_data = {
            "hotel_id": hotel_id,
            "receipt_no": receipt_no,
            "supplier_id": payload.supplier_id,
            "store_id": store_id,
            "purchase_order_id": payload.purchase_order_id,
            "invoice_no": payload.invoice_no,
            "invoice_date": payload.invoice_date,
            "receiving_date": payload.receiving_date or datetime.utcnow(),
            "subtotal": subtotal,
            "tax_amount": tax_total,
            "total_amount": total_amount,
            "status": "received",
            "notes": payload.notes,
            "received_by": payload.received_by or current_user.full_name or current_user.username,
        }

        receipt = self.repo.create_receipt_record(receipt_data)
        saved_items: List[models.InventoryReceiptItem] = []

        for line in payload.items:
            line_cost = round(line.quantity_received * line.unit_cost, 2)
            tax_cost = round(line_cost * (line.tax_rate / 100.0), 2)
            line_total = round(line_cost + tax_cost, 2)

            item_data = {
                "receipt_id": receipt.id,
                "item_id": line.item_id,
                "quantity_received": line.quantity_received,
                "unit_cost": line.unit_cost,
                "tax_rate": line.tax_rate,
                "tax_amount": tax_cost,
                "total_cost": line_total,
                "batch_number": line.batch_number,
                "expiry_date": line.expiry_date,
            }
            rec_item = self.repo.create_receipt_item_record(item_data)
            saved_items.append(rec_item)

            movement_req = schemas.StockMovementRequest(
                item_id=line.item_id,
                store_id=store_id,
                quantity=line.quantity_received,
                unit_cost=line.unit_cost,
                movement_type="PURCHASE_RECEIVE",
                reference_no=receipt.receipt_no,
                supplier_id=payload.supplier_id,
                notes=f"GRN receipt from {supplier.vendor_name}. Invoice: {payload.invoice_no or 'N/A'}",
            )
            self.execute_stock_movement(movement_req, current_user)

        if payload.purchase_order_id:
            self.repo.mark_purchase_order_received(payload.purchase_order_id, hotel_id)

        self.db.commit()
        self.db.refresh(receipt)

        return self._enrich_receipt_response(receipt)

    def get_receipts(
        self,
        hotel_id: Optional[int],
        supplier_id: Optional[int],
        store_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedInventoryReceiptResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        receipts, total = self.repo.list_receipts(
            hotel_id=target_hotel_id,
            supplier_id=supplier_id,
            store_id=store_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        return schemas.PaginatedInventoryReceiptResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._enrich_receipt_response(r) for r in receipts],
        )

    def get_receipt(self, receipt_id: int, current_user: models.User) -> schemas.InventoryReceiptResponse:
        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        receipt = self.repo.get_receipt_by_id(receipt_id, target_hotel_id or current_user.hotel_id)
        if not receipt:
            raise HTTPException(status_code=404, detail="Goods Receipt Note (GRN) not found")
        return self._enrich_receipt_response(receipt)

    def _enrich_receipt_response(self, receipt: models.InventoryReceipt) -> schemas.InventoryReceiptResponse:
        data = schemas.InventoryReceiptResponse(
            id=receipt.id,
            hotel_id=receipt.hotel_id,
            receipt_no=receipt.receipt_no,
            supplier_id=receipt.supplier_id,
            supplier_name=receipt.supplier.vendor_name if receipt.supplier else None,
            store_id=receipt.store_id,
            store_code=receipt.store.store_code if receipt.store else None,
            store_name=receipt.store.store_name if receipt.store else None,
            purchase_order_id=receipt.purchase_order_id,
            po_number=receipt.purchase_order.po_number if receipt.purchase_order else None,
            invoice_no=receipt.invoice_no,
            invoice_date=receipt.invoice_date,
            receiving_date=receipt.receiving_date,
            subtotal=receipt.subtotal,
            tax_amount=receipt.tax_amount,
            total_amount=receipt.total_amount,
            status=receipt.status,
            notes=receipt.notes,
            received_by=receipt.received_by,
            created_at=receipt.created_at,
            items=[],
        )

        for it in receipt.items:
            data.items.append(
                schemas.InventoryReceiptItemResponse(
                    id=it.id,
                    receipt_id=it.receipt_id,
                    item_id=it.item_id,
                    item_name=it.item.name if it.item else None,
                    item_sku=it.item.sku if it.item else None,
                    quantity_received=it.quantity_received,
                    unit_cost=it.unit_cost,
                    tax_rate=it.tax_rate,
                    tax_amount=it.tax_amount,
                    total_cost=it.total_cost,
                    batch_number=it.batch_number,
                    expiry_date=it.expiry_date,
                    created_at=it.created_at,
                )
            )
        return data

    # -------------------------------------------------------------
    # Core Stock Movement Engine
    # -------------------------------------------------------------

    def execute_stock_movement(
        self,
        req: schemas.StockMovementRequest,
        current_user: models.User,
    ) -> schemas.StockLedgerResponse:
        self._assert_can_manage(current_user, f"execute stock movement ({req.movement_type})")

        store_id = req.store_id
        if not store_id:
            item_peek = self.repo.get_item_by_id(req.item_id)
            target_hotel_id = (item_peek.hotel_id if item_peek else None) or current_user.hotel_id
            if not target_hotel_id:
                first_hotel = self.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
                target_hotel_id = first_hotel.id if first_hotel else 1
            store = self.repo.get_or_create_default_store(target_hotel_id)
            store_id = store.id
        else:
            store = self.repo.get_store_by_id(store_id)
            if not store or (current_user.role != "super-admin" and store.hotel_id != current_user.hotel_id):
                raise HTTPException(status_code=400, detail="Invalid store selected for this hotel")
            target_hotel_id = store.hotel_id

        if req.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        item = self.repo.get_item_for_update(req.item_id, target_hotel_id)
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        loc_stock = self.repo.get_location_stock_for_update(target_hotel_id, item.id, store_id)
        if not loc_stock:
            loc_stock = models.InventoryLocationStock(
                hotel_id=target_hotel_id,
                item_id=item.id,
                store_id=store_id,
                current_stock=0.0,
            )
            self.db.add(loc_stock)
            self.db.flush()

        unit_cost = req.unit_cost if req.unit_cost is not None else item.average_cost
        movement_type = req.movement_type

        if movement_type in self.INWARD_MOVEMENTS:
            qty_in = req.quantity
            qty_out = 0.0

            current_total_value = item.current_stock * item.average_cost
            incoming_value = qty_in * (unit_cost or 0.0)
            new_total_stock = item.current_stock + qty_in

            if new_total_stock > 0:
                item.average_cost = round((current_total_value + incoming_value) / new_total_stock, 4)

            item.current_stock = new_total_stock
            loc_stock.current_stock += qty_in
            if unit_cost:
                item.last_purchase_cost = unit_cost

            balance_after = loc_stock.current_stock
            total_value = round(qty_in * (unit_cost or item.average_cost), 2)

        elif movement_type in self.OUTWARD_MOVEMENTS:
            qty_in = 0.0
            qty_out = req.quantity

            if loc_stock.current_stock < qty_out:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient stock in store '{store.store_name}'. "
                        f"Available: {loc_stock.current_stock}, requested: {qty_out}"
                    ),
                )

            if item.current_stock < qty_out:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient total stock for item '{item.name}'. "
                        f"Available: {item.current_stock}, requested: {qty_out}"
                    ),
                )

            loc_stock.current_stock -= qty_out
            item.current_stock -= qty_out

            balance_after = loc_stock.current_stock
            unit_cost = item.average_cost
            total_value = round(qty_out * unit_cost, 2)

        elif movement_type == "PHYSICAL_COUNT_RECON":
            variance = req.quantity
            if variance >= 0:
                qty_in = variance
                qty_out = 0.0
                loc_stock.current_stock += variance
                item.current_stock += variance
            else:
                abs_var = abs(variance)
                if loc_stock.current_stock < abs_var or item.current_stock < abs_var:
                    raise HTTPException(
                        status_code=400,
                        detail="Physical reconciliation would result in negative stock.",
                    )
                qty_in = 0.0
                qty_out = abs_var
                loc_stock.current_stock -= abs_var
                item.current_stock -= abs_var

            balance_after = loc_stock.current_stock
            total_value = round((qty_in or qty_out) * item.average_cost, 2)

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported movement type: {movement_type}")

        ledger_data = {
            "hotel_id": target_hotel_id,
            "item_id": item.id,
            "store_id": store_id,
            "movement_type": movement_type,
            "reference_no": req.reference_no,
            "department": req.department,
            "supplier_id": req.supplier_id,
            "quantity_in": qty_in,
            "quantity_out": qty_out,
            "balance_after": balance_after,
            "unit_cost": unit_cost or 0.0,
            "total_value": total_value,
            "notes": req.notes,
            "created_by": current_user.username,
        }
        ledger_entry = self.repo.record_ledger_entry(ledger_data)
        self.db.commit()
        self.db.refresh(ledger_entry)

        return schemas.StockLedgerResponse(
            id=ledger_entry.id,
            hotel_id=ledger_entry.hotel_id,
            item_id=ledger_entry.item_id,
            item_name=item.name,
            item_sku=item.sku,
            store_id=ledger_entry.store_id,
            store_code=store.store_code,
            store_name=store.store_name,
            movement_type=ledger_entry.movement_type,
            reference_no=ledger_entry.reference_no,
            department=ledger_entry.department,
            supplier_id=ledger_entry.supplier_id,
            supplier_name=item.supplier.vendor_name if item.supplier else None,
            quantity_in=ledger_entry.quantity_in,
            quantity_out=ledger_entry.quantity_out,
            balance_after=ledger_entry.balance_after,
            unit_cost=ledger_entry.unit_cost,
            total_value=ledger_entry.total_value,
            notes=ledger_entry.notes,
            created_by=ledger_entry.created_by,
            created_at=ledger_entry.created_at,
        )

    def get_stock_ledger(
        self,
        hotel_id: Optional[int],
        item_id: Optional[int],
        store_id: Optional[int],
        movement_type: Optional[str],
        department: Optional[str],
        supplier_id: Optional[int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
        current_user: models.User,
    ) -> schemas.PaginatedStockLedgerResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        items, total = self.repo.list_stock_ledger(
            hotel_id=target_hotel_id,
            item_id=item_id,
            store_id=store_id,
            movement_type=movement_type,
            department=department,
            supplier_id=supplier_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        annotated: List[schemas.StockLedgerResponse] = []
        for l in items:
            annotated.append(
                schemas.StockLedgerResponse(
                    id=l.id,
                    hotel_id=l.hotel_id,
                    item_id=l.item_id,
                    item_name=l.item.name if l.item else None,
                    item_sku=l.item.sku if l.item else None,
                    store_id=l.store_id,
                    store_code=l.store.store_code if l.store else None,
                    store_name=l.store.store_name if l.store else None,
                    movement_type=l.movement_type,
                    reference_no=l.reference_no,
                    department=l.department,
                    supplier_id=l.supplier_id,
                    supplier_name=l.supplier.vendor_name if l.supplier else None,
                    quantity_in=l.quantity_in,
                    quantity_out=l.quantity_out,
                    balance_after=l.balance_after,
                    unit_cost=l.unit_cost,
                    total_value=l.total_value,
                    notes=l.notes,
                    created_by=l.created_by,
                    created_at=l.created_at,
                )
            )

        return schemas.PaginatedStockLedgerResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=annotated,
        )

    def create_stock_transaction(
        self,
        transaction: schemas.StockTransactionCreate,
        current_user: models.User,
    ) -> models.StockTransaction:
        self._assert_can_manage(current_user, "create stock transactions")

        if transaction.transaction_type == "receive":
            movement_type = "PURCHASE_RECEIVE"
        elif transaction.transaction_type == "issue":
            movement_type = "DEPT_ISSUE"
        elif transaction.transaction_type == "adjust":
            movement_type = "ADJUSTMENT_OUT"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid transaction type. Allowed: {self.ALLOWED_TRANSACTION_TYPES}",
            )

        movement_req = schemas.StockMovementRequest(
            item_id=transaction.item_id,
            store_id=transaction.store_id,
            quantity=transaction.quantity,
            movement_type=movement_type,
            reference_no=transaction.reference,
            notes=transaction.reason,
        )
        self.execute_stock_movement(movement_req, current_user)

        item = self.repo.get_item_by_id(transaction.item_id)
        tx = models.StockTransaction(
            hotel_id=item.hotel_id,
            item_id=item.id,
            transaction_type=transaction.transaction_type,
            quantity=transaction.quantity,
            reason=transaction.reason,
            reference=transaction.reference,
            created_by=transaction.created_by or current_user.username,
        )
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def get_stock_transactions(
        self,
        hotel_id: Optional[int],
        item_id: Optional[int],
        transaction_type: Optional[str],
        current_user: models.User,
    ) -> List[models.StockTransaction]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_stock_transactions(
            hotel_id=target_hotel_id,
            item_id=item_id,
            transaction_type=transaction_type,
        )

    def create_store(
        self,
        store: schemas.InventoryStoreCreate,
        current_user: models.User,
    ) -> models.InventoryStore:
        self._assert_can_manage(current_user, "create inventory stores")
        self._assert_owns_hotel(current_user, store.hotel_id, "You can create stores only for your own hotel")

        existing_code = self.repo.get_store_by_code(store.hotel_id, store.store_code)
        if existing_code:
            raise HTTPException(status_code=400, detail=f"Store code '{store.store_code}' already exists for this hotel")

        existing_name = self.repo.get_store_by_name(store.hotel_id, store.store_name)
        if existing_name:
            raise HTTPException(status_code=400, detail=f"Store name '{store.store_name}' already exists for this hotel")

        return self.repo.create_store(store.model_dump())

    def get_stores(
        self,
        hotel_id: Optional[int],
        active_only: bool,
        current_user: models.User,
    ) -> List[models.InventoryStore]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_stores(hotel_id=target_hotel_id, active_only=active_only)

    def get_store(self, store_id: int, current_user: models.User) -> models.InventoryStore:
        store = self.repo.get_store_by_id(store_id)
        if not store:
            raise HTTPException(status_code=404, detail="Store location not found")
        self._assert_owns_hotel(current_user, store.hotel_id, "Access denied to store")
        return store

    def update_store(
        self,
        store_id: int,
        store_update: schemas.InventoryStoreUpdate,
        current_user: models.User,
    ) -> models.InventoryStore:
        self._assert_can_manage(current_user, "update inventory stores")
        store = self.get_store(store_id, current_user)

        update_data = store_update.model_dump(exclude_unset=True)
        code_check = update_data.get("store_code", store.store_code)
        name_check = update_data.get("store_name", store.store_name)

        dup = self.repo.get_duplicate_store(store.hotel_id, code_check, name_check, store_id)
        if dup:
            raise HTTPException(status_code=400, detail="Another store with this code or name already exists")

        return self.repo.update_store(store, update_data)

    def delete_store(self, store_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user, "delete inventory stores")
        store = self.get_store(store_id, current_user)

        if store.is_main_store:
            raise HTTPException(status_code=400, detail="Cannot delete the designated Main Store. Reassign main status first.")

        if self.repo.store_has_stock(store.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete store because physical stock currently exists in this location. Transfer stock first or deactivate store.",
            )

        self.repo.delete_store(store)
        return {"message": "Store location deleted successfully"}

    def get_item_location_stocks(
        self,
        item_id: int,
        current_user: models.User,
    ) -> List[schemas.LocationStockResponse]:
        item = self.repo.get_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        self._assert_owns_hotel(current_user, item.hotel_id, "Access denied to item")

        records = self.repo.list_location_stocks_for_item(item.hotel_id, item.id)
        result = []
        for r in records:
            result.append(
                schemas.LocationStockResponse(
                    id=r.id,
                    hotel_id=r.hotel_id,
                    item_id=r.item_id,
                    store_id=r.store_id,
                    store_code=r.store.store_code,
                    store_name=r.store.store_name,
                    current_stock=r.current_stock,
                    updated_at=r.updated_at,
                )
            )
        return result

    def create_supplier(
        self,
        vendor: schemas.VendorCreate,
        current_user: models.User,
    ) -> models.Vendor:
        self._assert_can_manage(current_user, "create suppliers")
        self._assert_owns_hotel(current_user, vendor.hotel_id, "You can create suppliers only for your own hotel")
        return self.repo.create_vendor(vendor.model_dump())

    def get_suppliers(
        self,
        hotel_id: Optional[int],
        active_only: bool,
        current_user: models.User,
    ) -> List[models.Vendor]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_vendors(target_hotel_id, active_only=active_only)

    def get_supplier(self, supplier_id: int, current_user: models.User) -> models.Vendor:
        target_hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        vendor = self.repo.get_vendor_by_id(supplier_id, target_hotel_id or current_user.hotel_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Supplier not found")
        return vendor

    def update_supplier(
        self,
        supplier_id: int,
        vendor_update: schemas.VendorUpdate,
        current_user: models.User,
    ) -> models.Vendor:
        self._assert_can_manage(current_user, "update suppliers")
        vendor = self.get_supplier(supplier_id, current_user)
        return self.repo.update_vendor(vendor, vendor_update.model_dump(exclude_unset=True))

    def create_category(
        self,
        category: schemas.InventoryCategoryCreate,
        current_user: models.User,
    ) -> models.InventoryCategory:
        self._assert_can_manage(current_user, "create inventory categories")
        self._assert_owns_hotel(current_user, category.hotel_id, "You can create categories only for your own hotel")

        existing = self.repo.get_category_by_name(category.hotel_id, category.name)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Category with name '{category.name}' already exists for this hotel",
            )

        return self.repo.create_category(category.model_dump())

    def get_categories(
        self,
        hotel_id: Optional[int],
        active_only: bool,
        current_user: models.User,
    ) -> List[models.InventoryCategory]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_categories(hotel_id=target_hotel_id, active_only=active_only)

    def get_category(self, category_id: int, current_user: models.User) -> models.InventoryCategory:
        cat = self.repo.get_category_by_id(category_id)
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
        self._assert_owns_hotel(current_user, cat.hotel_id, "Access denied to category")
        return cat

    def update_category(
        self,
        category_id: int,
        category_update: schemas.InventoryCategoryUpdate,
        current_user: models.User,
    ) -> models.InventoryCategory:
        self._assert_can_manage(current_user, "update inventory categories")
        cat = self.get_category(category_id, current_user)

        update_data = category_update.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"]:
            dup = self.repo.get_duplicate_category_name(cat.hotel_id, update_data["name"], category_id)
            if dup:
                raise HTTPException(status_code=400, detail=f"Category with name '{update_data['name']}' already exists")

        return self.repo.update_category(cat, update_data)

    def delete_category(self, category_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user, "delete inventory categories")
        cat = self.get_category(category_id, current_user)

        if self.repo.has_items_in_category(cat.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete category because it is assigned to inventory items. Deactivate it instead.",
            )

        self.repo.delete_category(cat)
        return {"message": "Category deleted successfully"}

    def create_unit(
        self,
        unit: schemas.InventoryUnitCreate,
        current_user: models.User,
    ) -> models.InventoryUnit:
        self._assert_can_manage(current_user, "create inventory units")
        self._assert_owns_hotel(current_user, unit.hotel_id, "You can create units only for your own hotel")

        existing_name = self.repo.get_unit_by_name(unit.hotel_id, unit.name)
        if existing_name:
            raise HTTPException(status_code=400, detail=f"Unit with name '{unit.name}' already exists for this hotel")

        existing_code = self.repo.get_unit_by_code(unit.hotel_id, unit.code)
        if existing_code:
            raise HTTPException(status_code=400, detail=f"Unit code '{unit.code}' already exists for this hotel")

        return self.repo.create_unit(unit.model_dump())

    def get_units(
        self,
        hotel_id: Optional[int],
        active_only: bool,
        current_user: models.User,
    ) -> List[models.InventoryUnit]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_units(hotel_id=target_hotel_id, active_only=active_only)

    def get_unit(self, unit_id: int, current_user: models.User) -> models.InventoryUnit:
        unit = self.repo.get_unit_by_id(unit_id)
        if not unit:
            raise HTTPException(status_code=404, detail="Unit of measure not found")
        self._assert_owns_hotel(current_user, unit.hotel_id, "Access denied to unit")
        return unit

    def update_unit(
        self,
        unit_id: int,
        unit_update: schemas.InventoryUnitUpdate,
        current_user: models.User,
    ) -> models.InventoryUnit:
        self._assert_can_manage(current_user, "update inventory units")
        unit = self.get_unit(unit_id, current_user)

        update_data = unit_update.model_dump(exclude_unset=True)
        name_check = update_data.get("name", unit.name)
        code_check = update_data.get("code", unit.code)

        dup = self.repo.get_duplicate_unit(unit.hotel_id, name_check, code_check, unit_id)
        if dup:
            raise HTTPException(status_code=400, detail="Another unit with this name or code already exists")

        return self.repo.update_unit(unit, update_data)

    def delete_unit(self, unit_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user, "delete inventory units")
        unit = self.get_unit(unit_id, current_user)

        if self.repo.has_items_using_unit(unit.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete unit because it is currently assigned to items. Deactivate it instead.",
            )

        self.repo.delete_unit(unit)
        return {"message": "Unit of measure deleted successfully"}

    def _enrich_item_response(self, item: models.InventoryItem) -> schemas.InventoryItemResponse:
        data = schemas.InventoryItemResponse.model_validate(item)
        if item.category_rel:
            data.category_name = item.category_rel.name
        elif item.category:
            data.category_name = item.category

        if item.unit_rel:
            data.unit_name = item.unit_rel.name
            data.unit_code = item.unit_rel.code
        else:
            data.unit_name = item.unit
            data.unit_code = item.unit

        if item.supplier:
            data.preferred_supplier_name = item.supplier.vendor_name
        elif item.supplier_name:
            data.preferred_supplier_name = item.supplier_name

        if item.location_stocks:
            data.locations = [
                schemas.LocationStockResponse(
                    id=ls.id,
                    hotel_id=ls.hotel_id,
                    item_id=ls.item_id,
                    store_id=ls.store_id,
                    store_code=ls.store.store_code,
                    store_name=ls.store.store_name,
                    current_stock=ls.current_stock,
                    updated_at=ls.updated_at,
                )
                for ls in item.location_stocks
            ]

        data.total_stock_value = round(item.current_stock * item.average_cost, 2)
        return data

    def create_inventory_item(
        self,
        item: schemas.InventoryItemCreate,
        current_user: models.User,
    ) -> schemas.InventoryItemResponse:
        self._assert_can_manage(current_user, "create inventory items")
        target_hotel_id = item.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            first_hotel = self.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
            target_hotel_id = first_hotel.id if first_hotel else 1

        self._assert_owns_hotel(
            current_user,
            target_hotel_id,
            "You can create inventory items only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        existing_item = self.repo.get_item_by_sku(target_hotel_id, item.sku)
        if existing_item:
            raise HTTPException(
                status_code=400,
                detail="Inventory item with this SKU already exists for this hotel",
            )

        item_dict = item.model_dump()
        item_dict["hotel_id"] = target_hotel_id
        initial_stock = item_dict.get("current_stock", 0.0) or item_dict.get("opening_stock", 0.0)
        item_dict["current_stock"] = 0.0

        if item.category_id:
            category_obj = self.repo.get_category_by_id(item.category_id)
            if not category_obj or category_obj.hotel_id != target_hotel_id:
                raise HTTPException(status_code=400, detail="Invalid category_id for this hotel")
            item_dict["category"] = category_obj.name
        elif item.category:
            existing_cat = self.repo.get_category_by_name(target_hotel_id, item.category)
            if existing_cat:
                item_dict["category_id"] = existing_cat.id

        if item.unit_id:
            unit_obj = self.repo.get_unit_by_id(item.unit_id)
            if not unit_obj or unit_obj.hotel_id != target_hotel_id:
                raise HTTPException(status_code=400, detail="Invalid unit_id for this hotel")
            item_dict["unit"] = unit_obj.name
        elif item.unit:
            existing_unit = self.repo.get_unit_by_name(target_hotel_id, item.unit)
            if existing_unit:
                item_dict["unit_id"] = existing_unit.id

        if item.supplier_id:
            vendor = self.repo.get_vendor_by_id(item.supplier_id, target_hotel_id)
            if not vendor:
                raise HTTPException(status_code=400, detail="Preferred supplier not found for this hotel")
            item_dict["supplier_name"] = vendor.vendor_name

        created = self.repo.create_item(item_dict)

        if initial_stock > 0:
            default_store = self.repo.get_or_create_default_store(created.hotel_id)
            opening_req = schemas.StockMovementRequest(
                item_id=created.id,
                store_id=default_store.id,
                quantity=initial_stock,
                unit_cost=created.purchase_price or created.average_cost,
                movement_type="OPENING",
                notes="Initial opening stock creation",
            )
            self.execute_stock_movement(opening_req, current_user)
            self.db.refresh(created)

        return self._enrich_item_response(created)

    def get_inventory_items(
        self,
        hotel_id: Optional[int],
        category: Optional[str],
        category_id: Optional[int],
        low_stock_only: bool,
        current_user: models.User,
    ) -> List[schemas.InventoryItemResponse]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        items = self.repo.list_items(
            hotel_id=target_hotel_id,
            category=category,
            category_id=category_id,
            low_stock_only=low_stock_only,
        )
        return [self._enrich_item_response(it) for it in items]

    def get_inventory_item(self, item_id: int, current_user: models.User) -> schemas.InventoryItemResponse:
        item = self.repo.get_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        self._assert_owns_hotel(
            current_user,
            item.hotel_id,
            "You can view only inventory items from your own hotel",
        )
        return self._enrich_item_response(item)

    def update_inventory_item(
        self,
        item_id: int,
        item_update: schemas.InventoryItemUpdate,
        current_user: models.User,
    ) -> schemas.InventoryItemResponse:
        self._assert_can_manage(current_user, "update inventory items")

        item = self.repo.get_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        self._assert_owns_hotel(
            current_user,
            item.hotel_id,
            "You can update only inventory items from your own hotel",
        )

        update_data = item_update.model_dump(exclude_unset=True)

        if "sku" in update_data and update_data["sku"]:
            duplicate_item = self.repo.get_duplicate_sku_item(
                hotel_id=item.hotel_id,
                sku=update_data["sku"],
                exclude_item_id=item_id,
            )
            if duplicate_item:
                raise HTTPException(
                    status_code=400,
                    detail="Another inventory item with this SKU already exists for this hotel",
                )

        if "min_stock_level" in update_data and update_data["min_stock_level"] is not None and update_data["min_stock_level"] < 0:
            raise HTTPException(status_code=400, detail="Minimum stock level cannot be negative")

        if "reorder_level" in update_data and update_data["reorder_level"] is not None and update_data["reorder_level"] < 0:
            raise HTTPException(status_code=400, detail="Reorder level cannot be negative")

        if "category_id" in update_data and update_data["category_id"] is not None:
            cat = self.repo.get_category_by_id(update_data["category_id"])
            if not cat or cat.hotel_id != item.hotel_id:
                raise HTTPException(status_code=400, detail="Invalid category_id for this hotel")
            update_data["category"] = cat.name

        if "unit_id" in update_data and update_data["unit_id"] is not None:
            u = self.repo.get_unit_by_id(update_data["unit_id"])
            if not u or u.hotel_id != item.hotel_id:
                raise HTTPException(status_code=400, detail="Invalid unit_id for this hotel")
            update_data["unit"] = u.name

        if "supplier_id" in update_data and update_data["supplier_id"] is not None:
            vendor = self.repo.get_vendor_by_id(update_data["supplier_id"], item.hotel_id)
            if not vendor:
                raise HTTPException(status_code=400, detail="Supplier not found for this hotel")
            update_data["supplier_name"] = vendor.vendor_name

        updated = self.repo.update_item(item, update_data)
        return self._enrich_item_response(updated)

    def delete_inventory_item(self, item_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user, "delete inventory items")

        item = self.repo.get_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        self._assert_owns_hotel(
            current_user,
            item.hotel_id,
            "You can delete only inventory items from your own hotel",
        )

        if self.repo.has_stock_transactions(item.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete inventory item because historical stock transactions or ledger records exist. Deactivate it instead.",
            )

        self.repo.delete_item(item)
        return {"message": "Inventory item deleted successfully"}