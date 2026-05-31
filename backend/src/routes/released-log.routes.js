import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/* =========================
   GET ALL RELEASED LOGS
   Joins released_logs → billing_transmittals → diagnosis_logs → repair_records → pos_records
   to surface Date, Billing Code, POS, Serial, Diagnosis, Remarks, Released By, Received By
========================= */
router.get("/", async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                rl.id,
                rr.date AS release_date,
                bt.billing_code,
                pr.device_no AS pos,
                pr.serial_number,
                dl.pos_diagnosis AS diagnosis,
                dl.remarks,
                COALESCE(rlu.name, btu.name, 'Unknown') AS released_by,
                bt.received_by,
                rl.created_at
            FROM released_logs rl
            LEFT JOIN repair_records rr ON rl.repair_record_id = rr.id
            LEFT JOIN billing_transmittals bt ON rl.billing_transmittal_id = bt.id
            LEFT JOIN diagnosis_logs dl ON bt.diagnosis_log_id = dl.id
            LEFT JOIN pos_records pr ON rr.pos_record_id = pr.id
            LEFT JOIN users rlu ON rl.user_id = rlu.id
            LEFT JOIN users btu ON bt.user_id = btu.id
            ORDER BY rl.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("GET released_logs error:", err);
        res.status(500).json({ error: "Failed to fetch released logs", detail: err.message });
    }
});

export default router;
