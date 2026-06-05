import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

/**
 * Module-level state surfaced to the health endpoint so the frontend (and
 * `pnpm dev` logs) can tell the difference between:
 *   - "starting"  : we haven't successfully talked to Postgres yet
 *   - "ok"        : last connection attempt succeeded
 *   - "down"      : last connection attempt failed (we keep retrying)
 */
export const dbState = {
    status: "starting",
    lastError: null,
    lastConnectedAt: null,
    attempt: 0,
};

// Reasonable defaults so a single misconfigured env var doesn't hang Node
// forever. Supabase's pooler normally answers in well under 5s; 10s is a
// generous ceiling that also catches DNS timeouts cleanly.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 10,
});

pool.on("error", (err) => {
    // Background errors from idle clients (Supabase pooler kicking us off,
    // transient network blips, etc.) should never crash the process.
    dbState.status = "down";
    dbState.lastError = err.message;
    console.warn("[db] idle client error:", err.message);
});

/**
 * Cheap connectivity probe used during the boot retry loop and the
 * /api/health endpoint. Runs a trivial query so we exercise the full
 * connect+auth round-trip, not just the TCP socket.
 */
export async function pingDatabase(timeoutMs = 10_000) {
    const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("ping: connect timeout")), timeoutMs)
        ),
    ]);
    try {
        await client.query("select 1");
    } finally {
        client.release();
    }
}

export default pool;
