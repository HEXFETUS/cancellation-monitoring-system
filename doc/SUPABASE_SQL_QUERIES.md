# Supabase SQL Queries

## Make asset_inv all columns nullable (except id)

Run this in the Supabase SQL Editor (https://supabase.com → SQL Editor):

```sql
-- Drop NOT NULL on item_description
ALTER TABLE asset_inv ALTER COLUMN item_description DROP NOT NULL;

-- Drop NOT NULL on location and its CHECK constraint
ALTER TABLE asset_inv ALTER COLUMN location DROP NOT NULL;
ALTER TABLE asset_inv DROP CONSTRAINT IF EXISTS asset_inv_location_check;
```

## Create asset_summary table (for editable itemized summary)

This table stores the itemized asset distribution data (previously only in the GSheet SUMMARY tab).

```sql
CREATE TABLE IF NOT EXISTS asset_summary (
    id SERIAL PRIMARY KEY,
    asset_name TEXT NOT NULL,
    main_office INTEGER NOT NULL DEFAULT 0,
    drawcourt INTEGER NOT NULL DEFAULT 0,
    pcso INTEGER NOT NULL DEFAULT 0,
    payout_station INTEGER NOT NULL DEFAULT 0,
    obs_office INTEGER NOT NULL DEFAULT 0,
    staffhouse INTEGER NOT NULL DEFAULT 0,
    vehicle INTEGER NOT NULL DEFAULT 0,
    total_items INTEGER GENERATED ALWAYS AS (
        main_office + drawcourt + pcso + payout_station + obs_office + staffhouse + vehicle
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_asset_summary_name ON asset_summary (asset_name);
```

## View: sum_asset_by_space (aggregates asset_inv by space/location)

```sql
CREATE OR REPLACE VIEW sum_asset_by_space AS
SELECT
    TRIM(COALESCE(space, 'UNASSIGNED/BLANK')) AS branch_location,
    COUNT(*) AS total_items,
    SUM(COALESCE(asset_value, 0)) AS total_asset_value,
    SUM(COALESCE(asset_total, 0)) AS running_grand_total
FROM asset_inv
GROUP BY TRIM(COALESCE(space, 'UNASSIGNED/BLANK'))
ORDER BY total_asset_value DESC;
```
