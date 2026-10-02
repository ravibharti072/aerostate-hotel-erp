from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.procurement_service import ProcurementService

router = APIRouter(
    tags=["Procurement & Vendors"]
)


def get_procurement_service(db: Session = Depends(get_db)) -> ProcurementService:
    return ProcurementService(db)


# -----------------------------
# VENDOR APIs
# -----------------------------

@router.post("/vendors", response_model=schemas.VendorResponse)
def create_vendor(
    vendor: schemas.VendorCreate,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_vendor(vendor, current_user)


@router.get("/vendors", response_model=List[schemas.VendorResponse])
def get_vendors(
    hotel_id: Optional[int] = Query(None),
    vendor_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_vendors(hotel_id, vendor_type, status, current_user)


@router.get("/vendors/{vendor_id}", response_model=schemas.VendorResponse)
def get_vendor(
    vendor_id: int,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_vendor(vendor_id, current_user)


@router.put("/vendors/{vendor_id}", response_model=schemas.VendorResponse)
def update_vendor(
    vendor_id: int,
    vendor_update: schemas.VendorUpdate,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_vendor(vendor_id, vendor_update, current_user)


@router.delete("/vendors/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_vendor(vendor_id, current_user)


# -----------------------------
# PURCHASE ORDER APIs
# -----------------------------

@router.post("/purchase-orders", response_model=schemas.PurchaseOrderResponse)
def create_purchase_order(
    purchase_order: schemas.PurchaseOrderCreate,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_purchase_order(purchase_order, current_user)


@router.get("/purchase-orders", response_model=List[schemas.PurchaseOrderResponse])
def get_purchase_orders(
    hotel_id: Optional[int] = Query(None),
    vendor_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_purchase_orders(hotel_id, vendor_id, status, payment_status, current_user)


@router.get("/purchase-orders/{purchase_order_id}", response_model=schemas.PurchaseOrderResponse)
def get_purchase_order(
    purchase_order_id: int,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_purchase_order(purchase_order_id, current_user)


@router.put("/purchase-orders/{purchase_order_id}", response_model=schemas.PurchaseOrderResponse)
def update_purchase_order(
    purchase_order_id: int,
    purchase_order_update: schemas.PurchaseOrderUpdate,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_purchase_order(purchase_order_id, purchase_order_update, current_user)


@router.delete("/purchase-orders/{purchase_order_id}")
def delete_purchase_order(
    purchase_order_id: int,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_purchase_order(purchase_order_id, current_user)


@router.post("/purchase-orders/{purchase_order_id}/receive", response_model=schemas.PurchaseOrderResponse)
def receive_purchase_order(
    purchase_order_id: int,
    receive_data: schemas.PurchaseOrderReceive,
    service: ProcurementService = Depends(get_procurement_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.receive_purchase_order(purchase_order_id, receive_data, current_user)