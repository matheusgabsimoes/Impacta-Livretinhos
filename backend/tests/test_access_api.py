import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.database import Base, get_db
from app.main import app
from app.models import Book, User


class AccessApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            db.add_all([User(name=role, email=f"{role}@example.org", hashed_password="x", role=role)
                        for role in ("admin", "estoque", "caixa", "atendente")])
            db.add(Book(title="Livro", theme="Tema", price=10, quantity=2))
            db.commit()

        def test_db():
            with Session(self.engine) as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def headers(self, role):
        return {"Authorization": f"Bearer {create_access_token(f'{role}@example.org')}"}

    def test_access_and_stock(self):
        self.assertEqual(self.client.get("/books").status_code, 401)
        for role in ("estoque", "caixa", "atendente"):
            with self.subTest(role=role):
                headers = self.headers(role)
                self.assertEqual(self.client.get("/books", headers=headers).status_code, 200)
                self.assertEqual(self.client.get("/users", headers=headers).status_code, 403)
                self.assertEqual(self.client.get("/movements", headers=headers).status_code, 403)
                self.assertEqual(self.client.delete("/books/1", headers=headers).status_code, 403)
        payload = {"book_id": 1, "type": "entrada", "quantity": 2, "reason": "Compra"}
        self.assertEqual(self.client.post("/movements", json=payload, headers=self.headers("estoque")).status_code, 201)
        self.assertEqual(self.client.post("/movements", json=payload, headers=self.headers("caixa")).status_code, 403)
        payload.update(type="saida", quantity=5)
        self.assertEqual(self.client.post("/movements", json=payload, headers=self.headers("caixa")).status_code, 400)
        payload["quantity"] = 1
        self.assertEqual(self.client.post("/movements", json=payload, headers=self.headers("caixa")).status_code, 201)
        self.assertEqual(self.client.post("/movements", json=payload, headers=self.headers("atendente")).status_code, 403)
        summary = self.client.get("/summary", headers=self.headers("admin")).json()
        self.assertEqual((summary["titles"], summary["quantity"], len(summary["recent_movements"])), (1, 3, 2))
        self.assertEqual(self.client.get("/summary", headers=self.headers("atendente")).json()["recent_movements"], [])
        self.assertEqual(self.client.delete("/books/1", headers=self.headers("admin")).status_code, 409)


if __name__ == "__main__":
    unittest.main()
