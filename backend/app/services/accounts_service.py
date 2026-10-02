from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.accounts_repository import AccountsRepository


class AccountsService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AccountsRepository(db)

    # ------------------------------------------------------------------------
    # Authorization Helpers
    # ------------------------------------------------------------------------

    def _assert_can_disburse(self, current_user: models.User) -> None:
        allowed = ["super-admin", "hotel-admin", "manager", "accountant"]
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Only Accountants, Managers, or Admins can disburse salaries."
            )

    def _assert_can_create_advance(self, current_user: models.User) -> None:
        allowed = ["super-admin", "hotel-admin", "manager", "accountant", "hr"]
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Permission denied to record salary advance."
            )

    def _assert_can_modify_advance(self, current_user: models.User, action_detail: str) -> None:
        allowed = ["super-admin", "hotel-admin", "manager", "accountant"]
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=action_detail
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: int, message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # ------------------------------------------------------------------------
    # Business Workflows
    # ------------------------------------------------------------------------

    def get_overview(self, salary_month: Optional[str], current_user: models.User) -> Dict[str, Any]:
        hotel_id = current_user.hotel_id if current_user.role != "super-admin" else None
        active_month = salary_month or datetime.utcnow().strftime("%Y-%m")

        salaries = self.repo.list_salaries_by_month(active_month, hotel_id=hotel_id)
        total_salary_disbursed = sum(s.net_salary for s in salaries if s.payment_status == "paid")
        total_salary_pending = sum(s.net_salary for s in salaries if s.payment_status == "pending")

        advances = self.repo.list_advances_by_month(active_month, hotel_id=hotel_id)
        total_advances_given = sum(a.amount for a in advances if a.status in ["approved", "recovered"])
        total_advances_pending = sum(a.amount for a in advances if a.status == "pending")

        all_expenses = self.repo.list_expenses(hotel_id=hotel_id)
        expenses = [
            e for e in all_expenses
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

    def disburse_salary(
        self,
        salary_id: int,
        payment_method: str,
        transaction_id: Optional[str],
        remarks: Optional[str],
        current_user: models.User
    ) -> models.StaffSalary:
        self._assert_can_disburse(current_user)

        salary = self.repo.get_salary_by_id(salary_id)
        if not salary:
            raise HTTPException(status_code=404, detail="Salary record not found.")

        self._assert_owns_hotel(
            current_user,
            salary.hotel_id,
            "You can only disburse salaries for your own hotel."
        )

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
        advances = self.repo.get_linked_approved_advances(
            hotel_id=salary.hotel_id,
            staff_id=salary.staff_id,
            deduct_month=salary.salary_month
        )
        for adv in advances:
            adv.status = "recovered"

        self.repo.commit()
        self.repo.refresh(salary)
        return salary

    def create_salary_advance(
        self,
        advance: schemas.SalaryAdvanceCreate,
        current_user: models.User
    ) -> models.SalaryAdvance:
        self._assert_can_create_advance(current_user)
        self._assert_owns_hotel(
            current_user,
            advance.hotel_id,
            "You can create advances only for your own hotel."
        )

        staff = self.repo.get_staff_by_id(advance.staff_id, advance.hotel_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found for this hotel.")

        if advance.amount <= 0:
            raise HTTPException(status_code=400, detail="Advance amount must be greater than zero.")

        advance_data = {
            "hotel_id": advance.hotel_id,
            "staff_id": advance.staff_id,
            "amount": advance.amount,
            "advance_date": advance.advance_date or datetime.utcnow(),
            "deduct_month": advance.deduct_month,
            "status": advance.status,
            "payment_method": advance.payment_method,
            "approved_by": advance.approved_by or (current_user.full_name or current_user.username),
            "reason": advance.reason,
            "remarks": advance.remarks,
        }

        return self.repo.create_advance(advance_data)

    def get_salary_advances(
        self,
        hotel_id: Optional[int],
        staff_id: Optional[int],
        deduct_month: Optional[str],
        status: Optional[str],
        current_user: models.User
    ) -> List[models.SalaryAdvance]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_advances(
            hotel_id=target_hotel_id,
            staff_id=staff_id,
            deduct_month=deduct_month,
            status=status
        )

    def update_salary_advance(
        self,
        advance_id: int,
        advance_update: schemas.SalaryAdvanceUpdate,
        current_user: models.User
    ) -> models.SalaryAdvance:
        self._assert_can_modify_advance(current_user, "Permission denied to update salary advance.")

        advance = self.repo.get_advance_by_id(advance_id)
        if not advance:
            raise HTTPException(status_code=404, detail="Salary advance record not found.")

        self._assert_owns_hotel(
            current_user,
            advance.hotel_id,
            "Unauthorized access to this record."
        )

        update_data = advance_update.model_dump(exclude_unset=True)

        # Stamp approver if status changed to approved and not yet recorded
        if update_data.get("status") == "approved" and not advance.approved_by:
            update_data["approved_by"] = current_user.full_name or current_user.username

        return self.repo.update_advance(advance, update_data)

    def delete_salary_advance(self, advance_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_modify_advance(current_user, "Permission denied.")

        advance = self.repo.get_advance_by_id(advance_id)
        if not advance:
            raise HTTPException(status_code=404, detail="Record not found.")

        self._assert_owns_hotel(
            current_user,
            advance.hotel_id,
            "Unauthorized access."
        )

        self.repo.delete_advance(advance)
        return {"message": "Salary advance record deleted successfully."}