from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Role, RoleDefinition
from app.schemas import UserOut, UserCreateIn, UserUpdateIn
from app.auth import get_current_user, require_role, hash_password

router = APIRouter(prefix="/users", tags=["users"])


def _get_role_or_400(db: Session, role_name: str) -> RoleDefinition:
    role_def = db.query(RoleDefinition).filter(RoleDefinition.name == role_name).first()
    if not role_def:
        raise HTTPException(status_code=400, detail="Unknown role")
    return role_def


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(Role.admin)),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreateIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(Role.admin)),
):
    if db.query(User).filter(User.phone == payload.phone).first():
        raise HTTPException(status_code=400, detail="Phone already registered")

    role_def = _get_role_or_400(db, payload.role_name)

    user = User(
        name=payload.name,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=role_def.base_permission,
        role_name=role_def.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdateIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    if user_id == admin.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role_name is not None:
        role_def = _get_role_or_400(db, payload.role_name)
        user.role = role_def.base_permission
        user.role_name = role_def.name
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user