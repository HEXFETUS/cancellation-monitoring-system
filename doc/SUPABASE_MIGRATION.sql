-- ============================================================
-- SUPABASE DATABASE MIGRATION SCRIPT
-- Aligns Supabase schema with current backend implementation
-- Date: 2026-06-04
-- ============================================================

-- Step 1: Keep legacy tables if they exist.
-- Data is copied from assets -> asset_inv and asset_codes -> asset_coding below.

-- Step 2: Create/Replace asset_inv table (master inventory)
-- This is the main table for all asset inventory
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
) TABLESPACE pg_default;

-- Create indexes for asset_inv
CREATE INDEX IF NOT EXISTS idx_asset_inv_location ON asset_inv(location);
CREATE INDEX IF NOT EXISTS idx_asset_inv_serial_no ON asset_inv(serial_no);
CREATE INDEX IF NOT EXISTS idx_asset_inv_created_at ON asset_inv(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_inv_created_by ON asset_inv(created_by);

-- Backfill from the legacy assets table when it exists.
DO $$
BEGIN
    IF to_regclass('public.assets') IS NOT NULL THEN
        INSERT INTO asset_inv (
            id, location, item_description, type, serial_no, department, space,
            date_purchase, vendor, purchase_price_per_item, warranty_date, quantity,
            discount, asset_value, asset_total, color, remarks, payout_station_id,
            office_department_id, created_at, updated_at
        )
        SELECT
            id,
            location,
            item_description,
            type,
            serial_number,
            department,
            space,
            date_purchase,
            vendor,
            COALESCE(purchase_price, 0),
            warranty_date,
            COALESCE(quantity, 1),
            COALESCE(discount, 0),
            COALESCE(asset_value, 0),
            COALESCE(total_value, 0),
            color,
            remarks,
            payout_station_id,
            office_department_id,
            created_at,
            updated_at
        FROM assets
        ON CONFLICT (id) DO UPDATE
        SET location = EXCLUDED.location,
            item_description = EXCLUDED.item_description,
            type = EXCLUDED.type,
            serial_no = EXCLUDED.serial_no,
            department = EXCLUDED.department,
            space = EXCLUDED.space,
            date_purchase = EXCLUDED.date_purchase,
            vendor = EXCLUDED.vendor,
            purchase_price_per_item = EXCLUDED.purchase_price_per_item,
            warranty_date = EXCLUDED.warranty_date,
            quantity = EXCLUDED.quantity,
            discount = EXCLUDED.discount,
            asset_value = EXCLUDED.asset_value,
            asset_total = EXCLUDED.asset_total,
            color = EXCLUDED.color,
            remarks = EXCLUDED.remarks,
            payout_station_id = EXCLUDED.payout_station_id,
            office_department_id = EXCLUDED.office_department_id,
            updated_at = EXCLUDED.updated_at;
    END IF;
END $$;

SELECT setval(
    pg_get_serial_sequence('asset_inv', 'id'),
    COALESCE((SELECT MAX(id) FROM asset_inv), 0) + 1,
    false
);

-- Step 3: Create trigger to auto-update updated_at on asset_inv
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

-- Step 4: Create asset_coding table (QR code registry)
-- Links to asset_inv for asset identification
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
) TABLESPACE pg_default;

-- Create indexes for asset_coding
CREATE INDEX IF NOT EXISTS idx_asset_coding_item_code ON asset_coding(item_code);
CREATE INDEX IF NOT EXISTS idx_asset_coding_qr_payload ON asset_coding(qr_payload);
CREATE INDEX IF NOT EXISTS idx_asset_coding_asset_id ON asset_coding(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_coding_created_at ON asset_coding(created_at DESC);

-- Backfill from the legacy asset_codes table when it exists.
DO $$
BEGIN
    IF to_regclass('public.asset_codes') IS NOT NULL THEN
        INSERT INTO asset_coding (
            id, item_code, description, type, department, care_of, space,
            qr_payload, asset_id, created_at, updated_at
        )
        SELECT
            id,
            item_code,
            description,
            type,
            department,
            care_of,
            space,
            COALESCE(
                qr_payload,
                'ASSET-' || regexp_replace(upper(COALESCE(item_code, 'ITEM')), '[^A-Z0-9-]', '', 'g') || '-' || lpad(id::text, 8, '0')
            ),
            asset_id,
            created_at,
            updated_at
        FROM asset_codes
        ON CONFLICT (item_code) DO UPDATE
        SET description = EXCLUDED.description,
            type = EXCLUDED.type,
            department = EXCLUDED.department,
            care_of = EXCLUDED.care_of,
            space = EXCLUDED.space,
            qr_payload = EXCLUDED.qr_payload,
            asset_id = EXCLUDED.asset_id,
            updated_at = EXCLUDED.updated_at;
    END IF;
END $$;

SELECT setval(
    pg_get_serial_sequence('asset_coding', 'id'),
    COALESCE((SELECT MAX(id) FROM asset_coding), 0) + 1,
    false
);

-- Step 5: Create trigger to auto-update updated_at on asset_coding
DROP TRIGGER IF EXISTS update_asset_coding_updated_at_trigger ON asset_coding;
CREATE TRIGGER update_asset_coding_updated_at_trigger
BEFORE UPDATE ON asset_coding
FOR EACH ROW
EXECUTE FUNCTION update_asset_inv_updated_at();

-- Step 6: Create asset_media table (photos/videos attached to assets)
CREATE TABLE IF NOT EXISTS asset_media (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES asset_inv(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    mime_type VARCHAR(100),
    uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_asset_media_asset ON asset_media(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_media_created_at ON asset_media(created_at DESC);

-- ============================================================
-- OPTIONAL: Summary Tables (for reporting/analytics)
-- These are optional and not required for sync to work
-- ============================================================

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
) TABLESPACE pg_default;

-- Payout Station Summary
CREATE TABLE IF NOT EXISTS sum_pstation (
    id BIGSERIAL PRIMARY KEY,
    cdo INTEGER DEFAULT 0,
    west INTEGER DEFAULT 0,
    east INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE pg_default;

-- Vehicle Summary
CREATE TABLE IF NOT EXISTS sum_vehicle (
    id BIGSERIAL PRIMARY KEY,
    vehicle_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE pg_default;

-- Staff House Summary
CREATE TABLE IF NOT EXISTS sum_staffhouse (
    id BIGSERIAL PRIMARY KEY,
    staffhouse_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE pg_default;

-- PCSO Summary
CREATE TABLE IF NOT EXISTS sum_pcso (
    id BIGSERIAL PRIMARY KEY,
    pcso_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE pg_default;

-- Drawcourt Summary
CREATE TABLE IF NOT EXISTS sum_drawcourt (
    id BIGSERIAL PRIMARY KEY,
    drawcourt_count INTEGER DEFAULT 0,
    asset_id BIGINT REFERENCES asset_inv(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE pg_default;

-- Summary Report (aggregated)
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
) TABLESPACE pg_default;

-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify tables created
-- SELECT * FROM information_schema.tables WHERE table_name IN ('asset_inv', 'asset_coding', 'sum_mainoffice', 'sum_pstation', 'sum_vehicle', 'sum_staffhouse', 'sum_pcso', 'sum_drawcourt', 'summary_report');

-- Count records
-- SELECT 'asset_inv' as table_name, COUNT(*) as record_count FROM asset_inv
-- UNION ALL
-- SELECT 'asset_coding', COUNT(*) FROM asset_coding;

-- Check indexes
-- SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename IN ('asset_inv', 'asset_coding');

-- Check triggers
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_table IN ('asset_inv', 'asset_coding');
