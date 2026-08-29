# Ticket 25P — Manager Results & Target Eligibility

Implemented 2026-08-29. `MANAGER` is now a legitimate subject of the
Results `/40` dimension and a valid monthly target subject, alongside
`COMMERCIAL`. `ADMIN` and `ASSISTANT` remain unsupported for both. No
schema change, no backfill, no historical rewrite — this ticket changes
interpretation policy only. Execution Discipline `/30` is untouched and
remains 25Q's job; 25O's Admin-only structured-assessment authority is
untouched.

## 1. The old vs. new subject matrix

| Role | Results `/40` subject (before) | Results `/40` subject (after 25P) | Target subject (before) | Target subject (after 25P) |
|---|---|---|---|---|
| COMMERCIAL | yes | yes | yes | yes |
| MANAGER | no (`UNSUPPORTED_ROLE`) | yes | no (`EMPLOYEE_NOT_ELIGIBLE`) | yes |
| ADMIN | no | no | no | no |
| ASSISTANT | no | no | no | no |

Both matrices are expressed as their own independent, positive
allow-lists — never a negative exclusion (`role !== "ADMIN"`):
`RESULTS_ELIGIBLE_ROLES` in `commercial-results.service-core.ts` and
`ELIGIBLE_EMPLOYEE_ROLES` (exported as `COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES`)
in `commercial-performance-target.service-core.ts`. They currently agree
by design, not by shared code — neither file imports the other's
constant, so either can diverge later without touching the other (see
§4 below on why target-management authority is a third, still-separate
policy).

## 2. Two independent Results gates — both had to move

25L's audit finding, restated and closed here: broadening only the
top-level subject gate would have been a release-blocking half-measure.
Two gates exist:

1. **Current-role subject gate** (`isScorableForCommercialResults`,
   `commercial-results.service-core.ts`) — decides whether the
   orchestrator (`computeCommercialResultsResult`) presents a Results
   dimension for this employee's *current* profile at all.
2. **Event-role evidence gate** (inside `collectCommercialResultsEvidence`)
   — decides whether a historical WON event's frozen
   `creditedUserRoleAtEvent` counts as valid evidence, regardless of the
   employee's current role.

Both now resolve against the same `RESULTS_ELIGIBLE_ROLES` set
(`COMMERCIAL`, `MANAGER`), but are kept as two separately-named call
sites rather than collapsed into one shared check (§6 of the ticket) —
a future divergence between "who is a subject today" and "which frozen
role is valid evidence" only requires touching one of the two.

## 3. Frozen event-role evidence — unchanged discipline, wider set

`collectCommercialResultsEvidence` still reads only
`creditedUserRoleAtEvent`, never the employee's current role — this
function doesn't even receive it. What changed is the membership test:
`=== "COMMERCIAL"` became `∈ RESULTS_ELIGIBLE_ROLES`. Consequences,
all covered by new tests:

- A win credited while MANAGER now counts, for any current role.
- A win credited while ADMIN or ASSISTANT remains excluded, even for a
  currently-MANAGER or currently-COMMERCIAL employee id — current status
  never retroactively validates an ineligible historical event-role.
- A mixed-role period (some wins credited while COMMERCIAL, some while
  MANAGER, within the same calendar month) counts both sides against one
  target — no period split, no role-transition penalty, promotion or
  demotion mid-month included.

The excluded-evidence field was renamed from `excludedNonCommercialRoleWins`
to `excludedIneligibleRoleWins` (§27 of the ticket): the old name became
actively misleading once MANAGER-at-event wins stopped landing in that
bucket. Blast radius was three files (the core, its own test, and
`performance-summary.service-core.test.ts`'s fixtures) — small enough
that leaving the misleading name in place was worse than the churn.

## 4. Target eligibility vs. target-management authority — kept separate

Per the ticket's explicit instruction (§15/§45), these are two different
policies and were not merged:

- **Target-subject eligibility** (`isEligibleForCommercialPerformanceTarget`)
  — who may *receive* a target. Widened to COMMERCIAL + MANAGER.
- **Target-management authority** (`canManageCommercialPerformanceTargets`)
  — who may *create/edit/delete* a target. **Left completely untouched.**
  It already included both ADMIN and MANAGER before this ticket, for an
  unrelated reason (25H.2A's own org-wide V1 management scope — no
  manager-of-employee hierarchy exists to scope it further). This was
  audited, confirmed pre-existing, and documented rather than silently
  folded into 25P's own reasoning, per the ticket's own instruction not
  to conflate the two.

A MANAGER becoming a valid target *subject* grants that MANAGER no new
*authority* — a Manager still cannot create their own target (no
self-assignment), exactly as before.

## 5. `roleAtAssignment` — historical snapshot, not a compatibility lock

Creating a target for a MANAGER now succeeds and snapshots
`roleAtAssignment = MANAGER`; creating one for a COMMERCIAL still
snapshots `COMMERCIAL`. No normalization in either direction. The
scoring engine's own defensive re-check of `target.roleAtAssignment`
(`CommercialResultsTarget` in `commercial-results.service-core.ts`) was
widened identically — from `!== "COMMERCIAL"` to
`!RESULTS_ELIGIBLE_ROLES.has(...)` — but this check was **never** a
comparison against the employee's *current* role; it only validates the
target row's own stored value. This distinction matters directly for
promotions: a target created while an employee was COMMERCIAL, used
later after that employee is promoted to MANAGER, remains valid — the
snapshot is used as-is, never re-validated against who the employee is
today (Ticket 25P §37, now covered by an explicit regression test). The
reverse (a target snapshotted MANAGER, employee since demoted to
COMMERCIAL) is symmetric and equally valid.

No duplicate-target risk from a mid-period promotion: the unique
`(userId, periodStart, periodEnd)` constraint and the exact-month
lookup are both completely unchanged, so a July target created for a
COMMERCIAL who is promoted to MANAGER on July 15 remains the one and
only authoritative July target — mixed Commercial-at-event and
Manager-at-event wins for that month are simply evaluated against it
together (§38/§39 of the ticket).

## 6. No exact-target fallback, unchanged

Exact calendar-month lookup only — no nearest-target, no fallback, no
"copy prior month," for either role. A current Manager with no exact
target for the period returns `NO_TARGET`, explicitly never
`UNSUPPORTED_ROLE` (the two are structurally distinct outcomes and this
was the exact confusion 25L flagged as a risk).

## 7. Results formula — unchanged, verified unchanged

`score = min(40, round(40 × creditedWins / targetWins))` and
`achievementRate = creditedWins / targetWins` (raw, unclamped) are
untouched. No Manager-specific formula, cap, or rounding rule exists —
new tests prove the identical formula produces identical results for a
Manager subject as for a Commercial one at every tested point (0, 1, 3,
4 wins against a target of 4; 6 wins over-target capping at 40 while
achievementRate reads 1.5).

## 8. `LEGACY_ATTRIBUTION_INCOMPLETE` precedence — unchanged for Manager

Coverage is still evaluated before target lookup: a period with
unattributed legacy WON evidence resolves to
`LEGACY_ATTRIBUTION_INCOMPLETE` for a current Manager exactly as it
already did for a current Commercial, even when a valid target and
otherwise-complete evidence coexist. Manager eligibility does not weaken
this existing state ordering — confirmed by a new regression.

## 9. WON attribution and prospect ownership — audited, untouched

`resolveWonCredit` (`prospect-won-transition.service-core.ts`) already
snapshotted the assigned owner's role faithfully with no role filtering
— confirmed by reading the function and its existing test coverage
(which already parametrizes COMMERCIAL/MANAGER/ADMIN and asserts the
snapshot matches whatever role the owner held). No change was needed or
made here (Ticket 25P §41/§58): a Manager-owned prospect transitioning to
WON already produced `creditedUserRoleAtEvent = "MANAGER"` before this
ticket: 25P's contribution is entirely on the *reading* side (which
event-roles count as Results evidence), not the *writing* side.
`PROSPECT_OWNER_ROLES` (25M) and `PROSPECT_ACTION_ASSIGNEE_ROLES` were
not touched — Results eligibility follows existing commercial-work
policy; it does not broaden ownership or task-assignment eligibility.

## 10. One shared Results dimension — no new domain objects

No `ManagerResultsScore`, no `ManagerPerformanceTarget`. Manager and
Commercial Results run through the exact same
`computeCommercialResultsResult` / `CommercialPerformanceTarget` engine.
Per the ticket's own §12, `CommercialPerformanceTarget` (model/table
name) is **not** renamed — the naming is now slightly narrower than the
policy it enforces, and 25L already found a rename not worth the blast
radius for aesthetics alone; this note is the documentation the ticket
asked for in place of a rename.

## 11. UI changes

- `app/admin/performance-targets/page.tsx` — the employee dropdown now
  comes from a new `listCommercialResultsTargetEligibleUsers()`
  (`user.service.ts`), filtered by the exported
  `COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES`, replacing the
  Commercial-only `listAssignableUsers()` this page used before (that
  function is left untouched — it serves a distinct, unrelated
  "Commercial prospect assignment" concept per its own existing doc
  comment, and 25P does not touch it).
- `component/admin/CommercialPerformanceTargetForm.tsx` — prop renamed
  `commercials` → `eligibleEmployees`; label "Commercial" →
  "Commercial ou manager"; placeholder "Sélectionnez un commercial" →
  "Sélectionnez un employé". No hardcoded role filtering exists in this
  component — it renders whatever list it's given, so eligibility is
  enforced entirely server-side (the listing query, plus the
  service-core's own re-check at creation).
- `component/admin/CommercialPerformanceTargetList.tsx` — table header
  "Commercial" → "Employé". The list never displayed `roleAtAssignment`
  per row before or after this ticket; nothing else changed.
- `src/lib/validations/commercial-performance-target.schema.ts` —
  validation messages generalized ("Sélectionnez un commercial." →
  "Sélectionnez un employé.").
- `app/admin/performance/page.tsx` (the read-only performance dashboard)
  needed **zero** changes — it has no role-specific Results branching at
  all; it renders whatever `summary.results.status` the now-widened core
  produces, and `describeDimensionUnavailability`'s `UNSUPPORTED_ROLE`
  copy was already role-agnostic ("le rôle actuel de cet employé").

## 12. Performance-summary integration — no premature `/100`

`composePerformanceSummary` needed no change: it has never contained
role-gating logic, only status-based blocking. A Manager can now
legitimately reach `results.status === "SCORED"` while
`executionDiscipline.status` remains `UNSUPPORTED_ROLE` (Execution
Discipline eligibility is 25Q's job, untouched here) — the composition
core already refuses to fabricate `machineDerivedSubtotal` or `overall`
from a partial pair, so this produces `INCOMPLETE` with a single
`EXECUTION_DISCIPLINE` blocker, never a normalized or papered-over
result. Locked in with a new explicit regression.

## 13. What stayed exactly as it was

No schema or migration change (`git diff --stat prisma/` is empty).
`roleAtAssignment` and `creditedUserRoleAtEvent` already supported
`MANAGER` as a Prisma enum value — nothing to migrate. No backfill: no
existing `roleAtAssignment` or `creditedUserRoleAtEvent` row was
rewritten, no target row was fabricated, no WON event was re-credited.
25O's Admin-only structured-assessment authority
(`canMutateOwnedStructuredEvaluation`, `canDeleteStructuredEvaluationDraft`,
`canAssessEmployeeInStructuredEvaluation`) is untouched — Manager
becoming a Results subject grants no evaluator authority back. Target
management authority (§4) is untouched. Prospect ownership and
ProspectAction assignment eligibility are untouched.

## 14. Live historical reinterpretation — documented, not prevented

Results are computed live on every request (25L), never persisted as a
snapshot. This means the moment this ticket deploys, every past closed
period involving a Manager is reinterpreted immediately under the new
policy — a Manager's July result that was `UNSUPPORTED_ROLE` yesterday
may show as a real `SCORED` value today, using the exact same underlying
WON events and targets that already existed. This is expected and
correct under the existing "policy changes reinterpret history"
architecture (25L), not a bug and not something a migration could or
should prevent without introducing persisted score snapshots, which
remains out of scope.

## 15. Verification

`npx tsc --noEmit` (clean). Full `npm test` — 2094 tests, 2093 pass; the
one failure is the same pre-existing, unrelated `Sidebar.test.tsx`
"Rapports quotidiens" test confirmed via `git stash` in earlier tickets
to predate this session. `npx eslint .` (clean). `npm run build`
(clean). `git diff --check` (no whitespace issues). New/updated
coverage: the complete current-role subject matrix (§46), the event-role
evidence matrix including ADMIN/ASSISTANT exclusion (§47), the
mixed-role and demotion-period regressions (§22/§23/§48/§55), the
NO_TARGET-vs-UNSUPPORTED_ROLE distinction for a current Manager (§49),
the full Manager scoring range including over-target capping (§18-21/§50),
the `LEGACY_ATTRIBUTION_INCOMPLETE` precedence regression for Manager
(§51), the target-subject eligibility matrix and `roleAtAssignment`
snapshot fidelity for Manager (§52/§53), the promotion-after-target-
creation regression (§37/§54), and the Manager partial-composition
regression (§30/§31). A new source-level test
(`app/admin/performance-targets/performance-targets-eligibility.test.ts`)
locks in that the target-creation dropdown is sourced from the
COMMERCIAL+MANAGER eligibility query, never the Commercial-only helper.
No live database mutation, target creation, prospect reassignment, or
WON transition was performed against the live Neon database to produce
any of this coverage — the optional read-only DB diagnostic suggested by
the ticket (§61) was skipped as unnecessary given the exhaustive core
test coverage above.

## 16. Deferred to later tickets

`25Q` — Manager Execution Discipline `/30` eligibility (the second
machine-scored dimension a Manager needs to reach a complete `/100`).
`25R` — performance role matrix & dashboard integration, including the
still-open Assistant Professional Contribution `/10` decision. Nothing
in that sequencing changed.
