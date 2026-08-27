from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user, hash_password, verify_password, create_access_token

router = APIRouter(
    tags=["Users & Auth"]
)

# -----------------------------
# AUTH / USER REGISTRATION
# -----------------------------

@router.post("/auth/register-user", response_model=schemas.UserResponse)
def register_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    allowed_roles = [
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

    if current_user.role not in ["super-admin", "hotel-admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only super-admin or hotel-admin can create users"
        )

    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Allowed roles are: {allowed_roles}"
        )

    # Only super-admin can create another super-admin
    if user.role == "super-admin":
        if current_user.role != "super-admin":
            raise HTTPException(
                status_code=403,
                detail="Only super-admin can create super-admin users"
            )

        if user.hotel_id:
            raise HTTPException(
                status_code=400,
                detail="super-admin should not have hotel_id"
            )

    # Hotel admin can create users only for own hotel
    if current_user.role == "hotel-admin":
        if user.role == "super-admin":
            raise HTTPException(
                status_code=403,
                detail="hotel-admin cannot create super-admin"
            )

        if user.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="hotel-admin can create users only for own hotel"
            )

    # Hotel users must have hotel_id
    if user.role != "super-admin":
        if not user.hotel_id:
            raise HTTPException(
                status_code=400,
                detail="hotel_id is required for hotel users"
            )

        hotel = db.query(models.Hotel).filter(
            models.Hotel.id == user.hotel_id
        ).first()

        if not hotel:
            raise HTTPException(
                status_code=404,
                detail="Hotel not found"
            )

    existing_username = db.query(models.User).filter(
        models.User.username == user.username
    ).first()

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    if user.email:
        existing_email = db.query(models.User).filter(
            models.User.email == user.email
        ).first()

        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )

    if len(user.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
        )

    new_user = models.User(
        hotel_id=user.hotel_id,
        username=user.username,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        password_hash=hash_password(user.password),
        role=user.role,
        is_active=user.is_active
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/auth/login", response_model=schemas.LoginResponse)
def login_user(
    login_data: schemas.LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.username == login_data.username
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    access_token = create_access_token(
        data={
            "user_id": user.id,
            "hotel_id": user.hotel_id,
            "username": user.username,
            "role": user.role
        }
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "hotel_id": user.hotel_id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active
    }


@router.get("/auth/me", response_model=schemas.CurrentUserResponse)
def get_logged_in_user(
    current_user: models.User = Depends(get_current_user)
):
    return {
        "user_id": current_user.id,
        "hotel_id": current_user.hotel_id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active
    }

# -----------------------------
# USER MANAGEMENT APIs
# -----------------------------

@router.get("/users", response_model=list[schemas.UserResponse])
def get_users(
    hotel_id: Optional[int] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.User)

    if current_user.role == "super-admin":
        if hotel_id:
            query = query.filter(models.User.hotel_id == hotel_id)

    elif current_user.role == "hotel-admin":
        query = query.filter(models.User.hotel_id == current_user.hotel_id)

    else:
        raise HTTPException(
            status_code=403,
            detail="Only super-admin or hotel-admin can view users"
        )

    if role:
        query = query.filter(models.User.role == role)

    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)

    users = query.order_by(models.User.id.desc()).all()

    return users


@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if current_user.role == "super-admin":
        return user

    if current_user.role == "hotel-admin":
        if user.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="You can view users only from your own hotel"
            )

        return user

    if current_user.id == user.id:
        return user

    raise HTTPException(
        status_code=403,
        detail="You can view only your own user profile"
    )


@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Only super-admin, hotel-admin, or the user themselves can update
    if current_user.role not in ["super-admin", "hotel-admin"] and current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only update your own profile"
        )

    # Hotel admin can update only users from own hotel
    if current_user.role == "hotel-admin":
        if user.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="hotel-admin can update users only from own hotel"
            )

        if user.role == "super-admin":
            raise HTTPException(
                status_code=403,
                detail="hotel-admin cannot update super-admin users"
            )

    update_data = user_update.model_dump(exclude_unset=True)

    allowed_roles = [
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

    if "role" in update_data and update_data["role"] not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Allowed roles are: {allowed_roles}"
        )

    # Hotel admin cannot make anyone super-admin
    if current_user.role == "hotel-admin":
        if "role" in update_data and update_data["role"] == "super-admin":
            raise HTTPException(
                status_code=403,
                detail="hotel-admin cannot create or update super-admin role"
            )

        if "hotel_id" in update_data and update_data["hotel_id"] != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="hotel-admin cannot move user to another hotel"
            )

    final_role = update_data.get("role", user.role)
    final_hotel_id = update_data.get("hotel_id", user.hotel_id)

    if final_role == "super-admin" and final_hotel_id:
        raise HTTPException(
            status_code=400,
            detail="super-admin should not have hotel_id"
        )

    if final_role != "super-admin":
        if not final_hotel_id:
            raise HTTPException(
                status_code=400,
                detail="hotel_id is required for hotel users"
            )

        hotel = db.query(models.Hotel).filter(
            models.Hotel.id == final_hotel_id
        ).first()

        if not hotel:
            raise HTTPException(
                status_code=404,
                detail="Hotel not found"
            )

    if "username" in update_data:
        existing_username = db.query(models.User).filter(
            models.User.username == update_data["username"],
            models.User.id != user.id
        ).first()

        if existing_username:
            raise HTTPException(
                status_code=400,
                detail="Username already exists"
            )

    if "email" in update_data and update_data["email"]:
        existing_email = db.query(models.User).filter(
            models.User.email == update_data["email"],
            models.User.id != user.id
        ).first()

        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )

    if "password" in update_data:
        if len(update_data["password"]) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters"
            )

        user.password_hash = hash_password(update_data["password"])
        del update_data["password"]

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Only super-admin and hotel-admin can delete users
    if current_user.role not in ["super-admin", "hotel-admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only super-admin or hotel-admin can delete users"
        )

    # Prevent user deleting own account
    if current_user.id == user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account"
        )

    # Hotel admin can delete only users from own hotel
    if current_user.role == "hotel-admin":
        if user.hotel_id != current_user.hotel_id:
            raise HTTPException(
                status_code=403,
                detail="hotel-admin can delete users only from own hotel"
            )

        if user.role == "super-admin":
            raise HTTPException(
                status_code=403,
                detail="hotel-admin cannot delete super-admin users"
            )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully"
    }