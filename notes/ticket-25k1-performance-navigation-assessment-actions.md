# Ticket 25K.1 — Performance Navigation & Assessment Actions

Implemented 2026-08-29. A finishing ticket, not another performance-domain
build: makes the 25K dashboard discoverable from navigation, and turns its
two human-assessed dimension cards from purely informational into
actionable deep links into the existing 25I/25J assessment workflow. No
new scoring logic, no schema change, no new authorization policy.

## 1. Navigation

Added a "Performance" entry (`Gauge` icon, `/admin/performance`) to both
`Sidebar.tsx` (desktop) and `AdminMobileHeader.tsx` (mobile), gated
identically to the existing "Mes prospects" entry: `role === "ADMIN" ||
role === "MANAGER"`. This mirrors — but does not call — the dashboard's
own coarse access gate (`PERFORMANCE_DASHBOARD_ACCESS_ROLES` /
`requirePerformanceDashboardAccess`); nav visibility is cosmetic, the
route itself remains the authority, same as every other AdminShell nav
item. `AdminShell`'s `activeItem` union gained `"performance"`, applied
to `/admin/performance`, `/admin/performance-assessments` (list + both
detail routes), and `/admin/performance-targets` for consistent
highlighting across the whole performance domain.

`canViewEmployeePerformance` and `canAssessEmployeeInStructuredEvaluation`
are per-employee functions (they need a target role/id) and cannot gate
a generic nav link — no attempt was made to force them into that role.

## 2. Audit: does `/admin/performance-assessments` support deep-linking?

Before touching anything, read the route as it stood after 25J:

- One page, two sections (Role Responsibilities, Professional
  Contribution) stacked in a single scroll — not tabs, not separate
  routes for the "new assessment" step.
- No `searchParams` handling at all. Both create forms
  (`RoleResponsibilityAssessmentForm`, `ProfessionalContributionAssessmentForm`)
  hardcode `employeeId: ""` and `lastClosedMonthDefaults()` as their only
  defaults.
- Assessment *type* was never a query concern — it's structural: which
  form/list pair renders is fixed by the section, not a parameter.
- The two detail routes are keyed by `assessmentId` alone
  (`/admin/performance-assessments/[assessmentId]` and
  `/admin/performance-assessments/professional-contribution/[assessmentId]`),
  not by employee+period — so "continue this draft" and "view this
  submitted assessment" both need the assessment's own id, not
  employee/year/month.

Conclusion: no `type=` parameter was needed. The two sections already
live on one page; a URL fragment (`#role-responsibility` /
`#professional-contribution`) plus browser-native scroll-to-anchor is
sufficient to land the visitor on the right section, and each section
now got a stable `id`. What *was* missing — employee/period prefill —
is the smallest safe addition: two optional query params
(`employeeId`, `year`, `month`) read once on the page and threaded
through as `initialEmployeeId`/`initialYear`/`initialMonth` props to
both forms' `defaultValues`. They carry no authority: the Server
Actions those forms submit to still run their full Zod validation
unchanged, so a tampered or nonsensical value can, at worst, leave a
form pre-filled with something invalid — never something unsafe.
`parsePrefillMonth`/`parsePrefillYear` reject non-integer or
out-of-range input by falling back to `undefined` (→ the form's own
`lastClosedMonthDefaults()`), so a garbage query string degrades to the
pre-25K.1 behavior rather than rendering `NaN` into a controlled input.

## 3. Exposing the assessment id through the composition layer

The CONTINUE/VIEW links both need a specific `assessmentId`, which
`StructuredAssessmentDimensionSummary` (25K) didn't carry — it only had
`status`/`score`/`maxScore`. Widened to:

```ts
type StructuredAssessmentDimensionSummary =
  | { status: "SUBMITTED"; score: number; maxScore: number; assessmentId: string }
  | { status: "DRAFT"; score: null; maxScore: number; assessmentId: string }
  | { status: "NOT_STARTED"; score: null; maxScore: number; assessmentId: null }
  | { status: "UNSUPPORTED_ROLE"; score: null; maxScore: number; assessmentId: null };
```

`UNSUPPORTED_ROLE` is new here too (§4 below). Both
`getRoleResponsibilityAssessmentForEmployeePeriod` and
`getProfessionalContributionAssessmentForEmployeePeriod` already
selected `id` since 25K — only the composition types and
`toStructuredAssessmentSummary` needed to carry it through.

## 4. UNSUPPORTED_ROLE was missing for the human dimensions

Before this ticket, `performance-summary.service.ts` queried the
assessment table unconditionally and let "no row found" collapse to
`NOT_STARTED` — true for a COMMERCIAL/MANAGER with no assessment yet,
but misleading for an ADMIN employee, where no row can *ever* exist
(the catalog has no entry for that role). §15 of the ticket explicitly
forbids a creation CTA for an unsupported-role dimension, which requires
telling the two cases apart. `getEmployeePerformanceSummary` now checks
`isRoleSupportedForRoleResponsibilityAssessment(employee.role)` /
`isRoleSupportedForProfessionalContribution(employee.role)` *before*
querying — skipping the query entirely for an unsupported role and
composing `UNSUPPORTED_ROLE` directly, mirroring how Results/Execution
Discipline already report the same status for their own role gates.
`composePerformanceSummary` needed no change: it already treats any
non-`SUBMITTED` status as a blocker uniformly.

## 5. Assess authority, computed once, kept distinct from view authority

`getEmployeePerformanceSummary`'s `actor` parameter widened from
`{ role }` to `{ id, role }` — `canAssessEmployeeInStructuredEvaluation`
needs the actor's id for its self-assessment exclusion. The FOUND
result now carries a `canAssess: boolean` field, computed via that same
shared primitive 25I/25J already gate creation with:

```ts
const canAssess = canAssessEmployeeInStructuredEvaluation(actor, employee.role, employee.id);
```

This is deliberately **not** `canViewEmployeePerformance` and does not
touch it. A MANAGER viewing their own dashboard for a COMMERCIAL
employee can see the summary (`canViewEmployeePerformance` says yes)
without necessarily being the one who may assess them in every case —
today the two happen to agree for COMMERCIAL, but they diverge for
MANAGER employees (a MANAGER can never view another MANAGER at all,
so this case doesn't even reach the CTA; an ADMIN viewing a MANAGER can
view *and* assess). Keeping them as two separate computations, exactly
as 25K's own doc comment already warned, means a future change to
either policy can't silently leak into the other.

## 6. The CTA state machine

One pure, tested function decides the entire matrix —
`getAssessmentActionState` in `performance-summary-presentation.ts`:

```ts
function getAssessmentActionState(input: {
  status: "SUBMITTED" | "DRAFT" | "NOT_STARTED" | "UNSUPPORTED_ROLE";
  canAssess: boolean;
  periodClosed: boolean;
}): "NONE" | "CREATE" | "CONTINUE" | "VIEW"
```

| status | canAssess | periodClosed | state | why |
|---|---|---|---|---|
| SUBMITTED | any | any | VIEW | already authoritative; viewing isn't gated by assess authority |
| UNSUPPORTED_ROLE | any | any | NONE | §15 — no CTA is ever correct for a role the domain can't score |
| DRAFT | false | any | NONE | not this viewer's call to make |
| DRAFT | true | any | CONTINUE | reopen, never a second create |
| NOT_STARTED | false | any | NONE | not authorized |
| NOT_STARTED | true | false | NONE | 25I/25J both refuse creation before period close (§23) — a CTA that would bounce on click is worse than none |
| NOT_STARTED | true | true | CREATE | the only state that offers "Évaluer…" |

`/admin/performance/page.tsx`'s `HumanAssessedDimensionContent` renders
purely off this state — it never re-derives the matrix in JSX. When the
resolved state is `NONE` for a still-open period, the unavailability
message swaps from the generic "aucune évaluation créée" to the
existing `PERIOD_NOT_CLOSED` copy (already defined in
`describeDimensionUnavailability` since 25K), so the absence of a CTA
reads as "too early," not "not your call" or "nothing here" — the three
have different messages and this ticket keeps them distinguishable
end-to-end. `periodClosed` is computed once per render from the
already-resolved `{ periodStart, periodEnd }` (`period.periodEnd.getTime()
<= new Date().getTime()`, not re-derived from a hidden default) — the
`Date.now()` form was rejected by the repo's `react-hooks/purity`
eslint rule for Server Components; `new Date().getTime()` reads
identically and passes.

## 7. Results and Execution Discipline never call this

`HumanAssessedDimensionContent` is used exactly twice on the page — once
per human dimension. The Results and Execution Discipline
`DimensionCard`s keep their pre-25K.1 direct-JSX `content` exactly as
25K wrote it. There is no shared code path a future edit could
accidentally extend into offering a CTA for either machine-derived
dimension.

## 8. CTA hrefs

- **CREATE** → `/admin/performance-assessments?employeeId=…&year=…&month=…#role-responsibility`
  (or `#professional-contribution`) — lands on the create form,
  pre-filled, scrolled to the right section.
- **CONTINUE** and **VIEW** → the same route either way:
  `/admin/performance-assessments/{assessmentId}` (Role Responsibilities)
  or `/admin/performance-assessments/professional-contribution/{assessmentId}`
  (Professional Contribution). The existing detail component already
  renders editable-if-DRAFT / read-only-if-SUBMITTED — 25K.1 doesn't
  duplicate that branching, only the CTA *label* differs
  ("Continuer l'évaluation" vs. "Voir le détail").

## 9. Return-to-dashboard link

§24 asked for query context to survive the round trip without an
arbitrary `returnUrl`. Both detail pages now render a second link,
"Retour à la vue d'ensemble," alongside the existing "Retour aux
évaluations":

```ts
const dashboardHref = `/admin/performance?employeeId=${assessment.employeeUserId}&year=${assessment.periodStart.getUTCFullYear()}&month=${assessment.periodStart.getUTCMonth() + 1}`;
```

Built entirely from the assessment's own already-loaded
`employeeUserId`/`periodStart` — no forwarded query parameter, no new
trust boundary. It works identically whether the visitor arrived from
the dashboard, from `/admin/performance-assessments`, or via a bookmark.

## 10. Read-only guarantee preserved

`/admin/performance` still renders zero manual score/number inputs and
performs zero writes: `HumanAssessedDimensionContent` only renders
`<Link>` elements, never a form, action import, or mutation call. The
existing 25K tests asserting no `Action(` import and no `"use client"`
on the page continue to pass unchanged; new tests added alongside them
assert no create/submit action import was introduced by this ticket
either.

## 11. Database safety

No real assessment was created for any employee to verify this ticket.
Every CTA-state/authorization/deep-link scenario is covered by the pure
`getAssessmentActionState` unit tests, the composition-core tests, and
source-regex tests against the page/service files (the same pattern
already used for `performance-authorization.test.ts`, since these pages
transitively import next-auth and can't run under plain `node:test`).
No live-DB manual verification was performed.

## 12. Amidou-style acceptance case, re-verified

The pre-existing 25K composition test for a MANAGER employee (Results/
Execution `UNSUPPORTED_ROLE`, human dimensions available) still passes
unchanged. A new test alongside it confirms the *correct*, previously-
untested shape for an ADMIN employee: `UNSUPPORTED_ROLE` — not
`NOT_STARTED` — on both human dimensions too, which is what the real
orchestrator now actually produces after §4's fix.

## 13. Verification

`npx tsc --noEmit`, full `npm test` (1972 tests; the one pre-existing,
unrelated `Sidebar.test.tsx` "Rapports quotidiens" failure — confirmed
via `git stash` to predate this session — is the only failure),
`npx eslint .` (clean after switching `Date.now()` → `new Date().getTime()`
for the purity rule), `npm run build` (clean), `git diff --check` (no
whitespace issues), then unstaged per this session's convention of
leaving verified work uncommitted until explicitly requested.
