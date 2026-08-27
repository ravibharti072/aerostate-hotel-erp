import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.database import get_db
from app import models

SECRET_KEY = os.getenv("SECRET_KEY", "hotel_erp_secret_key_change_later")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire
    })

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    return user


def require_roles(allowed_roles: list[str]):
    def role_checker(
        current_user: models.User = Depends(get_current_user)
    ):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Allowed roles are: {allowed_roles}"
            )

        return current_user

    return role_checker


def require_super_admin(
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "super-admin":
        raise HTTPException(
            status_code=403,
            detail="Only super-admin can access this API"
        )

    return current_user


def require_hotel_admin_or_manager(
    current_user: models.User = Depends(get_current_user)
):
    allowed_roles = ["super-admin", "hotel-admin", "manager"]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only super-admin, hotel-admin or manager can access this API"
        )

    return current_user


def require_accountant(
    current_user: models.User = Depends(get_current_user)
):
    allowed_roles = ["hotel-admin", "manager", "accountant"]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager or accountant can access this API"
        )

    return current_user


def require_front_desk(
    current_user: models.User = Depends(get_current_user)
):
    allowed_roles = ["hotel-admin", "manager", "front-desk"]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager or front-desk can access this API"
        )

    return current_user


def require_inventory_user(
    current_user: models.User = Depends(get_current_user)
):
    allowed_roles = ["hotel-admin", "manager", "inventory"]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only hotel-admin, manager or inventory user can access this API"
        )

    return current_user