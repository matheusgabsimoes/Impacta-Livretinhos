from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, StockMovement, User
from app.routes.auth import require_roles
from app.schemas import MovementCreate, MovementRead

router = APIRouter(prefix="/movements", tags=["movements"])


def movement_rows(db: Session, limit: int | None = None):
    query = (select(StockMovement, Book.title, User.name)
             .join(Book, StockMovement.book_id == Book.id)
             .join(User, StockMovement.user_id == User.id)
             .order_by(StockMovement.created_at.desc(), StockMovement.id.desc()))
    if limit is not None:
        query = query.limit(limit)
    return [MovementRead(id=m.id, book_id=m.book_id, book_title=title, user_id=m.user_id,
                         user_name=name, type=m.type, quantity=m.quantity, reason=m.reason,
                         created_at=m.created_at) for m, title, name in db.execute(query)]


@router.get("", response_model=list[MovementRead])
def list_movements(db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    return movement_rows(db)


@router.post("", response_model=MovementRead, status_code=201)
def create_movement(data: MovementCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles("admin", "estoque", "caixa"))):
    if current_user.role == "estoque" and data.type != "entrada" or current_user.role == "caixa" and data.type != "saida":
        raise HTTPException(status_code=403, detail="Perfil nao autorizado para esta movimentacao")
    book = db.scalar(select(Book).where(Book.id == data.book_id).with_for_update())
    if book is None:
        raise HTTPException(status_code=404, detail="Livro nao encontrado")
    if data.type == "saida" and book.quantity < data.quantity:
        raise HTTPException(status_code=400, detail="Estoque insuficiente")
    book.quantity += data.quantity if data.type == "entrada" else -data.quantity
    movement = StockMovement(**data.model_dump(), user_id=current_user.id)
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return MovementRead(id=movement.id, book_id=book.id, book_title=book.title, user_id=current_user.id,
                        user_name=current_user.name, type=movement.type, quantity=movement.quantity,
                        reason=movement.reason, created_at=movement.created_at)
