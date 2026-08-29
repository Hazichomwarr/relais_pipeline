# Ticket 25Q — Manager Execution Discipline Eligibility

Implemented 2026-08-29. `MANAGER` is now a legitimate subject of the
Execution Discipline `/30` dimension, alongside `COMMERCIAL`. `ADMIN`
and `ASSISTANT` remain unsupported. No schema change, no backfill, no
historical rewrite — this ticket, like 25P, changes interpretation
policy only. Combined with 25P, a Manager can now reach a genuine `/100`
when all four dimensions are available. 25O's Admin-only structured-
assessment authority and 25P's Results/target semantics are untouched.

## 1. The single code change

Unlike 25P, this dimension has no second, event-role evidence gate to
widen — see §3 below for why. The entire behavioral change is one
constant, in `execution-discipline.service-core.ts`:

```ts
const SCORABLE_ROLES: ReadonlySet<UserRole> = new Set([
  "COMMERCIAL",
  "MANAGER",
]);
```

widened from `["COMMERCIAL"]`, feeding the existing
`isScorableForExecutionDiscipline` predicate and the orchestrator's
`UNSUPPORTED_ROLE` gate in `computeExecutionDisciplineResult`. `ADMIN`
and `ASSISTANT` are excluded by the same positive allow-list (never a
negative exclusion) — same convention as `RESULTS_ELIGIBLE_ROLES`
(25P) and `COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES` (25P).

## 2. The subject matrix

| Role | Execution `/30` subject (before) | Execution `/30` subject (after 25Q) |
|---|---|---|
| COMMERCIAL | yes | yes |
| MANAGER | no (`UNSUPPORTED_ROLE`) | yes |
| ADMIN | no | no |
| ASSISTANT | no | no |

## 3. Why this differs from 25P — no event-role snapshot exists

25P had to widen *two* independent gates: the current-role subject gate
and a second, event-role evidence filter reading
`creditedUserRoleAtEvent` (a durable snapshot 25H.1 wrote onto every
`ProspectActivity` WON row). 25Q's audit (per the ticket's own §1/§18)
confirmed `ProspectAction` has no equivalent field — `ExecutionDisciplineActionRow`
carries only `assignedToUserId`, `status`, `dueAt`, `completedAt`,
`canceledAt`. There is no `assignedToUserRoleAtEvent`,
`roleAtAssignment`, or `roleAtCompletion` to read, and none was added
in this ticket (§15: a schema addition here would only help *future*
actions and cannot retroactively solve historical ones — that would be
its own ticket, not 25Q).

`buildExecutionDisciplineEvidence` was read in full before any change
and confirmed to filter purely by durable `assignedToUserId` and
`dueAt`-based period membership — no role filter exists inside it to
widen or remove. This file needed **zero** changes beyond the one
constant above.

## 4. The V1 historical-interpretation policy

Stated exactly as the ticket requires, because it is the crux of this
ticket:

> Current role determines whether the employee is an eligible Execution
> subject. Once eligible, durable actions assigned to that same user in
> the requested historical period are evaluated regardless of what their
> role may have been at the time.

Concretely:

- **Promotion** (Commercial in June, Manager by August): June's actions,
  assigned to that same user id, are included when scoring June — the
  system knows the user performed them; it makes no claim about what
  role they held at the time, because it has no fact to make that claim
  with.
- **Demotion** (Manager, later Commercial): symmetric — historical
  actions remain evidence; no action disappears because of a transition
  between the two Execution-eligible roles.
- **Transition to ASSISTANT or ADMIN**: current-role gating alone
  determines the outcome — `UNSUPPORTED_ROLE`, even though the same
  historical action evidence still technically exists in the table. The
  actions are never deleted or reinterpreted; they simply aren't
  surfaced through a dimension the current role doesn't support.
- **Transition from ASSISTANT/ADMIN to MANAGER**: if a current Manager
  has historical actions from a period predating a role the system
  cannot rule out having been Assistant or Admin, those actions are
  still included, because durable `assignedToUserId` is the sole
  authority and no historical role fact exists to exclude them by. This
  is a known, explicitly documented V1 limitation (§13 of the ticket) —
  not a bug, and not something this ticket attempts to fix.

No heuristic reconstruction was attempted or considered from
`UserCreationActivity`, `User.role`, `assessment.roleAtEvaluation`,
`target.roleAtAssignment`, `creditedUserRoleAtEvent`, Daily Reports, or
timestamp proximity to unrelated records — none of these is an
authoritative role-transition history, and inferring one would
manufacture a fact the domain never recorded.

## 5. Formula, period, cancellation — all unchanged

`score = round(30 × (onTime + late × 0.5) / sampleSize)`,
`EXECUTION_DISCIPLINE_LATE_CREDIT_WEIGHT = 0.5`, `PERIOD_NOT_CLOSED`
gating, the as-of-`periodEnd` reconstruction in `classifyAsOfPeriodEnd`
(so a late future completion can never retroactively rewrite an
already-closed period's outcome), and canceled-action exclusion from
`sampleSize` while remaining visible in `evidence.canceled` — none of
this changed. New tests prove the identical formula and every existing
state (`SCORED`, `INSUFFICIENT_EVIDENCE`, `PERIOD_NOT_CLOSED`) behave
identically for a Manager subject as for a Commercial one. No
Manager-specific weighting, curve, or cap was introduced.

## 6. Individual, not team-based

A Manager's Execution `/30` measures only actions where
`assignedToUserId` is that Manager's own id — exactly the pre-existing
25H invariant. No team/subordinate aggregation was added or considered;
there is still no durable manager-of-employee hierarchy in this schema
to aggregate over, and 25Q does not introduce one.

## 7. Assignee identity remains the sole authority

`ProspectAction.assignedToUserId` remains the only identity Execution
Discipline evidence is keyed on — never the creator, the prospect's
current owner, who completed the mutation, or a Manager-of-assignee
relationship. This file continues to exclude `createdByUserId` from
`ExecutionDisciplineActionRow`'s very shape (25H §3/§30), so this
invariant is structurally true, not merely conventional. 25Q made no
change to assignment mutability or reassignment semantics — that is
unchanged 25H behavior, out of scope here.

## 8. No target dependency

Execution `/30` remains fully independent of `CommercialPerformanceTarget`
— a Manager needs no monthly Results target to receive an Execution
score. 25P and 25Q's calculations were not coupled in either direction.

## 9. Performance composition — the payoff

`composePerformanceSummary` (25K) needed **zero** changes, exactly as
for 25P: it has never contained role-gating logic, only status-based
blocking. With both `isScorableForCommercialResults` and
`isScorableForExecutionDiscipline` now including MANAGER, a Manager with
all four dimensions available can compose a genuine `/100` through the
same composer Commercial already uses — no Manager-specific composition
path was created. New regressions prove: the full four-dimension sum
(82/100 from the ticket's own worked example), that any single missing
dimension (Results `NO_TARGET`, or Execution `PERIOD_NOT_CLOSED`) still
yields `overall: null` with no normalization to `/60` or `/70`, and that
a genuine Execution score of `0` composes into the total (58/100) rather
than being treated as missing.

## 10. UI — no changes were needed

Audited `app/admin/performance/page.tsx` and
`performance-summary-presentation.ts` before writing any code:

- The dashboard's Execution card renders purely from
  `summary.executionDiscipline.status` — no `role === "COMMERCIAL"`
  literal exists anywhere in either file.
- `describeDimensionUnavailability`'s `UNSUPPORTED_ROLE` copy was
  already role-neutral: "Cette dimension n'est pas évaluable pour le
  rôle actuel de cet employé" — no reconstructed-title language like
  "Manager execution during this period" was ever present to correct
  (§38 of the ticket is already satisfied by the pre-existing copy).
- `PERFORMANCE_DIMENSION_LABELS.EXECUTION_DISCIPLINE` is "Discipline
  d'exécution" — already role-neutral.
- Execution Discipline was already confirmed (in an existing comment)
  to never render a CTA — it is, and remains, read-only/non-actionable.
  No "Évaluer l'exécution" control was added.

Zero files under `app/` or `component/` were touched for this ticket.

## 11. What stayed exactly as it was

No schema or migration change (`git diff --stat prisma/` is empty). No
backfill — no `ProspectAction` row was given a fabricated role, and
none was reassigned. 25O's Admin-only structured-assessment authority
(`canMutateOwnedStructuredEvaluation`, `canDeleteStructuredEvaluationDraft`,
`canAssessEmployeeInStructuredEvaluation`) is untouched — a Manager
reaching full `/100` performance eligibility grants no evaluator
authority back, confirmed by a new explicit regression
(`role-responsibility-assessment.service-core.test.ts`). 25P's
`RESULTS_ELIGIBLE_ROLES`, `COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES`,
event-role evidence filtering, Results formula, and target
management/eligibility semantics are all untouched — no 25P file was
edited in this ticket. `PROSPECT_OWNER_ROLES` and
`PROSPECT_ACTION_ASSIGNEE_ROLES` (25M) are untouched.

## 12. Live historical reinterpretation — documented, not prevented

Execution Discipline is computed live on every request, exactly like
Results. Before 25Q, a current Manager's Execution dimension was always
`UNSUPPORTED_ROLE`; after deployment, the exact same historical
`ProspectAction` rows can immediately produce a real `SCORED` result for
that same Manager, with no record having changed. This is the expected
consequence of the existing "policy changes reinterpret history"
architecture (25L/25P), restated here for Execution specifically, not a
defect and not something a migration could prevent without persisted
score snapshots (out of scope).

## 13. Verification

`npx tsc --noEmit` (clean). Full `npm test` — 2104 tests, 2103 pass; the
one failure is the same pre-existing, unrelated `Sidebar.test.tsx`
"Rapports quotidiens" test confirmed via `git stash` in earlier tickets
to predate this session. `npx eslint .` (clean). `npm run build`
(clean). `git diff --check` (no whitespace issues). New/updated
coverage: the complete current-role subject matrix and the widened-gate
proof via `PERIOD_NOT_CLOSED` (never `UNSUPPORTED_ROLE`) for a Manager
(§41/§46), the full Manager scoring range including cancellation
handling (§42-44), the no-historical-role-snapshot regressions proving
the same durable evidence scores identically regardless of current
COMMERCIAL/MANAGER role and is refused identically for ASSISTANT/ADMIN
(§47/§48/§51), and the Manager full-composition suite — exact sum,
blocked-dimension null, and genuine-zero composition (§52-55) — plus the
25O evaluator-authority separation regression (§32/§57). Dashboard-level
UI tests were deliberately not added beyond the source audit in §10,
per the ticket's own guidance to avoid brittle copy-heavy tests when
service-level integration coverage is already this exhaustive (§56).
The optional read-only DB diagnostic (§60) was skipped for the same
reason as 25P's: unnecessary given the exhaustive core coverage above,
and no live database mutation, action creation, role transition, or
performance record was created against the live Neon database to
produce any of this coverage.

## 14. Remaining limitations, restated

- No historical role-at-assignment/completion snapshot exists for
  `ProspectAction`; if this is later judged valuable for *future*
  actions, it is its own domain/migration ticket, not a 25Q amendment.
- Cancellation governance (a self-cancel reducing one's own denominator)
  remains an acknowledged, unsolved limitation carried over from 25G —
  25Q introduces no Manager-specific cancellation penalty or approval
  workflow, per the ticket's explicit instruction.
- Assignment reassignment history (if `assignedToUserId` is ever
  mutated post-creation) was not redesigned in this ticket; scoring
  continues to use whatever the current `assignedToUserId` semantics
  already are from 25H.

## 15. Deferred to later tickets

`25R` — performance role matrix & dashboard integration hardening,
including the still-open Assistant Professional Contribution `/10`
decision. With 25P and 25Q both complete, `COMMERCIAL` and `MANAGER` are
now symmetrical across all four performance dimensions; 25R's remaining
work is integration/presentation hardening, not new scoring policy.
