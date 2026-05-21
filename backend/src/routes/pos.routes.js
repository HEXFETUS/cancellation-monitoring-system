import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const POS_SELECT = `
    SELECT 
        p.id,
        p.device_no,
        p.serial_number,
        p.serial_number AS serial_no,
        p.area,
        p.status,
        p.sticker,
        p.booth_id,
        p.operator_id,
        p.created_at,
        p.updated_at,
        b.booth_code,
        b.location AS booth_location,
        b.coordinate,
        o.operator
    FROM pos_records p
    LEFT JOIN booth_info b ON p.booth_id = b.id
    LEFT JOIN operator_list o ON p.operator_id = o.id
`;

/* =========================
   GET POS RECORDS
========================= */
router.get("/", async (req, res) => {
    try {
        const {
            device_no,
            serial_number,
            booth_id,
            operator_id,
        } = req.query;

        let query = `${POS_SELECT} WHERE 1=1`;

        const params = [];
        let idx = 1;

        if (device_no) {
            query += ` AND LOWER(p.device_no) LIKE LOWER($${idx})`;
            params.push(`%${device_no}%`);
            idx++;
        }

        if (serial_number) {
            query += ` AND LOWER(p.serial_number) LIKE LOWER($${idx})`;
            params.push(`%${serial_number}%`);
            idx++;
        }

        if (booth_id) {
            query += ` AND p.booth_id = $${idx}::int`;
            params.push(booth_id);
            idx++;
        }

        if (operator_id) {
            query += ` AND p.operator_id = $${idx}::int`;
            params.push(operator_id);
            idx++;
        }

        query += ` ORDER BY p.id ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error("GET POS error:", err.message);
        res.status(500).json({ error: "Failed to fetch POS records" });
    }
});


/* =========================
   CREATE POS RECORD
========================= */
router.post("/", async (req, res) => {
    try {
        const {
            device_no,
            serial_number,
            serial_no,
            area,
            booth_id,
            operator_id,
            status,
            sticker,
        } = req.body;
        const serialNumber = serial_number ?? serial_no;

        if (!device_no?.trim() || !serialNumber?.trim()) {
            return res.status(400).json({
                error: "Device No. and Serial Number are required"
            });
        }

        const insertResult = await pool.query(
            `
            INSERT INTO pos_records (
                device_no,
                serial_number,
                area,
                booth_id,
                operator_id,
                status,
                sticker
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
            `,
            [
                device_no.trim(),
                serialNumber.trim(),
                area || null,
                booth_id || null,
                operator_id || null, // JSON parsing usually handles numbers automatically here
                status || "Active",
                sticker ?? false
            ]
        );

        const result = await pool.query(`${POS_SELECT} WHERE p.id = $1::int`, [insertResult.rows[0].id]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error("POST POS error:", err.message);
        res.status(500).json({ error: "Failed to create POS record" });
    }
});


/* =========================
   UPDATE POS RECORD
========================= */
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const {
            device_no,
            serial_number,
            serial_no,
            area,
            booth_id,
            operator_id,
            status,
            sticker,
        } = req.body;
        const serialNumber = serial_number ?? serial_no;

        const updateResult = await pool.query(
            `
            UPDATE pos_records SET
                device_no = COALESCE($1, device_no),
                serial_number = COALESCE($2, serial_number),
                area = COALESCE($3, area),
                booth_id = COALESCE($4, booth_id),
                operator_id = COALESCE($5, operator_id),
                status = COALESCE($6, status),
                sticker = COALESCE($7, sticker),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8::int
            RETURNING *
            `,
            [
                device_no || null,
                serialNumber || null,
                area || null,
                booth_id || null,
                operator_id || null,
                status || null,
                sticker ?? null,
                id // FIX: Target where clause handles string IDs cleanly now using ::int above
            ]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        const result = await pool.query(`${POS_SELECT} WHERE p.id = $1::int`, [updateResult.rows[0].id]);
        res.json(result.rows[0]);

    } catch (err) {
        console.error("PUT POS error:", err.message);
        res.status(500).json({ error: "Failed to update POS record" });
    }
});


/* =========================
   DELETE POS RECORD
========================= */
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            // FIX: Added ::int to ensure string parameter doesn't mismatch serial/integer primary key
            `DELETE FROM pos_records WHERE id = $1::int RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        res.json({ message: "POS record deleted successfully" });

    } catch (err) {
        console.error("DELETE POS error:", err.message);
        res.status(500).json({ error: "Failed to delete POS record" });
    }
});

export default router;
