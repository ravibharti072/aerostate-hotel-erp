from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app import models


class RestaurantRepository:
    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------
    # Menu Items
    # -------------------------------------------------------------

    def get_menu_item_by_id(self, item_id: int) -> Optional[models.MenuItem]:
        return self.db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()

    def get_menu_item_by_name(self, hotel_id: int, name: str) -> Optional[models.MenuItem]:
        return (
            self.db.query(models.MenuItem)
            .filter(
                models.MenuItem.hotel_id == hotel_id,
                models.MenuItem.name == name,
            )
            .first()
        )

    def get_duplicate_menu_item_name(
        self, hotel_id: int, name: str, exclude_item_id: int
    ) -> Optional[models.MenuItem]:
        return (
            self.db.query(models.MenuItem)
            .filter(
                models.MenuItem.hotel_id == hotel_id,
                models.MenuItem.name == name,
                models.MenuItem.id != exclude_item_id,
            )
            .first()
        )

    def list_menu_items(
        self,
        hotel_id: Optional[int] = None,
        category: Optional[str] = None,
        is_available: Optional[bool] = None,
    ) -> List[models.MenuItem]:
        query = self.db.query(models.MenuItem)

        if hotel_id is not None:
            query = query.filter(models.MenuItem.hotel_id == hotel_id)
        if category is not None:
            query = query.filter(models.MenuItem.category == category)
        if is_available is not None:
            query = query.filter(models.MenuItem.is_available == is_available)

        return query.order_by(models.MenuItem.id.desc()).all()

    def create_menu_item(self, item_data: Dict[str, Any]) -> models.MenuItem:
        new_item = models.MenuItem(**item_data)
        self.db.add(new_item)
        self.db.commit()
        self.db.refresh(new_item)
        return new_item

    def update_menu_item(
        self, item: models.MenuItem, update_fields: Dict[str, Any]
    ) -> models.MenuItem:
        for key, value in update_fields.items():
            setattr(item, key, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_menu_item(self, item: models.MenuItem) -> None:
        self.db.delete(item)
        self.db.commit()

    def is_menu_item_used_in_orders(self, menu_item_id: int) -> bool:
        return (
            self.db.query(models.RestaurantOrderItem)
            .filter(models.RestaurantOrderItem.menu_item_id == menu_item_id)
            .first()
            is not None
        )

    # -------------------------------------------------------------
    # Restaurant Orders
    # -------------------------------------------------------------

    def get_order_by_id(self, order_id: int) -> Optional[models.RestaurantOrder]:
        return (
            self.db.query(models.RestaurantOrder)
            .filter(models.RestaurantOrder.id == order_id)
            .first()
        )

    def list_orders(
        self,
        hotel_id: Optional[int] = None,
        guest_id: Optional[int] = None,
        room_id: Optional[int] = None,
        booking_id: Optional[int] = None,
        order_type: Optional[str] = None,
        order_status: Optional[str] = None,
        billing_type: Optional[str] = None,
        payment_status: Optional[str] = None,
    ) -> List[models.RestaurantOrder]:
        query = self.db.query(models.RestaurantOrder)

        if hotel_id is not None:
            query = query.filter(models.RestaurantOrder.hotel_id == hotel_id)
        if guest_id is not None:
            query = query.filter(models.RestaurantOrder.guest_id == guest_id)
        if room_id is not None:
            query = query.filter(models.RestaurantOrder.room_id == room_id)
        if booking_id is not None:
            query = query.filter(models.RestaurantOrder.booking_id == booking_id)
        if order_type is not None:
            query = query.filter(models.RestaurantOrder.order_type == order_type)
        if order_status is not None:
            query = query.filter(models.RestaurantOrder.order_status == order_status)
        if billing_type is not None:
            query = query.filter(models.RestaurantOrder.billing_type == billing_type)
        if payment_status is not None:
            query = query.filter(models.RestaurantOrder.payment_status == payment_status)

        return query.order_by(models.RestaurantOrder.id.desc()).all()

    def create_order_with_items(
        self,
        order_data: Dict[str, Any],
        items_data: List[Dict[str, Any]],
    ) -> models.RestaurantOrder:
        new_order = models.RestaurantOrder(**order_data)
        self.db.add(new_order)
        self.db.commit()
        self.db.refresh(new_order)

        for item_dict in items_data:
            item_dict["order_id"] = new_order.id
            new_item = models.RestaurantOrderItem(**item_dict)
            self.db.add(new_item)

        self.db.commit()
        self.db.refresh(new_order)
        return new_order

    def update_order(
        self, order: models.RestaurantOrder, update_fields: Dict[str, Any]
    ) -> models.RestaurantOrder:
        for key, value in update_fields.items():
            setattr(order, key, value)
        self.db.commit()
        self.db.refresh(order)
        return order

    def delete_order(self, order: models.RestaurantOrder) -> None:
        order_items = (
            self.db.query(models.RestaurantOrderItem)
            .filter(models.RestaurantOrderItem.order_id == order.id)
            .all()
        )
        for item in order_items:
            self.db.delete(item)

        self.db.delete(order)
        self.db.commit()

    # -------------------------------------------------------------
    # Cross-Domain Entities (Hotel, Guest, Room, Booking)
    # -------------------------------------------------------------

    def get_hotel_by_id(self, hotel_id: int) -> Optional[models.Hotel]:
        return self.db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

    def get_guest_by_id(self, guest_id: int, hotel_id: int) -> Optional[models.Guest]:
        return (
            self.db.query(models.Guest)
            .filter(
                models.Guest.id == guest_id,
                models.Guest.hotel_id == hotel_id,
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

    def get_booking_by_id(self, booking_id: int, hotel_id: int) -> Optional[models.Booking]:
        return (
            self.db.query(models.Booking)
            .filter(
                models.Booking.id == booking_id,
                models.Booking.hotel_id == hotel_id,
            )
            .first()
        )

    # -------------------------------------------------------------
    # Restaurant Tables
    # -------------------------------------------------------------

    def get_table_by_id(self, table_id: int) -> Optional[models.RestaurantTable]:
        return self.db.query(models.RestaurantTable).filter(models.RestaurantTable.id == table_id).first()

    def get_table_by_number(self, hotel_id: int, table_number: str) -> Optional[models.RestaurantTable]:
        return (
            self.db.query(models.RestaurantTable)
            .filter(
                models.RestaurantTable.hotel_id == hotel_id,
                models.RestaurantTable.table_number == table_number,
            )
            .first()
        )

    def list_tables(
        self,
        hotel_id: Optional[int] = None,
        section: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[models.RestaurantTable]:
        query = self.db.query(models.RestaurantTable)
        if hotel_id is not None:
            query = query.filter(models.RestaurantTable.hotel_id == hotel_id)
        if section is not None:
            query = query.filter(models.RestaurantTable.section == section)
        if status is not None:
            query = query.filter(models.RestaurantTable.status == status)
        return query.order_by(models.RestaurantTable.table_number.asc()).all()

    def create_table(self, table_data: Dict[str, Any]) -> models.RestaurantTable:
        new_table = models.RestaurantTable(**table_data)
        self.db.add(new_table)
        self.db.commit()
        self.db.refresh(new_table)
        return new_table

    def update_table(
        self, table: models.RestaurantTable, update_fields: Dict[str, Any]
    ) -> models.RestaurantTable:
        for key, value in update_fields.items():
            setattr(table, key, value)
        self.db.commit()
        self.db.refresh(table)
        return table

    def delete_table(self, table: models.RestaurantTable) -> None:
        self.db.delete(table)
        self.db.commit()

    # -------------------------------------------------------------
    # Folio Integration
    # -------------------------------------------------------------

    def get_open_folio_for_booking(self, booking_id: int) -> Optional[models.Folio]:
        if not hasattr(models, "Folio"):
            return None
        return (
            self.db.query(models.Folio)
            .filter(models.Folio.booking_id == booking_id)
            .first()
        )

    def get_folio_charge_for_order(self, folio_id: int, order_id: int) -> Optional[models.FolioCharge]:
        if not hasattr(models, "FolioCharge"):
            return None
        return (
            self.db.query(models.FolioCharge)
            .filter(
                models.FolioCharge.folio_id == folio_id,
                models.FolioCharge.description.like(f"Restaurant Order #{order_id}%"),
            )
            .first()
        )

    def upsert_folio_charge_for_order(
        self,
        order: models.RestaurantOrder,
        folio: models.Folio,
    ) -> Optional[models.FolioCharge]:
        if not hasattr(models, "FolioCharge"):
            return None
        charge = self.get_folio_charge_for_order(folio.id, order.id)
        desc = f"Restaurant Order #{order.id} ({order.order_type.title()})"
        if charge:
            charge.rate = order.total_amount
            charge.total_amount = order.total_amount
            charge.taxable_amount = order.subtotal
            charge.tax_amount = order.tax_amount
            charge.status = "posted"
            charge.description = desc
        else:
            charge = models.FolioCharge(
                hotel_id=order.hotel_id,
                folio_id=folio.id,
                guest_id=order.guest_id or folio.guest_id,
                booking_id=order.booking_id,
                room_id=order.room_id,
                department="Restaurant",
                description=desc,
                sac_code="996331",
                quantity=1.0,
                rate=order.total_amount,
                taxable_amount=order.subtotal,
                tax_rate=5.0,
                tax_type="GST",
                tax_amount=order.tax_amount,
                total_amount=order.total_amount,
                status="posted",
                created_by=order.created_by or "Restaurant",
            )
            self.db.add(charge)
        self.db.commit()
        self.db.refresh(charge)
        return charge

    def reverse_folio_charge_for_order(self, order_id: int) -> None:
        if not hasattr(models, "FolioCharge"):
            return
        charges = (
            self.db.query(models.FolioCharge)
            .filter(models.FolioCharge.description.like(f"Restaurant Order #{order_id}%"))
            .all()
        )
        for c in charges:
            c.status = "reversed"
        self.db.commit()

    def replace_order_items(
        self, order: models.RestaurantOrder, new_items: List[Dict[str, Any]]
    ) -> None:
        self.db.query(models.RestaurantOrderItem).filter(
            models.RestaurantOrderItem.order_id == order.id
        ).delete()
        for item_dict in new_items:
            item_dict["order_id"] = order.id
            self.db.add(models.RestaurantOrderItem(**item_dict))
        self.db.commit()