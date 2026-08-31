import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    """
    Tracks live WebSocket connections per role so the backend can push
    events to exactly the audiences that need them:
      - dispatchers hear about every new Open request
      - a retailer hears about status changes on their own requests
      - a rider hears about deliveries assigned to them
    This lives entirely inside the FastAPI process — no separate sync
    service or external broker. See architecture trade-off #4 for the
    scaling ceiling that comes with that choice.
    """

    def __init__(self):
        self.by_role: Dict[str, List[WebSocket]] = {"dispatcher": [], "retailer_staff": [], "rider": []}

    async def connect(self, websocket: WebSocket, role: str):
        await websocket.accept()
        self.by_role.setdefault(role, []).append(websocket)

    def disconnect(self, websocket: WebSocket, role: str):
        if websocket in self.by_role.get(role, []):
            self.by_role[role].remove(websocket)

    async def broadcast_to_role(self, role: str, event: dict):
        dead = []
        for ws in self.by_role.get(role, []):
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, role)


manager = ConnectionManager()
