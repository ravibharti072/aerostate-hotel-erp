from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.restaurant_service import RestaurantService
from app.services.booking_service import BookingService

router = APIRouter(
    prefix="/restaurant",
    tags=["Restaurant"],
)


def get_restaurant_service(db: Session = Depends(get_db)) -> RestaurantService:
    return RestaurantService(db)


def get_booking_service(db: Session = Depends(get_db)) -> BookingService:
    return BookingService(db)


# -----------------------------
# RESTAURANT KPI STATS
# -----------------------------

@router.get("/stats", response_model=schemas.RestaurantStatsResponse)
def get_restaurant_stats(
    hotel_id: Optional[int] = Query(None),
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_restaurant_stats(hotel_id, current_user)


# -----------------------------
# MENU ITEMS
# -----------------------------

@router.post("/menu-items", response_model=schemas.MenuItemResponse)
def create_menu_item(
    item: schemas.MenuItemCreate,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_menu_item(item, current_user)


@router.get("/menu-items", response_model=List[schemas.MenuItemResponse])
def get_menu_items(
    hotel_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    is_available: Optional[bool] = Query(None),
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_menu_items(hotel_id, category, is_available, current_user)


@router.get("/menu-items/{item_id}", response_model=schemas.MenuItemResponse)
def get_menu_item(
    item_id: int,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_menu_item(item_id, current_user)


@router.put("/menu-items/{item_id}", response_model=schemas.MenuItemResponse)
def update_menu_item(
    item_id: int,
    item_update: schemas.MenuItemUpdate,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_menu_item(item_id, item_update, current_user)


@router.delete("/menu-items/{item_id}")
def delete_menu_item(
    item_id: int,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_menu_item(item_id, current_user)


# -----------------------------
# TABLES
# -----------------------------

@router.post("/tables", response_model=schemas.RestaurantTableResponse)
def create_table(
    table_in: schemas.RestaurantTableCreate,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_table(table_in, current_user)


@router.get("/tables", response_model=List[schemas.RestaurantTableResponse])
def get_tables(
    hotel_id: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_tables(hotel_id, section, status, current_user)


@router.get("/tables/{table_id}", response_model=schemas.RestaurantTableResponse)
def get_table(
    table_id: int,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_table(table_id, current_user)


@router.put("/tables/{table_id}", response_model=schemas.RestaurantTableResponse)
def update_table(
    table_id: int,
    table_update: schemas.RestaurantTableUpdate,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_table(table_id, table_update, current_user)


@router.delete("/tables/{table_id}")
def delete_table(
    table_id: int,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_table(table_id, current_user)


# -----------------------------
# ORDERS
# -----------------------------

@router.post("/orders", response_model=schemas.RestaurantOrderResponse)
def create_restaurant_order(
    order: schemas.RestaurantOrderCreate,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_restaurant_order(order, current_user)


@router.get("/orders", response_model=List[schemas.RestaurantOrderResponse])
def get_restaurant_orders(
    hotel_id: Optional[int] = Query(None),
    guest_id: Optional[int] = Query(None),
    room_id: Optional[int] = Query(None),
    booking_id: Optional[int] = Query(None),
    order_type: Optional[str] = Query(None),
    order_status: Optional[str] = Query(None),
    billing_type: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_restaurant_orders(
        hotel_id,
        guest_id,
        room_id,
        booking_id,
        order_type,
        order_status,
        billing_type,
        payment_status,
        current_user,
    )


@router.get("/orders/{order_id}", response_model=schemas.RestaurantOrderResponse)
def get_restaurant_order(
    order_id: int,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_restaurant_order(order_id, current_user)


@router.put("/orders/{order_id}", response_model=schemas.RestaurantOrderResponse)
def update_restaurant_order(
    order_id: int,
    order_update: schemas.RestaurantOrderUpdate,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_restaurant_order(order_id, order_update, current_user)


@router.delete("/orders/{order_id}")
def delete_restaurant_order(
    order_id: int,
    service: RestaurantService = Depends(get_restaurant_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_restaurant_order(order_id, current_user)


# -----------------------------
# IN-HOUSE GUESTS FOR F&B / ROOM SERVICE
# -----------------------------

@router.get("/in-house-guests", response_model=List[schemas.InHouseGuestResponse])
def get_restaurant_in_house_guests(
    hotel_id: Optional[int] = Query(None),
    booking_service: BookingService = Depends(get_booking_service),
    current_user: models.User = Depends(get_current_user),
):
    """Authoritative endpoint for Restaurant to fetch active in-house resident guests directly from the database."""
    return booking_service.get_in_house_guests(hotel_id=hotel_id, current_user=current_user)