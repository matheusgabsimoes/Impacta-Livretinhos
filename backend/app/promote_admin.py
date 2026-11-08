"""Promote an existing user without creating credentials."""
import sys

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python -m app.promote_admin EMAIL")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == sys.argv[1]))
        if user is None:
            raise SystemExit("Usuario nao encontrado. Cadastre a conta antes de promover.")
        user.role = "admin"
        db.commit()
        print("Administrador promovido:", user.email)


if __name__ == "__main__":
    main()
