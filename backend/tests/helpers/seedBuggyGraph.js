// Seed helpers that build the counterexample state described in
// `bugfix.md` and `design.md`.
//
// The exact numeric ids in the design (HEXA-001=2, HEXA-005=5, ...,
// Boss JV=42) come from a real Postgres instance with pre-existing rows.
// pg-mem starts each suite from an empty schema, so we capture the
// generated ids and return them so the test code references operators
// by symbolic name regardless of what id pg-mem hands out.

/**
 * Seed the operator graph from the design's Bug Condition example:
 *
 *   users:
 *     Boss JV (usertype='operator')
 *
 *   operator_list:
 *     HEXA-001  (parent=NULL)            ← main
 *       └── HEXA-005 (parent=HEXA-001, user=Boss JV)  ← BUGGY: sub with subs
 *             ├── HEXA-101 (parent=HEXA-005)
 *             └── HEXA-102 (parent=HEXA-005)
 *
 *   pos_records:
 *     several rows distributed across HEXA-005, HEXA-101, HEXA-102
 */
export async function seedBuggyGraph(pool) {
    // Boss JV — the operator user whose visibility is broken.
    const u = await pool.query(
        `INSERT INTO users (name, email, usertype, password, position, department)
         VALUES ($1, $2, 'operator', $3, $4, $5)
         RETURNING id`,
        ["Boss JV", "operatorsubtest@hexa.prime", "pw", "manager", "ops"]
    );
    const userId = u.rows[0].id;

    // HEXA-001 — top-level main.
    const main = await pool.query(
        `INSERT INTO operator_list (operator, parent_operator_id, user_id)
         VALUES ('HEXA-001', NULL, NULL) RETURNING id`
    );
    const mainId = main.rows[0].id;

    // HEXA-005 — currently a sub of HEXA-001 AND has children below.
    // This is the buggy state: it violates the one-level-nesting invariant.
    const sub = await pool.query(
        `INSERT INTO operator_list (operator, parent_operator_id, user_id)
         VALUES ('HEXA-005', $1, $2) RETURNING id`,
        [mainId, userId]
    );
    const subId = sub.rows[0].id;

    // HEXA-101 and HEXA-102 — children of HEXA-005.
    const c1 = await pool.query(
        `INSERT INTO operator_list (operator, parent_operator_id, user_id)
         VALUES ('HEXA-101', $1, NULL) RETURNING id`,
        [subId]
    );
    const c1Id = c1.rows[0].id;

    const c2 = await pool.query(
        `INSERT INTO operator_list (operator, parent_operator_id, user_id)
         VALUES ('HEXA-102', $1, NULL) RETURNING id`,
        [subId]
    );
    const c2Id = c2.rows[0].id;

    // pos_records distributed across the three operator profiles whose
    // records the linked user should see once the invariant is healed.
    const records = [];
    for (const opId of [subId, c1Id, c2Id]) {
        const a = await pool.query(
            `INSERT INTO pos_records (device_no, serial_number, operator_id, status)
             VALUES ($1, $2, $3, 'Active') RETURNING id, operator_id`,
            [`DEV-${opId}-A`, `SN-${opId}-A`, opId]
        );
        const b = await pool.query(
            `INSERT INTO pos_records (device_no, serial_number, operator_id, status)
             VALUES ($1, $2, $3, 'Active') RETURNING id, operator_id`,
            [`DEV-${opId}-B`, `SN-${opId}-B`, opId]
        );
        records.push(a.rows[0], b.rows[0]);
    }

    return {
        userId,           // Boss JV's user id (analogue of 42 in the design)
        mainId,           // HEXA-001 (analogue of 2)
        subId,            // HEXA-005 (analogue of 5)  ← currently a sub w/ subs
        c1Id,             // HEXA-101 (analogue of 11)
        c2Id,             // HEXA-102 (analogue of 12)
        records,          // [{ id, operator_id }] for ids subId, c1Id, c2Id
    };
}

/**
 * Seed an additional leaf operator Q with `parent_operator_id = NULL`,
 * used by Case B (per-row re-parent).
 */
export async function seedLeafQ(pool) {
    const q = await pool.query(
        `INSERT INTO operator_list (operator, parent_operator_id, user_id)
         VALUES ('HEXA-LEAF-Q', NULL, NULL) RETURNING id`
    );
    return q.rows[0].id;
}
