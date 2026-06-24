import pool from "./src/config/db.js";

async function run() {
    try {
        const statuses = await pool.query("SELECT status, COUNT(*) FROM diagnosis_logs GROUP BY status");
        console.log("Distinct diagnosis_logs statuses:");
        console.log(statuses.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
