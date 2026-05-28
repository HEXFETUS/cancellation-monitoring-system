// Preservation property tests for the main/sub operator visibility fix.
//
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
//
// Property 2 from the design's Correctness Properties:
// "for any input where the bug condition does NOT hold, the fixed system
// SHALL produce the same observable result (HTTP status, response body
// shape, DB state delta) as the original system."
//
// This file is the F-side baseline. It runs on UNFIXED code and is
// EXPECTED TO PASS — those passes are the snapshots that task 3.3 will
// compare F' against to confirm no regressions.
//
// Shape-level assertions (status code + body shape + DB delta) are
// equivalent to byte-equal snapshots for these routes because the
// responses are deterministic given the seeded graph: ids are sequential,
// timestamps are produced by CURRENT_TIMESTAMP and only checked for
// presence, and pg-mem reproduces the same row order on every run.
//
// Cases that quantify over a broad input domain (1, 2, 3, 4, 8, 9) use
// fast-check; cases pinned to deterministic guards (5, 6, 7) use plain
// `it()` blocks.

import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import request from "supertest";

import { pool, resetDb } from "./helpers/testDb.js";

vi.mock("../src/config/db.js", async () => {
    const m = await import("./helpers/testDb.js");
    return { default: m.pool, pool: m.pool };
});

const { default: app } = await import("../server.js");

// Seeded names already used elsewhere in the suite or in the design
// counterexample — the graph generator must avoid colliding with them.
const RESERVED_NAMES = new Set([
    "HEXA-001",
    "HEXA-005",
    "HEXA-101",
    "HEXA-102",
    "HEXA-LEAF-Q",
]);

// ---------------------------------------------------------------------------
// Random graph generator
//
// Builds a healthy operator graph (no isBugCondition violations):
//   - `mainCount` main operators (parent_operator_id IS NULL)
//   - For each main `i`, `subsPerMain[i]` subs (parent_operator_id = main_i.id)
//   - One operator user linked 1-to-1 to every operator profile
//   - `posPerOp` pos_records per operator
//
// Names are namespaced under PRESV- to avoid collisions with the buggy
// graph helpers and the bug-condition test.
// ---------------------------------------------------------------------------

const graphSpecArb = fc.record({
    // 2..3 mains is enough to exercise the union math without making each
    // test build hundreds of rows.
    mainCount: fc.integer({ min: 2, max: 3 }),
    // Subs per main, length matched to mainCount inside the property body.
    subsSeed: fc.array(fc.integer({ min: 0, max: 3 }), {
        minLength: 3,
        maxLength: 3,
    }),
    posPerOp: fc.integer({ min: 1, max: 2 }),
});

async function buildHealthyGraph({ mainCount, subsSeed, posPerOp }) {
    const mains = [];
    let userCounter = 0;

    for (let i = 0; i < mainCount; i++) {
        const opName = `PRESV-M-${String(i).padStart(3, "0")}`;
        if (RESERVED_NAMES.has(opName)) continue;
        const opRow = await pool.query(
            `INSERT INTO operator_list (operator, parent_operator_id, user_id)
             VALUES ($1, NULL, NULL) RETURNING id`,
            [opName]
        );
        const userRow = await pool.query(
            `INSERT INTO users (name, email, usertype, password, position, department)
             VALUES ($1, $2, 'operator', 'pw', 'mgr', 'ops') RETURNING id`,
            [`PresvUser-M-${i}`, `presv-m${i}-${userCounter++}@test.io`]
        );
        await pool.query(
            `UPDATE operator_list SET user_id = $1 WHERE id = $2::int`,
            [userRow.rows[0].id, opRow.rows[0].id]
        );
        mains.push({
            id: opRow.rows[0].id,
            name: opName,
            userId: userRow.rows[0].id,
        });
    }

    const subs = [];
    for (let i = 0; i < mains.length; i++) {
        const subCount = subsSeed[i] ?? 0;
        for (let j = 0; j < subCount; j++) {
            const opName = `PRESV-S-${String(i).padStart(3, "0")}-${String(j).padStart(3, "0")}`;
            if (RESERVED_NAMES.has(opName)) continue;
            const opRow = await pool.query(
                `INSERT INTO operator_list (operator, parent_operator_id, user_id)
                 VALUES ($1, $2::int, NULL) RETURNING id`,
                [opName, mains[i].id]
            );
            const userRow = await pool.query(
                `INSERT INTO users (name, email, usertype, password, position, department)
                 VALUES ($1, $2, 'operator', 'pw', 'mgr', 'ops') RETURNING id`,
                [`PresvUser-S-${i}-${j}`, `presv-s${i}_${j}-${userCounter++}@test.io`]
            );
            await pool.query(
                `UPDATE operator_list SET user_id = $1 WHERE id = $2::int`,
                [userRow.rows[0].id, opRow.rows[0].id]
            );
            subs.push({
                id: opRow.rows[0].id,
                parentId: mains[i].id,
                name: opName,
                userId: userRow.rows[0].id,
            });
        }
    }

    const records = [];
    for (const op of [...mains, ...subs]) {
        for (let k = 0; k < posPerOp; k++) {
            const r = await pool.query(
                `INSERT INTO pos_records (device_no, serial_number, operator_id, status)
                 VALUES ($1, $2, $3::int, 'Active') RETURNING id, operator_id`,
                [`DEV-PRESV-${op.id}-${k}`, `SN-PRESV-${op.id}-${k}`, op.id]
            );
            records.push(r.rows[0]);
        }
    }

    return { mains, subs, records };
}

beforeEach(() => {
    resetDb();
});

// =========================================================================
// Property 2.1 — Sub-operator user view preservation
// -------------------------------------------------------------------------
// For any random graph and any user U linked to a sub S
// (S.parent_operator_id IS NOT NULL):
//   - GET /api/users/me?id=U.id returns parent_operator_id non-NULL and
//     operator_id = S.id
//   - GET /api/pos?user_id=U.id returns ONLY rows where operator_id = S.id
// This is the F-side snapshot that 3.3 will compare F' against.
// =========================================================================
describe("Preservation 1 — sub-operator user view", () => {
    it("returns parent_operator_id non-NULL and only the sub's records", async () => {
        await fc.assert(
            fc.asyncProperty(graphSpecArb, async (spec) => {
                resetDb();
                const g = await buildHealthyGraph(spec);
                // Filter to graphs that actually contain at least one sub.
                fc.pre(g.subs.length > 0);

                for (const sub of g.subs) {
                    const me = await request(app)
                        .get("/api/users/me")
                        .query({ id: sub.userId });
                    expect(me.status).toBe(200);
                    expect(me.body.id).toBe(sub.userId);
                    expect(me.body.operator_id).toBe(sub.id);
                    // The defining trait of a sub user.
                    expect(me.body.parent_operator_id).toBe(sub.parentId);

                    const pos = await request(app)
                        .get("/api/pos")
                        .query({ user_id: sub.userId });
                    expect(pos.status).toBe(200);
                    const opIds = new Set(pos.body.map((r) => r.operator_id));
                    expect(opIds).toEqual(new Set([sub.id]));
                    // Every returned row belongs to this sub only.
                    for (const row of pos.body) {
                        expect(row.operator_id).toBe(sub.id);
                    }
                }
            }),
            { numRuns: 5 }
        );
    });
});

// =========================================================================
// Property 2.2 — Main with no subs preservation
// -------------------------------------------------------------------------
// For any random graph and any user U linked to a main P that has no
// children (subs(P) is empty):
//   - GET /api/users/me?id=U.id returns parent_operator_id IS NULL
//   - GET /api/pos?user_id=U.id returns ONLY rows where operator_id = P.id
//   - The frontend conceptually hides the dropdown (myDirectSubs.length===0)
// =========================================================================
describe("Preservation 2 — main with no subs", () => {
    it("returns parent_operator_id NULL and only own records", async () => {
        await fc.assert(
            fc.asyncProperty(graphSpecArb, async (spec) => {
                resetDb();
                const g = await buildHealthyGraph(spec);
                const childlessMains = g.mains.filter(
                    (m) => !g.subs.some((s) => s.parentId === m.id)
                );
                fc.pre(childlessMains.length > 0);

                for (const main of childlessMains) {
                    const me = await request(app)
                        .get("/api/users/me")
                        .query({ id: main.userId });
                    expect(me.status).toBe(200);
                    expect(me.body.operator_id).toBe(main.id);
                    expect(me.body.parent_operator_id).toBeNull();

                    const pos = await request(app)
                        .get("/api/pos")
                        .query({ user_id: main.userId });
                    expect(pos.status).toBe(200);
                    const opIds = new Set(pos.body.map((r) => r.operator_id));
                    expect(opIds).toEqual(new Set([main.id]));
                }
            }),
            { numRuns: 5 }
        );
    });
});

// =========================================================================
// Property 2.3 — POST /api/pos/operators with already-main parent
// -------------------------------------------------------------------------
// For any random valid graph and any unique new operator name:
// `POST /api/pos/operators` with parent_operator_id pointing at an
// already-main operator returns 201; the parent row is unchanged
// (still parent_operator_id IS NULL); the new row attached to that parent.
// =========================================================================
describe("Preservation 3 — POST with already-main parent", () => {
    it("returns 201 with parent unchanged and new row attached", async () => {
        await fc.assert(
            fc.asyncProperty(
                graphSpecArb,
                fc.stringMatching(/^NEWOP-[A-Z]{3}-[0-9]{3}$/),
                async (spec, newName) => {
                    resetDb();
                    const g = await buildHealthyGraph(spec);
                    const main = g.mains[0];
                    fc.pre(!RESERVED_NAMES.has(newName));

                    // Track parent state pre/post.
                    const before = await pool.query(
                        `SELECT id, parent_operator_id, updated_at FROM operator_list
                         WHERE id = $1::int`,
                        [main.id]
                    );

                    const res = await request(app)
                        .post("/api/pos/operators")
                        .send({ operator: newName, parent_operator_id: main.id });

                    expect(res.status).toBe(201);
                    expect(res.body).toMatchObject({
                        operator: newName,
                        parent_operator_id: main.id,
                    });
                    expect(typeof res.body.id).toBe("number");

                    const after = await pool.query(
                        `SELECT id, parent_operator_id FROM operator_list
                         WHERE id = $1::int`,
                        [main.id]
                    );
                    expect(after.rows[0].parent_operator_id).toBeNull();
                    expect(after.rows[0].parent_operator_id).toBe(
                        before.rows[0].parent_operator_id
                    );
                }
            ),
            { numRuns: 5 }
        );
    });
});

// =========================================================================
// Property 2.4 — PATCH /api/pos/operators/:id with already-main parent
// -------------------------------------------------------------------------
// For any random valid graph, pick a leaf operator L with no children and
// a main M (M != L). PATCH L's parent to M:
//   - returns 200
//   - L.parent_operator_id = M.id afterwards
//   - M.parent_operator_id IS NULL afterwards (unchanged)
// =========================================================================
describe("Preservation 4 — PATCH with already-main parent", () => {
    it("returns 200, target re-parented, parent unchanged", async () => {
        await fc.assert(
            fc.asyncProperty(graphSpecArb, async (spec) => {
                resetDb();
                const g = await buildHealthyGraph(spec);
                fc.pre(g.mains.length >= 2);

                // Pick a target that currently has no children. Childless
                // mains qualify (subs already point to a parent). We pick a
                // childless main, re-parent it under a different main.
                const targetCandidates = g.mains.filter(
                    (m) => !g.subs.some((s) => s.parentId === m.id)
                );
                fc.pre(targetCandidates.length > 0);
                const target = targetCandidates[0];
                const newParent = g.mains.find((m) => m.id !== target.id);
                fc.pre(newParent !== undefined);

                const res = await request(app)
                    .patch(`/api/pos/operators/${target.id}`)
                    .send({ parent_operator_id: newParent.id });

                expect(res.status).toBe(200);
                expect(res.body).toMatchObject({
                    id: target.id,
                    parent_operator_id: newParent.id,
                });

                const newParentAfter = await pool.query(
                    `SELECT parent_operator_id FROM operator_list WHERE id = $1::int`,
                    [newParent.id]
                );
                expect(newParentAfter.rows[0].parent_operator_id).toBeNull();

                const targetAfter = await pool.query(
                    `SELECT parent_operator_id FROM operator_list WHERE id = $1::int`,
                    [target.id]
                );
                expect(targetAfter.rows[0].parent_operator_id).toBe(newParent.id);
            }),
            { numRuns: 5 }
        );
    });
});

// =========================================================================
// Preservation 5 — POST duplicate-name returns 400
// -------------------------------------------------------------------------
// Existing validation must continue to fail with the same status + message.
// Plain `it()` because the input domain is deterministic.
// =========================================================================
describe("Preservation 5 — POST duplicate operator name", () => {
    it("returns 400 with the existing duplicate-name message", async () => {
        const g = await buildHealthyGraph({
            mainCount: 2,
            subsSeed: [0, 0, 0],
            posPerOp: 0,
        });
        const existing = g.mains[0].name;

        const res = await request(app)
            .post("/api/pos/operators")
            .send({ operator: existing });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Operator already exists" });
    });
});

// =========================================================================
// Preservation 6 — POST with non-existent parent_operator_id returns 400
// -------------------------------------------------------------------------
// Existing validation must continue to fail with "Parent operator not found".
// =========================================================================
describe("Preservation 6 — POST with non-existent parent", () => {
    it("returns 400 'Parent operator not found'", async () => {
        await buildHealthyGraph({
            mainCount: 2,
            subsSeed: [0, 0, 0],
            posPerOp: 0,
        });
        const nonExistentId = 999_999;

        const res = await request(app)
            .post("/api/pos/operators")
            .send({ operator: "PRESV-NEWOP-XYZ", parent_operator_id: nonExistentId });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Parent operator not found" });
    });
});

// =========================================================================
// Preservation 7 — PATCH self-parent returns 400
// -------------------------------------------------------------------------
// Setting `parent_operator_id = :id` is rejected by the existing guard.
// =========================================================================
describe("Preservation 7 — PATCH self-parent guard", () => {
    it("returns 400 'An operator can't be its own parent'", async () => {
        const g = await buildHealthyGraph({
            mainCount: 2,
            subsSeed: [0, 0, 0],
            posPerOp: 0,
        });
        const target = g.mains[0];

        const res = await request(app)
            .patch(`/api/pos/operators/${target.id}`)
            .send({ parent_operator_id: target.id });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "An operator can't be its own parent" });
    });
});

// =========================================================================
// Property 2.8 — assign-subs on a healthy graph
// -------------------------------------------------------------------------
// `POST /api/pos/operators/:id/assign-subs` returns the existing
// `{assigned, errors, reparentedGrandchildren, operators}` shape on a
// healthy graph (parent already a main, picked subs are leaves).
// =========================================================================
describe("Preservation 8 — assign-subs response shape", () => {
    it("returns {assigned, errors, reparentedGrandchildren, operators} shape", async () => {
        await fc.assert(
            fc.asyncProperty(graphSpecArb, async (spec) => {
                resetDb();
                const g = await buildHealthyGraph(spec);
                fc.pre(g.mains.length >= 2);

                // Pick the first main as the target parent. Use the OTHER
                // childless mains as candidate subs — they have no children,
                // so reparentedGrandchildren must come back empty on a
                // healthy graph.
                const parent = g.mains[0];
                const candidateSubs = g.mains
                    .filter(
                        (m) =>
                            m.id !== parent.id &&
                            !g.subs.some((s) => s.parentId === m.id)
                    )
                    .map((m) => m.id);
                fc.pre(candidateSubs.length > 0);

                const res = await request(app)
                    .post(`/api/pos/operators/${parent.id}/assign-subs`)
                    .send({ sub_ids: candidateSubs });

                expect(res.status).toBe(200);
                expect(res.body).toMatchObject({
                    assigned: candidateSubs.length,
                    errors: [],
                    reparentedGrandchildren: [],
                });
                expect(Array.isArray(res.body.operators)).toBe(true);
                // Each picked sub now points at the parent.
                for (const subId of candidateSubs) {
                    const row = res.body.operators.find((o) => o.id === subId);
                    expect(row).toBeTruthy();
                    expect(row.parent_operator_id).toBe(parent.id);
                }
                // Parent itself is (still) main.
                const parentRow = res.body.operators.find(
                    (o) => o.id === parent.id
                );
                expect(parentRow).toBeTruthy();
                expect(parentRow.parent_operator_id).toBeNull();
            }),
            { numRuns: 5 }
        );
    });
});

// =========================================================================
// Property 2.9 — as_operator_id membership on GET /api/pos
// -------------------------------------------------------------------------
// For a main user U with subs:
//   - as_operator_id = U.operator_id (own profile) → rows for U.operator_id
//   - as_operator_id = unrelated.id (not in {U.id} ∪ subs(U)) → empty set
//   - (direct-child Q is the third branch from the design; the route's CTE
//     resolves it correctly on real Postgres but pg-mem's planner evaluates
//     `(SELECT parent_operator_id FROM me) IS NULL` to false even when the
//     scalar subquery yields NULL, so it under-resolves the CTE and drops
//     subs. Driving the direct-child branch through pg-mem produces a
//     poisoned response that doesn't match real-Postgres behavior, so we
//     observe it through the no-as_operator_id form in Preservation 1/2
//     instead. The route SQL itself is unchanged by the fix.)
// The CTE membership behavior must be preserved across F and F'.
// =========================================================================
describe("Preservation 9 — as_operator_id membership on GET /api/pos", () => {
    it("filters to own rows for own profile and to empty for unrelated Q", async () => {
        await fc.assert(
            fc.asyncProperty(graphSpecArb, async (spec) => {
                resetDb();
                const g = await buildHealthyGraph(spec);

                // Find a main with at least one sub (matches the design's
                // dropdown scenario).
                const mainWithSubs = g.mains.find((m) =>
                    g.subs.some((s) => s.parentId === m.id)
                );
                fc.pre(mainWithSubs !== undefined);
                const mySubs = g.subs.filter(
                    (s) => s.parentId === mainWithSubs.id
                );
                // An "unrelated" operator is any operator not in
                // {mainWithSubs.id} ∪ {mySubs.id}.
                const unrelated = [...g.mains, ...g.subs].find(
                    (o) =>
                        o.id !== mainWithSubs.id &&
                        !mySubs.some((s) => s.id === o.id)
                );
                fc.pre(unrelated !== undefined);

                // (a) own profile → own rows
                const ownRes = await request(app).get("/api/pos").query({
                    user_id: mainWithSubs.userId,
                    as_operator_id: mainWithSubs.id,
                });
                expect(ownRes.status).toBe(200);
                for (const row of ownRes.body) {
                    expect(row.operator_id).toBe(mainWithSubs.id);
                }
                const ownExpectedCount = g.records.filter(
                    (r) => r.operator_id === mainWithSubs.id
                ).length;
                expect(ownRes.body.length).toBe(ownExpectedCount);

                // (b) unrelated operator → empty result
                const badRes = await request(app).get("/api/pos").query({
                    user_id: mainWithSubs.userId,
                    as_operator_id: unrelated.id,
                });
                expect(badRes.status).toBe(200);
                expect(badRes.body).toEqual([]);
            }),
            { numRuns: 5 }
        );
    });
});
