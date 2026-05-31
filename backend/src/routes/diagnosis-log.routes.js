import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/* =========================
   GET ALL DIAGNOSIS LOGS
   Joins repair_records → pos_records for POS / Serial info
========================= */
router.get("/", async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                dl.id,
                dl.repair_record_id,
                dl.requested_at,
                dl.requested_by,
                dl.pos_diagnosis,
                dl.repaired_by,
                dl.remarks,
                dl.status,
                dl.forwarded_at,
                dl.returned_at,
                dl.created_at,
                dl.updated_at,
                pr.device_no,
                pr.serial_number
            FROM diagnosis_logs dl
            LEFT JOIN repair_records rr ON dl.repair_record_id = rr.id
            LEFT JOIN pos_records pr ON rr.pos_record_id = pr.id
            ORDER BY dl.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("GET diagnosis_logs error:", err.message);
        res.status(500).json({ error: "Failed to fetch diagnosis logs" });
    }
});

export default router;