"""deal master data refinement

- Add 'M&E Contractor' customer type
- Migrate deals using 'qualified' CES stage to 'proposal' and remove the option
- Add parent_id to deal_product_system_types and seed the new product hierarchy

Revision ID: 20260505_01
Revises: 20260412_06
Create Date: 2026-05-05 09:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260505_01"
down_revision: Union[str, None] = "20260412_06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PRODUCT_HIERARCHY = [
    # (name, sort_order, parent_name)  - parent_name None means top-level / leaf
    ("Lighting Control", 10, None),
    ("Lighting Control - KNX", 11, "Lighting Control"),
    ("Lighting Control - C-bus", 12, "Lighting Control"),
    ("Lighting Control - Jung", 13, "Lighting Control"),
    ("RCU", 20, None),
    ("RCU - Smart", 21, "RCU"),
    ("RCU - RPC", 22, "RCU"),
    ("RCU - HRC", 23, "RCU"),
    ("Switch", 30, None),
    ("Switch - Jung", 31, "Switch"),
    ("Switch - Domotic", 32, "Switch"),
    ("Switch - SE", 33, "Switch"),
    ("Power", 40, None),
    ("Lighting Fixture", 50, None),
    ("Other", 60, None),
]

# Names that are used as group headers (not selectable in the deal form)
PARENT_GROUP_NAMES = {"Lighting Control", "RCU", "Switch"}


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Add parent_id column to deal_product_system_types
    op.add_column(
        "deal_product_system_types",
        sa.Column("parent_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_deal_product_system_types_parent",
        "deal_product_system_types",
        "deal_product_system_types",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_deal_product_system_types_parent_id",
        "deal_product_system_types",
        ["parent_id"],
    )

    # 2) Seed 'M&E Contractor' customer type if missing
    bind.execute(
        sa.text(
            """
            INSERT INTO deal_customer_types (name, sort_order, is_active, created_at, updated_at)
            SELECT :name, :sort_order, TRUE, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM deal_customer_types WHERE LOWER(name) = LOWER(:name)
            )
            """
        ),
        {"name": "M&E Contractor", "sort_order": 15},
    )

    # 3) Migrate deals 'qualified' -> 'proposal' and remove the stage option
    bind.execute(
        sa.text(
            "UPDATE deals SET deal_cycle_stage = 'proposal' WHERE deal_cycle_stage = 'qualified'"
        )
    )
    bind.execute(sa.text("DELETE FROM deal_ces_stage_options WHERE key = 'qualified'"))

    # 4) Refresh product/system types: deactivate old rows, then upsert the new hierarchy
    #    We do not delete existing rows because deal_product_system_links may reference them.
    bind.execute(sa.text("UPDATE deal_product_system_types SET is_active = FALSE"))

    name_to_id: dict[str, int] = {}

    for name, sort_order, parent_name in PRODUCT_HIERARCHY:
        parent_id = name_to_id.get(parent_name) if parent_name else None
        existing = bind.execute(
            sa.text(
                "SELECT id FROM deal_product_system_types WHERE LOWER(name) = LOWER(:name)"
            ),
            {"name": name},
        ).first()
        if existing:
            row_id = existing[0]
            bind.execute(
                sa.text(
                    """
                    UPDATE deal_product_system_types
                    SET sort_order = :sort_order,
                        is_active = TRUE,
                        parent_id = :parent_id,
                        updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"sort_order": sort_order, "parent_id": parent_id, "id": row_id},
            )
        else:
            insert_result = bind.execute(
                sa.text(
                    """
                    INSERT INTO deal_product_system_types
                        (name, sort_order, is_active, parent_id, created_at, updated_at)
                    VALUES (:name, :sort_order, TRUE, :parent_id, NOW(), NOW())
                    RETURNING id
                    """
                ),
                {"name": name, "sort_order": sort_order, "parent_id": parent_id},
            )
            row_id = insert_result.scalar_one()
        name_to_id[name] = row_id


def downgrade() -> None:
    bind = op.get_bind()

    # Restore qualified stage (idempotent)
    bind.execute(
        sa.text(
            """
            INSERT INTO deal_ces_stage_options (key, label, sort_order, is_active, created_at, updated_at)
            VALUES ('qualified', 'Qualified', 20, TRUE, NOW(), NOW())
            ON CONFLICT (key) DO NOTHING
            """
        )
    )

    op.drop_index(
        "ix_deal_product_system_types_parent_id",
        table_name="deal_product_system_types",
    )
    op.drop_constraint(
        "fk_deal_product_system_types_parent",
        "deal_product_system_types",
        type_="foreignkey",
    )
    op.drop_column("deal_product_system_types", "parent_id")
