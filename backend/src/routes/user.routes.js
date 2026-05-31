import express from "express";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const router = express.Router();

const VALID_USER_TYPES = new Set(["admin", "csr", "operator", "purchaser"]);

function validateUserInput({ name, email, usertype, position, department }) {
    if (
        !name?.trim() ||
        !email?.trim() ||
        !VALID_USER_TYPES.has(usertype) ||
        !position?.trim() ||
        !department?.trim()
    ) {
        return "Name, email, user type, position, and department are required";
    }

    return null;
}

function validateOptionalString(value) {
    return value !== undefined && value !== null ? String(value).trim() : undefined;
}

function isBcryptHash(value) {
    return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

// GET /api/users - Get all users (includes linked operator profile, if any)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.usertype, u.position, u.department,
                    ol.id AS operator_id, ol.operator AS operator_name,
                    ol.parent_operator_id,
                    parent.operator AS parent_operator_name
             FROM users u
             LEFT JOIN operator_list ol ON ol.user_id = u.id
             LEFT JOIN operator_list parent ON parent.id = ol.parent_operator_id
             ORDER BY u.id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching users:", err.message);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// GET /api/users/me - Get current authenticated user (with linked operator profile, if any)
router.get("/me", async (req, res) => {
    try {
        const userId = req.query.id;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.usertype, u.position, u.department,
                    ol.id AS operator_id, ol.operator AS operator_name,
                    ol.parent_operator_id,
                    parent.operator AS parent_operator_name
             FROM users u
             LEFT JOIN operator_list ol ON ol.user_id = u.id
             LEFT JOIN operator_list parent ON parent.id = ol.parent_operator_id
             WHERE u.id = $1`,
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching user:", err.message);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// GET /api/users/logs - Get user login/logout history
router.get("/logs", async (_req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                ul.id,
                ul.user_id,
                COALESCE(u.name, 'Unknown User') AS user_name,
                ul.login_at,
                ul.logout_at,
                ul.ip_address,
                ul.created_at,
                ul.updated_at
            FROM user_logs ul
            LEFT JOIN users u ON u.id = ul.user_id
            ORDER BY COALESCE(ul.login_at, ul.created_at) DESC, ul.id DESC
            `
        );

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching user logs:", err.message);
        res.status(500).json({ error: "Failed to fetch user logs" });
    }
});

// GET /api/users/:id/latest-login - Get a user's most recent login time
router.get("/:id/latest-login", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT to_char(login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS login_at
            FROM user_logs
            WHERE user_id = $1
              AND login_at IS NOT NULL
            ORDER BY login_at DESC, id DESC
            LIMIT 1
            `,
            [id]
        );

        res.json({ login_at: result.rows[0]?.login_at ?? null });
    } catch (err) {
        console.error("Error fetching latest login:", err.message);
        res.status(500).json({ error: "Failed to fetch latest login" });
    }
});

// POST /api/users - Create a new user
router.post("/", async (req, res) => {
    try {
        const { name, email, password, usertype, position, department } = req.body;

        const validationError = validateUserInput({ name, email, usertype, position, department });
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        if (!password?.trim()) {
            return res.status(400).json({ error: "Password is required" });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 12);

        const result = await pool.query(
            "INSERT INTO users (name, email, password, usertype, position, department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, usertype, position, department",
            [name.trim(), email.trim(), hashedPassword, usertype, position.trim(), department.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(400).json({ error: "Email already exists" });
        }
        console.error("Error creating user:", err.message);
        res.status(500).json({ error: "Failed to create user" });
    }
});

// PUT /api/users/:id - Update a user
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, usertype, position, department } = req.body;
        const validationError = validateUserInput({ name, email, usertype, position, department });

        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const result = await pool.query(
            "UPDATE users SET name = $1, email = $2, usertype = $3, position = $4, department = $5 WHERE id = $6 RETURNING id, name, email, usertype, position, department",
            [name.trim(), email.trim(), usertype, position.trim(), department.trim(), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error updating user:", err.message);
        res.status(500).json({ error: "Failed to update user" });
    }
});

// PATCH /api/users/:id/password - Change user password
router.patch("/:id/password", async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const trimmedPassword = newPassword?.trim();

        if (!trimmedPassword) {
            return res.status(400).json({ error: "New password is required" });
        }

        const userResult = await pool.query(
            "SELECT id, password FROM users WHERE id = $1",
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const currentPassword = userResult.rows[0].password;
        const matchesCurrentPassword = isBcryptHash(currentPassword)
            ? await bcrypt.compare(trimmedPassword, currentPassword)
            : trimmedPassword === currentPassword;

        if (matchesCurrentPassword) {
            return res.status(400).json({ error: "New password cannot be the same as the current password." });
        }

        const hashedPassword = await bcrypt.hash(trimmedPassword, 12);

        const result = await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, email, usertype, position, department",
            [hashedPassword, id]
        );

        res.json({ message: "Password updated successfully", user: result.rows[0] });
    } catch (err) {
        console.error("Error changing password:", err.message);
        res.status(500).json({ error: "Failed to change password" });
    }
});

// DELETE /api/users/:id - Delete a user
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM users WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error("Error deleting user:", err.message);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// PATCH /api/users/:id/operator - Link or unlink an operator profile to this user.
// Body: { operator_id: number | null }
// Operator profiles can be linked to at most one user account.
router.patch("/:id/operator", async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isFinite(userId)) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        const { operator_id } = req.body ?? {};
        const targetOperatorId =
            operator_id === null || operator_id === undefined || operator_id === ""
                ? null
                : Number(operator_id);

        // Confirm user exists and is an operator role
        const userCheck = await pool.query(
            "SELECT id, usertype FROM users WHERE id = $1::int",
            [userId]
        );
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        if (userCheck.rows[0].usertype !== "operator") {
            return res.status(400).json({
                error: "Only operator users can be linked to an operator profile",
            });
        }

        // Clear any prior link to keep the unique constraint happy. This is a
        // 1-to-1 relationship: one user ↔ at most one operator profile.
        await pool.query(
            "UPDATE operator_list SET user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1::int",
            [userId]
        );

        if (targetOperatorId !== null) {
            // Validate the target profile isn't already taken by someone else.
            const opCheck = await pool.query(
                "SELECT id, user_id FROM operator_list WHERE id = $1::int",
                [targetOperatorId]
            );
            if (opCheck.rows.length === 0) {
                return res.status(404).json({ error: "Operator profile not found" });
            }
            if (opCheck.rows[0].user_id && opCheck.rows[0].user_id !== userId) {
                return res.status(409).json({
                    error: "That operator profile is already linked to another user",
                });
            }

            await pool.query(
                "UPDATE operator_list SET user_id = $1::int, updated_at = CURRENT_TIMESTAMP WHERE id = $2::int",
                [userId, targetOperatorId]
            );
        }

        // Return the updated user row with linkage details
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.usertype, u.position, u.department,
                    ol.id AS operator_id, ol.operator AS operator_name
             FROM users u
             LEFT JOIN operator_list ol ON ol.user_id = u.id
             WHERE u.id = $1::int`,
            [userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("PATCH user operator error:", err.message);
        res.status(500).json({ error: "Failed to update operator linkage" });
    }
});

// PATCH /api/users/:id/name - User updates their own display name
// Allows the operator (or any user) to change just their `name` without
// touching email, role, etc. Caller must include `user_id` in the body
// matching the path id — this is a soft check until proper auth middleware
// exists; we mainly want to prevent accidental cross-account updates.
router.patch("/:id/name", async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        if (!Number.isFinite(targetId)) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        const { name, user_id } = req.body ?? {};
        const trimmed = String(name ?? "").trim();
        if (!trimmed) {
            return res.status(400).json({ error: "Name is required" });
        }
        if (trimmed.length > 255) {
            return res.status(400).json({ error: "Name is too long" });
        }
        if (user_id !== undefined && Number(user_id) !== targetId) {
            return res.status(403).json({ error: "You can only update your own name" });
        }

        const result = await pool.query(
            `UPDATE users SET name = $1 WHERE id = $2::int
             RETURNING id, name, email, usertype, position, department`,
            [trimmed, targetId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("PATCH user name error:", err.message);
        res.status(500).json({ error: "Failed to update name" });
    }
});

export default router;
