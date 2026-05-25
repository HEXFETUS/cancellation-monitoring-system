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
                usertype VARCHAR(50) NOT NULL CHECK (usertype IN ('admin', 'csr', 'operator')),
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add position and department columns if they don't exist
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(255) DEFAULT ''");
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255) DEFAULT ''");

        await client.query(`
            CREATE TABLE IF NOT EXISTS operator_list (
                id SERIAL PRIMARY KEY,
                operator VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

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
                ticket_number VARCHAR(255)
            );
        `);

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
