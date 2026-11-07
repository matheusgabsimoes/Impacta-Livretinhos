"""Add book authors, user roles and stock movements."""
from alembic import op
import sqlalchemy as sa

revision = "202611070001"
down_revision = "202609140001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("books", sa.Column("author", sa.String(160), nullable=True))
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="atendente"))
    op.create_check_constraint("ck_user_role", "users", "role IN ('admin', 'estoque', 'caixa', 'atendente')")
    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_movement_quantity_positive"),
        sa.CheckConstraint("type IN ('entrada', 'saida')", name="ck_movement_type"),
    )
    op.create_index("ix_stock_movements_book_id", "stock_movements", ["book_id"])
    op.create_index("ix_stock_movements_user_id", "stock_movements", ["user_id"])


def downgrade():
    op.drop_table("stock_movements")
    op.drop_constraint("ck_user_role", "users", type_="check")
    op.drop_column("users", "role")
    op.drop_column("books", "author")
