from datetime import date, datetime
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.services.report_service import ReportService

router = APIRouter(
    tags=["Reports & Dashboards"]
)


def get_report_service(db: Session = Depends(get_db)) -> ReportService:
    return ReportService(db)


# -----------------------------
# FINANCE REPORT APIs
# -----------------------------

@router.get("/reports/finance-summary")
def get_finance_summary(
    hotel_id: Optional[int] = Query(None),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_finance_summary(hotel_id, current_user)


@router.get("/reports/profit-loss")
def get_profit_loss_report(
    hotel_id: Optional[int] = Query(None),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_profit_loss_report(hotel_id, current_user)


@router.get("/reports/revenue-summary")
def get_revenue_summary(
    hotel_id: Optional[int] = Query(None),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_revenue_summary(hotel_id, current_user)


@router.get("/reports/expense-summary")
def get_expense_summary(
    hotel_id: Optional[int] = Query(None),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_expense_summary(hotel_id, current_user)


# -----------------------------
# PHASE 7: AUDIT & CLOSING APIs
# -----------------------------

@router.get("/reports/cashier-shift-summary")
def get_cashier_shift_summary(
    hotel_id: Optional[int] = Query(None),
    target_date: Optional[date] = Query(None, description="Date for shift summary (YYYY-MM-DD)"),
    cashier_username: Optional[str] = Query(None, description="Filter by cashier user"),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns cashier end-of-shift reconciliation summaries grouped by payment method
    (Cash, UPI, Card, Bank Transfer, Cheque) and payment type (advance, settlement, refund).
    """
    return service.get_cashier_shift_summary(hotel_id, target_date, cashier_username, current_user)


@router.get("/reports/daily-closing")
def get_daily_closing_report(
    hotel_id: Optional[int] = Query(None),
    report_date: Optional[date] = Query(None, description="Date of daily closing (YYYY-MM-DD)"),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generates a daily financial closing summary including gross revenue, tax breakdowns,
    refund disbursements, and payment-method drawer totals.
    """
    return service.get_daily_closing_report(hotel_id, report_date, current_user)


@router.get("/reports/audit-trail")
def get_payment_audit_trail(
    hotel_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    payment_type: Optional[str] = Query(None, description="Filter: advance | settlement | refund"),
    payment_method: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns an immutable transaction audit log of all financial events.
    """
    return service.get_payment_audit_trail(
        hotel_id=hotel_id,
        start_date=start_date,
        end_date=end_date,
        payment_type=payment_type,
        payment_method=payment_method,
        limit=limit,
        current_user=current_user,
    )


# -----------------------------
# DASHBOARD SUMMARY APIs
# -----------------------------

@router.get("/dashboard/summary")
def get_dashboard_summary(
    hotel_id: Optional[int] = Query(None),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_dashboard_summary(hotel_id, current_user)


@router.get("/dashboard/room-status-summary")
def get_room_status_summary(
    hotel_id: Optional[int] = Query(None),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_room_status_summary(hotel_id, current_user)


@router.get("/dashboard/today-summary")
def get_today_summary(
    hotel_id: Optional[int] = Query(None),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_today_summary(hotel_id, current_user)


@router.get("/dashboard/recent-activity")
def get_recent_activity(
    hotel_id: Optional[int] = Query(None),
    limit: int = Query(10),
    service: ReportService = Depends(get_report_service),
    current_user: models.User = Depends(get_current_user),
) -> Dict[str, Any]:
    return service.get_recent_activity(hotel_id, limit, current_user)