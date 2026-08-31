from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, deliveries, users
from app.websocket_manager import manager
from app.auth import decode_token

app = FastAPI(title="Reflex API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # sprint scope — lock this down before real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(deliveries.router)
app.include_router(users.router)


@app.on_event("startup")
def on_startup():
    # Using create_all() instead of Alembic migrations for sprint speed.
    # Fine for a pilot; a real rollout needs versioned migrations.
    Base.metadata.create_all(bind=engine)


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
