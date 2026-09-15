from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BookCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    theme: str = Field(min_length=2, max_length=120)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    quantity: int = Field(ge=0)


class BookRead(BaseModel):
    id: int
    title: str
    theme: str
    price: Decimal
    quantity: int
    created_at: datetime

    model_config = {"from_attributes": True}
