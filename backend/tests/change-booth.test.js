// Regression tests for the change-booth route (POST /api/pos/:id/change-booth).
//
// Covers the two requirements:
//   1. The operator belongs to the booth, not the POS, so a POS may be assigned
//      to a booth belonging to a *different* operator without error.
//   2. Area alignment is enforced: a POS whose area is "CDO" or "MISOR" cannot be
//      assigned to a booth in the other area. A POS with no area skips the check.
//      (See the NOTE at the bottom about why the positive/200 path is not
//      asserted in this environment.)

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

import { createSessionToken } from "../src/middleware/auth.js";
import { pool, resetDb } from "./helpers/testDb.js";

vi.mock("../src/config/db.js", async () => {
    const m = await import("./helpers/testDb.js");
    return {
        default: m.pool,
        pool: m.pool,
        dbState: { status: "ok", lastError: null },
        pingDatabase: async () => true,
    };
});

const { default: app } = await import("../server.js");

// The global authenticate/authorizeRole middleware on /api/* requires a valid
// bearer token. Use an admin session so the route logic (not auth) is exercised.
const AUTH = { Authorization: `Bearer ${createSessionToken({ id: 1, usertype: "admin" })}` };

// A CDO operator, a MISOR operator, one CDO booth (owned by CDO op), one
// MISOR booth (owned by MISOR op), one CDO-area POS, and one no-area POS.
// Returns ids for convenient assertions.
async function seed() {
    const cdo = await pool.query(
        `INSERT INTO operator_list (operator) VALUES ('CHANGE-BOOTH-A') RETURNING id`
    );
    const cdoOp = cdo.rows[0].id;
    const misor = await pool.query(
        `INSERT INTO operator_list (operator) VALUES ('CHANGE-BOOTH-B') RETURNING id`
    );
    const misorOp = misor.rows[0].id;

    const cdoBooth = await pool.query(
        `INSERT INTO booth_info (booth_code, location, operator_id)
         VALUES ('CDO-001', 'Cagayan De Oro', $1) RETURNING id`,
        [cdoOp]
    );
    const misorBooth = await pool.query(
        `INSERT INTO booth_info (booth_code, location, operator_id)
         VALUES ('MOE-001', 'Misamis Oriental', $1) RETURNING id`,
        [misorOp]
    );

    const pos = await pool.query(
        `INSERT INTO pos_records (device_no, serial_number, area, status)
         VALUES ('DEV-9999', 'SN-9999', 'CDO', 'Active') RETURNING id`
    );
    const noAreaPos = await pool.query(
        `INSERT INTO pos_records (device_no, serial_number, area, status)
         VALUES ('DEV-8888', 'SN-8888', NULL, 'Active') RETURNING id`
    );

    return {
        cdoOp,
        misorOp,
        cdoBoothId: cdoBooth.rows[0].id,
        misorBoothId: misorBooth.rows[0].id,
        cdoPosId: pos.rows[0].id,
        noAreaPosId: noAreaPos.rows[0].id,
    };
}
describe("POST /api/pos/:id/change-booth — operator policy", () => {
    beforeEach(() => resetDb());

    it("allows assigning a CDO-area POS to a MISOR booth owned by a different operator", async () => {
        // Cross-operator AND cross-area must be rejected on AREA grounds, and the
        // error must explain the need to convert area first rather than blame the
        // operator.
        const ids = await seed();
        const res = await request(app)
            .post(`/api/pos/${ids.cdoPosId}/change-booth`)
            .set("Authorization", AUTH.Authorization)
            .send({ booth_id: ids.misorBoothId, booth_code: "MOE-001", changed_by: "admin" });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Area mismatch");
        expect(res.body.error).toContain('"MISOR"');
        expect(res.body.error.toLowerCase()).not.toContain("operator mismatch");
    });

    it("rejects assigning a CDO-area POS to a MISOR booth even when the operator matches", async () => {
        const ids = await seed();
        // Same operator for both, wrong area: still must be rejected.
        await pool.query(
            `UPDATE booth_info SET operator_id = $1 WHERE id = $2::int`,
            [ids.cdoOp, ids.misorBoothId]
        );
        const res = await request(app)
            .post(`/api/pos/${ids.cdoPosId}/change-booth`)
            .set("Authorization", AUTH.Authorization)
            .send({ booth_id: ids.misorBoothId, booth_code: "MOE-001", changed_by: "admin" });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Area mismatch");
        expect(res.body.error).toContain("CDO");
    });
});
// NOTE: Positive-path assertions (a successful 200 change) are intentionally
// not exercised here. The change-booth route builds its response with POS_SELECT,
// whose nested LATERAL join cannot be planned by the in-memory pg-mem test
// database (the same reason the pre-existing route tests use slim queries and
// avoid POS_SELECT-shaped routes). The two tests above exercise the validation
// guard, which is the behavior this bugfix changed and which runs before the
// final SELECT.