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
    "cellphone_list",
    "conversations",
    "conversation_participants",
    "private_messages",
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
        await client.query(`
            ALTER TABLE operator_list
            DROP CONSTRAINT IF EXISTS operator_list_operator_key;
        `);
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_list_operator_nonempty_unique
            ON operator_list (LOWER(TRIM(operator)))
            WHERE NULLIF(TRIM(operator), '') IS NOT NULL;
        `);

        await client.query(
            "ALTER TABLE operator_list ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        );
        await client.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_list_user_id ON operator_list(user_id) WHERE user_id IS NOT NULL"
        );

        await client.query(
            "ALTER TABLE operator_list ADD COLUMN IF NOT EXISTS parent_operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_operator_list_parent ON operator_list(parent_operator_id)"
        );
        await client.query(
            "ALTER TABLE operator_list ADD COLUMN IF NOT EXISTS sub_op_name VARCHAR(255)"
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
        await client.query("ALTER TABLE booth_change_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        await client.query("ALTER TABLE booth_change_logs ALTER COLUMN pos_record_id DROP NOT NULL");

        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_convert_histories (
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
            CREATE TABLE IF NOT EXISTS area_logs (
                id SERIAL PRIMARY KEY,
                area VARCHAR(255),
                changed_by VARCHAR(255),
                ip_address VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS status_logs (
                id SERIAL PRIMARY KEY,
                pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE CASCADE,
                previous_status VARCHAR(255),
                new_status VARCHAR(255),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                area VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(255),
                ip_address VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS cancellation_record (
                id SERIAL PRIMARY KEY,
                operator VARCHAR(255),
                area VARCHAR(255),
                reason VARCHAR(255) NOT NULL,
                unpaid_count VARCHAR(255),
                nature VARCHAR(255),
                on_process BOOLEAN DEFAULT false,
                reaseon_for_deny VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS cancellation_human_force (
                id SERIAL PRIMARY KEY,
                operator VARCHAR(255),
                booth_id INTEGER REFERENCES booth_info(id) ON DELETE SET NULL,
                area VARCHAR(255),
                result VARCHAR(255),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_inv (
                id SERIAL PRIMARY KEY,
                area VARCHAR(255),
                item_description VARCHAR(255),
                serial_number VARCHAR(255),
                quantity VARCHAR(255) DEFAULT '0',
                status VARCHAR(255),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_coding (
                id SERIAL PRIMARY KEY,
                asset_id INTEGER REFERENCES asset_inv(id) ON DELETE SET NULL,
                account_type VARCHAR(255),
                code VARCHAR(255),
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS payout_stations (
                id SERIAL PRIMARY KEY,
                area VARCHAR(255),
                code VARCHAR(255) NOT NULL,
                type VARCHAR(255) NOT NULL,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS office_departments (
                id SERIAL PRIMARY KEY,
                office VARCHAR(255) NOT NULL,
                department VARCHAR(255) NOT NULL,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           booth_change_requests
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS booth_change_requests (
                id SERIAL PRIMARY KEY,
                operator_name VARCHAR(255) NOT NULL,
                pos_unit_no VARCHAR(255) NOT NULL,
                old_booth VARCHAR(255) NOT NULL,
                new_booth VARCHAR(255) NOT NULL,
                area VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                remarks TEXT,
                decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                decided_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE booth_change_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );

        /* =========================
           operator_change_requests
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS operator_change_requests (
                id SERIAL PRIMARY KEY,
                operator_name VARCHAR(255) NOT NULL,
                pos_unit_no VARCHAR(255) NOT NULL,
                old_operator VARCHAR(255) NOT NULL,
                new_operator VARCHAR(255) NOT NULL,
                area VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                remarks TEXT,
                decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                decided_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE operator_change_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );

        /* =========================
           diagnosis_list
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS diagnosis_list (
                id SERIAL PRIMARY KEY,
                diagnosis VARCHAR(255) NOT NULL,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           repair_records
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS repair_records (
                id SERIAL PRIMARY KEY,
                pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE SET NULL,
                reported_issue TEXT,
                diagnosis_id INTEGER REFERENCES diagnosis_list(id) ON DELETE SET NULL,
                remarks TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                re_repair BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );

        /* =========================
           diagnosis_logs
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS diagnosis_logs (
                id SERIAL PRIMARY KEY,
                diagnosis VARCHAR(255) NOT NULL,
                pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE CASCADE,
                repair_record_id INTEGER REFERENCES repair_records(id) ON DELETE CASCADE,
                returned_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           billing_transmittals
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS billing_transmittals (
                id SERIAL PRIMARY KEY,
                transaction_no VARCHAR(255) NOT NULL,
                status VARCHAR(255) NOT NULL,
                pos_units TEXT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           released_logs
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS released_logs (
                id SERIAL PRIMARY KEY,
                pos_serial VARCHAR(255) NOT NULL,
                operator VARCHAR(255),
                area VARCHAR(255),
                received_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           lottery_results
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS lottery_results (
                id SERIAL PRIMARY KEY,
                game VARCHAR(255) NOT NULL,
                combination VARCHAR(255) NOT NULL,
                draw_date DATE NOT NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           announcements
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                audience VARCHAR(50) DEFAULT 'all',
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );

        // Migrate announcements table to the new schema
        await client.query(
            "ALTER TABLE announcements RENAME COLUMN message TO description"
        ).catch(() => {}); // column may already be named description
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS description TEXT"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT '[]'"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS display_type VARCHAR(50) DEFAULT 'banner'"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS priority_level VARCHAR(20) DEFAULT 'low'"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMP"
        );
        await client.query(
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        );

        /* =========================
           messages — general-purpose (bulletin) messages.
           attachment_urls stores a JSON array: e.g. '["/uploads/abc.jpg"]'.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                attachment_urls TEXT DEFAULT '[]',
                caption TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           asset_media — images / attachments for assets.
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_media (
                id SERIAL PRIMARY KEY,
                asset_id INTEGER REFERENCES asset_inv(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                caption TEXT,
                details TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           activity_logs
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(255) NOT NULL,
                entity VARCHAR(255) NOT NULL,
                entity_id INTEGER,
                summary TEXT,
                decided_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /* =========================
           cellphone_list
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS cellphone_list (
                id SERIAL PRIMARY KEY,
                brand VARCHAR(255) NOT NULL,
                model VARCHAR(255) NOT NULL,
                imei VARCHAR(255) NOT NULL,
                serial_number VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'available',
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            );
        `);

        /* =========================
           conversations — private conversations between users.
           conversation_type distinguishes:
             - 'direct' (default) — 1-on-1 or shared admin↔user conversations
             - 'admin_group' — the single admin-only group chat
        ========================= */
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                conversation_type VARCHAR(20) DEFAULT 'direct',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) DEFAULT 'direct'"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(conversation_type)"
        );

        await client.query(`
            CREATE TABLE IF NOT EXISTS conversation_participants (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(conversation_id, user_id)
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id)"
        );

        await client.query(`
            CREATE TABLE IF NOT EXISTS private_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                attachment_urls TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_private_messages_conversation ON private_messages(conversation_id)"
        );
        await client.query(
            "CREATE INDEX IF NOT EXISTS idx_private_messages_created_at ON private_messages(created_at)"
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