import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.database import Base, get_db
from app.main import app
from app.models import Book, StockMovement, Supplier, User

SUPPLIER = {"name": "Editora Alfa", "cnpj": "12.345.678/0001-95", "email": "contato@alfa.example.org", "phone": "11 4002-8922"}


class SupplierApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            db.add_all([User(name=role, email=f"{role}@example.org", hashed_password="x", role=role)
                        for role in ("admin", "estoque", "caixa", "atendente")])
            db.add(Book(title="Livro", theme="Tema", price=10, quantity=5))
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

    def create_supplier(self, **overrides):
        return self.client.post("/suppliers", json={**SUPPLIER, **overrides}, headers=self.headers("admin"))

    def movement(self, role, **overrides):
        payload = {"book_id": 1, "type": "entrada", "quantity": 2, "reason": "Compra", **overrides}
        return self.client.post("/movements", json=payload, headers=self.headers(role))

    def book_quantity(self):
        with Session(self.engine) as db:
            return db.get(Book, 1).quantity

    def test_admin_manages_suppliers(self):
        created = self.create_supplier()
        self.assertEqual(created.status_code, 201)
        supplier = created.json()
        self.assertEqual(supplier["cnpj"], "12345678000195")
        listed = self.client.get("/suppliers", headers=self.headers("admin")).json()
        self.assertEqual([item["name"] for item in listed], ["Editora Alfa"])

        updated = self.client.put(f"/suppliers/{supplier['id']}", json={**SUPPLIER, "name": "Editora Beta", "cnpj": None},
                                  headers=self.headers("admin"))
        self.assertEqual((updated.status_code, updated.json()["name"], updated.json()["cnpj"]), (200, "Editora Beta", None))
        self.assertEqual(self.client.put("/suppliers/999", json=SUPPLIER, headers=self.headers("admin")).status_code, 404)

        self.assertEqual(self.client.delete(f"/suppliers/{supplier['id']}", headers=self.headers("admin")).status_code, 204)
        self.assertEqual(self.client.delete(f"/suppliers/{supplier['id']}", headers=self.headers("admin")).status_code, 404)

    def test_optional_fields_can_be_omitted(self):
        created = self.client.post("/suppliers", json={"name": "Distribuidora Gama"}, headers=self.headers("admin"))
        self.assertEqual(created.status_code, 201)
        self.assertEqual((created.json()["cnpj"], created.json()["email"], created.json()["phone"]), (None, None, None))

    def test_name_and_cnpj_must_be_unique(self):
        self.assertEqual(self.create_supplier().status_code, 201)
        self.assertEqual(self.create_supplier(cnpj="98765432000100").status_code, 400)
        self.assertEqual(self.create_supplier(name="Outra Editora").status_code, 400)
        other = self.create_supplier(name="Outra Editora", cnpj="98765432000100").json()
        clash = self.client.put(f"/suppliers/{other['id']}", json=SUPPLIER, headers=self.headers("admin"))
        self.assertEqual(clash.status_code, 400)

    def test_cnpj_needs_fourteen_digits(self):
        self.assertEqual(self.create_supplier(cnpj="123").status_code, 422)
        self.assertEqual(self.create_supplier(name="Sem pontuacao", cnpj="12345678000195").status_code, 201)

    def test_only_admin_and_stock_can_list_and_only_admin_can_change(self):
        self.assertEqual(self.client.get("/suppliers").status_code, 401)
        self.assertEqual(self.client.get("/suppliers", headers=self.headers("estoque")).status_code, 200)
        for role in ("caixa", "atendente"):
            with self.subTest(role=role):
                self.assertEqual(self.client.get("/suppliers", headers=self.headers(role)).status_code, 403)
        supplier_id = self.create_supplier().json()["id"]
        for role in ("estoque", "caixa", "atendente"):
            with self.subTest(role=role):
                headers = self.headers(role)
                self.assertEqual(self.client.post("/suppliers", json=SUPPLIER, headers=headers).status_code, 403)
                self.assertEqual(self.client.put(f"/suppliers/{supplier_id}", json=SUPPLIER, headers=headers).status_code, 403)
                self.assertEqual(self.client.delete(f"/suppliers/{supplier_id}", headers=headers).status_code, 403)

    def test_entry_records_supplier_and_history_shows_it(self):
        supplier_id = self.create_supplier().json()["id"]
        with_supplier = self.movement("estoque", supplier_id=supplier_id)
        self.assertEqual(with_supplier.status_code, 201)
        self.assertEqual((with_supplier.json()["supplier_id"], with_supplier.json()["supplier_name"]), (supplier_id, "Editora Alfa"))
        without_supplier = self.movement("admin")
        self.assertEqual(without_supplier.status_code, 201)
        self.assertEqual((without_supplier.json()["supplier_id"], without_supplier.json()["supplier_name"]), (None, None))

        history = self.client.get("/movements", headers=self.headers("admin")).json()
        self.assertEqual([item["supplier_name"] for item in history], [None, "Editora Alfa"])
        self.assertEqual(self.book_quantity(), 9)

    def test_exit_cannot_carry_a_supplier(self):
        supplier_id = self.create_supplier().json()["id"]
        response = self.movement("caixa", type="saida", quantity=1, reason="Venda", supplier_id=supplier_id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.book_quantity(), 5)
        with Session(self.engine) as db:
            self.assertEqual(list(db.scalars(select(StockMovement))), [])

    def test_unknown_supplier_is_rejected_without_touching_stock(self):
        self.assertEqual(self.movement("estoque", supplier_id=999).status_code, 404)
        self.assertEqual(self.book_quantity(), 5)

    def test_supplier_with_movements_cannot_be_deleted(self):
        supplier_id = self.create_supplier().json()["id"]
        self.movement("estoque", supplier_id=supplier_id)
        self.assertEqual(self.client.delete(f"/suppliers/{supplier_id}", headers=self.headers("admin")).status_code, 409)
        self.assertEqual(len(self.client.get("/suppliers", headers=self.headers("admin")).json()), 1)

    def test_database_refuses_a_supplier_on_an_exit(self):
        with Session(self.engine) as db:
            supplier = Supplier(name="Editora Alfa")
            db.add(supplier)
            db.commit()
            db.add(StockMovement(book_id=1, user_id=1, type="saida", quantity=1, reason="Venda", supplier_id=supplier.id))
            with self.assertRaises(IntegrityError):
                db.commit()


if __name__ == "__main__":
    unittest.main()
