"""
backend/sync_inventory_columns.py
Dynamically inspects models.InventoryItem and adds all missing columns
to the SQLite/PostgreSQL table automatically.
"""

from sqlalchemy import inspect, text, Boolean, Integer, Float, DateTime, Text, String
from app.database import engine
from app import models


def sync_inventory_columns():
    print("=" * 65)
    print("AUTOMATIC DYNAMIC SCHEMA SYNC: inventory_items")
    print("=" * 65)

    # 1. Create any missing tables first
    models.Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    if "inventory_items" not in existing_tables:
        print("Table 'inventory_items' does not exist yet. It was created by create_all.")
        return

    # 2. Get columns physically in the SQLite database
    db_columns = {col["name"] for col in inspector.get_columns("inventory_items")}
    print(f"Existing columns in SQLite table: {len(db_columns)}")

    # 3. Get all columns declared on the SQLAlchemy Model class
    model_mapper = inspect(models.InventoryItem)
    model_columns = model_mapper.columns

    added_count = 0
    with engine.connect() as conn:
        for col in model_columns:
            if col.name not in db_columns:
                # Map python/sqlalchemy type to generic SQL type definition
                col_type = col.type
                type_str = "TEXT"
                default_clause = ""

                if isinstance(col_type, Integer):
                    type_str = "INTEGER"
                elif isinstance(col_type, Float):
                    type_str = "FLOAT DEFAULT 0.0"
                elif isinstance(col_type, Boolean):
                    type_str = "BOOLEAN DEFAULT 1"
                elif isinstance(col_type, DateTime):
                    type_str = "DATETIME"
                elif isinstance(col_type, String):
                    length = col_type.length or 255
                    type_str = f"VARCHAR({length})"

                alter_stmt = f"ALTER TABLE inventory_items ADD COLUMN {col.name} {type_str};"
                try:
                    conn.execute(text(alter_stmt))
                    conn.commit()
                    print(f"  + Added missing column: inventory_items.{col.name} ({type_str})")
                    added_count += 1
                except Exception as e:
                    print(f"  ! Error adding {col.name}: {e}")

    print(f"\nCompleted! Added {added_count} missing column(s).")
    print("=" * 65)


if __name__ == "__main__":
    sync_inventory_columns()