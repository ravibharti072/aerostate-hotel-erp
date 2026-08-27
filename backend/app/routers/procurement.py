from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    tags=["Procurement & Vendors"]
)

# -----------------------------
# VENDOR APIs
# -----------------------------

@router.post("/vendors", response_model=schemas.VendorResponse)
def create_vendor(
    vendor: schemas.VendorCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory", "accountant"]:
        raise HTTPException(status_code=403, detail="Only inventory, accountant, hotel-admin, manager, or super-admin can create vendors")

    if current_user.role != "super-admin" and vendor.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can create vendors only for your own hotel")

    hotel = db.query(models.Hotel).filter(models.Hotel.id == vendor.hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    existing_vendor = db.query(models.Vendor).filter(
        models.Vendor.hotel_id == vendor.hotel_id,
        models.Vendor.phone == vendor.phone
    ).first()

    if existing_vendor:
        raise HTTPException(status_code=400, detail="Vendor with this phone number already exists for this hotel")

    allowed_statuses = ["active", "inactive", "blacklisted"]
    if vendor.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed statuses are: {allowed_statuses}")

    new_vendor = models.Vendor(**vendor.model_dump())
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)

    return new_vendor


@router.get("/vendors", response_model=list[schemas.VendorResponse])
def get_vendors(
    hotel_id: Optional[int] = None,
    vendor_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Vendor)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Vendor.hotel_id == hotel_id)
    else:
        query = query.filter(models.Vendor.hotel_id == current_user.hotel_id)

    if vendor_type:
        query = query.filter(models.Vendor.vendor_type == vendor_type)
    if status:
        query = query.filter(models.Vendor.status == status)

    return query.order_by(models.Vendor.id.desc()).all()


@router.get("/vendors/{vendor_id}", response_model=schemas.VendorResponse)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if current_user.role != "super-admin" and vendor.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can view only vendors from your own hotel")

    return vendor


@router.put("/vendors/{vendor_id}", response_model=schemas.VendorResponse)
def update_vendor(
    vendor_id: int,
    vendor_update: schemas.VendorUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory", "accountant"]:
        raise HTTPException(status_code=403, detail="Only inventory, accountant, hotel-admin, manager, or super-admin can update vendors")

    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if current_user.role != "super-admin" and vendor.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can update only vendors from your own hotel")

    update_data = vendor_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin" and "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You cannot move vendor to another hotel")

    allowed_statuses = ["active", "inactive", "blacklisted"]
    if "status" in update_data and update_data["status"] not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed statuses are: {allowed_statuses}")

    if "phone" in update_data:
        duplicate_vendor = db.query(models.Vendor).filter(
            models.Vendor.hotel_id == vendor.hotel_id,
            models.Vendor.phone == update_data["phone"],
            models.Vendor.id != vendor_id
        ).first()

        if duplicate_vendor:
            raise HTTPException(status_code=400, detail="Another vendor with this phone number already exists for this hotel")

    for key, value in update_data.items():
        setattr(vendor, key, value)

    db.commit()
    db.refresh(vendor)

    return vendor


@router.delete("/vendors/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory", "accountant"]:
        raise HTTPException(status_code=403, detail="Only inventory, accountant, hotel-admin, manager, or super-admin can delete vendors")

    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if current_user.role != "super-admin" and vendor.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can delete only vendors from your own hotel")

    used_in_purchase_order = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.vendor_id == vendor.id).first()
    if used_in_purchase_order:
        raise HTTPException(status_code=400, detail="Cannot delete vendor because purchase orders exist for this vendor")

    used_in_expense = db.query(models.Expense).filter(models.Expense.vendor_id == vendor.id).first()
    if used_in_expense:
        raise HTTPException(status_code=400, detail="Cannot delete vendor because expenses exist for this vendor")

    db.delete(vendor)
    db.commit()

    return {"message": "Vendor deleted successfully"}


# -----------------------------
# PURCHASE ORDER APIs
# -----------------------------

@router.post("/purchase-orders", response_model=schemas.PurchaseOrderResponse)
def create_purchase_order(
    purchase_order: schemas.PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory", "accountant"]:
        raise HTTPException(status_code=403, detail="Only inventory, accountant, hotel-admin, manager, or super-admin can create purchase orders")

    if current_user.role != "super-admin" and purchase_order.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can create purchase orders only for your own hotel")

    hotel = db.query(models.Hotel).filter(models.Hotel.id == purchase_order.hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == purchase_order.vendor_id,
        models.Vendor.hotel_id == purchase_order.hotel_id
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

    allowed_statuses = ["draft", "ordered", "received", "cancelled"]
    allowed_payment_statuses = ["pending", "partial", "paid", "cancelled"]

    if purchase_order.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed statuses are: {allowed_statuses}")

    if purchase_order.payment_status not in allowed_payment_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}")

    if purchase_order.discount < 0:
        raise HTTPException(status_code=400, detail="Discount cannot be negative")

    if not purchase_order.items:
        raise HTTPException(status_code=400, detail="Purchase order must contain at least one item")

    subtotal = 0
    tax_amount = 0
    purchase_order_items_to_create = []

    for order_item in purchase_order.items:
        if order_item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Item quantity must be greater than 0")
        if order_item.unit_price < 0:
            raise HTTPException(status_code=400, detail="Unit price cannot be negative")
        if order_item.tax_percent < 0:
            raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

        inventory_item = db.query(models.InventoryItem).filter(
            models.InventoryItem.id == order_item.item_id,
            models.InventoryItem.hotel_id == purchase_order.hotel_id
        ).first()

        if not inventory_item:
            raise HTTPException(status_code=404, detail=f"Inventory item not found: {order_item.item_id}")

        item_subtotal = order_item.quantity * order_item.unit_price
        item_tax = item_subtotal * order_item.tax_percent / 100
        item_total = item_subtotal + item_tax

        subtotal += item_subtotal
        tax_amount += item_tax

        purchase_order_items_to_create.append({
            "item_id": inventory_item.id,
            "item_name": inventory_item.name,
            "quantity": order_item.quantity,
            "unit_price": order_item.unit_price,
            "tax_percent": order_item.tax_percent,
            "total": item_total
        })

    grand_total = subtotal + tax_amount - purchase_order.discount

    if grand_total < 0:
        raise HTTPException(status_code=400, detail="Grand total cannot be negative")

    po_number = f"PO-{purchase_order.hotel_id}-{int(datetime.utcnow().timestamp())}"

    new_purchase_order = models.PurchaseOrder(
        hotel_id=purchase_order.hotel_id,
        vendor_id=purchase_order.vendor_id,
        po_number=po_number,
        expected_delivery_date=purchase_order.expected_delivery_date,
        status=purchase_order.status,
        payment_status=purchase_order.payment_status,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount=purchase_order.discount,
        grand_total=grand_total,
        notes=purchase_order.notes,
        created_by=purchase_order.created_by
    )

    db.add(new_purchase_order)
    db.commit()
    db.refresh(new_purchase_order)

    for item_data in purchase_order_items_to_create:
        new_purchase_order_item = models.PurchaseOrderItem(
            purchase_order_id=new_purchase_order.id,
            item_id=item_data["item_id"],
            item_name=item_data["item_name"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            tax_percent=item_data["tax_percent"],
            total=item_data["total"]
        )
        db.add(new_purchase_order_item)

    db.commit()
    db.refresh(new_purchase_order)

    return new_purchase_order


@router.get("/purchase-orders", response_model=list[schemas.PurchaseOrderResponse])
def get_purchase_orders(
    hotel_id: Optional[int] = None,
    vendor_id: Optional[int] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.PurchaseOrder)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.PurchaseOrder.hotel_id == hotel_id)
    else:
        query = query.filter(models.PurchaseOrder.hotel_id == current_user.hotel_id)

    if vendor_id:
        query = query.filter(models.PurchaseOrder.vendor_id == vendor_id)
    if status:
        query = query.filter(models.PurchaseOrder.status == status)
    if payment_status:
        query = query.filter(models.PurchaseOrder.payment_status == payment_status)

    return query.order_by(models.PurchaseOrder.id.desc()).all()


@router.get("/purchase-orders/{purchase_order_id}", response_model=schemas.PurchaseOrderResponse)
def get_purchase_order(
    purchase_order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    purchase_order = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_order_id).first()
    if not purchase_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if current_user.role != "super-admin" and purchase_order.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can view only purchase orders from your own hotel")

    return purchase_order


@router.put("/purchase-orders/{purchase_order_id}", response_model=schemas.PurchaseOrderResponse)
def update_purchase_order(
    purchase_order_id: int,
    purchase_order_update: schemas.PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory", "accountant"]:
        raise HTTPException(status_code=403, detail="Only inventory, accountant, hotel-admin, manager, or super-admin can update purchase orders")

    purchase_order = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_order_id).first()
    if not purchase_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if current_user.role != "super-admin" and purchase_order.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can update only purchase orders from your own hotel")

    if purchase_order.status == "received":
        raise HTTPException(status_code=400, detail="Received purchase order cannot be updated")

    update_data = purchase_order_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin" and "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You cannot move purchase order to another hotel")

    allowed_statuses = ["draft", "ordered", "received", "cancelled"]
    allowed_payment_statuses = ["pending", "partial", "paid", "cancelled"]

    if "status" in update_data and update_data["status"] not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed statuses are: {allowed_statuses}")

    if "payment_status" in update_data and update_data["payment_status"] not in allowed_payment_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}")

    if "discount" in update_data and update_data["discount"] < 0:
        raise HTTPException(status_code=400, detail="Discount cannot be negative")

    check_hotel_id = update_data.get("hotel_id", purchase_order.hotel_id)

    if "vendor_id" in update_data:
        vendor = db.query(models.Vendor).filter(
            models.Vendor.id == update_data["vendor_id"],
            models.Vendor.hotel_id == check_hotel_id
        ).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found for this hotel")

    for key, value in update_data.items():
        setattr(purchase_order, key, value)

    purchase_order.grand_total = (purchase_order.subtotal + purchase_order.tax_amount - purchase_order.discount)

    if purchase_order.grand_total < 0:
        raise HTTPException(status_code=400, detail="Grand total cannot be negative")

    db.commit()
    db.refresh(purchase_order)

    return purchase_order


@router.delete("/purchase-orders/{purchase_order_id}")
def delete_purchase_order(
    purchase_order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory", "accountant"]:
        raise HTTPException(status_code=403, detail="Only inventory, accountant, hotel-admin, manager, or super-admin can delete purchase orders")

    purchase_order = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_order_id).first()
    if not purchase_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if current_user.role != "super-admin" and purchase_order.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can delete only purchase orders from your own hotel")

    if purchase_order.status == "received":
        raise HTTPException(status_code=400, detail="Cannot delete received purchase order")

    purchase_order_items = db.query(models.PurchaseOrderItem).filter(
        models.PurchaseOrderItem.purchase_order_id == purchase_order.id
    ).all()

    for item in purchase_order_items:
        db.delete(item)

    db.delete(purchase_order)
    db.commit()

    return {"message": "Purchase order deleted successfully"}


@router.post("/purchase-orders/{purchase_order_id}/receive", response_model=schemas.PurchaseOrderResponse)
def receive_purchase_order(
    purchase_order_id: int,
    receive_data: schemas.PurchaseOrderReceive,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory"]:
        raise HTTPException(status_code=403, detail="Only inventory, hotel-admin, manager, or super-admin can receive purchase orders")

    purchase_order = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == purchase_order_id).first()
    if not purchase_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if current_user.role != "super-admin" and purchase_order.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can receive only purchase orders from your own hotel")

    if purchase_order.status == "received":
        raise HTTPException(status_code=400, detail="Purchase order already received")

    if purchase_order.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cancelled purchase order cannot be received")

    purchase_order_items = db.query(models.PurchaseOrderItem).filter(
        models.PurchaseOrderItem.purchase_order_id == purchase_order.id
    ).all()

    if not purchase_order_items:
        raise HTTPException(status_code=400, detail="Purchase order has no items")

    for po_item in purchase_order_items:
        inventory_item = db.query(models.InventoryItem).filter(
            models.InventoryItem.id == po_item.item_id,
            models.InventoryItem.hotel_id == purchase_order.hotel_id
        ).first()

        if not inventory_item:
            raise HTTPException(status_code=404, detail=f"Inventory item not found: {po_item.item_id}")

        inventory_item.current_stock += po_item.quantity

        stock_transaction = models.StockTransaction(
            hotel_id=purchase_order.hotel_id,
            item_id=inventory_item.id,
            transaction_type="receive",
            quantity=po_item.quantity,
            reason="Purchase order received",
            reference=purchase_order.po_number,
            created_by=receive_data.received_by
        )
        db.add(stock_transaction)

    purchase_order.status = "received"

    if receive_data.remarks:
        if purchase_order.notes:
            purchase_order.notes += " | Receive remarks: " + receive_data.remarks
        else:
            purchase_order.notes = "Receive remarks: " + receive_data.remarks

    db.commit()
    db.refresh(purchase_order)

    return purchase_order