import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.database import Base, get_db
from app.main import app
from app.models import User

OLD_PASSWORD = "senha-antiga"
NEW_PASSWORD = "senha-nova-123"


class PasswordChangeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            db.add(User(name="Caixa", email="caixa@example.org", hashed_password=hash_password(OLD_PASSWORD), role="caixa"))
            db.commit()

        def test_db():
            with Session(self.engine) as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        self.client = TestClient(app)
        self.headers = {"Authorization": f"Bearer {create_access_token('caixa@example.org')}"}

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def change(self, current, new, headers=None):
        return self.client.put("/auth/me/password", json={"current_password": current, "new_password": new},
                               headers=self.headers if headers is None else headers)

    def login(self, password):
        return self.client.post("/auth/login", json={"email": "caixa@example.org", "password": password})

    def test_change_password_replaces_the_login_credentials(self):
        self.assertEqual(self.change(OLD_PASSWORD, NEW_PASSWORD).status_code, 204)
        self.assertEqual(self.login(NEW_PASSWORD).status_code, 200)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 401)

    def test_wrong_current_password_is_rejected_and_nothing_changes(self):
        response = self.change("senha-errada", NEW_PASSWORD)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Senha atual incorreta")
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 200)
        self.assertEqual(self.login(NEW_PASSWORD).status_code, 401)

    def test_new_password_must_differ_from_current(self):
        response = self.change(OLD_PASSWORD, OLD_PASSWORD)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "A nova senha deve ser diferente da atual")

    def test_new_password_follows_registration_length_rules(self):
        self.assertEqual(self.change(OLD_PASSWORD, "12345").status_code, 422)
        self.assertEqual(self.change(OLD_PASSWORD, "x" * 101).status_code, 422)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 200)

    def test_requires_authentication(self):
        self.assertEqual(self.change(OLD_PASSWORD, NEW_PASSWORD, headers={}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
