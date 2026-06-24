import express from "express";
import pool from "../config/db.js";
import { recordActivity } from "../utils/activity-log.js";
import upload from "../config/multer.js";

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

async function getOrCreateSharedAdminConversation(nonAdminId) {
    const existing = await pool.query(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1::int
         WHERE NOT EXISTS (
             SELECT 1 FROM conversation_participants cp2
             JOIN users u2 ON u2.id = cp2.user_id
             WHERE cp2.conversation_id = c.id
             AND u2.usertype != 'admin'
             AND cp2.user_id != $1::int
         )
         AND (
             SELECT COUNT(*) FROM conversation_participants cp3
             JOIN users u3 ON u3.id = cp3.user_id
             WHERE cp3.conversation_id = c.id AND u3.usertype = 'admin'
         ) = (SELECT COUNT(*) FROM users WHERE usertype = 'admin')
         LIMIT 1`,
        [nonAdminId]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].id;
    }

    const admins = await pool.query("SELECT id FROM users WHERE usertype = 'admin'");
    if (admins.rows.length === 0) {
        throw new Error("NO_ADMINS");
    }

    const convResult = await pool.query(
        `INSERT INTO conversations DEFAULT VALUES RETURNING id`
    );
    const conversationId = convResult.rows[0].id;

    const values = [conversationId];
    const placeholders = [];
    admins.rows.forEach((admin, i) => {
        placeholders.push(`($1::int, $${i + 2}::int)`);
        values.push(admin.id);
    });
    placeholders.push(`($1::int, $${placeholders.length + 2}::int)`);
    values.push(nonAdminId);

    await pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${placeholders.join(", ")}`,
        values
    );

    return conversationId;
}

async function migrateOldAdminMessages(sharedConvId, nonAdminId) {
    const oldConvResult = await pool.query(
        `SELECT DISTINCT cp.conversation_id AS id
         FROM conversation_participants cp
         WHERE cp.user_id = $1::int
           AND EXISTS (
               SELECT 1 FROM conversation_participants cp_admin
               JOIN users u_admin ON u_admin.id = cp_admin.user_id
               WHERE cp_admin.conversation_id = cp.conversation_id
                 AND u_admin.usertype = 'admin'
           )
           AND NOT EXISTS (
               SELECT 1 FROM conversation_participants cp_other
               JOIN users u_other ON u_other.id = cp_other.user_id
               WHERE cp_other.conversation_id = cp.conversation_id
                 AND u_other.usertype != 'admin'
                 AND cp_other.user_id != $1::int
           )
           AND cp.conversation_id != $2::int`,
        [nonAdminId, sharedConvId]
    );

    const oldConversationIds = oldConvResult.rows.map(r => r.id);

    if (oldConversationIds.length === 0) {
        return;
    }

    await pool.query(
        `UPDATE private_messages
         SET conversation_id = $1::int
         WHERE conversation_id = ANY($2::int[])
           AND conversation_id != $1::int`,
        [sharedConvId, oldConversationIds]
    );

    await pool.query(
        `DELETE FROM conversation_participants
         WHERE conversation_id = ANY($1::int[])`,
        [oldConversationIds]
    );

    await pool.query(
        `DELETE FROM conversations
         WHERE id = ANY($1::int[])`,
        [oldConversationIds]
    );
}

router.get("/unread-summary", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const isAdmin = caller.usertype === "admin";
        let adminGroupLatestAt = null;
        let supportLatestIncomingAt = null;

        if (isAdmin) {
            const adminGroup = await pool.query(
                `SELECT c.id FROM conversations c
                 WHERE c.conversation_type = 'admin_group'
                 LIMIT 1`
            );
            if (adminGroup.rows.length > 0) {
                const agId = adminGroup.rows[0].id;
                const agLastMsg = await pool.query(
                    `SELECT pm.created_at, pm.sender_id
                     FROM private_messages pm
                     WHERE pm.conversation_id = $1::int
                       AND pm.sender_id != $2::int
                     ORDER BY pm.created_at DESC
                     LIMIT 1`,
                    [agId, caller.id]
                );
                if (agLastMsg.rows.length > 0) {
                    adminGroupLatestAt = agLastMsg.rows[0].created_at;
                }
            }

            const supportResult = await pool.query(
                `SELECT MAX(pm.created_at) AS latest_at
                 FROM private_messages pm
                 JOIN conversation_participants cp ON cp.conversation_id = pm.conversation_id
                 WHERE cp.user_id = $1::int
                   AND pm.sender_id != $1::int
                   AND EXISTS (
                       SELECT 1 FROM conversation_participants cp2
                       JOIN users u2 ON u2.id = cp2.user_id
                       WHERE cp2.conversation_id = pm.conversation_id
                         AND u2.usertype != 'admin'
                   )
                   AND pm.conversation_id NOT IN (
                       SELECT c3.id FROM conversations c3 WHERE c3.conversation_type = 'admin_group'
                   )`,
                [caller.id]
            );
            if (supportResult.rows.length > 0 && supportResult.rows[0].latest_at) {
                supportLatestIncomingAt = supportResult.rows[0].latest_at;
            }
        } else {
            const dockResult = await pool.query(
                `SELECT pm.created_at
                 FROM private_messages pm
                 JOIN conversation_participants cp ON cp.conversation_id = pm.conversation_id
                 WHERE cp.user_id = $1::int
                   AND pm.sender_id != $1::int
                   AND EXISTS (
                       SELECT 1 FROM conversation_participants cp2
                       JOIN users u2 ON u2.id = cp2.user_id
                       WHERE cp2.conversation_id = pm.conversation_id
                         AND u2.usertype = 'admin'
                   )
                 ORDER BY pm.created_at DESC
                 LIMIT 1`,
                [caller.id]
            );
            if (dockResult.rows.length > 0) {
                supportLatestIncomingAt = dockResult.rows[0].created_at;
            }
        }

        res.json({
            admin_group_latest_at: adminGroupLatestAt,
            support_latest_incoming_at: supportLatestIncomingAt,
        });
    } catch (err) {
        console.error("Error fetching unread summary:", err.message);
        res.status(500).json({ error: "Failed to fetch unread summary" });
    }
});

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
                ) AS last_message_at,
                (
                    SELECT pm.sender_id
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
                ) AS last_message_sender_id,
                (
                    SELECT pm.created_at
                    FROM private_messages pm
                    JOIN conversations c ON c.id = pm.conversation_id
                    JOIN conversation_participants cp ON cp.conversation_id = c.id
                    WHERE cp.user_id = u.id
                      AND pm.sender_id = u.id
                      AND c.id IN (
                          SELECT cp2.conversation_id
                          FROM conversation_participants cp2
                          WHERE cp2.user_id = $1::int
                      )
                    ORDER BY pm.created_at DESC
                    LIMIT 1
                ) AS last_incoming_message_at
            FROM users u
            WHERE u.id != $1::int
              ${caller.usertype === "admin" ? " AND u.usertype != 'admin'" : ""}
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
// Helpers — Admin Group Chat
// ---------------------------------------------------------------------------

async function getOrCreateAdminGroup() {
    const existing = await pool.query(
        `SELECT c.id FROM conversations c
         WHERE c.conversation_type = 'admin_group'
         LIMIT 1`
    );
    let conversationId;
    if (existing.rows.length > 0) {
        conversationId = existing.rows[0].id;
    } else {
        const admins = await pool.query("SELECT id FROM users WHERE usertype = 'admin'");
        if (admins.rows.length === 0) {
            throw new Error("NO_ADMINS");
        }

        const convResult = await pool.query(
            `INSERT INTO conversations (conversation_type) VALUES ('admin_group') RETURNING id`
        );
        conversationId = convResult.rows[0].id;

        const values = [conversationId];
        const placeholders = [];
        admins.rows.forEach((admin, i) => {
            placeholders.push(`($1::int, $${i + 2}::int)`);
            values.push(admin.id);
        });
        await pool.query(
            `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${placeholders.join(", ")} ON CONFLICT (conversation_id, user_id) DO NOTHING`,
            values
        );
    }

    const allAdmins = await pool.query("SELECT id FROM users WHERE usertype = 'admin'");
    if (allAdmins.rows.length > 0) {
        const existingParticipants = await pool.query(
            `SELECT user_id FROM conversation_participants WHERE conversation_id = $1::int`,
            [conversationId]
        );
        const existingIds = new Set(existingParticipants.rows.map((r) => r.user_id));
        const missingAdmins = allAdmins.rows.filter((a) => !existingIds.has(a.id));
        if (missingAdmins.length > 0) {
            const values = [conversationId];
            const placeholders = [];
            missingAdmins.forEach((admin, i) => {
                placeholders.push(`($1::int, $${i + 2}::int)`);
                values.push(admin.id);
            });
            await pool.query(
                `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${placeholders.join(", ")} ON CONFLICT (conversation_id, user_id) DO NOTHING`,
                values
            );
        }
    }

    return conversationId;
}

function requireAdmin(caller) {
    if (!caller || caller.usertype !== "admin") {
        const err = new Error("FORBIDDEN");
        err.status = 403;
        throw err;
    }
}

router.get("/admin-group", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        requireAdmin(caller);

        const conversationId = await getOrCreateAdminGroup();

        const details = await pool.query(
            `SELECT
                pm.message AS last_message,
                pm.sender_id AS last_message_sender_id,
                pm.created_at AS last_message_at
             FROM private_messages pm
             WHERE pm.conversation_id = $1::int
             ORDER BY pm.created_at DESC
             LIMIT 1`,
            [conversationId]
        );

        res.json({
            conversation_id: conversationId,
            last_message: details.rows[0]?.last_message ?? null,
            last_message_sender_id: details.rows[0]?.last_message_sender_id ?? null,
            last_message_at: details.rows[0]?.last_message_at ?? null,
        });
    } catch (err) {
        if (err.message === "FORBIDDEN") {
            return res.status(403).json({ error: "FORBIDDEN" });
        }
        if (err.message === "NO_ADMINS") {
            return res.status(404).json({ error: "NO_ADMINS" });
        }
        console.error("Error fetching admin group:", err.message);
        res.status(500).json({ error: "Failed to fetch admin group" });
    }
});

router.post("/admin-group/messages", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        requireAdmin(caller);

        const body = String(req.body?.message ?? "").trim();
        const attachmentUrls = Array.isArray(req.body?.attachment_urls)
            ? req.body.attachment_urls.filter((u) => typeof u === "string")
            : [];
        if (!body && attachmentUrls.length === 0) {
            return res.status(400).json({ error: "EMPTY_MESSAGE" });
        }
        if (body.length > 2000) {
            return res.status(400).json({ error: "MESSAGE_TOO_LONG" });
        }

        const conversationId = await getOrCreateAdminGroup();

        const insert = await pool.query(
            `INSERT INTO private_messages (conversation_id, sender_id, message, attachment_urls)
             VALUES ($1::int, $2::int, $3, $4::jsonb)
             RETURNING id, created_at`,
            [conversationId, caller.id, body, JSON.stringify(attachmentUrls)]
        );

        const newMessage = insert.rows[0];

        res.status(201).json({
            id: newMessage.id,
            conversation_id: conversationId,
            message: body,
            attachment_urls: attachmentUrls,
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
        if (err.message === "FORBIDDEN") {
            return res.status(403).json({ error: "FORBIDDEN" });
        }
        if (err.message === "NO_ADMINS") {
            return res.status(404).json({ error: "NO_ADMINS" });
        }
        console.error("Error sending admin group message:", err.message);
        res.status(500).json({ error: "Failed to send message" });
    }
});

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
                    SELECT pm.sender_id
                    FROM private_messages pm
                    WHERE pm.conversation_id = c.id
                    ORDER BY pm.created_at DESC
                    LIMIT 1
                ) AS last_message_sender_id,
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

        const otherUser = await pool.query(
            "SELECT id, usertype FROM users WHERE id = $1::int",
            [otherUserId]
        );
        if (otherUser.rows.length === 0) {
            return res.status(404).json({ error: "USER_NOT_FOUND" });
        }

        const isAdminCaller = caller.usertype === "admin";
        const isAdminOther = otherUser.rows[0].usertype === "admin";

        if (isAdminCaller !== isAdminOther) {
            const nonAdminId = isAdminCaller ? otherUserId : caller.id;
            let sharedConvId;
            try {
                sharedConvId = await getOrCreateSharedAdminConversation(nonAdminId);
            } catch (err) {
                if (err.message === "NO_ADMINS") {
                    return res.status(404).json({ error: "NO_ADMINS" });
                }
                throw err;
            }

            await migrateOldAdminMessages(sharedConvId, nonAdminId);

            return res.json({ conversation_id: sharedConvId });
        }

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

router.post("/dock/send", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        if (caller.usertype === "admin") {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        const body = String(req.body?.message ?? "").trim();
        const attachmentUrls = Array.isArray(req.body?.attachment_urls)
            ? req.body.attachment_urls.filter((u) => typeof u === "string")
            : [];
        if (!body && attachmentUrls.length === 0) {
            return res.status(400).json({ error: "EMPTY_MESSAGE" });
        }
        if (body.length > 2000) {
            return res.status(400).json({ error: "MESSAGE_TOO_LONG" });
        }

        let sharedConvId;
        try {
            sharedConvId = await getOrCreateSharedAdminConversation(caller.id);
        } catch (err) {
            if (err.message === "NO_ADMINS") {
                return res.status(404).json({ error: "NO_ADMINS" });
            }
            throw err;
        }

        await migrateOldAdminMessages(sharedConvId, caller.id);

        const insert = await pool.query(
            `INSERT INTO private_messages (conversation_id, sender_id, message, attachment_urls)
             VALUES ($1::int, $2::int, $3, $4::jsonb)
             RETURNING id, created_at`,
            [sharedConvId, caller.id, body, JSON.stringify(attachmentUrls)]
        );

        const newMessage = insert.rows[0];

        await recordActivity(req, {
            action: "create",
            entity: "private_message",
            entity_id: newMessage.id,
            summary: `Sent dock support message #${newMessage.id} in shared admin conversation #${sharedConvId}`,
        });

        res.status(201).json({
            id: newMessage.id,
            conversation_id: sharedConvId,
            message: body,
            attachment_urls: attachmentUrls,
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
        console.error("Error sending dock message:", err.message);
        res.status(500).json({ error: "Failed to send message" });
    }
});

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

        const participant = await pool.query(
            `SELECT id FROM conversation_participants
             WHERE conversation_id = $1::int AND user_id = $2::int`,
            [conversationId, caller.id]
        );
        if (participant.rows.length === 0) {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        const body = String(req.body?.message ?? "").trim();
        const attachmentUrls = Array.isArray(req.body?.attachment_urls)
            ? req.body.attachment_urls.filter((u) => typeof u === "string")
            : [];
        if (!body && attachmentUrls.length === 0) {
            return res.status(400).json({ error: "EMPTY_MESSAGE" });
        }
        if (body.length > 2000) {
            return res.status(400).json({ error: "MESSAGE_TOO_LONG" });
        }

        const insert = await pool.query(
            `INSERT INTO private_messages (conversation_id, sender_id, message, attachment_urls)
             VALUES ($1::int, $2::int, $3, $4::jsonb)
             RETURNING id, created_at`,
            [conversationId, caller.id, body, JSON.stringify(attachmentUrls)]
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
            attachment_urls: attachmentUrls,
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