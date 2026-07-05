# Main/Sub Operator Visibility Fix — Bugfix Design

## Overview

A main operator user (e.g. "Boss JV", linked to operator profile **HEXA-005**) does not see the sub-operators that an admin attached to their profile via the **Operator Profiles** page. The My POS page does not render the sub-operator filter dropdown and `GET /api/pos` returns only the user's own POS records — never those of the attached subs.

The root issue is a **broken data-model invariant**: the database can hold operator profiles that simultaneously have children (`some Q.parent_operator_id = P.id`) AND a parent (`P.parent_operator_id IS NOT NULL`). The downstream visibility flow (`GET /api/users/me`, the CTE in `GET /api/pos`, and `MyPosPage.tsx`) is correct **assuming** the invariant holds — when it doesn't, those code paths quietly hide the subs and produce a strict subset of the expected POS list.

The fix applies the same auto-promote pattern that the bulk **"Assign as subs"** flow already uses to the two admin write paths that currently bypass it: `POST /api/pos/operators` and `PATCH /api/pos/operators/:id`. After the fix, every code path that attaches a child to operator P first promotes P to main inside the same transaction, so the invariant is preserved on all admin writes and the buggy state self-heals on the next admin save that touches P.

The fix is intentionally scoped to the data-model layer. The visibility flow (`GET /api/users/me`, the `GET /api/pos` CTE, and the `MyPosPage` rendering logic) is already correct for healed inputs and is left unchanged.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the operator profile P linked to the logged-in user has at least one child operator AND has a non-NULL `parent_operator_id` itself, violating the one-level-nesting invariant.
- **Property (P)**: The desired behavior on inputs satisfying C — after the next admin write through the fixed paths, P's `parent_operator_id` is NULL, `GET /api/users/me` reflects that, the My POS page renders the sub-operator filter dropdown, and `GET /api/pos?user_id=U.id` returns the union of P's records and its subs' records.
- **Preservation**: All existing behavior for non-buggy inputs — sub-operator users, main operators with no subs, the bulk **"Assign as subs"** flow, and `GET /api/pos` with valid `as_operator_id` — must remain identical.
- **One-level-nesting invariant**: For every operator P in `operator_list`, if there exists Q with `Q.parent_operator_id = P.id`, then `P.parent_operator_id IS NULL`. The database has no formal constraint enforcing this; it is enforced by application code on every write path.
- **Auto-promote**: The pattern (already used in `POST /api/pos/operators/:id/assign-subs`) of atomically setting `parent.parent_operator_id = NULL` inside the same transaction that attaches a child to that parent, so the invariant holds at commit time.
- **operator_list**: The Postgres table holding all operator profiles, with a self-referential `parent_operator_id` column. Mains have `parent_operator_id IS NULL`; subs reference their main.
- **CTE in `GET /api/pos`**: The `WITH me AS (...)` query that resolves the visible operator set for an operator user. It returns `{P.id} ∪ subs(P)` only when `P.parent_operator_id IS NULL`; otherwise it returns just `{P.id}`.

## Bug Details

### Bug Condition

The bug manifests when an operator user U is linked to an operator profile P such that P has at least one child operator (some Q with `Q.parent_operator_id = P.id`) AND P itself has a non-NULL parent (`P.parent_operator_id IS NOT NULL`). On the My POS page, this state causes the sub-operator filter dropdown to be hidden and the `GET /api/pos` response to omit the children's POS records, even though an admin has attached subs to P.

The state is reached because two admin write paths — `POST /api/pos/operators` (single/bulk add) and `PATCH /api/pos/operators/:id` (per-row re-parent) — reject `parent_operator_id` references to a parent whose own `parent_operator_id IS NOT NULL`, instead of auto-promoting the parent the way `POST /api/pos/operators/:id/assign-subs` already does.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X = (G, U) where G is the DB state and U is an operator user
  OUTPUT: boolean

  LET P = profile linked to U in G
                (row in operator_list where user_id = U.id, or NULL if none)
  IF P IS NULL THEN RETURN false
  LET S = { Q in operator_list : Q.parent_operator_id = P.id }
  IF S IS EMPTY THEN RETURN false

  RETURN P.parent_operator_id IS NOT NULL
END FUNCTION
```

### Examples

- **Boss JV / HEXA-005 (the reported case):** `users.Boss JV (id=42, usertype='operator')`, `operator_list.HEXA-005 (id=5, user_id=42, parent_operator_id=2)`, with HEXA-101 (id=11, parent_operator_id=5) and HEXA-102 (id=12, parent_operator_id=5) attached as children. *Expected:* dropdown lists "All (own + subs)", "Only mine", "Only HEXA-101", "Only HEXA-102", and POS list includes records for ids 5, 11, 12. *Actual:* dropdown is hidden, POS list shows only records for id 5.
- **Admin "Add one" while picked main is a sub:** Admin opens Operator Profiles, picks `HEXA-005` (which currently has `parent_operator_id = 2`) in "Manage subs of", types a new name into "Add one", clicks Add. *Expected:* HEXA-005 is promoted to main and the new sub is created. *Actual:* `POST /api/pos/operators` returns HTTP 400 "Parent must be a main operator (one level of nesting only)"; nothing is created.
- **Admin per-row re-parent while picked main is a sub:** Admin uses the per-row parent dropdown on a sub of `HEXA-005` to change its parent to `HEXA-005` (which is itself a sub). *Expected:* HEXA-005 is promoted and the re-parent succeeds. *Actual:* `PATCH /api/pos/operators/:id` returns HTTP 400; the change is not saved.
- **Edge case — main with no subs:** A main operator user U has no children. *Expected:* dropdown hidden, POS list shows only U's records. *Behavior unchanged by the fix:* `isBugCondition` is false (S is empty), so this case is out of scope and must continue to work exactly as today.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Sub-operator users (where the linked profile has `parent_operator_id IS NOT NULL`) see no dropdown and only their own records — `GET /api/users/me` and the `GET /api/pos` CTE behave identically.
- Main operators with no subs see no dropdown and only their own records — the existing `myDirectSubs.length === 0` guard in `MyPosPage` is unchanged.
- `POST /api/pos/operators/:id/assign-subs` continues to atomically promote the parent, re-parent grandchildren, and return the refreshed list — the route body is not touched.
- `GET /api/pos?user_id=U.id&as_operator_id=Q.id` continues to enforce that `as_operator_id` is either U's own profile or one of its direct children, refusing other values.
- `POST /api/pos/operators` with `parent_operator_id` pointing to an already-main operator continues to succeed without any extra writes.
- `PATCH /api/pos/operators/:id` with `parent_operator_id` pointing to an already-main operator continues to succeed without any extra writes.
- The Operator Profiles UI shape — main picker, heads-up notice, single-add, bulk-add, bulk-assign, per-row parent select — is preserved; only the underlying server response on the create/patch paths changes from 400 to 200/201 in the previously-rejected sub-as-parent cases.
- `PATCH /api/users/:id/operator` (user↔operator linking) and the 1-to-1 user/operator constraint are untouched.
- The `operator_list` schema is unchanged; no new column or constraint is added.

**Scope:**
All inputs that do NOT involve attaching a child to an operator profile that is itself currently a sub should be completely unaffected. This includes:
- Reads (`GET /api/pos/operators`, `GET /api/users/me`, `GET /api/pos`, `GET /api/users`).
- Writes that create or re-parent operators where the chosen parent already has `parent_operator_id IS NULL`.
- The bulk `assign-subs` route (already correct).
- All other modules (booth info, POS device CRUD, cancellation monitoring, payout stations, etc.).

## Hypothesized Root Cause

Based on the bug description and the code in `backend/src/routes/pos.routes.js`, the most likely issues are:

1. **Asymmetric enforcement of the one-level rule across write paths.** Three routes mutate `parent_operator_id`:
   - `POST /api/pos/operators` (create with parent) — rejects sub-as-parent with HTTP 400.
   - `PATCH /api/pos/operators/:id` (re-parent) — rejects sub-as-parent with HTTP 400.
   - `POST /api/pos/operators/:id/assign-subs` (bulk attach) — auto-promotes the parent inside a transaction.
   The first two reject; the third heals. Any flow that goes through the first two leaves the admin's intent unrealized, and any flow that successfully went through the third in the past while a fourth path (since-removed migration, manual SQL, or earlier code revision) had already given P a parent leaves the DB in the buggy state.

2. **No DB-level invariant.** `operator_list` has a self-referential FK on `parent_operator_id` but no CHECK or trigger enforcing the one-level rule. Any application-level miss leaves the table free to drift into the buggy state.

3. **Visibility flow assumes the invariant.** `MyPosPage.isMainOperator` is `me.parent_operator_id === null`, and the `GET /api/pos` CTE collapses to `{ id = me.id }` when `me.parent_operator_id IS NOT NULL`. Both are correct **given** the invariant; both are wrong (silent under-fetch) when the invariant is broken. Fixing the visibility flow without fixing the invariant would mask the data problem instead of solving it.

4. **No self-healing on read.** `GET /api/users/me` and `GET /api/pos` do not detect or repair an inconsistent profile; the buggy state persists across logins until an admin write touches P through a path that auto-promotes.

The fix applies to category 1: make the two non-healing write paths heal in the same way `assign-subs` already does, so the application layer enforces the invariant uniformly.

## Correctness Properties

Property 1: Bug Condition — Main operator visibility of subs after the fix

_For any_ admin write `W` that attaches a child to operator profile P (i.e. sets some `child.parent_operator_id = P.id`) on the fixed code, after `W` commits the database SHALL satisfy `P.parent_operator_id IS NULL`, and for any user U linked to P the response of `GET /api/users/me?id=U.id` SHALL have `parent_operator_id = NULL`, the My POS page SHALL render the sub-operator filter dropdown listing "All (own + subs)", "Only mine", and "Only {Q.operator}" for each child Q of P, and `GET /api/pos?user_id=U.id` SHALL return exactly the set of `pos_records` whose `operator_id` is in `{P.id} ∪ {Q.id : Q.parent_operator_id = P.id}`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation — Non-buggy admin and operator flows are unchanged

_For any_ input where the bug condition does NOT hold — sub-operator users, main operators with no subs, admin writes whose chosen parent already has `parent_operator_id IS NULL`, the existing `assign-subs` bulk flow, and `GET /api/pos` calls with valid `as_operator_id` — the fixed system SHALL produce the same observable result (HTTP status, response body shape, DB state delta, UI rendering) as the original system, preserving every existing flow that already satisfied the one-level rule.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix lives entirely in `backend/src/routes/pos.routes.js`. No frontend code changes, no schema changes, no migration of existing data.

**File**: `backend/src/routes/pos.routes.js`

**Functions**: `router.post("/operators", ...)` and `router.patch("/operators/:id", ...)`

**Specific Changes**:

1. **Wrap `POST /api/pos/operators` in a transaction and auto-promote a sub-parent.**
   - Acquire a `pool.connect()` client and `BEGIN` a transaction.
   - Keep all existing duplicate-name and parent-existence validation.
   - When the supplied `parent_operator_id` resolves to an operator whose `parent_operator_id IS NOT NULL`, replace the current 400 rejection with an `UPDATE operator_list SET parent_operator_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::int` issued inside the transaction (mirroring the `assign-subs` step).
   - Then `INSERT` the new operator with `parent_operator_id` pointing to the (now main) parent.
   - `COMMIT` and return the new row.
   - On any error, `ROLLBACK` and respond 500 (or the existing-validation 400 unchanged for invalid payloads).

2. **Wrap `PATCH /api/pos/operators/:id` in a transaction and auto-promote a sub-parent.**
   - Acquire a `pool.connect()` client and `BEGIN` a transaction.
   - Keep the existing self-parent guard, target-existence check, and parent-existence check.
   - When the supplied `parent_operator_id` resolves to an operator whose `parent_operator_id IS NOT NULL`, replace the current 400 rejection with an `UPDATE operator_list SET parent_operator_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::int` issued inside the transaction.
   - Then `UPDATE` the target row with the new `parent_operator_id`.
   - Before committing, guard against the new state violating the one-level rule for the target itself: if the target currently has children (`EXISTS (SELECT 1 FROM operator_list WHERE parent_operator_id = $1::int)`) AND the patch would set its `parent_operator_id` non-NULL, reject with 400 ("Operator has sub-operators; detach them before making it a sub"). This is consistent with the existing `assign-subs` re-parenting semantics and prevents the patch path from creating a new violation.
   - `COMMIT` and return the updated row. On error, `ROLLBACK`.

3. **Use `FOR UPDATE` on the parent row read inside both transactions.** This matches the locking discipline `assign-subs` uses and prevents two concurrent attaches from racing each other into a half-promoted state.

4. **Leave `POST /api/pos/operators/:id/assign-subs` unchanged.** It already implements the desired pattern.

5. **Leave the visibility flow unchanged.** `GET /api/users/me` (`backend/src/routes/user.routes.js`), the `GET /api/pos` CTE in `pos.routes.js`, and `frontend/src/modules/operator/pages/MyPosPage.tsx` are correct for healed inputs and are not touched. After the fix, the next admin write to a stuck profile through any of the three write paths will heal it; subsequent operator logins will see the dropdown and the merged POS list automatically.

6. **No data migration.** Existing rows in the buggy state self-heal on the next admin write that touches them. If the user later wants a one-time SQL backfill (`UPDATE operator_list SET parent_operator_id = NULL WHERE id IN (SELECT DISTINCT parent_operator_id FROM operator_list WHERE parent_operator_id IS NOT NULL) AND parent_operator_id IS NOT NULL`), it can be added separately; it is out of scope for this bugfix.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. Because the application has no test framework configured, the test plan calls for adding one (`vitest` for the backend matches the existing `vite` toolchain on the frontend) and writing tests against an isolated test database (or pg-mem). The user-visible exploratory steps below can also be performed manually against a local dev DB.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: With the unfixed backend running against a fresh test DB, seed a small graph (`HEXA-001` main, `HEXA-005` sub of `HEXA-001`, user `Boss JV` linked to `HEXA-005`). Then attempt each of the admin flows that should add subs to `HEXA-005`. Capture HTTP status codes and resulting `operator_list` / `users.me` / `GET /api/pos` outputs.

**Test Cases**:
1. **Single-add under sub-parent (will fail on unfixed code)**: `POST /api/pos/operators` with `{operator: "HEXA-101", parent_operator_id: 5}` while `HEXA-005.parent_operator_id = 2`. Expect 400 today; expect 201 after fix and `HEXA-005.parent_operator_id = NULL` afterwards.
2. **Bulk-add under sub-parent (will fail on unfixed code)**: same payload repeated for `HEXA-101`, `HEXA-102`. Each call rejects today; each succeeds after fix.
3. **Per-row re-parent under sub-parent (will fail on unfixed code)**: `PATCH /api/pos/operators/:id` setting some operator Q's parent to `HEXA-005` while `HEXA-005.parent_operator_id = 2`. Expect 400 today; expect 200 after fix.
4. **End-to-end visibility on buggy state (will fail on unfixed code)**: Manually `UPDATE operator_list SET parent_operator_id = 2 WHERE id = 5;` after `assign-subs` left it correct, then call `GET /api/users/me?id=42` and `GET /api/pos?user_id=42`. The dropdown is hidden and POS list omits HEXA-101/102 records. Then call any of the admin write paths above through the fixed code and re-check — dropdown appears and POS list contains the union.
5. **Edge case — main with no subs (must NOT fail)**: `GET /api/users/me?id=U` for a main with no children continues to hide the dropdown today and after fix.

**Expected Counterexamples**:
- HTTP 400 "Parent must be a main operator (one level of nesting only)" returned by `POST /api/pos/operators` and `PATCH /api/pos/operators/:id` when the chosen parent has `parent_operator_id IS NOT NULL`.
- `GET /api/pos?user_id=42` returning a strict subset of expected rows when `HEXA-005.parent_operator_id` is non-NULL.
- Possible causes: missing auto-promote in two write paths, no DB-level invariant, visibility flow assumes invariant holds.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed admin write paths heal the invariant and the downstream visibility flow returns the expected union.

**Pseudocode:**
```
FOR ALL X = (G, U) WHERE isBugCondition(X) DO
  // After any admin write W on the fixed code that attaches a child to P
  // (single-add, bulk-add, per-row re-parent, or assign-subs):
  LET G' = state of DB after W
  LET P  = profile linked to U in G'
  ASSERT P.parent_operator_id IS NULL

  LET me_resp = GET_users_me(U.id) on G'
  ASSERT me_resp.operator_id        = P.id
  ASSERT me_resp.parent_operator_id IS NULL

  LET pos_resp = GET_api_pos(user_id = U.id) on G'
  LET expected = { r in pos_records : r.operator_id IN ({P.id} ∪ subs_of(P)) }
  ASSERT set(pos_resp) = expected

  LET ui = MyPosPage(me_resp, fetchOperators(G'))
  ASSERT ui.rendersSubFilter = true
  ASSERT ui.filterOptions ⊇ {"All (own + subs)", "Only mine"}
                          ∪ {"Only " + Q.operator : Q in subs_of(P)}
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL X = (G, U) WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // i.e. the same HTTP response body, status, and DB state delta for:
  //   - sub-operator users (P.parent_operator_id IS NOT NULL, no children)
  //   - main operators with no subs (P.parent_operator_id IS NULL, S empty)
  //   - admin writes where chosen parent already has parent_operator_id IS NULL
  //   - assign-subs bulk flow (already auto-promotes; behavior identical)
  //   - GET /api/pos with valid as_operator_id
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (operator graphs, user-profile linkages, query parameters).
- It catches edge cases that manual unit tests might miss — e.g. an operator that is simultaneously a main with no children and the target of a self-parent attempt.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs, which is the whole preservation contract.

**Test Plan**: Observe responses on UNFIXED code first for non-bug inputs (recorded as snapshots), then write property-based tests that generate random non-buggy operator graphs and assert the fixed code returns identical responses for the same inputs.

**Test Cases**:
1. **Sub-operator user view preservation**: Observe that for U linked to a sub S, `GET /api/users/me` returns `parent_operator_id` non-NULL and `GET /api/pos?user_id=U.id` returns only S's records. Property test: for any random graph and U linked to a sub, the responses are byte-equal between F and F'.
2. **Main-no-subs preservation**: Observe that for U linked to a main with no children, the dropdown is hidden and the POS list contains only U's records. Property test: for any graph satisfying that shape, F = F'.
3. **assign-subs preservation**: Observe that `POST /api/pos/operators/:id/assign-subs` returns the same `{assigned, errors, reparentedGrandchildren, operators}` shape on healthy inputs. Property test: for any random valid `(parent, sub_ids)` pair, F = F'.
4. **Already-main parent preservation on POST**: `POST /api/pos/operators` with `parent_operator_id` pointing to an already-main operator returns 201 and an unchanged parent row both before and after the fix. Property test: for any main parent and any unique new operator name, F = F'.
5. **Already-main parent preservation on PATCH**: `PATCH /api/pos/operators/:id` setting parent to an already-main operator returns 200 and an unchanged parent row both before and after. Property test: for any main parent and any leaf target, F = F'.
6. **`as_operator_id` membership preservation**: `GET /api/pos?user_id=U.id&as_operator_id=Q.id` returns the same row set for valid Q (own profile or direct child) and refuses (returns empty / 0 rows) for invalid Q. Property test: F = F' across random valid and invalid Q values.

### Unit Tests

- `POST /api/pos/operators` with `parent_operator_id` referencing a main parent → 201, parent unchanged.
- `POST /api/pos/operators` with `parent_operator_id` referencing a sub parent → 201, parent's `parent_operator_id` is now NULL, child created with the parent's id.
- `POST /api/pos/operators` with duplicate name → 400 (existing behavior preserved).
- `POST /api/pos/operators` with non-existent `parent_operator_id` → 400 (existing behavior preserved).
- `PATCH /api/pos/operators/:id` with `parent_operator_id` referencing a main parent → 200, parent unchanged.
- `PATCH /api/pos/operators/:id` with `parent_operator_id` referencing a sub parent → 200, parent promoted, target re-parented.
- `PATCH /api/pos/operators/:id` setting parent to itself → 400 (existing behavior preserved).
- `PATCH /api/pos/operators/:id` setting parent on an operator that already has children → 400 with the new "detach children first" message.
- `GET /api/users/me?id=U` for a main with subs returns `parent_operator_id = null`.
- `GET /api/pos?user_id=U.id` for a main U with two subs returns the union of all three operators' records.
- `GET /api/pos?user_id=U.id` for a sub user returns only the sub's records (preservation).

### Property-Based Tests

- **Generator**: random connected operator graph satisfying the one-level rule (mains with 0..N children), random user→main and user→sub linkages, random `pos_records` distributed over operators.
- **Property — fix correctness**: for any seeded buggy state (manual UPDATE setting a main's `parent_operator_id` non-NULL after subs were attached), running any of the four admin write paths through F' yields a healed graph whose `GET /api/pos?user_id=U.id` matches the expected union for the linked user.
- **Property — preservation**: for any healthy graph, the response of `GET /api/pos`, `GET /api/users/me`, `POST /api/pos/operators`, `PATCH /api/pos/operators/:id`, and `POST /api/pos/operators/:id/assign-subs` is byte-equal between F and F'.
- **Property — invariant**: after any sequence of admin writes through F', the database satisfies the one-level rule: `∄ (P, Q) such that Q.parent_operator_id = P.id AND P.parent_operator_id IS NOT NULL`.

### Integration Tests

- **Reported scenario end-to-end**: seed Boss JV linked to HEXA-005, admin uses Operator Profiles to single-add HEXA-101, bulk-add HEXA-102 under HEXA-005 while HEXA-005 is initially a sub of HEXA-001. After the admin saves, log in as Boss JV and verify the dropdown lists three options ("All", "Only mine", "Only HEXA-101", "Only HEXA-102") and the POS list contains records for ids 5, 11, 12.
- **Sub-operator end-to-end**: log in as a user linked to a sub, verify the dropdown is hidden and only the sub's records are visible.
- **Filter narrowing**: as a main with subs, exercise each dropdown option ("All", "Only mine", each "Only {sub}") and verify the POS list narrows correctly through the `as_operator_id` query parameter.
- **Concurrent attach**: two admins simultaneously POST `/api/pos/operators` with the same sub-parent; verify both transactions commit successfully (one races to promote, the other observes a main parent), and the final state has the parent as main with both new children attached.
- **Pre-existing buggy state heals on next write**: manually corrupt the DB into the buggy state, confirm the operator user sees the under-fetch, then run any admin write through the fixed paths and confirm the next operator login sees the correct dropdown and merged list.
