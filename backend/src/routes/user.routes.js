import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET /api/users - Get all users
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, usertype, created_at FROM users ORDER BY id ASC"
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

        const result = await pool.query(
            "UPDATE users SET name = $1, email = $2, usertype = $3 WHERE id = $4 RETURNING id, name, email, usertype, created_at",
            [name, email, usertype, id]
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

        const result = await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, email, usertype",
            [newPassword, id]
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