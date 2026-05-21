import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET /api/pos - Get all POS records (with optional search params)
router.get("/", async (req, res) => {
    try {
        const { device_no, serial_no, booth_code, operator } = req.query;
        let query = `
            SELECT 
                p.id, 
                p.device_no, 
                COALESCE(NULLIF(p.serial_no, ''), p.serial_number) AS serial_no,
                p.area, 
                p.status, 
                p.sticker,
                COALESCE(NULLIF(p.operator, ''), o.operator) AS operator,
                COALESCE(NULLIF(p.booth_code, ''), b.booth_code) AS booth_code,
                COALESCE(NULLIF(p.coordinate, ''), b.coordinate) AS coordinate,
                COALESCE(NULLIF(p.booth_location, ''), b.location) AS booth_location
            FROM pos_records p
            LEFT JOIN operator_list o ON p.operator_id = o.id
            LEFT JOIN booth_info b ON p.booth_id = b.id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (device_no) {
            query += ` AND LOWER(p.device_no) LIKE LOWER($${idx})`;
            params.push(`%${device_no}%`);
            idx++;
        }
        if (serial_no) {
            query += ` AND (LOWER(p.serial_no) LIKE LOWER($${idx}) OR LOWER(p.serial_number) LIKE LOWER($${idx}))`;
            params.push(`%${serial_no}%`);
            idx++;
        }
        if (booth_code) {
            query += ` AND (LOWER(p.booth_code) LIKE LOWER($${idx}) OR LOWER(b.booth_code) LIKE LOWER($${idx}))`;
            params.push(`%${booth_code}%`);
            idx++;
        }
        if (operator) {
            query += ` AND (LOWER(p.operator) LIKE LOWER($${idx}) OR LOWER(o.operator) LIKE LOWER($${idx}))`;
            params.push(`%${operator}%`);
            idx++;
        }

        query += " ORDER BY p.id ASC";

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching POS records:", err.message);
        res.status(500).json({ error: "Failed to fetch POS records" });
    }
});

// POST /api/pos - Create a new POS record
router.post("/", async (req, res) => {
    try {
        const {
            device_no,
            serial_no,
            area,
            operator,
            coordinate,
            booth_code,
            booth_location,
            status,
            sticker,
        } = req.body;

        if (!device_no?.trim() || !serial_no?.trim()) {
            return res.status(400).json({ error: "Device No. and Serial No. are required" });
        }

        const result = await pool.query(
            `INSERT INTO pos_records (device_no, serial_no, area, operator, coordinate, booth_code, booth_location, status, sticker)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                device_no.trim(),
                serial_no.trim(),
                area || null,
                operator || null,
                coordinate || null,
                booth_code || null,
                booth_location || null,
                status || "Active",
                sticker ?? false,
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error creating POS record:", err.message);
        res.status(500).json({ error: "Failed to create POS record" });
    }
});

// PUT /api/pos/:id - Update a POS record
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            device_no,
            serial_no,
            area,
            operator,
            coordinate,
            booth_code,
            booth_location,
            status,
            sticker,
        } = req.body;

        const result = await pool.query(
            `UPDATE pos_records SET
                device_no = COALESCE($1, device_no),
                serial_no = COALESCE($2, serial_no),
                area = COALESCE($3, area),
                operator = COALESCE($4, operator),
                coordinate = COALESCE($5, coordinate),
                booth_code = COALESCE($6, booth_code),
                booth_location = COALESCE($7, booth_location),
                status = COALESCE($8, status),
                sticker = COALESCE($9, sticker),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $10 RETURNING *`,
            [
                device_no || null,
                serial_no || null,
                area ?? null,
                operator ?? null,
                coordinate ?? null,
                booth_code ?? null,
                booth_location ?? null,
                status ?? null,
                sticker ?? null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error updating POS record:", err.message);
        res.status(500).json({ error: "Failed to update POS record" });
    }
});

// DELETE /api/pos/:id - Delete a POS record
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "DELETE FROM pos_records WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        res.json({ message: "POS record deleted successfully" });
    } catch (err) {
        console.error("Error deleting POS record:", err.message);
        res.status(500).json({ error: "Failed to delete POS record" });
    }
});

export default router;