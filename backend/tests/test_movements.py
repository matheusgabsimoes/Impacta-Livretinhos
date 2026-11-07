import unittest

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Book, StockMovement, User
from app.routes.auth import require_roles
from app.routes.books import delete_book, update_book
from app.routes.movements import create_movement, list_movements
from app.routes.users import delete_user, update_user
from app.schemas import BookUpdate, MovementCreate, UserUpdate


class MovementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.admin = User(name="Admin", email="admin@example.org", hashed_password="x", role="admin")
        self.stock = User(name="Estoque", email="stock@example.org", hashed_password="x", role="estoque")
        self.cashier = User(name="Caixa", email="cashier@example.org", hashed_password="x", role="caixa")
        self.attendant = User(name="Atendente", email="attendant@example.org", hashed_password="x", role="atendente")
        self.book = Book(title="Livro", author="Autor", theme="Tema", price=10, quantity=5)
        self.db.add_all([self.admin, self.stock, self.cashier, self.attendant, self.book])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_permissions_and_movements(self):
        for role in [self.stock, self.cashier, self.attendant]:
            with self.subTest(role=role.role), self.assertRaises(HTTPException) as error:
                require_roles("admin")(role)
            self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(require_roles("admin")(self.admin), self.admin)
        entry = MovementCreate(book_id=self.book.id, type="entrada", quantity=3, reason="Compra")
        exit_ = MovementCreate(book_id=self.book.id, type="saida", quantity=2, reason="Venda")
        self.assertEqual(create_movement(entry, self.db, self.stock).user_name, "Estoque")
        create_movement(exit_, self.db, self.cashier)
        self.assertEqual(self.book.quantity, 6)
        self.assertEqual(len(list_movements(self.db, self.admin)), 2)
        with self.assertRaises(HTTPException) as forbidden:
            create_movement(exit_, self.db, self.stock)
        self.assertEqual(forbidden.exception.status_code, 403)
        with self.assertRaises(HTTPException):
            create_movement(entry, self.db, self.cashier)
        with self.assertRaises(HTTPException) as insufficient:
            create_movement(MovementCreate(book_id=self.book.id, type="saida", quantity=7, reason="Venda"), self.db, self.cashier)
        self.assertEqual(insufficient.exception.status_code, 400)
        self.assertEqual(self.book.quantity, 6)
        self.assertEqual(len(list(self.db.scalars(select(StockMovement)))), 2)
        with self.assertRaises(ValidationError):
            MovementCreate(book_id=self.book.id, type="saida", quantity=0, reason="Venda")

    def test_history_and_last_admin_protected(self):
        create_movement(MovementCreate(book_id=self.book.id, type="entrada", quantity=1, reason="Compra"), self.db, self.stock)
        with self.assertRaises(HTTPException) as book_error:
            delete_book(self.book.id, self.db, self.admin)
        self.assertEqual(book_error.exception.status_code, 409)
        with self.assertRaises(HTTPException) as user_error:
            delete_user(self.stock.id, self.db, self.admin)
        self.assertEqual(user_error.exception.status_code, 409)
        with self.assertRaises(HTTPException):
            update_user(self.admin.id, UserUpdate(name="Admin", email=self.admin.email, role="atendente"), self.db, self.admin)
        updated = update_book(self.book.id, BookUpdate(title="Livro", author=None, theme="Tema", price=12), self.db, self.admin)
        self.assertEqual(updated.quantity, 6)


if __name__ == "__main__":
    unittest.main()
