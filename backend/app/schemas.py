from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models import Role, RequestStatus, StatusMethod


# ---- Auth ----

class RegisterIn(BaseModel):
    name: str
    phone: str
    password: str
    role: Role


class LoginIn(BaseModel):
    phone: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    name: str


# ---- Delivery requests ----

class DeliveryCreateIn(BaseModel):
    customer_name: str
    customer_phone: str
    address: str
    item_description: str


class StatusEventOut(BaseModel):
    status: RequestStatus
    actor_id: str
    method: StatusMethod
    timestamp: datetime

    class Config:
        from_attributes = True


class DeliveryOut(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    address: str
    item_description: str
    current_status: RequestStatus
    qr_token: str
    created_at: datetime
    assigned_rider_name: Optional[str] = None
    status_events: List[StatusEventOut] = []

    class Config:
        from_attributes = True


class AssignIn(BaseModel):
    rider_id: str


class StatusUpdateIn(BaseModel):
    status: RequestStatus
    method: StatusMethod = StatusMethod.manual


class RiderOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


# ---- Admin: user management ----

class UserOut(BaseModel):
    id: str
    name: str
    phone: str
    role: Role
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreateIn(BaseModel):
    name: str
    phone: str
    password: str
    role: Role


class UserUpdateIn(BaseModel):
    role: Optional[Role] = None
    is_active: Optional[bool] = None


# ---- Admin: dashboard ----

class DashboardOut(BaseModel):
    total_deliveries: int
    open_count: int
    assigned_count: int
    picked_up_count: int
    delivered_count: int
    failed_count: int
    total_riders: int
    active_riders: int
    total_dispatchers: int
    total_retailers: int
