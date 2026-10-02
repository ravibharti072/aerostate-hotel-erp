from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models


class WorkOrderRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Sequence Generators
    # -------------------------------------------------------------

    def generate_work_order_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"WO-{current_year}-"
        
        last_order = (
            self.db.query(models.MaintenanceWorkOrder)
            .filter(
                models.MaintenanceWorkOrder.hotel_id == hotel_id,
                models.MaintenanceWorkOrder.work_order_number.like(f"{prefix}%"),
            )
            .order_by(models.MaintenanceWorkOrder.id.desc())
            .first()
        )

        if not last_order or not last_order.work_order_number:
            return f"{prefix}0001"

        try:
            last_seq = int(last_order.work_order_number.split("-")[-1])
            new_seq = str(last_seq + 1).zfill(4)
            return f"{prefix}{new_seq}"
        except Exception:
            return f"{prefix}0001"

    def generate_po_number(self, hotel_id: int) -> str:
        current_year = datetime.utcnow().year
        prefix = f"PO-{current_year}-"

        last_po = (
            self.db.query(models.PurchaseOrder)
            .filter(
                models.PurchaseOrder.hotel_id == hotel_id,
                models.PurchaseOrder.po_number.like(f"{prefix}%"),
            )
            .order_by(models.PurchaseOrder.id.desc())
            .first()
        )

        if not last_po or not last_po.po_number:
            return f"{prefix}0001"

        try:
            last_seq = int(last_po.po_number.split("-")[-1])
            new_seq = str(last_seq + 1).zfill(4)
            return f"{prefix}{new_seq}"
        except Exception:
            return f"{prefix}0001"

    # -------------------------------------------------------------
    # Work Orders CRUD
    # -------------------------------------------------------------

    def get_by_id(self, work_order_id: int) -> Optional[models.MaintenanceWorkOrder]:
        return (
            self.db.query(models.MaintenanceWorkOrder)
            .filter(models.MaintenanceWorkOrder.id == work_order_id)
            .first()
        )

    def list_work_orders(
        self,
        hotel_id: Optional[int] = None,
        maintenance_request_id: Optional[int] = None,
        room_id: Optional[int] = None,
        asset_id: Optional[int] = None,
        technician_staff_id: Optional[int] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> List[models.MaintenanceWorkOrder]:
        query = self.db.query(models.MaintenanceWorkOrder)

        if hotel_id is not None:
            query = query.filter(models.MaintenanceWorkOrder.hotel_id == hotel_id)
        if maintenance_request_id is not None:
            query = query.filter(models.MaintenanceWorkOrder.maintenance_request_id == maintenance_request_id)
        if room_id is not None:
            query = query.filter(models.MaintenanceWorkOrder.room_id == room_id)
        if asset_id is not None:
            query = query.filter(models.MaintenanceWorkOrder.asset_id == asset_id)
        if technician_staff_id is not None:
            query = query.filter(models.MaintenanceWorkOrder.technician_staff_id == technician_staff_id)
        if status is not None:
            query = query.filter(models.MaintenanceWorkOrder.status == status)
        if priority is not None:
            query = query.filter(models.MaintenanceWorkOrder.priority == priority)

        return query.order_by(models.MaintenanceWorkOrder.id.desc()).all()

    def create_work_order(self, order_data: Dict[str, Any]) -> models.MaintenanceWorkOrder:
        new_order = models.MaintenanceWorkOrder(**order_data)
        self.db.add(new_order)
        self.db.commit()
        self.db.refresh(new_order)
        return new_order

    def update_work_order(
        self,
        work_order: models.MaintenanceWorkOrder,
        update_fields: Dict[str, Any],
    ) -> models.MaintenanceWorkOrder:
        for key, value in update_fields.items():
            setattr(work_order, key, value)
        
        work_order.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(work_order)
        return work_order

    def delete_work_order(self, work_order: models.MaintenanceWorkOrder) -> None:
        self.db.delete(work_order)
        self.db.commit()

    # -------------------------------------------------------------
    # Inventory Transactional Part Consumption
    # -------------------------------------------------------------

    def add_part_usage_with_stock_deduction(
        self,
        part_data: Dict[str, Any],
        item: models.InventoryItem,
        new_stock: float,
        stock_transaction_data: Dict[str, Any],
    ) -> models.MaintenancePartUsage:
        """
        Atomically records part usage on the work order, logs an issue transaction
        in stock_transactions, and decrements current stock.
        """
        # 1. Log Part Usage
        usage = models.MaintenancePartUsage(**part_data)
        self.db.add(usage)

        # 2. Adjust Item Stock
        item.current_stock = new_stock

        # 3. Create Stock Transaction Audit Log
        stock_tx = models.StockTransaction(**stock_transaction_data)
        self.db.add(stock_tx)

        self.db.commit()
        self.db.refresh(usage)
        return usage

    def list_parts_used(self, work_order_id: int) -> List[models.MaintenancePartUsage]:
        return (
            self.db.query(models.MaintenancePartUsage)
            .filter(models.MaintenancePartUsage.work_order_id == work_order_id)
            .order_by(models.MaintenancePartUsage.id.asc())
            .all()
        )

    # -------------------------------------------------------------
    # Procurement PO Draft Generation
    # -------------------------------------------------------------

    def create_procurement_draft_for_work_order(
        self,
        po_data: Dict[str, Any],
        item_data: Dict[str, Any],
    ) -> models.PurchaseOrder:
        po = models.PurchaseOrder(**po_data)
        self.db.add(po)
        self.db.flush()

        item_data["purchase_order_id"] = po.id
        po_item = models.PurchaseOrderItem(**item_data)
        self.db.add(po_item)

        self.db.commit()
        self.db.refresh(po)
        return po

    # -------------------------------------------------------------
    # Cross-Domain Lookups
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_request_by_id(self, request_id: int, hotel_id: int) -> Optional[models.MaintenanceRequest]:
        return (
            self.db.query(models.MaintenanceRequest)
            .filter(
                models.MaintenanceRequest.id == request_id,
                models.MaintenanceRequest.hotel_id == hotel_id,
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

    def get_room_by_id(self, room_id: int, hotel_id: int) -> Optional[models.Room]:
        return (
            self.db.query(models.Room)
            .filter(
                models.Room.id == room_id,
                models.Room.hotel_id == hotel_id,
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

    def get_inventory_item(self, item_id: int, hotel_id: int) -> Optional[models.InventoryItem]:
        return (
            self.db.query(models.InventoryItem)
            .filter(
                models.InventoryItem.id == item_id,
                models.InventoryItem.hotel_id == hotel_id,
            )
            .first()
        )

    def find_vendor_for_item(self, hotel_id: int, supplier_name: Optional[str]) -> Optional[models.Vendor]:
        query = self.db.query(models.Vendor).filter(models.Vendor.hotel_id == hotel_id)
        if supplier_name:
            vendor = query.filter(models.Vendor.vendor_name.ilike(f"%{supplier_name.strip()}%")).first()
            if vendor:
                return vendor
        return query.filter(models.Vendor.status == "active").first()