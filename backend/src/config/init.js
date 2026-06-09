import pool from "./db.js";

const SERIAL_TABLES = [
    "users",
    "operator_list",
    "booth_info",
    "pos_records",
    "booth_change_logs",
    "pos_convert_histories",
    "area_logs",
    "status_logs",
    "user_logs",
    "cancellation_record",
    "cancellation_human_force",
    "asset_inv",
    "asset_coding",
    "payout_stations",
    "office_departments",
    "booth_change_requests",
    "operator_change_requests",
    "diagnosis_list",
    "repair_records",
    "diagnosis_logs",
    "billing_transmittals",
    "released_logs",
    "lottery_results",
    "announcements",
    "messages",
    "asset_media",
    "activity_logs",
];

async function syncSerialSequence(client, tableName) {
    if (!SERIAL_TABLES.includes(tableName)) {
        throw new Error(`Cannot sync unknown serial table: ${tableName}`);
    }

    await client.query(
        `
        SELECT setval(
            pg_get_serial_sequence($1, 'id'),
            COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1,
            false
        );
        `,
        [tableName]
    );
}

async function getTableColumns(client, tableName) {
    const result = await client.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        `,
        [tableName]
    );

    return new Set(result.rows.map((row) => row.column_name));
}

async function initDatabase() {
    const client = await pool.connect();

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                usertype VARCHAR(50) NOT NULL CHECK (usertype IN ('admin', 'csr', 'operator', 'purchaser')),
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add position and department columns if they don't exist
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(255) DEFAULT ''");
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255) DEFAULT ''");

        // Profile picture URL (relative path served from /uploads). NULL means
        // the UI falls back to the default avatar. Stored as a path string so
        // we keep the existing static-file machinery used by posts/announcements.
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500)");

        // Migrate the usertype CHECK constraint to include 'purchaser'.
        // We drop the old (auto-named) constraint if present and re-add with
        // the wider list. Idempotent — safe to run on fresh and existing DBs.
        await client.query(`
            DO $$
            DECLARE constraint_name TEXT;
            BEGIN
                SELECT con.conname INTO constraint_name
                FROM pg_constraint con
                JOIN pg_class tbl ON tbl.oid = con.conrelid
                WHERE tbl.relname = 'users'
                  AND con.contype = 'c'
                  AND pg_get_constraintdef(con.oid) ILIKE '%usertype%';

                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
                END IF;

                ALTER TABLE users ADD CONSTRAINT users_usertype_check
                    CHECK (usertype IN ('admin', 'csr', 'operator', 'purchaser'));
            END $$;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS operator_list (
                id SERIAL PRIMARY KEY,
                operator VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Link an operator profile to the user that signs in as them. NULL is
        // fine — back-office operators may exist without a login. ON DELETE
        // SET NULL preserves the operator history when a user is removed.
        await client.query(
            "ALTER TABLE operator_list ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        );
        await client.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_list_user_id ON operator_list(user_id) WHERE user_id IS NOT NULL"
        );

        // Hierarchy: an operator profile can have a parent (main → sub).
        // NULL parent = main operator. Sub operators reference the main's id.
        // ON DELETE SET NULL keeps sub-operators around if the main is removed
        // (audit-friendly; admins can re-parent later).
        await client.query(
            "ALTER TABLE operator_list ADD COLUMN IF NOT EXISTS parent_operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_operator_list_parent ON operator_list(parent_operator_id)"
        );

        await client.query(`
            CREATE TABLE IF NOT EXISTS booth_info (
                id SERIAL PRIMARY KEY,
                booth_code VARCHAR(100) NOT NULL,
                coordinate VARCHAR(255),
                location VARCHAR(255),
                operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_records (
                id SERIAL PRIMARY KEY,
                device_no VARCHAR(100) NOT NULL,
                serial_number VARCHAR(100) NOT NULL,
                area VARCHAR(255),
                status VARCHAR(100) DEFAULT 'Active',
                booth_id INTEGER REFERENCES booth_info(id) ON DELETE SET NULL,
                operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sticker BOOLEAN DEFAULT false
            );
        `);

        await client.query("ALTER TABLE pos_records ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100)");
        await client.query("ALTER TABLE pos_records ADD COLUMN IF NOT EXISTS booth_id INTEGER");
        await client.query("ALTER TABLE pos_records ADD COLUMN IF NOT EXISTS operator_id INTEGER");
        await client.query("ALTER TABLE pos_records ADD COLUMN IF NOT EXISTS sticker BOOLEAN DEFAULT false");

        /* =========================
           booth_change_logs
           The table was originally created with legacy columns (from_booth, to_booth, changed_at).
           We now use pos_record_id, old_booth_code, new_booth_code, changed_by, created_at.
           Migration steps keep it backward-compatible.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS booth_change_logs (
                id SERIAL PRIMARY KEY,
                pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE CASCADE,
                old_booth_code VARCHAR(255),
                new_booth_code VARCHAR(255),
                changed_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migrate: add new columns if they don't exist (safe for repeated runs)
        await client.query("ALTER TABLE booth_change_logs ADD COLUMN IF NOT EXISTS old_booth_code VARCHAR(255)");
        await client.query("ALTER TABLE booth_change_logs ADD COLUMN IF NOT EXISTS new_booth_code VARCHAR(255)");
        await client.query("ALTER TABLE booth_change_logs ADD COLUMN IF NOT EXISTS changed_by VARCHAR(255)");
        // created_at already exists as default, but we add it as an alias for changed_at if missing
        await client.query("ALTER TABLE booth_change_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        await client.query("ALTER TABLE booth_change_logs ALTER COLUMN pos_record_id DROP NOT NULL");
        // old_booth_code / new_booth_code must be NULL-able: a freshly activated
        // device has no old booth, and a device being kicked off its booth
        // (auto-displaced during an approval) has no new booth. Some legacy
        // databases created these columns as NOT NULL — relax the constraint
        // here so the approval flow can write audit rows for the displaced case.
        await client.query("ALTER TABLE booth_change_logs ALTER COLUMN old_booth_code DROP NOT NULL");
        await client.query("ALTER TABLE booth_change_logs ALTER COLUMN new_booth_code DROP NOT NULL");

        const boothChangeLogColumns = await getTableColumns(client, "booth_change_logs");

        if (boothChangeLogColumns.has("from_booth") && boothChangeLogColumns.has("to_booth")) {
            // Backfill old_booth_code / new_booth_code from legacy from_booth / to_booth.
            await client.query(`
                UPDATE booth_change_logs bcl
                SET old_booth_code = COALESCE(bcl.old_booth_code, bcl.from_booth),
                    new_booth_code = COALESCE(bcl.new_booth_code, bcl.to_booth)
                WHERE bcl.old_booth_code IS NULL OR bcl.new_booth_code IS NULL
            `);
        }

        if (boothChangeLogColumns.has("changed_at")) {
            // Backfill created_at from legacy changed_at.
            await client.query(`
                UPDATE booth_change_logs bcl
                SET created_at = COALESCE(bcl.created_at, bcl.changed_at)
                WHERE bcl.created_at IS NULL
            `);
        }

        /* =========================
           pos_convert_histories
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_convert_histories (
                id SERIAL PRIMARY KEY,
                device_no VARCHAR(100),
                serial_number VARCHAR(100),
                booth_code VARCHAR(100),
                from_area VARCHAR(255),
                to_area VARCHAR(255),
                converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           area_logs
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS area_logs (
                id SERIAL PRIMARY KEY,
                pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE CASCADE,
                legacy_device_number VARCHAR(100),
                previous_area VARCHAR(255),
                new_area VARCHAR(255),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           status_logs
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS status_logs (
                id SERIAL PRIMARY KEY,
                pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE CASCADE,
                old_status VARCHAR(255),
                new_status VARCHAR(255),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                login_at TIMESTAMP,
                logout_at TIMESTAMP,
                ip_address VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS cancellation_record (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                area VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cancelled_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                approved INTEGER DEFAULT 0,
                denied INTEGER DEFAULT 0
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS cancellation_human_force (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                area VARCHAR(255),
                reaseon_for_deny VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                booth_id INTEGER REFERENCES booth_info(id) ON DELETE SET NULL,
                ticket_number VARCHAR(255),
                reference_code VARCHAR(255),
                booth_code VARCHAR(255)
            );
        `);
        await client.query("ALTER TABLE cancellation_human_force ADD COLUMN IF NOT EXISTS reference_code VARCHAR(255)");
        await client.query("ALTER TABLE cancellation_human_force ADD COLUMN IF NOT EXISTS booth_code VARCHAR(255)");

        const userCount = await client.query("SELECT COUNT(*) FROM users");
        if (Number(userCount.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO users (name, email, usertype, password) VALUES
                ('Admin User', 'admin@example.com', 'admin', 'admin123'),
                ('CSR Agent', 'csr@example.com', 'csr', 'csr123'),
                ('Operator One', 'operator@example.com', 'operator', 'op123');
            `);
        }

        /* =========================
           asset_inv — Asset Inventory
           One row per physical asset record. The "location" column
           groups by section (office/payout/drawcourt/obs/staffhouse/vehicle)
           so the same table can power all the section pages.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_inv (
                id SERIAL PRIMARY KEY,
                location VARCHAR(50) CHECK (location IN ('office', 'payout', 'drawcourt', 'obs', 'staffhouse', 'vehicle')),
                item_description VARCHAR(255),
                type VARCHAR(100),
                serial_no VARCHAR(255),
                department VARCHAR(255),
                space VARCHAR(255),
                date_purchase DATE,
                vendor VARCHAR(255),
                purchase_price_per_item NUMERIC(14,2) DEFAULT 0,
                warranty_date DATE,
                quantity INTEGER DEFAULT 1,
                discount NUMERIC(14,2) DEFAULT 0,
                asset_value NUMERIC(14,2) DEFAULT 0,
                asset_total NUMERIC(14,2) DEFAULT 0,
                color VARCHAR(50),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_asset_inv_location ON asset_inv(location)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_asset_inv_serial_no ON asset_inv(serial_no)"
        );

        // Migrate existing asset_inv.location CHECK constraint to add the new
        // canonical values 'staffhouse' and 'vehicle'. Drops whatever check
        // constraint Postgres auto-named for the column and re-adds the
        // wider list. Idempotent — safe to run on fresh and existing DBs.
        await client.query(`
            DO $$
            DECLARE constraint_name TEXT;
            BEGIN
                SELECT con.conname INTO constraint_name
                FROM pg_constraint con
                JOIN pg_class tbl ON tbl.oid = con.conrelid
                WHERE tbl.relname = 'asset_inv'
                  AND con.contype = 'c'
                  AND pg_get_constraintdef(con.oid) ILIKE '%location%';

                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE asset_inv DROP CONSTRAINT %I', constraint_name);
                END IF;

                ALTER TABLE asset_inv ADD CONSTRAINT asset_inv_location_check
                    CHECK (location IN ('office', 'payout', 'drawcourt', 'obs', 'staffhouse', 'vehicle'));
            END $$;
        `);

        // Fix existing data: assets whose type is 'Vehicle' but location is
        // not 'vehicle' (imported before the Type-column fallback was added).
        // Idempotent — safe to re-run.
        await client.query(`
            UPDATE asset_inv
            SET location = 'vehicle',
                updated_at = CURRENT_TIMESTAMP
            WHERE LOWER(type) = 'vehicle'
              AND location != 'vehicle'
              AND is_current = TRUE
        `);

        // Sync identity + lifecycle flags (Google Sheets sync).
        // sheet_row_hash is a SHA-256 of stable fields so each Google Sheet
        // row maps to at most one DB row; re-syncing the same sheet is a
        // no-op. is_current marks the most recent sheet snapshot of a row;
        // readers filter on it so stale versions stay in the table for
        // audit but don't show up in the UI. We never DELETE here.
        await client.query(
            "ALTER TABLE asset_inv ADD COLUMN IF NOT EXISTS sheet_row_hash VARCHAR(64)"
        );
        await client.query(
            "ALTER TABLE asset_inv ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE"
        );
        await client.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_inv_sheet_row_hash ON asset_inv(sheet_row_hash) WHERE sheet_row_hash IS NOT NULL"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_asset_inv_is_current ON asset_inv(is_current)"
        );

        /* =========================
           asset_coding — the master "Asset Coding" registry.
           Each row gets a unique qr_payload that scanners decode.
           A row may also link to a concrete asset (asset_inv.id) if you
           want the QR to identify a specific physical item.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_coding (
                id SERIAL PRIMARY KEY,
                item_code VARCHAR(100),
                description VARCHAR(255),
                type VARCHAR(100),
                department VARCHAR(255),
                care_of VARCHAR(255),
                space VARCHAR(255),
                asset_id INTEGER REFERENCES asset_inv(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_asset_coding_item_code ON asset_coding(item_code)"
        );

        // Sync identity + lifecycle flags (matches asset_inv above).
        await client.query(
            "ALTER TABLE asset_coding ADD COLUMN IF NOT EXISTS sheet_row_hash VARCHAR(64)"
        );
        await client.query(
            "ALTER TABLE asset_coding ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE"
        );
        await client.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_coding_sheet_row_hash ON asset_coding(sheet_row_hash) WHERE sheet_row_hash IS NOT NULL"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_asset_coding_is_current ON asset_coding(is_current)"
        );

        /* =========================
           payout_stations — user-managed list of payout outlets.
           Each row has a short station_code (CDO, MOE, MOW…) used
           when generating asset item codes like CDO-PAY-001.
           Links from asset_inv.id.payout_station_id (added below).
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS payout_stations (
                id SERIAL PRIMARY KEY,
                station_code VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed common stations on first run only
        const stationCount = await client.query("SELECT COUNT(*)::int AS n FROM payout_stations");
        if (stationCount.rows[0].n === 0) {
            await client.query(`
                INSERT INTO payout_stations (station_code, name) VALUES
                ('CDO', 'Cagayan de Oro'),
                ('MOE', 'Misamis Oriental East'),
                ('MOW', 'Misamis Oriental West');
            `);
        }

        // Link from asset_inv to the station (only meaningful when location='payout')
        await client.query(
            "ALTER TABLE asset_inv ADD COLUMN IF NOT EXISTS payout_station_id INTEGER REFERENCES payout_stations(id) ON DELETE SET NULL"
        );

        /* =========================
           office_departments — user-managed list of departments / sub-areas
           inside the Main Office. Used for Office asset_inv. dept_code goes into
           the asset_inv.space field so the Summary page sub-location counts work.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS office_departments (
                id SERIAL PRIMARY KEY,
                dept_code VARCHAR(40) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed the standard office departments. Idempotent — safe to re-run and
        // doesn't disturb any custom departments the user has added.
        await client.query(`
            INSERT INTO office_departments (dept_code, name) VALUES
                ('Admin', 'Admin'),
                ('Operations', 'Operations'),
                ('Accounting', 'Accounting'),
                ('IT', 'IT'),
                ('HR', 'HR')
            ON CONFLICT (dept_code) DO NOTHING;
        `);

        // Link from asset_inv to the office department (only meaningful when location='office')
        await client.query(
            "ALTER TABLE asset_inv ADD COLUMN IF NOT EXISTS office_department_id INTEGER REFERENCES office_departments(id) ON DELETE SET NULL"
        );

        /* =========================
           diagnosis_list — master list of repair diagnoses.
           Used by the CSR Repair Request form dropdown so entries can be
           managed centrally instead of being hard-coded in the front-end.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS diagnosis_list (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed common diagnoses on first run only
        const diagnosisCount = await client.query("SELECT COUNT(*)::int AS n FROM diagnosis_list");
        if (diagnosisCount.rows[0].n === 0) {
            await client.query(`
                INSERT INTO diagnosis_list (name) VALUES
                    ('Screen Damage'),
                    ('Battery Issue'),
                    ('Printer Malfunction'),
                    ('Card Reader Error'),
                    ('Power Supply Issue'),
                    ('Software Error'),
                    ('Keyboard Issue'),
                    ('Other');
            `);
        }

        /* =========================
           booth_change_requests — operators submit a request to swap their POS
           device to a different booth; admins approve or reject. Append-only
           for audit (no DELETE endpoint). When approved, we reuse the existing
           booth-change machinery so the booth_change_logs trail still fires.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS booth_change_requests (
                id SERIAL PRIMARY KEY,
                pos_record_id INTEGER NOT NULL REFERENCES pos_records(id) ON DELETE CASCADE,
                requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                requested_booth_id INTEGER NOT NULL REFERENCES booth_info(id) ON DELETE RESTRICT,
                reason TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
                admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                admin_notes TEXT,
                decided_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE CASCADE"
        );
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        );
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS requested_booth_id INTEGER REFERENCES booth_info(id) ON DELETE RESTRICT"
        );
        await client.query("ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS reason TEXT");
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'"
        );
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        );
        await client.query("ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT");
        await client.query("ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP");
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_bcr_status ON booth_change_requests(status)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_bcr_user ON booth_change_requests(requested_by_user_id)"
        );

        /* =========================
           operator_change_requests — operators ask admins to re-assign
           a POS device's operator_id to themselves (e.g. when a device
           needs to move between operators). When approved, the device's
           operator_id is updated; the rest of the device stays put.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS operator_change_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                pos_record_id INTEGER NOT NULL REFERENCES pos_records(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
                reason TEXT,
                decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                decided_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
        );
        await client.query(
            "ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE CASCADE"
        );
        await client.query(
            "ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'"
        );
        await client.query("ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS reason TEXT");
        await client.query(
            "ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        );
        await client.query("ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP");
        await client.query(
            "ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );
        await client.query(
            "ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_ocr_status ON operator_change_requests(status)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_ocr_user ON operator_change_requests(user_id)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_ocr_pos ON operator_change_requests(pos_record_id)"
        );

        /* =========================
           repair_records — CSR repair requests
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS repair_records (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE SET NULL,
                ntc BOOLEAN DEFAULT false,
                operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL,
                diagnosis_id INTEGER REFERENCES diagnosis_list(id) ON DELETE SET NULL,
                delivered_by VARCHAR(255),
                with_charger BOOLEAN DEFAULT false,
                with_box BOOLEAN DEFAULT false,
                status VARCHAR(50) DEFAULT 'Pending',
                forwarded BOOLEAN DEFAULT false,
                released BOOLEAN DEFAULT false,
                re_repair BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           diagnosis_logs — final diagnosis audit trail for POS repair
        ========================= */
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS date DATE");
        await client.query(
            "ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE SET NULL"
        );
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS ntc BOOLEAN DEFAULT false");
        await client.query(
            "ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL"
        );
        await client.query(
            "ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS diagnosis_id INTEGER REFERENCES diagnosis_list(id) ON DELETE SET NULL"
        );
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS delivered_by VARCHAR(255)");
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS with_charger BOOLEAN DEFAULT false");
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS with_box BOOLEAN DEFAULT false");
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending'");
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS forwarded BOOLEAN DEFAULT false");
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS released BOOLEAN DEFAULT false");
        await client.query("ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS re_repair BOOLEAN DEFAULT false");
        await client.query(
            "ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );
        await client.query(
            "ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );

        await client.query(`
            CREATE TABLE IF NOT EXISTS diagnosis_logs (
                id SERIAL PRIMARY KEY,
                repair_record_id INTEGER NOT NULL REFERENCES repair_records(id) ON DELETE CASCADE,
                requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                requested_by VARCHAR(255),
                pos_diagnosis VARCHAR(255),
                repaired_by VARCHAR(255),
                remarks TEXT,
                status VARCHAR(50),
                forwarded_at TIMESTAMP,
                returned_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_diagnosis_logs_repair_record ON diagnosis_logs(repair_record_id)"
        );

        /* =========================
           billing_transmittals — billing codes for released repairs
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS billing_transmittals (
                id SERIAL PRIMARY KEY,
                billing_code VARCHAR(100) NOT NULL,
                diagnosis_log_id INTEGER REFERENCES diagnosis_logs(id) ON DELETE SET NULL,
                received_by VARCHAR(255),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                repair_record_id INTEGER REFERENCES repair_records(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE billing_transmittals ADD COLUMN IF NOT EXISTS repair_record_id INTEGER REFERENCES repair_records(id) ON DELETE CASCADE"
        );
        await client.query(
            "ALTER TABLE billing_transmittals DROP CONSTRAINT IF EXISTS billing_transmittals_billing_code_key"
        );
        await client.query(
            "DROP INDEX IF EXISTS billing_transmittals_billing_code_key"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_billing_transmittals_repair_record ON billing_transmittals(repair_record_id)"
        );

        /* =========================
           released_logs — final release log for repaired POS
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS released_logs (
                id SERIAL PRIMARY KEY,
                billing_transmittal_id INTEGER REFERENCES billing_transmittals(id) ON DELETE SET NULL,
                repair_record_id INTEGER REFERENCES repair_records(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE released_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_released_logs_repair_record ON released_logs(repair_record_id)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_released_logs_user ON released_logs(user_id)"
        );

        /* =========================
           lottery_results — CSR-published draw results for the landing page
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS lottery_results (
                id SERIAL PRIMARY KEY,
                draw_label VARCHAR(255) NOT NULL,
                winning_number VARCHAR(50) NOT NULL,
                area VARCHAR(50) NOT NULL CHECK (area IN ('National', 'Local CDO', 'Local MISOR')),
                draw_date DATE NOT NULL DEFAULT CURRENT_DATE,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           announcements — CSR-published events & news for the landing page
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                caption TEXT,
                type VARCHAR(20) NOT NULL CHECK (type IN ('event', 'news')),
                media_urls TEXT DEFAULT '[]',
                location VARCHAR(255),
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           messages — Bulletin Board group chat
           Originally designed as a user-to-admin DM table; repurposed as the
           backing store for the shared Bulletin Board chat room. Legacy
           columns (attachment_url singular, reply/replied_by/replied_at,
           is_read) are kept intact for backward compatibility but the
           bulletin routes use the newer columns added below.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                attachment_url TEXT,
                reply TEXT,
                replied_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                replied_at TIMESTAMP,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Bulletin Board extensions: multiple attachments (JSON array of
        // /uploads/* paths), pin flag for admin moderation, and a self-
        // reference for in-thread quote replies. ON DELETE SET NULL on the
        // reply target so deleting the original doesn't cascade-delete every
        // reply that quoted it; the UI shows "Original message deleted".
        await client.query(
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_urls TEXT DEFAULT '[]'"
        );
        await client.query(
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false"
        );
        await client.query(
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id)"
        );

        /* =========================
           bulletin_read_markers — per-user "last read" pointer for the
           Bulletin Board feed. Storing the highest seen message id (rather
           than counts) makes unread computation O(1) and survives message
           deletions cleanly.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS bulletin_read_markers (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                last_read_message_id INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           asset_media — photos and videos attached to an asset_inv record.
           Populated from the QR-scan flow (purchaser scans a sticker, sees
           the asset_inv details, attaches a picture/video and updates remarks).
           Files live under <backend>/src/public/uploads and are referenced
           by relative URL so the existing /uploads static handler serves
           them.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_media (
                id SERIAL PRIMARY KEY,
                asset_id INTEGER NOT NULL REFERENCES asset_inv(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                mime_type VARCHAR(100),
                uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                caption TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            DO $$
            DECLARE constraint_name TEXT;
            BEGIN
                SELECT con.conname INTO constraint_name
                FROM pg_constraint con
                JOIN pg_class tbl ON tbl.oid = con.conrelid
                JOIN pg_attribute att ON att.attrelid = tbl.oid
                    AND att.attnum = ANY(con.conkey)
                WHERE tbl.relname = 'asset_media'
                  AND con.contype = 'f'
                  AND att.attname = 'asset_id';

                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE asset_media DROP CONSTRAINT %I', constraint_name);
                END IF;

                ALTER TABLE asset_media
                    ADD CONSTRAINT asset_media_asset_id_fkey
                    FOREIGN KEY (asset_id) REFERENCES asset_inv(id)
                    ON DELETE CASCADE;
            END $$;
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_asset_media_asset ON asset_media(asset_id)"
        );

        /* =========================
           activity_logs — system-wide audit trail of user actions.
           Populated by every CRUD endpoint that mutates state (users,
           asset_inv, asset_coding, bulletin, posts, ...). The Settings →
           Activity Logs page reads from this table. Schema is intentionally
           generic so we don't have to add a column every time we add a new
           resource: `entity` is a free-form string ('user', 'asset_coding',
           ...) and `details` is a JSON-encoded payload for any extra
           context. Indexed by created_at so the most common query
           (recent-first listing) is cheap.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(50) NOT NULL,
                entity VARCHAR(64) NOT NULL,
                entity_id INTEGER,
                summary VARCHAR(500),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity)"
        );

        for (const tableName of SERIAL_TABLES) {
            await syncSerialSequence(client, tableName);
        }

        console.log("Database initialized successfully");
    } catch (err) {
        console.error("Database initialization error:", err.message);
        throw err;
    } finally {
        client.release();
    }
}

export default initDatabase;
