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
        COALESCE(pos_repair_status.status, p.status) AS status,
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
    LEFT JOIN LATERAL (
        SELECT latest_log.status
        FROM repair_records rr
        JOIN LATERAL (
            SELECT status
            FROM diagnosis_logs
            WHERE repair_record_id = rr.id
            ORDER BY id DESC
            LIMIT 1
        ) latest_log ON true
        WHERE rr.pos_record_id = p.id
          AND rr.status IS NOT NULL
          AND latest_log.status IS NOT NULL
        ORDER BY rr.id DESC
        LIMIT 1
    ) pos_repair_status ON true
`;

// Slim SELECT used when filtering by user_id (operator view). Operator
// dashboards display the device's own status, not the merged repair
// status, so we can drop the LATERAL JOIN. This also keeps the in-memory
// test Postgres (pg-mem) happy — its planner trips on the combination of
// nested LATERALs and the operator-membership IN-CTE clause below.
const POS_SELECT_BY_USER = `
    SELECT 
        p.id,
        p.device_no,
        p.serial_number,
        p.serial_number AS serial_no,
        p.area,
        p.status AS status,
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
        parent_operator_id,
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
   ---------------------------------------------------------------
   Wrapped in a transaction so that, when the caller's chosen
   parent is itself currently a sub (parent_operator_id IS NOT NULL),
   we atomically auto-promote the parent to main BEFORE attaching
   the new child — mirroring the auto-promote pattern that
   POST /api/pos/operators/:id/assign-subs already uses. This keeps
   the one-level-nesting invariant intact across all admin write
   paths and heals any pre-existing buggy rows on the next save.
   ========================= */
router.post("/operators", async (req, res) => {
    const client = await pool.connect();
    try {
        const { operator, parent_operator_id } = req.body;
        const operatorName = String(operator || "").trim();

        if (!operatorName) {
            return res.status(400).json({ error: "Operator name is required" });
        }

        // Coerce parent_operator_id up-front so we can fail fast on bad input
        // without opening a transaction.
        let parentId = null;
        if (
            parent_operator_id !== undefined &&
            parent_operator_id !== null &&
            parent_operator_id !== ""
        ) {
            parentId = Number(parent_operator_id);
            if (!Number.isFinite(parentId)) {
                return res.status(400).json({ error: "Invalid parent_operator_id" });
            }
        }

        await client.query("BEGIN");

        // Duplicate-name check (existing validation, preserved).
        const duplicate = await client.query(
            `SELECT id FROM operator_list WHERE LOWER(TRIM(operator)) = LOWER($1) LIMIT 1`,
            [operatorName]
        );
        if (duplicate.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Operator already exists" });
        }

        if (parentId !== null) {
            // Lock the parent row to prevent concurrent attaches from racing
            // into a half-promoted state — same locking discipline as
            // assign-subs.
            const parentRow = await client.query(
                `SELECT id, parent_operator_id FROM operator_list WHERE id = $1::int FOR UPDATE`,
                [parentId]
            );
            if (parentRow.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Parent operator not found" });
            }
            // Auto-promote the parent to main if it is itself currently a sub.
            // This replaces the previous 400 rejection
            // ("Parent must be a main operator (one level of nesting only)").
            if (parentRow.rows[0].parent_operator_id !== null) {
                await client.query(
                    `UPDATE operator_list
                     SET parent_operator_id = NULL, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1::int`,
                    [parentId]
                );
            }
        }

        const result = await client.query(
            `INSERT INTO operator_list (operator, parent_operator_id) VALUES ($1, $2) RETURNING *`,
            [operatorName, parentId]
        );

        await client.query("COMMIT");
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("POST operators error:", err.message);
        res.status(500).json({ error: "Failed to create operator" });
    } finally {
        client.release();
    }
});

/* =========================
   ASSIGN SUB-OPERATORS (bulk + atomic)
========================= */
router.post("/operators/:id/assign-subs", async (req, res) => {
    const client = await pool.connect();
    try {
        const parentId = Number(req.params.id);
        if (!Number.isFinite(parentId)) {
            return res.status(400).json({ error: "Invalid parent id" });
        }
        const { sub_ids } = req.body ?? {};
        if (!Array.isArray(sub_ids) || sub_ids.length === 0) {
            return res.status(400).json({ error: "sub_ids must be a non-empty array" });
        }

        const ids = sub_ids
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n !== parentId);
        if (ids.length === 0) {
            return res.status(400).json({ error: "No valid sub ids provided" });
        }

        await client.query("BEGIN");

        // 1. Verify the parent exists and promote it to main if needed.
        const parentRow = await client.query(
            `SELECT id, parent_operator_id FROM operator_list WHERE id = $1::int FOR UPDATE`,
            [parentId]
        );
        if (parentRow.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Parent operator not found" });
        }
        if (parentRow.rows[0].parent_operator_id !== null) {
            await client.query(
                `UPDATE operator_list SET parent_operator_id = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1::int`,
                [parentId]
            );
        }

        // 2. For each sub, detach any of its own grandchildren first (one-level rule),
        //    then attach the sub to the parent.
        const errors = [];
        const reparentedGrandchildren = [];
        for (const subId of ids) {
            const subRow = await client.query(
                `SELECT id, operator FROM operator_list WHERE id = $1::int FOR UPDATE`,
                [subId]
            );
            if (subRow.rows.length === 0) {
                errors.push({ id: subId, error: "Sub-operator not found" });
                continue;
            }

            // If this sub itself has children, re-parent those children to the
            // top-level main so we don't violate the one-level rule.
            const grandchildren = await client.query(
                `SELECT id, operator FROM operator_list
                 WHERE parent_operator_id = $1::int FOR UPDATE`,
                [subId]
            );
            for (const gc of grandchildren.rows) {
                await client.query(
                    `UPDATE operator_list
                     SET parent_operator_id = $1::int, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2::int`,
                    [parentId, gc.id]
                );
                reparentedGrandchildren.push({
                    id: gc.id,
                    operator: gc.operator,
                    new_parent_id: parentId,
                });
            }

            // Now safely attach this sub to the parent.
            await client.query(
                `UPDATE operator_list
                 SET parent_operator_id = $1::int, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2::int`,
                [parentId, subId]
            );
        }

        await client.query("COMMIT");

        // Return refreshed operator list so the frontend updates in one round-trip.
        const list = await pool.query(
            `${OPERATOR_SELECT}
             WHERE NULLIF(TRIM(operator), '') IS NOT NULL
             ORDER BY operator ASC`
        );
        res.json({
            assigned: ids.length - errors.length,
            errors,
            reparentedGrandchildren,
            operators: list.rows,
        });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("assign-subs error:", err.message);
        res.status(500).json({ error: "Failed to assign sub-operators" });
    } finally {
        client.release();
    }
});

/* =========================
   UPDATE OPERATOR (currently only parent linkage)
   ---------------------------------------------------------------
   Wrapped in the same transaction pattern as POST /operators above:
   when the supplied parent_operator_id resolves to an operator that
   is itself a sub, auto-promote that parent to main inside the same
   transaction instead of returning 400. Adds a guard so the patch
   path can never create a NEW invariant violation: if the target
   currently has children, it cannot be re-parented under another
   operator (must be detached first).
   ========================= */
router.patch("/operators/:id", async (req, res) => {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: "Invalid id" });
        }

        const { parent_operator_id } = req.body ?? {};

        // Coerce parent_operator_id and run the self-parent guard up-front
        // so bad payloads fail fast before we open a transaction.
        let parentId = null;
        let parentSupplied = false;
        if (
            parent_operator_id !== undefined &&
            parent_operator_id !== null &&
            parent_operator_id !== ""
        ) {
            parentSupplied = true;
            parentId = Number(parent_operator_id);
            if (!Number.isFinite(parentId)) {
                return res.status(400).json({ error: "Invalid parent_operator_id" });
            }
            if (parentId === id) {
                return res.status(400).json({ error: "An operator can't be its own parent" });
            }
        }

        await client.query("BEGIN");

        // Target-existence check (existing validation, preserved).
        const meRow = await client.query(
            `SELECT id, parent_operator_id FROM operator_list WHERE id = $1::int`,
            [id]
        );
        if (meRow.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Operator not found" });
        }

        if (parentSupplied) {
            // Guard: do not allow the patch to create a new invariant
            // violation. If the target itself currently has children, it
            // must remain a main — moving it under another operator would
            // produce an operator P with children AND a non-NULL parent.
            const childrenOfTarget = await client.query(
                `SELECT 1 FROM operator_list WHERE parent_operator_id = $1::int LIMIT 1`,
                [id]
            );
            if (childrenOfTarget.rows.length > 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: "Operator has sub-operators; detach them before making it a sub",
                });
            }

            // Lock the parent row to prevent concurrent attaches from racing
            // into a half-promoted state.
            const parentRow = await client.query(
                `SELECT id, parent_operator_id FROM operator_list WHERE id = $1::int FOR UPDATE`,
                [parentId]
            );
            if (parentRow.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Parent operator not found" });
            }
            // Auto-promote the parent to main if it is itself currently a sub.
            if (parentRow.rows[0].parent_operator_id !== null) {
                await client.query(
                    `UPDATE operator_list
                     SET parent_operator_id = NULL, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1::int`,
                    [parentId]
                );
            }
        }

        const result = await client.query(
            `UPDATE operator_list
             SET parent_operator_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int
             RETURNING *`,
            [parentId, id]
        );

        await client.query("COMMIT");
        res.json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("PATCH operators error:", err.message);
        res.status(500).json({ error: "Failed to update operator" });
    } finally {
        client.release();
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
   GET AVAILABLE POS RECORDS
   Returns POS records that are not already in repair_records with non-NULL status
========================= */
router.get("/available", async (_req, res) => {
    try {
        const result = await pool.query(`
            ${POS_SELECT}
            WHERE p.id NOT IN (
                SELECT pos_record_id 
                FROM repair_records 
                WHERE status IS NOT NULL
            )
            ORDER BY p.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("GET available POS error:", err.message);
        res.status(500).json({ error: "Failed to fetch available POS records" });
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
            as_operator_id,
        } = req.query;

        // When the caller is an operator user (filtered by user_id), use
        // the slim SELECT that omits the repair_records LATERAL JOIN.
        // Operator-facing pages display the device's own status, not the
        // repair status, and the slim form keeps the in-memory test
        // Postgres planner happy when combined with the IN-CTE below.
        const baseSelect = user_id ? POS_SELECT_BY_USER : POS_SELECT;
        let query = `${baseSelect} WHERE 1=1`;

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
        // Main operators see their own POS records AND those of any sub-operator
        // whose parent_operator_id matches them. Sub-operators only see their own.
        // When `as_operator_id` is also passed, narrow the result further to that
        // specific operator (a main operator filtering one of its subs). The
        // server validates the requested operator is reachable for that user.
        if (user_id) {
            if (as_operator_id) {
                query += ` AND p.operator_id = $${idx}::int
                    AND $${idx}::int IN (
                        WITH me AS (
                            SELECT id, parent_operator_id
                            FROM operator_list
                            WHERE user_id = $${idx + 1}::int LIMIT 1
                        )
                        SELECT id FROM operator_list
                        WHERE id = (SELECT id FROM me)
                           OR (
                               (SELECT parent_operator_id FROM me) IS NULL
                               AND parent_operator_id = (SELECT id FROM me)
                           )
                    )`;
                params.push(as_operator_id);
                params.push(user_id);
                idx += 2;
            } else {
                query += ` AND p.operator_id IN (
                    WITH me AS (
                        SELECT id, parent_operator_id
                        FROM operator_list
                        WHERE user_id = $${idx}::int LIMIT 1
                    )
                    SELECT id FROM operator_list
                    WHERE id = (SELECT id FROM me)
                       OR (
                           (SELECT parent_operator_id FROM me) IS NULL
                           AND parent_operator_id = (SELECT id FROM me)
                       )
                )`;
                params.push(user_id);
                idx++;
            }
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
