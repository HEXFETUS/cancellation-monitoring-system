import pool from "./db.js";

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

        const userCount = await client.query("SELECT COUNT(*) FROM users");
        if (Number(userCount.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO users (name, email, usertype, password) VALUES
                ('Admin User', 'admin@example.com', 'admin', 'admin123'),
                ('CSR Agent', 'csr@example.com', 'csr', 'csr123'),
                ('Operator One', 'operator@example.com', 'operator', 'op123');
            `);
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
