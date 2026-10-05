from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.dependencies import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.repositories.user_repository import UserRepository


class UserService:
    ALLOWED_ROLES = [
        "super-admin",
        "hotel-admin",
        "manager",
        "front-desk",
        "housekeeping",
        "restaurant",
        "kitchen",
        "inventory",
        "accountant",
        "maintenance",
        "hr",
        "staff",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)

    # -------------------------------------------------------------
    # Registration & Authentication
    # -------------------------------------------------------------

    def register_user(
        self, user: schemas.UserCreate, current_user: models.User
    ) -> models.User:
        if current_user.role not in ["super-admin", "hotel-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only super-admin or hotel-admin can create users",
            )

        if user.role not in self.ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Allowed roles are: {self.ALLOWED_ROLES}",
            )

        # Only super-admin can create another super-admin
        if user.role == "super-admin":
            if current_user.role != "super-admin":
                raise HTTPException(
                    status_code=403,
                    detail="Only super-admin can create super-admin users",
                )

            if user.hotel_id:
                raise HTTPException(
                    status_code=400,
                    detail="super-admin should not have hotel_id",
                )

        # Hotel admin can create users only for own hotel
        if current_user.role == "hotel-admin":
            if user.role == "super-admin":
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin cannot create super-admin",
                )

            if user.hotel_id != current_user.hotel_id:
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin can create users only for own hotel",
                )

        # Hotel users must have hotel_id
        if user.role != "super-admin":
            if not user.hotel_id:
                raise HTTPException(
                    status_code=400,
                    detail="hotel_id is required for hotel users",
                )

            hotel = self.repo.get_hotel_by_id(user.hotel_id)
            if not hotel:
                raise HTTPException(status_code=404, detail="Hotel not found")

        existing_username = self.repo.get_by_username(user.username)
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already exists")

        if user.email:
            existing_email = self.repo.get_by_email(user.email)
            if existing_email:
                raise HTTPException(status_code=400, detail="Email already exists")

        if len(user.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters",
            )

        user_data = {
            "hotel_id": user.hotel_id,
            "staff_id": user.staff_id,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "full_name": user.full_name,
            "password_hash": hash_password(user.password),
            "role": user.role,
            "is_active": user.is_active,
            "allowed_modules": user.allowed_modules or [],
        }

        return self.repo.create_user(user_data)

    def login_user(self, login_data: schemas.LoginRequest) -> Dict[str, Any]:
        user = self.repo.get_by_username(login_data.username)

        if not user or not verify_password(login_data.password, user.password_hash):
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="User account is inactive",
            )

        access_token = create_access_token(
            data={
                "user_id": user.id,
                "hotel_id": user.hotel_id,
                "staff_id": user.staff_id,
                "username": user.username,
                "role": user.role,
                "allowed_modules": user.allowed_modules or [],
            }
        )

        dept = None
        desig = None
        if user.staff_id:
            staff = user.staff or self.db.query(models.Staff).filter(models.Staff.id == user.staff_id).first()
            if staff:
                dept = staff.department
                desig = staff.designation

        resolved_full_name = user.full_name or (staff.full_name if staff else user.username)

        hotel = None
        if user.hotel_id:
            hotel = self.db.query(models.Hotel).filter(models.Hotel.id == user.hotel_id).first()
        hotel_dict = {
            "id": hotel.id,
            "name": hotel.name,
            "owner_name": hotel.owner_name,
            "email": hotel.email,
            "phone": hotel.phone,
            "address": hotel.address,
            "city": hotel.city,
            "state": hotel.state,
            "country": hotel.country,
            "tax_number": hotel.tax_number,
        } if hotel else None

        return {
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id,
            "hotel_id": user.hotel_id,
            "hotel_name": hotel.name if hotel else None,
            "hotel_phone": hotel.phone if hotel else None,
            "hotel_address": hotel.address if hotel else None,
            "hotel_tax_number": hotel.tax_number if hotel else None,
            "hotel": hotel_dict,
            "staff_id": user.staff_id,
            "username": user.username,
            "full_name": resolved_full_name,
            "role": user.role,
            "role_level": getattr(user, "role_level", None) or (staff.role_level if staff else "employee"),
            "is_active": user.is_active,
            "allowed_modules": user.allowed_modules or [],
            "department": dept,
            "designation": desig,
            "must_change_password": bool(getattr(user, "must_change_password", False)),
        }

    def get_current_user_profile(self, current_user: models.User) -> Dict[str, Any]:
        dept = None
        desig = None
        staff = None
        if current_user.staff_id:
            staff = current_user.staff or self.db.query(models.Staff).filter(models.Staff.id == current_user.staff_id).first()
            if staff:
                dept = staff.department
                desig = staff.designation

        resolved_full_name = current_user.full_name or (staff.full_name if staff else current_user.username)

        hotel = None
        if current_user.hotel_id:
            hotel = self.db.query(models.Hotel).filter(models.Hotel.id == current_user.hotel_id).first()
        hotel_dict = {
            "id": hotel.id,
            "name": hotel.name,
            "owner_name": hotel.owner_name,
            "email": hotel.email,
            "phone": hotel.phone,
            "address": hotel.address,
            "city": hotel.city,
            "state": hotel.state,
            "country": hotel.country,
            "tax_number": hotel.tax_number,
        } if hotel else None

        return {
            "user_id": current_user.id,
            "hotel_id": current_user.hotel_id,
            "hotel_name": hotel.name if hotel else None,
            "hotel_phone": hotel.phone if hotel else None,
            "hotel_address": hotel.address if hotel else None,
            "hotel_tax_number": hotel.tax_number if hotel else None,
            "hotel": hotel_dict,
            "staff_id": current_user.staff_id,
            "username": current_user.username,
            "full_name": resolved_full_name,
            "role": current_user.role,
            "role_level": getattr(current_user, "role_level", None) or (staff.role_level if staff else "employee"),
            "is_active": current_user.is_active,
            "allowed_modules": current_user.allowed_modules or [],
            "department": dept,
            "designation": desig,
            "must_change_password": bool(getattr(current_user, "must_change_password", False)),
        }


    def change_password_first_login(
        self, payload: schemas.ChangePasswordFirstLoginRequest, current_user: models.User
    ) -> Dict[str, Any]:
        if len(payload.new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail="New password must be at least 6 characters long",
            )
        current_user.password_hash = hash_password(payload.new_password)
        current_user.must_change_password = False
        self.db.commit()
        return {
            "message": "Password changed successfully",
            "must_change_password": False,
        }

    # -------------------------------------------------------------
    # User Administration
    # -------------------------------------------------------------

    def get_users(
        self,
        hotel_id: Optional[int],
        role: Optional[str],
        is_active: Optional[bool],
        current_user: models.User,
    ) -> List[models.User]:
        if current_user.role == "super-admin":
            target_hotel_id = hotel_id
        elif current_user.role == "hotel-admin":
            target_hotel_id = current_user.hotel_id
        else:
            raise HTTPException(
                status_code=403,
                detail="Only super-admin or hotel-admin can view users",
            )

        return self.repo.list_users(
            hotel_id=target_hotel_id,
            role=role,
            is_active=is_active,
        )

    def get_user(self, user_id: int, current_user: models.User) -> models.User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if current_user.role == "super-admin":
            return user

        if current_user.role == "hotel-admin":
            if user.hotel_id != current_user.hotel_id:
                raise HTTPException(
                    status_code=403,
                    detail="You can view users only from your own hotel",
                )
            return user

        if current_user.id == user.id:
            return user

        raise HTTPException(
            status_code=403,
            detail="You can view only your own user profile",
        )

    def update_user(
        self,
        user_id: int,
        user_update: schemas.UserUpdate,
        current_user: models.User,
    ) -> models.User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Only super-admin, hotel-admin, or the user themselves can update
        if current_user.role not in ["super-admin", "hotel-admin"] and current_user.id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only update your own profile",
            )

        # Hotel admin can update only users from own hotel
        if current_user.role == "hotel-admin":
            if user.hotel_id != current_user.hotel_id:
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin can update users only from own hotel",
                )

            if user.role == "super-admin":
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin cannot update super-admin users",
                )

        update_data = user_update.model_dump(exclude_unset=True)

        if "role" in update_data and update_data["role"] not in self.ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Allowed roles are: {self.ALLOWED_ROLES}",
            )

        # Hotel admin cannot make anyone super-admin
        if current_user.role == "hotel-admin":
            if "role" in update_data and update_data["role"] == "super-admin":
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin cannot create or update super-admin role",
                )

            if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin cannot move user to another hotel",
                )

        final_role = update_data.get("role", user.role)
        final_hotel_id = update_data.get("hotel_id", user.hotel_id)

        if final_role == "super-admin" and final_hotel_id:
            raise HTTPException(
                status_code=400,
                detail="super-admin should not have hotel_id",
            )

        if final_role != "super-admin":
            if not final_hotel_id:
                raise HTTPException(
                    status_code=400,
                    detail="hotel_id is required for hotel users",
                )

            hotel = self.repo.get_hotel_by_id(final_hotel_id)
            if not hotel:
                raise HTTPException(status_code=404, detail="Hotel not found")

        if "username" in update_data:
            existing_username = self.repo.get_duplicate_username(update_data["username"], user.id)
            if existing_username:
                raise HTTPException(status_code=400, detail="Username already exists")

        if "email" in update_data and update_data["email"]:
            existing_email = self.repo.get_duplicate_email(update_data["email"], user.id)
            if existing_email:
                raise HTTPException(status_code=400, detail="Email already exists")

        if "password" in update_data:
            if len(update_data["password"]) < 6:
                raise HTTPException(
                    status_code=400,
                    detail="Password must be at least 6 characters",
                )
            update_data["password_hash"] = hash_password(update_data["password"])
            del update_data["password"]

        return self.repo.update_user(user, update_data)

    def delete_user(self, user_id: int, current_user: models.User) -> Dict[str, str]:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if current_user.role not in ["super-admin", "hotel-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only super-admin or hotel-admin can delete users",
            )

        if current_user.id == user.id:
            raise HTTPException(
                status_code=400,
                detail="You cannot delete your own account",
            )

        if current_user.role == "hotel-admin":
            if user.hotel_id != current_user.hotel_id:
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin can delete users only from own hotel",
                )

            if user.role == "super-admin":
                raise HTTPException(
                    status_code=403,
                    detail="hotel-admin cannot delete super-admin users",
                )

        self.repo.delete_user(user)
        return {"message": "User deleted successfully"}

    # -------------------------------------------------------------
    # Employee Portal Access & Module Assignment
    # -------------------------------------------------------------

    def get_staff_portal_status(
        self,
        hotel_id: Optional[int],
        unassigned_only: bool,
        current_user: models.User,
    ) -> List[Dict[str, Any]]:
        if current_user.role not in ["super-admin", "hotel-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only super-admin or hotel-admin can view staff portal access",
            )

        staff_query = self.db.query(models.Staff)
        if current_user.role == "super-admin":
            if hotel_id is not None:
                staff_query = staff_query.filter(models.Staff.hotel_id == hotel_id)
        else:
            if not current_user.hotel_id:
                raise HTTPException(status_code=400, detail="Hotel ID not found in session")
            staff_query = staff_query.filter(models.Staff.hotel_id == current_user.hotel_id)

        staff_members = staff_query.order_by(models.Staff.full_name.asc()).all()

        results = []
        for staff in staff_members:
            linked_user = self.repo.get_by_staff_id(staff.id)
            if unassigned_only and linked_user is not None:
                continue

            user_data = None
            if linked_user:
                user_data = {
                    "id": linked_user.id,
                    "username": linked_user.username,
                    "email": linked_user.email,
                    "phone": linked_user.phone,
                    "role": linked_user.role,
                    "role_level": getattr(linked_user, "role_level", "employee") or "employee",
                    "is_active": linked_user.is_active,
                    "allowed_modules": linked_user.allowed_modules or [],
                    "must_change_password": bool(getattr(linked_user, "must_change_password", False)),
                }

            results.append({
                "id": staff.id,
                "hotel_id": staff.hotel_id,
                "full_name": staff.full_name,
                "phone": staff.phone,
                "email": staff.email,
                "department": staff.department,
                "designation": staff.designation,
                "role_level": getattr(staff, "role_level", "employee") or "employee",
                "status": staff.status,
                "employee_type": staff.employee_type or "permanent",
                "is_assigned": linked_user is not None,
                "user": user_data,
            })

        return results

    def create_employee_portal_access(
        self,
        payload: schemas.EmployeePortalAccessCreate,
        current_user: models.User,
    ) -> models.User:
        if current_user.role not in ["super-admin", "hotel-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only super-admin or hotel-admin can manage employee portal access",
            )

        staff = self.repo.get_staff_by_id(payload.staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")

        if current_user.role == "hotel-admin" and staff.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can provision access only for your own hotel staff",
            )

        target_role_level = payload.role_level or getattr(staff, "role_level", "employee") or "employee"

        # Check if staff already has linked user account
        existing_user = self.repo.get_by_staff_id(payload.staff_id)
        if existing_user:
            duplicate_user = self.repo.get_duplicate_username(payload.username, existing_user.id)
            if duplicate_user:
                raise HTTPException(status_code=400, detail="Username is already taken by another user")

            update_data = {
                "username": payload.username,
                "role": payload.role,
                "role_level": target_role_level,
                "allowed_modules": payload.allowed_modules or [],
                "is_active": True,
                "must_change_password": bool(payload.must_change_password),
            }
            if payload.password and len(payload.password.strip()) > 0:
                if len(payload.password) < 6:
                    raise HTTPException(
                        status_code=400,
                        detail="Password must be at least 6 characters long",
                    )
                update_data["password_hash"] = hash_password(payload.password)

            clean_email = str(payload.email).strip() if payload.email else None
            if clean_email:
                dup_email = self.repo.get_by_email(clean_email)
                if dup_email and dup_email.id != existing_user.id:
                    clean_email = None
            update_data["email"] = clean_email
            if payload.phone:
                update_data["phone"] = payload.phone

            # Update staff record department and role_level
            staff.role_level = target_role_level
            if payload.department:
                staff.department = payload.department
            if payload.designation:
                staff.designation = payload.designation
            self.db.commit()

            return self.repo.update_user(existing_user, update_data)

        # New user creation
        if not payload.password or len(payload.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long",
            )

        duplicate_username = self.repo.get_by_username(payload.username)
        if duplicate_username:
            raise HTTPException(status_code=400, detail="Username already exists")

        target_email = payload.email or staff.email
        if target_email:
            target_email = str(target_email).strip() or None
        if target_email:
            dup_email = self.repo.get_by_email(target_email)
            if dup_email:
                target_email = None

        # Update staff record role_level & department
        staff.role_level = target_role_level
        if payload.department:
            staff.department = payload.department
        if payload.designation:
            staff.designation = payload.designation
        self.db.commit()

        new_user_data = {
            "hotel_id": staff.hotel_id,
            "staff_id": staff.id,
            "username": payload.username,
            "email": target_email,
            "phone": payload.phone or staff.phone,
            "full_name": staff.full_name,
            "password_hash": hash_password(payload.password),
            "role": payload.role,
            "role_level": target_role_level,
            "is_active": True,
            "allowed_modules": payload.allowed_modules or [],
            "must_change_password": bool(payload.must_change_password),
        }
        return self.repo.create_user(new_user_data)

    def update_user_portals(
        self,
        user_id: int,
        payload: schemas.UserPortalsUpdate,
        current_user: models.User,
    ) -> models.User:
        if current_user.role not in ["super-admin", "hotel-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only super-admin or hotel-admin can update user portal permissions",
            )

        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User account not found")

        if current_user.role == "hotel-admin" and user.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can update permissions only for your own hotel users",
            )

        return self.repo.update_user(user, {"allowed_modules": payload.allowed_modules})