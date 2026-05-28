import pool from "../config/db.js";

/**
 * Block delete (or any restricted) actions when the calling user has a
 * disallowed role. The user id is read from query (?user_id=) or body
 * (user_id field) — neither is authenticated yet, but it's a safety net
 * until proper auth middleware lands.
 */
export function blockRoles(disallowedRoles, options = {}) {
    const { errorMessage = "Your role doesn't allow this action" } = options;
    const blocked = new Set(disallowedRoles);

    return async function roleGuardMiddleware(req, res, next) {
        const userId =
            req.query?.user_id ??
            req.body?.user_id ??
            req.headers?.["x-user-id"];

        // No id provided — let the request through. We can't make a decision.
        // Real auth middleware will replace this later.
        if (!userId) return next();

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
            // Don't accidentally block real traffic if our own lookup throws.
            return next();
        }
    };
}
