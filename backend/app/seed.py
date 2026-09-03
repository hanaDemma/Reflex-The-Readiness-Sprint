"""
Run inside the backend container to create demo accounts for a dry run:
    docker compose exec backend python -m app.seed
"""
from app.database import SessionLocal, Base, engine
from app.models import User, Role, RoleDefinition
from app.auth import hash_password

BUILTIN_ROLES = [
    ("admin", "Admin", Role.admin),
    ("retailer_staff", "Retailer staff", Role.retailer_staff),
    ("dispatcher", "Dispatcher", Role.dispatcher),
    ("rider", "Rider", Role.rider),
]

DEMO_USERS = [
    ("Zara (Admin)", "0700000000", "pass123", "admin"),
    ("Amina (Retailer)", "0700000001", "pass123", "retailer_staff"),
    ("Brian (Dispatcher)", "0700000002", "pass123", "dispatcher"),
    ("Cynthia (Rider)", "0700000003", "pass123", "rider"),
    ("David (Rider)", "0700000004", "pass123", "rider"),
]


def ensure_builtin_roles(db):
    """
    The four builtin roles are structural, required reference data for the
    `users.role_name` foreign key to work at all — not optional demo data.
    Called on every backend startup (see main.py), independent of whether
    anyone ever runs the demo-user seed below.
    """
    changed = False
    for name, label, base_permission in BUILTIN_ROLES:
        if db.query(RoleDefinition).filter(RoleDefinition.name == name).first():
            continue
        db.add(RoleDefinition(name=name, label=label, base_permission=base_permission, is_builtin=True))
        changed = True
    if changed:
        db.commit()


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_builtin_roles(db)

        for name, phone, password, role_name in DEMO_USERS:
            if db.query(User).filter(User.phone == phone).first():
                continue
            role_def = db.query(RoleDefinition).filter(RoleDefinition.name == role_name).first()
            db.add(User(
                name=name,
                phone=phone,
                password_hash=hash_password(password),
                role=role_def.base_permission,
                role_name=role_def.name,
            ))
        db.commit()
        print("Seeded demo users (password 'pass123' for all):")
        for name, phone, _, role_name in DEMO_USERS:
            print(f"  {role_name:16s} {phone:12s} {name}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
