"""Add suppliers and link them to stock entries."""
from alembic import op
import sqlalchemy as sa

revision = "202611210001"
down_revision = "202611070001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("cnpj", sa.String(14), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name", name="uq_suppliers_name"),
        sa.UniqueConstraint("cnpj", name="uq_suppliers_cnpj"),
    )
    op.add_column("stock_movements", sa.Column("supplier_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_stock_movements_supplier_id", "stock_movements", "suppliers", ["supplier_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_stock_movements_supplier_id", "stock_movements", ["supplier_id"])
    op.create_check_constraint(
        "ck_movement_supplier_entrada", "stock_movements", "supplier_id IS NULL OR type = 'entrada'"
    )


def downgrade():
    op.drop_constraint("ck_movement_supplier_entrada", "stock_movements", type_="check")
    op.drop_index("ix_stock_movements_supplier_id", table_name="stock_movements")
    op.drop_constraint("fk_stock_movements_supplier_id", "stock_movements", type_="foreignkey")
    op.drop_column("stock_movements", "supplier_id")
    op.drop_table("suppliers")
