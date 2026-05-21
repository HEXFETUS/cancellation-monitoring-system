import pool from "./db.js";

async function initDatabase() {
    const client = await pool.connect();
    try {
        // Create users table
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

        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)");
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)");
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS usertype VARCHAR(50)");
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)");
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        await client.query("UPDATE users SET name = COALESCE(NULLIF(name, ''), email, 'Unnamed User')");
        await client.query("UPDATE users SET email = COALESCE(NULLIF(email, ''), CONCAT('user-', id, '@example.com'))");
        await client.query("UPDATE users SET usertype = 'operator' WHERE usertype IS NULL OR usertype NOT IN ('admin', 'csr', 'operator')");
        await client.query("UPDATE users SET password = 'changeme' WHERE password IS NULL OR password = ''");

        await client.query("ALTER TABLE users ALTER COLUMN name SET NOT NULL");
        await client.query("ALTER TABLE users ALTER COLUMN email SET NOT NULL");
        await client.query("ALTER TABLE users ALTER COLUMN usertype SET NOT NULL");
        await client.query("ALTER TABLE users ALTER COLUMN password SET NOT NULL");
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'users_usertype_check'
                      AND conrelid = 'users'::regclass
                ) THEN
                    ALTER TABLE users
                    ADD CONSTRAINT users_usertype_check
                    CHECK (usertype IN ('admin', 'csr', 'operator'));
                END IF;
            END $$;
        `);
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'users_email_key'
                      AND conrelid = 'users'::regclass
                ) THEN
                    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
                END IF;
            END $$;
        `);

        // Seed initial users if table is empty
        const result = await client.query("SELECT COUNT(*) FROM users");
        const count = parseInt(result.rows[0].count);

        if (count === 0) {
            await client.query(`
                INSERT INTO users (name, email, usertype, password) VALUES
                ('Admin User', 'admin@example.com', 'admin', 'admin123'),
                ('CSR Agent', 'csr@example.com', 'csr', 'csr123'),
                ('Operator One', 'operator@example.com', 'operator', 'op123');
            `);
            console.log("✅ Seeded 3 initial users");
        }

        // Create pos_records table
        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_records (
                id SERIAL PRIMARY KEY,
                device_no VARCHAR(100) NOT NULL,
                serial_no VARCHAR(100) NOT NULL,
                area VARCHAR(255),
                operator VARCHAR(255),
                coordinate VARCHAR(255),
                booth_code VARCHAR(100),
                booth_location VARCHAR(255),
                status VARCHAR(100) DEFAULT 'Active',
                sticker BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add columns if missing (idempotent)
        const columns = [
            "device_no VARCHAR(100) NOT NULL DEFAULT ''",
            "serial_no VARCHAR(100) NOT NULL DEFAULT ''",
            "area VARCHAR(255)",
            "operator VARCHAR(255)",
            "coordinate VARCHAR(255)",
            "booth_code VARCHAR(100)",
            "booth_location VARCHAR(255)",
            "status VARCHAR(100) DEFAULT 'Active'",
            "sticker BOOLEAN DEFAULT false",
        ];
        for (const col of columns) {
            const colName = col.split(" ")[0];
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='pos_records' AND column_name='${colName}'
                    ) THEN
                        ALTER TABLE pos_records ADD COLUMN ${col};
                    END IF;
                END $$;
            `);
        }

        // Seed sample pos_records if table is empty
        const posCount = await client.query("SELECT COUNT(*) FROM pos_records");
        if (parseInt(posCount.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO pos_records (device_no, serial_no, area, operator, coordinate, booth_code, booth_location, status, sticker) VALUES
                ('DEV-001', 'SN-100001', 'Main Hall', 'John Doe', '14.5833,121.0000', 'BTH-A01', 'Main Hall - Booth A1', 'Active', false),
                ('DEV-002', 'SN-100002', 'Main Hall', 'Jane Smith', '14.5834,121.0001', 'BTH-A02', 'Main Hall - Booth A2', 'Active', true),
                ('DEV-003', 'SN-100003', 'VIP Area', 'Bob Santos', '14.5835,121.0002', 'BTH-B01', 'VIP Area - Booth B1', 'Inactive', false),
                ('DEV-004', 'SN-100004', 'VIP Area', 'Alice Reyes', '14.5836,121.0003', 'BTH-B02', 'VIP Area - Booth B2', 'Active', false),
                ('DEV-005', 'SN-100005', 'Annex', 'Carlos Cruz', '14.5837,121.0004', 'BTH-C01', 'Annex - Booth C1', 'Under Repair', true);
            `);
            console.log("✅ Seeded 5 sample POS records");
        }

        console.log("✅ Database initialized successfully");
    } catch (err) {
        console.error("❌ Database initialization error:", err.message);
    } finally {
        client.release();
    }
}

export default initDatabase;
