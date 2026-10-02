from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.repositories.report_repository import ReportRepository


class ReportService:
    FINANCE_REPORT_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "accountant",
        "front-desk",
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
        "hr",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = ReportRepository(db)

    # -------------------------------------------------------------
    # Role & Hotel ID Resolution
    # -------------------------------------------------------------

    def _has_report_permission(self, current_user: models.User) -> bool:
        if not current_user:
            return False
        if current_user.role in self.FINANCE_REPORT_ROLES:
            return True
        allowed = getattr(current_user, "allowed_modules", None) or []
        if isinstance(allowed, list):
            return any(m in allowed for m in ["reports", "finance", "accounts"])
        return False

    def _has_dashboard_permission(self, current_user: models.User) -> bool:
        if not current_user:
            return False
        if current_user.role in self.DASHBOARD_ROLES:
            return True
        allowed = getattr(current_user, "allowed_modules", None) or []
        if isinstance(allowed, list):
            return any(m in allowed for m in ["dashboard", "reports"])
        return False

    def _resolve_report_hotel_id(
        self, requested_hotel_id: Optional[int], current_user: models.User
    ) -> Optional[int]:
        if not self._has_report_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="You are not allowed to access finance reports",
            )

        if current_user.role == "super-admin":
            if requested_hotel_id:
                hotel = self.repo.get_hotel_by_id(requested_hotel_id)
                if not hotel:
                    raise HTTPException(status_code=404, detail="Hotel not found")
            return requested_hotel_id

        if not current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="User is not assigned to any hotel",
            )

        if requested_hotel_id and requested_hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can only access reports for your own hotel",
            )

        return current_user.hotel_id

    def _resolve_dashboard_hotel_id(
        self, requested_hotel_id: Optional[int], current_user: models.User
    ) -> Optional[int]:
        if not self._has_dashboard_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="You are not allowed to access dashboard",
            )

        if current_user.role == "super-admin":
            if requested_hotel_id:
                hotel = self.repo.get_hotel_by_id(requested_hotel_id)
                if not hotel:
                    raise HTTPException(status_code=404, detail="Hotel not found")
            return requested_hotel_id

        if not current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="User is not assigned to any hotel",
            )

        if requested_hotel_id and requested_hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can only access dashboard for your own hotel",
            )

        return current_user.hotel_id

    # -------------------------------------------------------------
    # Finance Reports
    # -------------------------------------------------------------

    def get_finance_summary(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_report_hotel_id(hotel_id, current_user)

        invoices = self.repo.get_invoices(final_hotel_id)
        payments = self.repo.get_payments(final_hotel_id)
        expenses = self.repo.get_expenses(final_hotel_id)

        total_invoice_revenue = sum(float(invoice.grand_total or 0.0) for invoice in invoices)
        total_paid_amount = sum(float(invoice.paid_amount or 0.0) for invoice in invoices)
        total_due_amount = sum(float(invoice.due_amount or 0.0) for invoice in invoices)
        total_refund_amount = sum(float(getattr(invoice, "refund_amount", 0.0) or 0.0) for invoice in invoices)
        total_payments_received = sum(float(payment.amount or 0.0) for payment in payments if payment.payment_type != "refund")
        total_refunds_disbursed = sum(float(payment.amount or 0.0) for payment in payments if payment.payment_type == "refund")

        total_expenses = sum(
            float(expense.amount or 0.0) for expense in expenses if expense.payment_status == "paid"
        )
        net_profit_loss = (total_paid_amount - total_refund_amount) - total_expenses

        return {
            "hotel_id": final_hotel_id,
            "total_invoice_revenue": round(total_invoice_revenue, 2),
            "total_paid_amount": round(total_paid_amount, 2),
            "total_due_amount": round(total_due_amount, 2),
            "total_refund_amount": round(total_refund_amount, 2),
            "total_payments_received": round(total_payments_received, 2),
            "total_refunds_disbursed": round(total_refunds_disbursed, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit_loss": round(net_profit_loss, 2),
            "total_invoices": len(invoices),
            "total_payments": len(payments),
            "total_expense_records": len(expenses),
        }

    def get_profit_loss_report(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_report_hotel_id(hotel_id, current_user)

        invoices = self.repo.get_invoices(final_hotel_id)
        expenses = self.repo.get_expenses(final_hotel_id)

        room_revenue = sum(float(invoice.room_charges or 0.0) for invoice in invoices)
        restaurant_revenue = sum(float(invoice.restaurant_charges or 0.0) for invoice in invoices)
        laundry_revenue = sum(float(invoice.laundry_charges or 0.0) for invoice in invoices)
        minibar_revenue = sum(float(invoice.minibar_charges or 0.0) for invoice in invoices)
        extra_revenue = sum(float(invoice.extra_charges or 0.0) for invoice in invoices)
        tax_collected = sum(float(invoice.tax_amount or 0.0) for invoice in invoices)
        discount_given = sum(float(invoice.discount or 0.0) for invoice in invoices)

        total_revenue = sum(float(invoice.paid_amount or 0.0) for invoice in invoices)
        total_refunds = sum(float(getattr(invoice, "refund_amount", 0.0) or 0.0) for invoice in invoices)
        net_revenue = total_revenue - total_refunds

        total_expenses = sum(
            float(expense.amount or 0.0) for expense in expenses if expense.payment_status == "paid"
        )

        profit_or_loss = round(net_revenue - total_expenses, 2)
        if profit_or_loss < 0:
            result_status = "loss"
        elif profit_or_loss == 0:
            result_status = "break-even"
        else:
            result_status = "profit"

        return {
            "hotel_id": final_hotel_id,
            "room_revenue": round(room_revenue, 2),
            "restaurant_revenue": round(restaurant_revenue, 2),
            "laundry_revenue": round(laundry_revenue, 2),
            "minibar_revenue": round(minibar_revenue, 2),
            "extra_revenue": round(extra_revenue, 2),
            "tax_collected": round(tax_collected, 2),
            "discount_given": round(discount_given, 2),
            "total_revenue_received": round(total_revenue, 2),
            "total_refunds_deducted": round(total_refunds, 2),
            "net_revenue": round(net_revenue, 2),
            "total_expenses_paid": round(total_expenses, 2),
            "profit_or_loss": profit_or_loss,
            "result_status": result_status,
        }

    def get_revenue_summary(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_report_hotel_id(hotel_id, current_user)
        invoices = self.repo.get_invoices(final_hotel_id)

        total_room_charges = sum(float(invoice.room_charges or 0.0) for invoice in invoices)
        total_restaurant_charges = sum(float(invoice.restaurant_charges or 0.0) for invoice in invoices)
        total_laundry_charges = sum(float(invoice.laundry_charges or 0.0) for invoice in invoices)
        total_minibar_charges = sum(float(invoice.minibar_charges or 0.0) for invoice in invoices)
        total_extra_charges = sum(float(invoice.extra_charges or 0.0) for invoice in invoices)
        total_tax_amount = sum(float(invoice.tax_amount or 0.0) for invoice in invoices)
        total_discount = sum(float(invoice.discount or 0.0) for invoice in invoices)

        total_invoice_revenue = sum(float(invoice.grand_total or 0.0) for invoice in invoices)
        total_paid_amount = sum(float(invoice.paid_amount or 0.0) for invoice in invoices)
        total_due_amount = sum(float(invoice.due_amount or 0.0) for invoice in invoices)
        total_refund_amount = sum(float(getattr(invoice, "refund_amount", 0.0) or 0.0) for invoice in invoices)

        return {
            "hotel_id": final_hotel_id,
            "total_room_charges": round(total_room_charges, 2),
            "total_restaurant_charges": round(total_restaurant_charges, 2),
            "total_laundry_charges": round(total_laundry_charges, 2),
            "total_minibar_charges": round(total_minibar_charges, 2),
            "total_extra_charges": round(total_extra_charges, 2),
            "total_tax_amount": round(total_tax_amount, 2),
            "total_discount": round(total_discount, 2),
            "total_invoice_revenue": round(total_invoice_revenue, 2),
            "total_paid_amount": round(total_paid_amount, 2),
            "total_due_amount": round(total_due_amount, 2),
            "total_refund_amount": round(total_refund_amount, 2),
            "total_invoice_count": len(invoices),
        }

    def get_expense_summary(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_report_hotel_id(hotel_id, current_user)
        expenses = self.repo.get_expenses(final_hotel_id)

        total_expenses = sum(float(expense.amount or 0.0) for expense in expenses)
        paid_expenses = sum(
            float(expense.amount or 0.0) for expense in expenses if expense.payment_status == "paid"
        )
        pending_expenses = sum(
            float(expense.amount or 0.0) for expense in expenses if expense.payment_status == "pending"
        )
        cancelled_expenses = sum(
            float(expense.amount or 0.0) for expense in expenses if expense.payment_status == "cancelled"
        )

        category_summary: Dict[str, Dict[str, Any]] = {}
        for expense in expenses:
            category = expense.expense_category or "Uncategorized"
            if category not in category_summary:
                category_summary[category] = {
                    "total_amount": 0.0,
                    "paid_amount": 0.0,
                    "pending_amount": 0.0,
                    "cancelled_amount": 0.0,
                    "count": 0,
                }

            amt = float(expense.amount or 0.0)
            category_summary[category]["total_amount"] += amt
            category_summary[category]["count"] += 1

            if expense.payment_status == "paid":
                category_summary[category]["paid_amount"] += amt
            elif expense.payment_status == "pending":
                category_summary[category]["pending_amount"] += amt
            elif expense.payment_status == "cancelled":
                category_summary[category]["cancelled_amount"] += amt

        return {
            "hotel_id": final_hotel_id,
            "total_expenses": round(total_expenses, 2),
            "paid_expenses": round(paid_expenses, 2),
            "pending_expenses": round(pending_expenses, 2),
            "cancelled_expenses": round(cancelled_expenses, 2),
            "total_expense_records": len(expenses),
            "category_summary": category_summary,
        }

    # -------------------------------------------------------------
    # Phase 7: Cashier Shift Reconciliation & Daily Closing Reports
    # -------------------------------------------------------------

    def get_cashier_shift_summary(
        self,
        hotel_id: Optional[int],
        target_date: Optional[date],
        cashier_username: Optional[str],
        current_user: models.User,
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_report_hotel_id(hotel_id, current_user)
        report_day = target_date or datetime.utcnow().date()
        start_dt = datetime.combine(report_day, time.min)
        end_dt = datetime.combine(report_day, time.max)

        payments = self.repo.get_payments_by_date_range(
            hotel_id=final_hotel_id,
            start_datetime=start_dt,
            end_datetime=end_dt,
            cashier_username=cashier_username,
        )

        method_breakdown: Dict[str, float] = {
            "cash": 0.0,
            "upi": 0.0,
            "card": 0.0,
            "bank_transfer": 0.0,
            "cheque": 0.0,
            "online": 0.0,
            "other": 0.0,
        }

        cashier_breakdown: Dict[str, Dict[str, Any]] = {}
        total_advance_collected = 0.0
        total_settlement_collected = 0.0
        total_refund_disbursed = 0.0

        for p in payments:
            method = (p.payment_method or "other").strip().lower()
            if method not in method_breakdown:
                method = "other"

            cashier = p.received_by or "System"
            if cashier not in cashier_breakdown:
                cashier_breakdown[cashier] = {
                    "total_collected": 0.0,
                    "total_refunded": 0.0,
                    "net_cash": 0.0,
                    "transaction_count": 0,
                    "methods": {m: 0.0 for m in method_breakdown},
                }

            amt = round(float(p.amount or 0.0), 2)

            if p.payment_type == "refund":
                total_refund_disbursed += amt
                method_breakdown[method] -= amt
                cashier_breakdown[cashier]["total_refunded"] += amt
                cashier_breakdown[cashier]["methods"][method] -= amt
            elif p.payment_type == "advance":
                total_advance_collected += amt
                method_breakdown[method] += amt
                cashier_breakdown[cashier]["total_collected"] += amt
                cashier_breakdown[cashier]["methods"][method] += amt
            else:  # settlement
                total_settlement_collected += amt
                method_breakdown[method] += amt
                cashier_breakdown[cashier]["total_collected"] += amt
                cashier_breakdown[cashier]["methods"][method] += amt

            cashier_breakdown[cashier]["transaction_count"] += 1
            cashier_breakdown[cashier]["net_cash"] = round(
                cashier_breakdown[cashier]["methods"]["cash"], 2
            )

        net_collected = round((total_advance_collected + total_settlement_collected) - total_refund_disbursed, 2)

        return {
            "hotel_id": final_hotel_id,
            "date": str(report_day),
            "cashier_filter": cashier_username,
            "total_transactions": len(payments),
            "total_advance_collected": round(total_advance_collected, 2),
            "total_settlement_collected": round(total_settlement_collected, 2),
            "total_refund_disbursed": round(total_refund_disbursed, 2),
            "net_collected": net_collected,
            "method_breakdown": {k: round(v, 2) for k, v in method_breakdown.items()},
            "cashier_breakdown": cashier_breakdown,
        }

    def get_daily_closing_report(
        self,
        hotel_id: Optional[int],
        report_date: Optional[date],
        current_user: models.User,
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_report_hotel_id(hotel_id, current_user)
        day = report_date or datetime.utcnow().date()
        start_dt = datetime.combine(day, time.min)
        end_dt = datetime.combine(day, time.max)

        invoices = self.repo.get_invoices_by_date_range(final_hotel_id, start_dt, end_dt)
        payments = self.repo.get_payments_by_date_range(final_hotel_id, start_dt, end_dt)
        expenses = self.repo.get_expenses_by_date_range(final_hotel_id, start_dt, end_dt)

        gross_billed = sum(float(inv.grand_total or 0.0) for inv in invoices)
        taxable_value = sum(float(getattr(inv, "taxable_value", 0.0) or (inv.grand_total - (inv.tax_amount or 0.0))) for inv in invoices)
        cgst = sum(float(getattr(inv, "cgst", 0.0) or ((inv.tax_amount or 0.0) / 2.0)) for inv in invoices)
        sgst = sum(float(getattr(inv, "sgst", 0.0) or ((inv.tax_amount or 0.0) / 2.0)) for inv in invoices)
        igst = sum(float(getattr(inv, "igst", 0.0) or 0.0) for inv in invoices)

        collections = {
            "cash": 0.0,
            "upi": 0.0,
            "card": 0.0,
            "bank_transfer": 0.0,
            "cheque": 0.0,
            "online": 0.0,
            "other": 0.0,
        }

        total_inflow = 0.0
        total_refunds = 0.0

        for p in payments:
            method = (p.payment_method or "other").strip().lower()
            if method not in collections:
                method = "other"
            amt = round(float(p.amount or 0.0), 2)

            if p.payment_type == "refund":
                total_refunds += amt
                collections[method] -= amt
            else:
                total_inflow += amt
                collections[method] += amt

        paid_expenses = sum(float(e.amount or 0.0) for e in expenses if e.payment_status == "paid")
        cash_drawer_net = collections["cash"]

        return {
            "hotel_id": final_hotel_id,
            "date": str(day),
            "generated_at": datetime.utcnow(),
            "invoices_issued_count": len(invoices),
            "gross_billed": round(gross_billed, 2),
            "tax_breakdown": {
                "taxable_value": round(taxable_value, 2),
                "cgst": round(cgst, 2),
                "sgst": round(sgst, 2),
                "igst": round(igst, 2),
                "total_tax": round(cgst + sgst + igst, 2),
            },
            "collections_summary": {
                "gross_inflow": round(total_inflow, 2),
                "refunds_outflow": round(total_refunds, 2),
                "net_collections": round(total_inflow - total_refunds, 2),
                "method_totals": {k: round(v, 2) for k, v in collections.items()},
            },
            "cash_drawer": {
                "net_cash_collected": round(cash_drawer_net, 2),
                "cash_expenses_paid": round(
                    sum(float(e.amount or 0.0) for e in expenses if e.payment_status == "paid" and (e.payment_method or "").lower() == "cash"), 2
                ),
            },
            "operational_expenses_paid": round(paid_expenses, 2),
            "net_daily_position": round((total_inflow - total_refunds) - paid_expenses, 2),
        }

    def get_payment_audit_trail(
        self,
        hotel_id: Optional[int],
        start_date: Optional[datetime],
        end_date: Optional[datetime],
        payment_type: Optional[str],
        payment_method: Optional[str],
        limit: int,
        current_user: models.User,
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_report_hotel_id(hotel_id, current_user)
        start_dt = start_date or datetime.combine(datetime.utcnow().date(), time.min)
        end_dt = end_date or datetime.utcnow()

        payments = self.repo.get_payments_by_date_range(
            hotel_id=final_hotel_id,
            start_datetime=start_dt,
            end_datetime=end_dt,
            payment_type=payment_type,
            payment_method=payment_method,
            limit=limit,
        )

        audit_entries = []
        for p in payments:
            audit_entries.append({
                "payment_id": p.id,
                "created_at": p.created_at,
                "payment_type": p.payment_type or "settlement",
                "receipt_number": p.receipt_number,
                "amount": round(float(p.amount or 0.0), 2),
                "payment_method": p.payment_method,
                "transaction_id": p.transaction_id,
                "payment_status": p.payment_status,
                "received_by": p.received_by,
                "booking_id": p.booking_id,
                "invoice_id": p.invoice_id,
                "remarks": p.remarks,
            })

        return {
            "hotel_id": final_hotel_id,
            "record_count": len(audit_entries),
            "limit": limit,
            "audit_trail": audit_entries,
        }

    # -------------------------------------------------------------
    # Dashboards
    # -------------------------------------------------------------

    def get_dashboard_summary(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_dashboard_hotel_id(hotel_id, current_user)
        data = self.repo.get_dashboard_collections(final_hotel_id)

        rooms = data["rooms"]
        guests = data["guests"]
        bookings = data["bookings"]
        invoices = data["invoices"]
        expenses = data["expenses"]
        inventory_items = data["inventory_items"]
        maintenance_requests = data["maintenance_requests"]

        total_rooms = len(rooms)
        available_rooms = len([r for r in rooms if r.status == "available"])
        occupied_rooms = len([r for r in rooms if r.status == "occupied"])
        reserved_rooms = len([r for r in rooms if r.status == "reserved"])
        dirty_rooms = len([r for r in rooms if r.status == "dirty"])
        maintenance_rooms = len([r for r in rooms if r.status == "maintenance"])

        pending_invoices = len(
            [inv for inv in invoices if inv.payment_status in ["pending", "partial", "partially_paid", "unpaid"]]
        )
        total_due_amount = sum(float(inv.due_amount or 0.0) for inv in invoices)
        total_revenue_received = sum(float(inv.paid_amount or 0.0) for inv in invoices)
        total_refund_amount = sum(float(getattr(inv, "refund_amount", 0.0) or 0.0) for inv in invoices)

        total_expenses_paid = sum(
            float(exp.amount or 0.0) for exp in expenses if exp.payment_status == "paid"
        )

        low_stock_items = len(
            [item for item in inventory_items if item.current_stock <= item.min_stock_level]
        )
        open_maintenance_requests = len(
            [req for req in maintenance_requests if req.status in ["open", "assigned", "in-progress"]]
        )

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
            "total_due_amount": round(total_due_amount, 2),
            "total_revenue_received": round(total_revenue_received, 2),
            "total_refund_amount": round(total_refund_amount, 2),
            "total_expenses_paid": round(total_expenses_paid, 2),
            "net_profit_loss": round((total_revenue_received - total_refund_amount) - total_expenses_paid, 2),
            "low_stock_items": low_stock_items,
            "open_maintenance_requests": open_maintenance_requests,
        }

    def get_room_status_summary(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_dashboard_hotel_id(hotel_id, current_user)
        rooms = self.repo.get_rooms(final_hotel_id)

        summary = {
            "available": 0,
            "reserved": 0,
            "occupied": 0,
            "dirty": 0,
            "cleaning": 0,
            "maintenance": 0,
            "out-of-service": 0,
        }

        for room in rooms:
            if room.status not in summary:
                summary[room.status] = 0
            summary[room.status] += 1

        return {
            "hotel_id": final_hotel_id,
            "total_rooms": len(rooms),
            "room_status_summary": summary,
        }

    def get_today_summary(
        self, hotel_id: Optional[int], current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_dashboard_hotel_id(hotel_id, current_user)
        today = datetime.utcnow().date()

        records = self.repo.get_today_records(final_hotel_id)
        bookings = records["bookings"]
        invoices = records["invoices"]
        payments = records["payments"]
        expenses = records["expenses"]

        today_checkins = len(
            [b for b in bookings if b.checkin_date and b.checkin_date.date() == today]
        )
        today_checkouts = len(
            [b for b in bookings if b.checkout_date and b.checkout_date.date() == today]
        )

        today_invoices = [
            inv for inv in invoices if inv.created_at and inv.created_at.date() == today
        ]
        today_payments = [
            p for p in payments if p.created_at and p.created_at.date() == today
        ]
        today_expenses = [
            exp for exp in expenses if exp.expense_date and exp.expense_date.date() == today
        ]

        today_invoice_revenue = sum(float(inv.grand_total or 0.0) for inv in today_invoices)
        today_inflow = sum(float(p.amount or 0.0) for p in today_payments if p.payment_type != "refund")
        today_refunds = sum(float(p.amount or 0.0) for p in today_payments if p.payment_type == "refund")
        today_payment_received = today_inflow - today_refunds

        today_expense_amount = sum(
            float(exp.amount or 0.0) for exp in today_expenses if exp.payment_status == "paid"
        )

        return {
            "hotel_id": final_hotel_id,
            "date": str(today),
            "today_checkins": today_checkins,
            "today_checkouts": today_checkouts,
            "today_invoice_count": len(today_invoices),
            "today_invoice_revenue": round(today_invoice_revenue, 2),
            "today_payment_received": round(today_payment_received, 2),
            "today_expense_amount": round(today_expense_amount, 2),
            "today_net_cash": round(today_payment_received - today_expense_amount, 2),
        }

    def get_recent_activity(
        self, hotel_id: Optional[int], limit: int, current_user: models.User
    ) -> Dict[str, Any]:
        final_hotel_id = self._resolve_dashboard_hotel_id(hotel_id, current_user)

        if limit <= 0:
            raise HTTPException(status_code=400, detail="Limit must be greater than 0")
        if limit > 50:
            raise HTTPException(status_code=400, detail="Limit cannot be greater than 50")

        entities = self.repo.get_recent_entities(final_hotel_id, limit)
        activities: List[Dict[str, Any]] = []

        for b in entities["bookings"]:
            activities.append({
                "type": "booking",
                "title": f"Booking #{b.id}",
                "description": f"Booking status: {b.status}",
                "amount": b.total_amount,
                "created_at": b.created_at,
            })

        for inv in entities["invoices"]:
            activities.append({
                "type": "invoice",
                "title": inv.invoice_number,
                "description": f"Invoice payment status: {inv.payment_status}",
                "amount": inv.grand_total,
                "created_at": inv.created_at,
            })

        for p in entities["payments"]:
            type_label = f"[{p.payment_type.upper()}] " if p.payment_type else ""
            activities.append({
                "type": "payment",
                "title": f"{type_label}Payment #{p.id}",
                "description": f"Method: {p.payment_method} | Collector: {p.received_by or 'System'}",
                "amount": p.amount,
                "created_at": p.created_at,
            })

        for exp in entities["expenses"]:
            activities.append({
                "type": "expense",
                "title": exp.expense_title,
                "description": f"Expense category: {exp.expense_category}",
                "amount": exp.amount,
                "created_at": exp.created_at,
            })

        for req in entities["maintenance"]:
            activities.append({
                "type": "maintenance",
                "title": req.issue_title,
                "description": f"Maintenance status: {req.status}",
                "amount": req.actual_cost,
                "created_at": req.created_at,
            })

        valid_activities = [a for a in activities if a["created_at"] is not None]
        valid_activities.sort(key=lambda a: a["created_at"], reverse=True)

        return {
            "hotel_id": final_hotel_id,
            "limit": limit,
            "activities": valid_activities[:limit],
        }