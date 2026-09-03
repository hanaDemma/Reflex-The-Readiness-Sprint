from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Role, RoleDefinition
from app.schemas import RoleOut, RoleCreateIn
from app.auth import require_role

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(Role.admin)),
):
    return db.query(RoleDefinition).order_by(RoleDefinition.created_at).all()


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreateIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(Role.admin)),
):
    if db.query(RoleDefinition).filter(RoleDefinition.name == payload.name).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A role with this name already exists",
        )

    role = RoleDefinition(
        name=payload.name,
        label=payload.label,
        base_permission=payload.base_permission,
        is_builtin=False,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role
