import pool from './src/config/db.js';

async function run() {
    try {
        const columns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'operator_list'
        `);
        console.log("\noperator_list columns:");
        console.log(columns.rows);

        const columns2 = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'booth_info'
        `);
        console.log("\nbooth_info columns:");
        console.log(columns2.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();