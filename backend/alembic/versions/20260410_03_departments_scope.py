"""add departments and department scoping

Revision ID: 20260410_03
Revises: 20260410_02
Create Date: 2026-04-10 17:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260410_03"
down_revision: Union[str, None] = "20260410_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    table_names = set(inspector.get_table_names())

    if "departments" not in table_names:
        op.create_table(
            "departments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name", name="uq_departments_name"),
        )

    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "user_departments" not in table_names:
        op.create_table(
            "user_departments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("department_id", sa.Integer(), nullable=False),
            sa.Column("granted_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["granted_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "department_id", name="uq_user_departments_user_department"),
        )

    indexes = {idx["name"] for idx in inspector.get_indexes("user_departments")} if "user_departments" in table_names else set()
    if "ix_user_departments_user_id" not in indexes:
        op.create_index("ix_user_departments_user_id", "user_departments", ["user_id"], unique=False)
    if "ix_user_departments_department_id" not in indexes:
        op.create_index("ix_user_departments_department_id", "user_departments", ["department_id"], unique=False)

    user_columns = {c["name"] for c in inspector.get_columns("users")}
    if "active_department_id" not in user_columns:
        op.add_column("users", sa.Column("active_department_id", sa.Integer(), nullable=True))
    user_fks = {fk["name"] for fk in inspector.get_foreign_keys("users")}
    if "fk_users_active_department_id" not in user_fks:
        op.create_foreign_key("fk_users_active_department_id", "users", "departments", ["active_department_id"], ["id"])
    user_indexes = {idx["name"] for idx in inspector.get_indexes("users")}
    if "ix_users_active_department_id" not in user_indexes:
        op.create_index("ix_users_active_department_id", "users", ["active_department_id"], unique=False)

    deal_columns = {c["name"] for c in inspector.get_columns("deals")}
    if "department_id" not in deal_columns:
        op.add_column("deals", sa.Column("department_id", sa.Integer(), nullable=True))
    deal_fks = {fk["name"] for fk in inspector.get_foreign_keys("deals")}
    if "fk_deals_department_id" not in deal_fks:
        op.create_foreign_key("fk_deals_department_id", "deals", "departments", ["department_id"], ["id"])
    deal_indexes = {idx["name"] for idx in inspector.get_indexes("deals")}
    if "ix_deals_department_id" not in deal_indexes:
        op.create_index("ix_deals_department_id", "deals", ["department_id"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO departments (name, is_active, created_at)
            SELECT 'General', true, now()
            WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'General')
            """
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO user_departments (user_id, department_id, granted_by, created_at)
            SELECT u.id, d.id, NULL, now()
            FROM users u
            JOIN departments d ON d.name = 'General'
            WHERE NOT EXISTS (
                SELECT 1
                FROM user_departments ud
                WHERE ud.user_id = u.id AND ud.department_id = d.id
            )
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE users u
            SET active_department_id = ud.department_id
            FROM user_departments ud
            WHERE ud.user_id = u.id
              AND u.active_department_id IS NULL
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE deals de
            SET department_id = u.active_department_id
            FROM users u
            WHERE de.owner_id = u.id
              AND de.department_id IS NULL
            """
        )
    )

    op.alter_column("deals", "department_id", nullable=False)


def downgrade() -> None:
    op.drop_index("ix_deals_department_id", table_name="deals")
    op.drop_constraint("fk_deals_department_id", "deals", type_="foreignkey")
    op.drop_column("deals", "department_id")

    op.drop_index("ix_users_active_department_id", table_name="users")
    op.drop_constraint("fk_users_active_department_id", "users", type_="foreignkey")
    op.drop_column("users", "active_department_id")

    op.drop_index("ix_user_departments_department_id", table_name="user_departments")
    op.drop_index("ix_user_departments_user_id", table_name="user_departments")
    op.drop_table("user_departments")
    op.drop_table("departments")
