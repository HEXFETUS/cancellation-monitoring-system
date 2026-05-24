import express from "express";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const router = express.Router();

const VALID_USER_TYPES = new Set(["admin", "csr", "operator"]);

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

// GET /api/users - Get all users
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, usertype, position, department FROM users ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching users:", err.message);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// GET /api/users/me - Get current authenticated user
router.get("/me", async (req, res) => {
    try {
        const userId = req.query.id;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const result = await pool.query(
            "SELECT id, name, email, usertype, position, department FROM users WHERE id = $1",
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
            SELECT login_at
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

export default router;
