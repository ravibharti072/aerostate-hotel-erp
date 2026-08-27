from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"]
)

@router.post("/items", response_model=schemas.InventoryItemResponse)
def create_inventory_item(
    item: schemas.InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory"]:
        raise HTTPException(
            status_code=403,
            detail="Only inventory, hotel-admin, manager, or super-admin can create inventory items"
        )

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create inventory items only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == item.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    existing_item = db.query(models.InventoryItem).filter(
        models.InventoryItem.hotel_id == item.hotel_id,
        models.InventoryItem.sku == item.sku
    ).first()

    if existing_item:
        raise HTTPException(
            status_code=400,
            detail="Inventory item with this SKU already exists for this hotel"
        )

    new_item = models.InventoryItem(**item.model_dump())

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return new_item


@router.get("/items", response_model=list[schemas.InventoryItemResponse])
def get_inventory_items(
    hotel_id: Optional[int] = None,
    category: Optional[str] = None,
    low_stock_only: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.InventoryItem)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.InventoryItem.hotel_id == hotel_id)
    else:
        query = query.filter(models.InventoryItem.hotel_id == current_user.hotel_id)

    if category:
        query = query.filter(models.InventoryItem.category == category)

    if low_stock_only:
        query = query.filter(
            models.InventoryItem.current_stock <= models.InventoryItem.min_stock_level
        )

    items = query.order_by(models.InventoryItem.id.desc()).all()

    return items


@router.get("/items/{item_id}", response_model=schemas.InventoryItemResponse)
def get_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only inventory items from your own hotel"
            )

    return item


@router.put("/items/{item_id}", response_model=schemas.InventoryItemResponse)
def update_inventory_item(
    item_id: int,
    item_update: schemas.InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory"]:
        raise HTTPException(
            status_code=403,
            detail="Only inventory, hotel-admin, manager, or super-admin can update inventory items"
        )

    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only inventory items from your own hotel"
            )

    update_data = item_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move inventory item to another hotel"
            )

    if "sku" in update_data:
        duplicate_item = db.query(models.InventoryItem).filter(
            models.InventoryItem.hotel_id == item.hotel_id,
            models.InventoryItem.sku == update_data["sku"],
            models.InventoryItem.id != item_id
        ).first()

        if duplicate_item:
            raise HTTPException(
                status_code=400,
                detail="Another inventory item with this SKU already exists for this hotel"
            )

    if "current_stock" in update_data and update_data["current_stock"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Current stock cannot be negative"
        )

    if "min_stock_level" in update_data and update_data["min_stock_level"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Minimum stock level cannot be negative"
        )

    for key, value in update_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete("/items/{item_id}")
def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory"]:
        raise HTTPException(
            status_code=403,
            detail="Only inventory, hotel-admin, manager, or super-admin can delete inventory items"
        )

    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only inventory items from your own hotel"
            )

    used_in_transactions = db.query(models.StockTransaction).filter(
        models.StockTransaction.item_id == item.id
    ).first()

    if used_in_transactions:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete inventory item because stock transactions exist for this item"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "Inventory item deleted successfully"
    }


@router.post("/stock-transactions", response_model=schemas.StockTransactionResponse)
def create_stock_transaction(
    transaction: schemas.StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "inventory"]:
        raise HTTPException(
            status_code=403,
            detail="Only inventory, hotel-admin, manager, or super-admin can create stock transactions"
        )

    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == transaction.item_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create stock transactions only for your own hotel items"
            )

    allowed_types = ["receive", "issue", "adjust"]

    if transaction.transaction_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transaction type. Allowed: {allowed_types}"
        )

    if transaction.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    if transaction.transaction_type == "receive":
        item.current_stock = item.current_stock + transaction.quantity

    elif transaction.transaction_type in ["issue", "adjust"]:
        if transaction.quantity > item.current_stock:
            raise HTTPException(
                status_code=400,
                detail="Quantity cannot be greater than current stock"
            )

        item.current_stock = item.current_stock - transaction.quantity

    new_transaction = models.StockTransaction(
        hotel_id=item.hotel_id,
        item_id=item.id,
        transaction_type=transaction.transaction_type,
        quantity=transaction.quantity,
        reason=transaction.reason,
        reference=transaction.reference,
        created_by=transaction.created_by
    )

    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)

    return new_transaction


@router.get("/stock-transactions", response_model=list[schemas.StockTransactionResponse])
def get_stock_transactions(
    hotel_id: Optional[int] = None,
    item_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.StockTransaction)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.StockTransaction.hotel_id == hotel_id)
    else:
        query = query.filter(models.StockTransaction.hotel_id == current_user.hotel_id)

    if item_id:
        query = query.filter(models.StockTransaction.item_id == item_id)

    if transaction_type:
        query = query.filter(models.StockTransaction.transaction_type == transaction_type)

    transactions = query.order_by(models.StockTransaction.id.desc()).all()

    return transactions