from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user

router = APIRouter(
    tags=["Staff & HR"]
)

# -----------------------------
# STAFF APIs
# -----------------------------
@router.post("/staff", response_model=schemas.StaffResponse)
def create_staff(
    staff: schemas.StaffCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can create staff"
        )

    if current_user.role != "super-admin":
        if staff.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create staff only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == staff.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    existing_staff = db.query(models.Staff).filter(
        models.Staff.hotel_id == staff.hotel_id,
        models.Staff.phone == staff.phone
    ).first()

    if existing_staff:
        raise HTTPException(
            status_code=400,
            detail="Staff with this phone number already exists in this hotel"
        )

    new_staff = models.Staff(**staff.model_dump())

    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)

    return new_staff


@router.get("/staff", response_model=list[schemas.StaffResponse])
def get_staff_members(
    hotel_id: Optional[int] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Staff)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.Staff.hotel_id == hotel_id)
    else:
        query = query.filter(models.Staff.hotel_id == current_user.hotel_id)

    if department:
        query = query.filter(models.Staff.department == department)

    if status:
        query = query.filter(models.Staff.status == status)

    staff_members = query.order_by(models.Staff.id.desc()).all()

    return staff_members


@router.get("/staff/{staff_id}", response_model=schemas.StaffResponse)
def get_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    staff = db.query(models.Staff).filter(
        models.Staff.id == staff_id
    ).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    if current_user.role != "super-admin":
        if staff.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only staff from your own hotel"
            )

    return staff


@router.put("/staff/{staff_id}", response_model=schemas.StaffResponse)
def update_staff(
    staff_id: int,
    staff_update: schemas.StaffUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can update staff"
        )

    staff = db.query(models.Staff).filter(
        models.Staff.id == staff_id
    ).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    if current_user.role != "super-admin":
        if staff.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only staff from your own hotel"
            )

    update_data = staff_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move staff to another hotel"
            )

    if "phone" in update_data:
        duplicate_staff = db.query(models.Staff).filter(
            models.Staff.hotel_id == staff.hotel_id,
            models.Staff.phone == update_data["phone"],
            models.Staff.id != staff_id
        ).first()

        if duplicate_staff:
            raise HTTPException(
                status_code=400,
                detail="Another staff with this phone number already exists in this hotel"
            )

    for key, value in update_data.items():
        setattr(staff, key, value)

    db.commit()
    db.refresh(staff)

    return staff


@router.delete("/staff/{staff_id}")
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can delete staff"
        )

    staff = db.query(models.Staff).filter(
        models.Staff.id == staff_id
    ).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    if current_user.role != "super-admin":
        if staff.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only staff from your own hotel"
            )

    db.delete(staff)
    db.commit()

    return {
        "message": "Staff deleted successfully"
    }

# -----------------------------
# STAFF ATTENDANCE APIs
# -----------------------------
@router.post("/staff-attendance", response_model=schemas.StaffAttendanceResponse)
def create_staff_attendance(
    attendance: schemas.StaffAttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can mark staff attendance"
        )

    if current_user.role != "super-admin":
        if attendance.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can mark attendance only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == attendance.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    staff = db.query(models.Staff).filter(
        models.Staff.id == attendance.staff_id,
        models.Staff.hotel_id == attendance.hotel_id
    ).first()

    if not staff:
        raise HTTPException(
            status_code=404,
            detail="Staff not found for this hotel"
        )

    # ---> ADDED "off-day" HERE <---
    allowed_statuses = ["present", "absent", "half-day", "on-leave", "off-day"]

    if attendance.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {allowed_statuses}"
        )

    existing_attendance = db.query(models.StaffAttendance).filter(
        models.StaffAttendance.hotel_id == attendance.hotel_id,
        models.StaffAttendance.staff_id == attendance.staff_id,
        models.StaffAttendance.attendance_date == attendance.attendance_date
    ).first()

    if existing_attendance:
        raise HTTPException(
            status_code=400,
            detail="Attendance already marked for this staff on this date"
        )

    new_attendance = models.StaffAttendance(**attendance.model_dump())

    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)

    return new_attendance


@router.get("/staff-attendance", response_model=list[schemas.StaffAttendanceResponse])
def get_staff_attendance_records(
    hotel_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.StaffAttendance)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.StaffAttendance.hotel_id == hotel_id)
    else:
        query = query.filter(models.StaffAttendance.hotel_id == current_user.hotel_id)

    if staff_id:
        query = query.filter(models.StaffAttendance.staff_id == staff_id)

    if status:
        query = query.filter(models.StaffAttendance.status == status)

    records = query.order_by(models.StaffAttendance.id.desc()).all()

    return records


@router.get("/staff-attendance/{attendance_id}", response_model=schemas.StaffAttendanceResponse)
def get_staff_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    attendance = db.query(models.StaffAttendance).filter(
        models.StaffAttendance.id == attendance_id
    ).first()

    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    if current_user.role != "super-admin":
        if attendance.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only attendance records from your own hotel"
            )

    return attendance


@router.put("/staff-attendance/{attendance_id}", response_model=schemas.StaffAttendanceResponse)
def update_staff_attendance(
    attendance_id: int,
    attendance_update: schemas.StaffAttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can update staff attendance"
        )

    attendance = db.query(models.StaffAttendance).filter(
        models.StaffAttendance.id == attendance_id
    ).first()

    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    if current_user.role != "super-admin":
        if attendance.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only attendance records from your own hotel"
            )

    update_data = attendance_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move attendance record to another hotel"
            )

    # ---> ADDED "off-day" HERE <---
    allowed_statuses = ["present", "absent", "half-day", "on-leave", "off-day"]

    if "status" in update_data and update_data["status"] not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed statuses are: {allowed_statuses}"
        )

    check_hotel_id = update_data.get("hotel_id", attendance.hotel_id)
    check_staff_id = update_data.get("staff_id", attendance.staff_id)
    check_attendance_date = update_data.get("attendance_date", attendance.attendance_date)

    staff = db.query(models.Staff).filter(
        models.Staff.id == check_staff_id,
        models.Staff.hotel_id == check_hotel_id
    ).first()

    if not staff:
        raise HTTPException(
            status_code=404,
            detail="Staff not found for this hotel"
        )

    duplicate_attendance = db.query(models.StaffAttendance).filter(
        models.StaffAttendance.hotel_id == check_hotel_id,
        models.StaffAttendance.staff_id == check_staff_id,
        models.StaffAttendance.attendance_date == check_attendance_date,
        models.StaffAttendance.id != attendance_id
    ).first()

    if duplicate_attendance:
        raise HTTPException(
            status_code=400,
            detail="Attendance already marked for this staff on this date"
        )

    for key, value in update_data.items():
        setattr(attendance, key, value)

    db.commit()
    db.refresh(attendance)

    return attendance


@router.delete("/staff-attendance/{attendance_id}")
def delete_staff_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can delete staff attendance"
        )

    attendance = db.query(models.StaffAttendance).filter(
        models.StaffAttendance.id == attendance_id
    ).first()

    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    if current_user.role != "super-admin":
        if attendance.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only attendance records from your own hotel"
            )

    db.delete(attendance)
    db.commit()

    return {
        "message": "Attendance record deleted successfully"
    }

# -----------------------------
# STAFF SALARY / PAYROLL APIs
# -----------------------------
@router.post("/staff-salaries", response_model=schemas.StaffSalaryResponse)
def create_staff_salary(
    salary: schemas.StaffSalaryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr", "accountant"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, accountant, hotel-admin, manager, or super-admin can create salary records"
        )

    if current_user.role != "super-admin":
        if salary.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create salary records only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == salary.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    staff = db.query(models.Staff).filter(
        models.Staff.id == salary.staff_id,
        models.Staff.hotel_id == salary.hotel_id
    ).first()

    if not staff:
        raise HTTPException(
            status_code=404,
            detail="Staff not found for this hotel"
        )

    allowed_statuses = ["pending", "paid", "cancelled"]

    if salary.payment_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment status. Allowed statuses are: {allowed_statuses}"
        )

    existing_salary = db.query(models.StaffSalary).filter(
        models.StaffSalary.hotel_id == salary.hotel_id,
        models.StaffSalary.staff_id == salary.staff_id,
        models.StaffSalary.salary_month == salary.salary_month
    ).first()

    if existing_salary:
        raise HTTPException(
            status_code=400,
            detail="Salary already created for this staff and month"
        )

    net_salary = salary.basic_salary + salary.allowances - salary.deductions

    if net_salary < 0:
        raise HTTPException(
            status_code=400,
            detail="Net salary cannot be negative"
        )

    new_salary = models.StaffSalary(
        hotel_id=salary.hotel_id,
        staff_id=salary.staff_id,
        salary_month=salary.salary_month,
        basic_salary=salary.basic_salary,
        allowances=salary.allowances,
        deductions=salary.deductions,
        net_salary=net_salary,
        payment_status=salary.payment_status,
        payment_date=salary.payment_date,
        payment_method=salary.payment_method,
        remarks=salary.remarks
    )

    db.add(new_salary)
    db.commit()
    db.refresh(new_salary)

    return new_salary


@router.get("/staff-salaries", response_model=list[schemas.StaffSalaryResponse])
def get_staff_salaries(
    hotel_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    salary_month: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.StaffSalary)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.StaffSalary.hotel_id == hotel_id)
    else:
        query = query.filter(models.StaffSalary.hotel_id == current_user.hotel_id)

    if staff_id:
        query = query.filter(models.StaffSalary.staff_id == staff_id)

    if salary_month:
        query = query.filter(models.StaffSalary.salary_month == salary_month)

    if payment_status:
        query = query.filter(models.StaffSalary.payment_status == payment_status)

    salaries = query.order_by(models.StaffSalary.id.desc()).all()

    return salaries


@router.get("/staff-salaries/{salary_id}", response_model=schemas.StaffSalaryResponse)
def get_staff_salary(
    salary_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    salary = db.query(models.StaffSalary).filter(
        models.StaffSalary.id == salary_id
    ).first()

    if not salary:
        raise HTTPException(status_code=404, detail="Salary record not found")

    if current_user.role != "super-admin":
        if salary.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only salary records from your own hotel"
            )

    return salary


@router.put("/staff-salaries/{salary_id}", response_model=schemas.StaffSalaryResponse)
def update_staff_salary(
    salary_id: int,
    salary_update: schemas.StaffSalaryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr", "accountant"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, accountant, hotel-admin, manager, or super-admin can update salary records"
        )

    salary = db.query(models.StaffSalary).filter(
        models.StaffSalary.id == salary_id
    ).first()

    if not salary:
        raise HTTPException(status_code=404, detail="Salary record not found")

    if current_user.role != "super-admin":
        if salary.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only salary records from your own hotel"
            )

    update_data = salary_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move salary record to another hotel"
            )

    allowed_statuses = ["pending", "paid", "cancelled"]

    if "payment_status" in update_data and update_data["payment_status"] not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment status. Allowed statuses are: {allowed_statuses}"
        )

    check_hotel_id = update_data.get("hotel_id", salary.hotel_id)
    check_staff_id = update_data.get("staff_id", salary.staff_id)
    check_salary_month = update_data.get("salary_month", salary.salary_month)

    staff = db.query(models.Staff).filter(
        models.Staff.id == check_staff_id,
        models.Staff.hotel_id == check_hotel_id
    ).first()

    if not staff:
        raise HTTPException(
            status_code=404,
            detail="Staff not found for this hotel"
        )

    duplicate_salary = db.query(models.StaffSalary).filter(
        models.StaffSalary.hotel_id == check_hotel_id,
        models.StaffSalary.staff_id == check_staff_id,
        models.StaffSalary.salary_month == check_salary_month,
        models.StaffSalary.id != salary_id
    ).first()

    if duplicate_salary:
        raise HTTPException(
            status_code=400,
            detail="Salary already created for this staff and month"
        )

    for key, value in update_data.items():
        setattr(salary, key, value)

    salary.net_salary = salary.basic_salary + salary.allowances - salary.deductions

    if salary.net_salary < 0:
        raise HTTPException(
            status_code=400,
            detail="Net salary cannot be negative"
        )

    db.commit()
    db.refresh(salary)

    return salary


@router.delete("/staff-salaries/{salary_id}")
def delete_staff_salary(
    salary_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr", "accountant"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, accountant, hotel-admin, manager, or super-admin can delete salary records"
        )

    salary = db.query(models.StaffSalary).filter(
        models.StaffSalary.id == salary_id
    ).first()

    if not salary:
        raise HTTPException(status_code=404, detail="Salary record not found")

    if current_user.role != "super-admin":
        if salary.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only salary records from your own hotel"
            )

    db.delete(salary)
    db.commit()

    return {
        "message": "Salary record deleted successfully"
    }

# -----------------------------
# STAFF LEAVE APIs
# -----------------------------
@router.post("/staff-leaves", response_model=schemas.StaffLeaveResponse)
def create_staff_leave(
    leave: schemas.StaffLeaveCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can create staff leave"
        )

    if current_user.role != "super-admin":
        if leave.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can create staff leave only for your own hotel"
            )

    hotel = db.query(models.Hotel).filter(
        models.Hotel.id == leave.hotel_id
    ).first()

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    staff = db.query(models.Staff).filter(
        models.Staff.id == leave.staff_id,
        models.Staff.hotel_id == leave.hotel_id
    ).first()

    if not staff:
        raise HTTPException(
            status_code=404,
            detail="Staff not found for this hotel"
        )

    allowed_statuses = ["pending", "approved", "rejected", "cancelled"]

    if leave.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid leave status. Allowed statuses are: {allowed_statuses}"
        )

    if leave.end_date < leave.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date"
        )

    if leave.total_days <= 0:
        raise HTTPException(
            status_code=400,
            detail="Total days must be greater than 0"
        )

    new_leave = models.StaffLeave(**leave.model_dump())

    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)

    return new_leave


@router.get("/staff-leaves", response_model=list[schemas.StaffLeaveResponse])
def get_staff_leaves(
    hotel_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    status: Optional[str] = None,
    leave_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.StaffLeave)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.StaffLeave.hotel_id == hotel_id)
    else:
        query = query.filter(models.StaffLeave.hotel_id == current_user.hotel_id)

    if staff_id:
        query = query.filter(models.StaffLeave.staff_id == staff_id)

    if status:
        query = query.filter(models.StaffLeave.status == status)

    if leave_type:
        query = query.filter(models.StaffLeave.leave_type == leave_type)

    leaves = query.order_by(models.StaffLeave.id.desc()).all()

    return leaves


@router.get("/staff-leaves/{leave_id}", response_model=schemas.StaffLeaveResponse)
def get_staff_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    leave = db.query(models.StaffLeave).filter(
        models.StaffLeave.id == leave_id
    ).first()

    if not leave:
        raise HTTPException(status_code=404, detail="Leave record not found")

    if current_user.role != "super-admin":
        if leave.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view only leave records from your own hotel"
            )

    return leave


@router.put("/staff-leaves/{leave_id}", response_model=schemas.StaffLeaveResponse)
def update_staff_leave(
    leave_id: int,
    leave_update: schemas.StaffLeaveUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can update staff leave"
        )

    leave = db.query(models.StaffLeave).filter(
        models.StaffLeave.id == leave_id
    ).first()

    if not leave:
        raise HTTPException(status_code=404, detail="Leave record not found")

    if current_user.role != "super-admin":
        if leave.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update only leave records from your own hotel"
            )

    update_data = leave_update.model_dump(exclude_unset=True)

    if current_user.role != "super-admin":
        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot move leave record to another hotel"
            )

    allowed_statuses = ["pending", "approved", "rejected", "cancelled"]

    if "status" in update_data and update_data["status"] not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid leave status. Allowed statuses are: {allowed_statuses}"
        )

    check_hotel_id = update_data.get("hotel_id", leave.hotel_id)
    check_staff_id = update_data.get("staff_id", leave.staff_id)

    staff = db.query(models.Staff).filter(
        models.Staff.id == check_staff_id,
        models.Staff.hotel_id == check_hotel_id
    ).first()

    if not staff:
        raise HTTPException(
            status_code=404,
            detail="Staff not found for this hotel"
        )

    for key, value in update_data.items():
        setattr(leave, key, value)

    if leave.end_date < leave.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date"
        )

    if leave.total_days <= 0:
        raise HTTPException(
            status_code=400,
            detail="Total days must be greater than 0"
        )

    db.commit()
    db.refresh(leave)

    return leave


@router.delete("/staff-leaves/{leave_id}")
def delete_staff_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["super-admin", "hotel-admin", "manager", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR, hotel-admin, manager, or super-admin can delete staff leave"
        )

    leave = db.query(models.StaffLeave).filter(
        models.StaffLeave.id == leave_id
    ).first()

    if not leave:
        raise HTTPException(status_code=404, detail="Leave record not found")

    if current_user.role != "super-admin":
        if leave.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can delete only leave records from your own hotel"
            )

    db.delete(leave)
    db.commit()

    return {
        "message": "Leave record deleted successfully"
    }