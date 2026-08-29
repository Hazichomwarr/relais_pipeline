# Ticket 25K — Management Performance Dashboard & Final Evaluation Composition

Implemented 2026-08-28. Composes the four completed dimensions into one
management read model and dashboard. No new scoring logic, no schema
change, no finalized `PerformanceEvaluation` snapshot table.

```
Results                     / 40   (25H.2 + 25H.2B)
Execution Discipline        / 30   (25H)
Role Responsibilities       / 20   (25I)
Professional Contribution   / 10   (25J)
                            ─────
Overall                     /100   (25K, only when all four are authoritative)
```

## 1. Composition architecture

Three layers, mirroring every prior dimension ticket's split:

- **Pure composition core** (`performance-summary.service-core.ts`) —
  `composePerformanceSummary(input)`. Takes the four already-computed
  dimension results, decides subtotal/overall availability and
  blockers. No Prisma, no formula recomputation, no formatting.
- **Orchestration service** (`performance-summary.service.ts`) —
  `getEmployeePerformanceSummary(actor, employeeId, period)`. Fetches
  all four dimensions in parallel from their own authoritative services
  (`getCommercialResultsForEmployee`, `computeCommercialExecutionDisciplineScore`,
  and two new minimal lookups added to 25I/25J, see §17) and hands them
  to the pure core. Read-only.
- **Presentation** (`performance-summary-presentation.ts`) — pure,
  React-free formatting (achievement-rate percentage conversion, French
  unavailability messages, period labels), matching this repo's
  established `*-presentation.ts` convention.

## 2. Role support matrix

| Employee's current role | Results | Execution Discipline | Role Responsibilities | Professional Contribution | Overall possible? |
|---|---|---|---|---|---|
| COMMERCIAL | Available | Available | Available | Available | Yes, if all four are authoritative for the period |
| MANAGER | `UNSUPPORTED_ROLE` | `UNSUPPORTED_ROLE` | Available | Available | No — machine dimensions structurally unsupported for this role |
| ADMIN | `UNSUPPORTED_ROLE` | `UNSUPPORTED_ROLE` | `UNSUPPORTED_ROLE`/no assessment | `UNSUPPORTED_ROLE`/no assessment | No |

This is not a special case coded into 25K — it falls out naturally from
each dimension's own existing role gate. 25K adds no role-branching
logic beyond what §13/§14 of the ticket asked to document.

## 3. Overall score availability rule

`overall` is non-null only when Results and Execution Discipline are
both `SCORED` **and** Role Responsibilities and Professional
Contribution are both `SUBMITTED`. Equivalently: only when both
subtotals (§11/§12 below) exist. No partial overall, no weighting
beyond the plain sum (each component is already expressed in its final
weighted range).

## 4. Machine-derived and human-assessed subtotals

- `machineDerivedSubtotal` (`/70`) — Results + Execution Discipline,
  only when both are `SCORED`. Never built from one alone.
- `humanAssessedSubtotal` (`/30`) — Role Responsibilities +
  Professional Contribution, only when both are `SUBMITTED`. A `DRAFT`
  assessment never counts, even if a score would technically exist on
  the row once finalized.

Both are `null`, not partially populated, the instant either half is
unavailable — tested explicitly (§80/§82, §81 and its DRAFT variant).

## 5. Missing vs. zero semantics

The single most important invariant in this ticket, and the one with
the most dedicated tests: a dimension that is `SCORED`/`SUBMITTED` with
a value of `0` is a real, valid zero — it composes into subtotals and
the overall exactly like any other number. A dimension that is
`NO_TARGET`, `DRAFT`, `NOT_STARTED`, etc. is not zero — it is absent,
and `overall`/the relevant subtotal is `null`. §77/§78 (valid zero,
all-zero) and §75/§76 (blocked Results, DRAFT Professional
Contribution) are tested as explicitly distinct scenarios, not variants
of the same code path.

## 6. Dimension blocker mapping

`blockers: { dimension, sourceStatus }[]` preserves the exact original
status string from whichever dimension produced it (`NO_TARGET`,
`LEGACY_ATTRIBUTION_INCOMPLETE`, `INSUFFICIENT_EVIDENCE`,
`UNSUPPORTED_ROLE`, `PERIOD_NOT_CLOSED`, `EMPLOYEE_NOT_FOUND`, `DRAFT`,
`NOT_STARTED`) — never collapsed into a generic `MISSING` in the core.
Translation to French happens only in `performance-summary-presentation.ts`,
one level up, which every status maps to a distinct, non-leaking
sentence (tested: no raw status string ever appears in a produced
message).

## 7. Current/open period handling

Both machine-derived dimensions already refuse to score a period whose
`periodEnd` hasn't passed (`PERIOD_NOT_CLOSED`), and 25I/25J's
assessment creation refuses the same for a new draft. 25K adds no
separate open-period logic — `PERIOD_NOT_CLOSED` simply flows through
as a blocker like any other, with its own translated message ("Cette
période n'est pas encore terminée."), never presented as an
authoritative score.

## 8. Historical role limitation — restated, not solved

25I/25J's `roleAtEvaluation`/`evaluatorRoleAtEvent` remain snapshots of
the *current* role at assessment-creation time, not verified whole-
period guarantees. 25K does not add, remove, or paper over this — it
composes whatever the two assessment domains already report, honestly.

## 9. The former-Commercial decision (the ticket's own "most important
composition issue")

**Required audit finding**: Execution Discipline has **no per-action
role snapshot** — `ProspectAction` carries `assignedToUserId`/`dueAt`/
`completedAt`/`canceledAt`/`status` and nothing identifying what role
the assignee held at the time. Results, by contrast, *does* have
`creditedUserRoleAtEvent` (25H.1). This asymmetry means a historical
"was this person a COMMERCIAL during period X" reconstruction is
possible for Results but categorically not for Execution Discipline —
there is no fact in the schema to reconstruct it from.

**Decision**: 25K does not attempt to bypass either dimension's
current-role-gated top-level orchestrator
(`computeCommercialResultsResult`/`computeExecutionDisciplineResult`,
both already correctly period-scoped for any closed historical period).
A former-COMMERCIAL-now-MANAGER's historical August evidence is **not**
reconstructed by this ticket. Viewing August for someone who was
COMMERCIAL then and is MANAGER now shows Results/Execution Discipline
as `UNSUPPORTED_ROLE` today, even though the underlying August evidence
still technically exists and is reconstructable via lower-level
functions (`collectCommercialResultsEvidence` has no role parameter at
all — see 25H.2's own design). This is a known, explicit limitation,
not a bug, and matches the ticket's own §53 "perfectly acceptable" V1
boundary — attempting the asymmetric bypass (Results only, not
Execution) would have made the two machine-derived dimensions behave
inconsistently for the exact same employee/period, which would be
worse than a uniform, honest `UNSUPPORTED_ROLE`.

## 10. No-normalization rule

Verified structurally: `composePerformanceSummary` never divides a
partial sum by a partial max and rescales. If only Results (32/40) and
Execution (24/30) are available, there is no `56/70 → 80/100` step
anywhere in the code — `machineDerivedSubtotal` stays `{56, 70}` and
`overall` stays `null` until the two human dimensions are also
authoritative.

## 11. No-ranking rule

No employee list, no sorting by score, no leaderboard exists in this
ticket. The dashboard requires an explicit employee selection (§66) —
no default "best" or "worst" employee is ever computed or displayed.

## 12. Privacy

Not touched by this ticket at all — no `/updates`, analytics, or
prospect-history code path references any performance-summary type or
service. Same pattern as every prior performance-dimension ticket.

## 13. Authorization

Three layers:

- **Coarse route gate**: `requirePerformanceDashboardAccess()`
  (`ADMIN`/`MANAGER`, its own dedicated constant per this repo's "one
  constant per feature" convention, even though it's identical to two
  other lists today).
- **Fine per-employee gate**: `canViewEmployeePerformance(actorRole,
  employeeRole)` — `ADMIN` may view anyone; `MANAGER` may view only
  `COMMERCIAL` employees (organization-wide, since no manager-of-
  employee hierarchy exists — same documented limitation as every
  prior ticket in this series); `COMMERCIAL` may never open the
  dashboard. **Deliberately a separate function from
  `canAssessEmployeeInStructuredEvaluation`** (25I/25J's shared
  assessment-authority primitive) — viewing and assessing are different
  permissions (no self-view restriction is meaningful for viewing; a
  `MANAGER` gets no `ADMIN`-style carve-out for viewing another
  `MANAGER` the way assessment grants one to `ADMIN` specifically).
  Coupling them would have coincidentally worked today and silently
  diverged the moment either policy changes on its own.
- **IDOR protection** (§36): `employeeId` and `period` come from the
  URL/query on every request; `getEmployeePerformanceSummary` re-checks
  `canViewEmployeePerformance` itself, never trusting that the route's
  coarse gate or the client-rendered `<select>` options are sufic ient.

## 14. Read-only dashboard contract

Verified structurally (test: "no Server Action, no create/submit/delete
call anywhere on the page"): the dashboard page imports no `*.actions`
module and has no `"use client"` directive. Selecting an employee/period
is a plain GET `<form>` (matching `FinancialReportPeriodFilter`'s
existing convention), not a mutation.

## 15. Snapshot/reproducibility audit

**Execution Discipline reconstruction remains exact** (re-verified, not
assumed): `dueAt`/`assignedToUserId` are immutable after creation and
`completedAt`/`canceledAt` are write-once (confirmed originally in 25H,
unchanged since). This is *why* 25K can safely compose a live read
without a new `PerformanceEvaluation` snapshot table — every dimension
it reads is already either genuinely immutable (submitted 25I/25J
assessments) or exactly reconstructable from durable, unedited facts
(Results evidence, Execution Discipline evidence) for any closed
period. No schema change was needed or made.

## 16. Future finalized-evaluation considerations (explicitly deferred)

25K's `overall` is a **deterministic composed read model**, not a
submitted HR artifact. It has no acknowledgment, no review-conversation
record, no independent immutability of its own beyond what its four
inputs already provide (a submitted 25I/25J assessment doesn't change;
Results/Execution Discipline evidence for a closed period doesn't
change either, but the *live composition* re-runs on every page load —
it isn't itself "frozen" as a `/100` artifact). A future ticket may add
a `PerformanceEvaluation` snapshot, acknowledgment workflow, or
correction/supersession lifecycle — none of that is smuggled into 25K.

## 17. What this ticket built

- `src/services/performance-summary.service-core.ts` — pure composition
  core: `composePerformanceSummary`, `canViewEmployeePerformance`.
- `src/services/performance-summary.service.ts` — orchestration:
  `getEmployeePerformanceSummary`.
- `src/lib/performance-summary-presentation.ts` — pure formatting
  helpers, no React.
- Two minimal, additive lookups added to already-shipped 25I/25J
  service files: `getRoleResponsibilityAssessmentForEmployeePeriod`,
  `getProfessionalContributionAssessmentForEmployeePeriod` — exact-period
  lookups mirroring `getCommercialPerformanceTarget`'s "no fallback"
  contract. Neither existing exported function in either file was
  changed; both files' full test suites were re-run unchanged
  afterward.
- `authorization.service-core.ts`/`authorization.service.ts` — new
  `PERFORMANCE_DASHBOARD_ACCESS_ROLES` constant and
  `requirePerformanceDashboardAccess()` wrapper.
- `app/admin/performance/page.tsx` — the dashboard: employee/period GET
  selector, overall score card, two subtotal cards, four dimension
  cards with evidence detail, all read-only.
- Linked from `/admin/users` for discoverability, alongside the
  existing performance-targets/performance-assessments links.
- 13 (composition core) + 3 (view authorization) + 2 (route
  authorization) + 13 (presentation) + 8 (page authorization/contract)
  = 39 new tests.

## 18. Future Phase 26 tenant-isolation note

Not implemented, per instruction. Documented invariant for whenever
26B lands: **all composed performance evidence — Results, Execution
Discipline, Role Responsibility and Professional Contribution
assessments, and the employee/evaluator identities they reference —
must belong to the same Organization.** Performance records are
among the most sensitive resources in this CRM (26A's own audit
already flagged this category generally); this composition layer
would need every one of its four parallel fetches independently scoped
to the resolved tenant, not just the employee-existence check at the
top.

## Verification performed

```
npx tsc --noEmit
targeted tests (performance-summary.service-core.test.ts,
  performance-summary-presentation.test.ts,
  performance-authorization.test.ts)
25H/25H.2B regression (execution-discipline, commercial-results —
  unaffected, only imported as types)
25I/25J regression (role-responsibility-assessment.service-core.test.ts,
  professional-contribution.service-core.test.ts — unchanged, re-run
  after the two additive lookup functions were added)
authorization tests
full test suite (1940 tests; the 1 pre-existing unrelated Sidebar
  failure remains, unrelated to this ticket)
targeted lint (repo-wide, clean)
production build (/admin/performance registered)
git diff --check
```

No real employee evaluations were created for testing. No live
database access was performed or needed, and no schema/migration file
exists for this ticket — confirmed by the diff containing no
`prisma/` changes at all.
