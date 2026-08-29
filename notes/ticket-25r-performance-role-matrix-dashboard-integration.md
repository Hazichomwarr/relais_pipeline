# Ticket 25R — Performance Role Matrix & Dashboard Integration

Implemented 2026-08-29. This closes the 25G–25Q performance/Assistant-role
series: it formalizes the four-role capability matrix, closes two
previously-undocumented authorization gaps under `/admin/**`, and grants
`ASSISTANT` a real dashboard-shell landing at `/admin` — deliberately as
a *view* capability, with zero new read access to any data outside what
25N already granted. No schema change, no scoring-formula change, no
backfill.

## 1. The architectural rule this ticket freezes

> A role determines capabilities, not status in a hierarchy. Dashboard
> access, financial access, performance eligibility, evaluation
> authority, target authority, and operational ownership are separate
> policies. Sharing the Admin dashboard does not make an Assistant an
> Administrator.

And for the performance domain specifically:

> Commercials and Managers are `/100` performance subjects;
> Administrators evaluate the human dimensions; Assistants remain
> outside this commercial performance model. Role transitions alter
> future authority without rewriting historical evidence.

## 2. The final capability matrix

| Capability | ADMIN | MANAGER | COMMERCIAL | ASSISTANT |
|---|---:|---:|---:|---:|
| Dashboard overview (`/admin`) | YES | YES *(preserved)* | NO *(preserved)* | **YES (new)** |
| Finance | YES | NO | NO | YES |
| Results `/40` | NO | YES | YES | NO |
| Execution `/30` | NO | YES | YES | NO |
| Responsibilities `/20` | NO | YES | YES | NO |
| Contribution `/10` | NO | YES | YES | NO |
| Overall `/100` | NO | YES | YES | NO |
| Structured assessment mutate | YES | NO | NO | NO |
| Target management | YES | YES | NO | NO |
| Target subject | NO | YES | YES | NO |
| New Prospect ownership | *(existing)* | YES | YES | NO |
| New ProspectAction assignment | *(existing)* | YES | YES | NO |
| User administration | YES | NO | NO | NO |
| Follow-up queue (`/admin/follow-ups`) | YES | YES | NO | NO |

`*(preserved)*` / `*(existing)*` marks a cell the audit (§3, below)
confirmed was already the actual pre-25R behavior — restated here, not
newly decided. "Dashboard overview" for COMMERCIAL is `NO` because
COMMERCIAL has its own separate `/dashboard/commercial` experience, not
because it was ever evaluated and rejected for this route specifically.

## 3. The pre-implementation audit — what it actually found

Before changing anything, every route under `/admin/**` was read and
classified by its authorization call:

| Route | Authorization before 25R |
|---|---|
| `app/admin/layout.tsx` (the shell) | inline `requireRole("ADMIN", "MANAGER")` |
| `app/admin/page.tsx` (dashboard) | **none of its own** — relied entirely on the shell |
| `app/admin/follow-ups/page.tsx` | **none of its own** — relied entirely on the shell |
| `app/admin/performance-targets/page.tsx` | **none of its own** — relied entirely on the shell |
| `app/admin/analytics/{funnel,why}/page.tsx` | `requireSalesAnalyticsAccess()` |
| `app/admin/my-prospects/page.tsx` | `requireMyProspectsAccess()` |
| `app/admin/performance/page.tsx` | `requirePerformanceDashboardAccess()` |
| `app/admin/performance-assessments/page.tsx` | `requireRoleResponsibilityAssessmentManagementAccess()` |
| `app/admin/performance-assessments/[assessmentId]/page.tsx` | `requireRoleResponsibilityAssessmentManagementAccess()` |
| `app/admin/performance-assessments/professional-contribution/[assessmentId]/page.tsx` | `requireProfessionalContributionAssessmentManagementAccess()` |
| `app/admin/prospects/[prospectId]/page.tsx` | its own inline `requireRole("ADMIN", "MANAGER")` |
| `app/admin/reports/*` | its own nested `app/admin/reports/layout.tsx` → `requireDailyReportManagementAccess()` |
| `app/admin/users/page.tsx` | `requireAdmin()` |

**Three routes had no authorization call of their own** — they were
implicitly protected only by the shell's `requireRole("ADMIN",
"MANAGER")`. This mattered enormously for this ticket: widening the
shell gate to admit ASSISTANT (§4 below) would have silently opened
`/admin/follow-ups` (the sensitive commercial follow-up queue) and
`/admin/performance-targets` (target management) to ASSISTANT if their
gap had gone unnoticed. `/admin/page.tsx` itself is the one gap that
*should* open to ASSISTANT (the ticket's explicit goal), but with
deliberately different content (§6).

## 4. The new dashboard-shell capability

```ts
// authorization.service-core.ts
export const DASHBOARD_ACCESS_ROLES: UserRole[] = ["ADMIN", "MANAGER", "ASSISTANT"];

// authorization.service.ts
export async function requireDashboardAccess() {
  return requireRole(...DASHBOARD_ACCESS_ROLES);
}
```

`app/admin/layout.tsx` now calls `requireDashboardAccess()` instead of
its previous inline `requireRole("ADMIN", "MANAGER")`. This is
deliberately a *shell* capability — proof someone may open the `/admin`
frame at all — never a stand-in for `requireAdmin()` and never a
blanket `/admin/*` grant. Every route with real data keeps (or, for the
two gaps below, now has) its own independent, narrower check.

## 5. Closing the two authorization gaps

Both gaps were closed with named, tested capabilities — never a bare
inline `requireRole` call, matching this file's established one-constant-
per-feature convention:

```ts
export const FOLLOW_UP_QUEUE_MANAGEMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"];
export async function requireFollowUpQueueManagementAccess() { ... }
```

`app/admin/follow-ups/page.tsx` now calls this directly. It is a **new**
constant (this policy had never been named before — it only existed as
an accident of the shell gate).

`app/admin/performance-targets/page.tsx` now calls the **existing**
`requireCommercialPerformanceTargetManagementAccess()` — the same
capability its own Server Actions already enforced — rather than
inventing a second policy for target management.

Both pages redirect `ACCESS_DENIED` to `/admin`, matching this
repo's established convention for routes nested under the admin shell
(same pattern as `/admin/analytics/funnel`, `/admin/performance`).

## 6. Assistant's dashboard: access and content are two separate decisions

Assistant now passes `requireDashboardAccess()` and reaches `/admin` —
but the **content** was deliberately not shared with ADMIN/MANAGER.
`app/admin/page.tsx`'s existing query, `getProspects()`, returns every
company-wide prospect with owner detail, completely unfiltered by role.
No prior ticket (25M's ownership audit, 25N's Finance grant) ever gave
ASSISTANT prospect visibility, and granting it implicitly through a
dashboard widening would have been exactly the kind of "loosen a service
because the dashboard wants the data" mistake this ticket's own
instructions warn against.

**Decision (confirmed with the user before implementation):** ASSISTANT
receives a deliberately minimal overview — a welcome header plus
shortcut cards into capabilities it actually has today: Finances, Mes
notes, Mes rapports. No prospect count, no KPI card, no company-wide
query of any kind, no clickable element leading anywhere ASSISTANT isn't
independently authorized to reach. This is **zero new read capability**
beyond what 25N already granted — the audit found that Assistant's other
"safe-sounding" candidates from the ticket's own suggestion list
(shared updates feed, follow-up readiness, company-wide daily-report
state) are *not* actually broad internal-team visibility today either —
`SHARED_FEED_ROLES` and `PROSPECT_ACTION_QUEUE_ROLES` are both `[ADMIN,
MANAGER, COMMERCIAL]`, excluding ASSISTANT, and daily-report management
visibility is ADMIN/MANAGER-only — so none of them qualified as an
already-granted capability to surface.

The branch lives inside the existing `app/admin/page.tsx` (no new
`AssistantDashboard.tsx` file, per the ticket's own §9 preference) — a
single `if (actor.role === "ASSISTANT")` returns the minimal overview
before any prospect query runs; the ADMIN/MANAGER path below it is
byte-for-byte the pre-25R page.

## 7. Navigation

`Sidebar.tsx` and `AdminMobileHeader.tsx`: "Tableau de bord" → `/admin`
is now unconditional (previously `role !== "ASSISTANT"`), joining Mes
notes/Mes rapports/Paramètres/Finances as ASSISTANT's five visible items.
No other item was touched — every other ADMIN/MANAGER-only surface
(À la une, Nouveau prospect, Actions, Mes prospects, Répertoire, Suivis,
Analyses, Suivi des rapports, Performance, Utilisateurs) remains
explicitly hidden for ASSISTANT, confirmed by regression.

## 8. Redirect

```ts
export function resolveDashboardRedirect(role: UserRole): "/admin" | "/dashboard/commercial" {
  if (role === "COMMERCIAL") return "/dashboard/commercial";
  return "/admin";
}
```

`ASSISTANT` now falls through to the same `/admin` default as
ADMIN/MANAGER, replacing 25N's transitional `/finances` special case —
the return type itself narrowed since `/finances` is no longer ever
returned. `/finances` remains fully reachable via its own nav item; this
only changes the *default* post-login destination. No user-record or
session mutation: an existing Assistant session simply starts landing on
`/admin` the next time this function runs.

## 9. What was deliberately NOT touched

- **`requireAdmin()`** — still wraps `requireRole("ADMIN")`, a literal
  single-role list. Re-verified with a direct regression against the
  real shape (mirroring 25N's own `requireAdmin()` regression), proving
  the new dashboard-shell capability never widened it.
- **`/admin/users`** — still calls `requireAdmin()` directly; a new
  regression locks in that this route was never swapped to
  `requireDashboardAccess()` during this refactor.
- **Every other already-independently-gated `/admin/**` route** (§3's
  table) — none of these constants or wrapper functions were modified.
- **25P's `RESULTS_ELIGIBLE_ROLES`, `COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES`,
  event-role evidence filtering, Results formula, target semantics** —
  untouched; no 25P file was edited in this ticket.
- **25Q's Execution Discipline eligibility and formula** — untouched.
- **25O's Admin-only structured-assessment authority** — untouched. A
  new regression proves a MANAGER who is now fully performance-eligible
  (Results + Execution, 25P/25Q) still cannot create a structured
  assessment — being evaluated and evaluating others remain separate
  capabilities.
- **25M's `PROSPECT_OWNER_ROLES` / `PROSPECT_ACTION_ASSIGNEE_ROLES`** —
  untouched; ASSISTANT remains excluded from both regardless of its new
  dashboard access.
- **`AdminShell`'s name** — not renamed. It remains a UI composition
  name, not a claim about the viewer's role (its doc comment was updated
  to say so explicitly).
- **Performance UI copy** — audited; already generic ("Performance",
  "Performance globale," "Discipline d'exécution") with no stale
  Commercial-only wording to correct. 25P's target copy was already
  generalized in that ticket. No unrelated copy overhaul was performed.

## 10. Performance subject eligibility is not derived from target eligibility

`isScorableForCommercialResults` and `isScorableForExecutionDiscipline`
happen to agree with `COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES`
today (`COMMERCIAL`, `MANAGER`), but neither `performance-summary.service.ts`
nor `performance-summary.service-core.ts` imports the target-eligibility
constant or module at all — confirmed by direct inspection and locked in
with a new structural regression. The three policies remain independent
named primitives, per this ticket's own explicit instruction not to
create a generic `PERFORMANCE_ADMIN_ROLES`-style constant that would
conceal the real asymmetry between target management (`ADMIN` +
`MANAGER`) and structured-assessment authority (`ADMIN` only).

## 11. Historical semantics, summarized across the series

- **Results** — historical role is known: `creditedUserRoleAtEvent` is a
  durable snapshot (25H.1), so evidence is filtered by frozen event-role.
- **Execution** — historical role is *not* known: no equivalent snapshot
  exists on `ProspectAction`, so evidence is filtered only by durable
  `assignedToUserId` plus the employee's *current*-role eligibility
  (25Q).
- **Human dimensions** (Role Responsibilities, Professional
  Contribution) — submitted snapshots preserve evaluator/subject
  semantics permanently (25I/25J/25O); a legacy Manager-authored DRAFT
  stays non-mutable for that Manager forever, and non-mutable for any
  ADMIN who isn't its recorded evaluator.
- **Role transitions**, uniformly across every dimension — change
  *future* authority only. No transition — Commercial↔Manager, or into/
  out of Assistant/Admin — ever rewrites a historical fact: a credited
  win stays credited, a submitted assessment stays submitted, an action's
  `assignedToUserId` stays what it was.

## 12. Intentional asymmetries, restated

- **Assistant**: dashboard + Finance, but no Admin authority, no
  performance eligibility, no prospect ownership.
- **Manager**: full `/100` performance subject + target manager, but no
  structured-assessment authority.
- **Admin**: sole structured evaluator, but exempt from being scored.
- **Commercial**: full `/100` subject, but no performance-management
  authority of any kind.

These are documented features of the capability model, not
inconsistencies to resolve.

## 13. No schema, no backfill, no live mutation

`git diff --stat prisma/` is empty — no schema or migration change.
Nothing was backfilled: no role was rewritten, no historical record
touched, no test action/target/assessment/finance row created against
the live database, no real user's role was changed to verify any of
this.

## 14. Verification

`npx tsc --noEmit` (clean). Full `npm test` — 2120 tests, 2119 pass; the
one failure is the same pre-existing, unrelated `Sidebar.test.tsx`
"Rapports quotidiens" test confirmed via `git stash` in earlier tickets
to predate this session. `npx eslint .` (clean). `npm run build`
(clean). `git diff --check` (no whitespace issues). New/updated
coverage: the widened shell gate and its `requireAdmin()`-independence
regression, the two closed-gap capabilities
(`FOLLOW_UP_QUEUE_MANAGEMENT_ROLES`, reused
`requireCommercialPerformanceTargetManagementAccess()`), the
Assistant-dashboard content-boundary regressions (no `getProspects` call
on the Assistant path, shortcuts limited to already-authorized routes,
no "Administrateur" mislabeling), the navigation regressions (desktop +
mobile "Tableau de bord" now unconditional, every other surface still
hidden), the redirect regression, the `/admin/users` non-regression, the
performance-subject-vs-target-eligibility independence regression, and
the 25O evaluator-authority separation regression re-verified against
the now-fully-`/100`-eligible Manager.

## 15. The performance-series progression, for reference

```
25G   audit
25H   Execution
25H.1 WON attribution
25H.2 Results
25H.2A targets
25H.2B Results scoring
25I   Role Responsibilities
25J   Professional Contribution
25K   composition/dashboard
25K.1 actions
25K.2 drafts
25L   four-role audit
25M   Assistant introduction
25N   Assistant Finance
25O   Admin-only assessments
25P   Manager Results
25Q   Manager Execution
25R   final matrix/integration (this ticket)
```

With 25R complete, the 25-series performance/Assistant-role architecture
is closed.
