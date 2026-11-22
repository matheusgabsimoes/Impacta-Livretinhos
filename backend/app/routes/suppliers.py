from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StockMovement, Supplier, User
from app.routes.auth import require_roles
from app.schemas import SupplierRead, SupplierWrite

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def ensure_unique(db: Session, data: SupplierWrite, supplier_id: int | None = None) -> None:
    def taken(column, value) -> bool:
        query = select(Supplier.id).where(column == value)
        if supplier_id is not None:
            query = query.where(Supplier.id != supplier_id)
        return db.scalar(query.limit(1)) is not None

    if taken(Supplier.name, data.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fornecedor ja cadastrado com este nome")
    if data.cnpj is not None and taken(Supplier.cnpj, data.cnpj):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CNPJ ja cadastrado")


@router.get("", response_model=list[SupplierRead])
def list_suppliers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "estoque")),
) -> list[Supplier]:
    return list(db.scalars(select(Supplier).order_by(Supplier.name)))


@router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> Supplier:
    ensure_unique(db, data)
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=SupplierRead)
def update_supplier(
    supplier_id: int,
    data: SupplierWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> Supplier:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fornecedor nao encontrado")

    ensure_unique(db, data, supplier_id)
    for field, value in data.model_dump().items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> Response:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fornecedor nao encontrado")
    if db.scalar(select(StockMovement.id).where(StockMovement.supplier_id == supplier.id).limit(1)):
        raise HTTPException(status_code=409, detail="Fornecedor possui movimentacoes e nao pode ser excluido")

    db.delete(supplier)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
