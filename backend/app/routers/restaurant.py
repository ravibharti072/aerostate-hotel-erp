from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/restaurant",
    tags=["Restaurant"]
)

@router.post("/menu-items", response_model=schemas.MenuItemResponse)
def create_menu_item(
    item: schemas.MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "restaurant"]:
        raise HTTPException(
            status_code=403,
            detail="Only restaurant, hotel-admin, manager, or super-admin can create menu items"
        )

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create menu items only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == item.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    existing_item = db.query(models.MenuItem).filter(
        models.MenuItem.hotel_id == item.hotel_id,
        models.MenuItem.name == item.name
    ).first()

    if existing_item:
        raise HTTPException(
            status_code=400,
            detail="Menu item with this name already exists for this hotel"
        )

    if item.price < 0:
        raise HTTPException(
            status_code=400,
            detail="Price cannot be negative"
        )

    if item.tax_percent < 0:
        raise HTTPException(
            status_code=400,
            detail="Tax percent cannot be negative"
        )

    new_item = models.MenuItem(**item.model_dump())

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return new_item


@router.get("/menu-items", response_model=list[schemas.MenuItemResponse])
def get_menu_items(
    hotel_id: Optional[int] = None,
    category: Optional[str] = None,
    is_available: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.MenuItem)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.MenuItem.hotel_id == hotel_id)
    else:
        query = query.filter(models.MenuItem.hotel_id == current_user.hotel_id)

    if category:
        query = query.filter(models.MenuItem.category == category)

    if is_available is not None:
        query = query.filter(models.MenuItem.is_available == is_available)

    items = query.order_by(models.MenuItem.id.desc()).all()

    return items


@router.get("/menu-items/{item_id}", response_model=schemas.MenuItemResponse)
def get_menu_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only menu items from your own hotel"
            )

    return item


@router.put("/menu-items/{item_id}", response_model=schemas.MenuItemResponse)
def update_menu_item(
    item_id: int,
    item_update: schemas.MenuItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "restaurant"]:
        raise HTTPException(
            status_code=403,
            detail="Only restaurant, hotel-admin, manager, or super-admin can update menu items"
        )

    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only menu items from your own hotel"
            )

    update_data = item_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move menu item to another hotel"
            )

    if "price" in update_data and update_data["price"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Price cannot be negative"
        )

    if "tax_percent" in update_data and update_data["tax_percent"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Tax percent cannot be negative"
        )

    if "name" in update_data:
        duplicate_item = db.query(models.MenuItem).filter(
            models.MenuItem.hotel_id == item.hotel_id,
            models.MenuItem.name == update_data["name"],
            models.MenuItem.id != item_id
        ).first()

        if duplicate_item:
            raise HTTPException(
                status_code=400,
                detail="Another menu item with this name already exists for this hotel"
            )

    for key, value in update_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete("/menu-items/{item_id}")
def delete_menu_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "restaurant"]:
        raise HTTPException(
            status_code=403,
            detail="Only restaurant, hotel-admin, manager, or super-admin can delete menu items"
        )

    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    if current_user.role != "super-admin":
        if item.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only menu items from your own hotel"
            )

    used_in_order = db.query(models.RestaurantOrderItem).filter(
        models.RestaurantOrderItem.menu_item_id == item.id
    ).first()

    if used_in_order:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete menu item because it is already used in restaurant orders"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "Menu item deleted successfully"
    }


@router.post("/orders", response_model=schemas.RestaurantOrderResponse)
def create_restaurant_order(
    order: schemas.RestaurantOrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "restaurant", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only restaurant, front-desk, hotel-admin, manager, or super-admin can create restaurant orders"
        )

    if current_user.role != "super-admin":
        if order.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create restaurant orders only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == order.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found"
        )

    allowed_order_types = ["dine-in", "room-service", "takeaway"]
    allowed_order_statuses = ["pending", "preparing", "served", "completed", "cancelled"]
    allowed_billing_types = ["pending_billing", "paid_at_restaurant", "transfer_to_booking"]
    allowed_payment_methods = ["cash", "upi", "card", "online", "room_bill"]
    allowed_payment_statuses = ["unpaid", "paid"]

    if order.order_type not in allowed_order_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid order type. Allowed types are: {allowed_order_types}"
        )

    if order.order_status not in allowed_order_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid order status. Allowed statuses are: {allowed_order_statuses}"
        )

    billing_type = order.billing_type
    payment_status = order.payment_status
    payment_method = order.payment_method

    if order.order_type == "room-service":
        billing_type = "transfer_to_booking"
        payment_status = "unpaid"
        payment_method = "room_bill"

    if billing_type == "pending_billing":
        payment_status = "unpaid"
        payment_method = None

    if billing_type not in allowed_billing_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid billing type. Allowed billing types are: {allowed_billing_types}"
        )

    if payment_status not in allowed_payment_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}"
        )

    if payment_method and payment_method not in allowed_payment_methods:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment method. Allowed methods are: {allowed_payment_methods}"
        )

    if billing_type == "paid_at_restaurant":
        payment_status = "paid"
        if not payment_method or payment_method == "room_bill":
            raise HTTPException(
                status_code=400,
                detail="Valid payment_method is required when guest pays at restaurant"
            )

    if billing_type == "transfer_to_booking":
        payment_status = "unpaid"
        payment_method = "room_bill"

        if not order.guest_id or not order.room_id or not order.booking_id:
            raise HTTPException(
                status_code=400,
                detail="guest_id, room_id and booking_id are required when bill is transferred to booking"
            )

    if order.discount < 0:
        raise HTTPException(
            status_code=400,
            detail="Discount cannot be negative"
        )

    if not order.items:
        raise HTTPException(
            status_code=400,
            detail="Restaurant order must contain at least one item"
        )

    if order.guest_id:
        guest = db.query(models.Guest).filter(
            models.Guest.id == order.guest_id,
            models.Guest.hotel_id == order.hotel_id
        ).first()

        if not guest:
            raise HTTPException(
                status_code=404,
                detail="Guest not found for this hotel"
            )

    if order.room_id:
        room = db.query(models.Room).filter(
            models.Room.id == order.room_id,
            models.Room.hotel_id == order.hotel_id
        ).first()

        if not room:
            raise HTTPException(
                status_code=404,
                detail="Room not found for this hotel"
            )

    if order.booking_id:
        booking = db.query(models.Booking).filter(
            models.Booking.id == order.booking_id,
            models.Booking.hotel_id == order.hotel_id
        ).first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail="Booking not found for this hotel"
            )

        if order.guest_id and booking.guest_id != order.guest_id:
            raise HTTPException(
                status_code=400,
                detail="Booking does not belong to this guest"
            )

        if order.room_id and booking.room_id != order.room_id:
            raise HTTPException(
                status_code=400,
                detail="Booking does not belong to this room"
            )

    subtotal = 0
    tax_amount = 0
    order_items_to_create = []

    for order_item in order.items:
        if order_item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Item quantity must be greater than 0"
            )

        menu_item = db.query(models.MenuItem).filter(
            models.MenuItem.id == order_item.menu_item_id,
            models.MenuItem.hotel_id == order.hotel_id
        ).first()

        if not menu_item:
            raise HTTPException(
                status_code=404,
                detail=f"Menu item not found: {order_item.menu_item_id}"
            )

        if not menu_item.is_available:
            raise HTTPException(
                status_code=400,
                detail=f"Menu item is not available: {menu_item.name}"
            )

        tax_percent = menu_item.tax_percent if menu_item.tax_percent is not None else 5

        item_total = menu_item.price * order_item.quantity
        item_subtotal = item_total / (1 + tax_percent / 100)
        item_tax = item_total - item_subtotal

        subtotal = subtotal + item_subtotal
        tax_amount = tax_amount + item_tax

        order_items_to_create.append({
            "menu_item_id": menu_item.id,
            "item_name": menu_item.name,
            "quantity": order_item.quantity,
            "price": menu_item.price,
            "tax_percent": tax_percent,
            "total": item_total
        })

    total_amount = subtotal + tax_amount - order.discount

    if total_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Total amount cannot be negative"
        )

    paid_amount = total_amount if billing_type == "paid_at_restaurant" else 0

    new_order = models.RestaurantOrder(
        hotel_id=order.hotel_id,
        guest_id=order.guest_id,
        room_id=order.room_id,
        booking_id=order.booking_id,

        order_type=order.order_type,
        table_number=order.table_number,
        order_status=order.order_status,

        billing_type=billing_type,
        payment_method=payment_method,
        payment_status=payment_status,

        subtotal=round(subtotal, 2),
        tax_amount=round(tax_amount, 2),
        discount=order.discount,
        total_amount=round(total_amount, 2),

        paid_amount=round(paid_amount, 2),
        is_added_to_invoice=False,

        created_by=order.created_by or current_user.username
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    for item_data in order_items_to_create:
        new_order_item = models.RestaurantOrderItem(
            order_id=new_order.id,
            menu_item_id=item_data["menu_item_id"],
            item_name=item_data["item_name"],
            quantity=item_data["quantity"],
            price=item_data["price"],
            tax_percent=item_data["tax_percent"],
            total=round(item_data["total"], 2)
        )
        db.add(new_order_item)

    db.commit()
    db.refresh(new_order)

    return new_order


@router.get("/orders", response_model=list[schemas.RestaurantOrderResponse])
def get_restaurant_orders(
    hotel_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    room_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    order_type: Optional[str] = None,
    order_status: Optional[str] = None,
    billing_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.RestaurantOrder)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.RestaurantOrder.hotel_id == hotel_id)
    else:
        query = query.filter(models.RestaurantOrder.hotel_id == current_user.hotel_id)

    if guest_id:
        query = query.filter(models.RestaurantOrder.guest_id == guest_id)

    if room_id:
        query = query.filter(models.RestaurantOrder.room_id == room_id)

    if booking_id:
        query = query.filter(models.RestaurantOrder.booking_id == booking_id)

    if order_type:
        query = query.filter(models.RestaurantOrder.order_type == order_type)

    if order_status:
        query = query.filter(models.RestaurantOrder.order_status == order_status)

    if billing_type:
        query = query.filter(models.RestaurantOrder.billing_type == billing_type)

    if payment_status:
        query = query.filter(models.RestaurantOrder.payment_status == payment_status)

    orders = query.order_by(models.RestaurantOrder.id.desc()).all()

    return orders


@router.get("/orders/{order_id}", response_model=schemas.RestaurantOrderResponse)
def get_restaurant_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    order = db.query(models.RestaurantOrder).filter(
        models.RestaurantOrder.id == order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Restaurant order not found"
        )

    if current_user.role != "super-admin":
        if order.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only restaurant orders from your own hotel"
            )

    return order


@router.put("/orders/{order_id}", response_model=schemas.RestaurantOrderResponse)
def update_restaurant_order(
    order_id: int,
    order_update: schemas.RestaurantOrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "restaurant", "front-desk"]:
        raise HTTPException(
            status_code=403,
            detail="Only restaurant, front-desk, hotel-admin, manager, or super-admin can update restaurant orders"
        )

    order = db.query(models.RestaurantOrder).filter(
        models.RestaurantOrder.id == order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Restaurant order not found"
        )

    if current_user.role != "super-admin":
        if order.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only restaurant orders from your own hotel"
            )

    if order.is_added_to_invoice:
        raise HTTPException(
            status_code=400,
            detail="This restaurant order is already added to invoice and cannot be updated"
        )

    update_data = order_update.model_dump(exclude_unset=True)

    allowed_order_types = ["dine-in", "room-service", "takeaway"]
    allowed_order_statuses = ["pending", "preparing", "served", "completed", "cancelled"]
    allowed_billing_types = ["pending_billing", "paid_at_restaurant", "transfer_to_booking"]
    allowed_payment_methods = ["cash", "upi", "card", "online", "room_bill"]
    allowed_payment_statuses = ["unpaid", "paid"]

    if "order_type" in update_data and update_data["order_type"] not in allowed_order_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid order type. Allowed types are: {allowed_order_types}"
        )

    if "order_status" in update_data and update_data["order_status"] not in allowed_order_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid order status. Allowed statuses are: {allowed_order_statuses}"
        )

    if "billing_type" in update_data and update_data["billing_type"] not in allowed_billing_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid billing type. Allowed billing types are: {allowed_billing_types}"
        )

    if "payment_status" in update_data and update_data["payment_status"] not in allowed_payment_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment status. Allowed statuses are: {allowed_payment_statuses}"
        )

    if "payment_method" in update_data and update_data["payment_method"]:
        if update_data["payment_method"] not in allowed_payment_methods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment method. Allowed methods are: {allowed_payment_methods}"
            )

    if "discount" in update_data and update_data["discount"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Discount cannot be negative"
        )

    for key, value in update_data.items():
        setattr(order, key, value)

    if order.order_type == "room-service":
        order.billing_type = "transfer_to_booking"
        order.payment_status = "unpaid"
        order.payment_method = "room_bill"
        order.paid_amount = 0
    elif order.billing_type == "pending_billing":
        order.payment_status = "unpaid"
        order.payment_method = None
        order.paid_amount = 0
    elif order.billing_type == "paid_at_restaurant":
        order.payment_status = "paid"
        if not order.payment_method or order.payment_method == "room_bill":
            raise HTTPException(
                status_code=400,
                detail="Valid payment_method is required when guest pays at restaurant"
            )
        order.paid_amount = order.total_amount
    elif order.billing_type == "transfer_to_booking":
        order.payment_status = "unpaid"
        order.payment_method = "room_bill"
        order.paid_amount = 0
        if not order.guest_id or not order.room_id or not order.booking_id:
            raise HTTPException(
                status_code=400,
                detail="guest_id, room_id and booking_id are required when bill is transferred to booking"
            )

    order.total_amount = order.subtotal + order.tax_amount - order.discount

    if order.total_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Total amount cannot be negative"
        )

    db.commit()
    db.refresh(order)

    return order


@router.delete("/orders/{order_id}")
def delete_restaurant_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "restaurant"]:
        raise HTTPException(
            status_code=403,
            detail="Only restaurant, hotel-admin, manager, or super-admin can delete restaurant orders"
        )

    order = db.query(models.RestaurantOrder).filter(
        models.RestaurantOrder.id == order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Restaurant order not found"
        )

    if current_user.role != "super-admin":
        if order.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only restaurant orders from your own hotel"
            )

    order_items = db.query(models.RestaurantOrderItem).filter(
        models.RestaurantOrderItem.order_id == order.id
    ).all()

    for item in order_items:
        db.delete(item)

    db.delete(order)
    db.commit()

    return {
        "message": "Restaurant order deleted successfully"
    }