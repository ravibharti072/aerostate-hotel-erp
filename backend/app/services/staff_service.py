from datetime import datetime, timedelta, date
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.staff_repository import StaffRepository


class StaffService:
    ALLOWED_STAFF_MANAGERS = ["super-admin", "hotel-admin", "manager", "hr"]
    ALLOWED_SALARY_MANAGERS = ["super-admin", "hotel-admin", "manager", "hr", "accountant"]

    ALLOWED_ATTENDANCE_STATUSES = ["present", "absent", "half-day", "on-leave", "off-day"]
    ALLOWED_SALARY_PAYMENT_STATUSES = ["pending", "paid", "cancelled"]
    ALLOWED_LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"]

    def __init__(self, db: Session):
        self.db = db
        self.repo = StaffRepository(db)

    # -------------------------------------------------------------
    # Scope & Role Assertions
    # -------------------------------------------------------------

    def _has_staff_module(self, current_user: models.User) -> bool:
        if not current_user:
            return False
        if current_user.role in self.ALLOWED_STAFF_MANAGERS:
            return True
        allowed = getattr(current_user, "allowed_modules", None) or []
        if isinstance(allowed, list):
            return any(m in allowed for m in ["staff", "hr", "attendance", "payroll"])
        return False

    def _has_salary_module(self, current_user: models.User) -> bool:
        if not current_user:
            return False
        if current_user.role in self.ALLOWED_SALARY_MANAGERS:
            return True
        allowed = getattr(current_user, "allowed_modules", None) or []
        if isinstance(allowed, list):
            return any(m in allowed for m in ["staff", "hr", "payroll", "accountant", "accounts"])
        return False

    def _assert_can_manage_staff(self, current_user: models.User, action_label: str) -> None:
        if not self._has_staff_module(current_user):
            raise HTTPException(
                status_code=403,
                detail=f"Only HR, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_can_manage_salary(self, current_user: models.User, action_label: str) -> None:
        if not self._has_salary_module(current_user):
            raise HTTPException(
                status_code=403,
                detail=f"Only HR, accountant, hotel-admin, manager, or super-admin can {action_label}",
            )

    def _assert_owns_hotel(self, current_user: models.User, target_hotel_id: Optional[int], message: str) -> None:
        if current_user.role != "super-admin" and target_hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=403, detail=message)

    # -------------------------------------------------------------
    # 1. Staff Entity Workflows
    # -------------------------------------------------------------

    def create_staff(
        self, staff: schemas.StaffCreate, current_user: models.User
    ) -> models.Staff:
        self._assert_can_manage_staff(current_user, "create staff")
        target_hotel_id = staff.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            first_hotel = self.db.query(models.Hotel).filter(models.Hotel.status == "active").first() or self.db.query(models.Hotel).first()
            if first_hotel:
                target_hotel_id = first_hotel.id

        self._assert_owns_hotel(
            current_user, target_hotel_id, "You can create staff only for your own hotel"
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        existing_staff = self.repo.get_staff_by_phone(target_hotel_id, staff.phone)
        if existing_staff:
            raise HTTPException(
                status_code=400,
                detail="Staff with this phone number already exists in this hotel",
            )

        role_level = staff.role_level or "employee"
        if role_level == "department_head":
            existing_head = self.db.query(models.Staff).filter(
                models.Staff.hotel_id == target_hotel_id,
                models.Staff.department == staff.department,
                models.Staff.role_level == "department_head",
                models.Staff.status == "active",
            ).first()
            if existing_head and not staff.force_department_head:
                raise HTTPException(
                    status_code=409,
                    detail=f"An active Department Head ({existing_head.full_name}) already exists for the {staff.department} department. Please confirm replacement.",
                )

        staff_dict = staff.model_dump(exclude={
            "create_portal_access", "portal_username", "portal_password", "portal_role", "force_department_head"
        })
        staff_dict["hotel_id"] = target_hotel_id
        staff_dict["role_level"] = role_level
        new_staff = self.repo.create_staff(staff_dict)

        # If portal access requested:
        if staff.create_portal_access and staff.portal_username and staff.portal_password:
            if current_user.role not in ["super-admin", "hotel-admin"]:
                raise HTTPException(
                    status_code=403,
                    detail="Only hotel-admin or super-admin can create user login accounts",
                )
            from app.services.user_service import UserService
            user_service = UserService(self.db)

            dept_lower = (staff.department or "").lower()
            default_mods = ["front-desk", "rooms"]
            default_role = "staff"
            if "housekeep" in dept_lower or "clean" in dept_lower:
                default_mods = ["housekeeping", "rooms"]
                default_role = "housekeeping"
            elif "maint" in dept_lower or "engin" in dept_lower or "garden" in dept_lower:
                default_mods = ["maintenance"]
                default_role = "maintenance"
            elif "rest" in dept_lower or "banquet" in dept_lower or "food" in dept_lower or "kitchen" in dept_lower:
                default_mods = ["restaurant"]
                default_role = "restaurant"
            elif "account" in dept_lower or "finance" in dept_lower:
                default_mods = ["accounts"]
                default_role = "accountant"
            elif "inventory" in dept_lower or "store" in dept_lower or "purchase" in dept_lower:
                default_mods = ["inventory"]
                default_role = "inventory"
            elif "front" in dept_lower:
                default_mods = ["front-desk", "rooms"]
                default_role = "front-desk"
            elif "manage" in dept_lower:
                default_mods = ["front-desk", "rooms", "housekeeping", "restaurant", "inventory", "maintenance", "accounts", "reports"]
                default_role = "manager"

            portal_payload = schemas.EmployeePortalAccessCreate(
                staff_id=new_staff.id,
                username=staff.portal_username.strip(),
                password=staff.portal_password.strip(),
                role=staff.portal_role if staff.portal_role and staff.portal_role != "staff" else default_role,
                role_level=role_level,
                allowed_modules=default_mods,
                email=new_staff.email,
                phone=new_staff.phone,
                must_change_password=True,
            )
            user_service.create_employee_portal_access(portal_payload, current_user)

        return new_staff

    def get_staff_members(
        self,
        hotel_id: Optional[int],
        department: Optional[str],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.Staff]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_staff(
            hotel_id=target_hotel_id, department=department, status=status
        )

    def check_department_head(
        self, department: str, hotel_id: Optional[int], current_user: models.User, exclude_staff_id: Optional[int] = None
    ) -> Dict[str, Any]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" and hotel_id else current_user.hotel_id
        query = self.db.query(models.Staff).filter(
            models.Staff.hotel_id == target_hotel_id,
            models.Staff.department == department,
            models.Staff.role_level == "department_head",
            models.Staff.status == "active",
        )
        if exclude_staff_id:
            query = query.filter(models.Staff.id != exclude_staff_id)
        head = query.first()
        if head:
            return {"has_head": True, "head_id": head.id, "head_name": head.full_name}
        return {"has_head": False, "head_id": None, "head_name": None}

    def get_staff(self, staff_id: int, current_user: models.User) -> models.Staff:
        staff = self.repo.get_staff_by_id(staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

        self._assert_owns_hotel(
            current_user, staff.hotel_id, "You can view only staff from your own hotel"
        )
        return staff

    def update_staff(
        self, staff_id: int, staff_update: schemas.StaffUpdate, current_user: models.User
    ) -> models.Staff:
        self._assert_can_manage_staff(current_user, "update staff")

        staff = self.repo.get_staff_by_id(staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

        self._assert_owns_hotel(
            current_user, staff.hotel_id, "You can update only staff from your own hotel"
        )

        update_data = staff_update.model_dump(exclude_unset=True)
        force_head = update_data.pop("force_department_head", False)

        target_dept = update_data.get("department", staff.department)
        target_role_level = update_data.get("role_level", staff.role_level)

        if target_role_level == "department_head":
            existing_head = self.db.query(models.Staff).filter(
                models.Staff.hotel_id == staff.hotel_id,
                models.Staff.department == target_dept,
                models.Staff.role_level == "department_head",
                models.Staff.id != staff.id,
                models.Staff.status == "active",
            ).first()
            if existing_head and not force_head:
                raise HTTPException(
                    status_code=409,
                    detail=f"An active Department Head ({existing_head.full_name}) already exists for the {target_dept} department. Please confirm replacement.",
                )

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move staff to another hotel",
            )

        if "phone" in update_data:
            duplicate_staff = self.repo.get_duplicate_staff_phone(
                hotel_id=staff.hotel_id,
                phone=update_data["phone"],
                exclude_staff_id=staff_id,
            )
            if duplicate_staff:
                raise HTTPException(
                    status_code=400,
                    detail="Another staff with this phone number already exists in this hotel",
                )

        if "email" in update_data and not update_data["email"]:
            update_data["email"] = None

        updated_staff = self.repo.update_staff(staff, update_data)

        # Sync linked user account's role_level if applicable
        if staff.user and "role_level" in update_data:
            staff.user.role_level = update_data["role_level"]
            self.db.commit()

        return updated_staff

    def delete_staff(self, staff_id: int, current_user: models.User) -> Dict[str, str]:
        self._assert_can_manage_staff(current_user, "delete staff")

        staff = self.repo.get_staff_by_id(staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

        self._assert_owns_hotel(
            current_user, staff.hotel_id, "You can delete only staff from your own hotel"
        )

        self.repo.delete_staff(staff)
        return {"message": "Staff deleted successfully"}

    # -------------------------------------------------------------
    # 2. Staff Attendance Workflows
    # -------------------------------------------------------------

    def create_staff_attendance(
        self, attendance: schemas.StaffAttendanceCreate, current_user: models.User
    ) -> models.StaffAttendance:
        self._assert_can_manage_staff(current_user, "mark staff attendance")
        target_hotel_id = attendance.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            staff_record = self.repo.get_staff_by_id(attendance.staff_id)
            if staff_record:
                target_hotel_id = staff_record.hotel_id
            else:
                first_hotel = self.db.query(models.Hotel).first()
                target_hotel_id = first_hotel.id if first_hotel else 1

        self._assert_owns_hotel(
            current_user,
            target_hotel_id,
            "You can mark attendance only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        staff = self.repo.get_staff_for_hotel(attendance.staff_id, target_hotel_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        if attendance.status not in self.ALLOWED_ATTENDANCE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_ATTENDANCE_STATUSES}",
            )

        existing_attendance = self.repo.get_attendance_by_date(
            target_hotel_id, attendance.staff_id, attendance.attendance_date
        )
        if existing_attendance:
            raise HTTPException(
                status_code=400,
                detail="Attendance already marked for this staff on this date",
            )

        att_data = attendance.model_dump()
        att_data["hotel_id"] = target_hotel_id
        return self.repo.create_attendance(att_data)

    def get_staff_attendance_records(
        self,
        hotel_id: Optional[int],
        staff_id: Optional[int],
        status: Optional[str],
        current_user: models.User,
    ) -> List[models.StaffAttendance]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_attendance(
            hotel_id=target_hotel_id, staff_id=staff_id, status=status
        )

    def get_staff_attendance(
        self, attendance_id: int, current_user: models.User
    ) -> models.StaffAttendance:
        attendance = self.repo.get_attendance_by_id(attendance_id)
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")

        self._assert_owns_hotel(
            current_user,
            attendance.hotel_id,
            "You can view only attendance records from your own hotel",
        )
        return attendance

    def update_staff_attendance(
        self,
        attendance_id: int,
        attendance_update: schemas.StaffAttendanceUpdate,
        current_user: models.User,
    ) -> models.StaffAttendance:
        self._assert_can_manage_staff(current_user, "update staff attendance")

        attendance = self.repo.get_attendance_by_id(attendance_id)
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")

        self._assert_owns_hotel(
            current_user,
            attendance.hotel_id,
            "You can update only attendance records from your own hotel",
        )

        update_data = attendance_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move attendance record to another hotel",
            )

        if "status" in update_data and update_data["status"] not in self.ALLOWED_ATTENDANCE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed statuses are: {self.ALLOWED_ATTENDANCE_STATUSES}",
            )

        check_hotel_id = update_data.get("hotel_id", attendance.hotel_id)
        check_staff_id = update_data.get("staff_id", attendance.staff_id)
        check_attendance_date = update_data.get("attendance_date", attendance.attendance_date)

        staff = self.repo.get_staff_for_hotel(check_staff_id, check_hotel_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        duplicate_attendance = self.repo.get_duplicate_attendance_record(
            check_hotel_id, check_staff_id, check_attendance_date, attendance_id
        )
        if duplicate_attendance:
            raise HTTPException(
                status_code=400,
                detail="Attendance already marked for this staff on this date",
            )

        return self.repo.update_attendance(attendance, update_data)

    def delete_staff_attendance(
        self, attendance_id: int, current_user: models.User
    ) -> Dict[str, str]:
        self._assert_can_manage_staff(current_user, "delete staff attendance")

        attendance = self.repo.get_attendance_by_id(attendance_id)
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")

        self._assert_owns_hotel(
            current_user,
            attendance.hotel_id,
            "You can delete only attendance records from your own hotel",
        )

        self.repo.delete_attendance(attendance)
        return {"message": "Attendance record deleted successfully"}

    # -------------------------------------------------------------
    # 3. Staff Salary / Payroll Workflows
    # -------------------------------------------------------------

    def create_staff_salary(
        self, salary: schemas.StaffSalaryCreate, current_user: models.User
    ) -> models.StaffSalary:
        self._assert_can_manage_salary(current_user, "create salary records")
        target_hotel_id = salary.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            staff_record = self.repo.get_staff_by_id(salary.staff_id)
            if staff_record:
                target_hotel_id = staff_record.hotel_id
            else:
                first_hotel = self.db.query(models.Hotel).first()
                target_hotel_id = first_hotel.id if first_hotel else 1

        self._assert_owns_hotel(
            current_user,
            target_hotel_id,
            "You can create salary records only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        staff = self.repo.get_staff_for_hotel(salary.staff_id, target_hotel_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        if salary.payment_status not in self.ALLOWED_SALARY_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_SALARY_PAYMENT_STATUSES}",
            )

        existing_salary = self.repo.get_salary_by_month(
            target_hotel_id, salary.staff_id, salary.salary_month
        )
        if existing_salary:
            raise HTTPException(
                status_code=400,
                detail="Salary already created for this staff and month",
            )

        net_salary = salary.basic_salary + salary.allowances - salary.deductions
        if net_salary < 0:
            raise HTTPException(status_code=400, detail="Net salary cannot be negative")

        salary_data = {
            "hotel_id": target_hotel_id,
            "staff_id": salary.staff_id,
            "salary_month": salary.salary_month,
            "basic_salary": salary.basic_salary,
            "allowances": salary.allowances,
            "deductions": salary.deductions,
            "net_salary": net_salary,
            "payment_status": salary.payment_status,
            "payment_date": salary.payment_date,
            "payment_method": salary.payment_method,
            "remarks": salary.remarks,
        }

        created = self.repo.create_salary(salary_data)
        if created.payment_status == "paid":
            expense_title = f"Salary Payment - {staff.full_name} ({created.salary_month})"
            expense = models.Expense(
                hotel_id=created.hotel_id,
                staff_id=created.staff_id,
                expense_title=expense_title,
                expense_category="Salaries",
                amount=float(created.net_salary or 0.0),
                payment_method=created.payment_method or "bank_transfer",
                payment_status="paid",
            )
            self.db.add(expense)
            self.db.commit()

        return created

    def get_staff_salaries(
        self,
        hotel_id: Optional[int],
        staff_id: Optional[int],
        salary_month: Optional[str],
        payment_status: Optional[str],
        current_user: models.User,
    ) -> List[models.StaffSalary]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_salaries(
            hotel_id=target_hotel_id,
            staff_id=staff_id,
            salary_month=salary_month,
            payment_status=payment_status,
        )

    def get_staff_salary(
        self, salary_id: int, current_user: models.User
    ) -> models.StaffSalary:
        salary = self.repo.get_salary_by_id(salary_id)
        if not salary:
            raise HTTPException(status_code=404, detail="Salary record not found")

        self._assert_owns_hotel(
            current_user,
            salary.hotel_id,
            "You can view only salary records from your own hotel",
        )
        return salary

    def update_staff_salary(
        self,
        salary_id: int,
        salary_update: schemas.StaffSalaryUpdate,
        current_user: models.User,
    ) -> models.StaffSalary:
        self._assert_can_manage_salary(current_user, "update salary records")

        salary = self.repo.get_salary_by_id(salary_id)
        if not salary:
            raise HTTPException(status_code=404, detail="Salary record not found")

        self._assert_owns_hotel(
            current_user,
            salary.hotel_id,
            "You can update only salary records from your own hotel",
        )

        update_data = salary_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move salary record to another hotel",
            )

        if (
            "payment_status" in update_data
            and update_data["payment_status"] not in self.ALLOWED_SALARY_PAYMENT_STATUSES
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment status. Allowed statuses are: {self.ALLOWED_SALARY_PAYMENT_STATUSES}",
            )

        check_hotel_id = update_data.get("hotel_id", salary.hotel_id)
        check_staff_id = update_data.get("staff_id", salary.staff_id)
        check_salary_month = update_data.get("salary_month", salary.salary_month)

        staff = self.repo.get_staff_for_hotel(check_staff_id, check_hotel_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        duplicate_salary = self.repo.get_duplicate_salary_record(
            check_hotel_id, check_staff_id, check_salary_month, salary_id
        )
        if duplicate_salary:
            raise HTTPException(
                status_code=400,
                detail="Salary already created for this staff and month",
            )

        target_basic = update_data.get("basic_salary", salary.basic_salary)
        target_allowances = update_data.get("allowances", salary.allowances)
        target_deductions = update_data.get("deductions", salary.deductions)
        calculated_net = target_basic + target_allowances - target_deductions

        if calculated_net < 0:
            raise HTTPException(status_code=400, detail="Net salary cannot be negative")

        update_data["net_salary"] = calculated_net
        updated = self.repo.update_salary(salary, update_data)

        if updated.payment_status == "paid":
            if not updated.payment_date:
                updated.payment_date = datetime.utcnow()
                self.db.commit()
            staff = self.repo.get_staff_by_id(updated.staff_id)
            staff_name = staff.full_name if staff else f"Staff #{updated.staff_id}"
            expense_title = f"Salary Payment - {staff_name} ({updated.salary_month})"
            existing_expense = (
                self.db.query(models.Expense)
                .filter(
                    models.Expense.staff_id == updated.staff_id,
                    models.Expense.expense_title == expense_title,
                )
                .first()
            )
            if not existing_expense:
                expense = models.Expense(
                    hotel_id=updated.hotel_id,
                    staff_id=updated.staff_id,
                    expense_title=expense_title,
                    expense_category="Salaries",
                    amount=float(updated.net_salary or 0.0),
                    payment_method=updated.payment_method or "bank_transfer",
                    payment_status="paid",
                )
                self.db.add(expense)
                self.db.commit()

        return updated

    def delete_staff_salary(
        self, salary_id: int, current_user: models.User
    ) -> Dict[str, str]:
        self._assert_can_manage_salary(current_user, "delete salary records")

        salary = self.repo.get_salary_by_id(salary_id)
        if not salary:
            raise HTTPException(status_code=404, detail="Salary record not found")

        self._assert_owns_hotel(
            current_user,
            salary.hotel_id,
            "You can delete only salary records from your own hotel",
        )

        self.repo.delete_salary(salary)
        return {"message": "Salary record deleted successfully"}

    # -------------------------------------------------------------
    # 4. Staff Leave Workflows
    # -------------------------------------------------------------

    def _sync_leave_to_attendance(self, leave: models.StaffLeave) -> None:
        try:
            start_dt = leave.start_date.date() if isinstance(leave.start_date, datetime) else leave.start_date
            end_dt = leave.end_date.date() if isinstance(leave.end_date, datetime) else leave.end_date
            curr = start_dt
            while curr <= end_dt:
                curr_midnight = datetime(curr.year, curr.month, curr.day, 0, 0, 0)
                existing = self.repo.get_attendance_by_date(
                    leave.hotel_id, leave.staff_id, curr_midnight
                )
                if existing:
                    if existing.status != "on-leave":
                        self.repo.update_attendance(existing, {
                            "status": "on-leave",
                            "remarks": f"Approved leave: {leave.leave_type}"
                        })
                else:
                    self.repo.create_attendance({
                        "hotel_id": leave.hotel_id,
                        "staff_id": leave.staff_id,
                        "attendance_date": curr_midnight,
                        "status": "on-leave",
                        "remarks": f"Approved leave: {leave.leave_type}",
                        "check_in_time": None,
                        "check_out_time": None
                    })
                curr += timedelta(days=1)
        except Exception as e:
            print("Error syncing leave to attendance:", e)

    def create_staff_leave(
        self, leave: schemas.StaffLeaveCreate, current_user: models.User
    ) -> models.StaffLeave:
        self._assert_can_manage_staff(current_user, "create staff leave")
        target_hotel_id = leave.hotel_id or current_user.hotel_id
        if not target_hotel_id:
            staff_record = self.repo.get_staff_by_id(leave.staff_id)
            if staff_record:
                target_hotel_id = staff_record.hotel_id
            else:
                first_hotel = self.db.query(models.Hotel).first()
                target_hotel_id = first_hotel.id if first_hotel else 1

        self._assert_owns_hotel(
            current_user,
            target_hotel_id,
            "You can create staff leave only for your own hotel",
        )

        hotel = self.repo.get_hotel_by_id(target_hotel_id)
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        staff = self.repo.get_staff_for_hotel(leave.staff_id, target_hotel_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        if leave.status not in self.ALLOWED_LEAVE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid leave status. Allowed statuses are: {self.ALLOWED_LEAVE_STATUSES}",
            )

        if leave.end_date < leave.start_date:
            raise HTTPException(status_code=400, detail="End date cannot be before start date")

        if leave.total_days <= 0:
            raise HTTPException(status_code=400, detail="Total days must be greater than 0")

        leave_data = leave.model_dump()
        leave_data["hotel_id"] = target_hotel_id
        created = self.repo.create_leave(leave_data)

        if created.status == "approved":
            self._sync_leave_to_attendance(created)

        return created

    def get_staff_leaves(
        self,
        hotel_id: Optional[int],
        staff_id: Optional[int],
        status: Optional[str],
        leave_type: Optional[str],
        current_user: models.User,
    ) -> List[models.StaffLeave]:
        target_hotel_id = hotel_id if current_user.role == "super-admin" else current_user.hotel_id
        return self.repo.list_leaves(
            hotel_id=target_hotel_id,
            staff_id=staff_id,
            status=status,
            leave_type=leave_type,
        )

    def get_staff_leave(
        self, leave_id: int, current_user: models.User
    ) -> models.StaffLeave:
        leave = self.repo.get_leave_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=404, detail="Leave record not found")

        self._assert_owns_hotel(
            current_user,
            leave.hotel_id,
            "You can view only leave records from your own hotel",
        )
        return leave

    def update_staff_leave(
        self,
        leave_id: int,
        leave_update: schemas.StaffLeaveUpdate,
        current_user: models.User,
    ) -> models.StaffLeave:
        self._assert_can_manage_staff(current_user, "update staff leave")

        leave = self.repo.get_leave_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=404, detail="Leave record not found")

        self._assert_owns_hotel(
            current_user,
            leave.hotel_id,
            "You can update only leave records from your own hotel",
        )

        update_data = leave_update.model_dump(exclude_unset=True)

        if (
            current_user.role != "super-admin"
            and "hotel_id" in update_data
            and update_data["hotel_id"] != current_user.hotel_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot move leave record to another hotel",
            )

        if "status" in update_data and update_data["status"] not in self.ALLOWED_LEAVE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid leave status. Allowed statuses are: {self.ALLOWED_LEAVE_STATUSES}",
            )

        check_hotel_id = update_data.get("hotel_id", leave.hotel_id)
        check_staff_id = update_data.get("staff_id", leave.staff_id)

        staff = self.repo.get_staff_for_hotel(check_staff_id, check_hotel_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found for this hotel")

        target_start = update_data.get("start_date", leave.start_date)
        target_end = update_data.get("end_date", leave.end_date)
        target_days = update_data.get("total_days", leave.total_days)

        if target_end < target_start:
            raise HTTPException(status_code=400, detail="End date cannot be before start date")

        if target_days <= 0:
            raise HTTPException(status_code=400, detail="Total days must be greater than 0")

        if update_data.get("status") == "approved" and not update_data.get("approved_by"):
            update_data["approved_by"] = getattr(current_user, "username", "Admin")

        updated_leave = self.repo.update_leave(leave, update_data)
        if updated_leave.status == "approved":
            self._sync_leave_to_attendance(updated_leave)

        return updated_leave

    def delete_staff_leave(
        self, leave_id: int, current_user: models.User
    ) -> Dict[str, str]:
        self._assert_can_manage_staff(current_user, "delete staff leave")

        leave = self.repo.get_leave_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=404, detail="Leave record not found")

        self._assert_owns_hotel(
            current_user,
            leave.hotel_id,
            "You can delete only leave records from your own hotel",
        )

        self.repo.delete_leave(leave)
        return {"message": "Leave record deleted successfully"}