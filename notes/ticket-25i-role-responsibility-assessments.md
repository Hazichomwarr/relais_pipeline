# Ticket 25I — Role Responsibility Assessment Foundation

Implemented 2026-08-28. Completes the third performance dimension,
`Role Responsibilities /20`, alongside the already-implemented `Results
/40` (25H.2/25H.2B) and `Execution Discipline /30` (25H). No `/100`, no
leaderboards, no Professional Contribution/BARS (25J).

## 1. Audit verdict

Per the ticket's own required sequence (§57: audit before schema), the
audit was performed against the actual current implementation, not
merely the 25G matrix, before any model was written. Verdict:

| Role | Supported? | Responsibilities | Evidence type |
|---|---|---|---|
| COMMERCIAL | Yes | 1 — Prospect Portfolio Stewardship | MANAGER_ASSESSED |
| MANAGER | Yes, thin | 1 — Daily Report Oversight & Escalation Handling | MANAGER_ASSESSED |
| ADMIN | No | none | — |

**Every survivor got the full 20 points for its role.** This was not
decided in advance — the audit found exactly one defensible
responsibility per supported role, and giving that one item less than
20 points would have meant inventing a second item purely to look more
granular, which the ticket explicitly forbids (§2: "do not invent
duties merely to fill 20 points"). Fewer items at higher individual
weight is the honest outcome, the same principle 25H.2's Outcome C
applied to Results.

## 2. COMMERCIAL candidates audited and rejected

Every candidate in the ticket's own §39 list was checked against 25H
(Execution Discipline) and 25H.2 (Results) before being kept or
rejected:

- **Follow-up timeliness / structured follow-up use** — already scored
  by Execution Discipline (`ProspectAction` completion). Rejected as
  double-counting (§1/§4).
- **WON outcomes** — already Results. Rejected (§4).
- **Daily Report compliance** — rejected for two independent reasons:
  (a) 25H already established that "who was expected to report" has no
  durable historical model, so it can't be a machine-scored historical
  metric; (b) live data confirms COMMERCIALs mostly don't even hold a
  `dailyReportTemplateType` (per the 26A audit: `OPERATIONS_COORDINATOR`
  2, `ASSISTANT` 1, `null` 11) — this isn't even a typical COMMERCIAL
  responsibility in practice, not merely an unreliable metric.
- **Pipeline status accuracy / "coverage completeness" (does every
  non-terminal prospect have an open action)** — this looked like the
  strongest machine-evidenced candidate, but fails the exact same
  historical-denominator problem that blocked 25H.2's conversion rate:
  `Prospect` has no ownership-history model, so "which prospects did
  this Commercial own during a past period" cannot be reconstructed.
  Any metric built on *current* Prospect/ProspectAction state to
  represent a *past* period's coverage would be presenting a live
  snapshot as historical fact. Rejected on the same grounds as 25H.2's
  Outcome C, not a new finding.
- **Prospect qualification / record accuracy** — survives, but only as
  a **human-assessed** item: current-state qualification fields have
  the same historical-reconstruction problem as above, so a manager's
  judgment (informed by what they actually observed) is the only
  truthful way to score it. This became "Prospect Portfolio
  Stewardship."

## 3. MANAGER candidates audited and rejected

- **Reviewing daily reports / handling escalations** — the CRM surfaces
  real evidence (`DailyReportAttentionItem`: `hasDecisionNeeded`/
  `hasProblemReported`, confirmed present in
  `daily-report.service-core.ts`), but *resolution* of those items is
  not tracked anywhere (no `resolvedBy`/`resolvedAt`, confirmed absent
  — same gap 25G's audit already found). This rules out a fully
  machine-evidenced item, but not a human-assessed one: an ADMIN can
  form a judgment using the attention-item surface as reference
  material even though the system can't prove resolution itself. This
  became "Daily Report Oversight & Escalation Handling."
- **Maintaining operational follow-up / supporting commercial
  workflow / managing assigned administrative actions "across the
  team"** — rejected. No manager-of-employee hierarchy exists (confirmed
  repeatedly across 25G/25H.2/25H.2A), so "across the team" cannot be
  scoped to specific people. Assessing it anyway would be exactly the
  "no generic manager rating" anti-pattern the ticket warns against
  (§8) — a vague holistic judgment with no defined responsibility
  behind it.

## 4. ADMIN — unsupported, and why that's not a gap

No responsibility survived audit: ADMIN's CRM footprint is
user-management and finance, and "having `/finances` or `/admin/users`
access is not evidence of good performance" (§41, and confirmed by
25G's own earlier finding). Separately, no valid internal evaluator
exists for an ADMIN in this single-tier role model — `ADMIN` is the top
of the hierarchy, and self-assessment is explicitly forbidden (§21).
Both reasons independently rule ADMIN out; it doesn't need a
responsibility catalog that no one could assess anyway.

## 5. Double-counting matrix

| Included responsibility | Not double-counted with | Why |
|---|---|---|
| Prospect Portfolio Stewardship (COMMERCIAL) | Execution Discipline | Execution scores *task completion reliability*; this scores *information accuracy/currency*, a genuinely different behavior a Commercial could fail even with perfect task completion |
| Prospect Portfolio Stewardship (COMMERCIAL) | Results | Results counts credited WON outcomes; this never reads `WON_TRANSITION`/`creditedUserId` at all |
| Daily Report Oversight (MANAGER) | Execution Discipline | Execution Discipline is COMMERCIAL-only (25H §2); a MANAGER has no Execution Discipline score to overlap with |
| Daily Report Oversight (MANAGER) | Results | Results is COMMERCIAL-only (25H.2 §2); same reasoning |

Structural guarantee, not just documentation: the core file
(`role-responsibility-assessment.service-core.ts`) never imports
`computeExecutionDisciplineScore`, `computeCommercialResultsScore`, or
`collectCommercialResultsEvidence` — tested explicitly.

## 6. Evidence architecture

Every V1 item is `MANAGER_ASSESSED` — the `evidenceType` enum still
names `MACHINE_EVIDENCED` too (§36/§37: "do not fabricate objective
metrics for aesthetic consistency," but also don't foreclose a future
genuinely machine-evidenced responsibility needing a schema change to
be representable).

## 7. Assessment anchors

Four levels (`NOT_MET`/`PARTIALLY_MET`/`MET`/`EXCEEDED`), responsibility-
specific text (not generic "poor/good/excellent" — §32), point mapping
**0 / 10 / 17 / 20** for both V1 items — deliberately nonlinear (not
0/50/100/100, which the ticket explicitly warned against at §31): `MET`
(fully meeting the baseline expectation) is generously close to
`EXCEEDED`, while `PARTIALLY_MET` sits meaningfully below `MET`. The
full anchor set is frozen (`anchorsSnapshot`, a JSON column) onto every
assessment item at creation — a future catalog edit never rewrites what
an evaluator actually saw (§24/§48).

## 8. Weighting

Each supported role's catalog sums to exactly 20 — verified by a
dedicated catalog test, not just asserted. §13's "do not force equal
numbers of responsibilities" is trivially satisfied since there's
exactly one item per role; the weight question collapses to "does the
one item get the full 20," answered yes for the reason in §1 above.

## 9. N/A policy — not implemented, and why

The ticket's own §14/§15 N/A machinery (normalize remaining applicable
max, distinguish N/A from UNASSESSED) was **not built**. With exactly
one responsibility per supported role, there is no partial-applicability
scenario to normalize — an N/A on the one existing item would leave
nothing to score at all, not a smaller-but-valid remainder. Building
unused normalization logic to satisfy a requirement that doesn't
structurally apply would be exactly the kind of premature complexity
this ticket series has repeatedly rejected (25H.2's Outcome C is the
direct precedent). **`UNASSESSED` (null `assessmentLevel`) is
implemented** — distinct from N/A, blocks submission, tested explicitly.
A future ticket introducing a second responsibility per role must
design N/A semantics before assuming this dimension already supports
them.

## 10. Authorization

`canAssessRoleResponsibilities(actor, employeeRole, employeeId)` — the
one place this ticket's authorization couldn't be a flat role-array
constant, because it depends on the *target's* role, not only the
actor's:

- Assessing a `COMMERCIAL`: `ADMIN` or `MANAGER` (organization-wide, no
  hierarchy — same documented limitation as `CommercialPerformanceTarget`).
- Assessing a `MANAGER`: `ADMIN` only. A peer `MANAGER` may not — with no
  hierarchy to justify scope, letting any `MANAGER` assess any other
  would be exactly the arbitrary authority the audit warned against.
- Assessing an `ADMIN`: nobody (§4 above).
- Self-assessment: never, for any role.

A coarse route/action gate (`requireRoleResponsibilityAssessmentManagementAccess`,
`ADMIN`/`MANAGER`) keeps `COMMERCIAL` out of the door entirely; the fine
per-employee rule is re-checked independently inside the domain core —
never trusting the coarse gate alone, same defense-in-depth pattern as
25H.2A.

## 11. Role-transition policy — a real, documented limitation

The ticket's own §17/§18 asks for a `ROLE_CHANGED_DURING_PERIOD` block
if role history isn't reconstructable. **It genuinely isn't**: `User`
has no dated role-transition log (confirmed repeatedly — only
`UserCreationActivity.roleAtEvent`, which is the role *at account
creation*, not at any later transition). Implementing a status for a
condition this CRM cannot detect would be a fake safeguard — worse than
none, per this series' repeated "do not fabricate what you cannot
verify" principle. **What is implemented**: `roleAtEvaluation` is
snapshotted from the employee's *current* role at assessment-creation
time (not verified to have held for the whole period), frozen forever
after. This is honestly weaker than the ticket's ideal, and is
documented as a known limitation rather than silently assumed solved.

## 12. Snapshot/versioning

`policyVersion = "ROLE_RESPONSIBILITY_V1"`. Every item snapshots
`responsibilityKey`/`labelAtEvaluation`/`descriptionAtEvaluation`/
`maxPoints`/`evidenceType`/`anchorsSnapshot` at assessment-creation time
— verified by a dedicated test comparing the exact fields passed to the
create dependency against the live catalog at that instant. A future
catalog edit (relabeled responsibility, rewritten anchor, changed point
mapping) never rewrites a historical assessment.

## 13. Submission immutability

`DRAFT` → `SUBMITTED`, one-way, no in-place correction (§26: a future
void/supersede model, not built here). Submission requires every item
resolved (`UNASSESSED_ITEMS` otherwise); the score is the server-computed
integer sum of `awardedPoints` — always deterministic, since every
anchor point value is a fixed integer from the catalog (0/10/17/20),
never a rounded fraction. After submission: item reassessment, deletion,
and re-submission are all rejected (`ASSESSMENT_LOCKED`), tested
explicitly for each path.

## 14. Privacy

Not touched by this ticket at all — no `/updates`, analytics, or
prospect-history code path references `RoleResponsibilityAssessment`.
The absence itself is the guarantee (same pattern as 25H.1's `/updates`
compatibility check): nothing needed to be added to an exclusion list
because nothing was ever wired to include it.

## 15. Known limitations

- **No employee self-view** — deferred, matching 25H.2A's own precedent
  (an ADMIN/MANAGER-facing surface only, `/admin/performance-assessments`).
- **`roleAtEvaluation` is not a verified whole-period guarantee** — see
  §11 above.
- **No N/A/normalization** — see §9 above; only relevant once a role
  has more than one responsibility.
- **No inline catalog versioning UI** — the catalog is code, deployed
  like any other code change; there's no admin surface to author new
  responsibilities, deliberately (§10: "do not build a dynamic
  responsibility-builder UI").
- **No correction/void lifecycle** — a wrong submitted assessment has no
  remediation path yet; would need its own audited ticket (§26).

## 16. Handoff to 25J

25J (Professional Contribution `/10`, BARS) can reuse this ticket's
established patterns directly: the anchored-level enum shape
(`NOT_MET`/`PARTIALLY_MET`/`MET`/`EXCEEDED` generalizes naturally to
BARS's 1-5 scale), the extreme-level-requires-observation rule
(`isExtremeRoleResponsibilityLevel`, already generalized to "lowest or
highest"), the snapshot-catalog-at-creation pattern, and the
DRAFT/SUBMITTED immutability lifecycle. 25J should **not** import from
this ticket's files directly (Professional Contribution is a distinct
dimension, per §12 of this ticket — behavioral traits, not job duties),
but should follow the same shape rather than inventing a third pattern.

## Verification performed

```
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
targeted tests (role-responsibility-catalog.test.ts,
  role-responsibility-assessment.service-core.test.ts,
  add-role-responsibility-assessments.migration.test.ts,
  authorization.service.test.ts,
  the three new component source-assertion test files)
full test suite (1833 tests; the 1 pre-existing unrelated Sidebar
  failure remains, unrelated to this ticket)
targeted lint (repo-wide, clean)
production build (both new routes registered)
git diff --check
```

No live database access was performed or needed — consistent with
every prior migration in this series (no `DATABASE_URL` configured in
this environment).
