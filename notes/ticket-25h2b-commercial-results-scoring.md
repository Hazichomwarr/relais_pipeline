# Ticket 25H.2B — Commercial Results `/40` Scoring Formula

Implemented 2026-08-28. Completes the `COMMERCIAL` Results dimension by
combining 25H.2's durable credited-WON evidence with 25H.2A's durable
exact-period target. No schema change (25H.1/25H.2/25H.2A already
supplied every fact this formula needs). Execution Discipline untouched;
no `/100`, no Manager/Admin Results, no BARS.

## Formula

```
score = min(40, round(40 × creditedWins / targetWins))
achievementRate = creditedWins / targetWins   (unclamped)
```

`creditedWins` is 25H.2's already-deduplicated figure (one credit per
distinct prospect, never `rawCreditedWinEvents`) — §7's instruction,
followed literally.

## Achievement-rate representation — a deliberate deviation

`achievementRate` is a **raw decimal ratio** (`1.75`, `10`), not a
`conversionRate`-style percentage (×100). This was not the first
instinct — `commercial-dashboard-presentation.ts`'s existing
`conversionRate` helper uses the ×100 convention, and §15 of the ticket
even said "prefer either 0.75 or 75." But the ticket's own worked test
examples are unambiguous and take precedence: §16 states "achievementRate
= 1.75" for 7 wins against a target of 4, and §33 states "achievementRate
10" for 10 wins against a target of 1. Both are the raw decimal form.
Following the percentage convention instead would have silently
contradicted the ticket's own required test values. A future UI can
multiply by 100 to display a percentage.

## Score cap and overachievement

`score` never exceeds 40. `achievementRate` is never clamped — 10 wins
against a target of 1 scores `40/40` while `achievementRate` still reads
`10`, so overperformance stays visible in evidence even though the
component itself can't exceed its contractual weight (§23).

## Exact target lookup, no fallback

The service layer (`commercial-results.service.ts`) calls
`getCommercialPerformanceTarget(employeeId, period)` — 25H.2A's own
exact-lookup accessor — exactly once, in parallel with the WON-event
fetch. No "latest target," no "previous month" fallback exists anywhere
in this pipeline; `getCommercialPerformanceTargetCore` structurally
cannot produce one (§2, verified by 25H.2A's own §60/§61 tests, not
re-verified here).

## Zero wins vs. no target vs. incomplete coverage — three different "no number" states, kept distinct

These are easy to conflate and the ticket is explicit that they must
not be:

- **`creditedWins = 0` with a valid target and complete coverage** →
  `SCORED`, `score: 0`. This is a real, legitimate outcome — the
  employee had a defined expectation and met none of it (§11/§13). Not
  blocked, not `INSUFFICIENT_EVIDENCE`.
- **No target exists for the exact period** → `NO_TARGET`, `score: null`
  — even if `creditedWins` is nonzero. The evidence is still returned
  (transparency), just not converted to a number (§12/§35).
- **`legacyUnattributedWinsInPeriod > 0`** → `LEGACY_ATTRIBUTION_INCOMPLETE`,
  `score: null` — even when both a target and credited wins exist
  (§9/§38, tested explicitly). A `20/40` built on evidence known to be
  incomplete company-wide would look precise while possibly being wrong;
  refusing the number is more historically honest than presenting it
  with a caveat nobody will read.

Check order in `computeCommercialResultsResult`: role → period closure →
evidence collection → **coverage check → target lookup** → target
validity → score. Coverage is checked *before* target existence
specifically so a target present alongside incomplete coverage still
blocks (§9's example is answered by this ordering, not by a special
case).

## No small-sample threshold (deliberate, and different from 25H)

25H needed a small-sample floor because a 1-action execution rate is
genuinely uninformative on its own. 25H.2B does not add one: the
denominator here is an explicit management expectation, not a
self-selected sample — "1 win against a target of 4" is meaningful by
construction, at whatever size. §14's distinction, followed exactly.

## Defensive target validation (§5/§6)

Even though 25H.2A's write path already guarantees `targetWins > 0` and
`roleAtAssignment === "COMMERCIAL"` at creation time, this file never
trusts a table name alone. `computeCommercialResultsResult` re-validates
both before ever calling the score formula: non-integer, zero, or
negative `targetWins`, or `roleAtAssignment !== "COMMERCIAL"`, all
produce `INVALID_TARGET` — never `NaN`/`Infinity`, never a silent
correction. The pure formula functions
(`computeCommercialResultsScore`/`computeCommercialResultsAchievementRate`)
assume a valid target as a documented precondition; the orchestrator is
the actual enforcement boundary, so the formula itself stays simple.

## Current role vs. historical role-at-event (unchanged from 25H.2, restated)

Still two different functions answering two different questions:
`collectCommercialResultsEvidence` takes no current-role parameter and
is governed entirely by `creditedUserRoleAtEvent`; the top-level
`computeCommercialResultsResult` gates on the employee's *current* role
via `isScorableForCommercialResults`. A win credited while `COMMERCIAL`
remains eligible evidence after a later promotion to `MANAGER`; the
*live* orchestrator for that now-`MANAGER` person still returns
`UNSUPPORTED_ROLE` today. Both are correct, and neither collapses into
the other — this is the distinction the user asked to see survive into
the later performance model, and it did, unchanged in shape from 25H.2.

## Policy version

`COMMERCIAL_RESULTS_POLICY_VERSION = "COMMERCIAL_RESULTS_V1"` — unchanged
from 25H.2, since this ticket is the formula 25H.2's own policy version
was always meant to eventually carry, not a new policy.

## Snapshot-ready output

A `SCORED` result carries `score`, `maxScore`, `achievementRate`,
`targetWins`, `creditedWins`, `coverageStatus`, the full `evidence`
object (including `rawCreditedWinEvents`, `excludedNonCommercialRoleWins`),
and `policyVersion` — every field a future `PerformanceEvaluation`
snapshot would need, with no hidden state required to understand the
number (§25).

## What changed vs. 25H.2

- `commercial-results.service-core.ts`: `BLOCKED_PENDING_TARGET_DOMAIN`
  removed (25H.2A supplied what it was waiting on); added `SCORED`,
  `NO_TARGET`, `INVALID_TARGET`, `LEGACY_ATTRIBUTION_INCOMPLETE`;
  `computeCommercialResultsResult` now takes a `target` parameter and
  actually scores. `collectCommercialResultsEvidence` is byte-for-byte
  unchanged.
- `commercial-results.service.ts`: renamed export
  `computeCommercialResultsScore` → `getCommercialResultsForEmployee`
  (the pure formula in the core file now legitimately owns that name);
  fetches the target via `commercial-performance-target.service.ts`
  alongside the WON-event query.
- `commercial-performance-target.service-core.ts`: `CommercialPerformanceTargetRow`
  gained `roleAtAssignment` (already a persisted column since 25H.2A —
  this is a wider read, not a schema change) so the Results engine's
  defensive re-check has it without a second query.
- Two `role-transition-operational-continuity.test.ts`-style tests in
  `commercial-results.service-core.test.ts` needed the new `target`
  argument threaded through; no behavioral test was weakened, several
  were strengthened (the old "N/A in V1" cap/zero-wins tests are now
  real formula tests).

## Known limitations

- **Role-change-during-period consequences remain undecided** (25H.2A
  §26, restated by this ticket's §24) — a target created while
  `COMMERCIAL`, with the employee promoted to `MANAGER` mid-period,
  still scores against the full period's evidence. Whether that's
  correct or should be split/marked-incomplete is explicitly deferred to
  whichever future ticket needs to decide it.
- **No `PerformanceEvaluation` exists** — this remains a live,
  recomputable read, not a finalized snapshot. 25I (Role Responsibility)
  and beyond will need that snapshot infrastructure eventually.
- **Wrong-period-target integration** is covered by 25H.2A's own
  exact-lookup tests, not re-tested here at the core level, since
  `target` is passed into the pure core as an already-resolved value —
  there is nothing period-lookup-shaped left to test once past the
  service boundary.

## Verification performed

```
npx tsc --noEmit
targeted commercial-results tests (41 tests)
commercial-performance-target tests (unaffected, re-run to confirm)
WON attribution regression tests (25H.1's own suite, re-run to confirm)
full test suite
targeted lint
production build
git diff --check
```

The pre-existing, unrelated Sidebar test failure
("ADMIN and MANAGER sidebars include a distinct Rapports quotidiens...")
remains present and unrelated, exactly as flagged in every prior ticket
in this series.
