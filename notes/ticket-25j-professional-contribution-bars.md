# Ticket 25J — Behaviorally Anchored Professional Contribution `/10`

Implemented 2026-08-28. Completes the fourth and final performance
dimension. All four dimensions now exist:

```
Results                     / 40
Execution Discipline        / 30
Role Responsibilities       / 20
Professional Contribution   / 10
                            ─────
Future overall              /100
```

No `/100` calculation, no rankings, no AI/LLM scoring — exactly as
scoped.

## 1. Audit verdict

Started from 25G's five candidates. Final V1 trait set:

| Trait | Kept? | Reasoning |
|---|---|---|
| Initiative | Yes (4 pts) | Clearly distinct from Results/Execution/Role Responsibilities; already had a well-formed illustrative anchor set from 25G to build on |
| Collaboration | Merged | Collapsed into "Coordination et communication" (§14) — at 10 total points, scoring Collaboration and Communication separately would double-count the same interactions |
| Communication | Merged | See above (3 pts, as "Coordination et communication") |
| Problem Solving | Yes (3 pts) | Distinct behavior (approach when blocked), not an outcome — kept outcome language ("gets good results") out of every anchor |
| Reliability | **Dropped** | Narrowed to "untracked commitment follow-through" per §4, it's conceptually distinct from Execution Discipline's tracked task completion — but it's also the trait most likely to actually get conflated with tracked completion by a real evaluator filling out a form. The ticket's own §4 offers dropping it as the safe default when the distinction "still feels too fuzzy," and it does. |

Result: **3 traits, 10 points, one shared catalog across both supported
roles** — matching the ticket's own §5 suggested trio, arrived at
independently through the overlap audit above, not adopted uncritically.

## 2. Rejected traits and why

See "Reliability" above — the only 25G candidate actually dropped.
Collaboration/Communication weren't rejected, they were merged (both
survive as one trait's behavioral scope).

## 3. Overlap matrix

| Trait | Why it belongs in Professional Contribution | Why not Results | Why not Execution | Why not Role Responsibilities |
|---|---|---|---|---|
| Initiative | Proactive identification of useful next steps is a behavior, not an outcome or a tracked task | Never reads `WON_TRANSITION`/`creditedUserId` | Never reads `ProspectAction` completion state | Not a defined job duty (COMMERCIAL's one Role Responsibility is portfolio stewardship, a data-accuracy duty, not proactivity) |
| Coordination et communication | Information-sharing behavior across colleagues, not a tracked artifact | No outcome dependency | `ProspectAction` completion says nothing about whether blockers were surfaced to others | Distinct from either supported role's one formal duty |
| Résolution de problèmes | How an obstacle is approached, not whether the outcome was good | Explicitly not "gets good outcomes" (§15) — no anchor references results | Distinct from on-time/overdue task completion | Distinct from either role's formal duty |

Structural guarantee, not just documentation: the core file
(`professional-contribution.service-core.ts`) never imports
`computeExecutionDisciplineScore`, `computeCommercialResultsScore`,
`collectCommercialResultsEvidence`, or anything from
`role-responsibility-assessment.service-core.ts` — tested explicitly.

## 4. Shared catalog, shared evaluator authority — a genuine, verified reuse

Same catalog across `COMMERCIAL` and `MANAGER` (§6) — these traits
describe cross-role professional behavior, unlike Role Responsibilities'
role-specific duties. `ADMIN` remains unsupported for the same reason
25I found: no valid internal evaluator exists in this single-tier role
model (§7).

The evaluator-authority matrix turned out to be **exactly** 25I's
`canAssessRoleResponsibilities` rule, not merely similar — so it was
extracted into a neutral, shared primitive
(`src/lib/employee-assessment-authorization.ts`,
`canAssessEmployeeInStructuredEvaluation`), which 25I's file now
delegates to (a thin re-export under its existing name, so nothing
that already imports `canAssessRoleResponsibilities` had to change) and
25J imports directly. This is the one place the ticket's own §8/§73
tension — "prefer a shared primitive only if truly identical" vs. "do
not build a premature generic assessment framework" — resolves cleanly:
sharing one decision *rule* is not the same as sharing a *model* or a
*lifecycle*. The two assessment domains remain entirely separate tables,
catalogs, and scoring formulas.

- Assessing a `COMMERCIAL`: `ADMIN` or `MANAGER`.
- Assessing a `MANAGER`: `ADMIN` only — a peer `MANAGER` may not.
- Assessing an `ADMIN`: nobody.
- Self-assessment: never, for any role.

## 5. V1 weights

Initiative 4, Coordination et communication 3, Résolution de problèmes
3 — matching the ticket's own §17 illustrative split. No independent
reason was found to deviate: Initiative is the most differentiating
behavior (the other two are closer to baseline professional
expectations that most contributors are assumed to meet to *some*
degree), so it carries slightly more weight.

## 6. Complete five-anchor catalog

Every anchor is observable workplace behavior — no personality,
intelligence, or moralistic language (`no anchor uses personality,
intelligence, or moralistic language` is a dedicated catalog test, not
just a style guideline). The top anchor of every trait explicitly
stays within role boundaries (§13) — Initiative's level-5 anchor reads
"...en sollicitant une validation lorsque l'autorité requise dépasse
son rôle," tested explicitly so a future edit can't silently reward
overstepping authority.

See `src/lib/professional-contribution-catalog.ts` for the full French
anchor text (five levels × three traits).

## 7. Point mapping — proportional, not a fixed table

Unlike 25I's fixed per-level points table (0/10/17/20, deliberately
nonlinear), Professional Contribution uses a **proportional formula**:

```
traitScore(level, maxPoints) = maxPoints * (level - 1) / 4
```

Level 1 → 0, level 5 → `maxPoints`, evenly spaced across the four steps.
For Initiative (max 4) this lands on clean integers (0/1/2/3/4). For the
two max-3 traits it does not (0/0.75/1.5/2.25/3) — **no combination of 3
positive integers, each a multiple of 4, sums to exactly 10**, so
fractional intermediate values are mathematically unavoidable with a
3-trait/10-point/5-level design, not a modeling mistake. Rather than
force an arbitrary non-proportional table to dodge fractions (which
would itself be a subtler form of false precision — an unexplained
table is harder to audit than a stated formula), the fraction is kept
internally (`awardedPoints` is a `Float` column) and only the **final
summed total is rounded, once**, at submission. This is the ticket's own
offered alternative (§18: "compute normalized percentages from anchor
levels and round only the /10 total"), chosen because the ticket's own
suggested per-trait mapping example already introduces a fraction
(`4 → 2.5` for a 3-point trait) — rounding once at the end is strictly
more accurate than rounding per-trait and re-summing.

**Locked boundary values** (tested explicitly): all traits at level 1 →
`0`; all at level 3 (the "handles normal responsibilities independently"
midpoint) → `5`; all at level 5 → `10`; all at level 4 → `7.5` rounds to
`8` (the genuine `.5` rounding case).

This is a deliberately different philosophy from 25I's generous-at-MET
curve: Professional Contribution's middle anchor ("meets ordinary
expectation") sitting at exactly 50% is appropriate for a continuous
5-point behavioral scale where levels 4-5 represent genuinely
above-and-beyond contribution — unlike Role Responsibility's MET, which
credited *fulfilling a required duty* generously. Documented here so
the difference reads as intentional, not inconsistent.

## 8. Extreme-observation policy

Level 1 and level 5 require a non-empty observation; levels 2-4 don't
(§20) — generalized from 25I's four-level rule to this five-level scale
via `isExtremeProfessionalContributionLevel`. A whitespace-only
observation counts as missing, tested explicitly (§59).

## 9. Evaluator authorization

See §4 above for the shared primitive. Enforced at three independent
layers, same defense-in-depth as every prior ticket in this series: the
existing `/admin` route gate, the coarse
`requireProfessionalContributionAssessmentManagementAccess()` Server
Action gate (`ADMIN`/`MANAGER`), and the domain core's own
`canAssessProfessionalContribution` check.

## 10. Role-history limitation — same honest compromise as 25I

`roleAtEvaluation`/`evaluatorRoleAtEvent` are snapshots of the *current*
role at assessment-creation time, not verified guarantees the person
held that role for the entire period. This CRM still has no dated
role-transition log. No `ROLE_CHANGED_DURING_PERIOD` detection was
added — building one for a condition this CRM cannot detect would be a
fake safeguard.

## 11. Bias controls

Extreme-anchor observation requirement (§8 above) plus short, one-time
guidance shown to the evaluator while a draft is open (not a lecture,
per §47):

> "Évaluez l'ensemble de la période, pas seulement les événements
> récents. Basez-vous sur des comportements observables et évitez de
> laisser une réussite ou une difficulté isolée influencer toutes les
> dimensions."

No claim that this eliminates bias — only that anchors and the
observation requirement reduce arbitrariness, matching §48's explicit
instruction.

## 12. Snapshot strategy

Every trait's full definition — `traitKey`, `labelAtEvaluation`,
`descriptionAtEvaluation`, `maxPoints`, and all five anchors
(`anchorsSnapshot`, JSON) — is frozen onto the item at assessment
creation, verified by a dedicated test comparing the exact fields
passed to the create dependency against the live catalog at that
instant. A future catalog edit never rewrites a historical assessment.

## 13. Submission immutability

`DRAFT` → `SUBMITTED`, one-way. Submission requires every trait
resolved (`UNASSESSED_ITEMS` otherwise); the score is the server-computed,
once-rounded integer sum of `awardedPoints`, never a client-supplied
value. After submission: item reassessment, deletion, and re-submission
are all rejected (`ASSESSMENT_LOCKED`), tested explicitly for each path.

## 14. Privacy

Not touched by this ticket at all — no `/updates`, analytics, or
prospect-history code path references
`ProfessionalContributionAssessment`. Same pattern as every prior
performance-dimension ticket: the absence itself is the guarantee.

## 15. Unsupported ADMIN semantics

Same as 25I: no responsibility/trait evaluation exists for `ADMIN` in
V1 because no valid internal evaluator exists in this single-tier role
model. `createProfessionalContributionAssessmentCore` rejects an
`ADMIN` employee with `ROLE_NOT_SUPPORTED`, tested explicitly.

## 16. No-AI / no-surveillance rule

No sentiment analysis, no LLM summarization, no keyword scoring, no
inference from login/session/click/message-length data. Validation on
the observation field is purely structural (required/optional,
non-whitespace when required) — never a "quality" check on the text
itself, matching §23's explicit instruction.

## 17. What this ticket built

- `src/lib/employee-assessment-authorization.ts` — the shared
  evaluator-authority primitive (extracted from 25I, see §4).
- `src/lib/professional-contribution-catalog.ts` — the frozen shared
  V1 BARS catalog (3 traits, 5 anchors each).
- `prisma/schema.prisma` — two new models
  (`ProfessionalContributionAssessment` + `...Item`), one new enum,
  additive migration. `role-responsibility-assessment.service-core.ts`'s
  only change is delegating its existing exported function to the
  shared primitive — no behavior change, verified by re-running 25I's
  full test suite unchanged.
- `src/services/professional-contribution.service-core.ts` — pure
  domain core: proportional scoring formula, create → assess → submit →
  delete lifecycle, all dependency-injected.
- `src/services/professional-contribution.service.ts` — Prisma wiring.
- `src/lib/validations/professional-contribution.schema.ts` — Zod
  schemas.
- `src/actions/professional-contribution.actions.ts` — Server Actions,
  authorizing independently of the service-core.
- `authorization.service-core.ts`/`authorization.service.ts` — new
  `PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES` constant and
  `requireProfessionalContributionAssessmentManagementAccess()` wrapper.
- UI: extends 25I's `/admin/performance-assessments` page with a second,
  clearly separated section (own create form, own list, own detail
  route at `/admin/performance-assessments/professional-contribution/[assessmentId]`)
  — same page, entirely separate data and components underneath.
- 9 (catalog) + 11 (migration) + 31 (domain core) + 2 (authorization) +
  15 (three component source-assertion files) = 68 new tests.

## 18. Known limitations

- **No employee self-view** — same deferral as 25I/25H.2A.
- **`roleAtEvaluation`/`evaluatorRoleAtEvent` are not verified
  whole-period guarantees** — see §10.
- **No correction/void lifecycle** — a wrong submitted assessment has
  no remediation path yet.
- **No inline catalog-versioning UI** — the catalog is code, deployed
  like any other change.

## 19. Handoff to 25K

All four dimensions now exist as independent, machine-computed or
structurally-assessed scores:

```
Results                     / 40   (25H.2 + 25H.2B, target-blocked cases handled)
Execution Discipline        / 30   (25H)
Role Responsibilities       / 20   (25I)
Professional Contribution   / 10   (25J)
```

25K's job is presentation and composition — pulling these four
independently-computed numbers into one view, and only then deciding
how (or whether) to combine them into a `/100`. 25K should **not**
recompute any of the four scores itself; each one already has its own
authoritative service (`getCommercialResultsForEmployee`,
`computeExecutionDisciplineResult`-backed service,
`getRoleResponsibilityAssessmentDetail`,
`getProfessionalContributionAssessmentDetail`) that must remain the
single source of truth for its dimension. 25K should also decide
whether an "overall" score requires all four dimensions to exist for
the same period (Results is COMMERCIAL-only and can be
`NO_TARGET`/`LEGACY_ATTRIBUTION_INCOMPLETE`; Role Responsibilities and
Professional Contribution require a submitted assessment that may not
exist for every period) — a real design question this ticket
deliberately leaves open rather than prejudging.

## Verification performed

```
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
targeted tests (professional-contribution-catalog.test.ts,
  professional-contribution.service-core.test.ts,
  add-professional-contribution-assessments.migration.test.ts,
  authorization.service.test.ts,
  the three new component source-assertion test files)
25I regression (role-responsibility-assessment.service-core.test.ts,
  unchanged, re-run after the shared-primitive extraction)
full test suite (1901 tests; the 1 pre-existing unrelated Sidebar
  failure remains, unrelated to this ticket)
targeted lint (repo-wide, clean)
production build (all three new/changed routes registered)
git diff --check
```

No live database access was performed or needed — consistent with every
prior migration in this series (no `DATABASE_URL` configured in this
environment).
