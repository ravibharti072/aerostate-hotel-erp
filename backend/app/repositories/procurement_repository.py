from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session, joinedload

from app import models


class ProcurementRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Vendor Data Access
    # -------------------------------------------------------------

    def get_vendor_by_id(self, vendor_id: int) -> Optional[models.Vendor]:
        return self.db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()

    def get_vendor_by_phone(self, hotel_id: int, phone: str) -> Optional[models.Vendor]:
        return (
            self.db.query(models.Vendor)
            .filter(
                models.Vendor.hotel_id == hotel_id,
                models.Vendor.phone == phone,
            )
            .first()
        )

    def get_duplicate_vendor_phone(
        self, hotel_id: int, phone: str, exclude_vendor_id: int
    ) -> Optional[models.Vendor]:
        return (
            self.db.query(models.Vendor)
            .filter(
                models.Vendor.hotel_id == hotel_id,
                models.Vendor.phone == phone,
                models.Vendor.id != exclude_vendor_id,
            )
            .first()
        )

    def list_vendors(
        self,
        hotel_id: Optional[int] = None,
        vendor_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[models.Vendor]:
        query = self.db.query(models.Vendor)

        if hotel_id is not None:
            query = query.filter(models.Vendor.hotel_id == hotel_id)
        if vendor_type is not None:
            query = query.filter(models.Vendor.vendor_type == vendor_type)
        if status is not None:
            query = query.filter(models.Vendor.status == status)

        return query.order_by(models.Vendor.id.desc()).all()

    def create_vendor(self, vendor_data: Dict[str, Any]) -> models.Vendor:
        new_vendor = models.Vendor(**vendor_data)
        self.db.add(new_vendor)
        self.db.commit()
        self.db.refresh(new_vendor)
        return new_vendor

    def update_vendor(
        self, vendor: models.Vendor, update_fields: Dict[str, Any]
    ) -> models.Vendor:
        for key, value in update_fields.items():
            setattr(vendor, key, value)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor

    def delete_vendor(self, vendor: models.Vendor) -> None:
        self.db.delete(vendor)
        self.db.commit()

    def has_purchase_orders_for_vendor(self, vendor_id: int) -> bool:
        return (
            self.db.query(models.PurchaseOrder)
            .filter(models.PurchaseOrder.vendor_id == vendor_id)
            .first()
            is not None
        )

    def has_expenses_for_vendor(self, vendor_id: int) -> bool:
        return (
            self.db.query(models.Expense)
            .filter(models.Expense.vendor_id == vendor_id)
            .first()
            is not None
        )

    # -------------------------------------------------------------
    # Purchase Order Data Access
    # -------------------------------------------------------------

    def get_purchase_order_by_id(self, po_id: int) -> Optional[models.PurchaseOrder]:
        return (
            self.db.query(models.PurchaseOrder)
            .options(joinedload(models.PurchaseOrder.items))
            .filter(models.PurchaseOrder.id == po_id)
            .first()
        )

    def list_purchase_orders(
        self,
        hotel_id: Optional[int] = None,
        vendor_id: Optional[int] = None,
        status: Optional[str] = None,
        payment_status: Optional[str] = None,
    ) -> List[models.PurchaseOrder]:
        query = self.db.query(models.PurchaseOrder).options(joinedload(models.PurchaseOrder.items))

        if hotel_id is not None:
            query = query.filter(models.PurchaseOrder.hotel_id == hotel_id)
        if vendor_id is not None:
            query = query.filter(models.PurchaseOrder.vendor_id == vendor_id)
        if status is not None:
            query = query.filter(models.PurchaseOrder.status == status)
        if payment_status is not None:
            query = query.filter(models.PurchaseOrder.payment_status == payment_status)

        return query.order_by(models.PurchaseOrder.id.desc()).all()

    def create_purchase_order_with_items(
        self, po_data: Dict[str, Any], items_data: List[Dict[str, Any]]
    ) -> models.PurchaseOrder:
        new_po = models.PurchaseOrder(**po_data)
        self.db.add(new_po)
        self.db.commit()
        self.db.refresh(new_po)

        for item_data in items_data:
            item_data["purchase_order_id"] = new_po.id
            new_po_item = models.PurchaseOrderItem(**item_data)
            self.db.add(new_po_item)

        self.db.commit()
        self.db.refresh(new_po)
        return new_po

    def update_purchase_order(
        self, po: models.PurchaseOrder, update_fields: Dict[str, Any]
    ) -> models.PurchaseOrder:
        for key, value in update_fields.items():
            setattr(po, key, value)
        self.db.commit()
        self.db.refresh(po)
        return po

    def delete_purchase_order(self, po: models.PurchaseOrder) -> None:
        po_items = (
            self.db.query(models.PurchaseOrderItem)
            .filter(models.PurchaseOrderItem.purchase_order_id == po.id)
            .all()
        )
        for item in po_items:
            self.db.delete(item)

        self.db.delete(po)
        self.db.commit()

    def get_purchase_order_items(self, po_id: int) -> List[models.PurchaseOrderItem]:
        return (
            self.db.query(models.PurchaseOrderItem)
            .filter(models.PurchaseOrderItem.purchase_order_id == po_id)
            .all()
        )

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
            self.db.flush()
        return main_store

    def receive_purchase_order_atomic(
        self,
        po: models.PurchaseOrder,
        stock_updates: List[tuple[models.InventoryItem, float]],
        stock_transactions: List[Dict[str, Any]],
        updated_notes: Optional[str] = None,
    ) -> models.PurchaseOrder:
        default_store = self.get_or_create_default_store(po.hotel_id)

        for inv_item, qty in stock_updates:
            inv_item.current_stock += qty

            loc_stock = (
                self.db.query(models.InventoryLocationStock)
                .filter(
                    models.InventoryLocationStock.hotel_id == po.hotel_id,
                    models.InventoryLocationStock.item_id == inv_item.id,
                    models.InventoryLocationStock.store_id == default_store.id,
                )
                .first()
            )
            if not loc_stock:
                loc_stock = models.InventoryLocationStock(
                    hotel_id=po.hotel_id,
                    item_id=inv_item.id,
                    store_id=default_store.id,
                    current_stock=max(0.0, qty),
                )
                self.db.add(loc_stock)
            else:
                loc_stock.current_stock = max(0.0, loc_stock.current_stock + qty)

        for tx_data in stock_transactions:
            self.db.add(models.StockTransaction(**tx_data))

        po.status = "received"
        if updated_notes is not None:
            po.notes = updated_notes

        self.db.commit()
        self.db.refresh(po)
        return po

    # -------------------------------------------------------------
    # Cross-Domain Lookups (Hotel, InventoryItem)
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_inventory_item(self, item_id: int, hotel_id: int) -> Optional[models.InventoryItem]:
        return (
            self.db.query(models.InventoryItem)
            .filter(
                models.InventoryItem.id == item_id,
                models.InventoryItem.hotel_id == hotel_id,
            )
            .first()
        )

    def get_vendor_for_hotel(self, vendor_id: int, hotel_id: int) -> Optional[models.Vendor]:
        return (
            self.db.query(models.Vendor)
            .filter(
                models.Vendor.id == vendor_id,
                models.Vendor.hotel_id == hotel_id,
            )
            .first()
        )