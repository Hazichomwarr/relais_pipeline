# Ticket 25H.2A — Commercial Performance Target Domain

Implemented 2026-08-28. Answers the prerequisite 25H.2 identified: a
durable comparison basis for `creditedWins` (see
`ticket-25h2-commercial-results-score-engine.md`). Does not calculate
Results `/40` and does not touch Execution Discipline or the overall
`/100`.

## Why this domain is required

25H.2's own audit (restated here for completeness) found neither a
historically durable ownership-during-period denominator — `Prospect`
has no assignment-history model — nor any existing performance
target/quota concept anywhere in the codebase. A `creditedWins` count on
its own cannot become a fair `/40` without something to compare it
against. This ticket builds that comparison basis as its own durable,
historically-snapshotted domain fact, not as a field bolted onto `User`.

## Why current ownership cannot be the denominator

Restated from 25H.2's audit: `Prospect.assignedUserId` is a mutable,
current-only pointer with no change history. If Commercial A owned a
prospect in August and it was reassigned to B in September, nothing in
this schema can prove that fact in October when an August evaluation is
computed. A target sidesteps this entirely — it's a forward-looking
management expectation set *before* the period, not a reconstruction of
who-owned-what after the fact.

## Target metric

V1 target metric is exactly one thing: `targetWins` — the number of
credited WON results (per 25H.2's `creditedWins`) expected from a
Commercial in one calendar month. No revenue, meetings, calls, leads, or
custom formulas — the ticket's own §4 instruction, followed literally.

## Monthly period semantics and timezone boundary

One target per Commercial per **canonical calendar month**, both bounds
inclusive, computed in RELAIS's business timezone
(Africa/Ouagadougou, UTC+0) via `businessLocalMidnight` — exported from
`financial-report-period.ts` specifically so this domain reuses the
exact same math `resolveFinancialReportPeriod`'s `"month"` case already
uses, rather than introducing a second timezone framework
(`resolveCommercialPerformanceTargetPeriod` in
`commercial-performance-target.service-core.ts`). A caller supplies
`{year, month}` (1–12); the service always computes `periodStart`/
`periodEnd` itself — never an arbitrary caller-supplied date range, so
the `@@unique([userId, periodStart, periodEnd])` constraint reliably
means "one target per employee per calendar month," not "one target per
whatever range happened to be submitted."

## Creation cutoff and edit/freeze rules

**Freeze-before-period semantics (Option A, no revision history)**:

- Creation requires `periodStart > now` — strictly future. At the exact
  instant `now === periodStart`, creation is already rejected (tested at
  that boundary explicitly), matching "no retrospective creation" (§17/
  §18) with no grace instant.
- `targetWins` may be edited (`updateCommercialPerformanceTargetCore`)
  only while `now < periodStart`.
- A target may be deleted (`deleteCommercialPerformanceTargetCore`) only
  while `now < periodStart`.
- Once `now >= periodStart`, the target is immutable. No separate
  lifecycle/status column exists — lock state is always derived from
  `periodStart` vs. the current instant
  (`isCommercialPerformanceTargetPeriodLocked`), never persisted, per
  §20's explicit instruction to avoid a redundant status field.
- Edits before lock simply overwrite `targetWins` in place — Option A,
  chosen per §37: "acceptable if the target is frozen before the period
  starts." No revision history is kept for pre-lock edits; the only
  audit trail is `createdByUserId`/`createdByRoleAtEvent`/`createdAt` on
  the original creation.

## Historical preservation

`roleAtAssignment` (the employee's role) and `createdByRoleAtEvent` (the
actor's role) are frozen snapshots at creation, following the exact
established pattern of `UserCreationActivity.roleAtEvent` and 25H.1's
`creditedUserRoleAtEvent` — never re-derived from the live `User`
relation on read. A target created for a COMMERCIAL in August remains an
August Commercial target even after a September promotion to MANAGER;
`updateCommercialPerformanceTargetCore`/`deleteCommercialPerformanceTargetCore`
take no employee-role or creator-role parameter at all, so there is no
code path that could rewrite either snapshot after creation — proven by
dedicated tests (§58/§59), not just asserted.

## Role-change behavior

- **Role change before the period starts** (§25): not specially handled
  in code — an upcoming target for someone who left `COMMERCIAL` before
  their period begins simply sits there; it can be deleted by an
  ADMIN/MANAGER through the normal "before lock" deletion path if
  management wants to remove it. No automatic invalidation was added — a
  narrower, safer default than silently mutating or deleting a
  record without an explicit management action.
- **Role change during the period** (§26): the target remains
  unchanged, exactly as historical evidence of what August began with.
  Whether such a period is "partially scored," "split," or "marked
  incomplete" is explicitly **not** this ticket's decision — it belongs
  to whichever future ticket builds the `/40` formula (25H.2B).

## No-backfill policy

No targets were created for any past period, including the current
August 2026 period, which now has real `creditedWins` evidence (25H.2)
but no contemporaneous target. This is the correct, honest state per
§19: "Historical Results `/40` remains unavailable where no
contemporaneous target existed." Nothing in this ticket infers a target
from manager memory or current expectations.

## Authorization

`ADMIN` and `MANAGER` may create/edit/delete targets — organization-wide,
not team-scoped, because this CRM has no manager-of-employee hierarchy
(25G §6/§27, restated in `COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES`'s
own comment in `authorization.service-core.ts`). This is a documented
limitation, not an oversight: once a real hierarchy exists, this access
list is the one place that would need to narrow. `COMMERCIAL` can never
create or edit their own target — enforced at three independent layers:
the route (`app/admin/layout.tsx`'s existing ADMIN/MANAGER gate covers
`/admin/performance-targets` already), the Server Action
(`requireCommercialPerformanceTargetManagementAccess()`), and the
domain core (`canManageCommercialPerformanceTargets`) — never trusting
a single layer, per §9/§44/§45.

## Future multitenancy invariant

Phase 26 remains paused; no `organizationId`/`membershipId` was added.
Documented invariant for whenever 26B lands: **a target's employee
(`userId`) and its creator (`createdByUserId`) must belong to the same
Organization.** Not implemented or partially implemented here.

## Handoff to Results scoring

`getCommercialPerformanceTarget(userId, period)`
(`commercial-performance-target.service.ts`) is the stable entrypoint
25H.2B should call: an exact `{userId, periodStart, periodEnd}` lookup,
`null` when no target exists for that exact period — never "latest
target," never a previous month's target as a fallback (§31, tested at
§60/§61). 25H.2B can then combine it with
`collectCommercialResultsEvidence`'s `creditedWins` for the same
employee/period to finally compute:

```
achievement = creditedWins / targetWins
score = min(40, round(40 * achievement))
```

— a formula this ticket deliberately does not implement (§29/§62), so a
future ticket can decide small-sample handling, the score cap, and
`INSUFFICIENT_EVIDENCE`/no-target semantics without this ticket
prejudging them.

## What this ticket built

- `prisma/schema.prisma` — new `CommercialPerformanceTarget` model,
  additive only (migration:
  `prisma/migrations/20260828160000_add_commercial_performance_targets/`).
  Two new named relations on `User` (`commercialPerformanceTargets`,
  `createdCommercialPerformanceTargets`); no existing model's own columns
  changed.
- `financial-report-period.ts` — `businessLocalMidnight` exported (was
  private), reused rather than duplicated.
- `src/services/commercial-performance-target.service-core.ts` — pure
  domain core: role gates, period resolution, lock semantics, create/
  update/delete/get, all dependency-injected (no Prisma import).
- `src/services/commercial-performance-target.service.ts` — Prisma
  wiring, plus a management listing for the UI.
- `src/lib/validations/commercial-performance-target.schema.ts` — Zod
  schemas for the three mutations.
- `src/actions/commercial-performance-target.actions.ts` — Server
  Actions, authorizing independently of the service-core (defense in
  depth).
- `authorization.service-core.ts`/`authorization.service.ts` — new
  `COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES` constant and
  `requireCommercialPerformanceTargetManagementAccess()` wrapper,
  following the established "one constant per feature" convention.
- A small admin UI: `app/admin/performance-targets/page.tsx` (already
  covered by `app/admin/layout.tsx`'s ADMIN/MANAGER gate), a creation
  form, and a read-only list with delete-while-unlocked — no
  performance dashboard, no `/40` display, no employee self-service view
  (all explicitly out of scope per §28/§39/§43). Linked from
  `/admin/users` for discoverability.
- 36 + 6 + 14 + 2 + 8 = 66 new/updated tests across the domain core,
  migration content, validation schema, authorization, and the two
  component source-assertion tests.

## Known limitations

- **No revision history for pre-lock edits** (Option A, deliberate —
  see "Creation cutoff and edit/freeze rules" above).
- **No employee self-view** of their own target — deferred per §43, not
  forgotten.
- **No inline edit UI** — the service/action support editing, but the
  shipped UI only offers create + delete-while-unlocked, since deleting
  and recreating an unlocked target covers the same need and the
  ticket's own UI minimum (§40) didn't require an edit form.
- **Role-change-during-period consequences for future scoring** are
  explicitly undecided (§26) — flagged for 25H.2B, not resolved here.

## Verification performed

```
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
targeted tests (commercial-performance-target.service-core.test.ts,
  commercial-performance-target.schema.test.ts,
  add-commercial-performance-targets.migration.test.ts,
  authorization.service.test.ts,
  CommercialPerformanceTargetForm.test.ts,
  CommercialPerformanceTargetList.test.ts)
full test suite
targeted lint
production build
git diff --check
```

No real targets were created for verification. No live database access
was performed or needed, consistent with every prior migration in this
repository (no `DATABASE_URL` configured in this environment) — the
schema and migration SQL were verified via `prisma validate`/`generate`
plus a migration-content test, matching 25H.1/25G's established
approach.
