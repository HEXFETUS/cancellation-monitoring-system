import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const SELECT_COLUMNS = `
    SELECT
        obr.id,
        obr.user_id,
        obr.booth_info_id,
        obr.status,
        obr.decided_by_user_id,
        obr.decided_at,
        obr.created_at,
        obr.updated_at,
        b.booth_code,
        b.coordinate,
        b.location AS booth_location,
        b.operator_id AS current_operator_id,
        cb.operator AS current_operator,
        COALESCE(requester_op.operator, requester_user_lookup.operator) AS to_operator,
        u.name AS requested_by_name,
        decider.name AS decided_by_name
    FROM operator_booth_requests obr
    LEFT JOIN booth_info b ON obr.booth_info_id = b.id
    LEFT JOIN operator_list cb ON b.operator_id = cb.id
    LEFT JOIN operator_list requester_op
        ON requester_op.user_id = obr.user_id
    LEFT JOIN (
        SELECT u.id AS user_id, ol.operator
        FROM users u
        LEFT JOIN operator_list ol ON ol.user_id = u.id
    ) requester_user_lookup ON requester_user_lookup.user_id = obr.user_id
    LEFT JOIN users u ON obr.user_id = u.id
    LEFT JOIN users decider ON obr.decided_by_user_id = decider.id
`;

/**
 * GET /api/booth-operator-change-requests
 * Query params:
 *   status=pending|approved|rejected|cancelled
 *   userId=<id>     (filter by the user that submitted the request)
 *   booth_id=<id>   (booth_info.id)
 */
router.get("/", async (req, res) => {
    try {
        const { status, userId, booth_id } = req.query;
        const conditions = [];
        const params = [];

        if (status) {
            params.push(String(status));
            conditions.push(`obr.status = $${params.length}`);
        }
        if (userId) {
            params.push(Number(userId));
            conditions.push(`obr.user_id = $${params.length}`);
        }
        if (booth_id) {
            params.push(Number(booth_id));
            conditions.push(`obr.booth_info_id = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `${SELECT_COLUMNS} ${where} ORDER BY obr.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET booth-operator-change-requests error:", err.message);
        res.status(500).json({ error: "Failed to fetch booth operator change requests" });
    }
});

/**
 * POST /api/booth-operator-change-requests
 * Body: { user_id, booth_id }
 * Operator submits a request to "adopt" a booth that currently lives
 * under a different operator. The request goes to the admin queue (status
 * "pending"); when approved, the booth's operator_id is updated.
 */
router.post("/", async (req, res) => {
    const { user_id, booth_id } = req.body ?? {};

    if (!user_id || !booth_id) {
        return res.status(400).json({
            error: "user_id and booth_id are required",
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

        // Validate booth exists
        const boothRes = await pool.query(
            `SELECT id, booth_code, operator_id FROM booth_info WHERE id = $1::int LIMIT 1`,
            [booth_id]
        );
        if (boothRes.rows.length === 0) {
            return res.status(404).json({ error: "Booth not found" });
        }
        const booth = boothRes.rows[0];

        // Reject if the requesting user already owns the booth
        const requesterOpRes = await pool.query(
            `SELECT id, operator FROM operator_list WHERE user_id = $1::int LIMIT 1`,
            [user_id]
        );
        const requesterOpId = requesterOpRes.rows[0]?.id ?? null;
        if (requesterOpId && booth.operator_id && Number(booth.operator_id) === Number(requesterOpId)) {
            return res.status(400).json({
                error: "You already own this booth.",
            });
        }

        // Reject if there's already a pending request for the same booth
        const existing = await pool.query(
            `SELECT id FROM operator_booth_requests
             WHERE booth_info_id = $1::int AND status = 'pending' LIMIT 1`,
            [booth_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: "A pending request already exists for this booth",
            });
        }

        const insertRes = await pool.query(
            `INSERT INTO operator_booth_requests
                (user_id, booth_info_id, status)
             VALUES ($1, $2, 'pending')
             RETURNING id`,
            [
                Number(user_id),
                Number(booth_id),
            ]
        );

        const created = await pool.query(
            `${SELECT_COLUMNS} WHERE obr.id = $1::int`,
            [insertRes.rows[0].id]
        );
        res.status(201).json(created.rows[0]);
    } catch (err) {
        console.error("POST booth-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to create request" });
    }
});

/**
 * POST /api/booth-operator-change-requests/:id/approve
 * Body: { admin_user_id }
 * Marks the request approved and re-assigns the booth's operator_id
 * to the requesting user's operator.
 */
router.post("/:id/approve", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id } = req.body ?? {};

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const reqResult = await client.query(
            `SELECT id, user_id, booth_info_id, status
             FROM operator_booth_requests WHERE id = $1::int FOR UPDATE`,
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

        // Update the booth's operator
        const boothUpdate = await client.query(
            `UPDATE booth_info
             SET operator_id = $1::int,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int
             RETURNING id`,
            [newOperatorId, reqRow.booth_info_id]
        );
        if (boothUpdate.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Booth no longer exists" });
        }

        // Mark the request approved
        await client.query(
            `UPDATE operator_booth_requests
             SET status = 'approved',
                 decided_by_user_id = $1,
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int`,
            [
                admin_user_id ? Number(admin_user_id) : null,
                id,
            ]
        );

        await client.query("COMMIT");

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE obr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("approve booth-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to approve request" });
    } finally {
        client.release();
    }
});

/**
 * POST /api/booth-operator-change-requests/:id/reject
 * Body: { admin_user_id }
 */
router.post("/:id/reject", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE operator_booth_requests
             SET status = 'rejected',
                 decided_by_user_id = $1,
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int AND status = 'pending'
             RETURNING id`,
            [
                admin_user_id ? Number(admin_user_id) : null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                error: "Request not found or already decided",
            });
        }

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE obr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("reject booth-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to reject request" });
    }
});

/**
 * POST /api/booth-operator-change-requests/:id/cancel
 * Operators withdraw their own pending request.
 */
router.post("/:id/cancel", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { user_id } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE operator_booth_requests
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
            `${SELECT_COLUMNS} WHERE obr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("cancel booth-operator-change-request error:", err.message);
        res.status(500).json({ error: "Failed to cancel request" });
    }
});

export default router;
