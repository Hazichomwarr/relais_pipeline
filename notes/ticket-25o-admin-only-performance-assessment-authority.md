# Ticket 25O — Admin-Only Performance Assessment Authority

Implemented 2026-08-29. Structured-assessment evaluator authority (Role
Responsibility `/20`, Professional Contribution `/10`) is narrowed to
ADMIN only, for both create and every mutation (assess-item, save,
submit). This closes the mutation-layer gap 25L identified: before this
ticket, assess/submit/delete trusted `evaluatorUserId` ownership alone
and never re-checked the actor's *current* role, so a pre-25O
MANAGER-owned draft would have remained editable by that MANAGER
forever. Viewing (`canViewEmployeePerformance`) is completely untouched.
Manager eligibility for Results `/40` and Execution `/30` is unchanged
and remains deferred to 25P/25Q. No schema change, no Assistant
performance rubric.

## 1. Evaluator authorization matrix — before and after

| Subject role | Before 25O | After 25O |
|---|---|---|
| COMMERCIAL | ADMIN or MANAGER | ADMIN only |
| MANAGER | ADMIN only | ADMIN only (unchanged) |
| ADMIN | nobody (no supported catalog) | nobody (unchanged) |
| ASSISTANT | nobody (no catalog) | nobody (unchanged) |

The only real change is COMMERCIAL: MANAGER loses evaluator authority
there. Both pre-25O per-target-role branches (COMMERCIAL: ADMIN/MANAGER;
MANAGER: ADMIN-only) collapse into one ADMIN-only rule in
`canAssessEmployeeInStructuredEvaluation`
(`src/lib/employee-assessment-authorization.ts`) — subject eligibility
(which roles can be evaluated at all) is untouched; only who may act as
evaluator narrowed.

## 2. The 25L mutation-layer gap and its closure

25L's audit found that narrowing *creation* eligibility alone would not
have been enough: `assessRoleResponsibilityItemCore` /
`submitRoleResponsibilityAssessmentCore` (and the Professional
Contribution equivalents) checked only `actor.id === assessment.evaluatorUserId`,
never `actor.role`. A MANAGER who created a draft before 25O would keep
editing and submitting it indefinitely after 25O shipped, because
nothing at the mutation layer re-evaluated their current role.

Two new pure predicates in `employee-assessment-authorization.ts` close
this:

```ts
export function canMutateOwnedStructuredEvaluation(
  actor: EmployeeAssessmentActor,
  evaluatorUserId: string,
): boolean {
  return actor.role === "ADMIN" && actor.id === evaluatorUserId;
}

export function canDeleteStructuredEvaluationDraft(
  actor: EmployeeAssessmentActor,
): boolean {
  return actor.role === "ADMIN";
}
```

`assessXItemCore` and `submitXCore` (both domains) now call
`canMutateOwnedStructuredEvaluation`; `deleteXCore` (both domains) now
calls `canDeleteStructuredEvaluationDraft`. This is the single most
important behavioral change in the ticket — proven directly by
`role-responsibility-assessment.service-core.test.ts` and
`professional-contribution.service-core.test.ts` §46 ("a legacy
MANAGER-owned DRAFT can no longer be edited or submitted by that same
MANAGER").

## 3. Edit/submit vs. delete — deliberately asymmetric policies

- **Edit and submit require BOTH current ADMIN authority AND exact
  recorded-evaluator identity.** Letting a different person — even
  another ADMIN — continue someone else's draft would silently change
  *who actually evaluated this employee* with no audited transfer
  mechanism, corrupting provenance (§47/§50: a different ADMIN than the
  recorded evaluator is denied edit and submit).
- **Delete requires ONLY current ADMIN authority — deliberately NOT
  ownership-gated** (§48/§50). Deleting a row doesn't change any
  historical fact about who evaluated whom; it only removes an
  incomplete, never-submitted draft. This is what lets an ADMIN clean up
  a stranded MANAGER-era draft, or another ADMIN's abandoned one,
  without falsifying authorship the way editing it would. A SUBMITTED
  assessment can never be deleted by anyone, regardless of role or
  ownership — that check is independent of, and prior to, the
  actor-role check.

The MANAGER who owns a legacy draft may not even delete their own
draft (§48) — cleanup authority is ADMIN-only in both directions, not
"ADMIN or the original owner."

## 4. Role-transition semantics — current role always wins

Ownership never overrides current role, in either direction (§51):

- An evaluator who created a draft while ADMIN, and has since become
  MANAGER, loses mutation rights on their own former draft.
- An evaluator whose legacy MANAGER-owned draft predates 25O, and who
  has since become ADMIN, gains mutation rights on that same draft —
  because they are now the current ADMIN matching the recorded
  `evaluatorUserId`.

This falls directly out of `canMutateOwnedStructuredEvaluation` checking
`actor.role` fresh on every call rather than caching or trusting a role
recorded at creation time. `evaluatorRoleAtEvent` (if present) remains a
frozen historical fact and is never read for authorization — only for
display/audit.

## 5. Historical preservation — no rewrites, no backfill

No migration, no backfill script, and no code path that writes to
`evaluatorUserId` after creation was added or touched. `evaluatorUserId`,
scores, snapshots (`labelAtEvaluation`, `anchorsSnapshot`, etc.) are all
exactly as truthful after this ticket as before it — narrowing
authorization changes who may perform *future* mutations; it never
retroactively edits who performed past ones. Confirmed via
`git diff --stat prisma/` showing no schema or migration diff.

## 6. UI resolution — VIEW, never hidden, never a dead CONTINUE

`getAssessmentActionState` (`src/lib/performance-summary-presentation.ts`)
was rewritten so `canAssess` splits into two independent inputs:
`canCreate` (may this actor start a new assessment for this employee at
all) and `canContinue` (may this actor mutate *this specific* existing
assessment). The resulting state table:

| Assessment state | canContinue | Resulting CTA |
|---|---|---|
| none exists, canCreate | — | CREATE |
| DRAFT, canContinue | true | CONTINUE |
| DRAFT, canContinue | false (legacy Manager draft, another evaluator, or actor no longer ADMIN) | VIEW |
| SUBMITTED | — (never mutable) | VIEW |

A DRAFT the viewer cannot mutate is never hidden and never rendered with
a CONTINUE that would fail on click — it resolves to VIEW, matching the
ticket's explicit UI requirement. `RoleResponsibilityAssessmentList.tsx`
and `ProfessionalContributionAssessmentList.tsx` compute the identical
`isDraft && canMutateOwnedStructuredEvaluation(actor, evaluatorUserId)`
condition per row for "Continuer l'évaluation" vs. "Voir le détail," and
`canDeleteStructuredEvaluationDraft(actor)` (ANDed with `isDraft`) for
the delete control. Both detail pages
(`app/admin/performance-assessments/[assessmentId]/page.tsx` and its
Professional Contribution counterpart) compute `canEdit` via the same
`canMutateOwnedStructuredEvaluation` call, so the standalone detail route
can never be reached in an editable state that the list wouldn't also
have offered.

`evaluatorUserId` is now selected in every Prisma query that feeds these
surfaces (the per-period dashboard lookup and the management-list query,
in both `role-responsibility-assessment.service.ts` and
`professional-contribution.service.ts`) — it was not selected before
25O, since nothing downstream needed it until this ticket.

## 7. Coarse route access vs. mutation authorization — unchanged split

`/admin/performance-assessments`'s route-level gate stays `[ADMIN,
MANAGER]`, deliberately unchanged: MANAGER retains read-only list
visibility, matching the ticket's explicit instruction to preserve
legitimate viewing. Only the create-form UI sections in
`app/admin/performance-assessments/page.tsx` are now gated to
`actorRole === "ADMIN"`. This is defense-in-depth, not the real
boundary: every mutation Server Action and pure core function
independently enforces `canMutateOwnedStructuredEvaluation` /
`canDeleteStructuredEvaluationDraft` regardless of what the coarse route
gate lets through — a MANAGER who reaches the list page still cannot
mutate anything through it.

## 8. Viewing and mutating remain two independent authorization checks

`canViewEmployeePerformance` (`performance-summary.service-core.ts`) was
not modified in this ticket, and a new regression proves the two
matrices are independent rather than accidentally coupled: a MANAGER who
is authorized to view a COMMERCIAL's performance dashboard (unchanged,
still true) is NOT thereby authorized to assess that COMMERCIAL's
structured evaluations (now false, was previously true). ADMIN is the
only role for which both checks currently return true for the same
subject — a coincidence of both matrices independently naming ADMIN, not
a shared implementation; the two functions remain in separate files with
separate signatures and must never be merged, per existing 25I/25J
precedent.

## 9. What stayed exactly as it was

No schema change. No Assistant performance rubric — `ASSISTANT` still
has no supported catalog in either domain, unchanged from 25M. No
Results `/40` or Execution `/30` eligibility change — MANAGER remains
`UNSUPPORTED_ROLE` for both, deferred to 25P/25Q. `canViewEmployeePerformance`
untouched (§8, above). Subject-role eligibility (which employee roles
can be assessed at all) untouched — only evaluator authority narrowed.

## 10. Verification

`npx tsc --noEmit` (clean), full `npm test` — 2074 tests, 2073 pass; the
one failure is the same pre-existing, unrelated `Sidebar.test.tsx`
"Rapports quotidiens" test confirmed via `git stash` in earlier tickets
to predate this session entirely. `npx eslint .` (clean). `npm run
build` (clean). `git diff --check` (no whitespace issues). New/updated
coverage: the complete ADMIN-only evaluator matrix (§44), the legacy
MANAGER-draft mutation denial (§46 — the most important regression in
this ticket), the different-ADMIN impersonation denial (§47), the
asymmetric delete/edit cleanup policy (§48/§50), the ADMIN-owned-draft
happy path unaffected by the narrowing (§49), the role-transition
semantics in both directions (§51), and the view/mutate independence
regression (§53) — across both Role Responsibility and Professional
Contribution domains. No live database mutation and no real user's role
was changed to produce any of this coverage.

## 11. Deferred to later tickets

Unchanged sequencing from 25L/25N: `25P` (Manager Results/`/40` target
eligibility), `25Q` (Manager Execution Discipline/`/30` eligibility),
`25R` (performance role matrix & dashboard integration, including the
Assistant Professional Contribution `/10` decision). None of that policy
work moved in this ticket.
