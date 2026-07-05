# Supabase Database Update Guide

## Quick Start

Your Supabase database needs to be updated to match the backend. Follow these steps:

### Option 1: Using Supabase SQL Editor (Easiest)

1. **Go to your Supabase project** → SQL Editor
2. **Click "New Query"**
3. **Copy-paste the queries below** (execute one at a time or together)
4. **Run each query**
5. **Verify with the verification queries at the end**

---

## Step-by-Step SQL Queries for Supabase

### 1️⃣ Drop Old Tables (Clean Start)

```sql
-- Keep legacy asset_codes if it exists.
-- Copy old asset_codes -> asset_coding before cleanup.

-- Check if asset_inv has correct schema, if not drop it
-- (Only if you're starting fresh - this will DELETE DATA)
-- DROP TABLE IF EXISTS asset_inv CASCADE;
```

### 2️⃣ Create asset_inv Table (Main Inventory)

```sql
CREATE TABLE IF NOT EXISTS asset_inv (
    id BIGSERIAL PRIMARY KEY,
    item_description TEXT NOT NULL,
    type VARCHAR(100),
    serial_no VARCHAR(150) UNIQUE,
    department VARCHAR(100),
    space VARCHAR(100),
    date_purchase DATE,
    vendor VARCHAR(150),
    purchase_price_per_item NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    asset_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    asset_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    warranty_date DATE,
    color VARCHAR(50),
    remarks TEXT,
    location VARCHAR(50) NOT NULL CHECK (location IN ('office', 'payout', 'drawcourt', 'obs', 'staffhouse', 'vehicle')),
    payout_station_id INTEGER REFERENCES payout_stations(id) ON DELETE SET NULL,
    office_department_id INTEGER REFERENCES office_departments(id) ON DELETE SET NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3️⃣ Create Indexes on asset_inv

```sql
CREATE INDEX IF NOT EXISTS idx_asset_inv_location ON asset_inv(location);
CREATE INDEX IF NOT EXISTS idx_asset_inv_serial_no ON asset_inv(serial_no);
CREATE INDEX IF NOT EXISTS idx_asset_inv_created_at ON asset_inv(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_inv_created_by ON asset_inv(created_by);
```

### 4️⃣ Create Trigger for Auto-Update Timestamp

```sql
CREATE OR REPLACE FUNCTION update_asset_inv_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_asset_inv_updated_at_trigger ON asset_inv;

CREATE TRIGGER update_asset_inv_updated_at_trigger
BEFORE UPDATE ON asset_inv
FOR EACH ROW
EXECUTE FUNCTION update_asset_inv_updated_at();
```

### 5️⃣ Create asset_coding Table (QR Code Registry)

```sql
CREATE TABLE IF NOT EXISTS asset_coding (
    id BIGSERIAL PRIMARY KEY,
    item_code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    type VARCHAR(100),
    department VARCHAR(100),
    care_of VARCHAR(100),
    space VARCHAR(100),
    qr_payload VARCHAR(255) NOT NULL UNIQUE,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6️⃣ Create Indexes on asset_coding

```sql
CREATE INDEX IF NOT EXISTS idx_asset_coding_item_code ON asset_coding(item_code);
CREATE INDEX IF NOT EXISTS idx_asset_coding_qr_payload ON asset_coding(qr_payload);
CREATE INDEX IF NOT EXISTS idx_asset_coding_asset_id ON asset_coding(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_coding_created_at ON asset_coding(created_at DESC);
```

### 7️⃣ Create Trigger for asset_coding Auto-Update

```sql
DROP TRIGGER IF EXISTS update_asset_coding_updated_at_trigger ON asset_coding;

CREATE TRIGGER update_asset_coding_updated_at_trigger
BEFORE UPDATE ON asset_coding
FOR EACH ROW
EXECUTE FUNCTION update_asset_inv_updated_at();
```

### 8️⃣ (OPTIONAL) Create Summary Tables

These are only needed if you want to maintain location-based summaries. **Not required for sync to work.**

```sql
-- Main Office Summary
CREATE TABLE IF NOT EXISTS sum_mainoffice (
    id BIGSERIAL PRIMARY KEY,
    reception INTEGER DEFAULT 0,
    ops_admin INTEGER DEFAULT 0,
    accounting INTEGER DEFAULT 0,
    it INTEGER DEFAULT 0,
    conference INTEGER DEFAULT 0,
    showroom INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payout Station Summary
CREATE TABLE IF NOT EXISTS sum_pstation (
    id BIGSERIAL PRIMARY KEY,
    cdo INTEGER DEFAULT 0,
    west INTEGER DEFAULT 0,
    east INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle Summary
CREATE TABLE IF NOT EXISTS sum_vehicle (
    id BIGSERIAL PRIMARY KEY,
    vehicle_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff House Summary
CREATE TABLE IF NOT EXISTS sum_staffhouse (
    id BIGSERIAL PRIMARY KEY,
    staffhouse_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PCSO Summary
CREATE TABLE IF NOT EXISTS sum_pcso (
    id BIGSERIAL PRIMARY KEY,
    pcso_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drawcourt Summary
CREATE TABLE IF NOT EXISTS sum_drawcourt (
    id BIGSERIAL PRIMARY KEY,
    drawcourt_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Summary Report (Aggregated)
CREATE TABLE IF NOT EXISTS summary_report (
    id BIGSERIAL PRIMARY KEY,
    report_date DATE DEFAULT CURRENT_DATE,
    vehicle_count INTEGER DEFAULT 0,
    pcso_count INTEGER DEFAULT 0,
    mainoffice_count INTEGER DEFAULT 0,
    pstation_count INTEGER DEFAULT 0,
    staffhouse_count INTEGER DEFAULT 0,
    drawcourt_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## ✅ Verification Queries

Run these **after** all migrations to verify everything is correct:

```sql
-- 1. Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('asset_inv', 'asset_coding', 'sum_mainoffice', 'sum_pstation', 'sum_vehicle', 'sum_staffhouse', 'sum_pcso', 'sum_drawcourt')
ORDER BY table_name;

-- 2. Count records in each table
SELECT 'asset_inv' as table_name, COUNT(*) as record_count FROM asset_inv
UNION ALL
SELECT 'asset_coding', COUNT(*) FROM asset_coding
UNION ALL
SELECT 'sum_mainoffice', COUNT(*) FROM sum_mainoffice
UNION ALL
SELECT 'sum_pstation', COUNT(*) FROM sum_pstation
UNION ALL
SELECT 'sum_vehicle', COUNT(*) FROM sum_vehicle
UNION ALL
SELECT 'sum_staffhouse', COUNT(*) FROM sum_staffhouse
UNION ALL
SELECT 'sum_pcso', COUNT(*) FROM sum_pcso
UNION ALL
SELECT 'sum_drawcourt', COUNT(*) FROM sum_drawcourt;

-- 3. Check indexes on asset_inv
SELECT indexname
FROM pg_indexes
WHERE tablename = 'asset_inv'
ORDER BY indexname;

-- 4. Check indexes on asset_coding
SELECT indexname
FROM pg_indexes
WHERE tablename = 'asset_coding'
ORDER BY indexname;

-- 5. Check triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('asset_inv', 'asset_coding')
ORDER BY event_object_table, trigger_name;

-- 6. Check foreign key relationships
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name IN ('asset_inv', 'asset_coding')
ORDER BY table_name, constraint_name;
```

---

## 🚀 How to Run in Supabase

### Method 1: One Big Query (Fastest)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Open `SUPABASE_MIGRATION.sql` from the repo (or copy-paste all queries)
4. Click **"Run"** button
5. Watch for any errors

### Method 2: Step by Step (Safer)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run queries in order: `1️⃣ → 2️⃣ → 3️⃣ → ... → 8️⃣`
3. Check for errors after each query
4. Verify with verification queries above

### Method 3: Using psql (Command Line)

```bash
# Connect to your database
psql $DATABASE_URL

# Run the migration file
\i SUPABASE_MIGRATION.sql

# Verify
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'asset%';
```

---

## ⚠️ Common Issues & Fixes

| Issue                     | Cause                          | Fix                                                                        |
| ------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| "Table already exists"    | Table was already created      | Use `CREATE TABLE IF NOT EXISTS` (included in queries)                     |
| "FK constraint violation" | Referenced table doesn't exist | Ensure `payout_stations`, `office_departments`, `users` tables exist first |
| "Column already exists"   | Column was added previously    | Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`                             |
| "Trigger already exists"  | Trigger was created before     | Use `DROP TRIGGER IF EXISTS` then recreate                                 |

---

## 📋 Database Structure After Migration

```
asset_inv (Master Inventory)
├── id (BIGSERIAL PK)
├── item_description (TEXT)
├── location (VARCHAR - office/payout/drawcourt/obs/staffhouse/vehicle)
├── serial_no (VARCHAR UNIQUE)
├── quantity (INTEGER)
├── purchase_price_per_item (NUMERIC)
├── discount (NUMERIC)
├── asset_value (NUMERIC)
├── asset_total (NUMERIC)
├── created_by (BIGINT FK → users)
├── assigned_to (BIGINT FK → users)
├── payout_station_id (INTEGER FK → payout_stations)
├── office_department_id (INTEGER FK → office_departments)
└── [other fields...]

    ↓ One-to-Many Relationship ↓

asset_coding (QR Registry)
├── id (BIGSERIAL PK)
├── item_code (VARCHAR UNIQUE)
├── description (TEXT)
├── asset_id (BIGINT FK → asset_inv)
└── [other fields...]

    ↓ Optional: One-to-Many Relationships ↓

sum_mainoffice, sum_pstation, sum_vehicle,
sum_staffhouse, sum_pcso, sum_drawcourt
└── Each has asset_id (BIGINT FK → asset_inv)
```

---

## ✨ Next Steps

1. **Run the SQL queries above** in your Supabase SQL Editor
2. **Run the verification queries** to confirm everything created
3. **Start your backend server** - it will automatically work with new schema
4. **Test the GSheet sync** - POST to `/api/assets/sync-google-sheets`
5. **Verify frontend** - asset inventory should display correctly

All done! 🎉
