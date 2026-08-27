# File: backend/fix_salaries_db.py

import sqlite3

conn = sqlite3.connect("hotel_erp.db")
cursor = conn.cursor()

print("Upgrading 'staff_salaries' table to include 'updated_at'...")

try:
    cursor.execute("ALTER TABLE staff_salaries ADD COLUMN updated_at DATETIME;")
    print("✅ Successfully added 'updated_at' column to the 'staff_salaries' table!")
except sqlite3.OperationalError as e:
    print(f"⚠️ Notice: {e}") # Skips safely if it already exists

conn.commit()
conn.close()
print("\n🚀 Database migration complete! You can now process payroll.")