# Implementation Plan

## Overview

This bugfix corrects asymmetric enforcement of the one-level-nesting invariant on the two admin write paths in `backend/src/routes/pos.routes.js` (`POST /api/pos/operators` and `PATCH /api/pos/operators/:id`). Both paths currently reject child-attaches whose chosen parent is itself a sub, while a third path (`POST /api/pos/operators/:id/assign-subs`) auto-promotes correctly. The fix applies the auto-promote pattern uniformly so every admin write that attaches a child to operator P first promotes P to main inside the same transaction, healing any pre-existing buggy rows on the next save and restoring the My POS sub-filter dropdown and merged `GET /api/pos` response for the linked operator user.

The work is ordered exploration-first: a property-based test pinned to the design's Bug Condition runs against the unfixed code to surface counterexamples, preservation property tests capture the F-side behavior across all non-buggy inputs, and only then does the fix land. The same tests re-run after the fix to confirm both correctness and absence of regressions.

## Task Dependency Graph

Tasks 1 and 2 are independent of each other (both run on UNFIXED code) and can execute in parallel in wave 1. Task 3.1 (the fix) depends on both — it must not land until Property 1 has been observed to FAIL and Property 2 has been observed to PASS. Tasks 3.2 and 3.3 re-run those same tests against the fixed code and depend only on 3.1, so they can execute in parallel in wave 3. Task 4 is the final checkpoint and depends on every prior task.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2"],
      "description": "Write Property 1 (Bug Condition) and Property 2 (Preservation) tests against UNFIXED code; independent of each other."
    },
    {
      "wave": 2,
      "tasks": ["3.1"],
      "description": "Implement the auto-promote fix in backend/src/routes/pos.routes.js for POST /api/pos/operators and PATCH /api/pos/operators/:id."
    },
    {
      "wave": 3,
      "tasks": ["3.2", "3.3"],
      "description": "Re-run Property 1 (must now PASS — bug fixed) and Property 2 (must still PASS — no regressions); independent of each other."
    },
    {
      "wave": 4,
      "tasks": ["4"],
      "description": "Final checkpoint — run full suite and exercise the reported scenario end-to-end."
    }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Main Operator Visibility of Subs After Admin Write
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `POST /api/pos/operators` and `PATCH /api/pos/operators/:id` reject sub-as-parent inputs and that the visibility flow under-fetches when the one-level invariant is broken
  - **Scoped PBT Approach**: For these deterministic backend bugs, scope the property to the concrete failing cases derived from the design's Bug Condition (`isBugCondition(X)`):
    - Case A — Single-add under sub-parent: seed `HEXA-001` (id=2, parent=NULL), `HEXA-005` (id=5, parent=2), then `POST /api/pos/operators` with `{operator: "HEXA-101", parent_operator_id: 5}` and assert the route returns 201 and `operator_list[id=5].parent_operator_id IS NULL` after commit
    - Case B — Per-row re-parent under sub-parent: seed the same graph plus a leaf `Q (id=99, parent=NULL)`, then `PATCH /api/pos/operators/99` with `{parent_operator_id: 5}` and assert the route returns 200 and `operator_list[id=5].parent_operator_id IS NULL` after commit
    - Case C — End-to-end visibility on buggy state: seed Boss JV (id=42) linked to HEXA-005 (id=5, parent=2) with HEXA-101 (id=11, parent=5) and HEXA-102 (id=12, parent=5) and `pos_records` for ids 5, 11, 12; then trigger any admin write (Case A or B) through the fixed route and assert `GET /api/users/me?id=42` returns `parent_operator_id = NULL` and `GET /api/pos?user_id=42` returns the union of records for ids 5, 11, 12
  - Set up a test framework for the backend (the project has none today) - add `vitest` (matches the frontend tooling) and a `test:backend` script, plus an isolated test database (real Postgres test DB or `pg-mem`) with a seed helper that builds the operator graph from the design's example
  - Use `supertest` (or equivalent) against the Express app exported from `backend/server.js` so the tests exercise real routes and middleware
  - Implement a `seedBuggyGraph(client)` helper that inserts the counterexample state from `bugfix.md` (HEXA-001/HEXA-005/Boss JV plus pos_records)
  - The test assertions MUST match the Expected Behavior Properties from the design's Property 1: after any admin write `W` that attaches a child to operator P on the fixed code, `P.parent_operator_id IS NULL`, `GET /api/users/me` reflects that, and `GET /api/pos?user_id=U.id` returns exactly the rows whose `operator_id ∈ {P.id} ∪ subs(P)`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists). Cases A and B will fail with HTTP 400 "Parent must be a main operator (one level of nesting only)"; Case C will fail because `GET /api/pos?user_id=42` returns a strict subset (only id 5 records) instead of the union
  - Document counterexamples found to understand root cause: confirm whether the failures match the hypothesized root cause (asymmetric enforcement across the three write paths) or point to a different cause
  - Mark task complete when the test is written, run, and the failure is documented in the task body or a linked test output
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Admin and Operator Flows Are Unchanged
  - **IMPORTANT**: Follow observation-first methodology — run the UNFIXED backend against the test DB for each non-bug input below, record the actual response (status, body, DB delta), then write property-based tests that assert those observations across the input domain
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `isBugCondition` returns false), as enumerated in the design's Preservation Requirements:
    - Sub-operator user: U linked to S where `S.parent_operator_id IS NOT NULL` → record `GET /api/users/me?id=U.id` and `GET /api/pos?user_id=U.id`
    - Main with no subs: U linked to P where `P.parent_operator_id IS NULL` and no Q has `parent_operator_id = P.id` → record both responses
    - Already-main parent on POST: `POST /api/pos/operators` with `parent_operator_id` pointing to a main operator → record 201 response and unchanged parent row
    - Already-main parent on PATCH: `PATCH /api/pos/operators/:id` setting parent to an already-main operator → record 200 response and unchanged parent row
    - Existing duplicate-name and missing-parent validation: `POST /api/pos/operators` with a duplicate name or non-existent `parent_operator_id` → record 400 and message
    - Self-parent guard on PATCH: `PATCH /api/pos/operators/:id` with `parent_operator_id = :id` → record 400
    - `assign-subs` bulk flow: `POST /api/pos/operators/:id/assign-subs` on a healthy graph → record `{assigned, errors, reparentedGrandchildren, operators}` shape
    - `as_operator_id` membership: `GET /api/pos?user_id=U.id&as_operator_id=Q.id` for valid Q (own profile or direct child) and invalid Q → record both
    - `PATCH /api/users/:id/operator` 1-to-1 linking → record success and conflict cases
  - Write property-based tests using `fast-check` (or `vitest`'s built-in support) capturing observed behavior patterns from the Preservation Requirements:
    - **Generator**: random connected operator graphs satisfying the one-level invariant — mains with 0..N children, random user→main and user→sub linkages, random `pos_records` distributed across operators (use seeded RNG for reproducibility)
    - **Property — sub-operator preservation**: for any random graph and any user U linked to a sub S, `GET /api/users/me?id=U.id` and `GET /api/pos?user_id=U.id` are byte-equal between F and F'
    - **Property — main-no-subs preservation**: for any random graph and any user U linked to a main with no children, both responses are byte-equal between F and F'
    - **Property — assign-subs preservation**: for any random valid `(parent, sub_ids)` pair, `POST /api/pos/operators/:id/assign-subs` returns the same body and DB delta on F and F'
    - **Property — already-main parent preservation on POST**: for any main parent and any unique new operator name, `POST /api/pos/operators` returns the same body and the parent row is unchanged on F and F'
    - **Property — already-main parent preservation on PATCH**: for any main parent and any leaf target with no children, `PATCH /api/pos/operators/:id` returns the same body and the parent row is unchanged on F and F'
    - **Property — `as_operator_id` membership preservation**: for any random user U and any Q (valid or invalid), `GET /api/pos?user_id=U.id&as_operator_id=Q.id` returns the same row set on F and F'
    - **Property — existing validation preservation**: duplicate-name on POST, missing parent on POST, and self-parent on PATCH all continue to return 400 with the same messages
  - Property-based testing generates many test cases for stronger guarantees that behavior is unchanged across the whole non-buggy input domain
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve). Snapshot the F responses so the F' run can compare against them
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 3. Fix for asymmetric one-level-nesting enforcement on `POST /api/pos/operators` and `PATCH /api/pos/operators/:id`

  - [x] 3.1 Implement the fix in `backend/src/routes/pos.routes.js`
    - Wrap `router.post("/operators", ...)` in a `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` transaction
    - Keep all existing duplicate-name validation and parent-existence validation intact (still return 400 on those failures)
    - Inside the transaction, when `parent_operator_id` is provided, `SELECT parent_operator_id FROM operator_list WHERE id = $1::int FOR UPDATE` to lock the parent row
    - Replace the current 400 rejection ("Parent must be a main operator (one level of nesting only)") with `UPDATE operator_list SET parent_operator_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::int` issued in the same transaction when the locked parent has `parent_operator_id IS NOT NULL` — mirroring the auto-promote step in `assign-subs`
    - Then `INSERT` the new operator with `parent_operator_id` pointing to the (now main) parent and `COMMIT`; return the new row with HTTP 201
    - On any error path, `ROLLBACK` and surface the error (existing 400 for invalid payloads, 500 for unexpected failures)
    - Wrap `router.patch("/operators/:id", ...)` in the same transaction pattern
    - Keep the existing self-parent guard, target-existence check, and parent-existence check (still return 400 on those failures)
    - When `parent_operator_id` is supplied, `SELECT parent_operator_id FROM operator_list WHERE id = $1::int FOR UPDATE` and replace the 400 rejection with the same `UPDATE ... SET parent_operator_id = NULL ...` auto-promote on the locked parent
    - Add a guard that prevents the patch path from creating a NEW invariant violation: if the target row currently has children (`EXISTS (SELECT 1 FROM operator_list WHERE parent_operator_id = $1::int)`) AND the patch would set its `parent_operator_id` non-NULL, reject with 400 "Operator has sub-operators; detach them before making it a sub"
    - Then `UPDATE` the target row with the new `parent_operator_id` and `COMMIT`; return the updated row with HTTP 200
    - Use `FOR UPDATE` on the parent row read in both transactions to match the locking discipline of `assign-subs` and prevent concurrent attaches from racing into a half-promoted state
    - Leave `POST /api/pos/operators/:id/assign-subs` untouched — it already implements the desired pattern
    - Leave the visibility flow untouched: do not modify `GET /api/users/me` in `backend/src/routes/user.routes.js`, the `GET /api/pos` CTE in `pos.routes.js`, or `frontend/src/modules/operator/pages/MyPosPage.tsx`
    - Do not change the `operator_list` schema, do not add a new constraint, and do not write a data migration — existing buggy rows self-heal on the next admin write that touches them
    - _Bug_Condition: isBugCondition(X) where X = (G, U), P = profile linked to U, P has at least one child Q with `Q.parent_operator_id = P.id`, AND `P.parent_operator_id IS NOT NULL` (from design Bug Condition)_
    - _Expected_Behavior: After any admin write W on the fixed code that attaches a child to P, `P.parent_operator_id IS NULL`, `GET /api/users/me` for any user linked to P returns `parent_operator_id = NULL`, the My POS page renders the sub-operator filter dropdown, and `GET /api/pos?user_id=U.id` returns the union of records for `{P.id} ∪ subs(P)` (from design Property 1)_
    - _Preservation: Sub-operator users, main-no-subs users, the bulk `assign-subs` flow, `GET /api/pos` with valid `as_operator_id`, `POST/PATCH` with already-main parent, existing duplicate/missing/self-parent validation, the Operator Profiles UI shape, `PATCH /api/users/:id/operator` linking, and the `operator_list` schema all remain unchanged (from design Preservation Requirements)_
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.4, 3.7, 3.8_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Main Operator Visibility of Subs After Admin Write
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied: P is auto-promoted, `/api/users/me` reflects the healed state, the dropdown renders, and `/api/pos` returns the union
    - Run bug condition exploration test from step 1 against the fixed code
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed) — Cases A and B return 201/200 with the parent promoted, and Case C returns the union of HEXA-005, HEXA-101, HEXA-102 records
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy Admin and Operator Flows Are Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 against the fixed code
    - Compare F' responses to the F snapshots captured in task 2 — every case must be byte-equal
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions) for sub-operator users, main-no-subs users, `assign-subs`, `as_operator_id`-filtered `GET /api/pos`, already-main parent on POST/PATCH, and existing duplicate/missing/self-parent validation
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full backend test suite (Property 1 exploration test + Property 2 preservation property tests + any unit tests added under task 3) and confirm every test passes
  - Manually exercise the reported scenario end-to-end against a local dev DB: seed Boss JV linked to HEXA-005 (sub of HEXA-001), use the admin Operator Profiles page to single-add HEXA-101 and bulk-add HEXA-102 under HEXA-005, then log in as Boss JV and verify the My POS dropdown shows "All (own + subs)", "Only mine", "Only HEXA-101", "Only HEXA-102" and the POS list contains records for ids 5, 11, 12
  - Manually exercise the concurrent-attach integration scenario from the design's Testing Strategy if feasible
  - Ensure all tests pass; ask the user if questions arise about expected behavior, edge cases, or whether to add the optional one-time SQL backfill for pre-existing buggy rows

## Notes

- The fix is intentionally scoped to `backend/src/routes/pos.routes.js`. No frontend changes, no schema changes, and no data migration are required. Existing rows in the buggy state self-heal on the next admin write that touches them through any of the three write paths.
- The backend currently has no test framework. Task 1 covers the one-time setup (`vitest` + `supertest` + isolated test DB or `pg-mem`); subsequent tasks reuse that scaffolding.
- Property-based testing is used for both Property 1 (scoped to the deterministic counterexamples) and Property 2 (random valid graphs) so the suite catches edge cases the manual scenario list might miss while still pinning the reported failure.
- The optional one-time SQL backfill mentioned in the design (`UPDATE operator_list SET parent_operator_id = NULL ...`) is out of scope for this bugfix and can be added as a follow-up if the user wants pre-existing buggy rows healed without waiting for the next admin write.
