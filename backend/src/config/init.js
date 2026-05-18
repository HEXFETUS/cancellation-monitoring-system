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