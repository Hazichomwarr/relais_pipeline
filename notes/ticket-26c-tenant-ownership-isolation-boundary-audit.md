# Ticket 26C — Tenant Ownership & Isolation Boundary Audit

Audit date: 2026-09-01. **Audit-only.** No Prisma schema changes, no
migrations, no runtime tenant filtering, no authorization changes, no
production writes. All database access performed for this audit was
read-only (schema inspection and code reading only — no live queries were
run; see §22 for why none were needed this time).

This document extends, and in several places supersedes, the ownership
findings of `notes/ticket-26a-multitenancy-domain-data-ownership-audit.md`
(2026-08-26). Two things changed since 26A that make a fresh pass
necessary rather than a restatement:

1. **26A's audit date predates the entire Performance domain.**
   `CommercialPerformanceTarget`, `RoleResponsibilityAssessment(+Item)`,
   and `ProfessionalContributionAssessment(+Item)` all shipped
   2026-08-28/29 (tickets 25H.2A/25I/25J), *after* 26A's 2026-08-26 audit.
   26A's model inventory explicitly counted "9 models" — none of these
   five existed yet. This document audits them for the first time.
2. **26B (implemented earlier this session) added `Organization` and
   `OrganizationMembership`.** `User` is now genuinely a global identity
   that may structurally hold memberships in more than one Organization;
   `User.role` remains sole runtime authorization authority;
   `OrganizationMembership.role` is a transactionally-synchronized shadow
   copy with zero authorization effect. This changes the shape of several
   26A findings — most importantly, every "derive tenancy from the current
   User" idea 26A floated is now confirmed structurally unsafe, because
   User is no longer even implicitly single-org.

Where 26A's findings are simply reconfirmed unchanged against current
code, this document cites 26A directly rather than re-deriving them from
scratch, and notes the file:line re-verification. Where 26C goes deeper
(exact attack-case mechanics, multi-ID write invariants, the Performance
domain, User administration) that is called out as new ground.

---

## Non-goals (ticket §71 — explicit)

This document does **not**: modify `prisma/schema.prisma`, create a
migration, add `organizationId` anywhere, change `User.role` or
`OrganizationMembership.role` authority, create an active-organization
runtime context, build organization switching, build onboarding, create
organizations, change auth/session, change any `require*`
authorization helper, tenant-filter any query, fix any bare-ID
vulnerability, modify production data, or touch unrelated feature work.
This is an architecture audit only, producing a map and a recommended
sequence for the tickets that follow.

---

## Executive summary

RELAIS CRM remains, at the database level, a clean single-tenant system
outside the `Organization`/`OrganizationMembership` foundation 26B just
added. Every one of the 14 pre-26B business/historical models still has
no tenant concept wired into its queries — this was already true per 26A
and remains true; 26B deliberately did not touch any of them (see 26B's
own doc, §9/§12). What's new in this audit:

1. **The Performance domain (5 models, unaudited until now) needs the
   same treatment as Prospect/Finance did in 26A, and it is worse in one
   specific way**: its "management" list queries
   (`listCommercialPerformanceTargetsForManagement`,
   `listRoleResponsibilityAssessmentsForManagement`, and the
   Professional Contribution equivalent) are **unscoped `findMany` calls
   with no `where` clause at all** — not aggregates, not IDOR-by-guessable-ID,
   but literal "return every row in the table" list views already reachable
   from real ADMIN/MANAGER screens. This is a more direct leak shape than
   most of 26A's P0 findings, which were at least gated by needing a
   specific ID.
2. **Same-User-two-Organizations contamination is a new, distinct risk
   class 26A could not have found**, because User wasn't confirmed
   structurally global until 26B. `commercial-results.service.ts`'s
   scoring pipeline filters credited wins by a bare `creditedUserId ===
   employeeId` — if the same global User ever holds credited wins in two
   different Organizations, this engine will **merge both organizations'
   wins into one score** with no `organizationId` predicate anywhere to
   prevent it. The same shape exists in
   `execution-discipline.service.ts`. This is qualitatively different
   from "Org A reads Org B's data" — it is "the same person's data from
   two different employers gets silently averaged together."
3. **`UserCreationActivity` and `UserStatusActivity` are genuinely
   ambiguous**, not merely under-scoped. Both currently describe an event
   on a *global* `User` row, but the fields they carry (`roleAtEvent`,
   the activation/deactivation transition itself) only make full sense as
   *organization-relative* facts once Membership exists. The code does
   not disambiguate today because there has only ever been one
   organization to provision into. This document flags both as
   **UNRESOLVED** per the ticket's own stop condition (§72) rather than
   picking an answer.
4. **User administration is the single most pervasive future-scoping
   surface in the codebase** — roughly 15 independent `prisma.user.*`
   call sites across nearly every domain (not just `/admin/users`) assume
   "querying `User` directly IS querying our people." None of them route
   through `OrganizationMembership`. This is one repeated pattern, not 15
   independent problems, but it touches almost every service file in the
   codebase.
5. **26A's Prospect/Finance/Daily-Report findings are reconfirmed
   unchanged** against current code (nothing in this codebase touched
   those paths between 26A and now), with one addition: the exact
   multi-ID write mechanics and attack-case invariants 26C's ticket asked
   for, which 26A described at a coarser grain.

The system still has exactly one operational tenant. Every finding below
is a **future multi-tenant isolation blocker**, not a currently
exploitable breach (per the severity note in §63 of the ticket).

---

## 1. The three concepts, frozen (ticket §1)

```text
TENANT OWNERSHIP   Which Organization owns this business record?
ATTRIBUTION         Which User performed / received / created / was
                     credited for something?
AUTHORIZATION       Is the current actor allowed to perform this
                     operation, right now?
```

These are independent axes. A single row can have all three answered
differently:

```text
ProspectActivity (WON_TRANSITION)
├── owned by Organization A                (tenant ownership)
├── creditedUserId → global User X         (attribution)
└── visible only if the current actor has  (authorization — role +,
    ADMIN/MANAGER authority                 later, same-org membership)
```

`creditedUserId` (or `assignedUserId`, `createdByUserId`,
`evaluatorUserId`, `subjectUserId`, `employeeUserId` — every "which User"
foreign key in this schema) **never determines tenant ownership**. Since
26B, `User` is confirmed global — a User may hold memberships in
Organization A and Organization B simultaneously, so "this row references
User X" says nothing about which Organization the row belongs to.
Ownership must come from the *business context that produced the row*
(the Prospect it's an activity of, the Organization the finance entry was
posted for, the assessment period it was created in) — never from a
referenced User's current or historical membership state. This is the
architectural invariant the ticket asks to freeze, and every
classification below follows it.

---

## 2. Classification framework (ticket §2)

- **A — Direct tenant-owned entity.** Should carry its own
  `organizationId`. Aggregate root, or independently queried/scoped often
  enough that deriving through a parent would be fragile or slow.
- **B — Tenant-owned through a durable parent.** May safely derive
  ownership through an immutable (or effectively immutable — enforced by
  invariant, not just convention) parent relation.
- **C — Global identity/reference entity.** Does not belong to one
  Organization. `User` is the confirmed example (26B).
- **D — Needs explicit architectural decision.** Does not fit cleanly;
  documented as unresolved rather than forced into A/B/C.

---

## 3. Complete model classification matrix (ticket §61, required)

All 16 current Prisma models. `Organization`/`OrganizationMembership`
are the tenant root and the tenant-relationship table themselves — they
don't get "classified" the same way their children do, so they're listed
first with a note instead of a category letter.

| Model | Category | Tenant owner | Ownership path | Direct `organizationId`? | Cross-tenant risk | Historical concern | Likely future ticket |
|---|---|---|---|---|---|---|---|
| `Organization` | *(root)* | — | — | — | Slug-collision only (already unique) | None | — |
| `OrganizationMembership` | *(linking table)* | — | — | Already has it (`organizationId`) | Membership-role divergence used as authority prematurely (26B guards against this) | None | — |
| `User` | **C — Global** | — (identity, not tenant-owned) | — | **No** | Roster queries assume User = "our people" (§8) | None — identity itself has no tenant history | User-administration ticket (§8) |
| `UserStatusActivity` | **D — Unresolved** | Ambiguous | Ambiguous | Undecided | Same tension as `UserCreationActivity` (§7) | `type`/`actorUserId`/`occurredAt` already frozen at event time | Same ticket as `UserCreationActivity` |
| `UserCreationActivity` | **D — Unresolved** | Ambiguous | Ambiguous | Undecided | Global `subjectUserId @unique` vs. org-relative `roleAtEvent` (§7) | `roleAtEvent`/`actorUserId`/`occurredAt` already frozen | Identity/membership-history redesign ticket |
| `PersonalNote` | **A — Direct** | Organization the note was written in | None (User is global, can't infer) | **Yes** | Currently 0 production rows (26A) | None yet — no cross-user feature exists | Notes tenant-scoping ticket (low priority, low risk) |
| `DailyReport` | **A — Direct, snapshotted** | Organization the report was authored for | None — `ownerUserId` alone insufficient once User is global | **Yes** | `findForManagement`/`listForManagement` unscoped (P0, reconfirmed) | `templateType` already snapshotted at creation; keep that discipline for `organizationId` too | Daily Report tenant-scoping ticket |
| `Prospect` | **A — Direct** | Organization the prospect belongs to | None — root | **Yes** | `getProspectById` bare-ID (P0, reconfirmed) | None — `assignedUserId` is a mutable pointer, not history | Prospect tenant-scoping ticket |
| `ProspectActivity` | **B — Parent-derived, denormalize anyway** | Via `Prospect`, IF "Prospect never changes org" becomes an enforced invariant | `prospectId` → `Prospect.organizationId` | **Recommend yes anyway** (query-safety/index reasons, not derivation-safety reasons) | Bare `getProspectActivities` (P0, reconfirmed) | `agentName`/`creditedUserId`/`creditedUserRoleAtEvent` already frozen — exemplary pattern | Same ticket as Prospect |
| `ProspectAction` | **B — Parent-derived for org axis; 4 User FKs need independent same-org checks regardless** | Via `Prospect` for org; NOT derivable for `assignedToUserId`/`createdByUserId`/`completedByUserId`/`canceledByUserId` | `prospectId` → `Prospect.organizationId` | **Recommend yes anyway** (same reasoning) | ADMIN/MANAGER override with **zero** prospect/org check (P0, reconfirmed verbatim — see §6) | History already `Restrict`-protected; terminal actions immutable | Same ticket as Prospect, but the override fix is its own P0 line item |
| `LedgerEntry` | **A — Direct** | Organization the entry was posted for | None — root, no parent | **Yes** | `findById`/`reverseAtomically` unscoped (P0, reconfirmed); every report aggregate unscoped (§9) | Reversal pairs must never span two Organizations (no DB-expressible constraint) | Finance tenant-scoping ticket |
| `CommercialPerformanceTarget` | **A — Direct** | Organization the target was set for | None — no parent | **Yes** | `listCommercialPerformanceTargetsForManagement` fully unscoped `findMany` (P0, new finding); update/delete bare-ID (P0) | `roleAtAssignment`/`createdByRoleAtEvent` already frozen | Performance-domain tenant-scoping ticket |
| `RoleResponsibilityAssessment` | **A — Direct** | Organization the assessment was created in | None — no parent | **Yes** | `getRoleResponsibilityAssessmentDetail` bare-ID full read (P0, new); mutate/submit/delete bare-ID (P0, new); management list fully unscoped (P0, new) | `roleAtEvaluation`/`evaluatorRoleAtEvent`/item-level `*AtEvaluation` snapshots already frozen | Same ticket |
| `RoleResponsibilityAssessmentItem` | **B — Parent-derived** | Via `RoleResponsibilityAssessment` | `assessmentId` (Cascade — true owned child, never reassignable) | No — safe to derive | Inherits parent's risk | Full catalog-content snapshot (`anchorsSnapshot` etc.) already frozen | Same ticket |
| `ProfessionalContributionAssessment` | **A — Direct** | Organization the assessment was created in | None — no parent | **Yes** | Identical shape to Role Responsibility (P0, new) | Same snapshot discipline already in place | Same ticket |
| `ProfessionalContributionAssessmentItem` | **B — Parent-derived** | Via `ProfessionalContributionAssessment` | `assessmentId` (Cascade) | No — safe to derive | Inherits parent's risk | Same as above | Same ticket |

Non-model reference data (enums/code catalogs) is addressed separately in
§10, since the ticket's classification framework applies to it too but it
isn't a Prisma model.

---

## 4. `Organization` & `OrganizationMembership` themselves

Nothing to audit for cross-tenant risk here — these tables *are* the
tenant boundary. The one relevant note: `OrganizationMembership.role` is
schema-present but authorization-inert (26B, confirmed by two regression
tests in `authorization.service.test.ts` this session). Every subsequent
finding in this document assumes that continues to hold until an
explicit later ticket switches authority — 26C does not touch it.

---

## 5. `User`, `UserStatusActivity`, `UserCreationActivity` — identity and the unresolved historical-event question

### 5.1 `User` — confirmed global (Category C)

No `organizationId` on `User`, by design (26B, reaffirmed here). A User's
tenant relationships live entirely in `OrganizationMembership` rows.
Nothing in this audit found any reason to revisit that.

### 5.2 `UserCreationActivity` and `UserStatusActivity` — UNRESOLVED (ticket §12, §72 stop condition)

Both models currently describe an event on a *global* `User` row:

- `UserCreationActivity`: `subjectUserId` (**globally** `@unique` — one
  creation fact per subject for their entire lifetime), `actorUserId`,
  `roleAtEvent: UserRole`, `occurredAt`. Written inside the same
  transaction as `User.create` and (as of 26B) the RELAIS
  `OrganizationMembership.create` — `user-creation-history.service.ts`.
- `UserStatusActivity`: `userId`, `type` (`ACTIVATED`/`DEACTIVATED`),
  `actorUserId`, `occurredAt`. Written whenever `User.active` flips
  (`user.service.ts`'s `dependencies.update`).

**Evidence for "global identity creation/status history" (possibility
A, per ticket §12):**

- `UserCreationActivity.subjectUserId @unique` is a **global** constraint.
  If this event meant "Organization X provisioned this account," a User
  later invited into a second Organization would need a *second*
  `UserCreationActivity` row — the schema's global-unique constraint
  structurally forbids that today.
- The original 25C code comment (unchanged) calls this "the authoritative
  persistence boundary for authenticated user creation" — phrased as an
  account-creation event, not an org-membership event.
- `User.active` (which `UserStatusActivity` records transitions of) has
  always been described (26A §26) as potentially meaning "this login can
  authenticate at all, across any organization" — a global-identity
  concept, not a membership concept.

**Evidence for "organizational administrative event" (possibility B):**

- `roleAtEvent: UserRole` only fully makes sense as "the role this person
  was given," and role is organization-relative going forward
  (`OrganizationMembership.role`, per 26B). The 26B doc itself reframes
  membership's `role` as "the user's role within *that organization*."
- In current practice, creating a `User` row and creating their RELAIS
  `OrganizationMembership` are now (post-26B) the *same atomic
  transaction*, always, unconditionally — because there's only one
  organization to provision into. The two concepts have never been
  separated in code, so the code alone cannot disambiguate which meaning
  was intended.
- `actorUserId` is "the admin who did this" — in a genuine multi-org
  future, that admin acts *as a member of a specific organization*, so
  the event reads naturally as "Org X's admin brought this person into
  Org X."

**What this means concretely:** does a future "invite an existing User
into a second Organization" flow get its own,
`OrganizationMembership`-scoped creation-event model (leaving
`UserCreationActivity` as pure global-identity history — reading A)? Or
does `UserCreationActivity` itself need to become per-membership
(dropping the global `subjectUserId @unique` in favor of
`@@unique([subjectUserId, organizationId])` — reading B)? Both are
structurally live options against the current schema. **Per the ticket's
own stop condition, this document does not pick one.**

```text
UNRESOLVED — UserCreationActivity / UserStatusActivity
Current semantics: an event on a global User row, but populated with
  fields (role, active) that are organization-relative concepts once
  Membership exists.
Why ambiguous: creating a User and provisioning their (only) Organization
  membership are currently the same atomic act, so no code path has ever
  needed to distinguish "global account event" from "membership event."
Possible options: (A) keep both models global-identity-only, add a
  separate per-membership creation/status-event model for future
  multi-org provisioning; (B) make both models per-membership
  (organizationId + revised uniqueness), losing the "one creation fact
  per lifetime" guarantee; (C) some hybrid — a global "account created"
  fact plus a per-membership "provisioned into Org X" fact.
Decision needed from: whoever designs the future identity/membership
  history redesign ticket (26A §6/§28 already flagged this as requiring
  "reinterpretation, not modification" — 26C confirms it goes further:
  reinterpretation requires an actual design decision, not just a label
  change).
What's blocked: any future "same person, two organizations" creation-
  history or activation-history feature.
```

Do not backfill or infer retrospective per-organization creation/status
history where none was recorded — per ticket §36/§65, this document does
not invent membership dates that were never captured.

### 5.3 Snapshot fields remain historically correct either way

Regardless of how the above resolves, `UserCreationActivity.roleAtEvent`
and every performance-domain role snapshot
(`roleAtAssignment`/`createdByRoleAtEvent`/`roleAtEvaluation`/
`evaluatorRoleAtEvent`) are written exactly once, at row-creation time,
never re-derived from a live `User`/`OrganizationMembership` relation on
read (confirmed across every read this session). They remain correct
historical facts under any future org-scoping, **provided a future
migration never attempts to backfill or reinterpret them from current
`OrganizationMembership.role`.** This is the same invariant 26B already
froze for its own backfill and must be honored by every domain, not
re-decided per model.

---

## 6. User administration — the most pervasive future-scoping surface (ticket §13-15, new ground)

Every `prisma.user.findMany`/`findUnique`/`update`/`create` call site in
the codebase currently assumes **User itself is a RELAIS employee** —
there is nothing to filter by yet, so nothing filters. This is not
confined to `/admin/users`; it is the single most repeated pattern in
the entire codebase:

| File:line | Query | Roster or single-record? |
|---|---|---|
| `src/services/user.service.ts:78` (`getUserById`) | `findUnique({where:{id}})` | Single, bare ID |
| `src/services/user.service.ts:80`/`app/admin/users/page.tsx:22` (`listUsers`) | `findMany`, filtered only by `active` | **Roster — the literal `/admin/users` admin table** |
| `src/services/user.service.ts:120` (`listAssignableUsers`) | `findMany({role:"COMMERCIAL", active:true})` | Roster |
| `src/services/user.service.ts:137` (`listDashboardUserOptions`) | `findMany` (OR condition) | Roster |
| `src/services/user.service.ts:167` (`listActiveUsersForTaskAssignment`) | `findMany` | Roster |
| `src/services/user.service.ts:190` (`listCommercialResultsTargetEligibleUsers`) | `findMany` | Roster |
| `src/services/daily-report.service.ts:100,239,279` | `findUnique`/`findMany` | Both |
| `src/services/role-responsibility-assessment.service.ts:40,286` | `findUnique`/`findMany` | Both |
| `src/services/professional-contribution.service.ts:37,188` | `findUnique`/`findMany` | Both |
| `src/services/commercial-performance-target.service.ts:25` | `findUnique` | Single |
| `src/services/commercial-results.service.ts:35`, `execution-discipline.service.ts:25`, `performance-summary.service.ts:107`, `commercial-dashboard.service.ts:19` | `findUnique` | Single |
| `src/services/commercial-access.service.ts:8`, `account-access.service.ts:8` | `findUnique` (session re-verification) | Single |
| `src/services/prospect-action.service.ts:110`, `prospect-follow-up.service.ts:89` | `findUnique` (assignee validation) | Single |
| `src/services/auth-credentials.service.ts:18,72,91` | `findFirst`/`update`/`findUnique` (login, password) | Single |
| `scripts/*.ts` (5 scripts, per 26A §35-36) | Various | Both — maintenance/genesis, already flagged by 26A as needing explicit org selection later |

**Future shape, one pattern for all ~15 roster call sites:**

```ts
// today
prisma.user.findMany({ where: { role: {...} } })

// future
prisma.organizationMembership.findMany({
  where: { organizationId, role: {...} },
  include: { user: {...} },
})
```

This is worth planning as **one future ticket's shape**
("membership-scoped roster queries," replacing every `prisma.user.*`
roster call with the equivalent `organizationMembership` query), not one
ticket per service — the transformation is mechanically identical at
every site.

### 6.1 Role-edit and user-creation already hardcode "the org" (26B, documented concern for later)

Both mutation paths 26B modified — `user.service.ts`'s role-sync and
`user-creation-history.service.ts`'s creation — resolve the target
organization via `resolveRelaisOrganizationId`, a **hardcoded slug
lookup**, unconditionally. This is correct and sufficient today (RELAIS
is the only organization), but:

- Once `User.role` authority retires in favor of
  `OrganizationMembership.role` (an explicit later ticket, not this one),
  a role edit will need to target a *specific* membership
  (`organizationId` + `userId`), not "the" RELAIS membership — the
  current code has no way to represent "edit this User's role in Org B"
  at all.
- Once admin-initiated creation can target any organization, creation
  will need to accept an explicit `organizationId` parameter instead of
  resolving RELAIS internally.

Both are **documented future migration concerns, not defects to fix
now** — flagging them here satisfies the ticket's instruction not to let
tempting "small cleanups" slip into an audit-only ticket.

---

## 7. Prospect domain — assignment and action attack cases (ticket §4-9, deepened)

### 7.1 `Prospect.assignedUserId` — every write path, confirmed

Exactly two paths write it, and there is **no live reassignment feature**
today:

- **Creation** (`prospect-creation.service-core.ts`, `buildProspectData`)
  always sets `assignedUserId: actor.id` — never client-supplied — gated
  by `canOwnProspect`/`PROSPECT_OWNER_ROLES` (`ADMIN`, `COMMERCIAL`,
  `MANAGER`).
- **Historical batch reassignment**
  (`prospect-owner-reconciliation.ts`, invoked only by the gated
  `scripts/reconcile-prospect-owners.ts`) validates each candidate `userId`
  by role (`COMMERCIAL`) only — nothing else — and is a one-time gated
  migration script, not a reachable live mutation.
- Confirmed: no component exposes `assignedUserId` as an editable field;
  `src/actions/prospect.actions.ts`'s own comment states assignment is
  "the prospect's Commercial, never a client-supplied assignedUserId."

**Future invariant, once a live reassign feature exists** (the ticket's
literal `assignProspect({ prospectId, assignedUserId })` example):

```text
actor's organization
=
prospect.organizationId
=
(assignedUserId's OrganizationMembership).organizationId
```

None of these three legs exist to check today — this is pure future
work, not a live gap, because there is no live reassignment path to
attack.

### 7.2 `ProspectAction` — multi-ID writes and the confirmed P0 override

| Operation | IDs combined | File:line | Future same-tenant invariant |
|---|---|---|---|
| Create | `prospectId` + `assignedToUserId` | `prospect-action.service-core.ts:170-224`, assignee resolved via bare `tx.user.findUnique` (`prospect-action.service.ts:109-113`) | `assignedToUserId`'s membership org must equal the prospect's (and actor's) org at assignment time |
| Complete | `actor.id` + `action.assignedToUserId` | `prospect-action.service-core.ts:298-357` | Actor's org must equal the action's (prospect's) org |
| Cancel | `actor.id` + `action.createdByUserId`/`action.assignedToUserId` | `prospect-action.service-core.ts:373-437` | Same |

**The ADMIN/MANAGER override — reconfirmed verbatim against current
code, unchanged since 26A, still P0:**

```ts
// prospect-action.service-core.ts:48-57
export function canCompleteProspectAction(actor, action) {
  return (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER" ||
    actor.id === action.assignedToUserId
  );
}
// prospect-action.service-core.ts:63-73
export function canCancelProspectAction(actor, action) {
  return (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER" ||
    actor.id === action.createdByUserId ||
    actor.id === action.assignedToUserId
  );
}
```

Role + identity only — zero prospect-ownership or organization check —
compounded by `completeProspectAction`/`cancelProspectAction`
(`prospect-action.service.ts:141-144,153-154`) calling
`prisma.prospectAction.findUnique({ where: { id } })` with **no scope at
all**. Once IDs from two tenants coexist, an Org A ADMIN/MANAGER can
complete or cancel *any* Org B action by ID alone — this remains the
single clearest cross-tenant write risk in the codebase, exactly as 26A
found it, and it must gain an implicit same-organization constraint on
the override itself, not just on the surrounding route gate.

`submitProspectFollowUp`'s outer `Prospect` lookup is correctly scoped
(`buildProspectWhere`); the nested `prospectAction.findUnique({where:
{id: actionId}})` (`prospect-follow-up.service.ts:72-76`) and the nested
assignee lookup (line 88-92) remain bare, trusting the already-scoped
prospect's own UI — reconfirmed unchanged.

### 7.3 WON attribution

`resolveWonCredit` (`prospect-won-transition.service-core.ts:55-71`)
resolves credit purely from the `WonCreditSource` passed in by the
caller — required by the file's own comment to be read "inside the same
transaction as the WON transition itself" — with no fallback to the
acting user. Confirmed frozen at event time, never re-derived on read.

**The query boundary that will need an organization filter is a single,
identifiable entry point**: `getCommercialResultsForEmployee`
(`src/services/commercial-results.service.ts:31-58`)'s
`prisma.prospectActivity.findMany({ where: { type: "WON_TRANSITION",
occurredAt: {...} } })` — deliberately company-wide *within the period*
today (needed for `legacyUnattributedWinsInPeriod`), with per-employee
filtering done afterward in pure logic. Once a second organization's
`WON_TRANSITION` rows exist in the same table, this single query pulls
them in indiscriminately unless it gains an organization filter — see
§9 for why this is actually a P1/P0 scoring-contamination risk, not just
a read-scope gap.

---

## 8. Daily Reports

- `templateType` is correctly snapshotted at creation (unchanged from
  26A, reconfirmed at `daily-report.service.ts:135-147`, sourced from
  `getOwnDailyReportTemplateType` at creation time only).
- Owner-scoped reads (`findOwnByDate`/`findOwnById`/`listOwn`) filter by
  `{ownerUserId}`/`{id, ownerUserId}` — a safe pattern *today*, but
  **insufficient alone once User is confirmed global**: a User holding
  memberships in two Organizations would need `{ownerUserId,
  organizationId}`, or a report from Org A could surface under a "my
  reports" query scoped only by that same person's Org B session. This
  is a new, sharper framing than 26A could give (26A predates the
  confirmed-global-User finding from 26B).
- `findForManagement`/`listForManagement` remain bare-ID / no-mandatory-
  tenant-filter (P0, reconfirmed unchanged).
- No `DailyReportTemplate` model exists — `templateType` is purely a
  compiled enum column, reconfirmed.

## 9. Notes

Reconfirmed unchanged: every `personal-note.service.ts` operation is
`{userId}`-scoped or `{id, userId}`-scoped, zero cross-user read path,
zero production rows. Lowest-risk domain in the audit — the eventual fix
is additive (`{userId, organizationId}`), not a retrofit of an existing
cross-user feature.

---

## 10. Finance domain

### 10.1 `LedgerEntry` is the canonical finance tenant root

No parent relation of any kind (`createdByUserId` is attribution, not
ownership; `reversalOfId` is a self-relation). Every query roots directly
on `prisma.ledgerEntry.*`. **Direct `organizationId` needed** — nothing
to derive it from.

### 10.2 Reversal attack case, precisely stated

`reverseAtomically` (`financial-ledger.service.ts:182-201`), one
`$transaction`:

1. `tx.ledgerEntry.updateMany({where:{id:originalId, status:"POSTED"},
   data:{status:"REVERSED"}})` — the `status:"POSTED"` guard in the
   `where` is what prevents concurrent double-reversal (zero `count` ⇒
   throw, abort).
2. `tx.ledgerEntry.create({...reversalFields, createdByUserId:
   reversedByUserId, reversalOfId: originalId})`.

The original is fetched earlier, unscoped, via `getLedgerEntryById`.

**Future same-tenant check, stated precisely**: before calling
`reverseAtomically`, verify `original.organizationId === actor's
organizationId`; make `reverseAtomically`'s own `updateMany` `where`
clause **also** include `organizationId: expectedOrganizationId` (an
org-aware guard, not just a pre-check an attacker could race); the
created reversal row must inherit `organizationId: original.organizationId`,
never independently supplied. No DB constraint can express
"`reversalOf.organizationId === entry.organizationId`" — this is
necessarily an application-enforced invariant (ticket §52's DB-vs-app
distinction, concretely instantiated).

### 10.3 Bare-ID lookups

- `getLedgerEntryById` (`financial-ledger.service.ts:160-180`) —
  `findUnique({where:{id}})`, no scope.
- `app/finances/ledger/[entryId]/page.tsx:31` calls it from a raw route
  param, gated only by the coarse `requireFinanceAccess()` layout check
  — zero resource-level scope.
- The same detail page renders **bare-ID navigation links** to
  `reversalOfId`/`reversedById` (`page.tsx:73,86`) — a guessed/obtained
  foreign reversal-pair ID is directly clickable.
- `reverseAtomically`'s `originalId` lookup/update — same pattern, on the
  write path.

### 10.4 Every aggregate/report query — none has a tenant filter, and they share one upstream boundary

- `listForSummary` (`financial-ledger.service.ts:203-223`) feeds both
  gross and effective/net dashboard totals.
- `list` (`financial-ledger.service.ts:146-158`) feeds the `/finances`
  ledger table **and** is reused wholesale by `getFinancialReport`
  (`financial-report.service.ts:29`) as the raw row source for **every**
  `/finances/reports` breakdown (product revenue, expense categories,
  payment methods, daily movement — all pure in-memory reducers over
  whatever rows the caller hands them).
- This is good news for the eventual fix: scoping `list`/`listForSummary`
  once (as a **mandatory, non-optional** `organizationId` parameter, not
  an optional filter alongside `product`/date range) fixes the live
  ledger table, the dashboard cards, and all four report breakdowns
  simultaneously. Missing it once breaks all of them simultaneously —
  this is one shared boundary, not five independent ones.

### 10.5 Uniqueness

`LedgerEntry.reference` has **no** `@unique`/`@@unique` today — free
text. If a future ticket ever makes it unique (external-system
reconciliation), it must be tenant-relative
(`@@unique([organizationId, reference])`) — two Organizations will
legitimately reuse the same reference numbering.

### 10.6 Multi-ID write invariant

`createLedgerEntry(createdByUserId, input)` writes `createdByUserId`
with no target-organization parameter today (nothing to target).
Future invariant: the entry's `organizationId` must equal the actor's own
membership organization at write time.

---

## 11. Performance domain (new ground — first audit of these 5 models)

### 11.1 `CommercialPerformanceTarget`

Fields: `userId, periodStart, periodEnd, targetWins, roleAtAssignment,
createdByUserId, createdByRoleAtEvent`. No parent → **direct
`organizationId`**. `roleAtAssignment`/`createdByRoleAtEvent` already
frozen snapshots (`commercial-performance-target.service-core.ts:292,294`)
— remain correct historical facts under future org-scoping.

- **Uniqueness**: `@@unique([userId, periodStart, periodEnd])` must
  become `[organizationId, userId, periodStart, periodEnd]` — otherwise
  the same global User with memberships in two orgs cannot have
  independent targets for the same month in each.
- **Bare-ID, P0**: `update`/`delete` in `commercial-performance-target.service.ts:52,64,78,83`
  resolve by bare `id`.
- **P0, new finding**: `listCommercialPerformanceTargetsForManagement`
  (`commercial-performance-target.service.ts:124`) is a **fully unscoped
  `findMany` with no `where` clause at all** — returns every target
  company-wide, directly reachable from the real management UI.
- **Multi-ID write**: `input.userId` (subject) + `actor.id` (creator),
  zero same-org check today. Future invariant: actor's org == subject's
  membership org == target's org.

### 11.2 `RoleResponsibilityAssessment` (+ `Item`)

No parent → **direct `organizationId`** on the assessment; `Item`
safely **derives** via `assessmentId` (Cascade, true owned child, never
reassignable). `roleAtEvaluation`/`evaluatorRoleAtEvent` and the item's
full catalog-content snapshot (`labelAtEvaluation`, `anchorsSnapshot`,
etc.) already frozen at creation — exemplary pattern, matches
`agentName`'s treatment elsewhere.

- **Uniqueness**: `@@unique([employeeUserId, periodStart, periodEnd])`
  → `[organizationId, employeeUserId, periodStart, periodEnd]`. Item's
  `@@unique([assessmentId, responsibilityKey])` is already tenant-safe
  via its parent.
- **P0, new finding, most severe in this domain**: every one of these is
  a **bare `findUnique({where:{id}})` with no org check**, all in
  `role-responsibility-assessment.service.ts`:
  - `:97` `findAssessment` (used by the mutate-item action)
  - `:102` `findItem`
  - `:136` `findAssessmentWithItems` (submit)
  - `:159` `findAssessment` (delete)
  - `:204` `getRoleResponsibilityAssessmentDetail` — **full read**,
    directly reachable from the admin detail route
  - `:182` `listRoleResponsibilityAssessmentsForManagement` — filtered
    only by role (`roleAtEvaluation: "COMMERCIAL"` for MANAGER actors);
    for an **ADMIN actor, no filter at all** — every organization's
    assessments merged into one list
  - `:286` `listEligibleEmployeesForRoleResponsibilityAssessment` —
    unscoped `prisma.user.findMany`

  Together: an Org A ADMIN can **read, mutate, submit, and delete** an
  Org B assessment purely by guessing/enumerating its id, and the
  management list hands over every organization's assessments unasked.
  This is a strictly worse shape than most of 26A's P0 findings (which
  needed a specific ID at minimum) — here the list view alone leaks
  everything.

### 11.3 `ProfessionalContributionAssessment` (+ `Item`)

Structurally the near-exact twin of §11.2 — confirmed identical
bare-lookup shape at the equivalent line numbers in
`professional-contribution.service.ts` (its own model comment states it
"shares... the evaluator-authorization rule, reused because it is
genuinely identical"). Same findings, same severity, substitute
`employeeUserId`/`traitKey` for the Role Responsibility equivalents.

### 11.4 No manager-of-employee hierarchy — confirmed, still true, same shape as ProspectAction's P0

`role-responsibility-assessment.service-core.ts`,
`employee-assessment-authorization.ts`, and
`commercial-performance-target.service-core.ts` all state consistently:
MANAGER/ADMIN authority across the entire Performance domain is
**organization-wide, not team-scoped** — there is no manager-of-employee
assignment concept anywhere. Exactly like §7.2's `ProspectAction`
finding: once a second organization exists, this blanket role-based
authority must gain an **implicit same-organization constraint** at
every call site in this domain (target management, both assessment
domains, the performance dashboard) — a role check alone
(`ADMIN`/`MANAGER`) will otherwise authorize action against any
organization's data.

### 11.5 Aggregate/scoring-engine risk — the highest-severity finding in this domain, and genuinely new

**`getCommercialResultsForEmployee`**
(`src/services/commercial-results.service.ts:31-67`): the root
`prisma.prospectActivity.findMany` filters only by `type:
"WON_TRANSITION"` and the period — **fully unscoped by organization or
even by prospect**, deliberately (the pure core needs the full
period-wide pool for `legacyUnattributedWinsInPeriod`). Consequences:

- `legacyUnattributedWinsInPeriod` would silently **combine both
  organizations'** unattributed-WON counts the moment Org B exists — a
  direct aggregate leak surfaced straight into a scored, dashboard-visible
  result.
- More seriously: `creditedWins` is filtered by `creditedUserId ===
  employeeId` against a **global** `User.id`. If the same global User
  ever holds credited wins in two different organizations (structurally
  possible post-26B), this engine **merges both organizations' wins into
  one score** — nothing anywhere in this pipeline distinguishes which
  organization a win happened in. This is a genuine same-user-two-orgs
  contamination risk, categorically different from a different-users
  leak, and one 26A could not have identified (it predates the
  confirmed-global-User finding).

`computeCommercialExecutionDisciplineScore`
(`execution-discipline.service.ts:21-49`) is comparatively safer — its
`prisma.prospectAction.findMany` is Prisma-scoped to `assignedToUserId:
employeeId`, so it cannot merge *other users'* data — but it carries the
identical "same global User, two orgs" contamination risk, since
`assignedToUserId` alone doesn't distinguish which organization those
actions belonged to.

`getEmployeePerformanceSummary` (`performance-summary.service.ts:102-173`)
composes all four dimensions with its own bare `prisma.user.findUnique`,
gated only by `canViewEmployeePerformance` (role-only) — the
organization-wide-authority risk applies to the whole composed
dashboard.

### 11.6 Authorization helpers used here — confirmed role-only, unaffected by 26B

`COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES`,
`ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES`,
`PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES`,
`PERFORMANCE_DASHBOARD_ACCESS_ROLES` — all `["ADMIN","MANAGER"]`, none
read `OrganizationMembership.role` or any org concept.

### 11.7 The catalogs themselves — same shape as the Products question

`role-responsibility-catalog.ts` / `professional-contribution-catalog.ts`
are hardcoded, versioned **code** constants, not DB rows — by explicit
design (the catalog file's own comment: "static versioned code
definitions may be safer for V1"). This is structurally the same
question as Products (§12): a compiled, RELAIS-specific policy baked
into code rather than tenant-configurable data. Flagged here as
**Category D**, in the same bucket as Products, not resolved.

---

## 12. Products / reference data / enums — global vs. tenant-owned, decision framework (ticket §25-26)

26A's §11 finding (RelaisProduct is a compiled enum, not a `Product`
model — reconfirmed unchanged this session: `product-directory.ts` still
hardcodes exactly 4 entries, no `Product` table exists) is the seed of a
broader pattern this document now generalizes across every enum/code
catalog with RELAIS-specific content:

| Reference data | Current shape | Classification | Why |
|---|---|---|---|
| `RelaisProduct` (KARMDA/LOKARI/NIA/DIGITAL_SERVICES) | Compiled enum + hardcoded per-product routes/components/wide-table columns | **D — Unresolved** | A future customer's product catalog cannot be represented without a code change today; deciding GLOBAL vs. ORGANIZATION-OWNED vs. hybrid is a large, separate workstream (26A §11, ranked P1) |
| `LedgerEntryCategory` (chart of accounts) | Compiled enum | **D — Unresolved** | Same shape — a different customer's chart of accounts needs different categories |
| `DailyReportTemplateType` | Compiled enum, no `DailyReportTemplate` model | **D — Unresolved** | Same shape |
| `PersonalNoteCategory.RELAIS_IDEA` | One RELAIS-specific value baked into an otherwise-generic enum | **D — Unresolved (narrow)** | Smaller instance of the same problem — a single value, not the whole enum |
| `role-responsibility-catalog.ts` / `professional-contribution-catalog.ts` | Hardcoded code catalogs (§11.7) | **D — Unresolved** | Same shape, code instead of enum |
| `InterestLevel`, `ProspectStatus`, `FollowUpAction`, `OnlinePresence`, `ProspectActivityType`, `ProspectConversionOutcome/Reason`, `ProspectActionStatus`, `UserRole`, assessment-status/level enums, `LedgerEntryType/Status`, `PaymentMethod` | Compiled enums, but describe **generic CRM/finance/HR concepts**, not RELAIS-specific taxonomy | **Global system reference** | A "won/lost" pipeline stage, a payment method, a DRAFT/SUBMITTED lifecycle — these are domain-generic, reasonable to keep global even for a hypothetical customer #2, unlike a specific product list or chart of accounts |

**Do not tenantize any of the "D — Unresolved" reference data mechanically.**
The distinguishing test applied above (ticket §26): is this enum a
**generic domain concept** any CRM/finance system would have (global), or
is it **RELAIS's own specific taxonomy** compiled into code (needs a
decision)? Every row in the "D" bucket failed that test; every row in the
"Global" bucket passed it.

---

## 13. Dashboard aggregates

Reconfirmed unchanged against current code (26A §19, §27):

- `getProspects`/`app/admin/page.tsx`'s `KpiCards` — `prisma.prospect.findMany({where: buildProspectWhere(filters)})`
  (`prospect.service.ts:47`), no owner/tenant restriction by default —
  matches the expected "organization-wide" semantics but has no
  organization filter to add one to yet.
- `CommercialKpiCards` — already scoped to the authenticated commercial's
  own prospects (personal-ownership pattern, see §14).
- Sales funnel/why analytics (`sales-funnel-analytics.service.ts:46,58`,
  `sales-why-analytics.service.ts:37`) — unscoped root queries, plus
  `filters.product`/`filters.ownerUserId` spliced directly into the
  `where` clause with **no validation** that the value is in-scope
  (26A §18). Once orgs coexist, both the base query and every secondary
  filter value need independent scope validation — a filter alone, with
  no other exploit, could otherwise probe or select another org's data
  if base-query scoping is ever missed on one code path.

---

## 14. Shared updates feed (`/updates`)

`getSharedFeed` (`src/services/shared-feed.service.ts`) merges **five**
independently unscoped source queries (26A counted four; the current
code has five — `findRecentUserCreationEvents` sourced from
`userCreationActivity` is present alongside the other four):

```text
prisma.prospectActivity.findMany  (interaction types)   — shared-feed.service.ts:48-54
prisma.prospectActivity.findMany  (FOLLOW_UP)            — shared-feed.service.ts:55-61
prisma.prospectActivity.findMany  (WON_TRANSITION)       — shared-feed.service.ts:62-68
prisma.userStatusActivity.findMany                       — shared-feed.service.ts:69-80
prisma.userCreationActivity.findMany                     — shared-feed.service.ts:81-92
```

None has any filter beyond its event-type discriminator. This remains
the single largest cross-tenant leak surface by blast radius (26A §17):
adding Organization B today would put Org B's every follow-up, WON
event, user activation, and user creation directly into Org A's
`/updates` feed unless all five queries gain an organization predicate
**simultaneously**. Because the feed is a pure read-time projection with
no stored state of its own, the fix is mechanically simple (add one
`where` clause to each of five queries) once every source model carries
`organizationId` — but partial scoping (four of five) would look fixed
while still leaking one event family.

---

## 15. Follow-up queue, "Mes prospects," "Mes notes/rapports" — personal ownership ≠ tenancy

`prospect-action-queue.service-core.ts` threads `role: UserRole` through
to decide unscoped-vs-owner-scoped query shape, with no org concept
(26A, reconfirmed). `admin-my-prospects.service-core.ts`'s
`buildProspectWhere({...filters, userId: adminId})` (line 19) and
`commercial-prospect.service.ts`'s equivalent are the concrete
`assignedUserId = currentUser.id` pattern the ticket's §30 warns about:
**this is not tenancy**. If a User someday holds memberships in two
Organizations, this query would merge both organizations' "my
prospects" into one list. Every "my ___" page in the codebase (My
Prospects, My Notes, My Reports) shares this exact shape — personal
ownership (`userId = me`) and tenant scope (`organizationId =
activeOrganization`) are independent filters, and today only the first
one exists anywhere.

---

## 16. Consolidated bare-ID query inventory (ticket §32, §56)

Every bare-ID lookup on a tenant-owned model found across this audit and
26A, in one place:

| Model | Operation | File:line | Scoped today? |
|---|---|---|---|
| Prospect | `getProspectById` | `prospect.service.ts:58` (26A) | No |
| Prospect | `getProspectActivities` | `prospect-activity.service.ts:20` (26A) | No |
| ProspectAction | `listProspectActionsForProspect` | `prospect-action.service.ts:165` (26A) | No |
| ProspectAction | `completeProspectAction`/`cancelProspectAction` | `prospect-action.service.ts:141-144,153-154` | No |
| ProspectAction | nested lookup in `submitProspectFollowUp` | `prospect-follow-up.service.ts:72-76,88-92` | No (outer Prospect lookup is scoped) |
| DailyReport | `findForManagement` | `daily-report.service.ts:183-190` | No |
| LedgerEntry | `getLedgerEntryById` / `reverseAtomically` original | `financial-ledger.service.ts:160-180,184-187` | No |
| LedgerEntry | ledger detail page | `app/finances/ledger/[entryId]/page.tsx:31` | No |
| CommercialPerformanceTarget | update/delete | `commercial-performance-target.service.ts:52,64,78,83` | No |
| RoleResponsibilityAssessment | detail/mutate-item/submit/delete | `role-responsibility-assessment.service.ts:97,102,136,159,204` | No |
| ProfessionalContributionAssessment | equivalent set | `professional-contribution.service.ts` (mirrors above) | No |
| User (roster queries) | ~15 call sites | §6 table | No — global by construction |

Not every bare-ID lookup is automatically broken (some safely inherit an
already-scoped parent, per 26A's own caveat) — but every one above was
individually checked and confirmed unscoped at the point it resolves the
resource, with authorization (where present) being role-only.

## 17. Consolidated compound-ID mutation inventory (ticket §33)

| Write | IDs combined | Future same-tenant invariant |
|---|---|---|
| ProspectAction create | `prospectId` + `assignedToUserId` | Both must resolve to the same org as the actor |
| ProspectAction complete/cancel | `actor.id` + `action.assignedToUserId`/`createdByUserId` | Actor's org == action's (prospect's) org |
| ProspectAction ADMIN/MANAGER override | role only, no ID | Needs an *added* same-org check, not just a role check |
| CommercialPerformanceTarget create | `input.userId` + `actor.id` | Actor's org == subject's membership org == target's org |
| RoleResponsibilityAssessment / ProfessionalContributionAssessment create | `employeeUserId` + `evaluatorUserId` (`actor`) | Subject, evaluator, and the assessment's org must all agree |
| LedgerEntry create | `createdByUserId` | Actor's org == entry's target org |
| LedgerEntry reverse | `originalId` (self-relation) + `actor.id` | `original.organizationId === actor's organizationId`; reversal inherits original's org |
| User creation (26B) | `actorUserId` + hardcoded RELAIS org | Will need an explicit target `organizationId` param once >1 org exists (§6.1) |
| User role edit (26B) | `userId` + hardcoded RELAIS org | Same |

---

## 18. Cross-tenant attack matrix (ticket §34, §66, required)

| Category | Concrete case | Current vulnerability | Future invariant |
|---|---|---|---|
| READ | Org A reads Prospect B by ID | `getProspectById` bare (26A) | `where: {id, organizationId}` |
| READ | Org A reads a Role Responsibility assessment B by ID | `getRoleResponsibilityAssessmentDetail` bare (new) | Same |
| READ | Org A reads LedgerEntry B by ID | `getLedgerEntryById` bare | Same |
| LIST | Org A's `/updates` includes Org B's events | 5 unscoped source queries (§14) | Filter all 5 simultaneously |
| LIST | Org A's performance-target/assessment management screens include Org B's rows | Fully unscoped `findMany` (§11) | Mandatory `organizationId` filter |
| LIST | Org A's `/admin/users` lists Org B's people | `listUsers()` global (§6) | Membership-scoped roster query |
| UPDATE | Org A updates/deletes CommercialPerformanceTarget B | Bare-ID update/delete (§11.1) | Scope check before mutate |
| UPDATE | Org A submits/mutates RoleResponsibilityAssessment B | Bare-ID mutate/submit (§11.2) | Same |
| DELETE | Org A deletes RoleResponsibilityAssessment B | Bare-ID delete (§11.2) | Same |
| ASSIGN | Org A ProspectAction assigned to an Org B User | No same-org check on `assignedToUserId` (§7.2) | Membership-org check at assignment |
| REFERENCE | Org A LedgerEntry reverses Org B's original | `reverseAtomically` unscoped (§10.2) | `original.organizationId === actor's org`, enforced twice |
| ATTRIBUTE | Org A WON credit read into Org B's Results | `getCommercialResultsForEmployee` unscoped root (§7.3, §11.5) | Organization filter at the query entry point |
| SCORE | Same global User's Org A and Org B wins merged into one score | No `organizationId` predicate anywhere in `commercial-results.service.ts` (§11.5) | Scope by `(userId, organizationId, period)`, not `(userId, period)` alone |
| SCORE | Same global User's Org A and Org B execution-discipline evidence merged | Same shape in `execution-discipline.service.ts` (§11.5) | Same |
| REVERSE | Org A cannot reverse Org B's finance entry | Covered above (REFERENCE) | — |
| AGGREGATE | Org A's finance dashboard/reports include Org B totals | `list`/`listForSummary` unscoped, feeds 4+ downstream aggregates (§10.4) | Mandatory `organizationId` on the shared upstream query |
| AGGREGATE | Org A's `/admin` KPI dashboard includes Org B prospects | `getProspects` unscoped (§13) | Same pattern |
| WRITE (override) | Org A ADMIN/MANAGER completes/cancels Org B's ProspectAction | Role-only override, zero prospect/org check (§7.2, P0) | Add same-org constraint to the override itself |
| ROSTER | Org A ADMIN can list every organization's assessable/assignable employees | ~15 `prisma.user.*` roster call sites (§6) | Convert to membership-scoped queries |

---

## 19. User-relation-to-tenant-owned-row classification (ticket §35)

Every business model referencing `User`, classified by relationship
role, with the historical-preservation question applied:

| Relationship role | Example fields | Must the User have held membership at event time, current time, or both? |
|---|---|---|
| Actor / creator | `createdByUserId`, `actorUserId` | Event time only — history must say they did it, even after they leave the org |
| Assignee | `assignedToUserId`, `assignedUserId` | Event/assignment time for historical actions; current time only matters for *future new* assignments (an inactive/departed User shouldn't receive new work) |
| Subject | `employeeUserId`, `subjectUserId`, `userId` (targets) | Event time — the historical record is "this person, in this org, at this time," regardless of later departure |
| Evaluator / reviewer | `evaluatorUserId` | Event time |
| Credited person | `creditedUserId` | Event time — already frozen alongside `creditedUserNameAtEvent`/`creditedUserRoleAtEvent`, exemplary pattern |
| Approver / reverser | `reversedByUserId` (via `createdByUserId` on the reversal row) | Event time |

**In every case: event time, never current time, for historical rows.**
26A already found 6 of 68 `ProspectAction` rows assigned to a now-inactive
User in live production data — history involving departed/deactivated
employees is not hypothetical, it already exists today and must survive
any future migration untouched (26A §26/§30).

## 20. Historical membership problem (ticket §36)

`OrganizationMembership` (26B) describes the **current** relationship
only — there is no membership history table. This document flags: **no
future feature may infer "this person is a current member" as proof
"they were a member when this historical event occurred."** Every place
history already has a frozen snapshot (§5.3, §19) must keep using that
snapshot, never a live membership lookup, once org-scoping exists. Where
no snapshot exists today, none should be invented retroactively.

## 21. Membership deletion implications (ticket §37)

No membership lifecycle exists yet (26B deliberately deferred this). If
a future ticket adds membership removal, it must not cascade to disappear:
`ProspectActivity.creditedUserId`, `DailyReport.ownerUserId`,
`*Assessment.employeeUserId`/`evaluatorUserId`,
`LedgerEntry.createdByUserId`, `CommercialPerformanceTarget.userId`/
`createdByUserId`. Every one of these already uses `onDelete: Restrict`
on its `User` relation (§22 below) or, for `Prospect.assignedUser`,
`SetNull` (deliberate — ownership, unlike authorship, is reassignable).
This is exactly the right existing foundation for "membership
deactivated, not User deleted" — a future membership-removal feature
should mean `OrganizationMembership`-level deactivation, never a User
hard-delete, mirroring how `User.active = false` already preserves
history today.

---

## 22. Tenant-relative uniqueness inventory (ticket §38-39, required)

| Constraint | Current scope | Recommendation |
|---|---|---|
| `Organization.slug` | Global | Stays global — it's the tenant-identification key itself |
| `OrganizationMembership.[organizationId, userId]` | Already tenant-relative | No change |
| `UserCreationActivity.subjectUserId` | Global (1:1 per User) | **Unresolved** — depends on §5.2's decision; stays global under reading A, becomes `[subjectUserId, organizationId]` under reading B |
| `DailyReport.[ownerUserId, reportDate]` | Per user | Must become `[ownerUserId, organizationId, reportDate]` — otherwise a User in two orgs can't report to Org B on a day they already reported for Org A |
| `LedgerEntry.reversalOfId` | Global (1:1 pairing) | Stays global as a pairing constraint, but must ALSO be app-validated for same-`organizationId` (§10.2) |
| `LedgerEntry.reference` | Not unique today | If ever made unique, must be `[organizationId, reference]` |
| `CommercialPerformanceTarget.[userId, periodStart, periodEnd]` | Per user | → `[organizationId, userId, periodStart, periodEnd]` |
| `RoleResponsibilityAssessment.[employeeUserId, periodStart, periodEnd]` | Per user | → `[organizationId, employeeUserId, periodStart, periodEnd]` |
| `RoleResponsibilityAssessmentItem.[assessmentId, responsibilityKey]` | Per assessment | No change — already tenant-safe via parent |
| `ProfessionalContributionAssessment.[employeeUserId, periodStart, periodEnd]` | Per user | → `[organizationId, employeeUserId, periodStart, periodEnd]` |
| `ProfessionalContributionAssessmentItem.[assessmentId, traitKey]` | Per assessment | No change |
| `User.email` | **Not unique today** (26A finding, still true — not re-verified this session, no reason to expect it changed) | Existing-state finding independent of tenancy; decide before deciding org-scoped vs. global email uniqueness |

No constraint changes are made in 26C — this table is a migration
recommendation for the ticket(s) that add `organizationId` to each model.

---

## 23. Cascades and deletion — complete current inventory (ticket §40)

Full `onDelete` audit across all 16 models (re-verified this session,
including the 5 models 26A never saw):

```text
Restrict (User relations) — UserStatusActivity (both), UserCreationActivity
  (both), PersonalNote, DailyReport.owner, ProspectActivity.creditedUser,
  ProspectAction (all four User relations), LedgerEntry.createdByUser,
  CommercialPerformanceTarget (both User relations),
  RoleResponsibilityAssessment (both), ProfessionalContributionAssessment
  (both), OrganizationMembership (both — new in 26B)

SetNull — Prospect.assignedUser only (deliberate: ownership is
  reassignable, unlike authorship)

Cascade — ProspectActivity.prospect (flagged by 26A as a latent risk:
  nothing deletes a Prospect today, but must become Restrict/archival
  before any future Prospect-delete capability, since it contradicts
  "history survives");  RoleResponsibilityAssessmentItem.assessment and
  ProfessionalContributionAssessmentItem.assessment (both fine — a true
  1:1-owned child that can never be reassigned to a different assessment,
  unlike ProspectActivity's relationship to Prospect)

Restrict — LedgerEntry.reversalOf, ProspectAction.prospect
```

**Conclusion, extended from 26A**: the newly-added Performance domain
follows the same disciplined Restrict-on-User convention as everything
else — no new deletion-safety gap was introduced by 25H.2A/25I/25J. The
one pre-existing gap (`ProspectActivity.prospect` Cascade) remains
exactly as 26A found it. A future Organization-deletion feature (not
built anywhere yet, per §71) must not be capable of silently deleting
global Users — nothing in the current schema allows that (every User
relation is Restrict or SetNull), and `OrganizationMembership`'s own
relations are Restrict too (26B), so this invariant already holds
structurally.

---

## 24. Tenant context dependency & the critical sequencing question (ticket §41, §68)

**Must tenant context exist before the first business-domain
`organizationId` migration? No — and 26B is already the proof.**

Two genuinely separate concerns, restated precisely (ticket §68):

```text
DATA OWNERSHIP MIGRATION      Rows gain tenant ownership (a column +
                                a backfill).
RUNTIME TENANT ENFORCEMENT    Requests use an active Organization to
                                filter those rows.
```

Every direct-ownership model recommended in §3 can be backfilled to
RELAIS with **zero request-time information** — "attach `organizationId
= RELAIS.id` to every existing row" is a migration-time constant, not
something that needs to know which Organization is making the current
request. 26B already proved this pattern works cleanly (`Organization`/
`OrganizationMembership` themselves, additive, zero runtime dependency,
zero authorization change). This generalizes directly to every model in
§3's "direct" bucket.

**Tenant context only becomes necessary at the RUNTIME ENFORCEMENT
step** — the moment a query needs to know "which Organization is this
request for," which requires resolving it from the authenticated
session (26A §32/§33's `TenantContext` sketch:
`{userId, organizationId, membershipId, role, active}`, built once
immediately after `requireAuthenticatedUser`, resolved from the User's
current single active membership — no organization-switcher needed for
V1).

**Recommended order, confirmed by this audit's evidence, not merely
carried over from 26A:**

```text
1. Data ownership migrations, model by model (nullable → backfill RELAIS
   → NOT NULL, matching 26B's own additive style) — no tenant context
   needed for any of these, exactly as 26B needed none.
2. Build TenantContext resolution (new capability, but can be built and
   even wired into `require*` helpers as a NO-OP addition before any
   query actually filters by it — this is itself a safe, reviewable,
   additive step, matching this repo's existing ticket discipline).
3. Runtime query scoping, one domain at a time, using the TenantContext
   built in step 2. Recommended domain order, by risk and dependency:
   Prospect/Activity/Action (closes the P0 override) → DailyReport →
   Finance → Performance (closes the new P0 findings in this audit) →
   Notes → Analytics/Dashboard → the shared /updates feed LAST (§14 —
   it depends on every source model already being scoped).
```

No circular dependency exists — every tenant-owned model depends only on
`Organization` directly, or transitively via `Prospect`/assessment
parents, exactly as 26A's §39 already established for the pre-Performance
domain; this audit confirms the Performance domain slots into the same
topological order without changing it.

---

## 25. Backfill provenance (ticket §42-44)

For every model recommended for direct `organizationId` in §3, the
backfill path is identical and already precedented by 26B itself:
**existing row → RELAIS organization**, justified as historically
truthful because — per 26A's read-only completeness check (§29 of that
document, unchanged, no reason to re-run given zero writes have occurred
to these tables since) — every current row in every one of these tables
belongs to RELAIS with no cross-company markers of any kind. The
Performance domain models (added after 26A's snapshot) follow the exact
same reasoning: every `CommercialPerformanceTarget`/
`RoleResponsibilityAssessment`/`ProfessionalContributionAssessment` row
that exists today was created by a RELAIS admin/manager for a RELAIS
employee — there is no other tenant it could belong to.

**Migration shape recommendation** (ticket §44): follow the nullable-first
pattern for every direct-ownership model, matching this repo's own
established migration discipline (visible across every prior ticket in
`prisma/migrations/`) and 26B's own additive style:

```text
1. Add nullable organizationId
2. Backfill RELAIS (idempotent, ON CONFLICT-safe where applicable,
   matching 26B's migration.sql pattern)
3. Verify completeness (read-only query, matching 26B's §67 checks)
4. Add foreign key + index
5. Make organizationId NOT NULL
6. Only then, in a LATER ticket, switch runtime queries to filter by it
```

Do this per-domain, not as one giant migration — 26A's §41 rollout-strategy
reasoning (staged over big-bang) applies with even more force now that
the Performance domain adds 5 more models needing the same treatment.

---

## 26. Direct-ownership recommendations (ticket §64, required)

```text
MODELS THAT SHOULD RECEIVE organizationId DIRECTLY
- Prospect
- LedgerEntry
- DailyReport                      (snapshotted at creation)
- PersonalNote
- CommercialPerformanceTarget
- RoleResponsibilityAssessment
- ProfessionalContributionAssessment

MODELS THAT SHOULD DERIVE TENANCY THROUGH A PARENT
- ProspectActivity                 (via Prospect — but denormalize
                                     organizationId anyway, for
                                     query-safety/index reasons, exactly
                                     as 26A recommended)
- ProspectAction                   (via Prospect for the org axis, same
                                     denormalize-anyway recommendation —
                                     but its 4 User FKs need independent
                                     same-org validation regardless of
                                     whether organizationId is denormalized)
- RoleResponsibilityAssessmentItem       (via RoleResponsibilityAssessment)
- ProfessionalContributionAssessmentItem (via ProfessionalContributionAssessment)

GLOBAL MODELS
- User
- (Organization and OrganizationMembership are the tenant root/linking
  table themselves — not "owned by" an Organization the way other models
  are; see §4)

UNRESOLVED / NEED DESIGN
- UserCreationActivity             (§5.2 — global identity event vs.
                                     organizational administrative event)
- UserStatusActivity               (§5.2 — same tension)
- RelaisProduct / product catalog  (§12 — global vs. tenant-owned vs.
                                     hybrid; 26A's largest single
                                     productization blocker, unchanged)
- LedgerEntryCategory              (§12 — same shape as Products)
- DailyReportTemplateType          (§12 — same shape)
- PersonalNoteCategory.RELAIS_IDEA (§12 — narrow instance of the same
                                     problem)
- role-responsibility-catalog.ts / professional-contribution-catalog.ts
                                    (§11.7 — same shape as Products, code
                                     instead of enum)
```

---

## 27. Historical-preservation summary (ticket §65, required)

| Domain | Must preserve |
|---|---|
| Prospect | Historical organizational ownership — once `organizationId` exists, a Prospect must never change organization; enforce by simply never including it in any update's allow-list |
| ProspectActivity / WON | `agentName`, `creditedUserId`, `creditedUserNameAtEvent`, `creditedUserRoleAtEvent` — already frozen, keep using exactly this pattern for a future `organizationId` snapshot |
| ProspectAction | Terminal-state immutability (already enforced); the four User relations already `Restrict` |
| Performance (all 4 assessment/target models) | `roleAtAssignment`/`createdByRoleAtEvent`/`roleAtEvaluation`/`evaluatorRoleAtEvent` and the full item-level catalog-content snapshots — already frozen, never re-derive from live User/Membership state |
| Finance | Original/reversal provenance (`reversalOfId` pairing) — reversal integrity is clean today (26A: zero anomalies across all 51 production rows) and must stay that way; a reversal must never span two future Organizations |
| `UserCreationActivity` / `UserStatusActivity` | `roleAtEvent`/transition-type/actor/subject/`occurredAt` already frozen regardless of how §5.2's ambiguity resolves — do not let that resolution touch these already-correct fields |
| Daily Reports | `templateType`, `reportDate`, `ownerUserId` — already frozen at creation, extend the same discipline to a future `organizationId` |

**Do not infer historical membership dates that were never recorded**
(ticket §36/§65) — nowhere in this document does any recommendation
backdate a membership or invent a historical organization assignment
beyond "this pre-26B row belongs to RELAIS," which is directly evidenced
by 26A's completeness check, not inferred.

---

## 28. Authority helpers audit (ticket §47)

Every current authorization helper, and its future tenant dimension:

| Helper | Role authorization exists? | Tenant authorization exists? | Future expected combination |
|---|---|---|---|
| `requireAdmin`/`requireManager`/`requireCommercial` | Yes | No | + same-organization membership check |
| `requireSharedFeedAccess` (`SHARED_FEED_ROLES`) | Yes | No | + org-scoped feed sources (§14) |
| `requireDailyReportManagementAccess` | Yes | No | + org scope on `findForManagement`/`listForManagement` |
| `requireProspectActionQueueAccess` | Yes | No | + org scope |
| `requireSalesAnalyticsAccess` | Yes | No | + org-scoped base query, validated secondary filters |
| `requireMyProspectsAccess` | Yes | No | + org scope (in addition to existing `userId = me`) |
| `requireCommercialPerformanceTargetManagementAccess` | Yes | No | + org scope, + implicit same-org constraint replacing today's org-wide MANAGER authority |
| `requireRoleResponsibilityAssessmentManagementAccess` / `requireProfessionalContributionAssessmentManagementAccess` | Yes | No | Same |
| `requirePerformanceDashboardAccess` | Yes | No | Same |
| `requireFinanceAccess` | Yes | No | + org scope on every ledger/report query |
| `requireDashboardAccess` | Yes | No | + org scope on every dashboard KPI |
| `requireFollowUpQueueManagementAccess` | Yes | No | + org scope |
| `assertCanChangePasswordCore` | Yes (self-or-admin) | No | Eventually: admin's org must match the target User's membership org |

Eventual required combination for every one of these (ticket §47):

```text
authenticated identity
+ active organization membership
+ role/capability within that organization
+ resource belongs to the same organization
```

None of this is implemented in 26C.

## 29. Route-layout assumptions (ticket §48)

Re-applying the lesson from the Assistant-role work (25R): **route
nesting is not authorization**, and an eventual Organization-scoped
layout will not be sufficient proof that every nested mutation is
tenant-safe either. Concretely, every service-level mutation audited in
§16-17 needs its **own** resource-level tenant check — a future
`app/[org]/...`-style layout gate (if ever built) would no more close
the ProspectAction override or the Performance-domain bare-ID mutations
than today's `requireRole` layout gates close them for role alone. This
mirrors 26A's own §7 finding that all enforcement here is per-route with
no central edge gate (`middleware.ts` doesn't exist) — the same
per-service-boundary discipline that already works for role checks must
be reused for tenant checks, not assumed to come for free from routing
structure.

## 30. Service boundary recommendation (ticket §49-52)

Prefer authoritative service/query boundaries over page-level checks —
concretely, every flagged bare-ID service function in §16 (`getProspectById(id)`,
`getLedgerEntryById(id)`,
`getRoleResponsibilityAssessmentDetail(id)`, etc.) should eventually
become `getX({ organizationId, id })` — a required parameter, not an
optional filter, so it's structurally impossible to call without it.
This document only inventories the current dangerous shape (ticket §50)
— no renames happen in 26C.

**DB-enforceable vs. application-enforced invariants (ticket §52),
concretely distinguished for this codebase:**

```text
DB-enforceable:       Organization.slug unique; OrganizationMembership.
                       [organizationId, userId] unique; every future
                       [organizationId, ...] compound unique constraint
                       in §22.

Application-only:      "assignedToUserId's membership org == prospect's
                       org" (ProspectAction) — a normal FK only proves
                       the User row exists, not which org's membership
                       applies.
                       "reversalOf.organizationId == entry.organizationId"
                       (LedgerEntry) — no DB constraint can express a
                       cross-row equality between two FK targets.
                       Every "actor's org == target's org" check
                       throughout §17's compound-ID table.
```

Where relation-filtering (`where: { prospect: { organizationId } }`)
can substitute for a denormalized column on a child model (`ProspectActivity`,
`ProspectAction`), it is **correct** but **not sufficient on its own for
mutation safety** — the four independent User FKs on `ProspectAction`
still need application-level same-org validation no matter how the org
axis itself is resolved (§3's `ProspectAction` row, restated).

## 31. Membership same-tenant validation (ticket §53) & role-authority transition state (ticket §54-55)

Every future assignment/reference check reduces to the same shape:

```text
OrganizationMembership exists for:
  organizationId = <the resource's organization>
  userId         = <the referenced User>
```

**`User.role` must never be used as proof of tenant membership** — role
says nothing about which organization a User belongs to (a User could
theoretically be `COMMERCIAL` globally-cached-at-login and hold no
membership at all in the target org). This is a distinct check from
authorization (§28) and must not be conflated with it.

Historical role snapshots (`creditedUserRoleAtEvent`, `roleAtAssignment`,
evaluator snapshots — §5.3, §19) must remain historical meaning forever —
never replaced by a live `OrganizationMembership.role` lookup.

**Current transition state, reconfirmed**: `User.role` = runtime
authority; `OrganizationMembership.role` = synchronized shadow, zero
authorization effect (26B, two regression tests added this session
confirm this holds in both directions). This audit identifies which
business services will eventually need `OrganizationMembership.role`
once an active tenant context exists — every helper in §28's table — but
**switches none of them**.

---

## 32. Final isolation criterion, per domain (ticket §70)

For every domain audited above, "tenant-isolated" will eventually mean,
at minimum:

```text
Org A can read Org A's own data; Org A cannot read Org B's data by any
  ID, guessed or otherwise.
Org A can mutate Org A's data with normal role authority; Org A cannot
  mutate Org B's data, including through a role-based override (the
  ProspectAction/Performance-domain ADMIN/MANAGER overrides specifically).
Org A cannot attach an Org B User/resource to an Org A record (the
  compound-ID invariants in §17).
Org A's aggregates (dashboard KPIs, finance reports, Results/Execution
  scores) contain only Org A evidence — including when the evidence in
  question is the SAME global User's activity in a different
  organization (§11.5's new finding — this is stricter than "different
  users" isolation).
Historical attribution survives membership/role changes and even
  membership removal, exactly as it already survives User deactivation
  today.
```

`organizationId` present on a row is necessary but never sufficient for
any of the above (ticket §69) — a model can carry organization ownership
while every query against it remains globally unscoped, which is
precisely the state 26B's own `Organization`/`OrganizationMembership`
tables are in right now (they exist; nothing reads them for
authorization). The same caution applies to every model this document
recommends adding `organizationId` to: adding the column is not the
isolation work, it is the prerequisite for the isolation work.

---

## 33. Severity classification (ticket §63)

**P0 — direct cross-tenant read/write/IDOR once multiple organizations
exist:**

- ProspectAction ADMIN/MANAGER complete/cancel override — role-only, zero
  prospect/org check (§7.2) — the single clearest write-bypass in the
  codebase
- `RoleResponsibilityAssessment`/`ProfessionalContributionAssessment`
  bare-ID read, mutate-item, submit, delete (§11.2-11.3) — full
  read+write by guessable ID
- `listRoleResponsibilityAssessmentsForManagement` /
  `listProfessionalContributionAssessmentsForManagement` /
  `listCommercialPerformanceTargetsForManagement` — fully unscoped list
  views, new findings, worse shape than most other P0s (no ID needed at
  all)
- `CommercialPerformanceTarget` update/delete bare-ID (§11.1)
- `LedgerEntry.findById`/`reverseAtomically` bare-ID (§10.2-10.3, 26A
  carryover, reconfirmed)
- `DailyReport.findForManagement`/`listForManagement` (26A carryover,
  reconfirmed)
- `Prospect.getProspectById`/`getProspectActivities`/
  `listProspectActionsForProspect` (26A carryover, reconfirmed)
- `/updates` feed — 5 fully unscoped source queries (§14, largest blast
  radius)
- `/admin/users` and every roster query in §6 — an Org A admin screen
  literally lists every organization's people today

**P1 — aggregate leakage, cross-tenant assignment/reference, performance
contamination, finance contamination:**

- Same-global-User-two-Organizations win/execution merging in
  `commercial-results.service.ts`/`execution-discipline.service.ts`
  (§11.5) — new finding, a genuinely different contamination shape than
  a plain leak
- `legacyUnattributedWinsInPeriod`'s company-wide pool (§11.5)
- Finance summary/report aggregates sharing one unscoped upstream query
  (§10.4)
- Sales funnel/why analytics unscoped root + unvalidated filters (26A,
  reconfirmed)
- Dashboard KPI queries (26A, reconfirmed)
- `ProspectAction.assignedToUserId` cross-org assignment risk (§7.2)
- `ProspectAction`'s four User FKs needing independent validation even
  once the org axis is derived (§3)

**P2 — incorrect tenant-relative uniqueness, admin UX assumptions,
future lifecycle ambiguity:**

- Every `@@unique` needing an `organizationId` prefix (§22)
- Hardcoded-RELAIS resolution in the 26B role-sync/creation transactions
  (§6.1 — correct today, needs a parameter later)
- `UserCreationActivity`/`UserStatusActivity` unresolved semantics (§5.2)
- The ~15-call-site roster-query pattern needing a membership-scoped
  rewrite (§6)
- Products/reference-data-as-code decision (§12, §11.7)

**P3 — naming/cleanup/deferred architectural improvements:**

- Row-Level Security as defense-in-depth (26A §34, unchanged)
- Catalog-as-code genericization if a future customer needs a different
  responsibility/contribution catalog (§11.7)
- Remaining branding-only RELAIS string references (26A §43, not
  re-audited this session — no code in that inventory was touched by
  26B or since)

Remember (ticket §63): the app still has exactly one operational
tenant. Every item above is a **future multi-tenant isolation blocker**,
not a currently exploitable breach.

---

## 34. Recommended sequence for 26D+

Evidence-based, following §24's sequencing answer and 26A's §39/§41
reasoning, now covering the Performance domain 26A never saw:

```text
26D  Tenant Context Foundation
     TenantContext construction (userId, organizationId, membershipId,
     role, active), resolved from the User's single active membership
     at login. No query scoping yet — this is additive, matching 26B's
     own style, and can be reviewed/tested independently of any domain
     migration.

26E  Prospect & Prospect-adjacent Ownership Migration
     organizationId on Prospect (direct), ProspectActivity/ProspectAction
     (denormalized, derived-but-stored), RELAIS backfill, uniqueness
     unaffected (none exist on these models beyond PK). No runtime
     scoping yet.

26F  Prospect Domain Runtime Isolation
     Wire TenantContext into every Prospect/Activity/Action read+write
     boundary from §16-17's inventory; close the ADMIN/MANAGER override
     P0 with an explicit same-org check; isolation tests against the
     §18 attack matrix's Prospect rows.

26G  Daily Report & Notes Ownership + Isolation
     organizationId (snapshotted for DailyReport), uniqueness migration
     (§22), close the findForManagement/listForManagement P0.

26H  Finance Ownership + Isolation
     organizationId on LedgerEntry, close findById/reverseAtomically P0,
     scope the shared list/listForSummary boundary (fixes dashboard +
     all 4 report breakdowns at once per §10.4).

26I  Performance Domain Ownership + Isolation
     organizationId on all 3 direct models (Target, Role Responsibility,
     Professional Contribution — Items derive), uniqueness migration,
     close the unscoped-management-list P0s (the worst shape found this
     session), fix the same-User-two-orgs scoring contamination in
     Results/Execution Discipline (§11.5) — this alone justifies being
     its own ticket rather than folding into 26E-H, given its severity
     and the fact it's freshly discovered.

26J  User Administration Membership-Scoping
     Convert the ~15 roster call sites (§6) from prisma.user.* to
     membership-scoped queries; parameterize the 26B role-sync/creation
     transactions to accept a target organizationId instead of hardcoding
     RELAIS (§6.1); resolve the UserCreationActivity/UserStatusActivity
     ambiguity (§5.2) as part of this ticket's design work, since it's
     fundamentally a user-administration-history question.

26K  Analytics & Dashboard Isolation
     Sales funnel/why analytics base-query scoping + secondary-filter
     validation; admin dashboard KPI scoping.

26L  Shared Updates Feed Isolation (last, by design)
     Scope all 5 source queries simultaneously — depends on every
     source model already being isolated in 26F/26G/26H/26I.

26M+ Product catalog / reference-data genericization (§12) as its own
     multi-ticket workstream, decoupled from core tenancy — per 26A's
     own recommendation, unchanged, since this remains a much larger,
     separate problem (turning compiled enums into tenant-configurable
     data) with almost no code overlap with the isolation work above.
```

Isolation tests against the §18 attack matrix should run continuously
from 26E onward, not only at the end — mirroring 26A's §39/§41
recommendation, now extended to cover the Performance domain rows this
audit added to that matrix.

---

## 35. Unresolved items (ticket §72, complete list)

```text
UNRESOLVED — UserCreationActivity / UserStatusActivity semantics
  See §5.2 in full. Decision needed before 26J.

UNRESOLVED — Product catalog architecture (GLOBAL / ORGANIZATION-OWNED /
  hybrid)
  See §12, 26A §11. Decision needed before any Product tenantization
  work; not blocking 26D-26L above.

UNRESOLVED — LedgerEntryCategory, DailyReportTemplateType,
  PersonalNoteCategory.RELAIS_IDEA, role-responsibility-catalog.ts /
  professional-contribution-catalog.ts
  Same shape as Product, smaller instances. See §12, §11.7. Not blocking
  26D-26L.

UNRESOLVED — User.email uniqueness
  26A finding, independent of tenancy, still unresolved: no
  @unique/@@unique exists today, login uses findFirst not findUnique.
  Must be decided (global vs. org-scoped) before it's safe to add a
  uniqueness constraint at all.
```

No small cleanup was performed for any of the above during this audit,
per the ticket's explicit instruction not to let tempting fixes slip
into an audit-only ticket.

---

## 36. Validation (ticket §73)

This ticket touched exactly one file: this document. `git diff --check`
is clean (new file, no whitespace errors). No schema, migration,
service, test, or production-data changes were made. No `npm test`/
`tsc`/`eslint`/build run was necessary, since no repository code changed
— per the ticket's own instruction, these are run "only if repository
files beyond the audit document are touched," which did not happen here.

---

## Summary invariants (restated, per the ticket's closing frame)

> **Tenant ownership comes from the business context of a record, never
> from the current state of a referenced User. Attribution may point to
> a global User, but ownership must remain anchored to the Organization
> whose business activity produced the record.**

> **Every future tenant-owned read or write must prove both role
> authority and Organization ownership. A valid record ID, User ID, or
> foreign key is never sufficient proof that two resources belong to the
> same tenant.**

Both invariants are already true of this document's own conclusions —
every P0/P1 finding above is precisely a place where today's code proves
only role authority (or only that an ID exists), never organization
ownership, because organization ownership does not yet exist to prove.
26D onward is the work of closing that gap, domain by domain, in the
order §34 recommends.
