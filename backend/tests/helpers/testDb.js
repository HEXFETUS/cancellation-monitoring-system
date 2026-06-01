// In-memory test database for the backend test suite.
//
// Backed by pg-mem so we never need a real Postgres instance to run the
// vitest suite. The pool exported here is a drop-in for `src/config/db.js`
// and is wired up by `vi.mock("../src/config/db.js", ...)` in the test
// files. We keep a single pg-mem instance for the worker process and rely
// on `db.backup()` / `restore()` between tests to isolate state.

import { newDb } from "pg-mem";

let state = null; // { mem, pool, schemaBackup }

const SCHEMA_DDL = `
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        usertype VARCHAR(50) NOT NULL,
        password VARCHAR(255),
        position VARCHAR(255) DEFAULT '',
        department VARCHAR(255) DEFAULT '',
        profile_picture VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE operator_list (
        id SERIAL PRIMARY KEY,
        operator VARCHAR(255) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        parent_operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE booth_info (
        id SERIAL PRIMARY KEY,
        booth_code VARCHAR(100) NOT NULL,
        coordinate VARCHAR(255),
        location VARCHAR(255),
        operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE pos_records (
        id SERIAL PRIMARY KEY,
        device_no VARCHAR(100) NOT NULL,
        serial_number VARCHAR(100) NOT NULL,
        area VARCHAR(255),
        status VARCHAR(100) DEFAULT 'Active',
        booth_id INTEGER REFERENCES booth_info(id) ON DELETE SET NULL,
        operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sticker BOOLEAN DEFAULT false
    );

    -- repair_records and diagnosis_logs are created by init.js in production
    -- (see backend/src/config/init.js). The GET /api/pos query LEFT JOINs
    -- them via a nested LATERAL to surface the latest diagnosis status.
    -- Tests don't seed rows here, so the LATERAL yields NULL and tests
    -- continue to assert against the operator/POS shape only.
    CREATE TABLE diagnosis_list (
        id SERIAL PRIMARY KEY,
        diagnosis VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE repair_records (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        pos_record_id INTEGER REFERENCES pos_records(id) ON DELETE SET NULL,
        ntc BOOLEAN DEFAULT false,
        operator_id INTEGER REFERENCES operator_list(id) ON DELETE SET NULL,
        diagnosis_id INTEGER REFERENCES diagnosis_list(id) ON DELETE SET NULL,
        delivered_by VARCHAR(255),
        with_charger BOOLEAN DEFAULT false,
        with_box BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'Pending',
        forwarded BOOLEAN DEFAULT false,
        released BOOLEAN DEFAULT false,
        re_repair BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE diagnosis_logs (
        id SERIAL PRIMARY KEY,
        repair_record_id INTEGER NOT NULL REFERENCES repair_records(id) ON DELETE CASCADE,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        requested_by VARCHAR(255),
        pos_diagnosis VARCHAR(255),
        repaired_by VARCHAR(255),
        remarks TEXT,
        status VARCHAR(50),
        forwarded_at TIMESTAMP,
        returned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE billing_transmittals (
        id SERIAL PRIMARY KEY,
        billing_code VARCHAR(100) NOT NULL,
        diagnosis_log_id INTEGER REFERENCES diagnosis_logs(id) ON DELETE SET NULL,
        received_by VARCHAR(255),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        repair_record_id INTEGER REFERENCES repair_records(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE released_logs (
        id SERIAL PRIMARY KEY,
        billing_transmittal_id INTEGER REFERENCES billing_transmittals(id) ON DELETE SET NULL,
        repair_record_id INTEGER REFERENCES repair_records(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Bulletin Board chat (group chat). Mirrors the production columns added
    -- by init.js so any test that touches /api/bulletin or imports the
    -- bulletin route doesn't trip over a missing column.
    CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        attachment_url TEXT,
        attachment_urls TEXT DEFAULT '[]',
        reply TEXT,
        replied_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        replied_at TIMESTAMP,
        is_read BOOLEAN DEFAULT false,
        is_pinned BOOLEAN DEFAULT false,
        reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE bulletin_read_markers (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        last_read_message_id INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

function init() {
    if (state) return state;

    const mem = newDb({
        // NOTE: do NOT enable `autoCreateForeignKeyIndices` here. It causes
        // pg-mem's planner to attempt index lookups across the LEFT JOINs in
        // the POS_SELECT and the route's literal-IN-CTE clause for
        // `as_operator_id`, which fails with
        // "Not supported: lookups on joins". Without the flag, the planner
        // takes a simpler path that handles the same query correctly. The
        // ::int casts in the routes work either way.
    });

    // Register a no-op `pg_get_serial_sequence` so any code paths that
    // probe for sequence names don't blow up on pg-mem.
    mem.public.registerFunction({
        name: "pg_get_serial_sequence",
        args: ["text", "text"],
        returns: "text",
        implementation: (table, _col) => `${table}_id_seq`,
    });

    // pg-mem ships only a tiny subset of Postgres builtins. The pos.routes
    // duplicate-name check runs `LOWER(TRIM(operator))` against
    // `operator_list.operator` (a VARCHAR), which pg-mem reports as
    // `function trim(character varying) does not exist`. Register a
    // permissive TRIM that mirrors Postgres semantics for the strings we
    // actually pass through these routes.
    mem.public.registerFunction({
        name: "trim",
        args: ["text"],
        returns: "text",
        implementation: (s) => (s == null ? null : String(s).trim()),
    });

    // pg-mem doesn't ship `NULLIF` for VARCHAR. The pos.routes operator-list
    // SELECT uses `WHERE NULLIF(TRIM(operator), '') IS NOT NULL` to skip
    // rows whose operator name is blank. Register a faithful 2-arg variant.
    mem.public.registerFunction({
        name: "nullif",
        args: ["text", "text"],
        returns: "text",
        implementation: (a, b) => (a === b ? null : a),
    });
    mem.public.registerFunction({
        name: "trim",
        args: ["text", "text"],
        returns: "text",
        // Postgres `trim(s, chars)` strips any character in `chars` from both
        // ends. The route only ever passes a single space class, but be
        // faithful to the contract.
        implementation: (s, chars) => {
            if (s == null) return null;
            const set = new Set(String(chars ?? " ").split(""));
            const arr = String(s).split("");
            let lo = 0;
            let hi = arr.length;
            while (lo < hi && set.has(arr[lo])) lo++;
            while (hi > lo && set.has(arr[hi - 1])) hi--;
            return arr.slice(lo, hi).join("");
        },
    });

    mem.public.none(SCHEMA_DDL);

    const { Pool } = mem.adapters.createPg();
    const pool = new Pool();

    const schemaBackup = mem.backup();
    state = { mem, pool, schemaBackup };
    return state;
}

// Eagerly initialise so the pool is ready before any test file imports it.
init();

export const pool = state.pool;
export const mem = state.mem;

export function resetDb() {
    if (!state) return;
    state.schemaBackup.restore();
}

export default pool;
