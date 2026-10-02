from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models


class InventoryRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Inventory Reports (Phase 11)
    # -------------------------------------------------------------

    def get_stock_report_data(
        self,
        hotel_id: int,
        category_id: Optional[int] = None,
        store_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        query = self.db.query(models.InventoryItem).filter(
            models.InventoryItem.hotel_id == hotel_id,
            models.InventoryItem.is_active == True,
        )
        if category_id:
            query = query.filter(models.InventoryItem.category_id == category_id)

        items = query.order_by(models.InventoryItem.name.asc()).all()
        rows = []
        for it in items:
            if store_id:
                loc = (
                    self.db.query(models.InventoryLocationStock)
                    .filter(
                        models.InventoryLocationStock.hotel_id == hotel_id,
                        models.InventoryLocationStock.item_id == it.id,
                        models.InventoryLocationStock.store_id == store_id,
                    )
                    .first()
                )
                qty = loc.current_stock if loc else 0.0
            else:
                qty = it.current_stock

            status = "Out of Stock" if qty <= 0 else ("Low Stock" if qty <= it.reorder_level else "In Stock")
            rows.append({
                "item_id": it.id,
                "sku": it.sku,
                "name": it.name,
                "category": it.category_rel.name if it.category_rel else (it.category or "Uncategorized"),
                "unit": it.unit_rel.name if it.unit_rel else it.unit,
                "current_stock": round(qty, 2),
                "reorder_level": round(it.reorder_level, 2),
                "average_cost": round(it.average_cost, 2),
                "total_value": round(qty * it.average_cost, 2),
                "status": status,
            })
        return rows

    def get_low_stock_report_data(self, hotel_id: int) -> List[Dict[str, Any]]:
        items = (
            self.db.query(models.InventoryItem)
            .filter(
                models.InventoryItem.hotel_id == hotel_id,
                models.InventoryItem.is_active == True,
                models.InventoryItem.current_stock <= models.InventoryItem.reorder_level,
            )
            .order_by(models.InventoryItem.current_stock.asc())
            .all()
        )
        rows = []
        for it in items:
            deficit = max(0.0, it.reorder_level - it.current_stock)
            rows.append({
                "item_id": it.id,
                "sku": it.sku,
                "name": it.name,
                "category": it.category_rel.name if it.category_rel else (it.category or "Uncategorized"),
                "unit": it.unit_rel.name if it.unit_rel else it.unit,
                "current_stock": round(it.current_stock, 2),
                "reorder_level": round(it.reorder_level, 2),
                "min_stock_level": round(it.min_stock_level, 2),
                "reorder_deficit": round(deficit, 2),
                "average_cost": round(it.average_cost, 2),
                "estimated_reorder_cost": round(deficit * it.average_cost, 2),
                "preferred_supplier": it.supplier.vendor_name if it.supplier else it.supplier_name,
            })
        return rows

    def get_department_consumption_report_data(
        self,
        hotel_id: int,
        department: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        query = (
            self.db.query(
                models.InventoryStockLedger.department,
                models.InventoryItem.id.label("item_id"),
                models.InventoryItem.sku,
                models.InventoryItem.name,
                models.InventoryItem.unit,
                func.sum(models.InventoryStockLedger.quantity_out).label("total_qty"),
                models.InventoryItem.average_cost,
                func.sum(models.InventoryStockLedger.total_value).label("total_cost"),
            )
            .join(models.InventoryItem, models.InventoryStockLedger.item_id == models.InventoryItem.id)
            .filter(
                models.InventoryStockLedger.hotel_id == hotel_id,
                models.InventoryStockLedger.movement_type.in_(["DEPT_ISSUE", "CONSUMPTION"]),
            )
        )
        if department:
            query = query.filter(models.InventoryStockLedger.department.ilike(f"%{department.strip()}%"))
        if date_from:
            query = query.filter(models.InventoryStockLedger.created_at >= date_from)
        if date_to:
            query = query.filter(models.InventoryStockLedger.created_at <= date_to)

        results = (
            query.group_by(
                models.InventoryStockLedger.department,
                models.InventoryItem.id,
                models.InventoryItem.sku,
                models.InventoryItem.name,
                models.InventoryItem.unit,
                models.InventoryItem.average_cost,
            )
            .order_by(func.sum(models.InventoryStockLedger.total_value).desc())
            .all()
        )
        return [
            {
                "department": r.department or "General",
                "item_id": r.item_id,
                "sku": r.sku,
                "name": r.name,
                "unit": r.unit,
                "total_quantity": round(float(r.total_qty or 0.0), 2),
                "average_cost": round(float(r.average_cost or 0.0), 2),
                "total_cost": round(float(r.total_cost or 0.0), 2),
            }
            for r in results
        ]

    def get_wastage_report_data(
        self,
        hotel_id: int,
        waste_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        query = self.db.query(models.InventoryWastage).filter(models.InventoryWastage.hotel_id == hotel_id)
        if waste_type:
            query = query.filter(models.InventoryWastage.waste_type == waste_type)
        if date_from:
            query = query.filter(models.InventoryWastage.wastage_date >= date_from)
        if date_to:
            query = query.filter(models.InventoryWastage.wastage_date <= date_to)

        wasts = query.order_by(models.InventoryWastage.wastage_date.desc()).all()
        return [
            {
                "id": w.id,
                "wastage_no": w.wastage_no,
                "wastage_date": w.wastage_date,
                "waste_type": w.waste_type,
                "item_id": w.item_id,
                "item_name": w.item.name if w.item else "",
                "item_sku": w.item.sku if w.item else "",
                "store_name": w.store.store_name if w.store else "",
                "department": w.department,
                "quantity": w.quantity,
                "unit_cost": w.unit_cost,
                "total_cost": w.total_cost,
                "reason": w.reason,
                "reported_by": w.reported_by,
            }
            for w in wasts
        ]

    def get_reconciliation_report_data(self, hotel_id: int, store_id: Optional[int] = None) -> List[Dict[str, Any]]:
        query = (
            self.db.query(
                models.PhysicalStockCount.id.label("count_id"),
                models.PhysicalStockCount.count_no,
                models.PhysicalStockCount.count_date,
                models.InventoryStore.store_name,
                models.PhysicalStockCountItem.item_id,
                models.InventoryItem.name.label("item_name"),
                models.InventoryItem.sku.label("item_sku"),
                models.PhysicalStockCountItem.system_stock,
                models.PhysicalStockCountItem.physical_stock,
                models.PhysicalStockCountItem.variance,
                models.InventoryItem.average_cost,
                models.PhysicalStockCount.status,
            )
            .join(models.PhysicalStockCountItem, models.PhysicalStockCount.id == models.PhysicalStockCountItem.physical_stock_count_id)
            .join(models.InventoryItem, models.PhysicalStockCountItem.item_id == models.InventoryItem.id)
            .join(models.InventoryStore, models.PhysicalStockCount.store_id == models.InventoryStore.id)
            .filter(models.PhysicalStockCount.hotel_id == hotel_id)
        )
        if store_id:
            query = query.filter(models.PhysicalStockCount.store_id == store_id)

        records = query.order_by(models.PhysicalStockCount.count_date.desc()).all()
        return [
            {
                "count_id": r.count_id,
                "count_no": r.count_no,
                "count_date": r.count_date,
                "store_name": r.store_name,
                "item_id": r.item_id,
                "item_name": r.item_name,
                "item_sku": r.item_sku,
                "system_stock": round(float(r.system_stock), 2),
                "physical_stock": round(float(r.physical_stock), 2),
                "variance": round(float(r.variance), 2),
                "unit_cost": round(float(r.average_cost), 2),
                "variance_value": round(float(r.variance * r.average_cost), 2),
                "status": r.status,
            }
            for r in records
        ]

    # -------------------------------------------------------------
    # Dashboard Analytics (Phase 10)
    # -------------------------------------------------------------

    def get_dashboard_kpis(self, hotel_id: int) -> Dict[str, Any]:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        total_items = (
            self.db.query(func.count(models.InventoryItem.id))
            .filter(models.InventoryItem.hotel_id == hotel_id, models.InventoryItem.is_active == True)
            .scalar() or 0
        )

        total_stock_value = (
            self.db.query(func.sum(models.InventoryItem.current_stock * models.InventoryItem.average_cost))
            .filter(models.InventoryItem.hotel_id == hotel_id, models.InventoryItem.is_active == True)
            .scalar() or 0.0
        )

        low_stock_items = (
            self.db.query(func.count(models.InventoryItem.id))
            .filter(
                models.InventoryItem.hotel_id == hotel_id,
                models.InventoryItem.is_active == True,
                models.InventoryItem.current_stock > 0,
                models.InventoryItem.current_stock <= models.InventoryItem.reorder_level,
            )
            .scalar() or 0
        )

        out_of_stock_items = (
            self.db.query(func.count(models.InventoryItem.id))
            .filter(
                models.InventoryItem.hotel_id == hotel_id,
                models.InventoryItem.is_active == True,
                models.InventoryItem.current_stock <= 0,
            )
            .scalar() or 0
        )

        today_stock_in = (
            self.db.query(func.sum(models.InventoryStockLedger.quantity_in))
            .filter(
                models.InventoryStockLedger.hotel_id == hotel_id,
                models.InventoryStockLedger.created_at >= today_start,
            )
            .scalar() or 0.0
        )

        today_stock_out = (
            self.db.query(func.sum(models.InventoryStockLedger.quantity_out))
            .filter(
                models.InventoryStockLedger.hotel_id == hotel_id,
                models.InventoryStockLedger.created_at >= today_start,
            )
            .scalar() or 0.0
        )

        today_consumption_val = (
            self.db.query(func.sum(models.InventoryStockLedger.total_value))
            .filter(
                models.InventoryStockLedger.hotel_id == hotel_id,
                models.InventoryStockLedger.created_at >= today_start,
                models.InventoryStockLedger.movement_type.in_(["CONSUMPTION", "DEPT_ISSUE"]),
            )
            .scalar() or 0.0
        )

        pending_reorders = (
            self.db.query(func.count(models.InventoryItem.id))
            .filter(
                models.InventoryItem.hotel_id == hotel_id,
                models.InventoryItem.is_active == True,
                models.InventoryItem.current_stock <= models.InventoryItem.reorder_level,
            )
            .scalar() or 0
        )

        return {
            "total_items": total_items,
            "total_stock_value": round(float(total_stock_value), 2),
            "low_stock_items": low_stock_items,
            "out_of_stock_items": out_of_stock_items,
            "today_stock_in": round(float(today_stock_in), 2),
            "today_stock_out": round(float(today_stock_out), 2),
            "today_consumption_value": round(float(today_consumption_val), 2),
            "pending_reorders": pending_reorders,
        }

    def get_dashboard_department_consumption(self, hotel_id: int) -> List[Dict[str, Any]]:
        results = (
            self.db.query(
                models.InventoryStockLedger.department,
                func.sum(models.InventoryStockLedger.quantity_out).label("total_qty"),
                func.sum(models.InventoryStockLedger.total_value).label("total_val"),
            )
            .filter(
                models.InventoryStockLedger.hotel_id == hotel_id,
                models.InventoryStockLedger.movement_type.in_(["DEPT_ISSUE", "CONSUMPTION"]),
                models.InventoryStockLedger.department.isnot(None),
            )
            .group_by(models.InventoryStockLedger.department)
            .order_by(func.sum(models.InventoryStockLedger.total_value).desc())
            .all()
        )
        return [
            {
                "department": r.department or "General",
                "total_quantity": round(float(r.total_qty or 0.0), 2),
                "total_value": round(float(r.total_val or 0.0), 2),
            }
            for r in results
        ]

    def get_dashboard_category_valuations(self, hotel_id: int) -> List[Dict[str, Any]]:
        results = (
            self.db.query(
                models.InventoryItem.category_id,
                func.coalesce(models.InventoryCategory.name, models.InventoryItem.category, "Uncategorized").label("cat_name"),
                func.count(models.InventoryItem.id).label("item_count"),
                func.sum(models.InventoryItem.current_stock).label("total_stock"),
                func.sum(models.InventoryItem.current_stock * models.InventoryItem.average_cost).label("total_val"),
            )
            .outerjoin(models.InventoryCategory, models.InventoryItem.category_id == models.InventoryCategory.id)
            .filter(models.InventoryItem.hotel_id == hotel_id, models.InventoryItem.is_active == True)
            .group_by(models.InventoryItem.category_id, models.InventoryCategory.name, models.InventoryItem.category)
            .order_by(func.sum(models.InventoryItem.current_stock * models.InventoryItem.average_cost).desc())
            .all()
        )
        return [
            {
                "category_id": r.category_id,
                "category_name": r.cat_name,
                "item_count": r.item_count,
                "total_stock": round(float(r.total_stock or 0.0), 2),
                "total_value": round(float(r.total_val or 0.0), 2),
            }
            for r in results
        ]

    def get_dashboard_top_consumed_items(self, hotel_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        results = (
            self.db.query(
                models.InventoryItem.id,
                models.InventoryItem.name,
                models.InventoryItem.sku,
                models.InventoryItem.unit,
                func.sum(models.InventoryStockLedger.quantity_out).label("consumed_qty"),
                func.sum(models.InventoryStockLedger.total_value).label("consumed_val"),
            )
            .join(models.InventoryStockLedger, models.InventoryItem.id == models.InventoryStockLedger.item_id)
            .filter(
                models.InventoryStockLedger.hotel_id == hotel_id,
                models.InventoryStockLedger.movement_type.in_(["DEPT_ISSUE", "CONSUMPTION"]),
            )
            .group_by(models.InventoryItem.id, models.InventoryItem.name, models.InventoryItem.sku, models.InventoryItem.unit)
            .order_by(func.sum(models.InventoryStockLedger.quantity_out).desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "item_id": r.id,
                "item_name": r.name,
                "item_sku": r.sku,
                "unit": r.unit,
                "total_quantity": round(float(r.consumed_qty or 0.0), 2),
                "total_cost": round(float(r.consumed_val or 0.0), 2),
            }
            for r in results
        ]

    def get_dashboard_low_stock_alerts(self, hotel_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        items = (
            self.db.query(models.InventoryItem)
            .filter(
                models.InventoryItem.hotel_id == hotel_id,
                models.InventoryItem.is_active == True,
                models.InventoryItem.current_stock <= models.InventoryItem.reorder_level,
            )
            .order_by(models.InventoryItem.current_stock.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "item_id": it.id,
                "item_name": it.name,
                "item_sku": it.sku,
                "current_stock": it.current_stock,
                "min_stock_level": it.min_stock_level,
                "reorder_level": it.reorder_level,
                "deficit": round(max(0.0, it.reorder_level - it.current_stock), 2),
                "unit": it.unit,
                "preferred_supplier_name": it.supplier.vendor_name if it.supplier else it.supplier_name,
            }
            for it in items
        ]

    def get_dashboard_recent_activity(self, hotel_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        entries = (
            self.db.query(models.InventoryStockLedger)
            .filter(models.InventoryStockLedger.hotel_id == hotel_id)
            .order_by(models.InventoryStockLedger.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": e.id,
                "item_id": e.item_id,
                "item_name": e.item.name if e.item else None,
                "store_name": e.store.store_name if e.store else None,
                "movement_type": e.movement_type,
                "reference_no": e.reference_no,
                "quantity_in": e.quantity_in,
                "quantity_out": e.quantity_out,
                "balance_after": e.balance_after,
                "total_value": e.total_value,
                "created_by": e.created_by,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]

    # -------------------------------------------------------------
    # Physical Stock Count Methods (Phase 9)
    # -------------------------------------------------------------

    def generate_count_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"CNT-{current_year}-"
        last_cnt = (
            self.db.query(models.PhysicalStockCount)
            .filter(
                models.PhysicalStockCount.hotel_id == hotel_id,
                models.PhysicalStockCount.count_no.like(f"{prefix}%"),
            )
            .order_by(models.PhysicalStockCount.id.desc())
            .first()
        )
        if last_cnt and last_cnt.count_no:
            try:
                seq = int(last_cnt.count_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_physical_count_record(self, count_data: Dict[str, Any]) -> models.PhysicalStockCount:
        cnt = models.PhysicalStockCount(**count_data)
        self.db.add(cnt)
        self.db.flush()
        return cnt

    def create_physical_count_item_record(self, item_data: Dict[str, Any]) -> models.PhysicalStockCountItem:
        cnt_item = models.PhysicalStockCountItem(**item_data)
        self.db.add(cnt_item)
        self.db.flush()
        return cnt_item

    def get_physical_count_by_id(self, count_id: int, hotel_id: int) -> Optional[models.PhysicalStockCount]:
        return (
            self.db.query(models.PhysicalStockCount)
            .filter(
                models.PhysicalStockCount.id == count_id,
                models.PhysicalStockCount.hotel_id == hotel_id,
            )
            .first()
        )

    def list_physical_counts(
        self,
        hotel_id: int,
        store_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.PhysicalStockCount], int]:
        query = self.db.query(models.PhysicalStockCount).filter(models.PhysicalStockCount.hotel_id == hotel_id)
        if store_id is not None:
            query = query.filter(models.PhysicalStockCount.store_id == store_id)
        if status is not None:
            query = query.filter(models.PhysicalStockCount.status == status)

        total = query.count()
        counts = (
            query.order_by(models.PhysicalStockCount.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return counts, total

    # -------------------------------------------------------------
    # Adjustments & Wastages (Phase 8)
    # -------------------------------------------------------------

    def generate_adjustment_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"ADJ-{current_year}-"
        last_adj = (
            self.db.query(models.InventoryAdjustment)
            .filter(
                models.InventoryAdjustment.hotel_id == hotel_id,
                models.InventoryAdjustment.adjustment_no.like(f"{prefix}%"),
            )
            .order_by(models.InventoryAdjustment.id.desc())
            .first()
        )
        if last_adj and last_adj.adjustment_no:
            try:
                seq = int(last_adj.adjustment_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_adjustment_record(self, adj_data: Dict[str, Any]) -> models.InventoryAdjustment:
        adj = models.InventoryAdjustment(**adj_data)
        self.db.add(adj)
        self.db.flush()
        return adj

    def list_adjustments(
        self,
        hotel_id: int,
        store_id: Optional[int] = None,
        item_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryAdjustment], int]:
        query = self.db.query(models.InventoryAdjustment).filter(models.InventoryAdjustment.hotel_id == hotel_id)
        if store_id is not None:
            query = query.filter(models.InventoryAdjustment.store_id == store_id)
        if item_id is not None:
            query = query.filter(models.InventoryAdjustment.item_id == item_id)
        if date_from is not None:
            query = query.filter(models.InventoryAdjustment.adjustment_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryAdjustment.adjustment_date <= date_to)

        total = query.count()
        adjs = (
            query.order_by(models.InventoryAdjustment.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return adjs, total

    def generate_wastage_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"WST-{current_year}-"
        last_wst = (
            self.db.query(models.InventoryWastage)
            .filter(
                models.InventoryWastage.hotel_id == hotel_id,
                models.InventoryWastage.wastage_no.like(f"{prefix}%"),
            )
            .order_by(models.InventoryWastage.id.desc())
            .first()
        )
        if last_wst and last_wst.wastage_no:
            try:
                seq = int(last_wst.wastage_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_wastage_record(self, wst_data: Dict[str, Any]) -> models.InventoryWastage:
        wst = models.InventoryWastage(**wst_data)
        self.db.add(wst)
        self.db.flush()
        return wst

    def list_wastages(
        self,
        hotel_id: int,
        waste_type: Optional[str] = None,
        store_id: Optional[int] = None,
        item_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryWastage], int]:
        query = self.db.query(models.InventoryWastage).filter(models.InventoryWastage.hotel_id == hotel_id)
        if waste_type is not None:
            query = query.filter(models.InventoryWastage.waste_type == waste_type)
        if store_id is not None:
            query = query.filter(models.InventoryWastage.store_id == store_id)
        if item_id is not None:
            query = query.filter(models.InventoryWastage.item_id == item_id)
        if date_from is not None:
            query = query.filter(models.InventoryWastage.wastage_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryWastage.wastage_date <= date_to)

        total = query.count()
        wsts = (
            query.order_by(models.InventoryWastage.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return wsts, total

    # -------------------------------------------------------------
    # Returns & Transfers (Phase 7)
    # -------------------------------------------------------------

    def generate_return_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"RET-{current_year}-"
        last_ret = (
            self.db.query(models.InventoryReturn)
            .filter(
                models.InventoryReturn.hotel_id == hotel_id,
                models.InventoryReturn.return_no.like(f"{prefix}%"),
            )
            .order_by(models.InventoryReturn.id.desc())
            .first()
        )
        if last_ret and last_ret.return_no:
            try:
                seq = int(last_ret.return_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_return_record(self, return_data: Dict[str, Any]) -> models.InventoryReturn:
        ret = models.InventoryReturn(**return_data)
        self.db.add(ret)
        self.db.flush()
        return ret

    def create_return_item_record(self, item_data: Dict[str, Any]) -> models.InventoryReturnItem:
        ret_item = models.InventoryReturnItem(**item_data)
        self.db.add(ret_item)
        self.db.flush()
        return ret_item

    def get_return_by_id(self, return_id: int, hotel_id: int) -> Optional[models.InventoryReturn]:
        return (
            self.db.query(models.InventoryReturn)
            .filter(models.InventoryReturn.id == return_id, models.InventoryReturn.hotel_id == hotel_id)
            .first()
        )

    def list_returns(
        self,
        hotel_id: int,
        department: Optional[str] = None,
        store_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryReturn], int]:
        query = self.db.query(models.InventoryReturn).filter(models.InventoryReturn.hotel_id == hotel_id)
        if department is not None:
            query = query.filter(models.InventoryReturn.department.ilike(f"%{department.strip()}%"))
        if store_id is not None:
            query = query.filter(models.InventoryReturn.store_id == store_id)
        if date_from is not None:
            query = query.filter(models.InventoryReturn.return_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryReturn.return_date <= date_to)

        total = query.count()
        returns = (
            query.order_by(models.InventoryReturn.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return returns, total

    def generate_supplier_return_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"SRET-{current_year}-"
        last_sret = (
            self.db.query(models.InventorySupplierReturn)
            .filter(
                models.InventorySupplierReturn.hotel_id == hotel_id,
                models.InventorySupplierReturn.supplier_return_no.like(f"{prefix}%"),
            )
            .order_by(models.InventorySupplierReturn.id.desc())
            .first()
        )
        if last_sret and last_sret.supplier_return_no:
            try:
                seq = int(last_sret.supplier_return_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_supplier_return_record(self, sret_data: Dict[str, Any]) -> models.InventorySupplierReturn:
        sret = models.InventorySupplierReturn(**sret_data)
        self.db.add(sret)
        self.db.flush()
        return sret

    def create_supplier_return_item_record(self, item_data: Dict[str, Any]) -> models.InventorySupplierReturnItem:
        sret_item = models.InventorySupplierReturnItem(**item_data)
        self.db.add(sret_item)
        self.db.flush()
        return sret_item

    def get_supplier_return_by_id(self, sret_id: int, hotel_id: int) -> Optional[models.InventorySupplierReturn]:
        return (
            self.db.query(models.InventorySupplierReturn)
            .filter(models.InventorySupplierReturn.id == sret_id, models.InventorySupplierReturn.hotel_id == hotel_id)
            .first()
        )

    def list_supplier_returns(
        self,
        hotel_id: int,
        supplier_id: Optional[int] = None,
        store_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventorySupplierReturn], int]:
        query = self.db.query(models.InventorySupplierReturn).filter(models.InventorySupplierReturn.hotel_id == hotel_id)
        if supplier_id is not None:
            query = query.filter(models.InventorySupplierReturn.supplier_id == supplier_id)
        if store_id is not None:
            query = query.filter(models.InventorySupplierReturn.store_id == store_id)
        if date_from is not None:
            query = query.filter(models.InventorySupplierReturn.return_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventorySupplierReturn.return_date <= date_to)

        total = query.count()
        srets = (
            query.order_by(models.InventorySupplierReturn.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return srets, total

    def generate_transfer_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"TRF-{current_year}-"
        last_trf = (
            self.db.query(models.InventoryTransfer)
            .filter(
                models.InventoryTransfer.hotel_id == hotel_id,
                models.InventoryTransfer.transfer_no.like(f"{prefix}%"),
            )
            .order_by(models.InventoryTransfer.id.desc())
            .first()
        )
        if last_trf and last_trf.transfer_no:
            try:
                seq = int(last_trf.transfer_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_transfer_record(self, trf_data: Dict[str, Any]) -> models.InventoryTransfer:
        trf = models.InventoryTransfer(**trf_data)
        self.db.add(trf)
        self.db.flush()
        return trf

    def create_transfer_item_record(self, item_data: Dict[str, Any]) -> models.InventoryTransferItem:
        trf_item = models.InventoryTransferItem(**item_data)
        self.db.add(trf_item)
        self.db.flush()
        return trf_item

    def get_transfer_by_id(self, trf_id: int, hotel_id: int) -> Optional[models.InventoryTransfer]:
        return (
            self.db.query(models.InventoryTransfer)
            .filter(models.InventoryTransfer.id == trf_id, models.InventoryTransfer.hotel_id == hotel_id)
            .first()
        )

    def list_transfers(
        self,
        hotel_id: int,
        from_store_id: Optional[int] = None,
        to_store_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryTransfer], int]:
        query = self.db.query(models.InventoryTransfer).filter(models.InventoryTransfer.hotel_id == hotel_id)
        if from_store_id is not None:
            query = query.filter(models.InventoryTransfer.from_store_id == from_store_id)
        if to_store_id is not None:
            query = query.filter(models.InventoryTransfer.to_store_id == to_store_id)
        if date_from is not None:
            query = query.filter(models.InventoryTransfer.transfer_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryTransfer.transfer_date <= date_to)

        total = query.count()
        transfers = (
            query.order_by(models.InventoryTransfer.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return transfers, total

    # -------------------------------------------------------------
    # Department Issues & Consumption
    # -------------------------------------------------------------

    def generate_issue_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"ISS-{current_year}-"
        last_issue = (
            self.db.query(models.InventoryIssue)
            .filter(
                models.InventoryIssue.hotel_id == hotel_id,
                models.InventoryIssue.issue_no.like(f"{prefix}%"),
            )
            .order_by(models.InventoryIssue.id.desc())
            .first()
        )
        if last_issue and last_issue.issue_no:
            try:
                seq = int(last_issue.issue_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_issue_record(self, issue_data: Dict[str, Any]) -> models.InventoryIssue:
        issue = models.InventoryIssue(**issue_data)
        self.db.add(issue)
        self.db.flush()
        return issue

    def create_issue_item_record(self, item_data: Dict[str, Any]) -> models.InventoryIssueItem:
        issue_item = models.InventoryIssueItem(**item_data)
        self.db.add(issue_item)
        self.db.flush()
        return issue_item

    def get_issue_by_id(self, issue_id: int, hotel_id: int) -> Optional[models.InventoryIssue]:
        return (
            self.db.query(models.InventoryIssue)
            .filter(models.InventoryIssue.id == issue_id, models.InventoryIssue.hotel_id == hotel_id)
            .first()
        )

    def list_issues(
        self,
        hotel_id: int,
        department: Optional[str] = None,
        store_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryIssue], int]:
        query = self.db.query(models.InventoryIssue).filter(models.InventoryIssue.hotel_id == hotel_id)
        if department is not None:
            query = query.filter(models.InventoryIssue.department.ilike(f"%{department.strip()}%"))
        if store_id is not None:
            query = query.filter(models.InventoryIssue.from_store_id == store_id)
        if date_from is not None:
            query = query.filter(models.InventoryIssue.issue_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryIssue.issue_date <= date_to)

        total = query.count()
        issues = (
            query.order_by(models.InventoryIssue.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return issues, total

    def generate_consumption_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"CSM-{current_year}-"
        last_csm = (
            self.db.query(models.InventoryConsumption)
            .filter(
                models.InventoryConsumption.hotel_id == hotel_id,
                models.InventoryConsumption.consumption_no.like(f"{prefix}%"),
            )
            .order_by(models.InventoryConsumption.id.desc())
            .first()
        )
        if last_csm and last_csm.consumption_no:
            try:
                seq = int(last_csm.consumption_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_consumption_record(self, csm_data: Dict[str, Any]) -> models.InventoryConsumption:
        csm = models.InventoryConsumption(**csm_data)
        self.db.add(csm)
        self.db.flush()
        return csm

    def list_consumptions(
        self,
        hotel_id: int,
        department: Optional[str] = None,
        store_id: Optional[int] = None,
        item_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryConsumption], int]:
        query = self.db.query(models.InventoryConsumption).filter(models.InventoryConsumption.hotel_id == hotel_id)
        if department is not None:
            query = query.filter(models.InventoryConsumption.department.ilike(f"%{department.strip()}%"))
        if store_id is not None:
            query = query.filter(models.InventoryConsumption.store_id == store_id)
        if item_id is not None:
            query = query.filter(models.InventoryConsumption.item_id == item_id)
        if date_from is not None:
            query = query.filter(models.InventoryConsumption.consumption_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryConsumption.consumption_date <= date_to)

        total = query.count()
        consumptions = (
            query.order_by(models.InventoryConsumption.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return consumptions, total

    # -------------------------------------------------------------
    # Goods Receipt Note (GRN) / Receiving
    # -------------------------------------------------------------

    def generate_receipt_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"GRN-{current_year}-"
        last_receipt = (
            self.db.query(models.InventoryReceipt)
            .filter(
                models.InventoryReceipt.hotel_id == hotel_id,
                models.InventoryReceipt.receipt_no.like(f"{prefix}%"),
            )
            .order_by(models.InventoryReceipt.id.desc())
            .first()
        )
        if last_receipt and last_receipt.receipt_no:
            try:
                seq = int(last_receipt.receipt_no.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:05d}"

    def create_receipt_record(self, receipt_data: Dict[str, Any]) -> models.InventoryReceipt:
        receipt = models.InventoryReceipt(**receipt_data)
        self.db.add(receipt)
        self.db.flush()
        return receipt

    def create_receipt_item_record(self, item_data: Dict[str, Any]) -> models.InventoryReceiptItem:
        receipt_item = models.InventoryReceiptItem(**item_data)
        self.db.add(receipt_item)
        self.db.flush()
        return receipt_item

    def get_receipt_by_id(self, receipt_id: int, hotel_id: int) -> Optional[models.InventoryReceipt]:
        return (
            self.db.query(models.InventoryReceipt)
            .filter(models.InventoryReceipt.id == receipt_id, models.InventoryReceipt.hotel_id == hotel_id)
            .first()
        )

    def list_receipts(
        self,
        hotel_id: int,
        supplier_id: Optional[int] = None,
        store_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryReceipt], int]:
        query = self.db.query(models.InventoryReceipt).filter(models.InventoryReceipt.hotel_id == hotel_id)
        if supplier_id is not None:
            query = query.filter(models.InventoryReceipt.supplier_id == supplier_id)
        if store_id is not None:
            query = query.filter(models.InventoryReceipt.store_id == store_id)
        if date_from is not None:
            query = query.filter(models.InventoryReceipt.receiving_date >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryReceipt.receiving_date <= date_to)

        total = query.count()
        receipts = (
            query.order_by(models.InventoryReceipt.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return receipts, total

    def mark_purchase_order_received(self, po_id: int, hotel_id: int) -> None:
        po = (
            self.db.query(models.PurchaseOrder)
            .filter(models.PurchaseOrder.id == po_id, models.PurchaseOrder.hotel_id == hotel_id)
            .first()
        )
        if po:
            po.status = "received"
            self.db.flush()

    # -------------------------------------------------------------
    # Stock Engine Core & Ledger
    # -------------------------------------------------------------

    def get_item_for_update(self, item_id: int, hotel_id: int) -> Optional[models.InventoryItem]:
        return (
            self.db.query(models.InventoryItem)
            .filter(models.InventoryItem.id == item_id, models.InventoryItem.hotel_id == hotel_id)
            .with_for_update()
            .first()
        )

    def get_location_stock_for_update(
        self, hotel_id: int, item_id: int, store_id: int
    ) -> Optional[models.InventoryLocationStock]:
        return (
            self.db.query(models.InventoryLocationStock)
            .filter(
                models.InventoryLocationStock.hotel_id == hotel_id,
                models.InventoryLocationStock.item_id == item_id,
                models.InventoryLocationStock.store_id == store_id,
            )
            .with_for_update()
            .first()
        )

    def record_ledger_entry(self, entry_data: Dict[str, Any]) -> models.InventoryStockLedger:
        ledger = models.InventoryStockLedger(**entry_data)
        self.db.add(ledger)
        self.db.flush()
        return ledger

    def list_stock_ledger(
        self,
        hotel_id: int,
        item_id: Optional[int] = None,
        store_id: Optional[int] = None,
        movement_type: Optional[str] = None,
        department: Optional[str] = None,
        supplier_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[models.InventoryStockLedger], int]:
        query = self.db.query(models.InventoryStockLedger).filter(
            models.InventoryStockLedger.hotel_id == hotel_id
        )

        if item_id is not None:
            query = query.filter(models.InventoryStockLedger.item_id == item_id)
        if store_id is not None:
            query = query.filter(models.InventoryStockLedger.store_id == store_id)
        if movement_type is not None:
            query = query.filter(models.InventoryStockLedger.movement_type == movement_type)
        if department is not None:
            query = query.filter(models.InventoryStockLedger.department.ilike(f"%{department.strip()}%"))
        if supplier_id is not None:
            query = query.filter(models.InventoryStockLedger.supplier_id == supplier_id)
        if date_from is not None:
            query = query.filter(models.InventoryStockLedger.created_at >= date_from)
        if date_to is not None:
            query = query.filter(models.InventoryStockLedger.created_at <= date_to)

        total = query.count()
        items = (
            query.order_by(models.InventoryStockLedger.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    # -------------------------------------------------------------
    # Stores / Warehouses
    # -------------------------------------------------------------

    def get_store_by_id(self, store_id: int) -> Optional[models.InventoryStore]:
        return (
            self.db.query(models.InventoryStore)
            .filter(models.InventoryStore.id == store_id)
            .first()
        )

    def get_store_by_code(self, hotel_id: int, store_code: str) -> Optional[models.InventoryStore]:
        return (
            self.db.query(models.InventoryStore)
            .filter(
                models.InventoryStore.hotel_id == hotel_id,
                models.InventoryStore.store_code.ilike(store_code.strip()),
            )
            .first()
        )

    def get_store_by_name(self, hotel_id: int, store_name: str) -> Optional[models.InventoryStore]:
        return (
            self.db.query(models.InventoryStore)
            .filter(
                models.InventoryStore.hotel_id == hotel_id,
                models.InventoryStore.store_name.ilike(store_name.strip()),
            )
            .first()
        )

    def get_duplicate_store(
        self,
        hotel_id: int,
        store_code: str,
        store_name: str,
        exclude_id: int,
    ) -> Optional[models.InventoryStore]:
        return (
            self.db.query(models.InventoryStore)
            .filter(
                models.InventoryStore.hotel_id == hotel_id,
                (
                    models.InventoryStore.store_code.ilike(store_code.strip())
                    | models.InventoryStore.store_name.ilike(store_name.strip())
                ),
                models.InventoryStore.id != exclude_id,
            )
            .first()
        )

    def list_stores(
        self,
        hotel_id: Optional[int] = None,
        active_only: bool = False,
    ) -> List[models.InventoryStore]:
        query = self.db.query(models.InventoryStore)
        if hotel_id is not None:
            query = query.filter(models.InventoryStore.hotel_id == hotel_id)
        if active_only:
            query = query.filter(models.InventoryStore.is_active == True)
        return query.order_by(models.InventoryStore.is_main_store.desc(), models.InventoryStore.store_name.asc()).all()

    def get_or_create_default_store(self, hotel_id: int) -> models.InventoryStore:
        main_store = (
            self.db.query(models.InventoryStore)
            .filter(models.InventoryStore.hotel_id == hotel_id, models.InventoryStore.is_main_store == True)
            .first()
        )
        if not main_store:
            main_store = (
                self.db.query(models.InventoryStore)
                .filter(models.InventoryStore.hotel_id == hotel_id)
                .first()
            )
        if not main_store:
            main_store = models.InventoryStore(
                hotel_id=hotel_id,
                store_code="MAIN-STR",
                store_name="Main Store",
                location="Central Storage",
                is_main_store=True,
                is_active=True,
            )
            self.db.add(main_store)
            self.db.commit()
            self.db.refresh(main_store)
        return main_store

    def create_store(self, store_data: Dict[str, Any]) -> models.InventoryStore:
        store = models.InventoryStore(**store_data)
        if store.is_main_store:
            self.db.query(models.InventoryStore).filter(
                models.InventoryStore.hotel_id == store.hotel_id,
                models.InventoryStore.is_main_store == True,
            ).update({"is_main_store": False})
        self.db.add(store)
        self.db.commit()
        self.db.refresh(store)
        return store

    def update_store(
        self,
        store: models.InventoryStore,
        update_fields: Dict[str, Any],
    ) -> models.InventoryStore:
        if update_fields.get("is_main_store"):
            self.db.query(models.InventoryStore).filter(
                models.InventoryStore.hotel_id == store.hotel_id,
                models.InventoryStore.id != store.id,
                models.InventoryStore.is_main_store == True,
            ).update({"is_main_store": False})
        for key, value in update_fields.items():
            setattr(store, key, value)
        self.db.commit()
        self.db.refresh(store)
        return store

    def delete_store(self, store: models.InventoryStore) -> None:
        self.db.delete(store)
        self.db.commit()

    def store_has_stock(self, store_id: int) -> bool:
        stock = (
            self.db.query(models.InventoryLocationStock)
            .filter(
                models.InventoryLocationStock.store_id == store_id,
                models.InventoryLocationStock.current_stock > 0,
            )
            .first()
        )
        return stock is not None

    # -------------------------------------------------------------
    # Store-Level Location Stock
    # -------------------------------------------------------------

    def get_location_stock(self, hotel_id: int, item_id: int, store_id: int) -> Optional[models.InventoryLocationStock]:
        return (
            self.db.query(models.InventoryLocationStock)
            .filter(
                models.InventoryLocationStock.hotel_id == hotel_id,
                models.InventoryLocationStock.item_id == item_id,
                models.InventoryLocationStock.store_id == store_id,
            )
            .first()
        )

    def list_location_stocks_for_item(self, hotel_id: int, item_id: int) -> List[models.InventoryLocationStock]:
        return (
            self.db.query(models.InventoryLocationStock)
            .filter(
                models.InventoryLocationStock.hotel_id == hotel_id,
                models.InventoryLocationStock.item_id == item_id,
            )
            .all()
        )

    def upsert_location_stock(
        self,
        hotel_id: int,
        item_id: int,
        store_id: int,
        delta_quantity: float,
    ) -> models.InventoryLocationStock:
        loc_stock = self.get_location_stock(hotel_id, item_id, store_id)
        if not loc_stock:
            loc_stock = models.InventoryLocationStock(
                hotel_id=hotel_id,
                item_id=item_id,
                store_id=store_id,
                current_stock=max(0.0, delta_quantity),
            )
            self.db.add(loc_stock)
        else:
            loc_stock.current_stock = max(0.0, loc_stock.current_stock + delta_quantity)
        self.db.commit()
        self.db.refresh(loc_stock)
        return loc_stock

    # -------------------------------------------------------------
    # Categories
    # -------------------------------------------------------------

    def get_category_by_id(self, category_id: int) -> Optional[models.InventoryCategory]:
        return (
            self.db.query(models.InventoryCategory)
            .filter(models.InventoryCategory.id == category_id)
            .first()
        )

    def get_category_by_name(self, hotel_id: int, name: str) -> Optional[models.InventoryCategory]:
        return (
            self.db.query(models.InventoryCategory)
            .filter(
                models.InventoryCategory.hotel_id == hotel_id,
                models.InventoryCategory.name.ilike(name.strip()),
            )
            .first()
        )

    def get_duplicate_category_name(
        self,
        hotel_id: int,
        name: str,
        exclude_id: int,
    ) -> Optional[models.InventoryCategory]:
        return (
            self.db.query(models.InventoryCategory)
            .filter(
                models.InventoryCategory.hotel_id == hotel_id,
                models.InventoryCategory.name.ilike(name.strip()),
                models.InventoryCategory.id != exclude_id,
            )
            .first()
        )

    def list_categories(
        self,
        hotel_id: Optional[int] = None,
        active_only: bool = False,
    ) -> List[models.InventoryCategory]:
        query = self.db.query(models.InventoryCategory)
        if hotel_id is not None:
            query = query.filter(models.InventoryCategory.hotel_id == hotel_id)
        if active_only:
            query = query.filter(models.InventoryCategory.is_active == True)
        return query.order_by(models.InventoryCategory.name.asc()).all()

    def create_category(self, category_data: Dict[str, Any]) -> models.InventoryCategory:
        category = models.InventoryCategory(**category_data)
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def update_category(
        self,
        category: models.InventoryCategory,
        update_fields: Dict[str, Any],
    ) -> models.InventoryCategory:
        for key, value in update_fields.items():
            setattr(category, key, value)
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(self, category: models.InventoryCategory) -> None:
        self.db.delete(category)
        self.db.commit()

    def has_items_in_category(self, category_id: int) -> bool:
        return (
            self.db.query(models.InventoryItem)
            .filter(models.InventoryItem.category_id == category_id)
            .first()
            is not None
        )

    # -------------------------------------------------------------
    # Units of Measure
    # -------------------------------------------------------------

    def get_unit_by_id(self, unit_id: int) -> Optional[models.InventoryUnit]:
        return (
            self.db.query(models.InventoryUnit)
            .filter(models.InventoryUnit.id == unit_id)
            .first()
        )

    def get_unit_by_name(self, hotel_id: int, name: str) -> Optional[models.InventoryUnit]:
        return (
            self.db.query(models.InventoryUnit)
            .filter(
                models.InventoryUnit.hotel_id == hotel_id,
                models.InventoryUnit.name.ilike(name.strip()),
            )
            .first()
        )

    def get_unit_by_code(self, hotel_id: int, code: str) -> Optional[models.InventoryUnit]:
        return (
            self.db.query(models.InventoryUnit)
            .filter(
                models.InventoryUnit.hotel_id == hotel_id,
                models.InventoryUnit.code.ilike(code.strip()),
            )
            .first()
        )

    def get_duplicate_unit(
        self,
        hotel_id: int,
        name: str,
        code: str,
        exclude_id: int,
    ) -> Optional[models.InventoryUnit]:
        return (
            self.db.query(models.InventoryUnit)
            .filter(
                models.InventoryUnit.hotel_id == hotel_id,
                (models.InventoryUnit.name.ilike(name.strip()) | models.InventoryUnit.code.ilike(code.strip())),
                models.InventoryUnit.id != exclude_id,
            )
            .first()
        )

    def list_units(
        self,
        hotel_id: Optional[int] = None,
        active_only: bool = False,
    ) -> List[models.InventoryUnit]:
        query = self.db.query(models.InventoryUnit)
        if hotel_id is not None:
            query = query.filter(models.InventoryUnit.hotel_id == hotel_id)
        if active_only:
            query = query.filter(models.InventoryUnit.is_active == True)
        return query.order_by(models.InventoryUnit.name.asc()).all()

    def create_unit(self, unit_data: Dict[str, Any]) -> models.InventoryUnit:
        unit = models.InventoryUnit(**unit_data)
        self.db.add(unit)
        self.db.commit()
        self.db.refresh(unit)
        return unit

    def update_unit(
        self,
        unit: models.InventoryUnit,
        update_fields: Dict[str, Any],
    ) -> models.InventoryUnit:
        for key, value in update_fields.items():
            setattr(unit, key, value)
        self.db.commit()
        self.db.refresh(unit)
        return unit

    def delete_unit(self, unit: models.InventoryUnit) -> None:
        self.db.delete(unit)
        self.db.commit()

    def has_items_using_unit(self, unit_id: int) -> bool:
        return (
            self.db.query(models.InventoryItem)
            .filter(models.InventoryItem.unit_id == unit_id)
            .first()
            is not None
        )

    # -------------------------------------------------------------
    # Inventory Items
    # -------------------------------------------------------------

    def get_item_by_id(self, item_id: int) -> Optional[models.InventoryItem]:
        return (
            self.db.query(models.InventoryItem)
            .filter(models.InventoryItem.id == item_id)
            .first()
        )

    def get_item_by_sku(self, hotel_id: int, sku: str) -> Optional[models.InventoryItem]:
        return (
            self.db.query(models.InventoryItem)
            .filter(
                models.InventoryItem.hotel_id == hotel_id,
                models.InventoryItem.sku == sku.strip(),
            )
            .first()
        )

    def get_duplicate_sku_item(
        self,
        hotel_id: int,
        sku: str,
        exclude_item_id: int,
    ) -> Optional[models.InventoryItem]:
        return (
            self.db.query(models.InventoryItem)
            .filter(
                models.InventoryItem.hotel_id == hotel_id,
                models.InventoryItem.sku == sku.strip(),
                models.InventoryItem.id != exclude_item_id,
            )
            .first()
        )

    def list_items(
        self,
        hotel_id: Optional[int] = None,
        category: Optional[str] = None,
        category_id: Optional[int] = None,
        low_stock_only: bool = False,
        active_only: bool = False,
    ) -> List[models.InventoryItem]:
        query = self.db.query(models.InventoryItem)

        if hotel_id is not None:
            query = query.filter(models.InventoryItem.hotel_id == hotel_id)

        if category_id is not None:
            query = query.filter(models.InventoryItem.category_id == category_id)
        elif category is not None:
            query = query.filter(models.InventoryItem.category == category)

        if low_stock_only:
            query = query.filter(
                (models.InventoryItem.current_stock <= models.InventoryItem.min_stock_level)
                | (models.InventoryItem.current_stock <= models.InventoryItem.reorder_level)
            )

        if active_only:
            query = query.filter(models.InventoryItem.is_active == True)

        return query.order_by(models.InventoryItem.id.desc()).all()

    def create_item(self, item_data: Dict[str, Any]) -> models.InventoryItem:
        new_item = models.InventoryItem(**item_data)
        self.db.add(new_item)
        self.db.commit()
        self.db.refresh(new_item)
        return new_item

    def update_item(
        self,
        item: models.InventoryItem,
        update_fields: Dict[str, Any],
    ) -> models.InventoryItem:
        for key, value in update_fields.items():
            setattr(item, key, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_item(self, item: models.InventoryItem) -> None:
        self.db.delete(item)
        self.db.commit()

    def has_stock_transactions(self, item_id: int) -> bool:
        has_tx = (
            self.db.query(models.StockTransaction)
            .filter(models.StockTransaction.item_id == item_id)
            .first()
            is not None
        )
        has_ledger = (
            self.db.query(models.InventoryStockLedger)
            .filter(models.InventoryStockLedger.item_id == item_id)
            .first()
            is not None
        )
        return has_tx or has_ledger

    def list_stock_transactions(
        self,
        hotel_id: Optional[int] = None,
        item_id: Optional[int] = None,
        transaction_type: Optional[str] = None,
    ) -> List[models.StockTransaction]:
        query = self.db.query(models.StockTransaction)

        if hotel_id is not None:
            query = query.filter(models.StockTransaction.hotel_id == hotel_id)

        if item_id is not None:
            query = query.filter(models.StockTransaction.item_id == item_id)

        if transaction_type is not None:
            query = query.filter(models.StockTransaction.transaction_type == transaction_type)

        return query.order_by(models.StockTransaction.id.desc()).all()

    def create_stock_transaction_and_adjust_stock(
        self,
        item: models.InventoryItem,
        new_stock: float,
        transaction_data: Dict[str, Any],
    ) -> models.StockTransaction:
        item.current_stock = new_stock
        new_transaction = models.StockTransaction(**transaction_data)
        self.db.add(new_transaction)
        self.db.commit()
        self.db.refresh(new_transaction)
        return new_transaction

    # -------------------------------------------------------------
    # Vendors / Suppliers
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_vendor_by_id(self, vendor_id: int, hotel_id: int) -> Optional[models.Vendor]:
        return (
            self.db.query(models.Vendor)
            .filter(models.Vendor.id == vendor_id, models.Vendor.hotel_id == hotel_id)
            .first()
        )

    def list_vendors(self, hotel_id: int, active_only: bool = False) -> List[models.Vendor]:
        query = self.db.query(models.Vendor).filter(models.Vendor.hotel_id == hotel_id)
        if active_only:
            query = query.filter(models.Vendor.status == "active")
        return query.order_by(models.Vendor.vendor_name.asc()).all()

    def create_vendor(self, vendor_data: Dict[str, Any]) -> models.Vendor:
        vendor = models.Vendor(**vendor_data)
        self.db.add(vendor)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor

    def update_vendor(self, vendor: models.Vendor, update_fields: Dict[str, Any]) -> models.Vendor:
        for key, value in update_fields.items():
            setattr(vendor, key, value)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor