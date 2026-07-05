# Bugfix Requirements Document

## Introduction

A main operator user (e.g. "Boss JV", linked to operator profile **HEXA-005**) cannot see the sub-operators that an admin attached to HEXA-005 via the **Operator Profiles** page. After login, the **My POS** page does not render the sub-operator filter dropdown ("All (own + subs)" / "Only mine" / "Only {sub-name}"), and the POS list shows only the user's own records — none of the records belonging to the operators that were assigned as subs of HEXA-005.

The hierarchy linkage exists in the `operator_list` table (admins set it from the admin page), but it is not reflected in the operator's own dashboard. The visible symptom is "sub-operators not located", and the structural symptom is the visibility/data-model invariant that drives the dropdown is broken or unenforced.

This bugfix targets two things simultaneously:

1. The **data-model invariant**: an operator profile P that has at least one operator with `parent_operator_id = P.id` (i.e. P has subs) MUST have `P.parent_operator_id IS NULL` (i.e. P is itself a main operator). The admin "Operator Profiles" page currently allows flows that violate or fail to enforce this invariant.
2. The **visibility flow**: the My POS page MUST render the sub-operator filter and `GET /api/pos` MUST return POS records for the main AND its subs whenever the logged-in user is the user-side of a main operator profile that has subs.

## Bug Analysis

### Current Behavior (Defect)

When an admin attaches sub-operators to operator profile P (e.g. HEXA-005) via the Operator Profiles page, and a user U linked to P logs in, the My POS page fails to expose those subs.

1.1 WHEN admin opens Operator Profiles, picks operator P in the "Manage subs of" dropdown while P currently has `parent_operator_id IS NOT NULL` (P is a sub of another main), and uses **"Add one"** or **"Add many"** to create new sub-operators under P, THEN the backend `POST /api/pos/operators` endpoint rejects each create with HTTP 400 "Parent must be a main operator (one level of nesting only)" because the auto-promote step that exists in the bulk-assign flow does not run on this path.

1.2 WHEN admin uses the per-row "parent" select on a sub of P to re-parent another operator under P while P itself is a sub (`P.parent_operator_id IS NOT NULL`), THEN the backend `PATCH /api/pos/operators/:id` endpoint rejects the save with HTTP 400 because P is not a main, leaving the intended sub unattached.

1.3 WHEN admin successfully attaches subs to P via the bulk **"Assign as subs"** flow (which auto-promotes P), but P was previously created or re-parented through a path that left `P.parent_operator_id` non-NULL and the auto-promote did not run, THEN the database can hold a state in which P has children (operators with `parent_operator_id = P.id`) AND P has a parent (`P.parent_operator_id IS NOT NULL`), violating the one-level-nesting invariant.

1.4 WHEN user U linked to operator profile P logs in and P is in the buggy state of clause 1.3 (P has subs AND `P.parent_operator_id IS NOT NULL`), THEN `GET /api/users/me?id=U.id` returns `parent_operator_id` non-NULL, the My POS page computes `isMainOperator = false`, the sub-operator filter dropdown is not rendered, and the `GET /api/pos?user_id=U.id` CTE resolves only P (`id = (SELECT id FROM me)`) so the POS list contains only P's own records — none of the subs' records.

1.5 WHEN user U linked to operator profile P logs in and P is correctly in the main state (`P.parent_operator_id IS NULL`) but the admin attached subs to P through a path that did not refresh or commit successfully, so no rows in `operator_list` have `parent_operator_id = P.id`, THEN the My POS page computes `myDirectSubs.length === 0` and the sub-operator filter dropdown is not rendered even though the admin believes the assignment succeeded.

### Expected Behavior (Correct)

The system must enforce the one-level-nesting invariant on every path that mutates `parent_operator_id`, and the operator dashboard must reflect any assigned subs.

2.1 WHEN admin uses **"Add one"** or **"Add many"** in Operator Profiles to create a new sub under operator P while P currently has `parent_operator_id IS NOT NULL`, THEN the system SHALL promote P to main (set `P.parent_operator_id = NULL`) atomically as part of the same operation, then create the new sub with `parent_operator_id = P.id`, so the create succeeds and the one-level invariant holds.

2.2 WHEN admin uses the per-row parent dropdown to re-parent operator Q under operator P while P currently has `parent_operator_id IS NOT NULL`, THEN the system SHALL promote P to main atomically as part of the same operation, then set `Q.parent_operator_id = P.id`, so the save succeeds and the one-level invariant holds.

2.3 WHEN any backend route attaches a child to operator P (set `child.parent_operator_id = P.id`), THEN the route SHALL ensure `P.parent_operator_id IS NULL` after the transaction commits — either by promoting P first, or by rejecting the operation with a clear error if promotion is not allowed in that path.

2.4 WHEN user U linked to operator profile P logs in and P has at least one operator Q with `Q.parent_operator_id = P.id` AND `P.parent_operator_id IS NULL`, THEN `GET /api/users/me?id=U.id` SHALL return `operator_id = P.id` and `parent_operator_id = NULL`, and the My POS page SHALL render the sub-operator filter dropdown listing "All (own + subs)", "Only mine", and "Only {Q.operator}" for each sub Q.

2.5 WHEN user U linked to operator profile P logs in with the same data as 2.4 and the My POS page issues `GET /api/pos?user_id=U.id` (no `as_operator_id`), THEN the response SHALL include all `pos_records` rows whose `operator_id = P.id` OR whose `operator_id` is in `{ Q.id : Q.parent_operator_id = P.id }`.

2.6 WHEN data already exists in the buggy state described in clause 1.3 (P has subs AND `P.parent_operator_id IS NOT NULL`), THEN the system SHALL heal the invariant on the next admin write that touches P or its descendants (e.g. by promoting P during assign/patch operations), so subsequent logins by U see the dropdown and the merged POS list.

### Unchanged Behavior (Regression Prevention)

The fix MUST NOT change behavior for operator users who are themselves sub-operators, or alter the existing filtering/CTE semantics for non-buggy inputs.

3.1 WHEN user U is linked to a sub-operator profile S (`S.parent_operator_id IS NOT NULL`), THEN `GET /api/users/me?id=U.id` SHALL CONTINUE TO return `parent_operator_id` non-NULL, the My POS page SHALL CONTINUE TO compute `isMainOperator = false`, the sub-operator filter dropdown SHALL CONTINUE TO be hidden, and `GET /api/pos?user_id=U.id` SHALL CONTINUE TO return only `pos_records` rows where `operator_id = S.id`.

3.2 WHEN a main operator user U with subs selects "Only mine" in the sub-operator filter, the My POS page sends `as_operator_id = U.operator_id`, THEN `GET /api/pos?user_id=U.id&as_operator_id=U.operator_id` SHALL CONTINUE TO return only rows where `operator_id = P.id` (P = U's profile).

3.3 WHEN a main operator user U with subs selects "Only {Q.operator}" in the sub-operator filter, the My POS page sends `as_operator_id = Q.id`, THEN `GET /api/pos?user_id=U.id&as_operator_id=Q.id` SHALL CONTINUE TO return only rows where `operator_id = Q.id` and SHALL CONTINUE TO refuse `as_operator_id` values that are not the user's own profile or one of its direct children (the existing CTE membership check).

3.4 WHEN admin uses the existing **"Assign as subs"** bulk flow on `POST /api/pos/operators/:id/assign-subs`, THEN the system SHALL CONTINUE TO atomically promote the target parent if it has a non-NULL parent, re-parent any grandchildren of the picked subs to the target parent, and return the refreshed operator list — exactly as today.

3.5 WHEN no sub-operators exist for a main operator user U (no row Q with `Q.parent_operator_id = U.operator_id`), THEN the My POS page SHALL CONTINUE TO hide the sub-operator filter dropdown and `GET /api/pos?user_id=U.id` SHALL CONTINUE TO return only `pos_records` rows where `operator_id = U.operator_id`.

3.6 WHEN admin views the Operator Profiles page, THEN the "Manage subs of" dropdown SHALL CONTINUE TO list every operator (mains and subs), the heads-up notice SHALL CONTINUE TO appear when the picked operator is currently a sub, and the existing main-creation, single-add, bulk-add, bulk-assign, and per-row-parent UI SHALL CONTINUE TO be reachable and functional for inputs that already satisfy the one-level rule.

3.7 WHEN admin or any client calls `POST /api/pos/operators` with a `parent_operator_id` that points to an operator already in main state (`parent_operator_id IS NULL`), THEN the system SHALL CONTINUE TO accept the create without modification.

3.8 WHEN admin or any client calls `PATCH /api/pos/operators/:id` to set `parent_operator_id` to an operator already in main state, THEN the system SHALL CONTINUE TO accept the patch without modification.

3.9 WHEN admin links a user U to an operator profile P via `PATCH /api/users/:id/operator`, THEN the existing 1-to-1 user↔operator constraint and validation behavior SHALL CONTINUE TO apply unchanged.

## Bug Condition Derivation

### Scope and inputs

Let `G` be the state of the `operator_list` and `users` tables, and let `U` be the logged-in operator user. Define:

- `P(G, U)` — the operator profile linked to U: the row in `operator_list` where `user_id = U.id`, or `NULL` if none.
- `subs(G, P)` — `{ Q ∈ operator_list : Q.parent_operator_id = P.id }`.
- `posRows(G, S)` — `{ r ∈ pos_records : r.operator_id ∈ S }`.

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = (G, U) where G is the DB state and U is an operator user
  OUTPUT: boolean

  LET P = P(G, U)
  IF P IS NULL THEN RETURN false              // user not linked to a profile — out of scope
  LET S = subs(G, P)
  IF S IS EMPTY THEN RETURN false             // no subs assigned — out of scope

  // The bug is triggered when subs exist for P but P is treated as non-main:
  //   either because the data-model invariant is violated...
  //   ...or because an admin write path failed to maintain it.
  RETURN P.parent_operator_id IS NOT NULL
END FUNCTION
```

A concrete counterexample (matching the user's report):

- `users`: `Boss JV` (id=42, usertype='operator', email='operatorsubtest@hexa.prime')
- `operator_list`:
  - `HEXA-005` (id=5, user_id=42, parent_operator_id=2)   ← buggy: has a parent
  - `HEXA-001` (id=2, parent_operator_id=NULL)
  - `HEXA-101` (id=11, parent_operator_id=5)              ← child of HEXA-005
  - `HEXA-102` (id=12, parent_operator_id=5)              ← child of HEXA-005
- `pos_records` exist for operator_ids 5, 11, 12.

Calling `GET /api/users/me?id=42` returns `operator_id=5, parent_operator_id=2`. The My POS page hides the dropdown. `GET /api/pos?user_id=42` resolves the CTE `me` to `(id=5, parent_operator_id=2)` and the filter reduces to `id = 5`, returning only the records for HEXA-005 itself — never HEXA-101 or HEXA-102.

### Property: Fix Checking

```pascal
// Property: Fix Checking — main-operator visibility of subs
FOR ALL X = (G, U) WHERE isBugCondition(X) DO
  // After the fix runs (either preventatively on the next admin write,
  // or as part of the assign/patch path that triggered the bug),
  // the data-model invariant must hold:
  LET G' = state of DB after F'(X)
  LET P  = P(G', U)
  ASSERT P.parent_operator_id IS NULL

  // GET /api/users/me reflects the healed state:
  LET me_resp = GET_users_me(U.id) on G'
  ASSERT me_resp.operator_id        = P.id
  ASSERT me_resp.parent_operator_id IS NULL

  // GET /api/pos returns the union of P's records and its subs' records:
  LET pos_resp = GET_api_pos(user_id = U.id) on G'
  LET expected = posRows(G', { P.id } ∪ { Q.id : Q ∈ subs(G', P) })
  ASSERT set(pos_resp) = expected

  // The My POS UI renders the sub-operator filter dropdown:
  ASSERT MyPosPage(me_resp, fetchOperators(G')).rendersSubFilter = true
  ASSERT MyPosPage(me_resp, fetchOperators(G')).filterOptions includes
         "All (own + subs)", "Only mine", and "Only {Q.operator}" FOR EACH Q ∈ subs(G', P)
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking — non-buggy inputs are unchanged
FOR ALL X = (G, U) WHERE NOT isBugCondition(X) DO
  // F is the system before the fix; F' is the system after.
  ASSERT F(X) = F'(X)
  // In particular:
  //   - sub-operators (P.parent_operator_id IS NOT NULL) see the same view as today
  //   - main operators with no subs see the same view as today
  //   - the existing assign-subs bulk flow returns the same shape
  //   - GET /api/pos with as_operator_id behaves identically for valid inputs
  //   - all admin UI flows that already satisfy the one-level rule are accepted unchanged
END FOR
```

### Key Definitions

- **F**: the current (unfixed) implementation across `OperatorProfilesPage.tsx`, `pos.routes.js` (`POST /operators`, `PATCH /operators/:id`, `POST /operators/:id/assign-subs`, `GET /`), `user.routes.js` (`GET /me`), and `MyPosPage.tsx`.
- **F'**: the fixed implementation that (a) makes every admin write path that attaches a child to P first promote P to main atomically, and (b) ensures the My POS visibility flow renders the sub filter and merges sub records whenever subs exist for the user's profile.
- **Counterexample**: Boss JV linked to HEXA-005 with `parent_operator_id = 2`, with HEXA-101 and HEXA-102 attached as children of HEXA-005 — login produces no sub filter and a POS list missing HEXA-101 and HEXA-102 records.
