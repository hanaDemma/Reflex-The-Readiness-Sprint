from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User, Role, DeliveryRequest, Assignment, StatusEvent, RequestStatus, StatusMethod
from app.schemas import DeliveryCreateIn, DeliveryOut, AssignIn, StatusUpdateIn, RiderOut, DashboardOut
from app.auth import get_current_user, require_role
from app.websocket_manager import manager

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(Role.admin, Role.dispatcher)),
):
    def count_status(status: RequestStatus) -> int:
        return db.query(DeliveryRequest).filter(DeliveryRequest.current_status == status).count()

    return DashboardOut(
        total_deliveries=db.query(DeliveryRequest).count(),
        open_count=count_status(RequestStatus.open),
        assigned_count=count_status(RequestStatus.assigned),
        picked_up_count=count_status(RequestStatus.picked_up),
        delivered_count=count_status(RequestStatus.delivered),
        failed_count=count_status(RequestStatus.failed),
        total_riders=db.query(User).filter(User.role == Role.rider).count(),
        active_riders=db.query(User).filter(User.role == Role.rider, User.is_active == True).count(),  # noqa: E712
        total_dispatchers=db.query(User).filter(User.role == Role.dispatcher).count(),
        total_retailers=db.query(User).filter(User.role == Role.retailer_staff).count(),
    )


def _to_out(d: DeliveryRequest) -> DeliveryOut:
    out = DeliveryOut.model_validate(d)
    if d.assignment and d.assignment.rider:
        out.assigned_rider_name = d.assignment.rider.name
    return out


def _query_with_relations(db: Session):
    return db.query(DeliveryRequest).options(
        joinedload(DeliveryRequest.assignment).joinedload(Assignment.rider),
        joinedload(DeliveryRequest.status_events),
    )


# ---- Retailer: create a request ----

@router.post("", response_model=DeliveryOut)
async def create_delivery(
    payload: DeliveryCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.retailer_staff)),
):
    delivery = DeliveryRequest(
        retailer_id=user.id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        address=payload.address,
        item_description=payload.item_description,
        current_status=RequestStatus.open,
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)

    # Real-time push: dispatchers see this the instant it's created.
    await manager.broadcast_to_role("dispatcher", {
        "type": "new_request",
        "delivery_id": delivery.id,
        "customer_name": delivery.customer_name,
    })

    return _to_out(delivery)


# ---- Retailer: see own requests, live-updated ----

@router.get("/mine", response_model=list[DeliveryOut])
def my_deliveries(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.retailer_staff)),
):
    deliveries = _query_with_relations(db).filter(
        DeliveryRequest.retailer_id == user.id
    ).order_by(DeliveryRequest.created_at.desc()).all()
    return [_to_out(d) for d in deliveries]


# ---- Dispatcher: see the open queue ----

@router.get("/open", response_model=list[DeliveryOut])
def open_queue(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.dispatcher)),
):
    deliveries = _query_with_relations(db).filter(
        DeliveryRequest.current_status == RequestStatus.open
    ).order_by(DeliveryRequest.created_at.asc()).all()
    return [_to_out(d) for d in deliveries]


@router.get("/riders", response_model=list[RiderOut])
def list_riders(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.dispatcher)),
):
    return db.query(User).filter(User.role == Role.rider).all()


# ---- Dispatcher: assign a rider ----

@router.post("/{delivery_id}/assign", response_model=DeliveryOut)
async def assign_delivery(
    delivery_id: str,
    payload: AssignIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.dispatcher)),
):
    delivery = db.query(DeliveryRequest).filter(DeliveryRequest.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery.current_status != RequestStatus.open:
        raise HTTPException(status_code=400, detail="Delivery is not open for assignment")

    rider = db.query(User).filter(User.id == payload.rider_id, User.role == Role.rider).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    assignment = Assignment(delivery_request_id=delivery.id, rider_id=rider.id)
    db.add(assignment)

    delivery.current_status = RequestStatus.assigned
    event = StatusEvent(
        delivery_request_id=delivery.id,
        status=RequestStatus.assigned,
        actor_id=user.id,
        method=StatusMethod.manual,
    )
    db.add(event)
    db.commit()
    db.refresh(delivery)

    # Push to the rider (new assignment) and the retailer (status changed).
    await manager.broadcast_to_role("rider", {
        "type": "new_assignment", "delivery_id": delivery.id,
    })
    await manager.broadcast_to_role("retailer_staff", {
        "type": "status_changed", "delivery_id": delivery.id, "status": delivery.current_status.value,
    })

    return _to_out(delivery)


# ---- Rider: see assigned deliveries ----

@router.get("/assigned", response_model=list[DeliveryOut])
def assigned_to_me(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.rider)),
):
    deliveries = _query_with_relations(db).join(Assignment).filter(
        Assignment.rider_id == user.id,
        DeliveryRequest.current_status != RequestStatus.delivered,
    ).order_by(Assignment.assigned_at.asc()).all()
    return [_to_out(d) for d in deliveries]


# ---- Rider: update status (manual button OR QR scan) ----

VALID_TRANSITIONS = {
    RequestStatus.assigned: {RequestStatus.picked_up, RequestStatus.failed},
    RequestStatus.picked_up: {RequestStatus.delivered, RequestStatus.failed},
}


@router.post("/{delivery_id}/status", response_model=DeliveryOut)
async def update_status(
    delivery_id: str,
    payload: StatusUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.rider)),
):
    delivery = db.query(DeliveryRequest).filter(DeliveryRequest.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if not delivery.assignment or delivery.assignment.rider_id != user.id:
        raise HTTPException(status_code=403, detail="Not assigned to you")

    allowed_next = VALID_TRANSITIONS.get(delivery.current_status, set())
    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move from {delivery.current_status.value} to {payload.status.value}",
        )

    delivery.current_status = payload.status
    event = StatusEvent(
        delivery_request_id=delivery.id,
        status=payload.status,
        actor_id=user.id,
        method=payload.method,
    )
    db.add(event)
    db.commit()
    db.refresh(delivery)

    await manager.broadcast_to_role("retailer_staff", {
        "type": "status_changed", "delivery_id": delivery.id, "status": delivery.current_status.value,
    })

    # Outside-the-app step: SMS the customer on key transitions.
    if payload.status in (RequestStatus.assigned, RequestStatus.delivered):
        from app.sms import send_sms
        send_sms(delivery.customer_phone, f"Your delivery is now: {payload.status.value}")

    return _to_out(delivery)


# ---- Lookup by QR token (rider scans, app resolves which delivery) ----

@router.get("/by-qr/{qr_token}", response_model=DeliveryOut)
def lookup_by_qr(
    qr_token: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.rider)),
):
    delivery = _query_with_relations(db).filter(DeliveryRequest.qr_token == qr_token).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="No delivery matches this QR code")
    return _to_out(delivery)
