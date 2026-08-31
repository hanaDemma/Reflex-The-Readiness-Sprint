"""
Run inside the backend container to create demo accounts for a dry run:
    docker compose exec backend python -m app.seed
"""
from app.database import SessionLocal, Base, engine
from app.models import User, Role
from app.auth import hash_password

DEMO_USERS = [
    ("Zara (Admin)", "0700000000", "pass123", Role.admin),
    ("Amina (Retailer)", "0700000001", "pass123", Role.retailer_staff),
    ("Brian (Dispatcher)", "0700000002", "pass123", Role.dispatcher),
    ("Cynthia (Rider)", "0700000003", "pass123", Role.rider),
    ("David (Rider)", "0700000004", "pass123", Role.rider),
]


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for name, phone, password, role in DEMO_USERS:
            if db.query(User).filter(User.phone == phone).first():
                continue
            db.add(User(name=name, phone=phone, password_hash=hash_password(password), role=role))
        db.commit()
        print("Seeded demo users (password 'pass123' for all):")
        for name, phone, _, role in DEMO_USERS:
            print(f"  {role.value:16s} {phone:12s} {name}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
