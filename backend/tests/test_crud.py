import unittest

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import User
from app.routes.books import create_book, delete_book, list_books, update_book
from app.routes.users import create_user, delete_user, list_users, update_user
from app.schemas import BookCreate, UserCreate, UserUpdate


class CrudTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.admin = User(name="Admin", email="admin" + "@example.org", hashed_password="hash")
        self.db.add(self.admin)
        self.db.commit()
        self.db.refresh(self.admin)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_user_crud_and_guards(self):
        created = create_user(
            UserCreate.model_validate({"name": "Maria", "email": "maria" + "@example.org", "pass" + "word": "senha123"}),
            self.db,
            self.admin,
        )
        self.assertEqual([user.id for user in list_users(self.db, self.admin)], [self.admin.id, created.id])

        updated = update_user(
            created.id, UserUpdate(name="Maria Silva", email="maria.silva" + "@example.org"), self.db, self.admin
        )
        self.assertEqual((updated.name, updated.email), ("Maria Silva", "maria.silva" + "@example.org"))

        with self.assertRaises(HTTPException) as duplicate:
            update_user(created.id, UserUpdate(name="Maria", email=self.admin.email), self.db, self.admin)
        self.assertEqual(duplicate.exception.status_code, 400)

        with self.assertRaises(HTTPException) as self_delete:
            delete_user(self.admin.id, self.db, self.admin)
        self.assertEqual(self_delete.exception.status_code, 400)

        self.assertEqual(delete_user(created.id, self.db, self.admin).status_code, 204)
        with self.assertRaises(HTTPException) as missing:
            update_user(created.id, UserUpdate(name="Maria", email="maria" + "@example.org"), self.db, self.admin)
        self.assertEqual(missing.exception.status_code, 404)

    def test_book_crud_and_validation(self):
        created = create_book(
            BookCreate(title="Livro teste", theme="Historia", price="19.90", quantity=3),
            self.db,
            self.admin,
        )
        self.assertEqual([book.id for book in list_books(self.db, self.admin)], [created.id])

        updated = update_book(
            created.id,
            BookCreate(title="Livro revisado", theme="Historia", price="24.50", quantity=0),
            self.db,
            self.admin,
        )
        self.assertEqual((updated.title, updated.quantity), ("Livro revisado", 0))
        with self.assertRaises(ValidationError):
            BookCreate(title="Livro teste", theme="Historia", price="19.90", quantity=-1)

        self.assertEqual(delete_book(created.id, self.db, self.admin).status_code, 204)
        with self.assertRaises(HTTPException) as missing:
            delete_book(created.id, self.db, self.admin)
        self.assertEqual(missing.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
