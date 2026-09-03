from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import RegisterIn, LoginIn, TokenOut
from app.auth import hash_password, verify_password, create_access_token
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut)
def register(
    payload: RegisterIn,
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(
        User.phone == payload.phone
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Phone already registered"
        )

    user = User(
        name=payload.name,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({
    "sub": str(user.id),
    "role": user.role.value,
})

    return TokenOut(
        access_token=token,
        role=user.role,
        name=user.name
    )

@router.post("/login", response_model=TokenOut)
def login(
    payload: LoginIn,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.phone == payload.phone)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid phone or password",
        )

    if not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid phone or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive",
        )

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
    })

    return TokenOut(
        access_token=token,
        token_type="bearer"
        role=user.role,
        name=user.name
    )