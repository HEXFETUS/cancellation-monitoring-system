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

const BOOTH_INFO_SELECT = `
    SELECT
        b.id,
        b.booth_code,
        b.coordinate,
        b.location,
        b.location AS booth_location,
        b.operator_id,
        b.created_at,
        b.updated_at,
        o.operator
    FROM booth_info b
    LEFT JOIN operator_list o ON b.operator_id = o.id
`;

const OPERATOR_SELECT = `
    SELECT
        id,
        operator,
        user_id,
        created_at,
        updated_at
    FROM operator_list
`;

const SERIAL_TABLES = new Set([
    "booth_change_logs",
    "pos_convert_histories",
    "area_logs",
    "status_logs",
]);

async function syncSerialSequence(tableName) {
    if (!SERIAL_TABLES.has(tableName)) {
        throw new Error(`Cannot sync unknown serial table: ${tableName}`);
    }

    await pool.query(
        `
        SELECT setval(
            pg_get_serial_sequence($1, 'id'),
            COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1,
            false
        );
        `,
        [tableName]
    );
}

async function insertStatusLog(values) {
    try {
        await pool.query(
            `INSERT INTO status_logs (pos_record_id, old_status, new_status, user_id)
             VALUES ($1, $2, $3, $4)`,
            values
        );
    } catch (err) {
        if (err?.code !== "23505" || err?.constraint !== "status_logs_pkey") {
            throw err;
        }

        await syncSerialSequence("status_logs");
        await pool.query(
            `INSERT INTO status_logs (pos_record_id, old_status, new_status, user_id)
             VALUES ($1, $2, $3, $4)`,
            values
        );
    }
}

/* =========================
   GET BOOTH INFO
========================= */
router.get("/booth-info", async (_req, res) => {
    try {
        const result = await pool.query(`
            ${BOOTH_INFO_SELECT}
            WHERE NULLIF(TRIM(b.booth_code), '') IS NOT NULL
            ORDER BY b.booth_code ASC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("GET booth_info error:", err.message);
        res.status(500).json({ error: "Failed to fetch booth info" });
    }
});

/* =========================
   GET OPERATORS
========================= */
router.get("/operators", async (_req, res) => {
    try {
        const result = await pool.query(`
            ${OPERATOR_SELECT}
            WHERE NULLIF(TRIM(operator), '') IS NOT NULL
            ORDER BY operator ASC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("GET operators error:", err.message);
        res.status(500).json({ error: "Failed to fetch operators" });
    }
});

/* =========================
   CREATE OPERATOR
========================= */
router.post("/operators", async (req, res) => {
    try {
        const { operator } = req.body;
        const operatorName = String(operator || "").trim();

        if (!operatorName) {
            return res.status(400).json({ error: "Operator name is required" });
        }

        const duplicate = await pool.query(
            `SELECT id FROM operator_list WHERE LOWER(TRIM(operator)) = LOWER($1) LIMIT 1`,
            [operatorName]
        );

        if (duplicate.rows.length > 0) {
            return res.status(400).json({ error: "Operator already exists" });
        }

        const result = await pool.query(
            `INSERT INTO operator_list (operator) VALUES ($1) RETURNING *`,
            [operatorName]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("POST operators error:", err.message);
        res.status(500).json({ error: "Failed to create operator" });
    }
});

/* =========================
   CREATE BOOTH INFO
========================= */
router.post("/booth-info", async (req, res) => {
    const client = await pool.connect();

    try {
        const { booth_code, coordinate, location, operator, operator_id, changed_by } = req.body;
        const boothCode = String(booth_code || "").trim();
        const operatorName = String(operator || "").trim();

        if (!boothCode || (!operator_id && !operatorName)) {
            return res.status(400).json({ error: "Booth code and operator are required" });
        }

        await client.query("BEGIN");

        const duplicateBooth = await client.query(
            `SELECT id FROM booth_info WHERE LOWER(TRIM(booth_code)) = LOWER($1) LIMIT 1`,
            [boothCode]
        );
        if (duplicateBooth.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Booth code already exists" });
        }

        let resolvedOperatorId = operator_id || null;

        if (resolvedOperatorId) {
            const operatorResult = await client.query(
                `SELECT id FROM operator_list WHERE id = $1::int`,
                [resolvedOperatorId]
            );
            if (operatorResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Selected operator not found" });
            }
            resolvedOperatorId = operatorResult.rows[0].id;
        } else {
            const operatorResult = await client.query(
                `SELECT id FROM operator_list WHERE LOWER(TRIM(operator)) = LOWER($1) LIMIT 1`,
                [operatorName]
            );

            if (operatorResult.rows.length > 0) {
                resolvedOperatorId = operatorResult.rows[0].id;
            } else {
                const insertOperator = await client.query(
                    `INSERT INTO operator_list (operator) VALUES ($1) RETURNING id`,
                    [operatorName]
                );
                resolvedOperatorId = insertOperator.rows[0].id;
            }
        }

        const insertBooth = await client.query(
            `
            INSERT INTO booth_info (booth_code, coordinate, location, operator_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            `,
            [
                boothCode,
                coordinate?.trim() || null,
                location?.trim() || null,
                resolvedOperatorId
            ]
        );

        const result = await client.query(`${BOOTH_INFO_SELECT} WHERE b.id = $1::int`, [insertBooth.rows[0].id]);

        await client.query("COMMIT");
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("POST booth_info error:", err.message);
        res.status(500).json({ error: "Failed to create booth info" });
    } finally {
        client.release();
    }
});

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
            user_id,
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

        // Resolve operator from user_id when caller is an operator user.
        // Their POS records are filtered to whatever operator_list row points
        // to that user. If no such operator row exists, return nothing.
        if (user_id) {
            query += ` AND p.operator_id = (SELECT id FROM operator_list WHERE user_id = $${idx}::int LIMIT 1)`;
            params.push(user_id);
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
                operator_id || null,
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
            changed_by,
        } = req.body;
        const serialNumber = serial_number ?? serial_no;

        // Fetch current record to detect status change
        const currentRecord = await pool.query(
            `SELECT id, device_no, status FROM pos_records WHERE id = $1::int`,
            [id]
        );

        if (currentRecord.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        const oldStatus = currentRecord.rows[0].status || null;
        const shouldRemoveBooth =
            status !== undefined &&
            status !== null &&
            String(status).trim().toLowerCase() !== "active";

        const updateResult = await pool.query(
            `
            UPDATE pos_records SET
                device_no = COALESCE($1, device_no),
                serial_number = COALESCE($2, serial_number),
                area = COALESCE($3, area),
                booth_id = CASE WHEN $9::boolean THEN NULL ELSE COALESCE($4, booth_id) END,
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
                status ?? null,
                sticker ?? null,
                id,
                shouldRemoveBooth
            ]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        const newStatus = updateResult.rows[0].status;

        // Log status change if status actually changed
        if (status !== undefined && status !== null && oldStatus !== newStatus) {
            // Look up user_id by name
            let userId = null;
            if (changed_by?.trim()) {
                const userResult = await pool.query(
                    `SELECT id FROM users WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                    [changed_by.trim()]
                );
                if (userResult.rows.length > 0) {
                    userId = userResult.rows[0].id;
                }
            }

            await insertStatusLog([Number(id), oldStatus, newStatus, userId]);
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

/* =========================
   CHANGE BOOTH (with logging & operator validation)
========================= */
router.post("/:id/change-booth", async (req, res) => {
    try {
        const { id } = req.params;
        const { booth_id, booth_code, changed_by } = req.body;

        if (!booth_id || !booth_code?.trim()) {
            return res.status(400).json({ error: "booth_id and booth_code are required" });
        }

        // Get current record (including operator info)
        const currentRecord = await pool.query(
            `SELECT id, device_no, serial_number, booth_id, operator_id FROM pos_records WHERE id = $1::int`,
            [id]
        );

        if (currentRecord.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        const record = currentRecord.rows[0];
        const oldBoothCode = record.booth_id 
            ? (await pool.query(`SELECT booth_code FROM booth_info WHERE id = $1::int`, [record.booth_id])).rows[0]?.booth_code || "Unknown"
            : "N/A";

        // Get the new booth's operator
        const newBoothResult = await pool.query(
            `SELECT operator_id FROM booth_info WHERE id = $1::int`,
            [booth_id]
        );
        if (newBoothResult.rows.length === 0) {
            return res.status(400).json({ error: "Selected booth not found" });
        }
        const newBoothOperatorId = newBoothResult.rows[0].operator_id;

        // Validate operator: if device already has an operator assigned,
        // the new booth's operator must match
        if (record.operator_id && newBoothOperatorId && record.operator_id !== newBoothOperatorId) {
            // Get operator names for the error message
            const currentOpResult = await pool.query(
                `SELECT operator FROM operator_list WHERE id = $1::int`,
                [record.operator_id]
            );
            const newOpResult = await pool.query(
                `SELECT operator FROM operator_list WHERE id = $1::int`,
                [newBoothOperatorId]
            );
            const currentOperator = currentOpResult.rows[0]?.operator || "Unknown";
            const newOperator = newOpResult.rows[0]?.operator || "Unknown";
            return res.status(400).json({
                error: `Operator mismatch: Device is assigned to operator "${currentOperator}" but the selected booth is assigned to operator "${newOperator}". Only the same operator can be assigned to the device number.`
            });
        }

        // Update booth_id and operator_id on pos_record. A device with a booth code is active.
        const operatorToSet = newBoothOperatorId || record.operator_id;
        await pool.query(
            `UPDATE pos_records SET booth_id = $1::int, operator_id = $2::int, status = 'Active', updated_at = CURRENT_TIMESTAMP WHERE id = $3::int`,
            [booth_id, operatorToSet, id]
        );

        await pool.query(
            `INSERT INTO booth_change_logs (pos_record_id, old_booth_code, new_booth_code, changed_by)
             VALUES ($1, $2, $3, $4)`,
            [record.device_no, oldBoothCode, booth_code.trim(), changed_by || null]
        );

        const result = await pool.query(`${POS_SELECT} WHERE p.id = $1::int`, [id]);
        res.json(result.rows[0]);

    } catch (err) {
        console.error("POST change-booth error:", err.message);
        res.status(500).json({ error: "Failed to change booth" });
    }
});

/* =========================
   CONVERT AREA (with logging)
========================= */
router.post("/:id/convert-area", async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { new_area, changed_by } = req.body;
        const allowedAreas = new Set(["CDO", "MISOR"]);
        const normalizedArea = String(new_area || "").trim().toUpperCase();

        if (!allowedAreas.has(normalizedArea)) {
            return res.status(400).json({ error: "Please select a valid new area" });
        }

        await client.query("BEGIN");

        const currentResult = await client.query(
            `SELECT id, device_no, area FROM pos_records WHERE id = $1::int FOR UPDATE`,
            [id]
        );

        if (currentResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "POS record not found" });
        }

        const currentArea = currentResult.rows[0].area || null;
        if ((currentArea || "").toUpperCase() === normalizedArea) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "New area must be different from the current area" });
        }

        let userId = null;
        if (changed_by?.trim()) {
            const userResult = await client.query(
                `SELECT id FROM users WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                [changed_by.trim()]
            );
            if (userResult.rows.length > 0) {
                userId = userResult.rows[0].id;
            }
        }

        await client.query(
            `UPDATE pos_records SET area = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::int`,
            [normalizedArea, id]
        );

        await client.query(
            `INSERT INTO area_logs (pos_record_id, legacy_device_number, previous_area, new_area, user_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, currentResult.rows[0].device_no, currentArea, normalizedArea, userId]
        );

        const result = await client.query(`${POS_SELECT} WHERE p.id = $1::int`, [id]);

        await client.query("COMMIT");
        res.json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("POST convert-area error:", err.message);
        res.status(500).json({ error: "Failed to convert area" });
    } finally {
        client.release();
    }
});

/* =========================
   GET booth_change_logs
========================= */
router.get("/booth-change-logs", async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                pos_record_id,
                old_booth_code,
                new_booth_code,
                changed_by,
                created_at AS date_changed
            FROM booth_change_logs
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("GET booth_change_logs error:", err.message);
        res.status(500).json({ error: "Failed to fetch booth change logs" });
    }
});

/* =========================
   GET area_logs (convert area logs)
========================= */
router.get("/convert-area-logs", async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                al.id,
                al.pos_record_id,
                COALESCE(p.device_no, p_by_device.device_no, al.legacy_device_number, al.pos_record_id::text) AS device_no,
                al.previous_area,
                al.new_area,
                u.name AS changed_by,
                al.created_at AS date_changed
            FROM area_logs al
            LEFT JOIN pos_records p ON al.pos_record_id::text = p.id::text
            LEFT JOIN pos_records p_by_device ON al.pos_record_id::text = p_by_device.device_no
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("GET area_logs error:", err.message);
        res.status(500).json({ error: "Failed to fetch convert area logs" });
    }
});

/* =========================
   GET status_logs
========================= */
router.get("/status-logs", async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                sl.id,
                sl.pos_record_id,
                p.device_no,
                sl.old_status,
                sl.new_status,
                u.name AS changed_by,
                sl.created_at AS date_changed
            FROM status_logs sl
            LEFT JOIN pos_records p ON sl.pos_record_id = p.id
            LEFT JOIN users u ON sl.user_id = u.id
            ORDER BY sl.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("GET status_logs error:", err.message);
        res.status(500).json({ error: "Failed to fetch status logs" });
    }
});

export default router;
