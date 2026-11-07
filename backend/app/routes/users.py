from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database import get_db
from app.models import StockMovement, User
from app.routes.auth import get_user_by_email, require_roles
from app.schemas import AdminUserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> User:
    existing_user = get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email ja cadastrado")

    user = User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado")

    existing_user = get_user_by_email(db, user_data.email)
    if existing_user and existing_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email ja cadastrado")

    if user.role == "admin" and user_data.role is not None and user_data.role != "admin":
        admins = list(db.scalars(select(User).where(User.role == "admin").order_by(User.id).with_for_update()))
        if len(admins) <= 1:
            raise HTTPException(status_code=400, detail="Nao e possivel rebaixar o ultimo administrador")
    user.name = user_data.name
    user.email = user_data.email
    if user_data.role is not None:
        user.role = user_data.role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> Response:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao e possivel excluir sua propria conta")
    if user.role == "admin":
        admins = list(db.scalars(select(User).where(User.role == "admin").order_by(User.id).with_for_update()))
        if len(admins) <= 1:
            raise HTTPException(status_code=400, detail="Nao e possivel excluir o ultimo administrador")
    if db.scalar(select(StockMovement.id).where(StockMovement.user_id == user.id).limit(1)):
        raise HTTPException(status_code=409, detail="Usuario possui movimentacoes e nao pode ser excluido")

    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
