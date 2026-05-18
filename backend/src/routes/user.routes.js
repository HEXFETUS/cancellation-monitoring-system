import express from "express";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const router = express.Router();

const VALID_USER_TYPES = new Set(["admin", "csr", "operator"]);

function validateUserInput({ name, email, usertype }) {
    if (!name?.trim() || !email?.trim() || !VALID_USER_TYPES.has(usertype)) {
        return "Name, email, and a valid user type are required";
    }

    return null;
}

// GET /api/users - Get all users
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, usertype FROM users ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching users:", err.message);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// PUT /api/users/:id - Update a user
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, usertype } = req.body;
        const validationError = validateUserInput({ name, email, usertype });

        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const result = await pool.query(
            "UPDATE users SET name = $1, email = $2, usertype = $3 WHERE id = $4 RETURNING id, name, email, usertype",
            [name.trim(), email.trim(), usertype, id]
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

        if (!newPassword?.trim()) {
            return res.status(400).json({ error: "New password is required" });
        }

        const hashedPassword = await bcrypt.hash(newPassword.trim(), 12);

        const result = await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, email, usertype",
            [hashedPassword, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

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