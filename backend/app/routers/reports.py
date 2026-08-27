from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    tags=["Reports & Dashboards"]
)

FINANCE_REPORT_ROLES = [
    "super-admin",
    "hotel-admin",
    "manager",
    "accountant"
]

DASHBOARD_ROLES = [
    "super-admin",
    "hotel-admin",
    "manager",
    "front-desk",
    "housekeeping",
    "restaurant",
    "inventory",
    "accountant",
    "maintenance",
    "hr"
]

def get_report_hotel_id(
    requested_hotel_id: Optional[int],
    current_user: models.User,
    db: Session
):
    if current_user.role not in FINANCE_REPORT_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to access finance reports"
        )

    if current_user.role == "super-admin":
        if requested_hotel_id:
            hotel = db.query(models.Hotel).filter(
                models.Hotel.id == requested_hotel_id
            ).first()

            if not hotel:
                raise HTTPException(
                    status_code=404,
                    detail="Hotel not found"
                )

        return requested_hotel_id

    if not current_user.hotel_id:
        raise HTTPException(
            status_code=403,
            detail="User is not assigned to any hotel"
        )

    if requested_hotel_id and requested_hotel_id != current_user.hotel_id:
        raise HTTPException(
            status_code=403,
            detail="You can only access reports for your own hotel"
        )

    return current_user.hotel_id


def get_dashboard_hotel_id(
    requested_hotel_id: Optional[int],
    current_user: models.User,
    db: Session
):
    if current_user.role not in DASHBOARD_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to access dashboard"
        )

    if current_user.role == "super-admin":
        if requested_hotel_id:
            hotel = db.query(models.Hotel).filter(
                models.Hotel.id == requested_hotel_id
            ).first()

            if not hotel:
                raise HTTPException(
                    status_code=404,
                    detail="Hotel not found"
                )

        return requested_hotel_id

    if not current_user.hotel_id:
        raise HTTPException(
            status_code=403,
            detail="User is not assigned to any hotel"
        )

    if requested_hotel_id and requested_hotel_id != current_user.hotel_id:
        raise HTTPException(
            status_code=403,
            detail="You can only access dashboard for your own hotel"
        )

    return current_user.hotel_id


# -----------------------------
# FINANCE REPORT APIs
# -----------------------------

@router.get("/reports/finance-summary")
def get_finance_summary(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_report_hotel_id(hotel_id, current_user, db)

    invoice_query = db.query(models.Invoice)
    payment_query = db.query(models.Payment)
    expense_query = db.query(models.Expense)

    if final_hotel_id:
        invoice_query = invoice_query.filter(models.Invoice.hotel_id == final_hotel_id)
        payment_query = payment_query.filter(models.Payment.hotel_id == final_hotel_id)
        expense_query = expense_query.filter(models.Expense.hotel_id == final_hotel_id)

    invoices = invoice_query.all()
    payments = payment_query.all()
    expenses = expense_query.all()

    total_invoice_revenue = sum(invoice.grand_total for invoice in invoices)
    total_paid_amount = sum(invoice.paid_amount for invoice in invoices)
    total_due_amount = sum(invoice.due_amount for invoice in invoices)

    total_payments_received = sum(payment.amount for payment in payments)

    total_expenses = sum(
        expense.amount for expense in expenses
        if expense.payment_status == "paid"
    )

    net_profit_loss = total_paid_amount - total_expenses

    return {
        "hotel_id": final_hotel_id,
        "total_invoice_revenue": total_invoice_revenue,
        "total_paid_amount": total_paid_amount,
        "total_due_amount": total_due_amount,
        "total_payments_received": total_payments_received,
        "total_expenses": total_expenses,
        "net_profit_loss": net_profit_loss,
        "total_invoices": len(invoices),
        "total_payments": len(payments),
        "total_expense_records": len(expenses)
    }


@router.get("/reports/profit-loss")
def get_profit_loss_report(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_report_hotel_id(hotel_id, current_user, db)

    invoice_query = db.query(models.Invoice)
    expense_query = db.query(models.Expense)

    if final_hotel_id:
        invoice_query = invoice_query.filter(models.Invoice.hotel_id == final_hotel_id)
        expense_query = expense_query.filter(models.Expense.hotel_id == final_hotel_id)

    invoices = invoice_query.all()
    expenses = expense_query.all()

    room_revenue = sum(invoice.room_charges for invoice in invoices)
    restaurant_revenue = sum(invoice.restaurant_charges for invoice in invoices)
    laundry_revenue = sum(invoice.laundry_charges for invoice in invoices)
    minibar_revenue = sum(invoice.minibar_charges for invoice in invoices)
    extra_revenue = sum(invoice.extra_charges for invoice in invoices)
    tax_collected = sum(invoice.tax_amount for invoice in invoices)
    discount_given = sum(invoice.discount for invoice in invoices)

    total_revenue = sum(invoice.paid_amount for invoice in invoices)

    total_expenses = sum(
        expense.amount for expense in expenses
        if expense.payment_status == "paid"
    )

    profit_or_loss = total_revenue - total_expenses

    result_status = "profit"

    if profit_or_loss < 0:
        result_status = "loss"
    elif profit_or_loss == 0:
        result_status = "break-even"

    return {
        "hotel_id": final_hotel_id,
        "room_revenue": room_revenue,
        "restaurant_revenue": restaurant_revenue,
        "laundry_revenue": laundry_revenue,
        "minibar_revenue": minibar_revenue,
        "extra_revenue": extra_revenue,
        "tax_collected": tax_collected,
        "discount_given": discount_given,
        "total_revenue_received": total_revenue,
        "total_expenses_paid": total_expenses,
        "profit_or_loss": profit_or_loss,
        "result_status": result_status
    }


@router.get("/reports/revenue-summary")
def get_revenue_summary(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_report_hotel_id(hotel_id, current_user, db)

    invoice_query = db.query(models.Invoice)

    if final_hotel_id:
        invoice_query = invoice_query.filter(models.Invoice.hotel_id == final_hotel_id)

    invoices = invoice_query.all()

    total_room_charges = sum(invoice.room_charges for invoice in invoices)
    total_restaurant_charges = sum(invoice.restaurant_charges for invoice in invoices)
    total_laundry_charges = sum(invoice.laundry_charges for invoice in invoices)
    total_minibar_charges = sum(invoice.minibar_charges for invoice in invoices)
    total_extra_charges = sum(invoice.extra_charges for invoice in invoices)
    total_tax_amount = sum(invoice.tax_amount for invoice in invoices)
    total_discount = sum(invoice.discount for invoice in invoices)

    total_invoice_revenue = sum(invoice.grand_total for invoice in invoices)
    total_paid_amount = sum(invoice.paid_amount for invoice in invoices)
    total_due_amount = sum(invoice.due_amount for invoice in invoices)

    return {
        "hotel_id": final_hotel_id,
        "total_room_charges": total_room_charges,
        "total_restaurant_charges": total_restaurant_charges,
        "total_laundry_charges": total_laundry_charges,
        "total_minibar_charges": total_minibar_charges,
        "total_extra_charges": total_extra_charges,
        "total_tax_amount": total_tax_amount,
        "total_discount": total_discount,
        "total_invoice_revenue": total_invoice_revenue,
        "total_paid_amount": total_paid_amount,
        "total_due_amount": total_due_amount,
        "total_invoice_count": len(invoices)
    }


@router.get("/reports/expense-summary")
def get_expense_summary(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_report_hotel_id(hotel_id, current_user, db)

    expense_query = db.query(models.Expense)

    if final_hotel_id:
        expense_query = expense_query.filter(models.Expense.hotel_id == final_hotel_id)

    expenses = expense_query.all()

    total_expenses = sum(expense.amount for expense in expenses)

    paid_expenses = sum(
        expense.amount for expense in expenses
        if expense.payment_status == "paid"
    )

    pending_expenses = sum(
        expense.amount for expense in expenses
        if expense.payment_status == "pending"
    )

    cancelled_expenses = sum(
        expense.amount for expense in expenses
        if expense.payment_status == "cancelled"
    )

    category_summary = {}

    for expense in expenses:
        category = expense.expense_category

        if category not in category_summary:
            category_summary[category] = {
                "total_amount": 0,
                "paid_amount": 0,
                "pending_amount": 0,
                "cancelled_amount": 0,
                "count": 0
            }

        category_summary[category]["total_amount"] += expense.amount
        category_summary[category]["count"] += 1

        if expense.payment_status == "paid":
            category_summary[category]["paid_amount"] += expense.amount

        elif expense.payment_status == "pending":
            category_summary[category]["pending_amount"] += expense.amount

        elif expense.payment_status == "cancelled":
            category_summary[category]["cancelled_amount"] += expense.amount

    return {
        "hotel_id": final_hotel_id,
        "total_expenses": total_expenses,
        "paid_expenses": paid_expenses,
        "pending_expenses": pending_expenses,
        "cancelled_expenses": cancelled_expenses,
        "total_expense_records": len(expenses),
        "category_summary": category_summary
    }

# -----------------------------
# DASHBOARD SUMMARY APIs
# -----------------------------

@router.get("/dashboard/summary")
def get_dashboard_summary(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_dashboard_hotel_id(hotel_id, current_user, db)

    room_query = db.query(models.Room)
    guest_query = db.query(models.Guest)
    booking_query = db.query(models.Booking)
    invoice_query = db.query(models.Invoice)
    expense_query = db.query(models.Expense)
    inventory_query = db.query(models.InventoryItem)
    maintenance_query = db.query(models.MaintenanceRequest)

    if final_hotel_id:
        room_query = room_query.filter(models.Room.hotel_id == final_hotel_id)
        guest_query = guest_query.filter(models.Guest.hotel_id == final_hotel_id)
        booking_query = booking_query.filter(models.Booking.hotel_id == final_hotel_id)
        invoice_query = invoice_query.filter(models.Invoice.hotel_id == final_hotel_id)
        expense_query = expense_query.filter(models.Expense.hotel_id == final_hotel_id)
        inventory_query = inventory_query.filter(models.InventoryItem.hotel_id == final_hotel_id)
        maintenance_query = maintenance_query.filter(models.MaintenanceRequest.hotel_id == final_hotel_id)

    rooms = room_query.all()
    guests = guest_query.all()
    bookings = booking_query.all()
    invoices = invoice_query.all()
    expenses = expense_query.all()
    inventory_items = inventory_query.all()
    maintenance_requests = maintenance_query.all()

    total_rooms = len(rooms)
    available_rooms = len([room for room in rooms if room.status == "available"])
    occupied_rooms = len([room for room in rooms if room.status == "occupied"])
    reserved_rooms = len([room for room in rooms if room.status == "reserved"])
    dirty_rooms = len([room for room in rooms if room.status == "dirty"])
    maintenance_rooms = len([room for room in rooms if room.status == "maintenance"])

    pending_invoices = len([
        invoice for invoice in invoices
        if invoice.payment_status in ["pending", "partial"]
    ])

    total_due_amount = sum(invoice.due_amount for invoice in invoices)
    total_revenue_received = sum(invoice.paid_amount for invoice in invoices)

    total_expenses_paid = sum(
        expense.amount for expense in expenses
        if expense.payment_status == "paid"
    )

    low_stock_items = len([
        item for item in inventory_items
        if item.current_stock <= item.min_stock_level
    ])

    open_maintenance_requests = len([
        request for request in maintenance_requests
        if request.status in ["open", "assigned", "in-progress"]
    ])

    return {
        "hotel_id": final_hotel_id,
        "total_rooms": total_rooms,
        "available_rooms": available_rooms,
        "occupied_rooms": occupied_rooms,
        "reserved_rooms": reserved_rooms,
        "dirty_rooms": dirty_rooms,
        "maintenance_rooms": maintenance_rooms,
        "total_guests": len(guests),
        "total_bookings": len(bookings),
        "pending_invoices": pending_invoices,
        "total_due_amount": total_due_amount,
        "total_revenue_received": total_revenue_received,
        "total_expenses_paid": total_expenses_paid,
        "net_profit_loss": total_revenue_received - total_expenses_paid,
        "low_stock_items": low_stock_items,
        "open_maintenance_requests": open_maintenance_requests
    }


@router.get("/dashboard/room-status-summary")
def get_room_status_summary(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_dashboard_hotel_id(hotel_id, current_user, db)

    room_query = db.query(models.Room)

    if final_hotel_id:
        room_query = room_query.filter(models.Room.hotel_id == final_hotel_id)

    rooms = room_query.all()

    summary = {
        "available": 0,
        "reserved": 0,
        "occupied": 0,
        "dirty": 0,
        "cleaning": 0,
        "maintenance": 0,
        "out-of-service": 0
    }

    for room in rooms:
        if room.status not in summary:
            summary[room.status] = 0

        summary[room.status] += 1

    return {
        "hotel_id": final_hotel_id,
        "total_rooms": len(rooms),
        "room_status_summary": summary
    }


@router.get("/dashboard/today-summary")
def get_today_summary(
    hotel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_dashboard_hotel_id(hotel_id, current_user, db)

    today = datetime.utcnow().date()

    booking_query = db.query(models.Booking)
    invoice_query = db.query(models.Invoice)
    payment_query = db.query(models.Payment)
    expense_query = db.query(models.Expense)

    if final_hotel_id:
        booking_query = booking_query.filter(models.Booking.hotel_id == final_hotel_id)
        invoice_query = invoice_query.filter(models.Invoice.hotel_id == final_hotel_id)
        payment_query = payment_query.filter(models.Payment.hotel_id == final_hotel_id)
        expense_query = expense_query.filter(models.Expense.hotel_id == final_hotel_id)

    bookings = booking_query.all()
    invoices = invoice_query.all()
    payments = payment_query.all()
    expenses = expense_query.all()

    today_checkins = len([
        booking for booking in bookings
        if booking.checkin_date and booking.checkin_date.date() == today
    ])

    today_checkouts = len([
        booking for booking in bookings
        if booking.checkout_date and booking.checkout_date.date() == today
    ])

    today_invoices = [
        invoice for invoice in invoices
        if invoice.created_at and invoice.created_at.date() == today
    ]

    today_payments = [
        payment for payment in payments
        if payment.created_at and payment.created_at.date() == today
    ]

    today_expenses = [
        expense for expense in expenses
        if expense.expense_date and expense.expense_date.date() == today
    ]

    today_invoice_revenue = sum(invoice.grand_total for invoice in today_invoices)
    today_payment_received = sum(payment.amount for payment in today_payments)

    today_expense_amount = sum(
        expense.amount for expense in today_expenses
        if expense.payment_status == "paid"
    )

    return {
        "hotel_id": final_hotel_id,
        "date": str(today),
        "today_checkins": today_checkins,
        "today_checkouts": today_checkouts,
        "today_invoice_count": len(today_invoices),
        "today_invoice_revenue": today_invoice_revenue,
        "today_payment_received": today_payment_received,
        "today_expense_amount": today_expense_amount,
        "today_net_cash": today_payment_received - today_expense_amount
    }


@router.get("/dashboard/recent-activity")
def get_recent_activity(
    hotel_id: Optional[int] = None,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    final_hotel_id = get_dashboard_hotel_id(hotel_id, current_user, db)

    if limit <= 0:
        raise HTTPException(
            status_code=400,
            detail="Limit must be greater than 0"
        )

    if limit > 50:
        raise HTTPException(
            status_code=400,
            detail="Limit cannot be greater than 50"
        )

    activities = []

    booking_query = db.query(models.Booking)
    invoice_query = db.query(models.Invoice)
    payment_query = db.query(models.Payment)
    expense_query = db.query(models.Expense)
    maintenance_query = db.query(models.MaintenanceRequest)

    if final_hotel_id:
        booking_query = booking_query.filter(models.Booking.hotel_id == final_hotel_id)
        invoice_query = invoice_query.filter(models.Invoice.hotel_id == final_hotel_id)
        payment_query = payment_query.filter(models.Payment.hotel_id == final_hotel_id)
        expense_query = expense_query.filter(models.Expense.hotel_id == final_hotel_id)
        maintenance_query = maintenance_query.filter(models.MaintenanceRequest.hotel_id == final_hotel_id)

    recent_bookings = booking_query.order_by(models.Booking.id.desc()).limit(limit).all()
    recent_invoices = invoice_query.order_by(models.Invoice.id.desc()).limit(limit).all()
    recent_payments = payment_query.order_by(models.Payment.id.desc()).limit(limit).all()
    recent_expenses = expense_query.order_by(models.Expense.id.desc()).limit(limit).all()
    recent_maintenance = maintenance_query.order_by(models.MaintenanceRequest.id.desc()).limit(limit).all()

    for booking in recent_bookings:
        activities.append({
            "type": "booking",
            "title": f"Booking #{booking.id}",
            "description": f"Booking status: {booking.status}",
            "amount": booking.total_amount,
            "created_at": booking.created_at
        })

    for invoice in recent_invoices:
        activities.append({
            "type": "invoice",
            "title": invoice.invoice_number,
            "description": f"Invoice payment status: {invoice.payment_status}",
            "amount": invoice.grand_total,
            "created_at": invoice.created_at
        })

    for payment in recent_payments:
        activities.append({
            "type": "payment",
            "title": f"Payment #{payment.id}",
            "description": f"Payment method: {payment.payment_method}",
            "amount": payment.amount,
            "created_at": payment.created_at
        })

    for expense in recent_expenses:
        activities.append({
            "type": "expense",
            "title": expense.expense_title,
            "description": f"Expense category: {expense.expense_category}",
            "amount": expense.amount,
            "created_at": expense.created_at
        })

    for request in recent_maintenance:
        activities.append({
            "type": "maintenance",
            "title": request.issue_title,
            "description": f"Maintenance status: {request.status}",
            "amount": request.actual_cost,
            "created_at": request.created_at
        })

    activities = [
        activity for activity in activities
        if activity["created_at"] is not None
    ]

    activities = sorted(
        activities,
        key=lambda activity: activity["created_at"],
        reverse=True
    )

    return {
        "hotel_id": final_hotel_id,
        "limit": limit,
        "activities": activities[:limit]
    }