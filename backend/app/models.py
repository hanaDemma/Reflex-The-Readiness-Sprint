import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Enum as SAEnum, Boolean, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    admin = "admin"
    retailer_staff = "retailer_staff"
    dispatcher = "dispatcher"
    rider = "rider"


class RoleDefinition(Base):
    """
    A catalog of assignable, admin-defined roles. `base_permission` maps
    each entry onto one of the four fixed permission tiers above — those
    tiers are what every `require_role()` check and frontend page actually
    key off. This table lets an admin add new named roles (e.g. "Warehouse
    Manager") without touching auth: the new role just inherits the
    permissions/page of whichever tier it's mapped to.
    """
    __tablename__ = "roles"

    name = Column(String, primary_key=True)
    label = Column(String, nullable=False)
    base_permission = Column(SAEnum(Role), nullable=False)
    is_builtin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RequestStatus(str, enum.Enum):
    open = "Open"
    assigned = "Assigned"
    picked_up = "Picked Up"
    delivered = "Delivered"
    failed = "Failed"


class StatusMethod(str, enum.Enum):
    manual = "manual"
    qr_scan = "qr_scan"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum(Role), nullable=False)
    role_name = Column(String, ForeignKey("roles.name"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DeliveryRequest(Base):
    __tablename__ = "delivery_requests"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    retailer_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    address = Column(String, nullable=False)
    item_description = Column(String, nullable=False)

    # Denormalized "current status" for fast reads — always derived from the
    # latest StatusEvent, never written to directly except at creation.
    # See StatusEvent for the source-of-truth audit trail.
    current_status = Column(SAEnum(RequestStatus), nullable=False, default=RequestStatus.open)

    qr_token = Column(String, unique=True, nullable=False, default=gen_uuid)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    retailer = relationship("User", foreign_keys=[retailer_id])
    assignment = relationship("Assignment", back_populates="delivery_request", uselist=False)
    status_events = relationship(
        "StatusEvent", back_populates="delivery_request", order_by="StatusEvent.timestamp"
    )


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    delivery_request_id = Column(
        UUID(as_uuid=False), ForeignKey("delivery_requests.id"), nullable=False, unique=True
    )
    rider_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    delivery_request = relationship("DeliveryRequest", back_populates="assignment")
    rider = relationship("User", foreign_keys=[rider_id])


class StatusEvent(Base):
    """
    Append-only audit log. This is the architectural decision worth
    defending: we never mutate a single status field in place, so
    'who marked this delivered, and when' is always answerable.
    """
    __tablename__ = "status_events"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    delivery_request_id = Column(
        UUID(as_uuid=False), ForeignKey("delivery_requests.id"), nullable=False
    )
    status = Column(SAEnum(RequestStatus), nullable=False)
    actor_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    method = Column(SAEnum(StatusMethod), nullable=False, default=StatusMethod.manual)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    delivery_request = relationship("DeliveryRequest", back_populates="status_events")
    actor = relationship("User", foreign_keys=[actor_id])
