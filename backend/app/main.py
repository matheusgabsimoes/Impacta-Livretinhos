from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.auth import router as auth_router
from app.routes.books import router as books_router
from app.routes.users import router as users_router
from app.routes.movements import router as movements_router
from app.routes.movements import movement_rows
from app.database import get_db
from app.models import Book, User
from app.routes.auth import get_current_user
from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

app = FastAPI(title="Admin Livraria API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(books_router)
app.include_router(movements_router)


@app.get("/summary")
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total, quantity = db.execute(select(func.count(Book.id), func.coalesce(func.sum(Book.quantity), 0))).one()
    low_stock = db.scalar(select(func.count(Book.id)).where(Book.quantity <= 5))
    return {"titles": total, "quantity": quantity, "low_stock": low_stock,
            "recent_movements": movement_rows(db, 5) if current_user.role == "admin" else []}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
