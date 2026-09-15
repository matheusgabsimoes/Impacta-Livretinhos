from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, User
from app.routes.auth import get_current_user
from app.schemas import BookCreate, BookRead

router = APIRouter(prefix="/books", tags=["books"])


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_book(
    book_data: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Book:
    book = Book(**book_data.model_dump())
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.get("", response_model=list[BookRead])
def list_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Book]:
    return list(db.scalars(select(Book).order_by(Book.id)))
