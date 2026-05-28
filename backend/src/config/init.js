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
    "assets",
    "asset_codes",
    "payout_stations",
    "office_departments",
    "booth_change_requests",
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
           assets — Asset Inventory
           One row per physical asset record. The "location" column
           groups by section (office/payout/drawcourt/obs) so the same
           table can power all four pages.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS assets (
                id SERIAL PRIMARY KEY,
                location VARCHAR(50) NOT NULL CHECK (location IN ('office', 'payout', 'drawcourt', 'obs')),
                item_description VARCHAR(255) NOT NULL,
                type VARCHAR(100),
                serial_number VARCHAR(255),
                department VARCHAR(255),
                space VARCHAR(255),
                date_purchase DATE,
                vendor VARCHAR(255),
                purchase_price NUMERIC(14,2) DEFAULT 0,
                warranty_date DATE,
                quantity INTEGER DEFAULT 1,
                discount NUMERIC(14,2) DEFAULT 0,
                asset_value NUMERIC(14,2) DEFAULT 0,
                total_value NUMERIC(14,2) DEFAULT 0,
                color VARCHAR(50),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location)"
        );

        /* =========================
           asset_codes — the master "Asset Coding" registry.
           Each row gets a unique qr_payload that scanners decode.
           A row may also link to a concrete asset (assets.id) if you
           want the QR to identify a specific physical item.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_codes (
                id SERIAL PRIMARY KEY,
                item_code VARCHAR(100) UNIQUE NOT NULL,
                description VARCHAR(255) NOT NULL,
                type VARCHAR(100),
                department VARCHAR(255),
                care_of VARCHAR(255),
                space VARCHAR(255),
                qr_payload VARCHAR(255) UNIQUE NOT NULL,
                asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_asset_codes_item_code ON asset_codes(item_code)"
        );

        /* =========================
           payout_stations — user-managed list of payout outlets.
           Each row has a short station_code (CDO, MOE, MOW…) used
           when generating asset item codes like CDO-PAY-001.
           Links from assets.payout_station_id (added below).
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

        // Link from assets to the station (only meaningful when location='payout')
        await client.query(
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS payout_station_id INTEGER REFERENCES payout_stations(id) ON DELETE SET NULL"
        );

        /* =========================
           office_departments — user-managed list of departments / sub-areas
           inside the Main Office. Used for Office assets. dept_code goes into
           the assets.space field so the Summary page sub-location counts work.
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

        // Link from assets to the office department (only meaningful when location='office')
        await client.query(
            "ALTER TABLE assets ADD COLUMN IF NOT EXISTS office_department_id INTEGER REFERENCES office_departments(id) ON DELETE SET NULL"
        );

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
            "CREATE INDEX IF NOT EXISTS idx_bcr_status ON booth_change_requests(status)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_bcr_user ON booth_change_requests(requested_by_user_id)"
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
