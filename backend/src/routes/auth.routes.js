import express from "express";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const router = express.Router();

function isBcryptHash(value) {
    return /^\$2[aby]\$\d{2}\$/.test(value);
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
            "SELECT id, name, email, usertype, position, department, password FROM users WHERE LOWER(email) = LOWER($1)",
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

        // Return user info (excluding password)
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            usertype: user.usertype,
            position: user.position,
            department: user.department,
        });
    } catch (err) {
        console.error("Error during login:", err.message);
        res.status(500).json({ error: "Authentication failed" });
    }
});

export default router;
