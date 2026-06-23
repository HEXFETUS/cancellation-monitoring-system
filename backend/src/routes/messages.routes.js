import express from "express";
import pool from "../config/db.js";
import { recordActivity } from "../utils/activity-log.js";

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserId(req) {
    return req.body?.user_id ?? req.query?.user_id ?? req.headers?.["x-user-id"];
}

async function loadCaller(req) {
    const rawId = getUserId(req);
    if (rawId === undefined || rawId === null || rawId === "") return null;
    const userId = Number(rawId);
    if (!Number.isFinite(userId)) return null;
    const result = await pool.query(
        "SELECT id, name, usertype, profile_picture FROM users WHERE id = $1::int",
        [userId]
    );
    return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/messages/users — list of users the admin can chat with.
// Excludes the caller's own id. Returns users w/ last message preview.
// ---------------------------------------------------------------------------
router.get("/users", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const result = await pool.query(
            `SELECT
                u.id,
                u.name,
                u.usertype,
                u.profile_picture,
                (
                    SELECT pm.message
                    FROM private_messages pm
                    JOIN conversations c ON c.id = pm.conversation_id
                    JOIN conversation_participants cp ON cp.conversation_id = c.id
                    WHERE cp.user_id = u.id
                      AND c.id IN (
                          SELECT cp2.conversation_id
                          FROM conversation_participants cp2
                          WHERE cp2.user_id = $1::int
                      )
                    ORDER BY pm.created_at DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT pm.created_at
                    FROM private_messages pm
                    JOIN conversations c ON c.id = pm.conversation_id
                    JOIN conversation_participants cp ON cp.conversation_id = c.id
                    WHERE cp.user_id = u.id
                      AND c.id IN (
                          SELECT cp2.conversation_id
                          FROM conversation_participants cp2
                          WHERE cp2.user_id = $1::int
                      )
                    ORDER BY pm.created_at DESC
                    LIMIT 1
                ) AS last_message_at
            FROM users u
            WHERE u.id != $1::int
            ORDER BY last_message_at DESC NULLS LAST, u.name ASC`,
            [caller.id]
        );

        res.json({ users: result.rows });
    } catch (err) {
        console.error("Error fetching message users:", err.message);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// ---------------------------------------------------------------------------
// GET /api/messages/conversations — list of conversations for the caller.
// Each includes participants and the last message preview.
// ---------------------------------------------------------------------------
router.get("/conversations", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const result = await pool.query(
            `SELECT
                c.id AS conversation_id,
                c.created_at,
                (
                    SELECT pm.message
                    FROM private_messages pm
                    WHERE pm.conversation_id = c.id
                    ORDER BY pm.created_at DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT pm.created_at
                    FROM private_messages pm
                    WHERE pm.conversation_id = c.id
                    ORDER BY pm.created_at DESC
                    LIMIT 1
                ) AS last_message_at,
                (
                    SELECT json_agg(json_build_object(
                        'id', u.id,
                        'name', u.name,
                        'usertype', u.usertype,
                        'profile_picture', u.profile_picture
                    ))
                    FROM conversation_participants cp2
                    JOIN users u ON u.id = cp2.user_id
                    WHERE cp2.conversation_id = c.id
                ) AS participants
            FROM conversations c
            JOIN conversation_participants cp ON cp.conversation_id = c.id
            WHERE cp.user_id = $1::int
            ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC`,
            [caller.id]
        );

        res.json({ conversations: result.rows });
    } catch (err) {
        console.error("Error fetching conversations:", err.message);
        res.status(500).json({ error: "Failed to fetch conversations" });
    }
});

// ---------------------------------------------------------------------------
// POST /api/messages/conversations — create or get existing conversation
// with another user. Body: { other_user_id: number }
// ---------------------------------------------------------------------------
router.post("/conversations", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const otherUserId = Number(req.body?.other_user_id);
        if (!Number.isInteger(otherUserId) || otherUserId < 1) {
            return res.status(400).json({ error: "INVALID_OTHER_USER_ID" });
        }
        if (otherUserId === caller.id) {
            return res.status(400).json({ error: "CANNOT_CHAT_WITH_SELF" });
        }

        // Check the other user exists
        const otherUser = await pool.query(
            "SELECT id FROM users WHERE id = $1::int",
            [otherUserId]
        );
        if (otherUser.rows.length === 0) {
            return res.status(404).json({ error: "USER_NOT_FOUND" });
        }

        // Check if conversation already exists
        const existing = await pool.query(
            `SELECT c.id
             FROM conversations c
             WHERE (
                 SELECT COUNT(*) FROM conversation_participants cp
                 WHERE cp.conversation_id = c.id AND cp.user_id IN ($1::int, $2::int)
             ) = 2
             AND (
                 SELECT COUNT(*) FROM conversation_participants cp
                 WHERE cp.conversation_id = c.id
             ) = 2`,
            [caller.id, otherUserId]
        );

        if (existing.rows.length > 0) {
            return res.json({ conversation_id: existing.rows[0].id });
        }

        // Create new conversation
        const convResult = await pool.query(
            `INSERT INTO conversations DEFAULT VALUES RETURNING id`
        );
        const conversationId = convResult.rows[0].id;

        await pool.query(
            `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1::int, $2::int), ($1::int, $3::int)`,
            [conversationId, caller.id, otherUserId]
        );

        await recordActivity(req, {
            action: "create",
            entity: "conversation",
            entity_id: conversationId,
            summary: `Started conversation with user #${otherUserId}`,
        });

        res.status(201).json({ conversation_id: conversationId });
    } catch (err) {
        console.error("Error creating conversation:", err.message);
        res.status(500).json({ error: "Failed to create conversation" });
    }
});

// ---------------------------------------------------------------------------
// GET /api/messages/conversations/:id — get messages for a conversation.
// Supports cursor pagination: after_id or before_id.
// ---------------------------------------------------------------------------
router.get("/conversations/:id", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const conversationId = Number(req.params.id);
        if (!Number.isInteger(conversationId) || conversationId < 1) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        // Verify caller is a participant
        const participant = await pool.query(
            `SELECT id FROM conversation_participants
             WHERE conversation_id = $1::int AND user_id = $2::int`,
            [conversationId, caller.id]
        );
        if (participant.rows.length === 0) {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        const limitRaw = req.query.limit;
        let limit = 50;
        if (limitRaw !== undefined && limitRaw !== "") {
            const parsed = Number(limitRaw);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
                return res.status(400).json({ error: "INVALID_LIMIT" });
            }
            limit = parsed;
        }

        const beforeRaw = req.query.before_id;
        const afterRaw = req.query.after_id;
        const hasBefore = beforeRaw !== undefined && beforeRaw !== "";
        const hasAfter = afterRaw !== undefined && afterRaw !== "";
        if (hasBefore && hasAfter) {
            return res.status(400).json({ error: "INVALID_CURSOR" });
        }

        const SELECT = `
            SELECT
                pm.id,
                pm.message,
                pm.attachment_urls,
                pm.created_at,
                pm.sender_id,
                COALESCE(u.name, 'Deleted user') AS sender_name,
                u.profile_picture AS sender_profile_picture,
                u.usertype AS sender_role
            FROM private_messages pm
            LEFT JOIN users u ON u.id = pm.sender_id
            WHERE pm.conversation_id = $1::int
        `;

        let rows;
        if (hasBefore) {
            const beforeId = Number(beforeRaw);
            if (!Number.isInteger(beforeId) || beforeId < 1) {
                return res.status(400).json({ error: "INVALID_CURSOR" });
            }
            const result = await pool.query(
                `${SELECT} AND pm.id < $2::int ORDER BY pm.created_at DESC, pm.id DESC LIMIT $3::int`,
                [conversationId, beforeId, limit]
            );
            rows = result.rows.reverse();
        } else if (hasAfter) {
            const afterId = Number(afterRaw);
            if (!Number.isInteger(afterId) || afterId < 0) {
                return res.status(400).json({ error: "INVALID_CURSOR" });
            }
            const result = await pool.query(
                `${SELECT} AND pm.id > $2::int ORDER BY pm.created_at ASC, pm.id ASC LIMIT $3::int`,
                [conversationId, afterId, limit]
            );
            rows = result.rows;
        } else {
            const result = await pool.query(
                `${SELECT} ORDER BY pm.created_at DESC, pm.id DESC LIMIT $2::int`,
                [conversationId, limit]
            );
            rows = result.rows.reverse();
        }

        const messages = rows.map((row) => ({
            id: row.id,
            message: row.message,
            attachment_urls: row.attachment_urls ? (() => {
                try { return JSON.parse(row.attachment_urls); } catch { return []; }
            })() : [],
            created_at: row.created_at,
            sender_id: row.sender_id,
            sender: {
                id: row.sender_id,
                name: row.sender_name,
                profile_picture: row.sender_profile_picture,
                role: row.sender_role,
            },
        }));

        res.json({ messages });
    } catch (err) {
        console.error("Error fetching conversation messages:", err.message);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// ---------------------------------------------------------------------------
// POST /api/messages/conversations/:id/messages — send a message.
// Body: { message: string }
// ---------------------------------------------------------------------------
router.post("/conversations/:id/messages", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const conversationId = Number(req.params.id);
        if (!Number.isInteger(conversationId) || conversationId < 1) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        // Verify caller is a participant
        const participant = await pool.query(
            `SELECT id FROM conversation_participants
             WHERE conversation_id = $1::int AND user_id = $2::int`,
            [conversationId, caller.id]
        );
        if (participant.rows.length === 0) {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        const body = String(req.body?.message ?? "").trim();
        if (!body) {
            return res.status(400).json({ error: "EMPTY_MESSAGE" });
        }
        if (body.length > 2000) {
            return res.status(400).json({ error: "MESSAGE_TOO_LONG" });
        }

        const insert = await pool.query(
            `INSERT INTO private_messages (conversation_id, sender_id, message)
             VALUES ($1::int, $2::int, $3)
             RETURNING id, created_at`,
            [conversationId, caller.id, body]
        );

        const newMessage = insert.rows[0];

        await recordActivity(req, {
            action: "create",
            entity: "private_message",
            entity_id: newMessage.id,
            summary: `Sent private message #${newMessage.id} in conversation #${conversationId}`,
        });

        res.status(201).json({
            id: newMessage.id,
            conversation_id: conversationId,
            message: body,
            attachment_urls: [],
            created_at: newMessage.created_at,
            sender_id: caller.id,
            sender: {
                id: caller.id,
                name: caller.name,
                profile_picture: caller.profile_picture,
                role: caller.usertype,
            },
        });
    } catch (err) {
        console.error("Error sending message:", err.message);
        res.status(500).json({ error: "Failed to send message" });
    }
});

export default router;