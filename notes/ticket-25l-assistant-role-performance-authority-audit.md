# Ticket 25L — Assistant Role & Performance Authority Domain Audit

Audited 2026-08-29. **Audit only — no schema, code, or runtime change in this
ticket.** No role mutations, credential changes, assessment/target creation,
prospect reassignment, finance mutations, or migrations were performed.

**A correction discovered during this audit, reported before anything else:**
a live Neon Postgres `DATABASE_URL` is configured in this environment's
`.env` — earlier tickets in this session operated under the (incorrect)
assumption that no live DB existed. The research fork that found this
stopped immediately without connecting, per its instructions. The user was
asked whether to run the ticket's optional read-only diagnostic counts
(§46/§47 of the ticket) against it and **declined** — this audit is
therefore built entirely from code/schema inspection, which is sufficient
for every conclusion below. If those counts are ever wanted later, this
document names the exact queries in Section K.

---

## Section A — Executive verdict

- **Canonical new enum name:** `ASSISTANT`. Not `ACCOUNTANT`/`SECRETARY` — the
  authorization role must stay broader than one job title (see §2 below and
  the existing `DailyReportTemplateType` precedent, which already separates
  "job function" from "authorization role").
- **Intended finance authority:** `ADMIN` and `ASSISTANT` get finance
  read/create access; `MANAGER`/`COMMERCIAL` stay excluded. Ledger reversal
  is flagged as the one operation this audit could not resolve from code
  alone — see Section D.
- **Intended evaluation authority:** `ADMIN` only may create, edit, save,
  delete, or submit a structured performance assessment (Role
  Responsibility or Professional Contribution). `MANAGER` loses this
  authority entirely, including for employees it could previously assess.
- **Intended performance role matrix:** `COMMERCIAL` and `MANAGER` both get
  the full `/100` model (Managers are senior Commercials who still carry
  commercial results); `ASSISTANT` gets no Results/40 or Execution
  Discipline/30, and a to-be-defined human-assessed subset (this audit's
  verdict: **Professional Contribution `/10` only, initially — see Section
  J**); `ADMIN` is exempt entirely (no evaluation, no score, not a subject).
- **Full/partial/unsupported for ASSISTANT initially:** **partial**.
  Professional Contribution `/10` is defensible today (its three traits are
  already role-neutral); Role Responsibilities `/20` has **no defined
  Assistant rubric** and must not be invented in this ticket or the next
  one — ship `/10` alone rather than a filled-in placeholder. No `/100`
  overall for Assistant in V1 (the composition core already requires all
  four dimensions to be authoritative before producing an overall score —
  Assistant will never satisfy that, and should not get a separately
  normalized alternative).
- **Existing data migration/backfill needed:** an additive Postgres enum
  migration for `UserRole` (precedented, one line — Section K). **No
  backfill of any existing row.** Every role-snapshot field
  (`creditedUserRoleAtEvent`, `roleAtAssignment`, `roleAtEvaluation`,
  `evaluatorRoleAtEvent`) is application-populated at write time, never a DB
  default — existing rows keep whatever was true when they were written.

---

## Section B — Role blast-radius inventory

| Area | Current assumption | Assistant future rule | Required change | Risk |
|---|---|---|---|---|
| `UserRole` enum (`prisma/schema.prisma:159-163`) | `ADMIN \| COMMERCIAL \| MANAGER` | Add `ASSISTANT` | Additive migration `ALTER TYPE "UserRole" ADD VALUE 'ASSISTANT';` (precedent: `20260808172015_add_shared_feed_foundation` did the same for a different enum) | Low — additive, non-breaking |
| Zod role list (`src/lib/validations/user.schema.ts:5` `userRoles`) | `["ADMIN","COMMERCIAL","MANAGER"]` | Include Assistant | Add to array | Low |
| UI role options (`src/lib/constants/user-options.ts:3-7` `userRoleOptions`) | 3 value+label pairs | Include Assistant | Add entry; **this list and the Zod list are two independently-maintained arrays, not derived from one another — both must be edited together or they drift** | Medium (silent drift risk, not a crash) |
| Create/edit user `<select>` (`component/users/user-management.tsx:266-268`) | Renders from `userRoleOptions` | Automatic once options list updates | None beyond the options-list edit | Low |
| `SHARED_FEED_ROLES` (À la une) | `[ADMIN,MANAGER,COMMERCIAL]` | NEEDS_BUSINESS_DECISION | TBD | Low |
| `DAILY_REPORT_MANAGEMENT_ROLES` | `[ADMIN,MANAGER]` | NEEDS_BUSINESS_DECISION | TBD | Low |
| `PROSPECT_ACTION_QUEUE_ROLES` | `[ADMIN,MANAGER,COMMERCIAL]` | MUST_EXCLUDE_ASSISTANT (lean) | None (already excludes by omission) unless business overrides | Low |
| `SALES_ANALYTICS_ROLES` | `[ADMIN,MANAGER]` | MUST_EXCLUDE_ASSISTANT | None | Low |
| `MY_PROSPECTS_ROLES` | `[ADMIN,MANAGER]` | MUST_EXCLUDE_ASSISTANT | None | Low |
| `COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES` | `[ADMIN,MANAGER]` | NEEDS_BUSINESS_DECISION (separate from evaluator-authority question — see Section F) | TBD | Low |
| `ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES` | `[ADMIN,MANAGER]` | **Must narrow to `[ADMIN]`** | Active removal of MANAGER, not just Assistant-exclusion-by-omission | Medium — a coarse-gate narrowing changes existing MANAGER behavior |
| `PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES` | `[ADMIN,MANAGER]` | **Must narrow to `[ADMIN]`** | Same as above | Medium |
| `PERFORMANCE_DASHBOARD_ACCESS_ROLES` | `[ADMIN,MANAGER]` | MUST_EXCLUDE_ASSISTANT (§33: no management dashboard for Assistant) | None | Low |
| `employee-assessment-authorization.ts`'s per-target-role branching | `COMMERCIAL→ADMIN/MANAGER; MANAGER→ADMIN; else→false` | **Simplifies**, doesn't just extend | Once evaluation is ADMIN-only, this collapses to `actor.role === "ADMIN"` plus self-exclusion (and, later, a target-role-support check for Assistant) | Medium — touches 3 call sites (Section F) |
| `app/admin/layout.tsx` — `requireRole("ADMIN","MANAGER")`, the choke point for all of `/admin/**` | ADMIN/MANAGER only | NEEDS_BUSINESS_DECISION — does any Assistant surface live under `/admin/**`? | TBD, likely yes for Finance if Finance stays nested there | Medium |
| `app/finances/layout.tsx` — `requireAdmin()` | ADMIN only | MUST_INCLUDE_ASSISTANT | Swap to a new `requireFinanceAccess()`-style two-role gate (Section D) | Low, isolated |
| `resolveDashboardRedirect` (`src/lib/dashboard-routing.ts`) | `role === "COMMERCIAL" ? .../dashboard/commercial : "/admin"` — binary, not exhaustive | **Silently wrong today**: Assistant falls into the `else` branch → `/admin` → rejected by the layout gate → bounced to public `/` | Must add an explicit Assistant branch the same day the enum ships | **High** — not a crash, but a confusing dead-end landing with zero code changes otherwise |
| `auth.ts` JWT/session callbacks | Verbatim pass-through of `UserRole` | ROLE_AGNOSTIC_ALREADY | None | None |
| Shell selection (`AdminShell` vs Commercial shell) | Implicit via which layout/route is reached, not a dedicated chooser | Assistant likely uses the Admin-style shell with capability-filtered nav | Layout gate widening (see above), NOT a blanket permission grant — shell ≠ authority | Medium |
| `listAssignableUsers()` (prospect ownership candidates) | `where: { role: "COMMERCIAL" }` | MUST_EXCLUDE_ASSISTANT | **None — already safe by construction** | Low |
| Prospect creation (`prospect-creation.service-core.ts`) | *"any authenticated active User, not a role-narrowed candidate"* — the creator becomes the owner, unconditionally, via the public `/` route (no role gate on that route at all) | MUST_EXCLUDE_ASSISTANT per §36's own expectation | **Real gap: this is NOT already safe.** If Assistant can reach `/`, they become a prospect owner with zero further changes. Needs an explicit decision + guard if Assistant must never own a prospect | **High** |
| `listActiveUsersForTaskAssignment()` (ProspectAction assignee candidates) | `where: { active: true }` — **no role filter at all**, comment says "role-neutral by design" | MUST_EXCLUDE_ASSISTANT per §37's own lean | **Real gap, not already safe** — needs an explicit role filter added if exclusion is the decision | **High** |
| `dailyReportTemplateType` | Nullable, independent enum (`ASSISTANT`, `OPERATIONS_COORDINATOR`), ADMIN-assigns per user regardless of `role` | No change required | **Naming collision, not a functional bug**: `"ASSISTANT"` will exist as both a `UserRole` value and an unrelated `DailyReportTemplateType` value the moment the enum ships — document loudly so nobody conflates `dailyReportTemplateType === "ASSISTANT"` with `role === "ASSISTANT"` | Medium (confusion risk, not a runtime bug) |
| `prisma/add-daily-report-foundation.migration.test.ts` | Asserts `UserRole`'s schema text does **not** contain `/ASSISTANT/` | **Will fail the moment the enum changes** | Must be updated as part of the same PR that adds the enum value | Low (caught by CI, not a silent bug) |
| Nav — Sidebar.tsx / AdminMobileHeader.tsx (Finances) | Literal `role === "ADMIN"` gate, both desktop and mobile | MUST_INCLUDE_ASSISTANT | Widen both literal checks | Low |
| Nav — every other management item (Utilisateurs, Rapports quotidiens management, Mes prospects, Performance, etc.) | Each individually gated | **MUST_EXCLUDE_ASSISTANT by default** — do not give Assistant the whole Admin/Manager sidebar just because it shares the shell | Review each item individually when Assistant nav is built; do not bulk-copy | Medium if done carelessly |

**Tests that enumerate exactly 3 roles or 6 (3×2) transitions and will
silently become incomplete** (not broken, just no longer exhaustive) once a
4th role exists:

- `src/services/prospect-action.service-core.test.ts`
- `src/services/prospect-follow-up.service-core.test.ts`
- `src/services/prospect-creation.service.test.ts`
- `src/services/account-access.service-core.test.ts`
- `src/services/auth-credentials.service.test.ts`
- `src/services/professional-contribution.service-core.test.ts` (will need
  rewriting anyway once evaluator authority narrows to ADMIN-only)
- `src/services/role-responsibility-assessment.service-core.test.ts` (same)
- `src/services/sales-funnel-analytics.service-core.test.ts`
- `src/services/role-transition-ownership.test.ts`,
  `src/services/role-transition-operational-continuity.test.ts`,
  `src/services/my-prospects-continuity.test.ts` — these currently cover
  COMMERCIAL↔MANAGER only (2 roles, 2 transitions, not the full 3×2=6 the
  ticket's own §45 assumes already exists), and most assertions are already
  phrased role-agnostically ("ownership never keyed by role") — likely need
  *additional* fixtures for Assistant transitions rather than a rewrite,
  but each file needs individual review before assuming that holds
  everywhere in it.

**Test that will actively fail, not just become incomplete:**
`prisma/add-daily-report-foundation.migration.test.ts` (see table above and
Section K).

---

## Section C — Authorization matrix (future state)

| Surface | ADMIN | MANAGER | COMMERCIAL | ASSISTANT |
|---|---|---|---|---|
| Dashboard / admin shell (`/admin`) | Yes | Yes | No (own dashboard) | Yes (capability-filtered, not blanket) |
| Finances (`/finances/**`) | Yes | No | No | **Yes** |
| Performance dashboard (`/admin/performance`) | Yes | Yes (view only, see Section F) | No | **No** (§33) |
| Create/edit/submit structured assessment | Yes | **No** (was Yes) | No | No |
| Commercial Performance Targets (set targets) | Yes | NEEDS_BUSINESS_DECISION (Section F) | No | No |
| Role Responsibility / Professional Contribution assessments *as subject* | Exempt | Yes (already true) | Yes (already true) | Partial — TBD, see Section J |
| Prospect ownership | Yes (admin override) | Yes | Yes | **No** (real gap to close, not already safe — Section B) |
| ProspectAction assignment | Yes | Yes | Yes | **Lean No**, needs explicit decision + guard (Section B) |
| Daily Reports (commercial reporting) | N/A | Manages | Files | Probably No initially (§38) — no template exists for Assistant's operational work yet, and none should be invented here |
| Users/Équipe administration | Yes | No | No | No |
| `/updates` (shared feed) | Yes | Yes | Yes | NEEDS_BUSINESS_DECISION — operationally plausible, not pre-decided |
| Profile | Yes | Yes | Yes | Yes |

Uncertain/explicitly flagged: `/updates` access, whether MANAGER retains any
target-setting authority (Section F), and every Section B row marked
`NEEDS_BUSINESS_DECISION`.

---

## Section D — Finance matrix

Finance authorization today has **no dedicated role-array constant** — every
gate calls the generic `requireAdmin()` directly (`app/finances/layout.tsx`,
and each mutation's Server Action). Introducing Assistant requires
*creating* a new constant/wrapper (e.g. `FINANCE_ACCESS_ROLES` /
`requireFinanceAccess()`), matching this codebase's per-feature-constant
convention, then swapping every call site below.

Finance mutation services **never re-check authorization internally**
(`financial-ledger.service.ts`/`.service-core.ts` have zero
`requireAdmin`/`AuthorizationError` references) — all enforcement lives at
the Server Action layer only, plus an independent UI-visibility boolean per
page. No defense-in-depth inside the service itself for this domain, unlike
performance's core functions.

| Capability | Type | Current gate | Recommended future gate | Rationale / open question |
|---|---|---|---|---|
| View `/finances` (ledger list, summary) | read | `app/finances/layout.tsx` `requireAdmin()` — single choke point for all nested routes | `ADMIN + ASSISTANT` | Matches the frozen requirement directly |
| View `/finances/reports` | read | Inherits the same layout gate | `ADMIN + ASSISTANT` | Automatic once the layout changes |
| View a ledger entry detail | read | Same layout gate; page itself only requires authentication | `ADMIN + ASSISTANT` | Same |
| Show "create entry" UI | UI visibility | `app/finances/page.tsx`: literal `user.role === "ADMIN"`, independent of the read gate | `ADMIN + ASSISTANT` (tentative) | Must be updated in lockstep with the Action, not derived from the layout gate |
| Create a ledger entry | create | `src/actions/financial-ledger.actions.ts` `requireAdmin()` | `ADMIN + ASSISTANT` (tentative) | Routine day-to-day recording; nothing marks it administratively sensitive beyond "who touches money" |
| Show "reverse" UI | UI visibility | `app/finances/ledger/[entryId]/page.tsx`: literal `user.role === "ADMIN" && entry.status === "POSTED" && entry.reversalOfId === null` | **Open** | Same independent-literal pattern as create |
| Reverse a ledger entry | mutate (creates an offsetting entry; there is no edit/delete on `LedgerEntry` at all) | `src/actions/financial-ledger.actions.ts` `requireAdmin()` | **Recommend: stay ADMIN-only** — flagged as the one genuinely open question | This is the domain's one "undo" mechanism and permanently alters the effective record. Code gives no explicit signal either way; recommending the more conservative default rather than bundling it with routine creation |
| Edit an existing ledger entry | — | **Does not exist** anywhere in the service or actions | N/A | Nothing to gate |
| Payment-method operations | — | Not a real capability — `paymentMethod` is a plain enum field chosen at entry-creation time, not a managed resource | N/A | Fully covered by the create decision above |
| Export | — | **Does not exist** | N/A | Nothing to gate yet |
| Administrative settings | — | **Does not exist** as a mutable surface | N/A | Nothing to gate |

**Pre-existing hygiene note (not to fix now):** three comments (in
`app/finances/page.tsx`, `app/finances/reports/page.tsx`, and
`finances-reports-authorization.test.ts`'s header) still say the layout
"already ran `requireRole("ADMIN","MANAGER")`" — stale prose predating
Ticket 20G.1's tightening to ADMIN-only. The actual enforced code and the
other test file are correct; only these comments drifted. Worth a cleanup
pass whenever this code is next touched for Assistant.

---

## Section E — Performance matrix (future state)

| Dimension | ADMIN | MANAGER | COMMERCIAL | ASSISTANT |
|---|---|---|---|---|
| Results /40 | Exempt | **Yes** (was Unsupported) | Yes | No |
| Execution Discipline /30 | Exempt | **Yes** (was Unsupported) | Yes | No |
| Role Responsibilities /20 | Exempt | Yes (already true) | Yes (already true) | **Not yet defined — do not invent a rubric** |
| Professional Contribution /10 | Exempt | Yes (already true) | Yes (already true) | **Yes — defensible, catalog is already role-neutral (Section J)** |
| Overall /100 | Exempt | Yes, once Results+Execution eligibility ships | Yes (already true) | **No** — never normalized down; if Assistant only ever gets `/10`, that stays a `/10`, not a rescaled `/100` |

---

## Section F — Evaluator policy transition

**New assessments.** `src/lib/employee-assessment-authorization.ts`'s
`canAssessEmployeeInStructuredEvaluation` is the single shared primitive with
exactly three real callers (confirmed exhaustively —
`role-responsibility-assessment.service-core.ts`,
`professional-contribution.service-core.ts`, and
`performance-summary.service.ts`'s 25K.1 `canAssess` computation; every
other file that mentions the function names is a doc comment, not a call).
Changing this one function to `actor.role === "ADMIN" && actor.id !==
employeeId` (plus target-role support) simplifies rather than complicates
the current per-target-role branching, and automatically:

- Blocks new MANAGER-initiated assessment creation (create-core calls this
  primitive directly).
- Removes the 25K.1 dashboard's "Évaluer…" / "Continuer l'évaluation" CTA
  for MANAGER viewers (the dashboard's `canAssess` flows through the same
  primitive).

**It does NOT, by itself, stop a MANAGER from continuing to edit, save, or
submit a draft they already own.** This is the audit's single most
important concrete finding for this section:
`assessRoleResponsibilityItemCore`, `submitRoleResponsibilityAssessmentCore`,
and `deleteRoleResponsibilityAssessmentCore` (and their 25J mirrors) check
**only** `assessment.evaluatorUserId !== actor.id` — they never re-call the
shared authorization primitive, by design (confirmed by this codebase's own
existing, passing test: *"assessing, submitting, and deleting never
re-fetch the employee or re-check anyone's current role — only identity
(evaluatorUserId) and status are consulted"*). So narrowing the primitive
alone leaves every **existing** MANAGER-owned draft exactly as mutable to
its original evaluator as it is today. If "Manager loses mutation authority
after new policy" (the ticket's own §16 preferred rule) is meant literally
and immediately, the future implementation must add an **explicit new
check** at the mutation layer (e.g., re-verify `actor.role === "ADMIN"` in
addition to the ownership check) — this is a real code change, not a
side-effect of the primitive change.

**Existing drafts (§16).** Recommended future semantics, per the ticket's
own stated preference and this audit's confirmation that it's
implementable cleanly:

- The draft remains historical draft data — no deletion, no rewritten
  `evaluatorRoleAtEvent`, no reinterpretation.
- The MANAGER evaluator loses further mutation authority once the
  mutation-layer check above ships (not automatically today — see previous
  paragraph).
- ADMIN does **not** silently become the evaluator. No ownership transfer
  is invented.
- Of the ticket's three offered options (A: ADMIN deletes and recreates; B:
  audited transfer mechanism; C: leave locked until an ADMIN-specific
  delete), this audit recommends **C for V1**: it requires zero new
  transfer-authorization code, matches "no silent ownership transfer"
  exactly, and an ADMIN-specific delete-any-draft capability is a small,
  auditable addition to the existing delete path (which currently also
  only checks `evaluatorUserId === actor.id` — an ADMIN override there
  would need to be added explicitly, and should log/require the same kind
  of deliberate action this ticket asks role-provisioning to require).

**Existing submitted assessments (§15).** No action, ever. They were valid
under the policy in force at submission time.
`evaluatorRoleAtEvent = "MANAGER"` stays `"MANAGER"`. Do not reinterpret,
reattribute, or invalidate.

**Manager view vs. assess (§32).** `canViewEmployeePerformance` (in
`performance-summary.service-core.ts`) and
`canAssessEmployeeInStructuredEvaluation` are already two entirely separate
functions with no shared implementation — this was a deliberate 25K design
decision. Narrowing the assess primitive to ADMIN-only requires **zero
change** to `canViewEmployeePerformance`; MANAGER keeps viewing COMMERCIAL
employees' dashboards exactly as today. The risk this audit flags is
architectural, not functional: the **coarse route gates**
(`ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES` /
`PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES`, both currently
`[ADMIN,MANAGER]`) gate the **entire** `/admin/performance-assessments`
page — both the read-only assessment list and the create forms — with one
constant. Naively narrowing this single constant to `[ADMIN]` would also
remove MANAGER's ability to even *view* that list, which is not what §32
asks for. The future implementation needs to either split this page's
authorization (view: `[ADMIN,MANAGER]`; create/mutate:
`[ADMIN]`) or accept that MANAGER loses list-visibility too as a deliberate,
documented trade-off — flagged here as a design decision for ticket 25O,
not resolved by this audit.

**Assistant performance visibility (§33).** No management Performance
dashboard access for Assistant (`PERFORMANCE_DASHBOARD_ACCESS_ROLES` stays
`[ADMIN,MANAGER]`, excluding Assistant by omission — no code change
needed). Employee self-view of one's own submitted performance is a
separate, not-yet-built capability and is out of scope here; finance access
and performance/HR access are unrelated and must not be conflated by a
future "capability role" implementation.

---

## Section G — Historical invariants

1. Existing `evaluatorRoleAtEvent = MANAGER` stays `MANAGER`. **No code
   currently violates this** — role-snapshot fields are never re-derived
   from the live `User` relation on read anywhere in this codebase
   (confirmed across `commercial-results.service-core.ts`,
   `commercial-performance-target.service-core.ts`, both assessment
   service-cores).
2. Existing submitted MANAGER assessments remain valid, unmodified,
   unreattributed.
3. Existing credited WON role snapshots
   (`ProspectActivity.creditedUserRoleAtEvent`) are not rewritten. Widening
   Results eligibility to include MANAGER changes how these snapshots are
   *interpreted* going forward (Section H) — it never rewrites the snapshot
   itself.
4. Existing `CommercialPerformanceTarget.roleAtAssignment` snapshots are not
   rewritten. `roleAtAssignment: employee.role` is set once, at creation,
   from the employee's role at that instant
   (`commercial-performance-target.service-core.ts`) — already
   correct-by-construction for a future MANAGER target; no code change
   needed for this specific invariant.
5. User role changes never rewrite Prospect/Action/history ownership.
   Confirmed: `updateUserCore` writes only
   `firstName/lastName/email/phone/role/active/dailyReportTemplateType`
   plus a status-transition record onto `User` itself — zero writes to
   `Prospect`, `ProspectAction`, `DailyReport`, `LedgerEntry`, or either
   assessment model found anywhere in `user.service.ts`/`user.service-core.ts`.
6. Adding ASSISTANT creates no fabricated historical Assistant activity —
   trivially true; the enum addition itself writes nothing.
7. No performance backfill — confirmed in Section K.

---

## Section H — Results policy audit

**Existing literal COMMERCIAL gates (two, not one — this is the audit's key
finding for this section):**

1. **Product-level "does this employee's current role get a Results score
   at all" gate:** `commercial-results.service-core.ts`'s
   `SCORABLE_ROLES: ReadonlySet<UserRole> = new Set(["COMMERCIAL"])`, checked
   by `isScorableForCommercialResults(employee.role)` inside
   `computeCommercialResultsResult`. This is a single-constant change to add
   `"MANAGER"`.
2. **Evidence-eligibility gate, entirely separate:** the same file's
   evidence collector partitions wins by `event.creditedUserRoleAtEvent ===
   "COMMERCIAL"` (used to build `creditedWins` vs.
   `excludedNonCommercialRoleWins`). **Widening gate 1 alone does nothing
   for a MANAGER's historically-credited wins** — they would still be
   silently excluded from the count by this second, independent filter.
   Both gates must change together for the business rule to actually take
   effect: gate 2's condition needs to become "credited role is a
   commercial-performing role" (i.e., `COMMERCIAL` or `MANAGER`), matching
   the ticket's own §19 framing exactly.

The file's own existing doc comment already anticipated exactly this
distinction: *"The role gate checks the employee's current role... A
currently-MANAGER employee's past COMMERCIAL-earned evidence still exists
and is still correct."* This confirms §19's question — yes, already-recorded
MANAGER-at-event WON outcomes should become valid Results evidence once
policy changes, because the frozen fact remains truthful; only the
evaluation policy is changing, not the historical data. This is a **policy
reinterpretation**, not a data correction, and should be documented as such
in the implementing ticket.

**Target implications:** `commercial-performance-target.service-core.ts`'s
`ELIGIBLE_EMPLOYEE_ROLES: ReadonlySet<UserRole> = new Set(["COMMERCIAL"])`
is the identical pattern, one more constant to widen. Model name
(`CommercialPerformanceTarget`), service name, and route
(`/admin/performance-targets`) are already generic enough that this audit
recommends **Option A** from §22 — broaden eligibility, do not rename. The
existing name is not actively misleading (it describes what the target
measures — commercial performance — not who may hold one), and a rename
would introduce migration complexity for zero real clarity gain.

**Policy version implication:** `COMMERCIAL_RESULTS_POLICY_VERSION =
"COMMERCIAL_RESULTS_V1"` is a single string constant, consistently threaded
through every result branch — bumping it to a V2-style identifier is
mechanically trivial. **However, a nuance the ticket's own framing doesn't
anticipate:** Results (and Execution Discipline) are **never persisted**.
There is no snapshot table for either — no model in `prisma/schema.prisma`
stores a computed Results or Execution score; both are recomputed live on
every request from `ProspectActivity`/`ProspectAction` +
`CommercialPerformanceTarget` rows. This is structurally different from
Role Responsibility/Professional Contribution, which **are** persisted and
frozen once submitted. Consequence: there is no "old finalized/snapshotted
result" anywhere to protect — the moment the policy code ships, every past
period's Results view retroactively reflects the new policy, for every
viewer, immediately. `policyVersion` on a Results result object is a
transparency label on a freshly computed value, not a comparison against a
frozen stored one. The version bump matters for audit-trail honesty (a
support conversation referencing "why did this score change between
Tuesday and Wednesday" needs the version string to explain it), not for
protecting stored data, because there is none to protect.

---

## Section I — Execution Discipline audit

**Current role gate:** `execution-discipline.service-core.ts`'s own
`SCORABLE_ROLES: ReadonlySet<UserRole> = new Set(["COMMERCIAL"])`
(independently defined from Results' identical-looking constant — not
shared, consistent with this codebase's per-feature-constant convention),
checked by `isScorableForExecutionDiscipline(employee.role)`. Same
single-constant widening as Results' gate 1, and — unlike Results — **there
is no second, hidden filter to also update**: `ProspectAction` carries no
role-attribution field analogous to `creditedUserRoleAtEvent` at all, so
there is nothing equivalent to Results' evidence-eligibility gate for this
dimension.

**The historical limitation this creates, and it must not be papered
over:** `ProspectAction` (`assignedToUserId`, `dueAt`, `completedAt`,
`canceledAt`, `status`) has **no per-action role snapshot whatsoever** —
already documented in 25K's own audit and reconfirmed here. This means:
Execution evidence is reconstructable as an action lifecycle (who was
assigned, when it was due, when it was completed/canceled) for any closed
period, but **whether that assignee was COMMERCIAL or MANAGER at the time
the action was assigned or completed is not reconstructable at all** — the
system can only tell you their role *right now*.

**Prospective Manager scoring, and what happens across a role transition:**
the future implementation can safely allow a *currently*-MANAGER employee
to receive an Execution Discipline score for a closed period, gated purely
on their current role (exactly matching how this dimension already scores
COMMERCIAL employees today — current-role-gated, not historically
reconstructed). But state explicitly, not silently: if an employee was
COMMERCIAL during the scored period and is MANAGER now, their score is
computed the same way it always was (action lifecycle, role-independent
evidence) — the *only* thing that changed is whether the "is this role
scorable at all" gate lets them see a number. If an employee was MANAGER
during the period and is COMMERCIAL now (a demotion), the same holds in
reverse. Neither direction can be verified against "were they actually
performing commercial work during that specific period" — that fact is
gone. Do not build a feature that implies otherwise; document this
limitation the same way Results' `LEGACY_ATTRIBUTION_INCOMPLETE` honesty
pattern already does elsewhere in this domain.

---

## Section J — Assistant performance audit

**Role Responsibilities /20 — verdict: NOT YET DEFINED.** 25I's catalog is
role-*specific* by design (`ROLE_RESPONSIBILITY_CATALOG` is filtered by an
exact `role` field per definition; `isRoleSupportedForRoleResponsibilityAssessment`
is *derived* from catalog presence, not a separate hardcoded list — an
Assistant definition would need to be authored, audited, and justified the
same rigorous way 25I's audit justified exactly one COMMERCIAL
responsibility and one MANAGER responsibility). The ticket's own suggested
candidate areas (administrative follow-through, finance record maintenance,
document/operational coordination) are plausible but nothing in this
repository's current domain model measures any of them today — there is no
tracked "administrative task completion" surface the way `ProspectAction`
tracks commercial task completion, so a Role Responsibility item for
Assistant would currently have to be `MANAGER_ASSESSED` with no supporting
evidence surface at all (25I's own MANAGER responsibility already accepts
this for one item, informed by `DailyReportAttentionItem` as reference
material — Assistant has no equivalent reference surface today).
**Recommendation: ship nothing for this dimension rather than a filler
rubric.** `isRoleSupportedForRoleResponsibilityAssessment("ASSISTANT")`
should simply return `false` by having no catalog entry — this is the
existing, safe, zero-code-needed default, identical to how ADMIN is
unsupported today.

**Professional Contribution /10 — verdict: YES, defensible.** Read in full:
none of the three V1 traits (Initiative, Coordination et communication,
Résolution de problèmes) or their fifteen BARS anchor descriptions reference
prospects, commercial results, sales, or any Commercial-specific concept —
every anchor is phrased in terms of autonomy, communication timeliness, and
problem-solving behavior, genuinely cross-role language exactly as 25J's
own audit intended ("cross-role professional behavior, unlike Role
Responsibilities' role-specific duties"). `isRoleSupportedForProfessionalContribution`
is a plain hardcoded `role === "COMMERCIAL" || role === "MANAGER"` check
(not catalog-derived, unlike Role Responsibilities) — adding `"ASSISTANT"`
here is a one-line, low-risk change once the business decision is made.
**However, note the authorization-primitive interaction:** the shared
`canAssessEmployeeInStructuredEvaluation`'s target-role branching currently
has no `ASSISTANT` clause at all (an Assistant target falls into the
unreachable `else → false` branch today) — once evaluation authority
simplifies to ADMIN-only (Section F), this becomes trivial (`actor.role ===
"ADMIN"` regardless of target role, plus self-exclusion), but it must not
be forgotten as a required line in that same change.

**Overall score — verdict: NO.** The composition core
(`performance-summary.service-core.ts`) already requires Results, Execution
Discipline, Role Responsibilities, *and* Professional Contribution to all be
`SCORED`/`SUBMITTED` before producing any `overall` value — Assistant will
never satisfy the first two by design, so `overall` for Assistant is always
and correctly `null`, with no new code required to enforce this. Do not
build a parallel "Assistant overall" normalization (e.g. rescaling `/10` to
`/100`) — that would misrepresent a ten-point human assessment as a
full-model score.

**This audit's concrete Assistant performance verdict:**

```text
ASSISTANT
Professional Contribution /10 only, initially
Role Responsibilities: NOT YET DEFINED (ship nothing, don't invent filler)
Overall: no score, ever, under the current composition rule
```

---

## Section K — Migration/data implications

**Enum migration: YES, required.** Exact precedent exists in this repo:
`prisma/migrations/20260808172015_add_shared_feed_foundation/migration.sql`
contains `ALTER TYPE "ProspectActivityType" ADD VALUE 'WON_TRANSITION';` —
the same one-line additive pattern applies:
`ALTER TYPE "UserRole" ADD VALUE 'ASSISTANT';`. No `.migration.test.ts`
exists for that specific precedent migration, so there's no fixed
content-test template to imitate beyond this repo's general
`add-*.migration.test.ts` convention.

**Backfill of existing rows: NO.** Every role-snapshot field
(`UserCreationActivity.roleAtEvent`,
`ProspectActivity.creditedUserRoleAtEvent`,
`CommercialPerformanceTarget.roleAtAssignment`/`createdByRoleAtEvent`,
`RoleResponsibilityAssessment.roleAtEvaluation`/`evaluatorRoleAtEvent`,
`ProfessionalContributionAssessment.roleAtEvaluation`/`evaluatorRoleAtEvent`)
is a plain required-or-nullable column with **no `@default(...)`**, written
explicitly by application code at row-creation time. Verified by tracing
each to its write site in the corresponding service-core file. Existing
rows already carry whatever role was true when written and need no
migration touch.

**Rewrite of historical role-snapshot fields: NO**, for the same reason —
adding a new enum value is non-breaking for every existing row and column
value; nothing references "the full set of possible `UserRole` values" in a
way that an addition would violate, except the one test below.

**Non-role tables carry no frozen role at all** — `UserStatusActivity`
(`userId`, `actorUserId`), `LedgerEntry` (`createdByUserId`), `ProspectAction`
(`assignedToUserId`/`createdByUserId`/`completedByUserId`), and `DailyReport`
(`ownerUserId`) are all plain foreign keys with no role snapshot. If ever
joined to `User.role`, they reflect that user's **current** role, not a
frozen historical one — this is the same limitation Section I documents for
Execution Discipline, now confirmed to extend to every other plain-FK
table in the schema. Worth noting for anyone tempted to reconstruct "who
did what while holding which role" from these tables directly.

**One existing test WILL fail, not just become incomplete:**
`prisma/add-daily-report-foundation.migration.test.ts` contains:

```js
assert.doesNotMatch(userRoleEnum[0], /ASSISTANT|OPERATIONS_COORDINATOR/);
```

This assertion exists specifically to keep `UserRole` and
`DailyReportTemplateType` from colliding — and it is about to become
literally true in spirit (the two enums *do* need to stay conceptually
separate) while becoming false in its exact text match, because
`DailyReportTemplateType` already legitimately contains `ASSISTANT` as one
of its two values (`schema.prisma`, alongside `OPERATIONS_COORDINATOR`),
and `UserRole` is about to gain an unrelated `ASSISTANT` value of its own.
**This is not a bug to route around — it's the exact role-vs-job-title
naming collision Section B and the ticket's own §2 warn about, now
concretely instantiated.** The test must be rewritten (not just deleted) to
assert the *conceptual* separation correctly given that both enums now
share the literal string `"ASSISTANT"` for unrelated reasons; the
implementing ticket should treat this test's rewrite as a checkpoint for
writing the "these are not the same thing" documentation this audit
recommends.

**Optional, deferred (§46/§47 of the ticket):** the user declined to run
live read-only diagnostic queries during this audit, since the rest of the
audit's conclusions don't depend on them. If wanted later, the exact
queries this audit would have run are:

```sql
SELECT role, count(*) FROM "User" GROUP BY role;
SELECT "evaluatorRoleAtEvent", count(*) FROM "RoleResponsibilityAssessment" WHERE status = 'SUBMITTED' GROUP BY "evaluatorRoleAtEvent";
SELECT "evaluatorRoleAtEvent", count(*) FROM "RoleResponsibilityAssessment" WHERE status = 'DRAFT' GROUP BY "evaluatorRoleAtEvent";
SELECT "evaluatorRoleAtEvent", count(*) FROM "ProfessionalContributionAssessment" WHERE status = 'DRAFT' GROUP BY "evaluatorRoleAtEvent";
SELECT "roleAtAssignment", count(*) FROM "CommercialPerformanceTarget" GROUP BY "roleAtAssignment";
SELECT "creditedUserRoleAtEvent", count(*) FROM "ProspectActivity" WHERE type = 'WON_TRANSITION' GROUP BY "creditedUserRoleAtEvent";
```

All are plain `SELECT ... GROUP BY` aggregates — no mutation risk if run
later; the two DRAFT-by-evaluator-role counts are the ones most relevant to
sizing ticket 25O's transition work (Section F).

---

## Section L — Implementation plan

The ticket's own proposed sequence holds up well against what this audit
found; adjusted only where real coupling or newly-discovered gaps change
the picture:

```text
25M — Assistant Role Domain Introduction
  Scope: enum migration + Zod role list + UI role options (both files,
  kept in sync) + dashboard-routing.ts explicit Assistant branch +
  admin-layout gate decision + prospect-ownership/ProspectAction-assignment
  explicit exclusion (real new code, not already-safe) + the
  add-daily-report-foundation migration test rewrite + role-vs-job-title
  documentation note (the DailyReportTemplateType.ASSISTANT collision).
  Operational risk: LOW. Migration: YES (additive enum only).
  Must ship the dashboard-routing.ts fix in the SAME PR as the enum —
  otherwise Assistant logins bounce to the public homepage the moment the
  enum exists, even before any nav/finance work lands.

25N — Assistant Authorization & Finance Access
  Scope: new FINANCE_ACCESS_ROLES-style constant/wrapper, swap
  app/finances/layout.tsx and the create-entry Server Action, UI
  visibility booleans (create button), Sidebar/AdminMobileHeader nav
  entries (desktop+mobile). Ledger-reversal gate stays ADMIN-only pending
  explicit business sign-off (Section D's one open question).
  Operational risk: LOW. Migration: NO. Depends on 25M (needs the enum
  to exist and a landing route that doesn't bounce Assistant away first).

25O — Admin-Only Performance Assessment Authority
  Scope: narrow canAssessEmployeeInStructuredEvaluation to
  actor.role === "ADMIN" (plus self-exclusion + target-role support);
  narrow ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES /
  PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES; resolve the
  view/assess coarse-gate split for /admin/performance-assessments
  (Section F); add the explicit mutation-layer re-check so existing
  MANAGER-owned drafts actually lose live mutation authority (Section F's
  key finding — this does NOT fall out of the primitive change alone);
  decide and implement the existing-draft transition policy (Option C
  recommended). No schema change.
  Operational risk: MEDIUM (changes live MANAGER behavior, not just
  additive). Independent of 25M/25N — could ship before or after Assistant
  exists at all, since it's purely about narrowing MANAGER, not about
  Assistant.

25P — Manager Results & Target Eligibility
  Scope: widen SCORABLE_ROLES in commercial-results.service-core.ts AND
  the creditedUserRoleAtEvent evidence filter (both, or the change is a
  no-op for historical evidence — Section H's key finding); widen
  ELIGIBLE_EMPLOYEE_ROLES in commercial-performance-target.service-core.ts;
  bump COMMERCIAL_RESULTS_POLICY_VERSION to a V2-style identifier
  (transparency label only — no stored snapshot to migrate, Section H).
  Operational risk: MEDIUM (retroactively changes what every past period's
  Results view shows the instant it ships, per Section H's
  no-persistence finding — worth flagging to whoever reviews the diff,
  not because it's unsafe, but because it's instant and global).
  No schema change. Independent of Assistant entirely.

25Q — Manager Execution Discipline Eligibility
  Scope: widen SCORABLE_ROLES in execution-discipline.service-core.ts.
  Simpler than 25P — no second hidden filter (Section I). Document the
  cross-role-transition limitation explicitly (no per-action role
  snapshot exists or ever will without new schema work, which this ticket
  does not do).
  Operational risk: LOW. No schema change. Independent of Assistant.

25R — Performance Role Matrix & Dashboard Integration
  Scope: wire the now-widened Results/Execution/Target eligibility into
  the 25K composition and 25K.1 dashboard end-to-end; decide and (if
  approved) implement Assistant Professional Contribution /10 eligibility
  (isRoleSupportedForProfessionalContribution + the authorization
  primitive's target-role branch); confirm dashboard cards render
  correctly for the new MANAGER-full and ASSISTANT-partial cases; update
  the 3-role-exhaustive tests listed in Section B that touch this domain.
  Operational risk: LOW-MEDIUM. No schema change. Depends on 25O (for
  Assistant-as-subject to be meaningful) and 25P/25Q (for the Manager
  matrix to be complete).
```

Each ticket is independently shippable in the order above except where
noted; 25P/25Q/25Q have no dependency on Assistant existing at all and
could be sequenced earlier or interleaved with 25M/25N if that's
operationally convenient — the audit found no coupling between "Manager
becomes a full performance role" and "Assistant role exists."

---

## Section 2 (naming) — recorded for completeness

**Authorization role vs. job title**, stated explicitly per the ticket's own
request: `UserRole.ASSISTANT` is a permission tier (what this person is
allowed to do in the CRM), never a job title. This codebase already has a
working precedent for exactly this distinction —
`User.dailyReportTemplateType` (values `ASSISTANT`, `OPERATIONS_COORDINATOR`)
is an independent, nullable, ADMIN-assignable "what report template does
this person fill out" tag, unrelated to `role`. The unfortunate
consequence, surfaced twice independently during this audit (Section B,
Section K): the literal string `"ASSISTANT"` is about to exist in two
semantically unrelated enums simultaneously. Future code must never branch
on `dailyReportTemplateType === "ASSISTANT"` as a proxy for `role ===
"ASSISTANT"`, or vice versa — they answer unrelated questions and will
usually, but not always, agree for the same person.

---

## Audit methodology note

This audit was produced by direct inspection of the performance domain
(Results, Execution Discipline, Role Responsibility, Professional
Contribution, Commercial Performance Target, the shared evaluator
authorization primitive, and the 25K/25K.1 dashboard/composition layer —
files this session had already worked in directly across Tickets
25H–25K.2), combined with four parallel research passes covering: the
full repository role-blast-radius grep (Section B, most of Section C),
finance authorization (Section D), user management/session/shell/navigation
(parts of Sections B, C, G), and historical-data/schema/migration mechanics
(Sections G, K). No file was created, edited, or deleted as part of this
audit's research; `git diff --check` was run against the one file this
ticket adds (this document itself).
