# File: backend/app/routers/payroll.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import calendar

from app.database import get_db
from app import models, schemas

router = APIRouter(tags=["Payroll"])

def add_months(sourcedate, months):
    month = sourcedate.month - 1 + months
    year = sourcedate.year + month // 12
    month = month % 12 + 1
    return datetime(year, month, 1)

# ---------------------------------------------------------
# 1. GET ALL SALARY STRUCTURES
# ---------------------------------------------------------
@router.get("/staff-salary-structures")
def get_staff_salaries(db: Session = Depends(get_db)):
    structures = db.query(models.StaffSalaryStructure).all()
    
    result = {}
    for s in structures:
        result[s.staff_id] = {
            "id": s.id,
            "hotel_id": s.hotel_id,
            "staff_id": s.staff_id,
            "basic_salary": s.basic_salary,
            "hra": s.hra,
            "special_allowance": s.special_allowance,
            "other_allowance": s.other_allowance,
            "epf_deduction": s.epf_deduction,
            "esi_deduction": s.esi_deduction,
            "gross_salary": s.gross_salary,
            "net_salary": s.net_salary,
            "fixed_basic": s.basic_salary 
        }
    return result


# ---------------------------------------------------------
# 2. SAVE OR UPDATE SALARY STRUCTURE
# ---------------------------------------------------------
@router.post("/staff-salary-structures")
def save_staff_salary(payload: schemas.StaffSalaryStructureCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.StaffSalaryStructure).filter(
            models.StaffSalaryStructure.staff_id == payload.staff_id
        ).first()
        
        if existing:
            existing.basic_salary = payload.basic_salary
            existing.hra = payload.hra
            existing.special_allowance = payload.special_allowance
            existing.other_allowance = payload.other_allowance
            existing.epf_deduction = payload.epf_deduction
            existing.esi_deduction = payload.esi_deduction
            existing.gross_salary = payload.gross_salary
            existing.net_salary = payload.net_salary
        else:
            payload_data = payload.dict() if hasattr(payload, "dict") else payload.model_dump()
            new_struct = models.StaffSalaryStructure(**payload_data)
            db.add(new_struct)
            
        db.commit()
        return {"message": "Salary structure saved successfully"}
        
    except Exception as e:
        db.rollback()
        print("\n❌ DATABASE ERROR SAVING SALARY:", str(e), "\n")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


# ---------------------------------------------------------
# 3. GET PAYROLL RECORDS FOR A MONTH
# ---------------------------------------------------------
@router.get("/staff-payroll")
def get_payroll_records(month: str, db: Session = Depends(get_db)):
    records = db.query(models.StaffSalary).filter(
        models.StaffSalary.salary_month == month
    ).all()
    
    results = []
    for r in records:
        results.append({
            "id": r.id,
            "hotel_id": r.hotel_id,
            "staff_id": r.staff_id,
            "salary_month": r.salary_month,
            "status": r.status or "Review",
            "basic": r.basic_salary,
            "allowances": r.total_allowances,
            "gross": r.gross_salary,
            "deductions": r.total_deductions,
            "net": r.net_salary,
            "breakdown": r.breakdown or {},
            "adjustments": r.adjustments or [],
            "payment_date": r.payment_date,
            "payment_method": r.payment_method,
            "transaction_id": r.transaction_id,
            "remarks": r.remarks
        })
    return results


# ---------------------------------------------------------
# 4. PROCESS PAYROLL VIA CHRONOLOGICAL SIMULATION
# ---------------------------------------------------------
def calculate_lop_days(staff, target_year, target_month, db: Session):
    start_date_str = staff.leave_tracking_start_date or staff.created_at
    if not start_date_str:
        return 0.0
    
    if isinstance(start_date_str, datetime):
        curr_date = start_date_str.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        try:
            curr_date = datetime.strptime(str(start_date_str).split("T")[0], "%Y-%m-%d").replace(day=1)
        except:
            curr_date = datetime(target_year, target_month, 1)

    target_date_limit = datetime(target_year, target_month, 1)
    
    legacy_balance = float(staff.legacy_leave_balance or 0.0)
    balance = legacy_balance

    all_att = db.query(models.StaffAttendance).filter(models.StaffAttendance.staff_id == staff.id).all()
    all_leaves = db.query(models.StaffLeave).filter(
        models.StaffLeave.staff_id == staff.id,
        models.StaffLeave.status == "approved"
    ).all()

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    target_month_str = f"{target_year}-{target_month:02d}"

    month_absent_count = 0.0

    def is_date_in_range(d_str, start_dt, end_dt):
        if not start_dt or not end_dt:
            return False
        return start_dt.strftime("%Y-%m-%d") <= d_str <= end_dt.strftime("%Y-%m-%d")

    while curr_date <= target_date_limit:
        y = curr_date.year
        m = curr_date.month
        m_str = f"{y}-{m:02d}"

        balance += 4.0 # 4 new offs credited on the 1st of every month

        days_in_month = calendar.monthrange(y, m)[1]

        for d in range(1, days_in_month + 1):
            date_str = f"{m_str}-{d:02d}"
            
            att_record = next((a for a in all_att if a.attendance_date and a.attendance_date.strftime("%Y-%m-%d") == date_str), None)
            matched_leave = next((l for l in all_leaves if is_date_in_range(date_str, l.start_date, l.end_date)), None)

            status = None
            if att_record:
                status = (att_record.status or "").lower()
            elif matched_leave:
                status = "on-leave"

            is_future_or_today = date_str >= today_str

            if status == "present":
                pass
            elif status == "half-day":
                balance = max(0.0, balance - 0.5)
            elif status == "on-leave":
                balance = max(0.0, balance - 1.0)
            elif status == "off-day":
                balance = max(0.0, balance - 1.0)
            elif status == "absent":
                if balance > 0:
                    balance = max(0.0, balance - 1.0) # Uses banked/saved off
                else:
                    if m_str == target_month_str:
                        month_absent_count += 1.0
            else:
                if not is_future_or_today:
                    if balance > 0:
                        balance -= 1.0
                    else:
                        if m_str == target_month_str:
                            month_absent_count += 1.0

        curr_date = add_months(curr_date, 1)

    return month_absent_count


@router.post("/staff-payroll/process")
def process_payroll(payload: schemas.ProcessPayrollRequest, db: Session = Depends(get_db)):
    try:
        year, month_num = map(int, payload.month.split("-"))
        total_days_in_month = calendar.monthrange(year, month_num)[1]

        staff_members = db.query(models.Staff).filter(models.Staff.status == "active").all()
        existing_records = {
            r.staff_id: r for r in db.query(models.StaffSalary).filter(
                models.StaffSalary.salary_month == payload.month
            ).all()
        }

        processed_count = 0

        for staff in staff_members:
            current_record = existing_records.get(staff.id)
            if current_record and current_record.status in ["Finalized", "Paid"]:
                continue

            salary_struct = db.query(models.StaffSalaryStructure).filter(
                models.StaffSalaryStructure.staff_id == staff.id
            ).first()

            if not salary_struct:
                continue

            is_contract = (staff.employee_type or "").lower() == "contract"
            base_gross = salary_struct.basic_salary if is_contract else salary_struct.gross_salary
            per_day_salary = base_gross / total_days_in_month

            # Calculate precise unexcused LOP days using chronological simulation
            excess_leaves = calculate_lop_days(staff, year, month_num, db)
            leave_deduction = round(excess_leaves * per_day_salary)

            adjustments = []
            if excess_leaves > 0:
                adjustments.append({
                    "type": "deduction",
                    "amount": leave_deduction,
                    "reason": f"LOP Deduction: {int(excess_leaves)} unexcused absence(s) (₹{round(per_day_salary)}/day)",
                    "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
                    "by": "Backend System"
                })

            if is_contract:
                basic = salary_struct.basic_salary
                allowances = 0.0
                gross = basic
                deductions = float(leave_deduction)
                net = gross - deductions
                breakdown = {"basic": basic}
            else:
                basic = salary_struct.basic_salary
                allowances = (salary_struct.hra or 0) + (salary_struct.special_allowance or 0) + (salary_struct.other_allowance or 0)
                gross = base_gross
                standard_deductions = (salary_struct.epf_deduction or 0) + (salary_struct.esi_deduction or 0)
                deductions = float(standard_deductions + leave_deduction)
                net = gross - deductions
                breakdown = {
                    "basic": basic,
                    "hra": salary_struct.hra or 0,
                    "special_allowance": salary_struct.special_allowance or 0,
                    "other_allowance": salary_struct.other_allowance or 0,
                    "epf": salary_struct.epf_deduction or 0,
                    "esi": salary_struct.esi_deduction or 0
                }

            if current_record:
                current_record.basic_salary = basic
                current_record.total_allowances = allowances
                current_record.gross_salary = gross
                current_record.total_deductions = deductions
                current_record.net_salary = net
                current_record.breakdown = breakdown
                current_record.adjustments = adjustments
                current_record.status = "Review"
            else:
                new_salary_record = models.StaffSalary(
                    hotel_id=staff.hotel_id,
                    staff_id=staff.id,
                    salary_month=payload.month,
                    status="Review",
                    basic_salary=basic,
                    total_allowances=allowances,
                    gross_salary=gross,
                    total_deductions=deductions,
                    net_salary=net,
                    breakdown=breakdown,
                    adjustments=adjustments
                )
                db.add(new_salary_record)

            processed_count += 1

        db.commit()
        return {"message": f"Successfully processed payroll for {processed_count} employees."}
    except Exception as e:
        db.rollback()
        print("\n❌ ERROR PROCESSING PAYROLL:", str(e), "\n")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------
# 5. UPDATE STATUS
# ---------------------------------------------------------
@router.put("/staff-payroll/{record_id}")
def update_payroll_status(record_id: int, payload: schemas.PayrollStatusUpdate, db: Session = Depends(get_db)):
    try:
        record = db.query(models.StaffSalary).filter(models.StaffSalary.id == record_id).first()
        
        if not record:
            record = db.query(models.StaffSalary).filter(
                models.StaffSalary.staff_id == payload.staff_id,
                models.StaffSalary.salary_month == payload.month
            ).first()

        if not record:
            raise HTTPException(status_code=404, detail="Payroll record not found")

        record.status = payload.status
        if payload.status == "Paid":
            record.payment_date = datetime.utcnow()

        db.commit()
        return {"message": f"Payroll status updated to {payload.status}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------
# 6. ADD MANUAL ADJUSTMENT
# ---------------------------------------------------------
@router.post("/staff-payroll/{record_id}/adjustments")
def add_payroll_adjustment(record_id: int, payload: schemas.AdjustmentRequest, db: Session = Depends(get_db)):
    try:
        record = db.query(models.StaffSalary).filter(models.StaffSalary.id == record_id).first()
        
        if not record:
            record = db.query(models.StaffSalary).filter(
                models.StaffSalary.staff_id == record_id,
                models.StaffSalary.salary_month == payload.month
            ).first()

        if not record:
            raise HTTPException(status_code=404, detail="Payroll record not found")

        new_adjustment = {
            "type": payload.type,
            "amount": payload.amount,
            "reason": payload.reason,
            "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
            "by": "Admin"
        }

        current_adjustments = list(record.adjustments or [])
        current_adjustments.append(new_adjustment)
        record.adjustments = current_adjustments

        if payload.type == "deduction":
            record.total_deductions = float(record.total_deductions or 0) + payload.amount
            record.net_salary = float(record.net_salary) - payload.amount
        else:
            record.total_allowances = float(record.total_allowances or 0) + payload.amount
            record.gross_salary = float(record.gross_salary or 0) + payload.amount
            record.net_salary = float(record.net_salary) + payload.amount

        db.commit()
        return {"message": "Adjustment saved successfully to database"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))