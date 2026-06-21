// Bug condition exploration test for the main/sub operator visibility fix.
//
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
//
// This file encodes Property 1 from the design's Correctness Properties:
// "for any admin write W that attaches a child to operator profile P on the
// fixed code, P.parent_operator_id IS NULL after commit, GET /api/users/me
// reflects that, and GET /api/pos?user_id=U.id returns the union of P's
// records and its subs' records."
//
// On UNFIXED code the test is EXPECTED TO FAIL — that failure is the
// confirmation that the bug exists. Cases A and B should fail with HTTP 400
// "Parent must be a main operator (one level of nesting only)"; Case C
// should fail because GET /api/pos returns a strict subset (only HEXA-005's
// own records).
//
// We use fast-check as a SCOPED property-based test. The "input space" for
// the bug condition is small — the design's `isBugCondition(X)` pins a
// concrete counterexample (HEXA-001 main, HEXA-005 sub of HEXA-001, two
// children of HEXA-005, Boss JV linked to HEXA-005). The fast-check
// generators only vary the leaf inputs that the admin payload accepts —
// the new operator's name, the leaf Q's name — keeping the bug condition
// fixed by construction.

import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import request from "supertest";

import { pool, resetDb } from "./helpers/testDb.js";
import { seedBuggyGraph, seedLeafQ } from "./helpers/seedBuggyGraph.js";

// Replace the production pg pool with the in-memory pg-mem pool BEFORE the
// route files (and `server.js`) read `../config/db.js`. The mock path is
// resolved relative to this test file; the application imports the same
// underlying module via `../config/db.js`.
vi.mock("../src/config/db.js", async () => {
    const m = await import("./helpers/testDb.js");
    return {
        default: m.pool,
        pool: m.pool,
        dbState: { status: "ok", lastError: null },
        pingDatabase: async () => true,
    };
});

// Import the Express app AFTER the mock is registered so it picks up the
// in-memory pool. server.js skips the listen()/initDatabase() bootstrap
// when NODE_ENV === "test" (vitest sets this automatically).
const { default: app } = await import("../server.js");

// Names that already exist in the seeded buggy graph — the generator must
// avoid collisions with these or POST /api/pos/operators returns the
// existing-name 400 (which is correct, but unrelated to the bug).
const SEEDED_NAMES = new Set(["HEXA-001", "HEXA-005", "HEXA-101", "HEXA-102", "HEXA-LEAF-Q"]);

const operatorNameArb = fc
    .stringMatching(/^[A-Z]{2,5}-[0-9]{3,4}$/)
    .filter((n) => !SEEDED_NAMES.has(n));

beforeEach(() => {
    resetDb();
});

/* =========================================================================
   Case A — Single-add under sub-parent
   ---------------------------------------------------------------------------
   Seed the buggy graph so HEXA-005 has parent=HEXA-001 (i.e. is itself a
   sub) AND already has children. Issue POST /api/pos/operators with
   `parent_operator_id = HEXA-005.id`. Property 1 says: 201 returned, and
   the parent row is auto-promoted (parent_operator_id IS NULL).
========================================================================= */
describe("Property 1, Case A — POST /api/pos/operators with sub-as-parent", () => {
    it("auto-promotes the chosen parent and creates the new sub", async () => {
        await fc.assert(
            fc.asyncProperty(operatorNameArb, async (newOpName) => {
                resetDb();
                const seed = await seedBuggyGraph(pool);

                const res = await request(app)
                    .post("/api/pos/operators")
                    .send({ operator: newOpName, parent_operator_id: seed.subId });

                // Expected: HTTP 201 with the new row attached to HEXA-005.
                // On unfixed code: HTTP 400 "Parent must be a main operator
                // (one level of nesting only)".
                expect(res.status).toBe(201);
                expect(res.body).toMatchObject({
                    operator: newOpName,
                    parent_operator_id: seed.subId,
                });

                // Expected: HEXA-005 is now main (parent_operator_id IS NULL).
                // On unfixed code: still pointing at HEXA-001 because the
                // route rejected before any UPDATE could run.
                const parentAfter = await pool.query(
                    "SELECT parent_operator_id FROM operator_list WHERE id = $1::int",
                    [seed.subId]
                );
                expect(parentAfter.rows[0].parent_operator_id).toBeNull();
            }),
            { numRuns: 5 }
        );
    });
});

/* =========================================================================
   Case B — Per-row re-parent under sub-parent
   ---------------------------------------------------------------------------
   Same buggy graph plus a separate leaf Q with parent=NULL. Issue
   PATCH /api/pos/operators/:Q.id with `parent_operator_id = HEXA-005.id`.
   Property 1 says: 200 returned, and HEXA-005 auto-promoted.
========================================================================= */
describe("Property 1, Case B — PATCH /api/pos/operators/:id with sub-as-parent", () => {
    it("auto-promotes the chosen parent and re-parents the leaf", async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                resetDb();
                const seed = await seedBuggyGraph(pool);
                const qId = await seedLeafQ(pool);

                const res = await request(app)
                    .patch(`/api/pos/operators/${qId}`)
                    .send({ parent_operator_id: seed.subId });

                // Expected: HTTP 200 with Q now pointing at HEXA-005.
                // On unfixed code: HTTP 400.
                expect(res.status).toBe(200);
                expect(res.body).toMatchObject({
                    id: qId,
                    parent_operator_id: seed.subId,
                });

                // Expected: HEXA-005 promoted (parent_operator_id IS NULL).
                const parentAfter = await pool.query(
                    "SELECT parent_operator_id FROM operator_list WHERE id = $1::int",
                    [seed.subId]
                );
                expect(parentAfter.rows[0].parent_operator_id).toBeNull();
            }),
            { numRuns: 3 }
        );
    });
});

/* =========================================================================
   Case C — End-to-end visibility on the buggy state
   ---------------------------------------------------------------------------
   Seed the buggy graph (HEXA-005 sub of HEXA-001 with HEXA-101 and HEXA-102
   children, plus pos_records for all three). Trigger any admin write that
   attaches a child to HEXA-005 (we use Case A here — the same shape as the
   reported scenario). Then verify the visibility flow:
     - GET /api/users/me?id=Boss JV.id  →  parent_operator_id IS NULL
     - GET /api/pos?user_id=Boss JV.id  →  union of records for
       { HEXA-005.id, HEXA-101.id, HEXA-102.id }
========================================================================= */
describe("Property 1, Case C — visibility flow after admin write", () => {
    it("/api/users/me reflects the healed state and /api/pos returns the union", async () => {
        await fc.assert(
            fc.asyncProperty(operatorNameArb, async (triggerOpName) => {
                resetDb();
                const seed = await seedBuggyGraph(pool);

                // Admin write that should heal the invariant.
                const writeRes = await request(app)
                    .post("/api/pos/operators")
                    .send({ operator: triggerOpName, parent_operator_id: seed.subId });

                // Sanity: the admin write itself must succeed before the
                // visibility flow can be expected to look healed.
                expect(writeRes.status).toBe(201);

                // (1) GET /api/users/me should now show parent_operator_id = NULL.
                const meRes = await request(app)
                    .get("/api/users/me")
                    .query({ id: seed.userId });
                expect(meRes.status).toBe(200);
                expect(meRes.body).toMatchObject({
                    id: seed.userId,
                    operator_id: seed.subId,
                    parent_operator_id: null,
                });

                // (2) GET /api/pos?user_id=... should include the union of
                // pos_records for HEXA-005, HEXA-101, HEXA-102.
                const posRes = await request(app)
                    .get("/api/pos")
                    .query({ user_id: seed.userId });
                expect(posRes.status).toBe(200);

                const expectedOpIds = new Set([seed.subId, seed.c1Id, seed.c2Id]);
                const returnedOpIds = new Set(posRes.body.map((r) => r.operator_id));
                expect(returnedOpIds).toEqual(expectedOpIds);

                // The seed inserts 2 pos_records per operator (6 total).
                expect(posRes.body.length).toBe(6);
            }),
            { numRuns: 3 }
        );
    });
});
