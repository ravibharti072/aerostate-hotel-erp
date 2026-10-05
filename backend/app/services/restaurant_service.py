from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.restaurant_repository import RestaurantRepository


class RestaurantService:
    ALLOWED_MENU_ROLES = ["super-admin", "hotel-admin", "manager", "restaurant", "kitchen"]
    ALLOWED_ORDER_ROLES = ["super-admin", "hotel-admin", "manager", "restaurant", "kitchen", "front-desk"]
    ALLOWED_TABLE_ROLES = ["super-admin", "hotel-admin", "manager", "restaurant", "kitchen", "front-desk"]

    ALLOWED_ORDER_TYPES = ["dine-in", "room-service", "takeaway"]
    ALLOWED_ORDER_STATUSES = ["pending", "preparing", "served", "completed", "cancelled"]
    ALLOWED_BILLING_TYPES = ["pending_billing", "paid_at_restaurant", "transfer_to_booking"]
    ALLOWED_PAYMENT_METHODS = ["cash", "upi", "card", "online", "room_bill"]
    ALLOWED_PAYMENT_STATUSES = ["unpaid", "paid"]
    ALLOWED_TABLE_STATUSES = ["available", "occupied", "reserved", "cleaning", "out-of-service"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = RestaurantRepository(db)

    # -------------------------------------------------------------
    # Authorization & Tenant Assertions
    # -------------------------------------------------------------

    def _is_restaurant_user(self, current_user: models.User) -> bool:
        if current_user.role in ["super-admin", "hotel-admin", "manager", "restaurant", "kitchen", "front-desk", "receptionist"]:
            return True
        allowed = [str(m).lower() for m in (current_user.allowed_modules or [])]
        if "restaurant" in allowed or "kitchen" in allowed or "front-desk" in allowed or "all" in allowed:
            return True
        if current_user.staff and current_user.staff.department:
            dept = str(current_user.staff.department).lower()
            if any(k in dept for k in ["rest", "kitchen", "food", "f&b", "banquet", "bar"]):
                return True
        return False

    def _assert_can_manage_menu(self, current_user: models.User, action_label: str) -> None:
        if not self._is_restaurant_user(current_user):
            raise HTTPException(
                status_code=403,
                detail=f"Only restaurant, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_can_manage_orders(self, current_user: models.User, action_label: str) -> None:
        if not self._is_restaurant_user(current_user):
            raise HTTPException(
                status_code=403,
                detail=f"Only restaurant, front-desk, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_can_delete_orders(self, current_user: models.User) -> None:
        if current_user.role not in self.ALLOWED_MENU_ROLES and not (current_user.role == "staff" and current_user.role_level == "department_head"):
            raise HTTPException(
                status_code=403,
                detail="Only restaurant department heads, hotel-admin, manager, or super-admin can delete restaurant orders",
            )

    def _assert_can_manage_tables(self, current_user: models.User, action_label: str) -> None:
        if not self._is_restaurant_user(current_user):
            raise HTTPException(
                status_code=403,
                detail=f"Only restaurant, front-desk, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # Menu Items Workflows
    # -------------------------------------------------------------

    def create_menu_item(
        self, item: schemas.MenuItemCreate, current_user: models.User
    ) -> models.MenuItem:
        self._assert_can_manage_menu(current_user, "create menu items")
        self._assert_owns_hotel(
            current_user, item.hotel_id, "You can create menu items only for your own hotel"
        )

        hotel = self.repo.get_hotel_by_id(item.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        existing_item = self.repo.get_menu_item_by_name(item.hotel_id, item.name)
        if existing_item:
            raise HTTPException(
                status_code=400,
                detail="Menu item with this name already exists for this hotel",
            )

        if item.price < 0:
            raise HTTPException(status_code=400, detail="Price cannot be negative")

        if item.half_price is not None and item.half_price < 0:
            raise HTTPException(status_code=400, detail="Half price cannot be negative")

        if item.half_price is not None and item.price > 0 and item.half_price >= item.price:
            raise HTTPException(status_code=400, detail="Half portion price must be less than full price")

        if item.tax_percent < 0:
            raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

        return self.repo.create_menu_item(item.model_dump())

    def get_menu_items(
        self,
        hotel_id: Optional[int],
        category: Optional[str],
        is_available: Optional[bool],
        current_user: models.User,
    ) -> List[models.MenuItem]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_menu_items(
            hotel_id=target_hotel_id, category=category, is_available=is_available
        )

    def get_menu_item(self, item_id: int, current_user: models.User) -> models.MenuItem:
        item = self.repo.get_menu_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")

        self._assert_owns_hotel(
            current_user, item.hotel_id, "You can view only menu items from your own hotel"
        )
        return item

    def update_menu_item(
        self, item_id: int, item_update: schemas.MenuItemUpdate, current_user: models.User
    ) -> models.MenuItem:
        self._assert_can_manage_menu(current_user, "update menu items")

        item = self.repo.get_menu_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")

        self._assert_owns_hotel(
            current_user, item.hotel_id, "You can update only menu items from your own hotel"
        )

        update_data = item_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(status_code=403, detail="You cannot move menu item to another hotel")

        if "price" in update_data and update_data["price"] is not None and update_data["price"] < 0:
            raise HTTPException(status_code=400, detail="Price cannot be negative")

        if "half_price" in update_data and update_data["half_price"] is not None:
            if update_data["half_price"] < 0:
                raise HTTPException(status_code=400, detail="Half price cannot be negative")
            target_price = update_data.get("price", item.price)
            if target_price is not None and target_price > 0 and update_data["half_price"] >= target_price:
                raise HTTPException(status_code=400, detail="Half portion price must be less than full price")

        if "tax_percent" in update_data and update_data["tax_percent"] is not None and update_data["tax_percent"] < 0:
            raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

        if "name" in update_data:
            duplicate_item = self.repo.get_duplicate_menu_item_name(
                hotel_id=item.hotel_id,
                name=update_data["name"],
                exclude_item_id=item_id,
            )
            if duplicate_item:
                raise HTTPException(
                    status_code=400,
                    detail="Another menu item with this name already exists for this hotel",
                )

        return self.repo.update_menu_item(item, update_data)

    def delete_menu_item(self, item_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage_menu(current_user, "delete menu items")

        item = self.repo.get_menu_item_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")

        self._assert_owns_hotel(
            current_user, item.hotel_id, "You can delete only menu items from your own hotel"
        )

        if self.repo.is_menu_item_used_in_orders(item.id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete menu item because it is already used in restaurant orders. Deactivate it instead to hide it from new orders.",
            )

        self.repo.delete_menu_item(item)
        return {"message": "Menu item deleted successfully"}

    # -------------------------------------------------------------
    # Restaurant Orders Workflows
    # -------------------------------------------------------------

    def create_restaurant_order(
        self, order: schemas.RestaurantOrderCreate, current_user: models.User
    ) -> models.RestaurantOrder:
        self._assert_can_manage_orders(current_user, "create restaurant orders")
        self._assert_owns_hotel(
            current_user, order.hotel_id, "You can create restaurant orders only for your own hotel"
        )

        hotel = self.repo.get_hotel_by_id(order.hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        if order.order_type not in self.ALLOWED_ORDER_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid order type. Allowed types are: {self.ALLOWED_ORDER_TYPES}",
            )

        actual_status = order.order_status or order.status or "pending"
        if actual_status not in self.ALLOWED_ORDER_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid order status. Allowed statuses are: {self.ALLOWED_ORDER_STATUSES}",
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

        if billing_type not in self.ALLOWED_BILLING_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid billing type. Allowed billing types are: {self.ALLOWED_BILLING_TYPES}",
            )

        if payment_status not in self.ALLOWED_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_PAYMENT_STATUSES}",
            )

        if payment_method and payment_method not in self.ALLOWED_PAYMENT_METHODS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment method. Allowed methods are: {self.ALLOWED_PAYMENT_METHODS}",
            )

        if billing_type == "paid_at_restaurant":
            payment_status = "paid"
            if not payment_method or payment_method == "room_bill":
                raise HTTPException(
                    status_code=400,
                    detail="Valid payment_method is required when guest pays at restaurant",
                )

        if billing_type == "transfer_to_booking":
            payment_status = "unpaid"
            payment_method = "room_bill"
            if not order.guest_id or not order.room_id or not order.booking_id:
                raise HTTPException(
                    status_code=400,
                    detail="guest_id, room_id and booking_id are required when bill is transferred to booking",
                )

        if order.discount < 0:
            raise HTTPException(status_code=400, detail="Discount cannot be negative")

        if not order.items:
            raise HTTPException(status_code=400, detail="Restaurant order must contain at least one item")

        if order.guest_id:
            guest = self.repo.get_guest_by_id(order.guest_id, order.hotel_id)
            if not guest:
                raise HTTPException(status_code=404, detail="Guest not found for this hotel")

        if order.room_id:
            room = self.repo.get_room_by_id(order.room_id, order.hotel_id)
            if not room:
                raise HTTPException(status_code=404, detail="Room not found for this hotel")

        if order.booking_id:
            booking = self.repo.get_booking_by_id(order.booking_id, order.hotel_id)
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found for this hotel")

            if order.guest_id and booking.guest_id != order.guest_id:
                raise HTTPException(status_code=400, detail="Booking does not belong to this guest")

            if order.room_id and booking.room_id != order.room_id:
                raise HTTPException(status_code=400, detail="Booking does not belong to this room")

        subtotal = 0.0
        tax_amount = 0.0
        items_to_create: List[Dict[str, Any]] = []

        for order_item in order.items:
            if order_item.quantity <= 0:
                raise HTTPException(status_code=400, detail="Item quantity must be greater than 0")

            menu_item = self.repo.get_menu_item_by_id(order_item.menu_item_id)
            if not menu_item or menu_item.hotel_id != order.hotel_id:
                raise HTTPException(status_code=404, detail=f"Menu item not found: {order_item.menu_item_id}")

            if not menu_item.is_available:
                raise HTTPException(status_code=400, detail=f"Menu item is not available: {menu_item.name}")

            portion = order_item.portion or "full"
            if portion == "half" and menu_item.half_price is not None and menu_item.half_price > 0:
                unit_price = menu_item.half_price
            elif order_item.price is not None and order_item.price > 0:
                unit_price = order_item.price
            else:
                unit_price = menu_item.price

            tax_percent = menu_item.tax_percent if menu_item.tax_percent is not None else 5.0
            item_total = unit_price * order_item.quantity
            item_subtotal = item_total / (1 + tax_percent / 100)
            item_tax = item_total - item_subtotal

            subtotal += item_subtotal
            tax_amount += item_tax

            items_to_create.append({
                "menu_item_id": menu_item.id,
                "item_name": menu_item.name,
                "portion": portion,
                "quantity": order_item.quantity,
                "price": unit_price,
                "tax_percent": tax_percent,
                "total": round(item_total, 2),
            })

        total_amount = subtotal + tax_amount - order.discount
        if total_amount < 0:
            raise HTTPException(status_code=400, detail="Total amount cannot be negative")

        paid_amount = total_amount if billing_type == "paid_at_restaurant" else 0.0

        order_data = {
            "hotel_id": order.hotel_id,
            "guest_id": order.guest_id,
            "room_id": order.room_id,
            "booking_id": order.booking_id,
            "order_type": order.order_type,
            "table_number": order.table_number,
            "guest_name": order.guest_name,
            "notes": order.notes,
            "order_status": actual_status,
            "billing_type": billing_type,
            "payment_method": payment_method,
            "payment_status": payment_status,
            "subtotal": round(subtotal, 2),
            "tax_amount": round(tax_amount, 2),
            "discount": order.discount,
            "total_amount": round(total_amount, 2),
            "paid_amount": round(paid_amount, 2),
            "is_added_to_invoice": False,
            "created_by": order.created_by or current_user.username,
        }

        created_order = self.repo.create_order_with_items(order_data, items_to_create)

        # 1. Sync with Folio if transferred to booking
        if billing_type == "transfer_to_booking" and created_order.booking_id:
            folio = self.repo.get_open_folio_for_booking(created_order.booking_id)
            if folio:
                self.repo.upsert_folio_charge_for_order(created_order, folio)

        # 2. Sync Table status if dine-in
        if created_order.table_number:
            table = self.repo.get_table_by_number(created_order.hotel_id, created_order.table_number)
            if table and table.status == "available":
                self.repo.update_table(table, {"status": "occupied"})

        return created_order

    def get_restaurant_orders(
        self,
        hotel_id: Optional[int],
        guest_id: Optional[int],
        room_id: Optional[int],
        booking_id: Optional[int],
        order_type: Optional[str],
        order_status: Optional[str],
        billing_type: Optional[str],
        payment_status: Optional[str],
        current_user: models.User,
    ) -> List[models.RestaurantOrder]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        return self.repo.list_orders(
            hotel_id=target_hotel_id,
            guest_id=guest_id,
            room_id=room_id,
            booking_id=booking_id,
            order_type=order_type,
            order_status=order_status,
            billing_type=billing_type,
            payment_status=payment_status,
        )

    def get_restaurant_order(self, order_id: int, current_user: models.User) -> models.RestaurantOrder:
        order = self.repo.get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Restaurant order not found")

        self._assert_owns_hotel(
            current_user, order.hotel_id, "You can view only restaurant orders from your own hotel"
        )
        return order

    def update_restaurant_order(
        self, order_id: int, order_update: schemas.RestaurantOrderUpdate, current_user: models.User
    ) -> models.RestaurantOrder:
        self._assert_can_manage_orders(current_user, "update restaurant orders")

        order = self.repo.get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Restaurant order not found")

        self._assert_owns_hotel(
            current_user, order.hotel_id, "You can update only restaurant orders from your own hotel"
        )

        if order.is_added_to_invoice:
            raise HTTPException(
                status_code=400,
                detail="This restaurant order is already added to invoice and cannot be updated",
            )

        update_data = order_update.model_dump(exclude_unset=True)

        # Handle status alias
        if "status" in update_data and "order_status" not in update_data:
            update_data["order_status"] = update_data.pop("status")

        if "order_type" in update_data and update_data["order_type"] not in self.ALLOWED_ORDER_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid order type. Allowed types are: {self.ALLOWED_ORDER_TYPES}",
            )

        if "order_status" in update_data and update_data["order_status"] not in self.ALLOWED_ORDER_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid order status. Allowed statuses are: {self.ALLOWED_ORDER_STATUSES}",
            )

        if "billing_type" in update_data and update_data["billing_type"] not in self.ALLOWED_BILLING_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid billing type. Allowed billing types are: {self.ALLOWED_BILLING_TYPES}",
            )

        if "payment_status" in update_data and update_data["payment_status"] not in self.ALLOWED_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_PAYMENT_STATUSES}",
            )

        if "payment_method" in update_data and update_data["payment_method"]:
            if update_data["payment_method"] not in self.ALLOWED_PAYMENT_METHODS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid payment method. Allowed methods are: {self.ALLOWED_PAYMENT_METHODS}",
                )

        if "discount" in update_data and update_data["discount"] is not None and update_data["discount"] < 0:
            raise HTTPException(status_code=400, detail="Discount cannot be negative")

        # Check if items need update
        new_items_spec = update_data.pop("items", None)

        for key, value in update_data.items():
            setattr(order, key, value)

        if new_items_spec is not None and len(new_items_spec) > 0:
            subtotal = 0.0
            tax_amount = 0.0
            items_to_create: List[Dict[str, Any]] = []

            for order_item in new_items_spec:
                item_qty = order_item.get("quantity") if isinstance(order_item, dict) else order_item.quantity
                item_mid = order_item.get("menu_item_id") if isinstance(order_item, dict) else order_item.menu_item_id
                item_portion = order_item.get("portion") if isinstance(order_item, dict) else (order_item.portion or "full")
                item_price = order_item.get("price") if isinstance(order_item, dict) else order_item.price

                if item_qty <= 0:
                    raise HTTPException(status_code=400, detail="Item quantity must be greater than 0")

                menu_item = self.repo.get_menu_item_by_id(item_mid)
                if not menu_item or menu_item.hotel_id != order.hotel_id:
                    raise HTTPException(status_code=404, detail=f"Menu item not found: {item_mid}")

                if item_portion == "half" and menu_item.half_price is not None and menu_item.half_price > 0:
                    unit_price = menu_item.half_price
                elif item_price is not None and item_price > 0:
                    unit_price = item_price
                else:
                    unit_price = menu_item.price

                tax_percent = menu_item.tax_percent if menu_item.tax_percent is not None else 5.0
                item_total = unit_price * item_qty
                item_subtotal = item_total / (1 + tax_percent / 100)
                item_tax = item_total - item_subtotal

                subtotal += item_subtotal
                tax_amount += item_tax

                items_to_create.append({
                    "menu_item_id": menu_item.id,
                    "item_name": menu_item.name,
                    "portion": item_portion,
                    "quantity": item_qty,
                    "price": unit_price,
                    "tax_percent": tax_percent,
                    "total": round(item_total, 2),
                })

            order.subtotal = round(subtotal, 2)
            order.tax_amount = round(tax_amount, 2)
            self.repo.replace_order_items(order, items_to_create)

        if order.order_type == "room-service":
            order.billing_type = "transfer_to_booking"
            order.payment_status = "unpaid"
            order.payment_method = "room_bill"
            order.paid_amount = 0.0
        elif order.billing_type == "pending_billing":
            order.payment_status = "unpaid"
            order.payment_method = None
            order.paid_amount = 0.0
        elif order.billing_type == "paid_at_restaurant":
            order.payment_status = "paid"
            if not order.payment_method or order.payment_method == "room_bill":
                raise HTTPException(
                    status_code=400,
                    detail="Valid payment_method is required when guest pays at restaurant",
                )
            order.paid_amount = order.total_amount
        elif order.billing_type == "transfer_to_booking":
            order.payment_status = "unpaid"
            order.payment_method = "room_bill"
            order.paid_amount = 0.0
            if not order.guest_id or not order.room_id or not order.booking_id:
                raise HTTPException(
                    status_code=400,
                    detail="guest_id, room_id and booking_id are required when bill is transferred to booking",
                )

        order.total_amount = round(order.subtotal + order.tax_amount - order.discount, 2)
        if order.total_amount < 0:
            raise HTTPException(status_code=400, detail="Total amount cannot be negative")

        updated_order = self.repo.update_order(order, {})

        # 1. FolioCharge sync
        if updated_order.billing_type == "transfer_to_booking" and updated_order.order_status != "cancelled" and updated_order.booking_id:
            folio = self.repo.get_open_folio_for_booking(updated_order.booking_id)
            if folio:
                self.repo.upsert_folio_charge_for_order(updated_order, folio)
        elif updated_order.billing_type != "transfer_to_booking" or updated_order.order_status == "cancelled":
            self.repo.reverse_folio_charge_for_order(updated_order.id)

        # 2. Table status sync
        if updated_order.order_status in ["completed", "cancelled"] and updated_order.table_number:
            remaining_orders = [
                o for o in self.repo.list_orders(hotel_id=updated_order.hotel_id, order_type="dine-in")
                if o.table_number == updated_order.table_number and o.id != updated_order.id and o.order_status in ["pending", "preparing", "served"]
            ]
            if not remaining_orders:
                table = self.repo.get_table_by_number(updated_order.hotel_id, updated_order.table_number)
                if table and table.status == "occupied":
                    self.repo.update_table(table, {"status": "available"})

        return updated_order

    def delete_restaurant_order(self, order_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_delete_orders(current_user)

        order = self.repo.get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Restaurant order not found")

        self._assert_owns_hotel(
            current_user, order.hotel_id, "You can delete only restaurant orders from your own hotel"
        )

        # Reverse folio charge if present
        self.repo.reverse_folio_charge_for_order(order.id)

        # Free table if no other active orders
        if order.table_number:
            remaining_orders = [
                o for o in self.repo.list_orders(hotel_id=order.hotel_id, order_type="dine-in")
                if o.table_number == order.table_number and o.id != order.id and o.order_status in ["pending", "preparing", "served"]
            ]
            if not remaining_orders:
                table = self.repo.get_table_by_number(order.hotel_id, order.table_number)
                if table and table.status == "occupied":
                    self.repo.update_table(table, {"status": "available"})

        self.repo.delete_order(order)
        return {"message": "Restaurant order deleted successfully"}

    # -------------------------------------------------------------
    # Restaurant Tables Workflows
    # -------------------------------------------------------------

    def create_table(
        self, table_in: schemas.RestaurantTableCreate, current_user: models.User
    ) -> models.RestaurantTable:
        self._assert_can_manage_tables(current_user, "create tables")
        self._assert_owns_hotel(
            current_user, table_in.hotel_id, "You can create tables only for your own hotel"
        )

        existing = self.repo.get_table_by_number(table_in.hotel_id, table_in.table_number)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Table '{table_in.table_number}' already exists for this hotel",
            )

        if table_in.status not in self.ALLOWED_TABLE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid table status. Allowed statuses: {self.ALLOWED_TABLE_STATUSES}",
            )

        return self.repo.create_table(table_in.model_dump())

    def get_tables(
        self,
        hotel_id: Optional[int],
        section: Optional[str],
        status: Optional[str],
        current_user: models.User,
    ) -> List[schemas.RestaurantTableResponse]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        tables = self.repo.list_tables(hotel_id=target_hotel_id, section=section, status=status)

        # Query active dine-in orders to enrich tables with real-time occupancy & ticket details
        active_orders = self.repo.list_orders(
            hotel_id=target_hotel_id,
            order_type="dine-in",
        )
        active_order_map = {}
        for o in active_orders:
            if o.table_number and o.order_status in ["pending", "preparing", "served"]:
                if o.table_number not in active_order_map:
                    active_order_map[o.table_number] = o

        response_list = []
        for t in tables:
            active_o = active_order_map.get(t.table_number)
            computed_status = "occupied" if active_o and t.status in ["available", "occupied"] else t.status
            response_list.append(
                schemas.RestaurantTableResponse(
                    id=t.id,
                    hotel_id=t.hotel_id,
                    table_number=t.table_number,
                    section=t.section or "Main Hall",
                    capacity=t.capacity,
                    status=computed_status,
                    notes=t.notes,
                    created_at=t.created_at,
                    updated_at=t.updated_at,
                    active_order_id=active_o.id if active_o else None,
                    active_order_amount=float(active_o.total_amount or 0.0) if active_o else None,
                    active_guest_name=active_o.guest_name if active_o else None,
                )
            )

        return response_list

    def get_table(self, table_id: int, current_user: models.User) -> schemas.RestaurantTableResponse:
        table = self.repo.get_table_by_id(table_id)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")

        self._assert_owns_hotel(
            current_user, table.hotel_id, "You can view only tables from your own hotel"
        )

        active_orders = self.repo.list_orders(
            hotel_id=table.hotel_id,
            order_type="dine-in",
        )
        active_o = next(
            (o for o in active_orders if o.table_number == table.table_number and o.order_status in ["pending", "preparing", "served"]),
            None,
        )

        computed_status = "occupied" if active_o and table.status in ["available", "occupied"] else table.status
        return schemas.RestaurantTableResponse(
            id=table.id,
            hotel_id=table.hotel_id,
            table_number=table.table_number,
            section=table.section or "Main Hall",
            capacity=table.capacity,
            status=computed_status,
            notes=table.notes,
            created_at=table.created_at,
            updated_at=table.updated_at,
            active_order_id=active_o.id if active_o else None,
            active_order_amount=float(active_o.total_amount or 0.0) if active_o else None,
            active_guest_name=active_o.guest_name if active_o else None,
        )

    def update_table(
        self, table_id: int, table_update: schemas.RestaurantTableUpdate, current_user: models.User
    ) -> schemas.RestaurantTableResponse:
        self._assert_can_manage_tables(current_user, "update tables")

        table = self.repo.get_table_by_id(table_id)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")

        self._assert_owns_hotel(
            current_user, table.hotel_id, "You can update only tables from your own hotel"
        )

        update_data = table_update.model_dump(exclude_unset=True)

        if "status" in update_data and update_data["status"] not in self.ALLOWED_TABLE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid table status. Allowed statuses: {self.ALLOWED_TABLE_STATUSES}",
            )

        if "table_number" in update_data and update_data["table_number"] != table.table_number:
            existing = self.repo.get_table_by_number(table.hotel_id, update_data["table_number"])
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Table '{update_data['table_number']}' already exists for this hotel",
                )

        updated_table = self.repo.update_table(table, update_data)
        return schemas.RestaurantTableResponse(
            id=updated_table.id,
            hotel_id=updated_table.hotel_id,
            table_number=updated_table.table_number,
            section=updated_table.section or "Main Hall",
            capacity=updated_table.capacity,
            status=updated_table.status,
            notes=updated_table.notes,
            created_at=updated_table.created_at,
            updated_at=updated_table.updated_at,
        )

    def delete_table(self, table_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage_tables(current_user, "delete tables")

        table = self.repo.get_table_by_id(table_id)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")

        self._assert_owns_hotel(
            current_user, table.hotel_id, "You can delete only tables from your own hotel"
        )

        # Check if table has active dine-in orders
        active_orders = [
            o for o in self.repo.list_orders(hotel_id=table.hotel_id, order_type="dine-in")
            if o.table_number == table.table_number and o.order_status in ["pending", "preparing", "served"]
        ]
        if active_orders:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete table '{table.table_number}' because it has active order #{active_orders[0].id}",
            )

        self.repo.delete_table(table)
        return {"message": "Table deleted successfully"}

    # -------------------------------------------------------------
    # Restaurant KPI Statistics
    # -------------------------------------------------------------

    def get_restaurant_stats(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> schemas.RestaurantStatsResponse:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        all_orders = self.repo.list_orders(hotel_id=target_hotel_id)
        today_date = datetime.utcnow().date()

        today_orders = [
            o for o in all_orders
            if (o.created_at and o.created_at.date() == today_date) and o.order_status != "cancelled"
        ]

        pending_kitchen = [
            o for o in all_orders
            if o.order_status in ["pending", "preparing"]
        ]

        active_room_service = [
            o for o in all_orders
            if o.order_type == "room-service" and o.order_status in ["pending", "preparing"]
        ]

        today_revenue = sum(
            float(o.total_amount or 0.0)
            for o in today_orders
            if o.payment_status == "paid" or o.billing_type == "transfer_to_booking"
        )

        tables = self.repo.list_tables(hotel_id=target_hotel_id)
        active_dine_in_tables = {
            o.table_number for o in all_orders
            if o.order_type == "dine-in" and o.order_status in ["pending", "preparing", "served"] and o.table_number
        }
        occupied_tables_count = sum(
            1 for t in tables if t.status == "occupied" or t.table_number in active_dine_in_tables
        )

        menu_items = self.repo.list_menu_items(hotel_id=target_hotel_id)

        return schemas.RestaurantStatsResponse(
            today_orders=len(today_orders),
            active_tables=occupied_tables_count,
            pending_kitchen=len(pending_kitchen),
            today_revenue=round(today_revenue, 2),
            active_room_service=len(active_room_service),
            total_menu_items=len(menu_items),
            total_tables=len(tables),
        )