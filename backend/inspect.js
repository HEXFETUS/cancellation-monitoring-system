import pool from './src/config/db.js';

async function run() {
    try {
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("Tables:");
        console.log(tables.rows.map(r => r.table_name));

        const columns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pos_records'
        `);
        console.log("\npos_records columns:");
        console.log(columns.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();