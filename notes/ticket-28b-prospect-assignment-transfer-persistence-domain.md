# Ticket 28B — Prospect Assignment Transfer Persistence & Domain

Shipped: 2026-09-05. Implements the single authoritative domain operation
for changing a prospect's current responsible user, plus durable,
immutable transfer history. No management UI — that is 28C.

## 1. Current-pointer and transfer-event semantics

Frozen, unchanged from 28A/28A.1:

```
Prospect.assignedUserId        = who is responsible NOW
ProspectAssignmentTransfer row = how responsibility moved, once, per event
```

`Prospect.assignedUserId` remains the only field read for "who owns this
prospect today" — every existing ownership-scoped query
(`buildCommercialProspectByIdWhere`, `buildProspectWhere`, the commercial
dashboard, `/admin/my-prospects`) needed zero changes, because they already
read this field directly and it is never derived from history. Current
ownership is never reconstructed from the latest transfer row; the two are
independent representations of the same fact, kept in sync only by
`reassignProspectCore`'s atomic transaction (§9).

## 2. The model

```prisma
model ProspectAssignmentTransfer {
  id              String   @id @default(cuid())
  prospectId      String
  fromUserId      String?
  toUserId        String
  changedByUserId String
  reason          String
  occurredAt      DateTime @default(now())
  // + Restrict FKs to Prospect and to User (three named relations)
  // + @@index([prospectId, occurredAt]), @@index([fromUserId]),
  //   @@index([toUserId]), @@index([changedByUserId])
}
```

- `fromUserId` nullable (§7) — a real `null → X` assignment is a genuine
  transition, never a fabricated prior owner.
- `toUserId`/`changedByUserId`/`reason` required.
- `occurredAt` server-default, never client-supplied.
- No role snapshots (`fromUserRoleAtEvent`, etc.) — 28A found no downstream
  read that needs them; adding them now would be speculative.
- No name snapshots — every FK is `Restrict` (no User-deletion path exists
  anywhere in this codebase, confirmed again during this ticket), so
  rendering names live through the relations is sufficient. This is a
  deliberate departure from `creditedUserId`'s own name-snapshot fields:
  those exist for a *scoring-integrity* reason (never let a later rename
  reinterpret historical credit) that doesn't apply to a plain
  who-owns-it-now pointer.
- No `Prospect.createdByUserId` was added (§5 of the ticket, confirmed
  unnecessary): `reassignProspectCore` never needed to know who created a
  prospect to implement truthful transfer history — the first transfer's
  `fromUserId` already tells the truth about what it actually records
  (responsibility moving away from whoever the prospect happened to be
  assigned to), not a relabeled "creator" fact.

Reverse relations: `Prospect.assignmentTransfers`,
`User.assignmentTransfersFrom/To/ChangedBy` — three distinct named
relations on `User`, same reasoning as `ProspectAction`'s four.

## 3. Authority

`PROSPECT_REASSIGNMENT_ROLES = ["ADMIN", "MANAGER"]`
(`authorization.service-core.ts`), wrapped as
`requireProspectReassignmentAccess()` — the same named-constant-plus-wrapper
pattern every other capability in this file already follows. Organization-
wide, no team/manager hierarchy — consistent with every other
management-only capability in this codebase (28A confirmed no
manager-of-employee model exists anywhere).

This coarse route/action gate is deliberately not the only safety net (§4).

## 4. Fresh actor and target resolution

`reassignProspectCore` never trusts a caller-supplied role or active flag.
It takes only `actorId: string` and resolves `{id, active, role}` fresh via
a `findActor` dependency (wired to `tx.user.findUnique` inside the same
transaction as everything else). This directly answers 28A's finding that
ADMIN/MANAGER JWT sessions don't re-verify `active` mid-session: a
deactivated manager's stale session can pass the route-level
`requireProspectReassignmentAccess()` check, but the mutation itself will
still resolve their fresh DB state and reject with `ACTOR_INACTIVE`.

The same freshness applies to the target (`findTarget`) — a target who was
active when the management UI loaded the page but has since been
deactivated or had their role changed is rejected at call time, never
trusted from a stale form value.

## 5. Eligible targets — reused, not redefined

`canReceiveProspectAssignment({ role, active })` composes the existing
`canOwnProspect(role)` (from `prospect-creation.service-core.ts`) with an
`active` check, rather than defining a second, potentially-diverging
eligibility list. Per 28A's finding, this means ADMIN, COMMERCIAL, and
MANAGER are all eligible targets — reassignment is not commercial-only,
matching what creation already allows. ASSISTANT is never eligible,
active or not. The current owner's role/active state is never checked at
all — an inactive or role-ineligible current owner (e.g. a former
COMMERCIAL now ASSISTANT) remains fully transferable away from, because
the operation never resolves the current owner's identity beyond the bare
id already sitting on `Prospect.assignedUserId`.

## 6. Null current owner

`fromUserId: null → toUserId: X` is a first-class, ordinary transition —
tested explicitly (`NULL OWNER` test in the core suite). No prior owner is
invented; the guarded update's WHERE clause uses
`assignedUserId: expectedCurrentOwnerId` literally, which Prisma correctly
compiles to `IS NULL` when that value is `null` — never conditionally
omitted (§9 explains why that distinction matters).

## 7. Terminal (WON/LOST) prospects

Reassignable, with no special-casing anywhere. This isn't a policy decision
enforced by an `if` — it's structural: `ReassignProspectLookup` (the type
`findProspect` returns) has exactly two fields, `id` and `assignedUserId`.
There is no `status` field for this operation to see, so a WON or LOST
prospect is indistinguishable from any other at this layer. Confirmed by a
dedicated structural test.

## 8. Open ProspectAction — Policy A, confirmed by composition

28A recommended Policy A (preserve the action's existing assignee; the
original assignee may still complete it) on architectural-consistency
grounds. 28B doesn't implement this as new code — `ProspectAction` isn't a
dependency this operation can reach at all (`ReassignProspectDependencies`
has exactly five keys: `findActor`, `findProspect`, `findTarget`,
`reassignAtomically`, `recordTransfer` — confirmed by a structural test).
The "Final domain test" in
`prospect-assignment-transfer-regression.test.ts` composes a real
`reassignProspectCore` call with the existing, untouched
`canCompleteProspectAction`/`canCancelProspectAction` to prove Jean's OPEN
action remains his to finish after Prospect A moves to Amidou, and that
Amidou gains no special authority over it merely by inheriting the
prospect.

## 9. Atomicity and concurrency

One transaction (`prisma.$transaction` in
`prospect-assignment-transfer.service.ts`), wrapping:

1. `findActor` / `findProspect` / `findTarget` (fresh reads)
2. `reassignAtomically` — `prisma.prospect.updateMany({ where: { id,
   assignedUserId: expectedCurrentOwnerId }, data: { assignedUserId:
   newAssignedUserId } })`, `count === 0` means conflict
3. `recordTransfer` — only reached if step 2 actually changed a row

Either both the `Prospect` update and the `ProspectAssignmentTransfer`
insert commit, or neither does — same discipline as
`createProspectAction`'s existing action-plus-status-progression
transaction and `submitProspectFollowUpCore`'s status-plus-activity
transaction. No new transactional pattern was invented.

**The guard's literal-not-conditional shape matters**: the WHERE clause is
written as `assignedUserId: expectedCurrentOwnerId`, never
`...(expectedCurrentOwnerId ? { assignedUserId: expectedCurrentOwnerId } :
{})`. The conditional-spread form would silently *omit* the filter when the
current owner is `null`, turning the guard into an unguarded blind write
for every unassigned prospect — exactly the bug this ticket exists to
prevent. A dedicated wiring-layer test asserts this literal form and
explicitly asserts the conditional-spread anti-pattern is absent.

**The required race** (§32 of the ticket — two managers both read Jean,
one succeeds, one conflicts) is proven with a fake in-memory store using a
deterministic trick: since `reassignProspectCore` always re-reads before
writing, two sequential top-level calls alone can't reproduce a true race
(the second call would just see the already-updated state and correctly
proceed against it). The test instead rigs the *second* manager's own
`findProspect` read to trigger, as a side effect, the first manager's
already-in-flight transaction landing in the gap — deterministically
reproducing "by the time my write attempt runs, the row has already
moved." The result: `CONCURRENTLY_REASSIGNED`, zero new history rows, and
the pointer stays at the first manager's target — never a silent
overwrite, never two competing rows from the same stale origin.

**WON/LOST races** (§33/§34): not separately re-implemented — the same
guard discipline used here is the same one `resolveWonCredit`/
`buildWonTransitionActivityData` already use (both read `assignedUserId`
inside their own transaction). Two independently-guarded transactions
racing against the same row will serialize correctly at the database level
regardless of which one is a reassignment and which is a WON transition —
this ticket's job was only to confirm the *reassignment* side adopts the
same discipline, not to add a special cross-operation lock.

## 10. Stale-tab behavior — unchanged, confirmed still holds

Nothing needed to change here. Every COMMERCIAL-scoped mutation
(`buildCommercialProspectByIdWhere`) already re-derives ownership fresh
per request, so a stale browser tab's next mutation attempt after a
reassignment fails with `PROSPECT_NOT_FOUND` immediately, with no reliance
on cached session/client state — confirmed still true since 28B touched
none of those call sites.

## 11. No-backfill policy

The migration creates the table with zero rows and touches no existing
`Prospect` row. Read-only verification after deploying to the shared
environment (2026-09-05): `ProspectAssignmentTransfer` count = 0,
`Prospect` count = 240, all 240 still have a non-null `assignedUserId`,
unchanged by the migration. No `null → X, occurredAt = Prospect.createdAt`
synthetic row was created for any prospect — a legacy prospect with an
assignment and zero transfer rows is valid and expected; it simply
predates transfer-history recording.

## 12. No creator field — confirmed, not just deferred

`Prospect.createdByUserId` was not added. `prospect-creation.service-core.ts`
was not touched — a source-level regression test
(`§39/§78` in `prospect-assignment-transfer-regression.test.ts`) confirms
it neither imports anything from the reassignment module nor creates a
transfer row on prospect creation. Creation continues to set
`assignedUserId: actor.id` exactly as before; that remains an initial
state, never a transfer.

## 13. No generic edit bypass

`prospectSchema` (`src/lib/validations/prospect.schema.ts`) still has no
`assignedUserId` field — reconfirmed by a dedicated 28B regression test
(this was already true after 28A/28A.1; this ticket's job was to make sure
introducing the reassignment feature didn't quietly reopen it).
`reassignProspectSchema` is the only schema that can ever produce a value
destined for `Prospect.assignedUserId` outside of creation, and it carries
exactly three fields — confirmed by a structural test that no client input
can smuggle in `fromUserId`, `changedByUserId`, `actorRole`, `targetRole`,
or `occurredAt`.

## 14. Migration and live verification

`prisma/migrations/20260905160451_add_prospect_assignment_transfer/` —
additive only: one `CREATE TABLE`, four indexes, four `Restrict` foreign
keys. No `ALTER TABLE` on any existing table, no `UPDATE`/`INSERT`/`DELETE`.
Applied via `prisma migrate deploy` (never `db push`). Verified by
`prisma/add-prospect-assignment-transfer.migration.test.ts` (7 tests:
additive-only shape, nullable/required columns, `Restrict` FKs, schema
model shape, named relations on both sides, no role/name snapshots, no
`createdByUserId` on `Prospect`).

Live, read-only verification after deploy: `ProspectAssignmentTransfer`
count = 0; every existing `Prospect` row's `assignedUserId` unchanged
(240/240 still assigned, 0 newly null). No reassignment was performed
against the shared database to "prove the mutation works" — all mutation
testing happened against the fake in-memory store in
`prospect-assignment-transfer.service-core.test.ts`.

## 15. Cross-ticket compatibility with 28A.1

`prospect-assignment-transfer-regression.test.ts` runs a *real*
`reassignProspectCore` call (through the fake store) that actually moves
`Prospect.assignedUserId` from Jean to Amidou, then feeds the resulting
post-transfer state into `buildSalesFunnelAnalytics` alongside a WON
historical event whose `creditedUserId` already says "jean" — confirming
28A.1's fix holds under an actual reassignment, not just a hand-constructed
divergence fixture. A second test confirms the inverse: the same
ownership-scoped where-builder (`buildCommercialProspectByIdWhere`) used by
"Mes prospects"/commercial dashboard reads now matches Amidou, proving
current-portfolio-scoped reads move immediately while historical
attribution doesn't.

## 16. Outcomes and error codes

```
PROSPECT_NOT_FOUND | ACTOR_NOT_FOUND | ACTOR_INACTIVE | ACTOR_NOT_AUTHORIZED
TARGET_NOT_FOUND | TARGET_INACTIVE | TARGET_ROLE_NOT_ELIGIBLE
SAME_ASSIGNEE | INVALID_REASON | CONCURRENTLY_REASSIGNED | REASSIGN_FAILED
```

`SAME_ASSIGNEE` is deliberately a `{success:false, code, message}` result,
not a third `success` variant — this matches the existing
`ProspectActionResult`/`ProspectFollowUpResult` convention throughout this
codebase (anything that isn't a completed mutation is `success:false` with
a distinguishing code) rather than inventing a new response shape for one
operation.

## 17. Tests

- `prisma/add-prospect-assignment-transfer.migration.test.ts` — 7 tests.
- `src/services/prospect-assignment-transfer.service-core.test.ts` — 34
  tests against a fake in-memory transactional store: eligibility helper,
  actor role matrix (ADMIN/MANAGER allowed, COMMERCIAL/ASSISTANT denied),
  fresh actor resolution (not-found, inactive), prospect/target
  resolution, current-owner-never-validated, same-assignee (fresh and
  after a real prior transfer), null-owner, reason validation
  (whitespace-only rejected, trimmed on success), provenance
  (changedByUserId is always the actor), actor-vs-target-vs-current-owner
  independence (§55/§56), terminal-status structural non-gate, four
  structural "zero capability beyond these five dependencies" regressions,
  three concurrency tests (repeated transfers, the guard mechanism in
  isolation, and the full §32 race scenario), and a controlled-failure
  test.
- `src/services/prospect-assignment-transfer.service.test.ts` — 8
  source-string tests on the wiring layer (transaction wrapping, the
  literal-not-conditional guard shape, fresh `findUnique` calls, no
  client-supplied history fields, read-primitive ordering/shape, no writes
  to `ProspectActivity`/`ProspectAction`, no backfill helper).
- `src/services/prospect-assignment-transfer-regression.test.ts` — 6
  cross-ticket tests: the ticket's own "Final domain test" narrative (Jean
  → Amidou, transfer provenance, Jean's history and OPEN action untouched,
  composed with real `canCompleteProspectAction`/`canCancelProspectAction`
  calls), the 28A.1 compatibility proof, the current-portfolio where-builder
  proof, and two creation/generic-edit independence proofs.
- `src/actions/authorization-order.test.ts` — 3 new tests (added to the
  existing gated-actions loop, plus two dedicated tests: authorizes via
  `requireProspectReassignmentAccess`, and never accepts
  `fromUserId`/`changedByUserId`/`actorRole`/`targetRole`/`occurredAt` from
  client input).
- `src/services/authorization.service.test.ts` — 2 new tests extending the
  existing per-constant loop pattern to `PROSPECT_REASSIGNMENT_ROLES`.

Full suite: 2480/2480 passing (60 new). `tsc --noEmit`: clean. `eslint .`:
clean. `next build`: succeeds. `prisma migrate status`: up to date.
`git diff --check`: clean.

## 18. Production safety

No live prospect was reassigned. No fake `ProspectAssignmentTransfer` row
was created against the shared database. The only write against the
shared database was the additive migration itself, reviewed before
applying and applied via `prisma migrate deploy`. All verification queries
were read-only `count()` calls.

## 19. Explicit non-goals (unchanged from the ticket)

No management reassignment UI, no takeover request, no inactive-owner
filter/badges, no bulk reassignment, no LOKARI/NIA read-only parity, no
commercial-facing transfer history, no notifications, no feed integration,
no task transfer/cancellation, no creator/discoverer model, no team
hierarchy, no tenantization, no performance/analytics redesign. 28C owns
presentation and read-only parity; 28D owns takeover requests; 28E owns
inactive-owner recovery.

## 20. 28C readiness

Everything 28C needs already exists and needs no new semantics invented:

- Mutation: `reassignProspectAction(values)` — `{ prospectId,
  newAssignedUserId, reason }` in, typed domain result out.
- Read: `getProspectAssignmentTransfers(prospectId)` — newest-first,
  includes `fromUser`/`toUser`/`changedByUser`/`reason`/`occurredAt`. 28C
  must gate this behind `requireProspectReassignmentAccess()` (or
  equivalent) before rendering `reason` — this file does not enforce that
  itself, by design (§41/§42 of the ticket).
- Error codes are stable and French-message-bearing already, ready for a
  form to surface field-level and top-level errors.

**28C can build the management reassignment UI without inventing any new
transfer semantics.**
