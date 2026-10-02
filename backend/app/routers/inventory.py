from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.services.inventory_service import InventoryService

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
)


def get_inventory_service(db: Session = Depends(get_db)) -> InventoryService:
    return InventoryService(db)


# -------------------------------------------------------------
# Inventory Dashboard Analytics (Phase 10)
# -------------------------------------------------------------

@router.get("/dashboard", response_model=schemas.InventoryDashboardSummaryResponse)
def get_inventory_dashboard(
    hotel_id: Optional[int] = Query(None),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns high-level operational inventory KPIs, department consumption,
    category valuations, top consumed stock, and low-stock alerts.
    """
    return service.get_dashboard_summary(hotel_id, current_user)


# -------------------------------------------------------------
# Physical Stock Count & Reconciliation (Phase 9)
# -------------------------------------------------------------

@router.post("/physical-counts", response_model=schemas.PhysicalStockCountResponse)
def create_physical_count(
    payload: schemas.PhysicalStockCountCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Creates a physical stock count draft session and calculates store-level variances.
    """
    return service.create_physical_count(payload, current_user)


@router.post("/physical-counts/{count_id}/finalize", response_model=schemas.PhysicalStockCountResponse)
def finalize_physical_count(
    count_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Finalizes and approves a physical count, automatically executing stock reconciliation 
    adjustments for all variances.
    """
    return service.finalize_physical_count(count_id, current_user)


@router.get("/physical-counts", response_model=schemas.PaginatedPhysicalStockCountResponse)
def get_physical_counts(
    hotel_id: Optional[int] = Query(None),
    store_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_physical_counts(
        hotel_id=hotel_id,
        store_id=store_id,
        status=status,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/physical-counts/{count_id}", response_model=schemas.PhysicalStockCountResponse)
def get_physical_count(
    count_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_physical_count(count_id, current_user)


# -------------------------------------------------------------
# Stock Adjustments (Phase 8)
# -------------------------------------------------------------

@router.post("/adjustments", response_model=schemas.InventoryAdjustmentResponse)
def adjust_stock(
    payload: schemas.InventoryAdjustmentCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Manually adjusts item stock count up or down with auditable reason logging.
    """
    return service.adjust_stock(payload, current_user)


@router.get("/adjustments", response_model=schemas.PaginatedInventoryAdjustmentResponse)
def get_adjustments(
    hotel_id: Optional[int] = Query(None),
    store_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_adjustments(
        hotel_id=hotel_id,
        store_id=store_id,
        item_id=item_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


# -------------------------------------------------------------
# Damage / Wastage / Expiry (Phase 8)
# -------------------------------------------------------------

@router.post("/wastages", response_model=schemas.InventoryWastageResponse)
def record_wastage(
    payload: schemas.InventoryWastageCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Records operational stock write-offs (Damage, Spoilage, Expiry, Breakage).
    """
    return service.record_wastage(payload, current_user)


@router.get("/wastages", response_model=schemas.PaginatedInventoryWastageResponse)
def get_wastages(
    hotel_id: Optional[int] = Query(None),
    waste_type: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_wastages(
        hotel_id=hotel_id,
        waste_type=waste_type,
        store_id=store_id,
        item_id=item_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


# -------------------------------------------------------------
# Returns from Departments (Phase 7)
# -------------------------------------------------------------

@router.post("/returns", response_model=schemas.InventoryReturnResponse)
def return_stock_from_department(
    payload: schemas.InventoryReturnCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Processes unused department items returned back to store.
    Increases store stock and logs RETURN_TO_STORE to the ledger.
    """
    return service.return_stock_from_department(payload, current_user)


@router.get("/returns", response_model=schemas.PaginatedInventoryReturnResponse)
def get_returns(
    hotel_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_returns(
        hotel_id=hotel_id,
        department=department,
        store_id=store_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/returns/{return_id}", response_model=schemas.InventoryReturnResponse)
def get_return(
    return_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_return(return_id, current_user)


# -------------------------------------------------------------
# Supplier Returns (Phase 7)
# -------------------------------------------------------------

@router.post("/supplier-returns", response_model=schemas.InventorySupplierReturnResponse)
def return_goods_to_supplier(
    payload: schemas.InventorySupplierReturnCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Processes defective, expired, or wrong goods returned back to the vendor.
    Deducts store inventory and logs SUPPLIER_RETURN to the ledger.
    """
    return service.return_goods_to_supplier(payload, current_user)


@router.get("/supplier-returns", response_model=schemas.PaginatedInventorySupplierReturnResponse)
def get_supplier_returns(
    hotel_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    store_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_supplier_returns(
        hotel_id=hotel_id,
        supplier_id=supplier_id,
        store_id=store_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/supplier-returns/{sret_id}", response_model=schemas.InventorySupplierReturnResponse)
def get_supplier_return(
    sret_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_supplier_return(sret_id, current_user)


# -------------------------------------------------------------
# Inter-Store Stock Transfers (Phase 7)
# -------------------------------------------------------------

@router.post("/transfers", response_model=schemas.InventoryTransferResponse)
def transfer_stock(
    payload: schemas.InventoryTransferCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    """
    Transfers inventory between stores (e.g. Main Store -> Housekeeping Store).
    Atomically shifts location stock and logs matched TRANSFER_OUT / TRANSFER_IN movements.
    """
    return service.transfer_stock(payload, current_user)


@router.get("/transfers", response_model=schemas.PaginatedInventoryTransferResponse)
def get_transfers(
    hotel_id: Optional[int] = Query(None),
    from_store_id: Optional[int] = Query(None),
    to_store_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_transfers(
        hotel_id=hotel_id,
        from_store_id=from_store_id,
        to_store_id=to_store_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/transfers/{transfer_id}", response_model=schemas.InventoryTransferResponse)
def get_transfer(
    transfer_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_transfer(transfer_id, current_user)


# -------------------------------------------------------------
# Department Issues (Phase 6)
# -------------------------------------------------------------

@router.post("/issues", response_model=schemas.InventoryIssueResponse)
def issue_stock(
    payload: schemas.InventoryIssueCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.issue_stock(payload, current_user)


@router.get("/issues", response_model=schemas.PaginatedInventoryIssueResponse)
def get_issues(
    hotel_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_issues(
        hotel_id=hotel_id,
        department=department,
        store_id=store_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/issues/{issue_id}", response_model=schemas.InventoryIssueResponse)
def get_issue(
    issue_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_issue(issue_id, current_user)


# -------------------------------------------------------------
# Department Consumption (Phase 6)
# -------------------------------------------------------------

@router.post("/consumptions", response_model=schemas.InventoryConsumptionResponse)
def record_consumption(
    payload: schemas.InventoryConsumptionCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.record_consumption(payload, current_user)


@router.get("/consumptions", response_model=schemas.PaginatedInventoryConsumptionResponse)
def get_consumptions(
    hotel_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_consumptions(
        hotel_id=hotel_id,
        department=department,
        store_id=store_id,
        item_id=item_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


# -------------------------------------------------------------
# Goods Receipt Note (GRN) / Purchase Receiving (Phase 5)
# -------------------------------------------------------------

@router.post("/receipts", response_model=schemas.InventoryReceiptResponse)
def receive_goods(
    payload: schemas.InventoryReceiptCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.receive_goods(payload, current_user)


@router.get("/receipts", response_model=schemas.PaginatedInventoryReceiptResponse)
def get_receipts(
    hotel_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    store_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_receipts(
        hotel_id=hotel_id,
        supplier_id=supplier_id,
        store_id=store_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/receipts/{receipt_id}", response_model=schemas.InventoryReceiptResponse)
def get_receipt(
    receipt_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_receipt(receipt_id, current_user)


# -------------------------------------------------------------
# Stock Engine & Ledger Endpoints
# -------------------------------------------------------------

@router.post("/movements", response_model=schemas.StockLedgerResponse)
def execute_stock_movement(
    movement: schemas.StockMovementRequest,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.execute_stock_movement(movement, current_user)


@router.get("/ledger", response_model=schemas.PaginatedStockLedgerResponse)
def get_stock_ledger(
    hotel_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    store_id: Optional[int] = Query(None),
    movement_type: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_stock_ledger(
        hotel_id=hotel_id,
        item_id=item_id,
        store_id=store_id,
        movement_type=movement_type,
        department=department,
        supplier_id=supplier_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


# -------------------------------------------------------------
# Stores / Warehouses
# -------------------------------------------------------------

@router.post("/stores", response_model=schemas.InventoryStoreResponse)
def create_inventory_store(
    store: schemas.InventoryStoreCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_store(store, current_user)


@router.get("/stores", response_model=List[schemas.InventoryStoreResponse])
def get_inventory_stores(
    hotel_id: Optional[int] = Query(None),
    active_only: bool = Query(False),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_stores(hotel_id, active_only, current_user)


@router.get("/stores/{store_id}", response_model=schemas.InventoryStoreResponse)
def get_inventory_store(
    store_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_store(store_id, current_user)


@router.put("/stores/{store_id}", response_model=schemas.InventoryStoreResponse)
def update_inventory_store(
    store_id: int,
    store_update: schemas.InventoryStoreUpdate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_store(store_id, store_update, current_user)


@router.delete("/stores/{store_id}")
def delete_inventory_store(
    store_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_store(store_id, current_user)


# -------------------------------------------------------------
# Suppliers / Vendors
# -------------------------------------------------------------

@router.post("/suppliers", response_model=schemas.VendorResponse)
def create_inventory_supplier(
    vendor: schemas.VendorCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_supplier(vendor, current_user)


@router.get("/suppliers", response_model=List[schemas.VendorResponse])
def get_inventory_suppliers(
    hotel_id: Optional[int] = Query(None),
    active_only: bool = Query(False),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_suppliers(hotel_id, active_only, current_user)


@router.get("/suppliers/{supplier_id}", response_model=schemas.VendorResponse)
def get_inventory_supplier(
    supplier_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_supplier(supplier_id, current_user)


@router.put("/suppliers/{supplier_id}", response_model=schemas.VendorResponse)
def update_inventory_supplier(
    supplier_id: int,
    vendor_update: schemas.VendorUpdate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_supplier(supplier_id, vendor_update, current_user)


# -------------------------------------------------------------
# Categories
# -------------------------------------------------------------

@router.post("/categories", response_model=schemas.InventoryCategoryResponse)
def create_inventory_category(
    category: schemas.InventoryCategoryCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_category(category, current_user)


@router.get("/categories", response_model=List[schemas.InventoryCategoryResponse])
def get_inventory_categories(
    hotel_id: Optional[int] = Query(None),
    active_only: bool = Query(False),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_categories(hotel_id, active_only, current_user)


@router.get("/categories/{category_id}", response_model=schemas.InventoryCategoryResponse)
def get_inventory_category(
    category_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_category(category_id, current_user)


@router.put("/categories/{category_id}", response_model=schemas.InventoryCategoryResponse)
def update_inventory_category(
    category_id: int,
    category_update: schemas.InventoryCategoryUpdate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_category(category_id, category_update, current_user)


@router.delete("/categories/{category_id}")
def delete_inventory_category(
    category_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_category(category_id, current_user)


# -------------------------------------------------------------
# Units of Measure
# -------------------------------------------------------------

@router.post("/units", response_model=schemas.InventoryUnitResponse)
def create_inventory_unit(
    unit: schemas.InventoryUnitCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_unit(unit, current_user)


@router.get("/units", response_model=List[schemas.InventoryUnitResponse])
def get_inventory_units(
    hotel_id: Optional[int] = Query(None),
    active_only: bool = Query(False),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_units(hotel_id, active_only, current_user)


@router.get("/units/{unit_id}", response_model=schemas.InventoryUnitResponse)
def get_inventory_unit(
    unit_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_unit(unit_id, current_user)


@router.put("/units/{unit_id}", response_model=schemas.InventoryUnitResponse)
def update_inventory_unit(
    unit_id: int,
    unit_update: schemas.InventoryUnitUpdate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_unit(unit_id, unit_update, current_user)


@router.delete("/units/{unit_id}")
def delete_inventory_unit(
    unit_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_unit(unit_id, current_user)


# -------------------------------------------------------------
# Inventory Items (Backward-Compatible + Extended)
# -------------------------------------------------------------

@router.post("/items", response_model=schemas.InventoryItemResponse)
def create_inventory_item(
    item: schemas.InventoryItemCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_inventory_item(item, current_user)


@router.get("/items", response_model=List[schemas.InventoryItemResponse])
def get_inventory_items(
    hotel_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    low_stock_only: bool = Query(False),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_inventory_items(hotel_id, category, category_id, low_stock_only, current_user)


@router.get("/items/{item_id}", response_model=schemas.InventoryItemResponse)
def get_inventory_item(
    item_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_inventory_item(item_id, current_user)


@router.get("/items/{item_id}/locations", response_model=List[schemas.LocationStockResponse])
def get_inventory_item_locations(
    item_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_item_location_stocks(item_id, current_user)


@router.put("/items/{item_id}", response_model=schemas.InventoryItemResponse)
def update_inventory_item(
    item_id: int,
    item_update: schemas.InventoryItemUpdate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.update_inventory_item(item_id, item_update, current_user)


@router.delete("/items/{item_id}")
def delete_inventory_item(
    item_id: int,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, str]:
    return service.delete_inventory_item(item_id, current_user)


# -------------------------------------------------------------
# Stock Transactions (Preserved Compatibility)
# -------------------------------------------------------------

@router.post("/stock-transactions", response_model=schemas.StockTransactionResponse)
def create_stock_transaction(
    transaction: schemas.StockTransactionCreate,
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.create_stock_transaction(transaction, current_user)


@router.get("/stock-transactions", response_model=List[schemas.StockTransactionResponse])
def get_stock_transactions(
    hotel_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    service: InventoryService = Depends(get_inventory_service),
    current_user: models.User = Depends(get_current_user),
):
    return service.get_stock_transactions(hotel_id, item_id, transaction_type, current_user)