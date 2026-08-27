from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/accounts",
    tags=["Accounts & Financials"]
)


# ============================================================================
# 1. ACCOUNTS OVERVIEW & METRICS
# ============================================================================

@router.get("/overview")
def get_accounts_overview(
    salary_month: Optional[str] = Query(None, description="Format: YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Financial dashboard metrics: Total Paid Salaries, Pending Payouts,
    Total Advances Given, and Operational Expenses.
    """
    hotel_id = current_user.hotel_id

    # Filter by month if provided, else current month
    active_month = salary_month or datetime.utcnow().strftime("%Y-%m")

    # Salary queries
    salary_query = db.query(models.StaffSalary).filter(
        models.StaffSalary.salary_month == active_month
    )
    if current_user.role != "super-admin":
        salary_query = salary_query.filter(models.StaffSalary.hotel_id == hotel_id)

    salaries = salary_query.all()

    total_salary_disbursed = sum(s.net_salary for s in salaries if s.payment_status == "paid")
    total_salary_pending = sum(s.net_salary for s in salaries if s.payment_status == "pending")

    # Advances queries
    advance_query = db.query(models.SalaryAdvance).filter(
        models.SalaryAdvance.deduct_month == active_month
    )
    if current_user.role != "super-admin":
        advance_query = advance_query.filter(models.SalaryAdvance.hotel_id == hotel_id)

    advances = advance_query.all()

    total_advances_given = sum(a.amount for a in advances if a.status in ["approved", "recovered"])
    total_advances_pending = sum(a.amount for a in advances if a.status == "pending")

    # General Expenses for the month
    expense_query = db.query(models.Expense)
    if current_user.role != "super-admin":
        expense_query = expense_query.filter(models.Expense.hotel_id == hotel_id)

    # Filter expenses starting with active_month
    expenses = [
        e for e in expense_query.all()
        if e.expense_date and e.expense_date.strftime("%Y-%m") == active_month
    ]
    total_expenses = sum(e.amount for e in expenses if e.payment_status == "paid")

    return {
        "month": active_month,
        "salary_metrics": {
            "total_disbursed": round(total_salary_disbursed, 2),
            "total_pending": round(total_salary_pending, 2),
            "total_payroll_count": len(salaries),
            "paid_count": len([s for s in salaries if s.payment_status == "paid"]),
            "pending_count": len([s for s in salaries if s.payment_status == "pending"]),
        },
        "advance_metrics": {
            "total_advances_approved": round(total_advances_given, 2),
            "total_advances_pending": round(total_advances_pending, 2),
            "pending_requests_count": len([a for a in advances if a.status == "pending"])
        },
        "total_operational_outflow": round(total_salary_disbursed + total_expenses, 2)
    }


# ============================================================================
# 2. SALARY DISBURSEMENT & PAYOUT WORKFLOW
# ============================================================================

@router.put("/disburse-salary/{salary_id}", response_model=schemas.StaffSalaryResponse)
def disburse_salary(
    salary_id: int,
    payment_method: str = Query(..., description="cash / bank_transfer / upi / cheque"),
    transaction_id: Optional[str] = Query(None),
    remarks: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Marks a calculated salary record as PAID, stamps the disbursement time, 
    and locks in payment method and transaction ID.
    """
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant"]:
        raise HTTPException(
            status_code=403,
            detail="Only Accountants, Managers, or Admins can disburse salaries."
        )

    salary = db.query(models.StaffSalary).filter(models.StaffSalary.id == salary_id).first()

    if not salary:
        raise HTTPException(status_code=404, detail="Salary record not found.")

    if current_user.role != "super-admin" and salary.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can only disburse salaries for your own hotel.")

    if salary.payment_status == "paid":
        raise HTTPException(status_code=400, detail="This salary record has already been marked as paid.")

    salary.payment_status = "paid"
    salary.payment_date = datetime.utcnow()
    salary.payment_method = payment_method
    salary.transaction_id = transaction_id
    salary.disbursed_by = current_user.full_name or current_user.username
    if remarks:
        salary.remarks = remarks

    # Automatically mark any linked salary advances for this staff & month as 'recovered'
    advances = db.query(models.SalaryAdvance).filter(
        models.SalaryAdvance.hotel_id == salary.hotel_id,
        models.SalaryAdvance.staff_id == salary.staff_id,
        models.SalaryAdvance.deduct_month == salary.salary_month,
        models.SalaryAdvance.status == "approved"
    ).all()

    for adv in advances:
        adv.status = "recovered"

    db.commit()
    db.refresh(salary)

    return salary


# ============================================================================
# 3. SALARY ADVANCE MANAGEMENT
# ============================================================================

@router.post("/advances", response_model=schemas.SalaryAdvanceResponse)
def create_salary_advance(
    advance: schemas.SalaryAdvanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Creates a new Salary Advance request or entry for an employee.
    """
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant", "hr"]:
        raise HTTPException(status_code=403, detail="Permission denied to record salary advance.")

    if current_user.role != "super-admin" and advance.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="You can create advances only for your own hotel.")

    staff = db.query(models.Staff).filter(
        models.Staff.id == advance.staff_id,
        models.Staff.hotel_id == advance.hotel_id
    ).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found for this hotel.")

    if advance.amount <= 0:
        raise HTTPException(status_code=400, detail="Advance amount must be greater than zero.")

    new_advance = models.SalaryAdvance(
        hotel_id=advance.hotel_id,
        staff_id=advance.staff_id,
        amount=advance.amount,
        advance_date=advance.advance_date or datetime.utcnow(),
        deduct_month=advance.deduct_month,
        status=advance.status,
        payment_method=advance.payment_method,
        approved_by=advance.approved_by or (current_user.full_name or current_user.username),
        reason=advance.reason,
        remarks=advance.remarks
    )

    db.add(new_advance)
    db.commit()
    db.refresh(new_advance)

    return new_advance


@router.get("/advances", response_model=list[schemas.SalaryAdvanceResponse])
def get_salary_advances(
    hotel_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    deduct_month: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retrieves all salary advances with optional filtering by staff, month, or status.
    """
    query = db.query(models.SalaryAdvance)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.SalaryAdvance.hotel_id == hotel_id)
    else:
        query = query.filter(models.SalaryAdvance.hotel_id == current_user.hotel_id)

    if staff_id:
        query = query.filter(models.SalaryAdvance.staff_id == staff_id)

    if deduct_month:
        query = query.filter(models.SalaryAdvance.deduct_month == deduct_month)

    if status:
        query = query.filter(models.SalaryAdvance.status == status)

    records = query.order_by(models.SalaryAdvance.id.desc()).all()
    return records


@router.put("/advances/{advance_id}", response_model=schemas.SalaryAdvanceResponse)
def update_salary_advance(
    advance_id: int,
    advance_update: schemas.SalaryAdvanceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Updates advance status (Approve, Reject, Recover) or details.
    """
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant"]:
        raise HTTPException(status_code=403, detail="Permission denied to update salary advance.")

    advance = db.query(models.SalaryAdvance).filter(models.SalaryAdvance.id == advance_id).first()

    if not advance:
        raise HTTPException(status_code=404, detail="Salary advance record not found.")

    if current_user.role != "super-admin" and advance.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this record.")

    update_data = advance_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(advance, key, value)

    # Stamp approver if status changed to approved
    if update_data.get("status") == "approved" and not advance.approved_by:
        advance.approved_by = current_user.full_name or current_user.username

    db.commit()
    db.refresh(advance)

    return advance


@router.delete("/advances/{advance_id}")
def delete_salary_advance(
    advance_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Deletes a salary advance record.
    """
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "accountant"]:
        raise HTTPException(status_code=403, detail="Permission denied.")

    advance = db.query(models.SalaryAdvance).filter(models.SalaryAdvance.id == advance_id).first()

    if not advance:
        raise HTTPException(status_code=404, detail="Record not found.")

    if current_user.role != "super-admin" and advance.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    db.delete(advance)
    db.commit()

    return {"message": "Salary advance record deleted successfully."}