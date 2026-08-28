# Ticket 25H.2 — Commercial Results Score Engine

Implemented 2026-08-28. Consumes the durable WON attribution 25H.1 built.
Extends `ticket-25g-performance-domain-audit-and-scoring-foundation.md`
and `ticket-25h-execution-discipline-score-engine.md`.

## Completion criterion this ticket satisfies

The ticket's own completion criterion offers two acceptable outcomes.
This is the **second** one:

> RELAIS can identify and aggregate durable Commercial results
> correctly, but numeric `/40` scoring remains intentionally blocked
> until an explicit historically preserved performance-target domain
> exists.

This is not a partial or failed implementation of 25H.2 — it is the
outcome the ticket itself said would be correct if the audit came back
this way, and the audit did.

## Required audit decision (performed before any formula code)

The ticket requires an explicit answer to: *what historically durable
denominator or target makes a credited WON count comparable enough to
convert into `/40`?* Two independent lines of investigation, both
exhaustive rather than assumed:

1. **No durable ownership-during-period denominator.** `Prospect` has no
   assignment-history model — 9 models total in `prisma/schema.prisma`,
   none of them `ProspectOwnershipHistory` or equivalent (confirmed
   again here, consistent with 25G's and 26A's own findings).
   `assignedUserId` is set once at creation
   (`prospect-creation.service-core.ts:89`) and no reassignment code path
   exists anywhere in the app today (`assignedUserId` appears in zero
   update schemas or `prospect.update`/`updateMany` call sites) — but
   this is an emergent fact from feature absence, not an enforced
   invariant, so it cannot be trusted as permanent, and even a truly
   immutable `assignedUserId` wouldn't fix the deeper problem: a
   `createdAt`-in-period filter only captures prospects *entering* the
   pipeline that period, not the full set a Commercial was actively
   working. **No historical conversion-rate denominator can be built
   from this repository's current schema.**
2. **No durable target/quota domain.** Exhaustive grep for
   target/quota/objective/goal across the schema and every service
   turned up exactly one real hit —
   `DIGITAL_SERVICES_PROSPECTING_TARGET`/`KARMDA_SCHOOL_PROSPECTING_TARGET`
   (`src/lib/validations/operations-coordinator-daily-report.schema.ts:9-10`)
   — a hardcoded daily new-prospect-logging count for the **Operations
   Coordinator** Daily Report template, unrelated to role, WON outcomes,
   or any evaluation period. Zero hits for "quota." **No performance
   target/quota concept exists anywhere in this codebase.**

**Conclusion: Outcome C.** Per the ticket's own instruction, this rules
out Outcome D (silently using current ownership as a historical
denominator) and means the correct 25H.2 deliverable is the evidence
collector alone, with scoring explicitly blocked.

## What this ticket built

- `src/services/commercial-results.service-core.ts` — pure evidence
  engine (no Prisma import). `collectCommercialResultsEvidence` (the
  "evidence retrieval" half) and `computeCommercialResultsResult` (the
  orchestrator) are separate functions, per §20.
- `src/services/commercial-results.service.ts` — server-only Prisma
  wiring. Fetches every `WON_TRANSITION` `ProspectActivity` row in the
  period **company-wide**, not scoped to one employee — a deliberate
  difference from Execution Discipline's per-employee-scoped query,
  needed so `legacyUnattributedWinsInPeriod` can be computed honestly.
- `src/services/commercial-results.service-core.test.ts` — 24 tests
  covering every required category (§31–40).
- No schema change, no UI, no `/100` calculation — exactly as scoped.

## Authoritative result evidence

A WON event counts toward a Commercial's `creditedWins` only when, on
the `ProspectActivity` row itself:

```
type = WON_TRANSITION
creditedUserId = <this employee>
creditedUserRoleAtEvent = COMMERCIAL
occurredAt within [periodStart, periodEnd]  (both bounds inclusive)
```

Never `Prospect.assignedUserId` (current, mutable), never `agentName`
(the actor), never `Prospect.updatedAt` (not the canonical timestamp;
the row type doesn't even expose it) — `occurredAt` on the
`ProspectActivity` row is the only timestamp read.

## Role-at-event vs. current role — the one genuinely subtle design point

The ticket asks for two things that look contradictory at first:

- §2/§37: `MANAGER`/`ADMIN` must not be silently handed a Commercial
  Results evaluation.
- §17/§32: a win credited while `COMMERCIAL` remains eligible even after
  that person is later promoted to `MANAGER` — current role must never
  reinterpret historical credit.

These are reconciled by having **two different functions answer two
different questions**, matching Execution Discipline's own
evidence/orchestrator split:

- `collectCommercialResultsEvidence(employeeId, period, events)` takes
  **no current-role parameter at all**. Eligibility is governed entirely
  by the frozen `creditedUserRoleAtEvent` on each row. A currently-MANAGER
  employee id can be passed in directly and will correctly get back their
  real, historical COMMERCIAL-earned evidence — this is what §32 tests.
- `computeCommercialResultsResult(employee, period, events, now)` is the
  top-level orchestrator a real caller uses to ask "does this person's
  *current* profile get a Results dimension at all today" — it gates on
  `employee.role` (current), matching Execution Discipline's shape. This
  is what §37 tests, and it answers a genuinely different, legitimate
  question ("should we present this tile for this person right now") from
  the evidence function's question ("what did this person actually earn,
  historically, whenever it happened").

Neither function is wrong or redundant with the other; they serve
different callers. A future evaluation-assembly service that already
knows it's specifically reconstructing a past period's COMMERCIAL
rubric for someone regardless of their role today would call
`collectCommercialResultsEvidence` directly, bypassing the current-role
gate — exactly the shape 25G §25 anticipated ("evaluate each evidence
segment against the role effective when that evidence was produced").

## Legacy coverage boundary

`legacyUnattributedWinsInPeriod` counts distinct prospects with a
`WON_TRANSITION` in the period whose `creditedUserId` is `null` —
company-wide, not scoped to any one employee, because an unattributed
win cannot be attributed to anyone, including retroactively by
inference. `coverageStatus` is `PARTIAL_LEGACY_ATTRIBUTION` whenever
this count is nonzero, `COMPLETE` otherwise. Every period that ends
before 2026-08-28 (25H.1's migration date) will show at least
`PARTIAL_LEGACY_ATTRIBUTION` for any prospect that won before that date —
this is truthful, not a bug, and must not be "fixed" by heuristic
backfill later.

## Denominator/target audit — restated plainly

See "Required audit decision" above. Restated per the documentation
requirement: **no durable denominator, no durable target.** Both
absences were independently confirmed, not assumed.

## Exact formula: none implemented

Per Outcome C. `score` is always `null`; `status` is always
`BLOCKED_PENDING_TARGET_DOMAIN` for any successfully-evaluated
employee/period (after the role and period-closure gates pass), carrying
a fixed, non-empty `scoringBlockedReason` string. `maxScore` (40) and
`policyVersion` (`COMMERCIAL_RESULTS_V1`) are exposed even though no
score exists yet, so the shape is stable for whenever a real formula
does land — no caller needs to change how it reads the result type.

## Small-sample policy

Not applicable in the same sense as Execution Discipline, because there
is no numeric score to protect from false precision. `creditedWins: 0`
is returned as a plain, honest evidence value (not an error state) —
tested explicitly (§40) to confirm it never gets silently converted to
`0/40` or `40/40`, since no conversion to a score happens at all.

## Duplicate-WON policy

**One credited win per distinct prospect, per employee, per period.**
25H.1 proved a prospect can leave and re-enter WON, producing multiple
independent `WON_TRANSITION` rows, each with its own credit snapshot.
Within a single evaluation period, `collectCommercialResultsEvidence`
de-duplicates by `prospectId` — two WON events for the same prospect in
the same period count as one `creditedWins`, not two.
`rawCreditedWinEvents` (undeduplicated) is exposed alongside it so a
reader can see when de-duplication actually mattered. Across different
periods, each period counts its own occurrence independently — that is
not double-counting, since they are two separate evaluations.

Milestone double-counting (§13/§14 — `INTERESTED` → `READY_TO_DISCUSS` →
`WON` becoming three separate credits) does not arise in V1 at all: no
non-WON pipeline state is credited as a Results outcome, because none of
them (`READY_TO_DISCUSS`, `INTERESTED`, qualification) has durable
per-employee historical attribution — `PROSPECT_INTEREST_CHANGED` is not
even a tracked event family (confirmed: excluded from `/updates`'
source queries per `app/updates/updates-privacy-regression.test.ts` and
never durably recorded per Ticket 18A's own scope, which covers WON
alone). Documented here as a closed question, not an open gap: there is
currently nothing else to award Results credit for besides WON.

## Unsupported roles

`isScorableForCommercialResults` — `COMMERCIAL` only, same reasoning as
25G §6/§27 (no manager-of-employee hierarchy, no audited MANAGER/ADMIN
sales-outcome evidence). `computeCommercialResultsResult` returns
`UNSUPPORTED_ROLE` for any other current role, tested for both `ADMIN`
and `MANAGER`.

## Known limitations (do not reinterpret as forgotten features)

- **No numeric `/40` exists.** This is the ticket's intended outcome
  given the audit, not a missing feature to quietly patch in later
  without first building a target/denominator domain.
- **Pre-2026-08-28 WON events have permanently unknown individual
  attribution.** `legacyUnattributedWinsInPeriod` surfaces this; nothing
  reconstructs it.
- **No pipeline-progress crediting** (`READY_TO_DISCUSS`, qualification,
  etc.) — none of it has durable per-employee historical attribution
  today.
- **`Prospect` reassignment is untested/unenforced as an invariant** —
  it happens to never occur in any code path today, but nothing prevents
  a future ticket from adding it without also breaking the "no
  historical denominator" assumption further. Worth flagging for
  whichever ticket eventually touches prospect ownership editing.

## Whether another prerequisite ticket is required

**Yes.** Per §12 of the ticket, the correct next step for a numeric
Results score is a narrowly scoped **25H.2A — Commercial Performance
Target Domain** (or equivalent name), which must itself decide, as a
first-class, historically-snapshotted concept — not a field bolted onto
`User` — how a target is set, for whom, for which period, and how a
past target is preserved unchanged if targets are later revised. This
ticket does not propose that design; it only establishes that it's
required before `/40` can exist.

## Verification performed

```
npx tsc --noEmit
targeted tests (commercial-results.service-core.test.ts,
  prospect-won-transition/prospect-follow-up WON-attribution tests)
full test suite
targeted lint
production build
git diff --check
```

No live WON events were created for testing. No database access was
performed or needed — pure domain code plus Prisma wiring verified by
type-checking, consistent with 25H/25H.1.
