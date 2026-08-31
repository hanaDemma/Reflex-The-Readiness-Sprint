# Reflex

A delivery-tracking system for small Kenyan retailers: retailer logs a request,
dispatcher assigns a rider, rider updates status (manually or by QR scan) with
live updates pushed to everyone watching. Includes an admin layer for user
management and an operational dashboard.

## Stack

React (admin, retailer, dispatcher, rider views) · FastAPI (REST + WebSockets,
one process) · PostgreSQL (append-only status event log) · JWT auth · Docker.

## ⚠️ Upgrading from an earlier version of this project

This update added an `admin` role and an `is_active` column to the `users`
table. Since the project uses `create_all()` instead of migrations (a
documented sprint trade-off), **existing databases won't pick up the new
column automatically**. If you ran this before, wipe the database once:

```bash
docker compose down -v
docker compose up --build
docker compose exec backend python -m app.seed
```

The `-v` removes the old data volume so the schema gets created fresh.

## Run it

```bash
docker compose up --build
docker compose exec backend python -m app.seed
```

- Frontend: http://localhost:5173
- Backend + Swagger docs: http://localhost:8000/docs

Demo accounts (password `pass123` for all):

| Name | Phone | Role |
|---|---|---|
| Zara | 0700000000 | admin |
| Amina | 0700000001 | retailer_staff |
| Brian | 0700000002 | dispatcher |
| Cynthia | 0700000003 | rider |
| David | 0700000004 | rider |

## Roles

- **Admin** — dashboard (delivery counts by status, rider/dispatcher/retailer
  counts) and user management (create users, change role, activate/deactivate
  an account). Deactivated accounts are blocked at both login and on every
  subsequent API call — not just hidden from the UI.
- **Dispatcher** — open queue + assignment (unchanged), plus the same
  dashboard view as admin (read-only, no user management).
- **Retailer staff** — log requests, watch status live, show QR for scanning.
- **Rider** — assigned deliveries, manual status buttons, QR camera scanner.

## Demo flow (matches the case study's three personas, plus admin)

1. Log in as **Zara (Admin)** → check the dashboard, then create a new rider
   account from User Management to show the flow works.
2. Log in as **Amina (Retailer)** → log a new delivery request.
3. Log in as **Brian (Dispatcher)** → watch the request appear live in the
   open queue → assign it to a rider → check his own dashboard tab.
4. Log in as **Cynthia (Rider)** → see the assignment appear live → mark
   "Picked Up", then either mark "Delivered" manually or scan the QR code
   shown in the retailer's view.
5. Watch Amina's view update to "Delivered" live, with no page refresh.

## Known trade-offs (see full log for "why" and "what I'd do differently")

1. No WebSocket reconnect/offline handling.
2. JWT has no refresh or revocation.
3. Assignment is manual, not auto-dispatched.
4. Single backend process — no horizontal scaling plan yet.
5. SMS is stubbed to a log line, not a real gateway.
6. No Alembic migrations — using `create_all()` for sprint speed (see the
   upgrade note above for what this costs you in practice).
7. Any admin can deactivate any other admin's account except their own — no
   super-admin tier or audit log on who changed what yet.

## Project layout

```
backend/
  app/
    main.py               # FastAPI app, WebSocket endpoint, startup
    models.py              # SQLAlchemy models incl. append-only StatusEvent
    schemas.py               # Pydantic request/response models
    auth.py                   # JWT issuing/verification, role dependency
    websocket_manager.py       # per-role connection tracking + broadcast
    sms.py                       # stubbed SMS side-effect
    seed.py                       # demo account creation
    routers/
      auth.py                     # register / login
      users.py                     # admin: list/create/update users
      deliveries.py                 # create, assign, status, QR, dashboard
frontend/
  src/
    api.js                   # REST client + session storage
    ws.js                     # WebSocket hook
    App.jsx                     # session + role-based routing
    pages/
      Login.jsx
      Admin.jsx                    # tabs: Dashboard / User management
      Dashboard.jsx                  # stat cards, shared by admin + dispatcher
      UserManagement.jsx               # create/list/deactivate/re-role users
      Retailer.jsx                       # create request, live status, QR display
      Dispatcher.jsx                       # open queue, assign, own dashboard tab
      Rider.jsx                              # assigned list, status buttons, QR scanner
docker-compose.yml
```
