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

        console.log("✅ Database initialized successfully");
    } catch (err) {
        console.error("❌ Database initialization error:", err.message);
    } finally {
        client.release();
    }
}

export default initDatabase;
