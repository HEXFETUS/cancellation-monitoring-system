import pool from "../config/db.js";

/**
 * Block delete (or any restricted) actions when the calling user has a
 * disallowed role. Authentication middleware establishes req.user before
 * this guard runs; client-supplied user IDs must never decide permissions.
 */
export function blockRoles(disallowedRoles, options = {}) {
    const { errorMessage = "Your role doesn't allow this action" } = options;
    const blocked = new Set(disallowedRoles);

    return async function roleGuardMiddleware(req, res, next) {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: "authentication_required" });

        try {
            const result = await pool.query(
                "SELECT usertype FROM users WHERE id = $1::int",
                [Number(userId)]
            );
            const role = result.rows[0]?.usertype;
            if (role && blocked.has(role)) {
                return res.status(403).json({ error: errorMessage });
            }
            return next();
        } catch (err) {
            console.error("role guard lookup failed:", err.message);
            return res.status(503).json({ error: "authorization_unavailable" });
        }
    };
}
