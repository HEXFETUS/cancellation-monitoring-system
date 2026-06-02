import express from "express";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { recordActivity } from "../utils/activity-log.js";

const router = express.Router();

function isBcryptHash(value) {
    return /^\$2[aby]\$\d{2}\$/.test(value);
}

function getClientIp(req) {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
        return forwardedFor.split(",")[0].trim();
    }

    return req.ip || req.socket?.remoteAddress || null;
}

// POST /api/auth/login - Authenticate a user
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username?.trim() || !password?.trim()) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        // Look up user by email. The login field is called username in the UI.
        const result = await pool.query(
            "SELECT id, name, email, usertype, position, department, profile_picture, password FROM users WHERE LOWER(email) = LOWER($1)",
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = result.rows[0];

        const passwordMatches = isBcryptHash(user.password)
            ? await bcrypt.compare(password, user.password)
            : password === user.password;

        if (!passwordMatches) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const logResult = await pool.query(
            `
            INSERT INTO user_logs (user_id, login_at, ip_address)
            VALUES ($1, CURRENT_TIMESTAMP, $2)
            RETURNING id
            `,
            [user.id, getClientIp(req)]
        );

        // Return user info (excluding password)
        await recordActivity(
            { body: { user_id: user.id } },
            {
                action: "login",
                entity: "session",
                entity_id: user.id,
                summary: `${user.name} logged in`,
            }
        );

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            usertype: user.usertype,
            position: user.position,
            department: user.department,
            profile_picture: user.profile_picture,
            user_log_id: logResult.rows[0].id,
        });
    } catch (err) {
        console.error("Error during login:", err.message);
        res.status(500).json({ error: "Authentication failed" });
    }
});

// POST /api/auth/logout - Record the current user's logout time
router.post("/logout", async (req, res) => {
    try {
        const { userId, logId } = req.body;

        if (!userId || !logId) {
            return res.status(400).json({ error: "User ID and log ID are required" });
        }

        const result = await pool.query(
            `
            UPDATE user_logs
            SET logout_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND user_id = $2
              AND logout_at IS NULL
            RETURNING id
            `,
            [logId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Open user log not found" });
        }

        await recordActivity(
            { body: { user_id: userId } },
            {
                action: "logout",
                entity: "session",
                entity_id: Number(userId) || null,
                summary: `User #${userId} logged out`,
            }
        );

        res.json({ message: "Logout recorded successfully" });
    } catch (err) {
        console.error("Error during logout:", err.message);
        res.status(500).json({ error: "Failed to record logout" });
    }
});

export default router;
