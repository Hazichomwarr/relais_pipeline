# Ticket 25M — Assistant Role Domain Introduction

Implemented 2026-08-29. `ASSISTANT` now exists as a fourth `UserRole`, and
the CRM can safely contain an Assistant account: authenticate, land on a
real page, appear correctly everywhere roles are displayed, and — the
ticket's real risk — never silently inherit commercial ownership or
task-assignment capabilities merely because pre-existing code accepted
"any active user." No Finance access, no performance-evaluator eligibility,
no new privileged nav: those are 25N/25O/25P–25R, deliberately not touched
here.

## 1. Enum addition

```prisma
enum UserRole {
  ADMIN
  ASSISTANT
  COMMERCIAL
  MANAGER
}
```

Alphabetical, matching this repo's existing ordering convention (the
ticket's own suggested order was different; repo convention wins per the
ticket's own instruction). Migration:
`prisma/migrations/20260829120000_add_assistant_user_role/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ASSISTANT';
```

One line, additive, precedented by
`20260808172015_add_shared_feed_foundation`'s identical
`ALTER TYPE ... ADD VALUE` for a different enum (found during 25L's audit).
Content-tested by `prisma/add-assistant-user-role.migration.test.ts`: only
one `ALTER TYPE` statement in the file, no table/column changes, no drops,
no data statements, and the schema's `UserRole` block contains exactly
`ADMIN, ASSISTANT, COMMERCIAL, MANAGER`.

**Not deployed.** This environment has a live Neon `DATABASE_URL`
(discovered during 25L, confirmed again here) — per this session's
established discipline around that database, the migration file is
written and verified (`prisma format`/`validate`/`generate` all pass
against it) but not run against the live database. Deployment is a
separate, explicit action for whoever owns that environment.

## 2. The ASSISTANT naming collision, handled deliberately

`DailyReportTemplateType.ASSISTANT` already existed (a report-template
kind — "Assistante de Direction" — unrelated to authorization). Both now
legitimately exist:

```ts
UserRole.ASSISTANT                    // authorization role
DailyReportTemplateType.ASSISTANT     // report-template kind
```

Neither enum was renamed. Both got a doc comment in `schema.prisma`
cross-referencing the other, so a future reader hits the explanation from
either direction. The one test that encoded the *old* invariant
("`UserRole` never contains `ASSISTANT`") was rewritten, not deleted or
weakened to a vague string search — it now proves the two enums stay
distinct domain concepts by (a) confirming `UserRole` still never contains
`OPERATIONS_COORDINATOR` (the one `DailyReportTemplateType` value that was
never ambiguous) and (b) confirming `User.role` and
`User.dailyReportTemplateType` are two separately-typed fields on the
model, so Prisma/TypeScript itself can never confuse one "ASSISTANT" for
the other.

## 3. No backfill, no rewritten history

Verified, not assumed: `updateUserCore` (`user.service-core.ts`) writes
only `firstName/lastName/email/phone/role/active/dailyReportTemplateType`
plus a status-transition record onto `User` itself — zero writes to
`Prospect`, `ProspectAction`, `DailyReport`, `LedgerEntry`, or either
assessment model. Every role-snapshot field this codebase has
(`creditedUserRoleAtEvent`, `roleAtAssignment`, `roleAtEvaluation`,
`evaluatorRoleAtEvent`, `UserCreationActivity.roleAtEvent`) is a plain
column with no DB default, populated once by application code at the
moment the row is created. Zero existing users were converted to
ASSISTANT; zero historical rows were touched by this ticket.

## 4. Exhaustive role handling — what actually needed a code change

TypeScript surfaced every place a hand-rolled 3-value role union existed,
rather than the canonical `UserRole` type, the moment the enum widened:

- `RoleResponsibilityAssessmentListRow`/`ProfessionalContributionAssessmentListRow`
  (`component/admin/*List.tsx`) hardcoded `"ADMIN" | "COMMERCIAL" | "MANAGER"`
  for a field they never even render — widened to `UserRole` instead of
  re-hardcoding a 4th literal, so a 5th role won't repeat this.
- `scripts/set-user-password.ts`'s `allowedRoles` — a maintenance script
  gating who can have a password set this way. ASSISTANT added (§18:
  normal authentication, no bypass, no exclusion).
- `CreateProspectResult`/`CreateProspectCoreResult` — widened to include
  the new `ROLE_NOT_ELIGIBLE_FOR_OWNERSHIP` code (§10, below).

No `default: return commercialBehavior` shortcuts were introduced
anywhere — every new branch is an explicit, named case.

## 5. Prospect ownership: a real gap, now closed

**Finding:** prospect creation (`createProspectCore`) was, by deliberate
15H.1 design, role-neutral — "prospecting is role-neutral for any
authenticated active User." There is also no "reassign owner" mutation
anywhere in the app; the creator becomes the owner, once, at creation.
Adding `ASSISTANT` would have made Assistants prospect owners the instant
an Assistant reached the creation form, with zero other code changes.

**Fix:** a positive allow-list, `PROSPECT_OWNER_ROLES` in
`prospect-creation.service-core.ts`:

```ts
export const PROSPECT_OWNER_ROLES: readonly UserRole[] = ["ADMIN", "COMMERCIAL", "MANAGER"];
export function canOwnProspect(role: UserRole): boolean { ... }
```

— exactly the roles already valid before ASSISTANT existed, plus one
exclusion. `createProspectCore` now checks `canOwnProspect(actor.role)`
first, before any duplicate lookup, returning `ROLE_NOT_ELIGIBLE_FOR_OWNERSHIP`
for an ineligible actor. `ProspectCreationActor` widened to require
`role: UserRole` so this check has something to check. Server-side only —
no dropdown to filter, since there never was one; the form is reached
directly by any authenticated user, and the rejection now happens at the
one write path that matters, not by trusting who was allowed to see the
form.

**History preserved, only future assignment blocked:** a prospect already
owned by someone who later transitions to ASSISTANT keeps
`assignedUserId` pointing at them — no read path re-derives ownership from
the current role (identity-based queries, unchanged). A *new* assignment
to that same, now-Assistant person is rejected. Proven end-to-end by a new
test in `role-transition-ownership.test.ts`: transition A to ASSISTANT,
confirm A's existing prospect is still theirs, then attempt (and get
rejected on) a brand-new prospect for A.

## 6. ProspectAction assignment: the same gap, same shape

**Finding:** `listActiveUsersForTaskAssignment()` was role-neutral by
design ("any active User can receive a ProspectAction") and
`createProspectActionCore`'s `findAssignee` dependency only ever checked
`active`, never `role`.

**Fix:** `PROSPECT_ACTION_ASSIGNEE_ROLES`/`canBeAssignedProspectAction` in
`prospect-action.service-core.ts` — same value set as
`PROSPECT_OWNER_ROLES` today, but a separate constant on purpose (the
ticket's own naming, §35): ownership and action-assignability are
different domains that only coincide by value right now, and keeping them
separate means one can change without silently moving the other.
`findAssignee`'s return shape widened to include `role`, and both
`prospect-action.service.ts` and `prospect-follow-up.service.ts` (the
follow-up workflow's own next-action creation shares the same core
function) select it. A new `ASSIGNEE_NOT_ELIGIBLE` error code is returned
before any prospect/action write. `listActiveUsersForTaskAssignment`'s
query gained `role: { in: [...PROSPECT_ACTION_ASSIGNEE_ROLES] }` —
identical to the old unconditional query for every pre-existing role, so
this is invisible to ADMIN/MANAGER/COMMERCIAL and only excludes the new
ASSISTANT from the assignee dropdown, centralizing the rule at the query
rather than filtering client-side.

**History preserved here too:** an OPEN action assigned before a
transition to ASSISTANT remains completable by that person
(`canCompleteProspectAction`'s identity fallback never checks role) and is
never auto-canceled or reassigned. A new test in
`role-transition-operational-continuity.test.ts` proves both halves in one
scenario.

## 7. Role-transition regression matrix: 6 → 12

`role-transition-ownership.test.ts` and
`role-transition-operational-continuity.test.ts` each had a 6-entry
`allTransitions` array (the pre-25M 3×2 matrix). Both widened to the full
12 (4×3), adding the six ASSISTANT-involving directed transitions. Every
test body driven by these arrays was already role-agnostic in its
assertions (identity-based ownership, snapshot fields, `ownerUserId`-only
queries) — widening the array was sufficient; no new fixtures were
invented, matching the ticket's own "don't invent giant integration
fixtures unnecessarily."

## 8. Authentication and landing route

`authenticateCore`/`changeOwnPasswordCore` (`auth-credentials.service-core.ts`)
take a plain `UserRole` and never branch on its value — ASSISTANT
authenticates exactly like any other role, with the same inactive/wrong-
password rejections and no special-cased bypass. New tests confirm login
and self-password-change both work for ASSISTANT explicitly, not just "by
absence of a role check."

**The one release-blocking fix**, found by 25L and confirmed by
`app/admin/layout.tsx`'s own redirect-on-deny target (`/`, the public
homepage): `resolveDashboardRedirect` was a binary
`role === "COMMERCIAL" ? ... : "/admin"`. An Assistant would have fallen
into the `/admin` branch, been rejected by that layout's own
`requireRole("ADMIN", "MANAGER")` gate, and bounced to the public
homepage — a confusing dead end, not a crash. Fixed with an explicit third
branch:

```ts
export function resolveDashboardRedirect(role: UserRole): "/admin" | "/dashboard/commercial" | "/profile" {
  if (role === "COMMERCIAL") return "/dashboard/commercial";
  if (role === "ASSISTANT") return "/profile";
  return "/admin";
}
```

`/profile` (Ticket 25F) is the smallest already-existing, role-neutral,
authenticated surface — a deliberate transitional landing, not a new
Assistant dashboard. After 25N grants Finance access, this default may
change to `/finances`; that's a 25N decision, not made here.

## 9. `/profile` for Assistant

`/profile`'s layout (`requireAuthenticatedUser()`, no role list) and page
(`assertActiveAccountAccess`, role-agnostic) needed no changes — both were
already identity-based, not role-gated, since Ticket 25F. The shell
decision there is a binary `role === "COMMERCIAL" ? CommercialShell :
AdminShell` — ASSISTANT falls into the `AdminShell` branch automatically,
without a new explicit case, and without that branch implying any new
authority (shell choice is layout only). `ProfileSummary` already renders
the role label from `userRoleOptions` by lookup, so adding the
`{ value: "ASSISTANT", label: "Assistant" }` entry to that one array (also
consumed by the user-management table, the create/edit `<select>`, and the
shared-feed's role display) was the only change needed for "Assistant"
to render everywhere a role label appears — no separate hardcoded ternary
existed anywhere else to find.

`assertCanChangePasswordCore` (`isSelf || actor.role === "ADMIN"`) already
lets any role change their own password and only ADMIN change someone
else's — ASSISTANT falls out of this correctly with no change: they can
change their own password, never anyone else's.

## 10. Shell and navigation: capability-filtered, not blanket

`Sidebar.tsx` and `AdminMobileHeader.tsx` render for ASSISTANT via the
same `AdminShell`, but showing every Admin/Manager nav item to Assistant
would have been actively misleading — most of those routes (`/admin`,
`/updates`, `/actions`, `/products`, `/admin/follow-ups`,
`/admin/analytics/funnel`, `/admin/reports`, and the create-prospect form
now that ownership is gated) reject or reject-on-submit for this role.
Each item was audited individually (§43's own instruction: "do not give
ASSISTANT the entire ADMIN/MANAGER sidebar merely because it uses that
shell") rather than bulk-copied. What ASSISTANT sees in 25M:

```text
Mes notes        (/notes)     — role-neutral, unchanged
Mes rapports     (/reports)   — role-neutral; no template assigned by
                                 default, so nothing to report yet
Paramètres       (/profile)   — the landing route itself
```

Everything else — Tableau de bord, À la une, Nouveau prospect, Actions,
Répertoire, Suivis, Analyses, Suivi des rapports, Mes prospects, Finances,
Performance, Utilisateurs — is hidden for this role, either because it was
already role-gated to exclude Assistant (Finances, Performance,
Utilisateurs, Mes prospects) or because it was newly, explicitly excluded
here. This is a narrow, temporary nav matching 25M's actual reachable
surface, not a final Assistant navigation design — documented as such in
both files' own comments.

## 11. Performance: unchanged behavior, explicitly proven safe

25M makes **no** performance-domain code change. What's new is test
coverage proving the existing role-eligibility checks already fail safe
for the new enum value, exactly as they do for every other unsupported
role:

- `isScorableForCommercialResults("ASSISTANT")` /
  `isScorableForExecutionDiscipline("ASSISTANT")` → `false` →
  `UNSUPPORTED_ROLE`, never a fabricated zero.
- `isRoleSupportedForRoleResponsibilityAssessment("ASSISTANT")` → `false`
  (no catalog entry exists — the catalog-driven check needed no code
  change to stay correct).
- `isRoleSupportedForProfessionalContribution("ASSISTANT")` → `false`
  (this one *is* a hardcoded two-role check, not catalog-derived — still
  correctly excludes Assistant without any edit).
- `canViewEmployeePerformance("ASSISTANT", *)` → `false` for every
  employee role — Assistant gets no management dashboard, matching 25L
  §33's recommendation, with zero code change since the function was
  already an exhaustive `ADMIN`/`MANAGER`/else-false chain.
- `canAssessEmployeeInStructuredEvaluation` (the shared 25I/25J
  authorization primitive) already routes any `employeeRole` other than
  `COMMERCIAL`/`MANAGER` to `false` regardless of actor — an Assistant
  actor can never assess anyone, and nobody can assess an Assistant
  target, both proven by new tests.

No new Assistant Role Responsibility or Professional Contribution
catalog, no Assistant overall score. That determination is 25L's Section J
verdict and 25R's job to (partially) act on.

## 12. Finance: explicitly proven still denied

25M makes no Finance code change either — `app/finances/layout.tsx` is
still bare `requireAdmin()`. A new test in `authorization.service.test.ts`
proves, directly (not just by source inspection), that `requireRoleCore`
against a Finance-shaped `["ADMIN"]` gate accepts ADMIN and rejects
MANAGER, COMMERCIAL, and the new ASSISTANT identically — a positive,
explicit regression rather than relying on ASSISTANT's mere absence from
an allow-list to prove the point.

## 13. Verification

`npx tsc --noEmit`, `npx prisma format`/`validate`/`generate` (schema
change only — no other diff in the generated client beyond the widened
`UserRole` union), full `npm test` (2052 tests; the one pre-existing,
unrelated `Sidebar.test.tsx` "Rapports quotidiens" failure — confirmed in
earlier tickets via `git stash` to predate this session — is the only
failure), `npx eslint .` (clean), `npm run build` (clean), `git diff
--check` (no whitespace issues). No live migration deployed (§1). No real
user role was changed, no real Assistant account was created, no browser
verification was performed against a live account.

## 14. Deferred to later tickets (explicit non-goals here)

Per the ticket's own list, none of the following were touched:

```text
25N — Finance access for ASSISTANT (visibility + the create/reverse
      mutation-authority split 25L's Finance audit left open)
25O — ADMIN-only structured-assessment evaluator authority (narrowing
      canAssessEmployeeInStructuredEvaluation off MANAGER, plus the
      mutation-layer re-check 25L found is required for existing
      MANAGER-owned drafts to actually lose live authority — a
      constant change alone does not achieve this, per 25L Section F)
25P — Manager Results & target eligibility (SCORABLE_ROLES +
      creditedUserRoleAtEvent evidence filter + target
      ELIGIBLE_EMPLOYEE_ROLES + policy-version bump)
25Q — Manager Execution Discipline eligibility
25R — Performance role matrix & dashboard integration, including the
      Assistant Professional Contribution /10 decision (25L Section J)
```

26B (Organization & Membership) remains blocked on all of the above being
stable, per 25L's own sequencing note.
