import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, SessionLocal
from app.routers import auth, deliveries, users, roles
from app.websocket_manager import manager
from app.auth import decode_token
from app.seed import ensure_builtin_roles

app = FastAPI(title="Reflex API")

# Comma-separated list, e.g. "https://app.reflex.com,https://admin.reflex.com".
# Defaults to the local Vite dev server so `docker compose up` keeps working
# out of the box without every developer having to set this themselves.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(deliveries.router)
app.include_router(users.router)
app.include_router(roles.router)


@app.on_event("startup")
def on_startup():
    # Using create_all() instead of Alembic migrations for sprint speed.
    # Fine for a pilot; a real rollout needs versioned migrations.
    Base.metadata.create_all(bind=engine)

    # The four builtin roles are structural (users.role_name FKs to them),
    # so they're ensured here on every boot — not left to the optional
    # demo-data seed script.
    db = SessionLocal()
    try:
        ensure_builtin_roles(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    One socket per client, authenticated via a token query param (browsers
    can't set custom headers on the WebSocket handshake). The role comes
    straight out of the JWT, so a rider can't accidentally subscribe to
    dispatcher events.
    """
    try:
        payload = decode_token(token)
        role = payload["role"]
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket, role)
    try:
        while True:
            await websocket.receive_text()  # clients don't send anything meaningful; just keep-alive
    except WebSocketDisconnect:
        manager.disconnect(websocket, role)