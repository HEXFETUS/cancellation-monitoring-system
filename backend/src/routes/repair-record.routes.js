import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const REPAIR_SELECT = `
    SELECT
        rr.*,
        pr.serial_number,
        pr.device_no,
        pr.area,
        ol.operator AS operator_name,
        dl.name AS diagnosis_name
    FROM repair_records rr
    LEFT JOIN pos_records pr ON rr.pos_record_id = pr.id
    LEFT JOIN operator_list ol ON rr.operator_id = ol.id
    LEFT JOIN diagnosis_list dl ON rr.diagnosis_id = dl.id
`;

/* =========================
   GET ALL REPAIR RECORDS
========================= */
router.get("/", async (_req, res) => {
    try {
        const result = await pool.query(`${REPAIR_SELECT} ORDER BY rr.id DESC`);
        res.json(result.rows);
    } catch (err) {
        console.error("GET repair_records error:", err.message);
        res.status(500).json({ error: "Failed to fetch repair records" });
    }
});

/* =========================
   GET SINGLE REPAIR RECORD
========================= */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("GET repair_record error:", err.message);
        res.status(500).json({ error: "Failed to fetch repair record" });
    }
});

/* =========================
   CREATE REPAIR RECORD
========================= */
router.post("/", async (req, res) => {
    try {
        const {
            date,
            pos_record_id,
            ntc,
            operator_id,
            operator_name,
            diagnosis_id,
            delivered_by,
            with_charger,
            with_box,
        } = req.body;

        if (!date) {
            return res.status(400).json({ error: "Date is required" });
        }
        if (!pos_record_id) {
            return res.status(400).json({ error: "POS record is required" });
        }

        // Resolve operator_id from operator_name if not provided directly
        let resolvedOperatorId = operator_id || null;
        if (!resolvedOperatorId && operator_name?.trim()) {
            const opResult = await pool.query(
                `SELECT id FROM operator_list WHERE LOWER(TRIM(operator)) = LOWER($1) LIMIT 1`,
                [operator_name.trim()]
            );
            if (opResult.rows.length > 0) {
                resolvedOperatorId = opResult.rows[0].id;
            }
        }

        // Check if pos_record_id already exists with NULL status, forwarded=false, released=true
        const existingRecord = await pool.query(
            `SELECT id FROM repair_records 
             WHERE pos_record_id = $1 AND status IS NULL 
             AND forwarded = false AND released = true`,
            [pos_record_id]
        );

        let result;
        if (existingRecord.rows.length > 0) {
            // Update existing record
            const existingId = existingRecord.rows[0].id;
            result = await pool.query(
                `
                UPDATE repair_records SET
                    date = $1,
                    ntc = $2,
                    operator_id = $3,
                    diagnosis_id = $4,
                    delivered_by = $5,
                    with_charger = $6,
                    with_box = $7,
                    status = $8,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $9
                RETURNING *
                `,
                [
                    date,
                    ntc ?? false,
                    resolvedOperatorId,
                    diagnosis_id || null,
                    delivered_by || null,
                    with_charger ?? false,
                    with_box ?? false,
                    "For Request",
                    existingId,
                ]
            );
        } else {
            // Create new record
            result = await pool.query(
                `
                INSERT INTO repair_records (
                    date, pos_record_id, ntc, operator_id, diagnosis_id,
                    delivered_by, with_charger, with_box, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
                `,
                [
                    date,
                    pos_record_id,
                    ntc ?? false,
                    resolvedOperatorId,
                    diagnosis_id || null,
                    delivered_by || null,
                    with_charger ?? false,
                    with_box ?? false,
                    "For Request",
                ]
            );
        }

        // Fetch the full record with joins
        const full = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [result.rows[0].id]);
        const responseData = full.rows[0];
        responseData.isUpdate = existingRecord.rows.length > 0;
        res.status(201).json(responseData);
    } catch (err) {
        console.error("POST repair_record error:", err.message);
        res.status(500).json({ error: "Failed to create repair record" });
    }
});

/* =========================
   UPDATE REPAIR RECORD
========================= */
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date,
            pos_record_id,
            ntc,
            operator_id,
            operator_name,
            diagnosis_id,
            delivered_by,
            with_charger,
            with_box,
            status,
            forwarded,
            released,
            re_repair,
        } = req.body;

        // Resolve operator_id from operator_name if not provided directly
        let resolvedOperatorId = operator_id || null;
        if (!resolvedOperatorId && operator_name?.trim()) {
            const opResult = await pool.query(
                `SELECT id FROM operator_list WHERE LOWER(TRIM(operator)) = LOWER($1) LIMIT 1`,
                [operator_name.trim()]
            );
            if (opResult.rows.length > 0) {
                resolvedOperatorId = opResult.rows[0].id;
            }
        }

        const result = await pool.query(
            `
            UPDATE repair_records SET
                date = COALESCE($1, date),
                pos_record_id = COALESCE($2, pos_record_id),
                ntc = COALESCE($3, ntc),
                operator_id = COALESCE($4, operator_id),
                diagnosis_id = COALESCE($5, diagnosis_id),
                delivered_by = COALESCE($6, delivered_by),
                with_charger = COALESCE($7, with_charger),
                with_box = COALESCE($8, with_box),
                status = COALESCE($9, status),
                forwarded = COALESCE($10, forwarded),
                released = COALESCE($11, released),
                re_repair = COALESCE($12, re_repair),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $13::int
            RETURNING *
            `,
            [
                date || null,
                pos_record_id || null,
                ntc ?? null,
                resolvedOperatorId,
                diagnosis_id || null,
                delivered_by ?? null,
                with_charger ?? null,
                with_box ?? null,
                status || null,
                forwarded ?? null,
                released ?? null,
                re_repair ?? null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }

        const full = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [result.rows[0].id]);
        res.json(full.rows[0]);
    } catch (err) {
        console.error("PUT repair_record error:", err.message);
        res.status(500).json({ error: "Failed to update repair record" });
    }
});

/* =========================
   CLEAR REPAIR RECORD (sets delivered_by and status to NULL)
========================= */
router.patch("/:id/clear", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `
            UPDATE repair_records SET
                delivered_by = NULL,
                status = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::int
            RETURNING *
            `,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }

        // Fetch the full record with joins
        const full = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [result.rows[0].id]);
        res.json(full.rows[0]);
    } catch (err) {
        console.error("PATCH repair_record/clear error:", err.message);
        res.status(500).json({ error: "Failed to clear repair record" });
    }
});

/* =========================
   DELETE REPAIR RECORD
========================= */
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM repair_records WHERE id = $1::int RETURNING id`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }
        res.json({ message: "Repair record deleted successfully" });
    } catch (err) {
        console.error("DELETE repair_record error:", err.message);
        res.status(500).json({ error: "Failed to delete repair record" });
    }
});

export default router;