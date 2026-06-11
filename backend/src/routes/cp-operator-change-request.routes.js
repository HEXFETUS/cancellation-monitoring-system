import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const SELECT_COLUMNS = `
    SELECT
        ocr.id,
        ocr.user_id,
        ocr.cellphone_id,
        ocr.status,
        ocr.reason,
        ocr.old_operator,
        ocr.admin_notes,
        ocr.decided_by_user_id,
        ocr.decided_at,
        ocr.created_at,
        ocr.updated_at,
        cl.brand,
        cl.model,
        cl.control_no,
        cl.serial_number,
        cl.operator_id AS current_operator_id,
        COALESCE(ocr.old_operator, current_op.operator) AS from_operator,
        COALESCE(requester_op.operator, requester_user_lookup.operator) AS to_operator,
        u.name AS requested_by_name,
        decider.name AS decided_by_name
    FROM cp_operator_change_requests ocr
    LEFT JOIN cellphone_list cl ON ocr.cellphone_id = cl.id
    LEFT JOIN operator_list current_op ON cl.operator_id = current_op.id
    LEFT JOIN operator_list requester_op
        ON requester_op.user_id = ocr.user_id
    LEFT JOIN (
        SELECT u.id AS user_id, ol.operator
        FROM users u
        LEFT JOIN operator_list ol ON ol.user_id = u.id
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
 * GET /api/cp-operator-change-requests
 * Query params:
 *   status=pending|approved|rejected|cancelled
 *   userId=<id>
 *   cellphone_id=<id>
 */
router.get("/", async (req, res) => {
    try {
        const { status, userId, cellphone_id } = req.query;
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
        if (cellphone_id) {
            params.push(Number(cellphone_id));
            conditions.push(`ocr.cellphone_id = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `${SELECT_COLUMNS} ${where} ORDER BY ocr.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET cp-operator-change-requests error:", err.message);
        res.status(500).json({ error: "Failed to fetch CP operator change requests" });
    }
});

/**
 * POST /api/cp-operator-change-requests
 * Body: { user_id, cellphone_id, reason? }
 * Operator submits a request to transfer a cellphone to a different operator.
 */
router.post("/", async (req, res) => {
    const { user_id, cellphone_id, reason } = req.body ?? {};

    if (!user_id || !cellphone_id) {
        return res.status(400).json({
            error: "user_id and cellphone_id are required",
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

        // Validate cellphone exists
        const cpRes = await pool.query(
            `SELECT id, brand, model, control_no, serial_number, operator_id
             FROM cellphone_list WHERE id = $1::int LIMIT 1`,
            [cellphone_id]
        );
        if (cpRes.rows.length === 0) {
            return res.status(404).json({ error: "Cellphone not found" });
        }

        // Reject if there's already a pending request for the same cellphone
        const existing = await pool.query(
            `SELECT id FROM cp_operator_change_requests
             WHERE cellphone_id = $1::int AND status = 'pending' LIMIT 1`,
            [cellphone_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: "A pending request already exists for this cellphone",
            });
        }

        const insertRes = await pool.query(
            `INSERT INTO cp_operator_change_requests
                (user_id, cellphone_id, status, reason)
             VALUES ($1, $2, 'pending', $3)
             RETURNING id`,
            [
                Number(user_id),
                Number(cellphone_id),
                nullable(reason),
            ]
        );

        const created = await pool.query(
            `${SELECT_COLUMNS} WHERE ocr.id = $1::int`,
            [insertRes.rows[0].id]
        );
        res.status(201).json(created.rows[0]);
    } catch (err) {
        console.error("POST cp-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to create request" });
    }
});

/**
 * POST /api/cp-operator-change-requests/:id/approve
 * Body: { admin_user_id, admin_notes? }
 * Marks the request approved and re-assigns the cellphone's operator_id
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
            `SELECT id, user_id, cellphone_id, status
             FROM cp_operator_change_requests WHERE id = $1::int FOR UPDATE`,
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

        const cpCurrent = await client.query(
            `SELECT cl.id, cl.operator_id, o.operator
             FROM cellphone_list cl
             LEFT JOIN operator_list o ON cl.operator_id = o.id
             WHERE cl.id = $1::int
             FOR UPDATE OF cl`,
            [reqRow.cellphone_id]
        );
        if (cpCurrent.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Cellphone no longer exists" });
        }
        const oldOperator = cpCurrent.rows[0].operator ?? null;

        // Update the cellphone's operator
        await client.query(
            `UPDATE cellphone_list
             SET operator_id = $1::int,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int`,
            [newOperatorId, reqRow.cellphone_id]
        );

        // Mark the request approved
        await client.query(
            `UPDATE cp_operator_change_requests
             SET status = 'approved',
                 old_operator = $1,
                 decided_by_user_id = $2,
                 admin_notes = $3,
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4::int`,
            [
                oldOperator,
                admin_user_id ? Number(admin_user_id) : null,
                nullable(admin_notes),
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
        console.error("approve cp-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to approve request" });
    } finally {
        client.release();
    }
});

/**
 * POST /api/cp-operator-change-requests/:id/reject
 * Body: { admin_user_id, admin_notes? }
 */
router.post("/:id/reject", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id, admin_notes } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE cp_operator_change_requests
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
        console.error("reject cp-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to reject request" });
    }
});

/**
 * POST /api/cp-operator-change-requests/:id/cancel
 * Operators withdraw their own pending request.
 */
router.post("/:id/cancel", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { user_id } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE cp_operator_change_requests
             SET status = 'cancelled',
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1::int
               AND status = 'pending'
               AND ($2::int IS NULL OR user_id = $2::int)
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
        console.error("cancel cp-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to cancel request" });
    }
});

export default router;