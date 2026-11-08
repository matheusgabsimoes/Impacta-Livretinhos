from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["admin", "estoque", "caixa", "atendente"]


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: Role
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: Role | None = None


class AdminUserCreate(UserCreate):
    role: Role = "atendente"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BookUpdate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    author: str | None = Field(default=None, max_length=160)
    theme: str = Field(min_length=2, max_length=120)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)


class BookCreate(BookUpdate):
    quantity: int = Field(ge=0)


class BookRead(BaseModel):
    id: int
    title: str
    author: str | None
    theme: str
    price: Decimal
    quantity: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MovementCreate(BaseModel):
    book_id: int
    type: Literal["entrada", "saida"]
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=1, max_length=255, pattern=r".*\S.*")


class MovementRead(BaseModel):
    id: int
    book_id: int
    book_title: str
    user_id: int
    user_name: str
    type: Literal["entrada", "saida"]
    quantity: int
    reason: str
    created_at: datetime
