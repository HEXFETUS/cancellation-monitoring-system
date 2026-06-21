import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const operatorDisplay = (alias, parentAlias) => `
    COALESCE(
        NULLIF(TRIM(${alias}.operator), ''),
        CASE
            WHEN ${alias}.parent_operator_id IS NOT NULL
             AND UPPER(TRIM(COALESCE(${alias}.sub_op_name, ''))) NOT IN ('', 'EMPTY', 'NULL')
            THEN COALESCE(NULLIF(TRIM(${parentAlias}.operator), ''), ${parentAlias}.operator)
                || ' (' || TRIM(${alias}.sub_op_name) || ')'
            ELSE NULL
        END
    )
`;

const SELECT_COLUMNS = `
    SELECT
        ocr.id,
        ocr.user_id,
        ocr.pos_record_id,
        ocr.status,
        ocr.reason,
        ocr.old_operator,
        ocr.admin_notes,
        ocr.decided_by_user_id,
        ocr.decided_at,
        ocr.created_at,
        ocr.updated_at,
        p.device_no,
        p.serial_number,
        p.booth_id AS current_booth_id,
        p.area,
        p.operator_id AS current_operator_id,
        cb.booth_code AS current_booth_code,
        ob.booth_code AS requested_booth_code,
        -- Snapshot the previous operator once approved; before approval,
        -- fall back to the device's current operator.
        COALESCE(ocr.old_operator, ${operatorDisplay("current_op", "current_parent_op")}) AS from_operator,
        -- Operator that's submitting the request (snapshot of their operator at
        -- request time, but we also fall back to the live operator lookup so
        -- a renamed operator stays in sync)
        COALESCE(${operatorDisplay("requester_op", "requester_parent_op")}, requester_user_lookup.operator) AS to_operator,
        u.name AS requested_by_name,
        decider.name AS decided_by_name
    FROM operator_change_requests ocr
    LEFT JOIN pos_records p ON ocr.pos_record_id = p.id
    LEFT JOIN booth_info cb ON p.booth_id = cb.id
    LEFT JOIN booth_info ob ON p.booth_id = ob.id
    LEFT JOIN operator_list current_op ON p.operator_id = current_op.id
    LEFT JOIN operator_list current_parent_op ON current_parent_op.id = current_op.parent_operator_id
    LEFT JOIN operator_list requester_op
        ON requester_op.user_id = ocr.user_id
    LEFT JOIN operator_list requester_parent_op ON requester_parent_op.id = requester_op.parent_operator_id
    LEFT JOIN (
        SELECT u.id AS user_id, ${operatorDisplay("ol", "parent_ol")} AS operator
        FROM users u
        LEFT JOIN operator_list ol ON ol.user_id = u.id
        LEFT JOIN operator_list parent_ol ON parent_ol.id = ol.parent_operator_id
    ) requester_user_lookup ON requester_user_lookup.user_id = ocr.user_id
    LEFT JOIN users u ON ocr.user_id = u.id
    LEFT JOIN users decider ON ocr.decided_by_user_id = decider.id
`;

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

/**
 * GET /api/operator-change-requests
 * Query params:
 *   status=pending|approved|rejected|cancelled
 *   userId=<id>     (filter by the user that submitted the request)
 *   pos_record_id=<id>
 */
router.get("/", async (req, res) => {
    try {
        const { status, userId, pos_record_id } = req.query;
        const conditions = [];
        const params = [];

        if (status) {
            params.push(String(status));
            conditions.push(`ocr.status = $${params.length}`);
        }
        if (userId) {
            params.push(Number(userId));
            conditions.push(`ocr.user_id = $${params.length}`);
        }
        if (pos_record_id) {
            params.push(Number(pos_record_id));
            conditions.push(`ocr.pos_record_id = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `${SELECT_COLUMNS} ${where} ORDER BY ocr.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET operator-change-requests error:", err.message);
        res.status(500).json({ error: "Failed to fetch operator change requests" });
    }
});

/**
 * POST /api/operator-change-requests
 * Body: { user_id, pos_record_id, reason? }
 * Operator submits a request to "adopt" a POS device that currently lives
 * under a different operator. The request goes to the admin queue (status
 * "pending"); when approved, the device's operator_id is updated.
 */
router.post("/", async (req, res) => {
    const { user_id, pos_record_id, reason } = req.body ?? {};

    if (!user_id || !pos_record_id) {
        return res.status(400).json({
            error: "user_id and pos_record_id are required",
        });
    }

    try {
        // Validate user exists
        const userRes = await pool.query(
            `SELECT id, name FROM users WHERE id = $1::int LIMIT 1`,
            [user_id]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        // Validate POS device exists
        const posRes = await pool.query(
            `SELECT id, device_no, serial_number, operator_id, booth_id, area
             FROM pos_records WHERE id = $1::int LIMIT 1`,
            [pos_record_id]
        );
        if (posRes.rows.length === 0) {
            return res.status(404).json({ error: "POS device not found" });
        }
        const pos = posRes.rows[0];

        // Reject if the requesting user already owns the device
        const requesterOpRes = await pool.query(
            `SELECT
                o.id,
                ${operatorDisplay("o", "parent_o")} AS operator
             FROM operator_list o
             LEFT JOIN operator_list parent_o ON parent_o.id = o.parent_operator_id
             WHERE o.user_id = $1::int
             LIMIT 1`,
            [user_id]
        );
        const requesterOpId = requesterOpRes.rows[0]?.id ?? null;
        if (requesterOpId && pos.operator_id && Number(pos.operator_id) === Number(requesterOpId)) {
            return res.status(400).json({
                error: "You already own this POS device.",
            });
        }

        // Reject if there's already a pending request for the same device
        const existing = await pool.query(
            `SELECT id FROM operator_change_requests
             WHERE pos_record_id = $1::int AND status = 'pending' LIMIT 1`,
            [pos_record_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: "A pending request already exists for this POS device",
            });
        }

        const insertRes = await pool.query(
            `INSERT INTO operator_change_requests
                (user_id, pos_record_id, status, reason)
             VALUES ($1, $2, 'pending', $3)
             RETURNING id`,
            [
                Number(user_id),
                Number(pos_record_id),
                nullable(reason),
            ]
        );

        const created = await pool.query(
            `${SELECT_COLUMNS} WHERE ocr.id = $1::int`,
            [insertRes.rows[0].id]
        );
        res.status(201).json(created.rows[0]);
    } catch (err) {
        console.error("POST operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to create request" });
    }
});

/**
 * POST /api/operator-change-requests/:id/approve
 * Body: { admin_user_id, admin_notes? }
 * Marks the request approved and re-assigns the POS device's operator_id
 * to the requesting user's operator.
 */
router.post("/:id/approve", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id, admin_notes } = req.body ?? {};

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const reqResult = await client.query(
            `SELECT id, user_id, pos_record_id, status
             FROM operator_change_requests WHERE id = $1::int FOR UPDATE`,
            [id]
        );
        if (reqResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Request not found" });
        }
        const reqRow = reqResult.rows[0];
        if (reqRow.status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: `Request is already ${reqRow.status}`,
            });
        }

        // Resolve the requesting user's operator
        const opRes = await client.query(
            `SELECT id FROM operator_list WHERE user_id = $1::int LIMIT 1`,
            [reqRow.user_id]
        );
        if (opRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: "Requesting user has no linked operator profile",
            });
        }
        const newOperatorId = Number(opRes.rows[0].id);

        const posCurrent = await client.query(
            `SELECT p.id, p.operator_id, ${operatorDisplay("o", "parent_o")} AS operator
             FROM pos_records p
             LEFT JOIN operator_list o ON p.operator_id = o.id
             LEFT JOIN operator_list parent_o ON parent_o.id = o.parent_operator_id
             WHERE p.id = $1::int
             FOR UPDATE OF p`,
            [reqRow.pos_record_id]
        );
        if (posCurrent.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "POS device no longer exists" });
        }
        const oldOperator = posCurrent.rows[0].operator ?? null;

        // Update the POS device's operator
        const posUpdate = await client.query(
            `UPDATE pos_records
             SET operator_id = $1::int,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int
             RETURNING id`,
            [newOperatorId, reqRow.pos_record_id]
        );
        if (posUpdate.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "POS device no longer exists" });
        }

        // Mark the request approved
        await client.query(
            `UPDATE operator_change_requests
             SET status = 'approved',
                 old_operator = $1,
                 decided_by_user_id = $2,
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3::int`,
            [
                oldOperator,
                admin_user_id ? Number(admin_user_id) : null,
                id,
            ]
        );

        await client.query("COMMIT");

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE ocr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("approve operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to approve request" });
    } finally {
        client.release();
    }
});

/**
 * POST /api/operator-change-requests/:id/reject
 * Body: { admin_user_id, admin_notes? }
 */
router.post("/:id/reject", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE operator_change_requests
             SET status = 'rejected',
                 decided_by_user_id = $1,
                 admin_notes = $2,
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3::int AND status = 'pending'
             RETURNING id`,
            [
                admin_user_id ? Number(admin_user_id) : null,
                typeof admin_notes === "string" && admin_notes.trim() ? admin_notes.trim() : null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                error: "Request not found or already decided",
            });
        }

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE ocr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("reject operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to reject request" });
    }
});

/**
 * POST /api/operator-change-requests/:id/cancel
 * Operators withdraw their own pending request.
 * Allows the request's owner (sub-operator) or the main operator
 * (who has the sub-operator as their child) to cancel.
 */
router.post("/:id/cancel", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { user_id } = req.body ?? {};

    try {
        // Cancel if the user owns the request OR is the parent operator
        // of the user who owns the request.
        const result = await pool.query(
            `UPDATE operator_change_requests
             SET status = 'cancelled',
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1::int
               AND status = 'pending'
               AND (
                   $2::int IS NULL
                   OR user_id = $2::int
                   OR EXISTS (
                       SELECT 1 FROM operator_list sub
                       WHERE sub.user_id = operator_change_requests.user_id
                         AND sub.parent_operator_id = (
                             SELECT id FROM operator_list
                             WHERE user_id = $2::int
                             LIMIT 1
                         )
                   )
               )
             RETURNING id`,
            [id, user_id ? Number(user_id) : null]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                error: "Request not found, already decided, or not yours to cancel",
            });
        }

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE ocr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("cancel operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to cancel request" });
    }
});

export default router;
