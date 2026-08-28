# Ticket 25H.1 — Durable Commercial Result Attribution

Implemented 2026-08-28. Extends `ticket-25g-performance-domain-audit-and-scoring-foundation.md`
(the WON-attribution gap it identified) and precedes 25H.2 (the `/40`
Results score engine, not built here).

## What this ticket built

- **Schema (additive migration)**: `ProspectActivity` gains three
  nullable fields — `creditedUserId` (+ a new `creditedUser` relation to
  `User`), `creditedUserNameAtEvent`, `creditedUserRoleAtEvent` — plus an
  index on `[creditedUserId, occurredAt]` for the future Results engine's
  "WON events credited to user X in period Y" queries.
  `prisma/migrations/20260828140000_add_won_result_attribution/`.
- **`resolveWonCredit`** (`prospect-won-transition.service-core.ts`) — the
  one function that decides who receives credit: the prospect's
  authoritative `assignedUserId`/`assignedUser` at the moment of the WON
  transition, never the actor, never fabricated when unassigned.
- **`buildWonTransitionActivityData`** now requires a `credit` parameter
  and writes the three new fields alongside the existing `agentName`.
- **`submitProspectFollowUpCore`** reads `assignedUserId`/`assignedUser`
  as part of the same transactional prospect read it already had, and
  calls `resolveWonCredit` at the WON branch — no new query, no new
  transaction boundary.
- **Closed the one other write path that could reach `status = WON`**:
  `prospectSchema` (prospect creation) now explicitly rejects
  `status: "WON"` — creation was never the authoritative WON boundary
  (the follow-up workflow is), but since a Server Action's input is
  reachable directly (not only through the form, which never offered WON
  anyway), this needed an explicit schema-level rejection, not just an
  absent UI control. See "Audit finding" below.
- No `PerformanceEvaluation`/scoring schema, no `/40` formula, no UI —
  exactly as scoped.

## Audit finding: the WON write path (§3)

Traced every reference to `WON`/`WON_TRANSITION`/`isWonTransition`/
`buildWonTransitionActivityData` repo-wide. `isWonTransition`/
`buildWonTransitionActivityData` are used in exactly one place:
`submitProspectFollowUpCore`. That is the sole authoritative WON
transition boundary — confirmed, not assumed.

However, `prospectSchema` (prospect **creation**) validated `status` with
a bare `z.enum(prospectStatuses).default("NEW")` — no restriction beyond
being a valid enum value. The creation form never exposes a status
picker (hardcoded `status: "NEW"` in `prospect-form-input.tsx`), but
`createProspectAction` parses `values: unknown` via that same schema, so
a direct call with `status: "WON"` would have created a WON prospect
with **no `WON_TRANSITION` activity and no credit attribution at all** —
a second, silent path around the one this ticket just built. Closed by
rejecting `status: "WON"` in `prospectSchema`'s `superRefine`. `LOST` was
deliberately left alone — out of this ticket's scope, and it carries no
equivalent durable-attribution requirement today.

## Key policy decisions

**Credit = `Prospect.assignedUserId` at the exact moment of the WON
transition, read inside the same transaction, never the actor.** This is
25G's central finding made structural: a MANAGER or ADMIN who submits
the closing follow-up on a COMMERCIAL's prospect does not become the
credited party — the COMMERCIAL who owned it does. When the actor and
the owner are the same person (a COMMERCIAL closing their own prospect),
both fields naturally agree — no special-casing needed for either case.

**No fallback to the actor when unassigned.** An unassigned prospect that
becomes WON has `creditedUserId = null` on the resulting activity — that
is the truthful fact, not an error to paper over with the actor's
identity, which is exactly the ambiguity this ticket exists to remove.

**Role is snapshotted regardless of scoring eligibility.** If the
assigned owner is a MANAGER or ADMIN at WON time, `creditedUserRoleAtEvent`
faithfully records that. Whether a future Results engine considers a
MANAGER-credited WON eligible for individual scoring is that engine's
decision, not this ticket's — attribution is a domain fact, independent
of any scoring policy (§27 of the ticket).

**Pre-25H.1 WON_TRANSITION rows are not backfilled.** Neither `agentName`
(proven not equivalent to credit) nor the prospect's *current*
`assignedUserId` (ownership may have changed since the win) is truthful
evidence of who was credited at that historical moment. Existing rows
keep `creditedUserId = null` — explicitly "unknown," never a guess. A
future Results engine must treat `null` as "exclude from individual
scoring," not as "zero" or "unattributed = everyone."

**One prospect can produce more than one `WON_TRANSITION` event, each
independently credited.** No state machine prevents a prospect from
leaving WON and re-entering it (Ticket 20A: no enforced transitions).
This ticket adds no such prevention — each transition already produced
its own `ProspectActivity` row before 25H.1, and each one now gets its
own credit snapshot the same way, tested explicitly. A future Results
engine consuming multiple WON events per prospect within one scoring
period needs its own aggregation policy (sum, latest, or count-once) —
not decided here.

**Reassignment after WON cannot rewrite recorded credit** — proven by a
regression test, not merely by absence of a reassignment code path. If a
future ticket adds prospect reassignment, it must not touch existing
`ProspectActivity` rows; this was already true structurally (nothing
writes to `ProspectActivity` after creation) and is now covered by an
explicit test rather than an implicit assumption.

## `/updates` and prospect-history compatibility

Not touched. The `PROSPECT_WON` feed item already sources its displayed
name from `agentName` (the actor), not from any new field — confirmed by
reading `shared-feed.service-core.ts` before making any change. Adding
`creditedUserId` etc. to the schema does not change what that service's
explicit Prisma `select` returns, so the feed's existing behavior,
chronology, and privacy boundary are unaffected. The prospect activity
timeline similarly uses explicit field lists; both were updated only
where their own TypeScript fixtures needed the new (nullable) fields
added for type-completeness, not because any rendering logic changed.

## Known limitations (do not reinterpret as forgotten features)

- **Legacy attribution is explicitly unknown, not reconstructed.** Any
  WON_TRANSITION row created before 2026-08-28 has `creditedUserId =
  null` permanently. A future Results engine must skip these for
  individual-employee scoring rather than guessing.
- **Multiple WON events per prospect are not deduplicated or ranked.**
  "First win," "latest win," and "every win" are all still open questions
  for whichever ticket builds period-based Results aggregation.
- **No cross-organization/tenancy concern was added** (Phase 26 remains
  paused, per instruction) — the eventual invariant "the Prospect and the
  credited employee's membership must belong to the same Organization"
  is a 26B-series concern, not implemented or partially implemented here.
- **Manual credit override does not exist** (deliberately, per the
  ticket) — credit is 100% derived from ownership at transition time, no
  UI, no dropdown, no audit workflow for correcting it.

## Verification performed

```
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
targeted tests (prospect-won-transition, prospect-follow-up,
  role-transition-operational-continuity, prospect-activity,
  prospect.schema, prospect-activity-timeline, the new migration test)
full test suite
targeted lint
production build
git diff --check
```

No live database access was performed or needed — this environment has
no `DATABASE_URL` configured, consistent with every prior migration in
this repository being hand-authored against Prisma's own generated SQL
conventions and verified via `prisma validate`/`generate` plus a
migration-content test, not applied against a live database.
