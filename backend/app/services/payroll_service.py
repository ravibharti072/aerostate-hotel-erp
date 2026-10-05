import calendar
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.payroll_repository import PayrollRepository


def add_months(sourcedate: datetime, months: int) -> datetime:
    month = sourcedate.month - 1 + months
    year = sourcedate.year + month // 12
    month = month % 12 + 1
    return datetime(year, month, 1)


class PayrollService:
    # Payroll is sensitive: read access is for hotel admins/managers/accountants,
    # write access (processing runs, changing status, adjusting pay) is narrower.
    READ_ROLES = ["super-admin", "hotel-admin", "manager", "accountant"]
    WRITE_ROLES = ["super-admin", "hotel-admin", "manager", "accountant"]
    PROCESS_ROLES = ["super-admin", "hotel-admin", "accountant"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = PayrollRepository(db)

    # -------------------------------------------------------------
    # Authorization & Tenant Guards
    # -------------------------------------------------------------

    def _resolve_target_hotel_id(self, current_user: models.User) -> Optional[int]:
        """
        Returns the hotel_id the caller is allowed to operate on.
        None means "all hotels" and is only ever returned for a super-admin.
        """
        return None if current_user.role == "super-admin" else current_user.hotel_id

    def _assert_can_read(self, current_user: models.User) -> None:
        if current_user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only hotel-admin, manager, accountant or super-admin can view payroll",
            )

    def _assert_can_manage(self, current_user: models.User, action_label: str) -> None:
        if current_user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=403,
                detail=f"Only hotel-admin, manager, accountant or super-admin can {action_label}",
            )

    def _assert_can_process(self, current_user: models.User) -> None:
        if current_user.role not in self.PROCESS_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only hotel-admin, accountant or super-admin can process payroll",
            )

    # -------------------------------------------------------------
    # 1. Get All Salary Structures
    # -------------------------------------------------------------

    def get_staff_salaries(self, current_user: models.User) -> Dict[int, Dict[str, Any]]:
        self._assert_can_read(current_user)
        target_hotel_id = self._resolve_target_hotel_id(current_user)
        structures = self.repo.list_salary_structures(target_hotel_id)
        result: Dict[int, Dict[str, Any]] = {}

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
                "fixed_basic": s.basic_salary,
            }
        return result

    # -------------------------------------------------------------
    # 2. Save or Update Salary Structure
    # -------------------------------------------------------------

    def save_staff_salary(
        self,
        payload: schemas.StaffSalaryStructureCreate,
        current_user: models.User,
    ) -> Dict[str, str]:
        self._assert_can_manage(current_user, "save salary structures")

        staff = self.db.query(models.Staff).filter(models.Staff.id == payload.staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")

        # Never trust a client-supplied hotel_id: derive it from the staff record
        # and confirm the caller owns that hotel.
        if (
            current_user.role != "super-admin"
            and staff.hotel_id != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only set salary structures for staff in your own hotel",
            )

        try:
            existing = self.repo.get_salary_structure_by_staff_id(payload.staff_id)
            payload_data = payload.dict() if hasattr(payload, "dict") else payload.model_dump()
            payload_data["hotel_id"] = staff.hotel_id
            self.repo.save_salary_structure(existing, payload_data)
            return {"message": "Salary structure saved successfully"}
        except HTTPException:
            self.repo.rollback()
            raise
        except Exception as e:
            self.repo.rollback()
            print("\n DATABASE ERROR SAVING SALARY:", str(e), "\n")
            raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

    # -------------------------------------------------------------
    # 3. Get Payroll Records for a Month
    # -------------------------------------------------------------

    def get_payroll_records(
        self, month: str, current_user: models.User
    ) -> List[Dict[str, Any]]:
        self._assert_can_read(current_user)
        target_hotel_id = self._resolve_target_hotel_id(current_user)
        records = self.repo.list_payroll_by_month(month, target_hotel_id)
        results: List[Dict[str, Any]] = []

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
                "remarks": r.remarks,
            })
        return results

    # -------------------------------------------------------------
    # 4. LOP & Chronological Payroll Simulation Engine
    # -------------------------------------------------------------

    def calculate_lop_days(self, staff: models.Staff, target_year: int, target_month: int) -> float:
        start_date_str = staff.leave_tracking_start_date or staff.created_at
        if not start_date_str:
            return 0.0

        if isinstance(start_date_str, datetime):
            curr_date = start_date_str.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            try:
                curr_date = datetime.strptime(str(start_date_str).split("T")[0], "%Y-%m-%d").replace(day=1)
            except Exception:
                curr_date = datetime(target_year, target_month, 1)

        target_date_limit = datetime(target_year, target_month, 1)
        balance = float(staff.legacy_leave_balance or 0.0)

        all_att = self.repo.list_staff_attendance(staff.id)
        all_leaves = self.repo.list_staff_approved_leaves(staff.id)

        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        target_month_str = f"{target_year}-{target_month:02d}"
        month_absent_count = 0.0

        def is_date_in_range(d_str: str, start_dt: Optional[datetime], end_dt: Optional[datetime]) -> bool:
            if not start_dt or not end_dt:
                return False
            return start_dt.strftime("%Y-%m-%d") <= d_str <= end_dt.strftime("%Y-%m-%d")

        while curr_date <= target_date_limit:
            y = curr_date.year
            m = curr_date.month
            m_str = f"{y}-{m:02d}"

            balance += 4.0  # 4 new offs credited on the 1st of every month
            days_in_month = calendar.monthrange(y, m)[1]

            for d in range(1, days_in_month + 1):
                date_str = f"{m_str}-{d:02d}"

                att_record = next(
                    (a for a in all_att if a.attendance_date and a.attendance_date.strftime("%Y-%m-%d") == date_str),
                    None,
                )
                matched_leave = next(
                    (l for l in all_leaves if is_date_in_range(date_str, l.start_date, l.end_date)),
                    None,
                )

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
                        balance = max(0.0, balance - 1.0)
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

    def process_payroll(
        self, payload: schemas.ProcessPayrollRequest, current_user: models.User
    ) -> Dict[str, str]:
        self._assert_can_process(current_user)
        target_hotel_id = self._resolve_target_hotel_id(current_user)
        if target_hotel_id is None:
            raise HTTPException(
                status_code=400,
                detail="A super-admin must select a hotel before processing payroll.",
            )
        try:
            year, month_num = map(int, payload.month.split("-"))
            total_days_in_month = calendar.monthrange(year, month_num)[1]

            staff_members = self.repo.list_active_staff(target_hotel_id)
            existing_records = {
                r.staff_id: r
                for r in self.repo.list_payroll_by_month(payload.month, target_hotel_id)
            }

            updates: List[tuple[models.StaffSalary, Dict[str, Any]]] = []
            new_records: List[Dict[str, Any]] = []
            processed_count = 0

            for staff in staff_members:
                current_record = existing_records.get(staff.id)
                if current_record and current_record.status in ["Finalized", "Paid"]:
                    continue

                salary_struct = self.repo.get_salary_structure_by_staff_id(
                    staff.id, target_hotel_id
                )
                if not salary_struct:
                    continue

                is_contract = (staff.employee_type or "").lower() == "contract"
                base_gross = salary_struct.basic_salary if is_contract else salary_struct.gross_salary
                per_day_salary = base_gross / total_days_in_month

                excess_leaves = self.calculate_lop_days(staff, year, month_num)
                leave_deduction = round(excess_leaves * per_day_salary)

                adjustments: List[Dict[str, Any]] = []
                if excess_leaves > 0:
                    adjustments.append({
                        "type": "deduction",
                        "amount": leave_deduction,
                        "reason": f"LOP Deduction: {int(excess_leaves)} unexcused absence(s) (₹{round(per_day_salary)}/day)",
                        "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
                        "by": "Backend System",
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
                    allowances = (
                        (salary_struct.hra or 0)
                        + (salary_struct.special_allowance or 0)
                        + (salary_struct.other_allowance or 0)
                    )
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
                        "esi": salary_struct.esi_deduction or 0,
                    }

                record_fields = {
                    "basic_salary": basic,
                    "total_allowances": allowances,
                    "gross_salary": gross,
                    "total_deductions": deductions,
                    "net_salary": net,
                    "breakdown": breakdown,
                    "adjustments": adjustments,
                    "status": "Review",
                }

                if current_record:
                    updates.append((current_record, record_fields))
                else:
                    record_fields.update({
                        "hotel_id": staff.hotel_id,
                        "staff_id": staff.id,
                        "salary_month": payload.month,
                    })
                    new_records.append(record_fields)

                processed_count += 1

            self.repo.save_bulk_payroll(updates, new_records)
            return {"message": f"Successfully processed payroll for {processed_count} employees."}

        except HTTPException:
            self.repo.rollback()
            raise
        except Exception as e:
            self.repo.rollback()
            print("\n ERROR PROCESSING PAYROLL:", str(e), "\n")
            raise HTTPException(status_code=500, detail=str(e))

    # -------------------------------------------------------------
    # 5. Update Status
    # -------------------------------------------------------------

    def update_payroll_status(
        self,
        record_id: int,
        payload: schemas.PayrollStatusUpdate,
        current_user: models.User,
    ) -> Dict[str, str]:
        self._assert_can_manage(current_user, "update payroll status")
        target_hotel_id = self._resolve_target_hotel_id(current_user)
        try:
            record = self.repo.get_payroll_record_by_id(record_id, target_hotel_id)
            if not record:
                record = self.repo.get_payroll_record_by_staff_and_month(
                    payload.staff_id, payload.month, target_hotel_id
                )

            if not record:
                raise HTTPException(status_code=404, detail="Payroll record not found")

            updates: Dict[str, Any] = {"status": payload.status}
            if payload.status == "Paid":
                updates["payment_date"] = datetime.utcnow()
                staff = self.db.query(models.Staff).filter(models.Staff.id == record.staff_id).first()
                staff_name = staff.full_name if staff else f"Staff #{record.staff_id}"
                expense_title = f"Salary Payment - {staff_name} ({record.salary_month})"

                existing_expense = (
                    self.db.query(models.Expense)
                    .filter(
                        models.Expense.staff_id == record.staff_id,
                        models.Expense.expense_title == expense_title,
                    )
                    .first()
                )
                if not existing_expense:
                    # record.hotel_id is authoritative; never fall back to hotel 1.
                    hotel_id = record.hotel_id or (staff.hotel_id if staff else None)
                    if not hotel_id:
                        raise HTTPException(
                            status_code=400,
                            detail="Cannot record a salary expense: the payroll record has no hotel.",
                        )
                    expense = models.Expense(
                        hotel_id=hotel_id,
                        staff_id=record.staff_id,
                        expense_title=expense_title,
                        expense_category="Salaries",
                        amount=float(record.net_salary or 0.0),
                        payment_method="bank_transfer",
                        payment_status="paid",
                    )
                    self.db.add(expense)

            self.repo.update_payroll_record(record, updates)
            return {"message": f"Payroll status updated to {payload.status}"}

        except HTTPException:
            self.repo.rollback()
            raise
        except Exception as e:
            self.repo.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # -------------------------------------------------------------
    # 6. Add Manual Adjustment
    # -------------------------------------------------------------

    def add_payroll_adjustment(
        self,
        record_id: int,
        payload: schemas.AdjustmentRequest,
        current_user: models.User,
    ) -> Dict[str, str]:
        self._assert_can_manage(current_user, "add payroll adjustments")
        target_hotel_id = self._resolve_target_hotel_id(current_user)
        try:
            record = self.repo.get_payroll_record_by_id(record_id, target_hotel_id)
            if not record:
                record = self.repo.get_payroll_record_by_staff_and_month(
                    record_id, payload.month, target_hotel_id
                )

            if not record:
                raise HTTPException(status_code=404, detail="Payroll record not found")

            new_adjustment = {
                "type": payload.type,
                "amount": payload.amount,
                "reason": payload.reason,
                "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
                "by": "Admin",
            }

            current_adjustments = list(record.adjustments or [])
            current_adjustments.append(new_adjustment)

            updates: Dict[str, Any] = {"adjustments": current_adjustments}

            if payload.type == "deduction":
                updates["total_deductions"] = float(record.total_deductions or 0) + payload.amount
                updates["net_salary"] = float(record.net_salary) - payload.amount
            else:
                updates["total_allowances"] = float(record.total_allowances or 0) + payload.amount
                updates["gross_salary"] = float(record.gross_salary or 0) + payload.amount
                updates["net_salary"] = float(record.net_salary) + payload.amount

            self.repo.update_payroll_record(record, updates)
            return {"message": "Adjustment saved successfully to database"}

        except HTTPException:
            self.repo.rollback()
            raise
        except Exception as e:
            self.repo.rollback()
            raise HTTPException(status_code=500, detail=str(e))