# Ticket 28A.1 — Historical Sales Analytics Attribution Fix

Shipped: 2026-09-05. Prerequisite for 28B (prospect reassignment) — resolves
the one blocker 28A found in the authoritative historical-attribution
pipeline.

## 1. The 28A blocker, precisely

`/admin/analytics/funnel`'s "Par commercial" breakdown and
`/admin/analytics/why`'s "Raisons par commercial" breakdown both derived
historical won/lost/reason attribution from the prospect's **live**
`assignedUserId`. That was harmless only because RELAIS has never supported
reassignment — current owner and historical owner have always been the
same person for every existing row. Once 28B makes `assignedUserId`
reassignable, both reports would have silently rewritten the past: a
prospect's historical win, loss, or stall reason would move to whoever
currently owns it, contradicting the frozen invariant the authoritative
WON-credit pipeline (`ProspectActivity.creditedUserId`, Ticket 25H.1) has
enforced correctly since it shipped.

Frozen rule this ticket enforces:

```
Prospect.assignedUserId       = who is responsible NOW
historical outcome attribution = who was responsible WHEN THAT OUTCOME
                                  WAS RECORDED
```

## 2. What was NOT touched

- `resolveWonCredit`/`creditedUserId` semantics — already correct (§3 of the
  ticket forbade redesigning it, and 28A's audit already confirmed it).
- `commercial-results.service-core.ts`, `execution-discipline.service-core.ts`,
  `performance-summary.service-core.ts` — no changes; they already read only
  frozen fields (`creditedUserId`, `ProspectAction.assignedToUserId`).
- `ProspectAction` persistence/completion rules — untouched.
- Report period semantics, anti-leaderboard sort order (alphabetical, never
  by volume), and overall funnel/why totals — all unchanged (see §7).
- No reassignment feature, no `ProspectAssignmentTransfer` model, no
  takeover requests — still 28B/28D's job.

## 3. Outcome coverage, verified before touching any query

There is exactly one writer of `ProspectActivity.conversionOutcome`/
`conversionReason` in the whole codebase:
`submitProspectFollowUpCore` (`src/services/prospect-follow-up.service-core.ts`).
Both fields are **required** (not optional) on
`prospectFollowUpWorkflowSchema` — every follow-up submission carries one,
always consistent with the resulting status
(`isConversionOutcomeConsistentWithStatus`: WON⇄WON, LOST⇄LOST). So every
prospect currently at status WON is guaranteed to have at least one
`WON_TRANSITION` activity row (created in the same transaction as the
FOLLOW_UP row, via `isWonTransition`), and every prospect currently at
status LOST is guaranteed to have at least one `FOLLOW_UP` row with
`conversionOutcome = LOST`. No stop condition (§58.1/§58.4 of the ticket)
applies — there was no case of "no durable event exists" or "multiple
writers with no canonical capture point" to resolve.

Nothing prevents a prospect from cycling through WON or LOST more than once
(Ticket 20A: no enforced status state machine) — the read-side design
below accounts for that explicitly (§5).

## 4. The new field

`prisma/schema.prisma`, model `ProspectActivity`:

```prisma
responsibleUserIdAtEvent String?
responsibleUserAtEvent   User?   @relation("ProspectActivityResponsibleUser", fields: [responsibleUserIdAtEvent], references: [id], onDelete: Restrict)
```

- **Semantics**: the prospect's authoritative `assignedUserId`, resolved by
  the server *inside the same transaction* as the activity write — never
  the acting user, never re-derived from the prospect's current (and, from
  28B on, reassignable) `assignedUserId` on read.
- **Set on every FOLLOW_UP and WON_TRANSITION row**, not just WON ones —
  unlike `creditedUserId` (WON-only sales credit), "who was responsible" is
  a neutral historical fact. For a WON event the two agree by construction
  (both resolved from the same in-transaction Prospect read) but remain
  semantically separate fields — enforced by a dedicated test
  (`prospect-won-transition.service-core.test.ts`: "sets
  responsibleUserIdAtEvent equal to creditedUserId — never independently
  derived, never the acting ADMIN/MANAGER").
- **Nullable**, null means "the prospect had no assigned user at that
  moment" — never a fallback to the actor, to an ADMIN/MANAGER, or to any
  current field.
- **No name snapshot** (`responsibleUserNameAtEvent`) was added, unlike
  `creditedUserNameAtEvent`. That field exists to protect WON credit against
  a future User deletion — but 28A's audit already confirmed no
  User-deletion path exists anywhere in this codebase, and every other User
  relation in the schema is `onDelete: Restrict` for the same reason.
  Rendering the current display name live through the `responsibleUserAtEvent`
  relation is sufficient and simpler (ticket §38's own suggestion).
- **FK**: `onDelete: Restrict`, matching every other historical User
  relation in the schema (never `Cascade` — a historically-responsible User
  can never be hard-deleted while an activity references them).
- **Index**: `@@index([responsibleUserIdAtEvent, occurredAt])`, mirroring
  `creditedUserId`'s existing index — supports the owner-filter queries in
  §6/§7.

Migration: `prisma/migrations/20260905153021_add_prospect_activity_responsible_user/`
— additive only (one column, one index, one FK), applied via
`prisma migrate deploy`, no `db push`. Verified via
`prisma/add-prospect-activity-responsible-user.migration.test.ts`, modeled
directly on the precedent `add-won-result-attribution.migration.test.ts`.

## 5. Write path

`src/services/prospect-follow-up.service-core.ts` — the FOLLOW_UP activity
now carries `responsibleUserIdAtEvent: prospect.assignedUserId`, read from
the same `tx.findProspect` call `resolveWonCredit` already uses.

`src/services/prospect-won-transition.service-core.ts` —
`buildWonTransitionActivityData` sets
`responsibleUserIdAtEvent: params.credit.creditedUserId`, reusing
`resolveWonCredit`'s output rather than re-deriving it, so the two fields
can never independently drift for a WON event.

Neither the client, nor any Server Action input, can set this field —
verified by a new regression test in `src/actions/authorization-order.test.ts`
("submitProspectFollowUpAction never accepts responsibleUserIdAtEvent (or
creditedUserId) from client input") that scans both the action's function
body and `prospectFollowUpWorkflowSchema` for the field name.

No other write path (`prospect-activity.service.ts`,
`commercial-prospect.service.ts` — the two plain interaction/note creation
paths) ever sets `conversionOutcome`, so they are correctly left untouched.

## 6. `/admin/analytics/why` — the simpler, more severe fix

Every row this page reads already **is** one historical FOLLOW_UP event (no
per-prospect "latest event" ambiguity — the query is event-level, not
prospect-level). The fix was a direct field swap in
`sales-why-analytics.service-core.ts` and `.service.ts`:
`assignedUserId`/`assignedUser` (current, joined through the `Prospect`
relation) → `responsibleUserIdAtEvent`/`responsibleUserAtEvent` (frozen,
selected directly off the activity row).

This page's `byOwner` groups **every** outcome (ADVANCED/STALLED/WON/LOST)
by the same frozen field — including WON rows. That's a deliberate,
different choice from §7 below: `/why`'s question is "who was responsible
for this event", never "who earned sales credit", so it never needs
`creditedUserId` at all (the FOLLOW_UP row it reads never carries that
field — only the sibling `WON_TRANSITION` row does).

The owner filter (`?owner=`) changed the same way: it now matches
`responsibleUserIdAtEvent` directly (a plain field on `ProspectActivity`),
never `Prospect.assignedUserId` through the relation. The unattributed
bucket's label was made explicit: **"Non attribué historiquement"**
(previously "Non attribué", which the funnel page still uses for its
*current*-ownership meaning — the two null-meanings are deliberately kept
visually distinct across the two pages).

Copy fix: `component/analytics/why/OwnerReasonBreakdown.tsx`'s subtitle now
reads "Chaque suivi reste attribué au commercial responsable du prospect au
moment de ce résultat, même après une réaffectation ultérieure."

## 7. `/admin/analytics/funnel` — the harder fix

This page's "Par commercial" breakdown mixes two genuinely different
questions in one row, and only one of them needed to change:

| Field | Source | Changed? |
| --- | --- | --- |
| `total`/`interested`/`qualified`/`proposalSent` | live `Prospect.assignedUserId`, current status | No — correctly a current-portfolio view |
| `won` | **was**: current status × current owner. **now**: `ProspectActivity.creditedUserId` (frozen at WON) | **Yes** |
| `lost` | **was**: current status × current owner. **now**: `ProspectActivity.responsibleUserIdAtEvent` (frozen at the LOST-outcome FOLLOW_UP) | **Yes** |

WON uses `creditedUserId` specifically (not `responsibleUserIdAtEvent`),
per the ticket's explicit instruction (§21): this figure is a sales-credit
question, and the authoritative credit field already exists — reusing it
keeps one source of truth rather than introducing a second. LOST uses
`responsibleUserIdAtEvent` because LOST has no credit concept at all.

**Bucket construction changed from "current owners only" to "union of
current owners and historically-attributed users."** A commercial who has
been fully reassigned away from every prospect they ever closed still gets
a row, with `total: 0` and their historical `won`/`lost` counts intact —
otherwise their credit would silently disappear from the report the moment
their live portfolio hit zero. This is covered by a dedicated test: "a
commercial fully reassigned away from every prospect they ever closed still
appears with their historical won/lost counts, not silently dropped."

**Canonical-event selection**: nothing prevents a prospect from cycling
through WON or LOST more than once (§3). The core reducer
(`buildHistoricalWonLostByOwner` in `sales-funnel-analytics.service-core.ts`)
takes the *latest* WON_TRANSITION/LOST-FOLLOW_UP row per prospect per
outcome type, and only counts it if the prospect's **current** status still
matches that outcome — guarding against a stale event from a prospect that
has since moved on. Covered by two dedicated tests ("stale historical
events are ignored...", "only the latest matching historical event
counts...").

**New third query**, `sales-funnel-analytics.service.ts`: historical
WON_TRANSITION/LOST-FOLLOW_UP rows, scoped to the same cohort as the
existing `prospects` query (product + `Prospect.createdAt` within the
period — never `Prospect.assignedUserId`). The owner filter (`?owner=`)
applies through `creditedUserId` for the WON branch and
`responsibleUserIdAtEvent` for the LOST branch of an `OR` clause — never
through the relation. The pre-existing "structured outcomes" query
(`outcomeRows`, feeding the unfiltered `outcomes` summary) had its own owner
filter changed the same way, for the same reason as `/why` §6 — otherwise a
`?owner=` filtered page view would show a self-contradictory mix of
old-semantics and new-semantics numbers.

Copy fix: `OwnerPipelineBreakdown.tsx`'s subtitle now explicitly separates
the two questions: "Le total et les étapes en cours reflètent le
portefeuille actuel de chaque commercial. Les gagnés et perdus restent
attribués au commercial responsable au moment du résultat, même après une
réaffectation ultérieure."

## 8. Concurrency preparation for 28B (§34/§35 of the ticket)

Nothing changed here beyond confirming the existing guarantee still holds:
`resolveWonCredit`/`buildWonTransitionActivityData` and the new
`responsibleUserIdAtEvent` write both read `assignedUserId` **inside the
same transaction** as the activity write (`prospect-follow-up.service.ts`'s
`prisma.$transaction`). Once 28B ships a `reassignProspect()` mutation, as
long as it also writes under its own transactional guard (28A's audit
already specifies the conditional-update pattern), a race between "record
LOST" and "reassign" resolves cleanly: whichever transaction commits first
determines the frozen attribution, and the loser is rejected by its own
precondition rather than silently overwriting the other's result. This
fix does not need to — and does not — implement that guard itself; it only
confirms the write-time discipline the guard depends on already exists.

## 9. No runtime fallback — verified, not just designed

Every read path was checked for the exact anti-pattern this ticket exists
to prevent (`responsibleUserIdAtEvent ?? prospect.assignedUserId` or
equivalent). None exists. Enforced by dedicated regression tests:

- `sales-funnel-analytics.service.test.ts`: "never falls back from missing
  historical attribution to the current Prospect.assignedUserId relation."
- `sales-funnel-analytics.service-core.test.ts`: "never falls back from
  missing historical attribution to the prospect's current assignedUserId
  — unknown stays unknown" (a WON prospect with zero recorded historical
  events gets `won: 0` for its current owner, never a fabricated 1).
- No automatic repair hook exists anywhere (`on reassignment: update all
  ProspectActivity.responsibleUserIdAtEvent` was never written, and cannot
  be — 28B doesn't exist yet in this codebase). Once 28B ships, its own
  test suite is the right place to add the equivalent "reassignment never
  touches historical ProspectActivity rows" regression test; nothing here
  needed to preempt code that doesn't exist yet.

## 10. Legacy rows — forward-only, no backfill

Read-only count taken before any write (2026-09-05, this environment): 98
total `ProspectActivity` rows, 0 `WON_TRANSITION` rows, 4 `FOLLOW_UP` rows
with `conversionOutcome = LOST`, 51 `FOLLOW_UP` rows total. After the
migration, all 98 rows have `responsibleUserIdAtEvent = null` — exactly the
forward-only policy, same convention as `creditedUserId`'s own migration
(`add-won-result-attribution`, Ticket 25H.1): no backfill, "not recorded"
stays "not recorded" rather than being reconstructed from `agentName` or
from a current field that was never the ground truth for a past moment.

## 11. Tests

- `prisma/add-prospect-activity-responsible-user.migration.test.ts` — new,
  5 tests, modeled on the `creditedUserId` precedent.
- `src/services/prospect-follow-up.service-core.test.ts` — 8 new tests
  (commercial-on-own-prospect, manager-on-commercial's-prospect,
  admin-on-commercial's-prospect, unassigned-null, WON
  responsibleUserIdAtEvent-equals-creditedUserId, client-cannot-inject).
- `src/services/prospect-won-transition.service-core.test.ts` — 2 new tests
  for the WON-event equality invariant.
- `src/actions/authorization-order.test.ts` — 1 new test guarding the
  action/schema boundary.
- `src/services/sales-funnel-analytics.service-core.test.ts` — 11 new
  tests: the two named regressions from the ticket's exact bug (§50), WON
  via `creditedUserId`/LOST via `responsibleUserIdAtEvent` are sourced
  independently, a fully-reassigned-away commercial still gets a row, stale
  multi-cycle events are ignored, unassigned-at-WON-time is bucketed as
  "Non attribué" not fabricated, current-portfolio fields stay decoupled
  from historical won/lost, full reconciliation (summary/outcomes/byProduct
  identical with or without historical data), backward-compatible default
  parameter, and the no-fallback guard.
- `src/services/sales-funnel-analytics.service.test.ts` — replaced the
  "two queries" assertion with "three", added assertions for the new
  query's owner-filter fields, replaced the relation-based owner-filter
  assertion, added the no-fallback source guard.
- `src/services/sales-why-analytics.service-core.test.ts` — existing
  fixture renamed throughout (`assignedUserId`/`assignedUser` →
  `responsibleUserIdAtEvent`/`responsibleUserAtEvent`), "Non attribué"
  assertion updated to "Non attribué historiquement".
- `src/services/sales-why-analytics.service.test.ts` — relation-based
  owner-filter assertion replaced with the direct-field assertion.
- `component/propects/prospect-activity-timeline.test.tsx`,
  `src/services/prospect-activity.service.test.ts`,
  `src/services/role-transition-operational-continuity.test.ts` — three
  pre-existing fixtures/snapshots updated to include the new schema field
  (typecheck-driven, no behavioral change).

Full suite: 2420/2420 passing. `tsc --noEmit`: clean. `eslint .`: clean.
`next build`: succeeds. `prisma migrate status`: up to date, no pending
migrations. `git diff --check`: clean.

## 12. Production safety

No live prospect was reassigned (the feature doesn't exist), no fake
WON/LOST/ProspectActivity rows were created, no role or account was
changed. The only write against the shared database was the additive
migration itself (one column, one index, one FK — reviewed before
applying, applied via `prisma migrate deploy`). All verification queries
(§10's counts) were read-only `count()` calls.

## 13. 28A closure status

> **28A blocker**: `/admin/analytics/funnel` and `/admin/analytics/why`
> derive historical commercial attribution from the prospect's live
> `assignedUserId`, which would silently rewrite history once reassignment
> ships.
>
> **28A.1: RESOLVED.** Both reports now attribute every historical
> WON/LOST/reason outcome to a frozen, event-time field
> (`creditedUserId` for WON, `responsibleUserIdAtEvent` for everything
> else), verified by tests that simulate the exact post-reassignment
> divergence 28A described, without needing 28B to exist yet.

28A's factual findings (`notes/ticket-28a-prospect-ownership-transfer-domain-audit.md`)
are not rewritten by this note — this is a status update, not a correction.

**28B may now begin.**
