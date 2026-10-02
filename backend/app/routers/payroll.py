from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services.payroll_service import PayrollService

router = APIRouter(tags=["Payroll"])


def get_payroll_service(db: Session = Depends(get_db)) -> PayrollService:
    return PayrollService(db)


# ---------------------------------------------------------
# 1. GET ALL SALARY STRUCTURES
# ---------------------------------------------------------
@router.get("/staff-salary-structures")
def get_staff_salaries(
    service: PayrollService = Depends(get_payroll_service),
) -> Dict[int, Dict[str, Any]]:
    return service.get_staff_salaries()


# ---------------------------------------------------------
# 2. SAVE OR UPDATE SALARY STRUCTURE
# ---------------------------------------------------------
@router.post("/staff-salary-structures")
def save_staff_salary(
    payload: schemas.StaffSalaryStructureCreate,
    service: PayrollService = Depends(get_payroll_service),
) -> Dict[str, str]:
    return service.save_staff_salary(payload)


# ---------------------------------------------------------
# 3. GET PAYROLL RECORDS FOR A MONTH
# ---------------------------------------------------------
@router.get("/staff-payroll")
def get_payroll_records(
    month: str = Query(..., description="Format: YYYY-MM"),
    service: PayrollService = Depends(get_payroll_service),
) -> List[Dict[str, Any]]:
    return service.get_payroll_records(month)


# ---------------------------------------------------------
# 4. PROCESS PAYROLL VIA CHRONOLOGICAL SIMULATION
# ---------------------------------------------------------
@router.post("/staff-payroll/process")
def process_payroll(
    payload: schemas.ProcessPayrollRequest,
    service: PayrollService = Depends(get_payroll_service),
) -> Dict[str, str]:
    return service.process_payroll(payload)


# ---------------------------------------------------------
# 5. UPDATE STATUS
# ---------------------------------------------------------
@router.put("/staff-payroll/{record_id}")
def update_payroll_status(
    record_id: int,
    payload: schemas.PayrollStatusUpdate,
    service: PayrollService = Depends(get_payroll_service),
) -> Dict[str, str]:
    return service.update_payroll_status(record_id, payload)


# ---------------------------------------------------------
# 6. ADD MANUAL ADJUSTMENT
# ---------------------------------------------------------
@router.post("/staff-payroll/{record_id}/adjustments")
def add_payroll_adjustment(
    record_id: int,
    payload: schemas.AdjustmentRequest,
    service: PayrollService = Depends(get_payroll_service),
) -> Dict[str, str]:
    return service.add_payroll_adjustment(record_id, payload)