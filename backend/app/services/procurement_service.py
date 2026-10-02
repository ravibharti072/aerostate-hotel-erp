from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.procurement_repository import ProcurementRepository


class ProcurementService:
    ALLOWED_PROCUREMENT_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "inventory",
        "accountant",
    ]
    ALLOWED_RECEIVE_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "inventory",
    ]

    ALLOWED_VENDOR_STATUSES = ["active", "inactive", "blacklisted"]
    ALLOWED_PO_STATUSES = ["draft", "ordered", "received", "cancelled"]
    ALLOWED_PO_PAYMENT_STATUSES = ["pending", "partial", "paid", "cancelled"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = ProcurementRepository(db)

    # -------------------------------------------------------------
    # Permission & Tenant Assertions
    # -------------------------------------------------------------

    def _has_inventory_module(self, current_user: models.User) -> bool:
        modules = getattr(current_user, "allowed_modules", None)
        if not modules:
            return False
        if isinstance(modules, list):
            return any(str(m).strip().lower() in ["inventory", "all", "admin", "procurement"] for m in modules)
        if isinstance(modules, str):
            parts = [p.strip().lower() for p in modules.split(",")]
            return any(m in ["inventory", "all", "admin", "procurement"] for m in parts)
        return False

    def _assert_can_manage(self, current_user: models.User, action_label: str) -> None:
        if current_user.role in self.ALLOWED_PROCUREMENT_ROLES or self._has_inventory_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail=f"Only inventory, accountant, hotel-admin, manager, or super-admin can {action_label}",
        )

    def _assert_can_receive(self, current_user: models.User) -> None:
        if current_user.role in self.ALLOWED_RECEIVE_ROLES or self._has_inventory_module(current_user):
            return
        raise HTTPException(
            status_code=403,
            detail="Only inventory, hotel-admin, manager, or super-admin can receive purchase orders",
        )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Vendor Workflows
    # -------------------------------------------------------------

    def create_vendor(
        self, vendor_data: schemas.VendorCreate, current_user: models.User
    ) -> models.Vendor:
        self._assert_can_manage(current_user, "create vendors")

        target_hotel_id = vendor_data.hotel_id or current_user.hotel_id
        if not target_hotel_id and current_user.role == "super-admin":
            first_hotel = self.repo.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
            target_hotel_id = first_hotel.id if first_hotel else 1

        if not target_hotel_id:
            raise HTTPException(status_code=400, detail="Hotel ID could not be determined")

        vendor_data.hotel_id = target_hotel_id

        self._assert_owns_hotel(
            current_user, vendor_data.hotel_id, "You can create vendors only for your own hotel"
        )

        hotel = self.repo.get_hotel_by_id(vendor_data.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        existing_vendor = self.repo.get_vendor_by_phone(vendor_data.hotel_id, vendor_data.phone)
        if existing_vendor:
            raise HTTPException(
                status_code=400,
                detail="Vendor with this phone number already exists for this hotel",
            )

        if vendor_data.status not in self.ALLOWED_VENDOR_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_VENDOR_STATUSES}",
            )

        return self.repo.create_vendor(vendor_data.model_dump())

    def get_vendors(
        self,
        hotel_id: Optional[int],
        vendor_type: Optional[str],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.Vendor]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_vendors(
            hotel_id=target_hotel_id, vendor_type=vendor_type, status=status
        )

    def get_vendor(self, vendor_id: int, current_user: models.User) -> models.Vendor:
        vendor = self.repo.get_vendor_by_id(vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        self._assert_owns_hotel(
            current_user, vendor.hotel_id, "You can view only vendors from your own hotel"
        )
        return vendor

    def update_vendor(
        self, vendor_id: int, vendor_update: schemas.VendorUpdate, current_user: models.User
    ) -> models.Vendor:
        self._assert_can_manage(current_user, "update vendors")

        vendor = self.repo.get_vendor_by_id(vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        self._assert_owns_hotel(
            current_user, vendor.hotel_id, "You can update only vendors from your own hotel"
        )

        update_data = vendor_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(status_code=403, detail="You cannot move vendor to another hotel")

        if "status" in update_data and update_data["status"] not in self.ALLOWED_VENDOR_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_VENDOR_STATUSES}",
            )

        if "phone" in update_data:
            duplicate = self.repo.get_duplicate_vendor_phone(
                hotel_id=vendor.hotel_id,
                phone=update_data["phone"],
                exclude_vendor_id=vendor_id,
            )
            if duplicate:
                raise HTTPException(
                    status_code=400,
                    detail="Another vendor with this phone number already exists for this hotel",
                )

        return self.repo.update_vendor(vendor, update_data)

    def delete_vendor(self, vendor_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user, "delete vendors")

        vendor = self.repo.get_vendor_by_id(vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        self._assert_owns_hotel(
            current_user, vendor.hotel_id, "You can delete only vendors from your own hotel"
        )

        if self.repo.has_purchase_orders_for_vendor(vendor.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete vendor because purchase orders exist for this vendor",
            )

        if self.repo.has_expenses_for_vendor(vendor.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete vendor because expenses exist for this vendor",
            )

        self.repo.delete_vendor(vendor)
        return {"message": "Vendor deleted successfully"}

    # -------------------------------------------------------------
    # Purchase Order Workflows
    # -------------------------------------------------------------

    def create_purchase_order(
        self, purchase_order: schemas.PurchaseOrderCreate, current_user: models.User
    ) -> models.PurchaseOrder:
        self._assert_can_manage(current_user, "create purchase orders")

        target_hotel_id = purchase_order.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            vendor_peek = self.repo.get_vendor_by_id(purchase_order.vendor_id)
            if vendor_peek:
                target_hotel_id = vendor_peek.hotel_id
        if not target_hotel_id and current_user.role == "super-admin":
            first_hotel = self.repo.db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
            target_hotel_id = first_hotel.id if first_hotel else 1

        if not target_hotel_id:
            raise HTTPException(status_code=400, detail="Hotel ID could not be determined")

        purchase_order.hotel_id = target_hotel_id

        self._assert_owns_hotel(
            current_user,
            purchase_order.hotel_id,
            "You can create purchase orders only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(purchase_order.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        vendor = self.repo.get_vendor_for_hotel(purchase_order.vendor_id, purchase_order.hotel_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

        if purchase_order.status not in self.ALLOWED_PO_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_PO_STATUSES}",
            )

        if purchase_order.payment_status not in self.ALLOWED_PO_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_PO_PAYMENT_STATUSES}",
            )

        if purchase_order.discount < 0:
            raise HTTPException(status_code=400, detail="Discount cannot be negative")

        if not purchase_order.items:
            raise HTTPException(status_code=400, detail="Purchase order must contain at least one item")

        subtotal = 0.0
        tax_amount = 0.0
        items_to_create: List[Dict[str, Any]] = []

        for order_item in purchase_order.items:
            if order_item.quantity <= 0:
                raise HTTPException(status_code=400, detail="Item quantity must be greater than 0")
            if order_item.unit_price < 0:
                raise HTTPException(status_code=400, detail="Unit price cannot be negative")
            if order_item.tax_percent < 0:
                raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

            inv_item = self.repo.get_inventory_item(order_item.item_id, purchase_order.hotel_id)
            if not inv_item:
                raise HTTPException(status_code=404, detail=f"Inventory item not found: {order_item.item_id}")

            item_subtotal = order_item.quantity * order_item.unit_price
            item_tax = item_subtotal * order_item.tax_percent / 100
            item_total = item_subtotal + item_tax

            subtotal += item_subtotal
            tax_amount += item_tax

            items_to_create.append({
                "item_id": inv_item.id,
                "item_name": inv_item.name,
                "quantity": order_item.quantity,
                "unit_price": order_item.unit_price,
                "tax_percent": order_item.tax_percent,
                "total": item_total,
            })

        grand_total = subtotal + tax_amount - purchase_order.discount
        if grand_total < 0:
            raise HTTPException(status_code=400, detail="Grand total cannot be negative")

        po_number = f"PO-{purchase_order.hotel_id}-{int(datetime.utcnow().timestamp())}"

        po_data = {
            "hotel_id": purchase_order.hotel_id,
            "vendor_id": purchase_order.vendor_id,
            "po_number": po_number,
            "expected_delivery_date": purchase_order.expected_delivery_date,
            "status": purchase_order.status,
            "payment_status": purchase_order.payment_status,
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "discount": purchase_order.discount,
            "grand_total": grand_total,
            "notes": purchase_order.notes,
            "created_by": purchase_order.created_by,
        }

        return self.repo.create_purchase_order_with_items(po_data, items_to_create)

    def get_purchase_orders(
        self,
        hotel_id: Optional[int],
        vendor_id: Optional[int],
        status: Optional[str],
        payment_status: Optional[str],
        current_user: models.User,
    ) -> List[models.PurchaseOrder]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_purchase_orders(
            hotel_id=target_hotel_id,
            vendor_id=vendor_id,
            status=status,
            payment_status=payment_status,
        )

    def get_purchase_order(self, po_id: int, current_user: models.User) -> models.PurchaseOrder:
        po = self.repo.get_purchase_order_by_id(po_id)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        self._assert_owns_hotel(
            current_user, po.hotel_id, "You can view only purchase orders from your own hotel"
        )
        return po

    def update_purchase_order(
        self, po_id: int, update_payload: schemas.PurchaseOrderUpdate, current_user: models.User
    ) -> models.PurchaseOrder:
        self._assert_can_manage(current_user, "update purchase orders")

        po = self.repo.get_purchase_order_by_id(po_id)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        self._assert_owns_hotel(
            current_user, po.hotel_id, "You can update only purchase orders from your own hotel"
        )

        update_data = update_payload.model_dump(exclude_unset=True)

        if po.status == "received":
            disallowed_keys = [k for k in update_data.keys() if k not in ["payment_status", "notes"]]
            if disallowed_keys:
                raise HTTPException(
                    status_code=400,
                    detail=f"Received purchase order cannot modify {', '.join(disallowed_keys)}. Only payment_status and notes can be updated.",
                )

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(status_code=403, detail="You cannot move purchase order to another hotel")

        if "status" in update_data and update_data["status"] not in self.ALLOWED_PO_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_PO_STATUSES}",
            )

        if "payment_status" in update_data and update_data["payment_status"] not in self.ALLOWED_PO_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_PO_PAYMENT_STATUSES}",
            )

        if "discount" in update_data and update_data["discount"] < 0:
            raise HTTPException(status_code=400, detail="Discount cannot be negative")

        check_hotel_id = update_data.get("hotel_id", po.hotel_id)

        if "vendor_id" in update_data and update_data["vendor_id"]:
            vendor = self.repo.get_vendor_for_hotel(update_data["vendor_id"], check_hotel_id)
            if not vendor:
                raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

        target_discount = update_data.get("discount", po.discount)
        grand_total = po.subtotal + po.tax_amount - target_discount

        if grand_total < 0:
            raise HTTPException(status_code=400, detail="Grand total cannot be negative")

        update_data["grand_total"] = grand_total

        if update_data.get("payment_status") == "paid" and po.payment_status != "paid":
            existing_expense = (
                self.db.query(models.Expense)
                .filter(
                    models.Expense.hotel_id == po.hotel_id,
                    models.Expense.remarks.like(f"%PO: {po.po_number}%"),
                )
                .first()
            )
            if not existing_expense:
                vendor = self.repo.get_vendor_by_id(po.vendor_id)
                new_expense = models.Expense(
                    hotel_id=po.hotel_id,
                    vendor_id=po.vendor_id,
                    expense_title=f"PO Fulfillment: {po.po_number}",
                    expense_category="Operating Supplies",
                    amount=grand_total,
                    payment_method="Bank Transfer",
                    payment_status="paid",
                    expense_date=datetime.utcnow(),
                    paid_by=getattr(current_user, "full_name", None) or current_user.username,
                    remarks=f"Auto-recorded from Procurement PO: {po.po_number} (Vendor: {vendor.vendor_name if vendor else 'N/A'})",
                )
                self.db.add(new_expense)

        return self.repo.update_purchase_order(po, update_data)

    def delete_purchase_order(self, po_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage(current_user, "delete purchase orders")

        po = self.repo.get_purchase_order_by_id(po_id)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        self._assert_owns_hotel(
            current_user, po.hotel_id, "You can delete only purchase orders from your own hotel"
        )

        if po.status == "received":
            raise HTTPException(status_code=400, detail="Cannot delete received purchase order")

        self.repo.delete_purchase_order(po)
        return {"message": "Purchase order deleted successfully"}

    def receive_purchase_order(
        self, po_id: int, receive_data: schemas.PurchaseOrderReceive, current_user: models.User
    ) -> models.PurchaseOrder:
        self._assert_can_receive(current_user)

        po = self.repo.get_purchase_order_by_id(po_id)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        self._assert_owns_hotel(
            current_user, po.hotel_id, "You can receive only purchase orders from your own hotel"
        )

        if po.status == "received":
            raise HTTPException(status_code=400, detail="Purchase order already received")

        if po.status == "cancelled":
            raise HTTPException(status_code=400, detail="Cancelled purchase order cannot be received")

        po_items = self.repo.get_purchase_order_items(po.id)
        if not po_items:
            raise HTTPException(status_code=400, detail="Purchase order has no items")

        stock_updates: List[tuple[models.InventoryItem, float]] = []
        stock_transactions: List[Dict[str, Any]] = []

        for po_item in po_items:
            inv_item = self.repo.get_inventory_item(po_item.item_id, po.hotel_id)
            if not inv_item:
                raise HTTPException(status_code=404, detail=f"Inventory item not found: {po_item.item_id}")

            stock_updates.append((inv_item, po_item.quantity))
            stock_transactions.append({
                "hotel_id": po.hotel_id,
                "item_id": inv_item.id,
                "transaction_type": "receive",
                "quantity": po_item.quantity,
                "reason": "Purchase order received",
                "reference": po.po_number,
                "created_by": receive_data.received_by,
            })

        updated_notes = po.notes
        if receive_data.remarks:
            if updated_notes:
                updated_notes += " | Receive remarks: " + receive_data.remarks
            else:
                updated_notes = "Receive remarks: " + receive_data.remarks

        return self.repo.receive_purchase_order_atomic(
            po=po,
            stock_updates=stock_updates,
            stock_transactions=stock_transactions,
            updated_notes=updated_notes,
        )