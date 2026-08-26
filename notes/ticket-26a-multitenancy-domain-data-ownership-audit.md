# Ticket 26A — Multi-Tenancy Domain & Data Ownership Audit

Audit date: 2026-08-26

This is an **audit-only** ticket. No `Organization`, `Membership`,
`organizationId`, migration, or backfill was created. No application
behavior changed. All database access performed for this audit was
read-only (`.count()`/`.findMany()`/`.groupBy()` only, via a scratch script
that was deleted immediately after use — it never lived in the repo). Row
counts below are a live snapshot taken 2026-08-26.

## Executive summary

RELAIS CRM today is a clean single-tenant system with no notion of
"organization" anywhere in the schema, session, or services — confirmed by
full reads of `prisma/schema.prisma`, `auth.ts`, `authorization.service*`,
and a repo-wide grep. That absence is not itself the risk; the risk is
*where* the codebase currently trusts identifiers without checking scope,
because every one of those trust decisions becomes a cross-tenant hole the
moment a second organization exists.

Three findings dominate this audit:

1. **`User` mixes global identity with organization-specific state.**
   `role`, `active`, and `dailyReportTemplateType` are exactly the fields
   that would need to differ per organization for the same human, and they
   live directly on `User` today (`prisma/schema.prisma:221-267`). The
   session/JWT (`auth.ts:37-57`) caches `role` for 30 days with no tenant
   concept at all. A `User` → `OrganizationMembership` → `Organization`
   split is recommended, not a bolt-on `User.organizationId`.
2. **The product catalog is a hardcoded 4-value enum, not organization
   data.** There is no `Product` model. `RelaisProduct` (`KARMDA`,
   `LOKARI`, `NIA`, `DIGITAL_SERVICES`) is compiled into the schema,
   validation, dedicated routes, dedicated per-product components, and
   nullable wide-table columns on `Prospect`. The same is true of
   `LedgerEntryCategory` (chart of accounts) and `DailyReportTemplateType`
   (report templates). Onboarding a customer #2 with a different catalog,
   different finance categories, or different report templates requires a
   code change today, not organization configuration. This is a bigger
   productization blocker than anything branding-related.
3. **Several read paths do bare-ID lookups with no ownership/scope check**,
   trusting that the calling layout already authorized access:
   `getProspectById`, `getProspectActivities`, `listProspectActionsForProspect`,
   `DailyReport.findForManagement`/`listForManagement`, and
   `LedgerEntry.findById`/`reverseLedgerEntry`. None of these are bugs
   today (single tenant, and the callers do gate by role), but every one
   becomes an IDOR the day a second organization's IDs exist in the same
   tables. `/updates` (À la une) is the single largest such surface: its
   four source queries are fully unscoped merges across the whole company.

A read-only backfill-feasibility check found **zero** existing records that
would be untruthful to attribute to a single "RELAIS" tenant: every
`Prospect` has an assignee, every reversed `LedgerEntry` has a proper
reversal pair, and every `User` has an email and password hash. RELAIS
tenant #1 backfill is historically clean.

Revised Phase 26 estimate (see §45): **minimum ~16-18 tickets, recommended
~24-28, optional post-first-customer work ~8-12** — higher than the
pre-audit ~22 estimate, driven mainly by the product-catalog-is-an-enum
discovery and the number of individual raw-ID lookups needing per-service
remediation rather than one central fix.

---

## 1. Historical-preservation requirements

The existing codebase already has the right instinct for this problem —
it just hasn't needed to apply it to "organization" yet. Two patterns
already in production are the template to reuse:

- **Snapshot text next to a live relation.** `ProspectActivity.agentName`
  (`schema.prisma:482`) is a plain string snapshot of the actor's name at
  the time, deliberately *not* a `User` relation, precisely so a later
  reassignment or role change never rewrites what actually happened.
  `DailyReport.templateType` (`schema.prisma:348-351`) is explicitly
  snapshotted at creation and "never re-derived from the User relation."
  `UserCreationActivity.roleAtEvent` (`schema.prisma:304`) is the same
  pattern applied to role.
- **`Restrict` everywhere history depends on a User.** Every historical
  relation to `User` (`UserStatusActivity`, `UserCreationActivity`,
  `ProspectAction`'s four user relations, `LedgerEntry.createdByUser`,
  `DailyReport.owner`, `PersonalNote.user`) uses `onDelete: Restrict`.
  Only `Prospect.assignedUser` uses `SetNull`, because *ownership* (unlike
  *authorship*) is meant to be reassignable. This is already exactly the
  "membership can be deactivated, but history survives" behavior the
  ticket wants generalized to organizations.

Applying this to tenancy: **any future `organizationId` on a historical
row must be captured once at event time and frozen, never derived at read
time from a mutable current relationship.** Concretely:

| Historical fact | Must remain true after tenancy | Failure mode if violated |
|---|---|---|
| `ProspectActivity`/`ProspectAction` rows | Attribution (`agentName`, `assignedToUserId`, etc.) and the organization the event happened in stay fixed | If org is derived from the *current* `User.membership` instead of frozen at event time, a user who changes orgs (or leaves) retroactively "moves" old history to a different org |
| `UserStatusActivity`/`UserCreationActivity` | `roleAtEvent`/transition type/actor/subject stay fixed; these describe a **membership** lifecycle, not a global account lifecycle, once orgs exist | Reinterpreting `UserCreationActivity.roleAtEvent` as "the user's current global role" instead of "role in membership X at creation" corrupts 25C's meaning |
| `DailyReport` | `templateType`, `reportDate`, `ownerUserId` (and a future frozen `organizationId`) never re-derived | A user with reports in two orgs must not have Org-B's template silently reinterpret Org-A's historical report |
| WON transitions | Already durable via `WON_TRANSITION` activity, never inferred from mutable `Prospect.status` — keep it that way | N/A — already correct |
| Finance ledger + reversals | `status=POSTED && reversalOfId===null` ("effective movement", confirmed in `financial-ledger.service.ts:260-264` via `isEffectiveLedgerMovement`) must not be reinterpreted; reversal pairs must never span two different (future) organizations | A reversal referencing a different org's original entry would corrupt both orgs' financial history |
| À la une (`/updates`) | Pure read-time projection over the models above (confirmed by `notes/ticket-25a-updates-event-coverage-audit.md`) — it stores nothing itself | Whatever org-scoping the source models get, the feed inherits automatically; no separate feed-history migration needed |
| Prospect ownership | `assignedUserId` is already a *mutable pointer* (current owner), not history — this is fine to re-scope later; it is `agentName` that carries historical truth | None, as long as this distinction is preserved |

**Fundamental rule, restated for this codebase:** introducing
`organizationId` must never be *derived* for historical rows from a
`User`'s current membership state. It must be captured once, at the same
moment `agentName`/`templateType`/`roleAtEvent` are already captured.

---

## 2. & 3. Complete model + enum inventory and ownership matrix

Full schema read (`prisma/schema.prisma`, 597 lines). **9 models, 18
enums.** There is deliberately no `Product` model — see §11.

| Model | Current owner | Future owner | Tenant root? | Historical? | Direct `organizationId`? |
|---|---|---|---|---|---|
| `User` | Implicit RELAIS; **mixes identity + org-specific state** | Split: `User` keeps identity (`id`,`email`,`phone`,`passwordHash`,`firstName`,`lastName`); new `OrganizationMembership` gets `role`,`active`,`dailyReportTemplateType` | N/A — `OrganizationMembership` becomes the root | No (mutable current state) | No on `User`; yes on `OrganizationMembership` |
| `UserStatusActivity` | RELAIS, via `User` | Membership lifecycle event | No (child of Membership) | Yes, immutable | Yes — frozen at event time, never derived from subject's current membership |
| `UserCreationActivity` | RELAIS, via `User` | Membership-creation event | No | Yes, immutable | Yes — same reasoning; `roleAtEvent` becomes "membership role at creation in Org X," frozen |
| `PersonalNote` | User (personal-global today) | Personal-within-organization (work notes) | Yes, if org-scoped | No | Recommend yes, direct — a `User` who later belongs to two orgs cannot safely have "which org was this note written in" derived from current state |
| `DailyReport` | User (`ownerUserId`) | Membership-authored | Yes | Yes — date/template/ownership are frozen facts | Recommend yes, direct + snapshotted, exactly like `templateType` already is |
| `Prospect` | RELAIS (implicit) | Organization | Yes (self, root) | Partially (no creation-actor event; WON is the one durable transition) | Yes, direct |
| `ProspectActivity` | Prospect | Organization via Prospect | No (child) | Yes, append-only, immutable | Structurally derivable IF Prospect can never change org (recommend that as an explicit, enforced invariant) — but recommend denormalizing `organizationId` anyway for query safety and analytics performance |
| `ProspectAction` | Prospect | Organization via Prospect | No (child) | Yes for terminal state (`Restrict` everywhere) | Same org-derivation reasoning as `ProspectActivity`, **but** its four independent `User` relations (`assignedToUserId`/`createdByUserId`/`completedByUserId`/`canceledByUserId`) are NOT derivable from the prospect and need explicit same-org validation at write time regardless |
| `LedgerEntry` | RELAIS (implicit) | Organization | Yes (self, root, no parent) | Yes; POSTED + `reversalOfId===null` = effective movement | Yes, direct — required, no parent to derive from. `reversalOfId` self-relation needs app-level same-org enforcement (no DB constraint can express "both sides of this FK share a column value") |

**Truly global/reference data (classification F):** none of the 9 models
qualify — every one is either identity, membership-adjacent, or
tenant-owned/historical. The *enums* that are today implicitly global
(`RelaisProduct`, `LedgerEntryCategory`, `DailyReportTemplateType`,
`PaymentMethod`, `PersonalNoteCategory`) are RELAIS-specific taxonomies
compiled into the schema, not genuinely universal reference data — see
§18 for why this matters more than it looks.

---

## 4. `User` vs `Membership` analysis

`User` (`schema.prisma:221-267`) currently holds, in one row:

- **Identity-level**: `id`, `firstName`, `lastName`, `email` (nullable,
  **not `@unique`** — see the anomaly noted in §12/§23), `phone`,
  `passwordHash`.
- **Organization-specific state**: `role` (`UserRole`), `active`
  (`Boolean`), `dailyReportTemplateType` (nullable enum).

Applying the ticket's test — "if the same human belonged to Company A and
Company B, which fields could legitimately differ?" — all three
organization-specific fields fail immediately:

- `role`: a person could be `MANAGER` at Company A and `COMMERCIAL` at
  Company B. `User.role` cannot represent that.
- `active`: a person could be deactivated at Company A (fired) while still
  active at Company B. Today `active` is one global boolean
  (`schema.prisma:234`), and `authenticateCore`
  (`auth-credentials.service-core.ts`) rejects login entirely if
  `!user.active` — there is no way today to be "active for some purposes."
- `dailyReportTemplateType`: report templates are an organizational
  configuration (which role structure that company uses for reporting),
  not a property of the human — a person split across two companies with
  different reporting structures needs two independent values.

**Recommendation: yes, introduce `OrganizationMembership`.** Evaluated
against the ticket's criteria:

| Criterion | Finding |
|---|---|
| Same email across organizations | `User.email` isn't even unique today (see §12) — this needs deciding regardless of tenancy, and a Membership model doesn't require solving it immediately (email can stay a global identity anchor without an org-scoped uniqueness rule) |
| One person, multiple organizations | Directly requires Membership; `User.organizationId` cannot express it |
| Role per organization | Directly requires Membership |
| Active/inactive per organization | Directly requires Membership; today's single `active` flag conflates "fired everywhere" with "removed from one team" |
| Daily Report expectations per organization | Directly requires Membership; `dailyReportTemplateType` is exactly this |
| Authorization | Every `require*` helper (§7) checks `session.user.role` — under Membership, the session would need to resolve *which* membership's role applies, i.e. tenant resolution (§33) must run before authorization |
| Employee lifecycle / future invitations | Membership is the natural home for "invited," "active," "removed" states independent of the global account |
| Deactivation semantics | See §14 below — this is the single clearest argument for Membership over `User.organizationId` |

Do not implement in 26A. 26B should design (not build) the
`User` → `OrganizationMembership` → `Organization` shape.

---

## 5. Role, active, and report-template migration analysis

Confirmed by the auth-architecture research fork, via full reads of
`auth.ts`, `authorization.service.ts`, and `authorization.service-core.ts`:

- **Session/JWT contents** (`auth.ts:37-57`): exactly `id`, `firstName`,
  `lastName`, `role`. No `email`, no `active`, no tenant concept of any
  kind. `role` is cached at login for the full session lifetime and never
  re-verified against the DB except by two dedicated services.
- **`account-access.service-core.ts`** (`assertActiveAccountAccessCore`):
  role-neutral, re-checks the account still exists and is `active` —
  used for self-service/profile paths (a Ticket 25F concern).
- **`commercial-access.service-core.ts`** (`assertCommercialAccessCore`):
  re-checks exists, `active`, AND `role === "COMMERCIAL"` — used when an
  ADMIN/MANAGER views a specific commercial's dashboard data.
- Neither re-verification is tenant-aware; both will need "and belongs to
  the resolved organization" added once Membership exists.

**Role used in actual business logic, not just route gating** (these are
the (b) organization-authorization concerns from §7, listed here because
they specifically touch role/active/template semantics):

- `prospect-action.service-core.ts` `canCompleteProspectAction`/
  `canCancelProspectAction`: any assignee/creator, **or** `actor.role ===
  "ADMIN" || "MANAGER"`, can act. Role grants an elevated override
  *inside* the domain, not just route access — this becomes a direct
  cross-tenant write vector once orgs exist unless the override gains an
  implicit same-organization constraint (see §22, P0).
- `prospect-owner-reconciliation.ts`: hard invariant — a reconciled
  prospect owner must have `role === "COMMERCIAL"`.
- `prospect-action-queue.service-core.ts`: `role: UserRole` threaded
  through to decide unscoped-vs-owner-scoped query shape; the file
  already contains a comment flagging a recognized cross-boundary gap
  ("LOKARI/NIA have no shared read-only route yet, so a foreign
  COMMERCIAL...") worth cross-referencing when 26B designs authorization.
- `user.service-core.ts`: `role`/`active`/`dailyReportTemplateType` are
  plain create/update input fields, already deliberately allow-listed
  (comment: "never spreads arbitrary input, so email/role/active can't
  leak through") — good precedent for guarding future membership-role
  mutation the same way.

**Recommendation for 26B/26C: staged dual-field migration, not a
destructive one.** Keep `User.role`/`active`/`dailyReportTemplateType` in
place temporarily while `OrganizationMembership.role`/`active`/
`dailyReportTemplateType` are introduced and populated (RELAIS backfill),
and migrate call sites from `User.*` to `Membership.*` one domain at a
time. Only remove the `User.*` fields once every call site has moved.

---

## 6. User historical activities

`UserStatusActivity` and `UserCreationActivity` (`schema.prisma:272-309`)
both currently describe events on a *global* `User` row. Per the ticket's
own example ("Hamza added Aminata as COMMERCIAL"), these need
reinterpretation, not modification, once tenancy exists:

| Event type | Today's meaning | SaaS meaning | Reinterpretation risk |
|---|---|---|---|
| `UserCreationActivity` (25C) | "Global user X was created, with role Y, by global user Z" | "Membership for user X in Organization O was created, with role Y, by (actor's membership in Organization O)" | `roleAtEvent` is currently a snapshot of a **global** `UserRole` value. It must become "role within that membership," and existing RELAIS creation events must retain their current meaning (they *did* happen at RELAIS) rather than being reinterpreted as some other org. **Existing rows require no data change** — they simply need `organizationId = RELAIS` attached going forward, never inferred as ambiguous. |
| `UserStatusActivity` (18A) | "Global user X's active flag flipped, by actor Z" | "Membership for user X in Organization O was activated/deactivated" | Same treatment: existing rows are RELAIS-scoped facts and stay that way; the model itself needs to support *future* rows describing membership-scoped transitions distinct from a hypothetical future global-account-disable event |

**Classification: both require reinterpretation-on-migration (their
meaning changes from "global account event" to "membership event"), but
neither requires row-level modification** — RELAIS backfill (§29) can
attach `organizationId = RELAIS` to every existing row truthfully, since
100% of current history happened at RELAIS. Do not backfill actor/creator
identity that doesn't already exist (per 25A, unaffected by this ticket).

---

## 7. Authentication vs. authorization vs. tenant resolution

| Concept | Currently answered by | File:line |
|---|---|---|
| **Who are you?** | `session.user.id` (global `User.id`) | `auth.ts:37-57` (jwt/session callbacks) |
| **What can you do?** | `session.user.role`, a single global field, checked by every `require*` wrapper | `src/services/authorization.service.ts:22-93`, `authorization.service-core.ts:75-102` |
| **Which organization?** | **Nothing. No concept exists.** | Confirmed absent from schema, `auth.ts`, and every `require*` helper |

`requireAuthenticatedUserCore` / `requireRoleCore`
(`authorization.service-core.ts:75-102`) and every named wrapper
(`requireAdmin`, `requireManager`, `requireCommercial`,
`requireSharedFeedAccess`, `requireDailyReportManagementAccess`,
`requireProspectActionQueueAccess`, `requireSalesAnalyticsAccess`,
`requireMyProspectsAccess`) are thin role-array checks against hardcoded
constants (`SHARED_FEED_ROLES`, `DAILY_REPORT_MANAGEMENT_ROLES`, etc.,
`authorization.service-core.ts:28-73`) — several are commented as
"identical today by coincidence, kept separate so they can diverge." These
are **already de facto per-feature authorization policies**, just not yet
parameterized by organization. This is a good sign: 26B's
`TenantContext`/authorization redesign has a natural seam to extend, not
a from-scratch rewrite.

**No `middleware.ts` exists anywhere in the repo.** All enforcement is
per-route, via each `app/*/layout.tsx` calling a `require*` helper
server-side. Tenant resolution will have to be added inside this existing
per-layout chain (or a new wrapper every layout adopts) — there is no
central edge gate to intercept instead.

The future architecture the ticket sketches —
Authentication → User identity; Tenant resolution → Organization/
Membership; Authorization → Membership role — maps cleanly onto: keep
`requireAuthenticatedUser` as-is (identity only), insert a new tenant-
resolution step immediately after it, and change every role-array check
to read from the resolved Membership instead of `session.user.role`.

---

## 8. Role-dependent service audit

Repo-wide grep for `UserRole|role ===|role !==|requireAdmin|requireRole|
requireAuthenticatedUser|COMMERCIAL|MANAGER|ADMIN` hit roughly 140 files.
Grouped and classified:

| Group | Examples | Classification |
|---|---|---|
| Route layouts (`app/*/layout.tsx`) | `app/notes/layout.tsx:31`, `app/updates/layout.tsx:32`, `app/reports/layout.tsx:32`, `app/actions/layout.tsx:32`, `app/profile/layout.tsx:36` | (b) org-authorization for the gate itself; (d) display-only for the `role === "COMMERCIAL"` shell-picking branch each layout also does |
| Post-login redirect | `src/lib/dashboard-routing.ts:6` (`role === "COMMERCIAL" ? "/dashboard/commercial" : "/admin"`) | (d) display/routing-only |
| `*-authorization.test.ts` per route | notes, reports, products, finances, updates, actions, profile, my-prospects, funnel/why analytics, admin/reports | Test coverage of the (b) gates above |
| Domain business logic | `prospect-action.service-core.ts` (ADMIN/MANAGER override), `prospect-owner-reconciliation.ts` (COMMERCIAL invariant), `prospect-action-queue.service-core.ts` (role-based scope) | (b) organization-authorization — these are the highest-risk group because role changes query/write *shape*, not just access |
| `user.service-core.ts` | role/active/template as allow-listed create/update fields | (b), foundational — this is where Membership mutation will eventually live |
| Components (badges/labels) | `user-table.tsx`, `PersonalNoteCategoryBadge.tsx`, `ProfileSummary.tsx` | (d) display-only |
| Scripts | `bootstrap-admin.ts`, `set-user-password.ts`, `report-unreconciled-prospect-owners.ts` | (b)/(d) mixed, all global — see §16 |
| Historical | `UserCreationActivity.roleAtEvent` | (c) historical snapshot, immutable, see §6 |

No blind replacement is possible or advisable: group "domain business
logic" needs case-by-case redesign (each is a real authorization decision,
not a cosmetic label), while "components" and "post-login redirect" can
trivially keep reading a resolved-membership role once that exists.

---

## 9./10. Prospect ownership and creation

Confirmed via `src/services/prospect.service.ts`,
`prospect-creation.service-core.ts`, `admin-my-prospects.service.ts`,
`commercial-prospect.service.ts`:

- **Ownership invariant (uniform across roles):** "my prospects" is always
  `assignedUserId === session.user.id`, regardless of role —
  `admin-my-prospects.service.ts:46-51` filters by `adminId` identically
  to how commercial services filter by the commercial's own id. Role only
  changes which *other* prospects are visible (ADMIN/MANAGER see
  unscoped reads; COMMERCIAL sees owner-scoped reads via
  `buildCommercialProspectByIdWhere`). This invariant should carry forward
  unchanged: `assignedUserId` keeps referencing global `User`, with an
  *independent* `organizationId` filter added alongside it — not a
  replacement of the ownership field with a Membership FK. (A Prospect's
  owner is a specific human doing the work; which organization the work
  belongs to is orthogonal metadata on the same row.)
- **Creation** (`createProspectCore`, `prospect-creation.service-core.ts:33`,
  `buildProspectData:72`): `assignedUserId = actor.id`,
  `agentName = "${actor.firstName} ${actor.lastName}"`, always — the actor
  is "whoever is authenticated" (not role-restricted, per an in-code
  comment). No product/prospect cross-entity validation exists today
  because there is no per-org product catalog to validate against — see
  §11.
- **"Could a Product from Org B attach to a Prospect from Org A?"** —
  structurally impossible today only because `RelaisProduct` is a single
  global enum with no organization concept at all, not because any
  validation prevents it. Once organization-specific catalogs exist, this
  becomes a real question requiring an explicit same-org check.
- **Could a Prospect ever move between organizations?** No code path
  attempts this, and the ticket's expected answer (no) should become an
  explicit enforced invariant once `Prospect.organizationId` exists
  (e.g., never included in any update's allow-listed fields).

---

## 11. Products — the most important productization finding

**There is no `Product` model.** `RelaisProduct` (`KARMDA`, `LOKARI`,
`NIA`, `DIGITAL_SERVICES`) is a plain Prisma enum
(`schema.prisma:14-19`), referenced by `Prospect.product` and
`LedgerEntry.product` (nullable). It is not merely referenced as a
column — it is deeply compiled into the application:

- Dedicated routes per product: `app/products/karmda/page.tsx`,
  `app/products/lokari/page.tsx`, `app/products/digital-services/page.tsx`,
  `app/schools/page.tsx`.
- Dedicated per-product Prospect form components: `KarmdaFields.tsx`,
  `LokariFields.tsx`, matching nullable wide-table columns on `Prospect`
  (`schema.prisma:432-452`): KARMDA (`schoolType`,
  `estimatedStudentCount`, `currentSchoolSystem`, `contactRole`), LOKARI
  (`propertyOwnerType`, `estimatedPropertyCount`, `propertyCountries`,
  `currentPropertySystem`), NIA (`savingsGroupType`,
  `estimatedMemberCount`, `contributionFrequency`, `currentSavingsSystem`),
  DIGITAL_SERVICES (`businessCategory`, `requestedService`).
- Dedicated directory services: `school-directory.service*` (whose own
  comment states "a 'school' is a KARMDA prospect — the only RELAIS
  product about schools"), `digital-services-directory.service*`,
  `product-directory.service-core.ts` (per-product static descriptions).
- Validation branches on literal enum values:
  `src/lib/validations/prospect.schema.ts:164`
  (`if (data.product === "KARMDA" && !data.schoolType)`).
- Used as a `groupBy`/filter key throughout finance, analytics, and the
  shared feed — roughly 40 files import `RelaisProduct` or its values.

**Live data reality check:** of 222 prospects, 114 are `KARMDA` and 108
are `DIGITAL_SERVICES`; **`LOKARI` and `NIA` have zero prospects** in
production today. Two of RELAIS's own four "products" are unused, which
is a second, independent signal (beyond tenancy) that this catalog
representation may already be over-fit.

**This is a genuine SaaS domain-assumption blocker, not RELAIS
branding.** Onboarding a customer #2 with a different product catalog, or
any number of products other than exactly these four, requires a schema
migration and new UI routes/components today — organization-level
*configuration* cannot solve it, because there is no organization-scoped
data to configure. Rank: **P1**, and arguably the single largest piece of
work in the "required organization configuration" bucket (§28 in the
required deliverable list / P0-P3 in §44).

Every relation from Prospect/analytics/finance to "product" is therefore
a relation to a compiled enum value, not a tenant-scoped foreign key —
there is nothing to "enforce tenant consistency" on yet, because there is
no per-tenant catalog to be inconsistent with.

---

## 12. ProspectActivity

Confirmed via `prospect-activity.service.ts:20` and the schema: activities
belong to `Prospect` via `prospectId` (`onDelete: Cascade`). Actor
attribution is the `agentName` text snapshot (nullable), never a `User`
relation — already correct for historical stability (§1). Organization
can be safely derived from `Prospect` forever **if and only if** "a
Prospect can never move between organizations" becomes an enforced
invariant (§9) — no code path today attempts to move one, so this is
achievable, but should be explicit (e.g., `organizationId` excluded from
every future Prospect-update allow-list) rather than assumed.

**IDOR note:** `getProspectActivities(prospectId)`
(`prospect-activity.service.ts:20`) does a bare
`prisma.prospect.findUnique({ where: { id } })` with no ownership check,
relying entirely on the calling page having already verified access to
that prospect. This is an undocumented trust boundary today (harmless,
single tenant) and a defense-in-depth gap worth closing when
organization scoping is added (§21).

**Recommendation:** classify as tenant-owned child (derived scope is
structurally safe), but still denormalize `organizationId` onto the row
for query-safety/index reasons (§24), not because derivation is unsafe.

---

## 13. ProspectAction

Confirmed via `prospect-action.service-core.ts` and
`prospect-action.service.ts`:

- `assignedToUserId` is client-supplied input, validated only for
  `active: true` via `findAssignee` (`service-core.ts:166-174`) — **no
  compatibility/team/org check beyond active status.**
- `createdByUserId` is always the authenticated actor, never client-supplied.
- `canCompleteProspectAction`/`canCancelProspectAction`
  (`service-core.ts:48,63`) authorize by **role + identity only**: any
  assignee/creator, or any `ADMIN`/`MANAGER` regardless of relationship
  to the prospect. **This is the clearest cross-tenant write risk found
  in this audit**: once organizations exist, an Org-A ADMIN's blanket
  override would let them complete/cancel Org-B's actions unless an
  implicit same-organization constraint is added to the override itself,
  not just to the surrounding route gate.
- `prisma.prospectAction.findUnique({ where: { id } })` inside
  `completeProspectAction`/`cancelProspectAction`
  (`service-core.ts:142,154`) is unscoped by prospect/org; authorization
  is role/identity-based only, compounding the point above.
- `listProspectActionsForProspect(prospectId)`
  (`prospect-action.service.ts:165`) is a bare `findMany`, explicitly
  commented as "inheriting" the caller's ownership check rather than
  re-implementing it — same undocumented-trust-boundary pattern as §12.
- Inside `submitProspectFollowUp`
  (`prospect-follow-up.service.ts:53,66`), the `Prospect` lookup IS scoped
  (`buildProspectWhere`), but the nested `prospectAction.findUnique({where:
  {id: actionId}})` is bare, trusting the actionId came from the
  already-scoped prospect's own UI.

**Recommendation:** `organizationId` derivable from `Prospect` (same as
§12), but the four `User` relations must be validated independently
against that organization at every write — this cannot be solved by
`organizationId` alone since these are direct FKs to `User`, not to
`Prospect`.

---

## 14. Notes

Confirmed via `personal-note.service.ts:27-70`: every method scopes by
`{ id: noteId, userId }` or `{ userId }` — purely personal-global today,
and **zero rows exist in production** (`personalNotes: 0` in the live
count, §29), so this domain carries zero migration risk regardless of
which way it's decided.

No admin/manager cross-user notes view exists anywhere
(`app/notes/layout.tsx` gates only on `requireAuthenticatedUser()`).

**Classification:** the ticket's own framing is correct — these are
"personal within an organization" (work notes), not personal-global. If
Hamza belongs to two SaaS organizations, `/notes` should not show the
same list in both. Recommend a direct `organizationId` on `PersonalNote`
(not derived, since `User` will be global identity and a note's org
context cannot be safely inferred from a User's *current* memberships if
they hold several).

---

## 15. Daily Reports

Confirmed via `daily-report.service.ts` and `daily-report.service-core.ts`:

- `templateType` snapshot behavior is correctly implemented: set only in
  the creation dependency (`daily-report.service.ts:143`,
  `service-core.ts:669,674`, reading `user.dailyReportTemplateType` only
  at creation time), never re-derived on any read.
- All **owner-scoped** reads/writes (`findOwnByDate`, `findOwnById`,
  `listOwn`, updates, submit) filter by `{ id, ownerUserId }`
  (`daily-report.service.ts:110-167`) — safe today, and the pattern
  extends cleanly to "+ organizationId."
- **IDOR risk:** `findForManagement`
  (`prisma.dailyReport.findUnique({ where: { id: reportId } })`,
  `daily-report.service.ts:184-187`) has **no scope beyond the raw ID** —
  access is gated only by the caller being ADMIN/MANAGER upstream, not by
  the service. `listForManagement`/`buildManagementWhere`
  (`daily-report.service.ts:79-96,169-181`) similarly take only optional
  filters (`ownerUserId?`, `status?`, `templateType?`, date range) with
  **no mandatory tenant filter** — today this implicitly scans the whole
  (one) company; once orgs exist, an Org-A manager could fetch any
  `reportId` including Org B's.

**Recommendation:** "authored by that user's membership in Organization
A" is the correct future framing per the ticket. Preserve the
`templateType`-snapshot discipline exactly, and apply the same
snapshot-at-creation treatment to a new `organizationId` field. Fix the
management-lookup IDOR as part of the same ticket that adds tenant
scoping to this domain, not as an afterthought.

---

## 16. Finance

Confirmed via `financial-ledger.service.ts`:

- Creation is ADMIN-only (`app/finances/new/page.tsx:24`); read of
  `/finances` and `/finances/reports` requires `requireRole("ADMIN",
  "MANAGER")`.
- Reversal is atomic and correct: `reverseAtomically`
  (`financial-ledger.service.ts:182-201`) does a guarded
  `updateMany({where:{id:originalId,status:"POSTED"}})` then creates the
  reversal row with `reversalOfId: originalId`, both inside one
  `$transaction` — prevents double-reversal races. Live data confirms
  this is clean: **zero** REVERSED entries lacking a `reversedBy` link,
  and **zero** reversal pairs with mismatched type or differing amount
  (verified against all 51 production rows, §29).
- The "effective movement" rule (`status=POSTED && reversalOfId===null`)
  lives in `isEffectiveLedgerMovement`, consumed by
  `getEffectiveFinancialLedgerSummaryCore` — its only filters are
  `product`/date range, never identity, so it's tenant-safe to extend
  once `organizationId` exists.
- **IDOR risk**, same shape as §15: `findById`/`getLedgerEntryById`
  (`financial-ledger.service.ts:160-180`) and `reverseLedgerEntry`'s
  `originalId` lookup trust the raw ID alone, as does
  `app/finances/ledger/[entryId]/page.tsx`.
- **Reversal same-tenant enforcement is a required app-level check**, not
  a DB-expressible one: `reversalOfId @unique` (`schema.prisma:582`) only
  guarantees a reversal points at exactly one original — it cannot
  guarantee both rows share the same future `organizationId`. This must
  be validated in `reverseAtomically` itself once tenancy exists.

Finance must be strictly tenant-owned with a direct `organizationId`
(§3) — there's no parent to derive it from.

---

## 17. À la une (`/updates`)

Already exhaustively audited as of 2026-08-21 in
`notes/ticket-25a-updates-event-coverage-audit.md`; this section only adds
the multi-tenancy angle, which that document did not need to consider.

The feed's four source queries (generic `ProspectActivity` interactions,
`FOLLOW_UP` activities, `WON_TRANSITION` activities, all
`UserStatusActivity` rows) are **fully unscoped** — a straight
company-wide merge by design, confirmed unchanged since 25A. This is
**the single largest cross-tenant leak surface found in this audit**:
adding Organization B today would put Org B's follow-ups, WON events, and
user activations directly into Org A's `/updates` feed unless all four
queries gain a tenant predicate simultaneously. Because the feed is a
pure read-time projection (25A, §15 of this doc) with no stored state,
fixing this is exactly "add `organizationId` to four `where` clauses" once
the source models have that column — no separate feed-history migration
is needed.

`/actions` (`requireProspectActionQueueAccess`) has the same
company-wide-by-default shape today but a smaller blast radius since it's
already scoped to ProspectAction, which will inherit Prospect's
organization.

---

## 18. Analytics

Confirmed via `sales-funnel-analytics.service.ts` and
`sales-why-analytics.service.ts`:

- Funnel analytics roots on an unscoped `prisma.prospect.findMany` (line
  46); Why analytics roots on an unscoped `prisma.prospectActivity.findMany`
  with a `prospect: {...}` relation filter (line 37).
- Both accept `filters.product` and `filters.ownerUserId` and splice them
  **directly** into the Prisma `where` clause with **no validation** that
  the value is "in scope" (`sales-funnel-analytics.service.ts:34-43`,
  `sales-why-analytics.service.ts:32-35`). `ownerUserId` traces back to
  raw `searchParams.userId` (`app/admin/page.tsx:34-40` and equivalents),
  never checked against an allow-list of real/active/in-scope users.
- Today this is harmless — single tenant, and a foreign/non-existent
  `userId` just yields zero rows. **Once organizations coexist, an
  org-scoped base query becomes mandatory, and secondary `ownerUserId`/
  `product` filters must be independently validated as belonging to the
  resolved organization** — otherwise a filter value alone (with no other
  exploit needed) could be used to probe or select another org's data if
  the base query scoping is ever missed on one code path.

**Recommendation:** scope once at the base query (§31's general
principle) AND re-validate every secondary ID/enum filter against that
same scope — do not treat base-query scoping alone as sufficient, since
these services already demonstrate the pattern of accepting filter IDs
without provenance checks.

---

## 19. & 20. Dashboards and shared operational routes

**Dashboards**, confirmed via `KpiCards.tsx`, `prospect.service.ts`, and
`CommercialKpiCards.tsx`:

- Admin `KpiCards` computes from whatever `prospects` array
  `app/admin/page.tsx` passed in, sourced from `getProspects(filters)` →
  `prisma.prospect.findMany({ where: buildProspectWhere(filters) })`
  (`prospect.service.ts:43-45`) — **no owner/tenant restriction by
  default.** This matches the ticket's expected semantics ("221 prospects
  → Organization-wide") and simply needs an org filter added.
- `CommercialKpiCards` is scoped to the authenticated commercial's own
  prospects — "Mes prospects" is membership-owned, exactly as expected.

**Shared routes**, gate + data-source summary:

| Route | Access gate | Data scope today | Tenant risk |
|---|---|---|---|
| `/actions` | `requireProspectActionQueueAccess` (ADMIN/MANAGER/COMMERCIAL) | ProspectAction-based | Inherits Prospect's future org scope |
| `/updates` | `requireSharedFeedAccess` (same roles) | **Fully unscoped**, company-wide merge | **Highest** — see §17 |
| `/notes` | `requireAuthenticatedUser()` only, no role check | `userId`-scoped | Needs org key added (§14); currently zero rows in production |
| `/reports` | `requireAuthenticatedUser()` only | Owner-scoped reads safe; `/admin/reports` management reads are the IDOR risk from §15 | Management view |
| `/products` | `requireRole("ADMIN","MANAGER","COMMERCIAL")` | Enum-derived counts, not organization data at all | Nothing to scope — the catalog itself is the blocker (§11) |
| `/profile` | `requireAuthenticatedUser()`, self-service only | No cross-user path found | Low |

---

## 21. Detail-by-ID / IDOR inventory

Every bare ID-based lookup found on a tenant-owned model, across all four
research passes:

| Model | Operation | File:line | Scoped today? |
|---|---|---|---|
| Prospect | `findUnique` in `getProspectById` | `src/services/prospect.service.ts:58` | **No** — bare ID, gated only by `requireRole("ADMIN","MANAGER")` upstream (`app/admin/prospects/[prospectId]/page.tsx:52-53`) |
| Prospect | `getCommercialProspectById` | `src/services/commercial-prospect.service.ts:42` | Yes — `assignedUserId`-bound via `buildCommercialProspectByIdWhere` |
| Prospect (KARMDA) | `getSchoolSummaryById` | `src/services/school-directory.service.ts:52` | Scoped to `product:"KARMDA"` only, intentionally company-wide by design — needs org scoping, not owner scoping |
| Prospect (DIGITAL_SERVICES) | `getDigitalServicesProspectById` | `src/services/digital-services-directory.service.ts:42` | Same pattern as above |
| Prospect | `getProspectActivities(prospectId)` | `src/services/prospect-activity.service.ts:20` | **No** — bare `findUnique`, relies on caller |
| ProspectAction | `listProspectActionsForProspect(prospectId)` | `src/services/prospect-action.service.ts:165` | **No** — relies on caller |
| ProspectAction | `findUnique` in `completeProspectAction`/`cancelProspectAction` | `src/services/prospect-action.service-core.ts:142,154` | **No** — role/identity authorization only, see §13 |
| Prospect / ProspectAction | nested lookups in `submitProspectFollowUp` | `src/services/prospect-follow-up.service.ts:53,66` | Prospect lookup scoped; nested `actionId` lookup at line 66 bare |
| Prospect | prev/next navigation | `src/services/prospect-navigation.service.ts:25,31` | Scope comes from caller-supplied `where` builder, not independently verified |
| DailyReport | `findForManagement` | `src/services/daily-report.service.ts:184-187` | **No** — bare ID |
| LedgerEntry | `findById`/`getLedgerEntryById` | `src/services/financial-ledger.service.ts:160-180` | **No** — bare ID |
| LedgerEntry | `reverseLedgerEntry` original lookup | `src/services/financial-ledger.service.ts` (`reverseAtomically`) | **No** — bare ID |
| LedgerEntry | detail page | `app/finances/ledger/[entryId]/page.tsx` | **No** — fetches by raw ID |

**Pattern:** none of these are exploitable today (one tenant, and every
one sits behind a role gate), but every single one becomes a genuine IDOR
the moment a second organization's rows exist in the same tables. This
list should become the literal work-item checklist for whichever 26-series
ticket adds tenant scoping to reads.

---

## 22. Write-path isolation risks

Dangerous foreign-key inputs, i.e. values accepted from a client/session
that reference another tenant-owned row, without a same-tenant check
today (because none is possible yet):

| Write | Foreign ID accepted | Validated today? | Future requirement |
|---|---|---|---|
| Create Prospect | none foreign — `assignedUserId` is always `actor.id` | N/A | Once orgs exist, actor's organization must match the target organization being written into |
| Create ProspectAction | `assignedToUserId` (client-supplied) | Only `active: true` (`findAssignee`) | Must additionally validate assignee shares the prospect's organization |
| Complete/cancel ProspectAction | role-based override (ADMIN/MANAGER, no ID at all) | Role only | **P0** — override must gain an implicit same-organization constraint (§13) |
| Ledger reversal | `originalId` (self-relation FK) | Exists + `status=POSTED` only | Must validate `reversalOf.organizationId === entry.organizationId` |
| Any of the §21 bare-ID reads used to *seed* a subsequent write (e.g. fetch-then-update flows) | the fetched row's ID | Not validated | Same fix as the read-path entries closes this transitively |

No write path today accepts a raw "prospectId"/"productId"/"userId" that
crosses two *different* tenant-owned roots in a way that could be
detected — because there is only one tenant. The risk is entirely
prospective, but concrete: it is exactly the set of writes above.

---

## 23. Unique-constraint audit

Exhaustive, from a full schema re-read — the ticket's own worked examples
assume more constraints already exist than actually do:

| Constraint | Current scope | Recommendation |
|---|---|---|
| `UserCreationActivity.subjectUserId @unique` | Global (1:1 per user) | Stays global — structurally 1:1 with a global `User` row regardless of org |
| `DailyReport.@@unique([ownerUserId, reportDate])` | Per user | Must become per-membership: `[ownerUserId, organizationId, reportDate]` — otherwise a user in two orgs could not submit a report to Org B on a day they already reported for Org A |
| `LedgerEntry.reversalOfId @unique` | Global (1:1 reversal pairing) | Stays global as a pairing constraint, but must ALSO be app-validated for same-`organizationId` (§16, §22) — a unique constraint can't express a cross-row-value check |
| **`User.email` — not `@unique` today** | Not enforced at all | **Existing-state finding, independent of tenancy**: `email String?` (`schema.prisma:227`) has no `@unique`/`@@unique`. Login (`authenticateCore`) must therefore use `findFirst`, not `findUnique`, and two users could already share an email. Decide this *before* deciding org-scoped vs. global email uniqueness — right now there is no uniqueness guarantee to preserve or relax |
| Everything else (`Prospect`, `ProspectActivity`, `ProspectAction`, `UserStatusActivity`, `PersonalNote`) | No `@unique`/`@@unique` beyond implicit PK | Nothing to migrate |

---

## 24. Index recommendations

Every current `@@index` (17 total) is single/double-column with no
`organizationId` (expected — it doesn't exist yet). Realistic future
hot-path composites, mirroring existing indexes with `organizationId`
prepended:

- `Prospect`: `[organizationId, status]`, `[organizationId, assignedUserId]`, `[organizationId, createdAt]`, `[organizationId, followUpDate]` (mirrors existing `status`/`assignedUserId`/`createdAt`/`followUpDate` indexes, `schema.prisma:460-466`)
- `ProspectActivity`: `[organizationId, occurredAt]` if denormalized (mirrors `[prospectId, occurredAt]`, `schema.prisma:499`)
- `ProspectAction`: `[organizationId, status, dueAt]` (mirrors `[prospectId, status, dueAt]`, `schema.prisma:554`)
- `LedgerEntry`: `[organizationId, occurredAt]`, `[organizationId, status]` (mirrors existing indexes, `schema.prisma:590-596`)
- `DailyReport`: `[organizationId, reportDate]`, `[organizationId, status, reportDate]`
- Future `OrganizationMembership`: `[organizationId, role]`, `[organizationId, active]` (mirrors today's `User` indexes on `role`/`active`, `schema.prisma:264-266`, which are today's proxy for "who can I assign this to")

Not proposing anything beyond mirroring what's already indexed —
premature optimization is explicitly out of scope per the ticket.

---

## 25. Referential / deletion semantics

Full `onDelete` inventory from the schema:

- `Prospect.assignedUser` → `SetNull` — deassigning a removed user keeps
  the Prospect; already the "soft" pattern the ticket wants generalized
  to membership removal.
- `ProspectActivity.prospect` → **`Cascade`** — deleting a Prospect
  deletes its entire activity history. Latent risk: nothing in the
  codebase currently deletes a Prospect (no delete path found in any
  service), so this is inert today, but it must be revisited to
  `Restrict` (or an explicit archival flow) before any future
  tenant-initiated "delete my data" capability, since it directly
  contradicts §1's "history survives" principle.
- `ProspectAction.prospect` → `Restrict`, and all four `ProspectAction`
  → `User` relations → `Restrict` — already matches the desired
  "history survives membership removal" pattern.
- `UserStatusActivity`/`UserCreationActivity` → `User` → `Restrict` —
  correct; a `User` can never be hard-deleted while history references it.
- `LedgerEntry.createdByUser` → `Restrict`, `LedgerEntry.reversalOf` →
  `Restrict`.
- `DailyReport.owner` → `Restrict`.
- `PersonalNote.user` → `Restrict`.

**Conclusion:** the codebase already treats `User` as effectively
non-hard-deletable everywhere except the one relation
(`Prospect.assignedUser`) where reassignment, not authorship, is the
point. This is exactly the right foundation for "membership deactivated,
not user deleted." The one real gap is `ProspectActivity`'s `Cascade`,
which should become `Restrict` (or be paired with an explicit archival
design) before any hard-delete capability is introduced, tenancy or not.

**What happens if a membership is removed from an organization?**
Following the existing pattern, it should mean "membership.active =
false," never a hard delete — preserving old follow-ups, reports, WON
attribution, and action history exactly as `User.active = false` already
preserves them today for a deactivated global account.

---

## 26. Employee deactivation semantics

`User.active` (`schema.prisma:234`) disables the account globally today —
`authenticateCore` refuses login entirely if `!active`. In SaaS, this
conflates two genuinely different facts:

> global account disabled (this human should never log in to this
> product at all) — vs. — membership disabled in Organization A (this
> human should no longer act on Organization A's data, but might still be
> active in Organization B)

A person could legitimately be active at Company A and inactive at
Company B. Today's single boolean cannot represent that; it belongs on
`OrganizationMembership`, with `User.active` (if kept at all) meaning
something narrower like "this login can authenticate at all, across any
organization." **Do not solve this in 26A** — flagged as a required
design decision for 26B's Membership model (§4).

**Live data note:** 6 of 68 `ProspectAction` rows are currently assigned
to a `User` with `active = false` (read-only count, §29) — i.e. RELAIS
already has real historical/open actions tied to a deactivated employee.
This confirms the "history must survive deactivation" requirement isn't
hypothetical; it's already true in production data today, and any future
migration must not orphan or hide these.

---

## 27. Daily Report template assignment

`User.dailyReportTemplateType` (`schema.prisma:236-240`, nullable) is
read only inside `DailyReport` creation
(`daily-report.service-core.ts:669,674`) — confirmed never read anywhere
else that would need updating. It almost certainly belongs on
`OrganizationMembership`, not `User`, per §4/§5: the report template
reflects an organizational role structure, not a property of the human.

Live distribution today: `ASSISTANT` (1), `OPERATIONS_COORDINATOR` (2),
`null` (11) — i.e. most current users don't submit daily reports at all,
which is consistent with the field being genuinely organization-specific
configuration rather than universal identity.

---

## 28. Role-history reinterpretation

25C's `UserCreationActivity.roleAtEvent` currently means "this global
user's `UserRole` value at the moment their account was created." Under
SaaS conversion, this must be reinterpreted as **"this membership's role
at the moment the membership was created,"** never as a global SaaS-wide
role concept. Existing RELAIS creation events keep their current, correct
meaning (they *did* happen at RELAIS, with that role, at that time) — see
§6. No modification to existing rows is needed; only the *semantic label*
attached to `roleAtEvent` changes going forward, and it must be paired
with an `organizationId` captured the same way (§1).

---

## 29. RELAIS tenant #1 backfill feasibility

Live, read-only row counts (queried 2026-08-26, `.count()`/`.groupBy()`
only, script deleted immediately after use, no repository or database
mutation):

| Model | Count |
|---|---:|
| User | 14 |
| Prospect | 222 |
| ProspectActivity | 89 |
| ProspectAction | 68 |
| DailyReport | 15 |
| LedgerEntry | 51 |
| PersonalNote | 0 |
| UserStatusActivity | 4 |
| UserCreationActivity | 0 |

Supporting breakdowns:

- Users by role: `COMMERCIAL` 10, `MANAGER` 2, `ADMIN` 2.
- Users by active: `true` 10, `false` 4.
- Users by `dailyReportTemplateType`: `OPERATIONS_COORDINATOR` 2,
  `ASSISTANT` 1, `null` 11.
- Prospects by product: `KARMDA` 114, `DIGITAL_SERVICES` 108, `LOKARI` 0,
  `NIA` 0.
- LedgerEntry by product: `null` 48, `KARMDA` 3 (the rest use no
  product-linked category).
- `UserCreationActivity` rows: 0 of 14 users have one — 100% pre-25C,
  exactly as that ticket's own note expects (no backfill was performed,
  by design).

**Key question — "is there any existing record that does NOT belong to
RELAIS?" Answer: no.** Every table is a single connected dataset with no
cross-company markers of any kind. RELAIS-tenant-#1 backfill is
historically truthful for every one of the 9 models above: attaching
`organizationId = <RELAIS org id>` to every existing row is not an
inference, it is a restatement of fact.

---

## 30. Existing data anomalies

Read-only anomaly checks against the same live snapshot:

| Check | Result | Migration implication |
|---|---:|---|
| Prospects with no `assignedUserId` | 0 | Full ownership coverage — no orphan-owner cases to handle |
| ProspectActions assigned to an inactive user | **6** | Confirms §26's point with real data: history involving deactivated employees already exists and must survive migration untouched |
| Users without email | 0 | — |
| Users without `passwordHash` | 0 | — |
| LedgerEntry `status=REVERSED` with no `reversedBy` link | 0 | Reversal integrity is clean — no anomaly to reconcile before migration |
| Reversal pairs with mismatched type or differing amount | 0 (checked all reversal pairs) | Reversal semantics (23A/23B) are clean; safe to preserve as-is |
| Users with no `UserCreationActivity` | 14 of 14 | Expected (pre-25C, no backfill performed there either — consistent precedent for 26A/26B not backfilling actor identity that never existed) |

**Conclusion:** no repair work is needed before a tenant backfill —
the dataset is unusually clean for this kind of audit. This lowers risk
for the RELAIS-backfill step specifically (§29), though it says nothing
about the application-layer IDOR/isolation risks documented in §21-22,
which are about code paths, not data quality.

---

## 31. Direct `organizationId` strategy, model by model

Rejecting both blanket rules ("every table gets it" / "only roots get
it") per the ticket's instruction, the model-by-model recommendation is
already stated in the ownership matrix (§2/§3) and repeated here as a
single decision table:

| Model | Strategy | Why |
|---|---|---|
| `Prospect` | Direct | Root, no parent |
| `LedgerEntry` | Direct | Root, no parent, self-referencing reversal needs same-org app-level enforcement |
| `DailyReport` | Direct, snapshotted at creation | Historical row; owner's *current* membership org must never be trusted at read time (§1) |
| `PersonalNote` | Direct | A `User` may hold multiple future memberships; org context can't be safely inferred from current identity state |
| `OrganizationMembership` (new) | Direct (it *is* the org-linking table) | N/A |
| `UserStatusActivity` / `UserCreationActivity` | Direct, frozen at event time | Historical; must not be derived from subject's current membership (§1, §6) |
| `ProspectActivity` | Derived from `Prospect`, **but denormalize `organizationId` anyway** | Structurally safe to derive only if "Prospect never changes org" is an enforced invariant; denormalize for query-safety/index reasons (§24), not because derivation is theoretically unsafe |
| `ProspectAction` | Derived from `Prospect` for the org axis, **but the four `User` FKs need independent same-org validation regardless of whether `organizationId` is denormalized** | The org-derivation question and the "are these four users in-scope" question are separate risks; denormalizing `organizationId` doesn't solve the second one |
| `User` | None (this is the point — it becomes pure global identity) | — |

---

## 32. Tenant context architecture

Given §7's finding (identity, authorization, and — absent — tenant
resolution are currently collapsed into `session.user.role`), the
recommended shape, informed by what's actually queried across the
services audited:

```ts
type TenantContext = {
  userId: string;            // global User.id — "who"
  organizationId: string;    // resolved membership's org — "where"
  membershipId: string;      // the specific membership row — needed because
                              // role/active/dailyReportTemplateType all live here
  role: UserRole;             // membership-scoped, not global
  active: boolean;            // membership-scoped
};
```

This should be constructed **once**, immediately after
`requireAuthenticatedUser`, and threaded into every service call that
currently takes a bare `userId`/`role` pair (§8's "domain business logic"
group) — mirroring the existing `projectSummary.md` principle #6
("later this becomes `session.user.id` — no business logic should
change"), applied one layer further: services should receive
`TenantContext`, not reconstruct scoping from separate role/id
parameters at each call site.

---

## 33. Tenant resolution for V1

Given there is currently no multi-membership concept at all, and no
`middleware.ts` to intercept centrally (§7), the pragmatic V1 approach:

- **Data model capability:** support `User` → many `OrganizationMembership`
  rows from day one (don't foreclose it structurally).
- **V1 UX capability:** resolve tenant automatically from the user's
  single active membership at login — deliberately support exactly one
  active organization per login session initially, with no selector UI.
  If a user somehow holds two memberships in V1 (shouldn't happen for
  RELAIS's real employees, but the model allows it), pick a deterministic
  rule (e.g., most-recently-active) and treat the "switch organization" UX
  as explicitly out of V1 scope (§42).
- This distinguishes model capability from UX capability exactly as the
  ticket asks — the Membership table doesn't need a V1 organization
  switcher to justify existing from day one.

---

## 34. Database-level isolation (RLS) feasibility

`src/lib/prisma.ts` (10 lines): a single process-wide `PrismaClient`
using `@prisma/adapter-pg` with a plain `PrismaPg({ connectionString })`
pool, cached on `globalThis` in development. Postgres RLS depends on a
session-local GUC (`SET LOCAL app.current_org_id = ...`) set on the same
connection/transaction running the query, then reset — which requires
wrapping every tenant-scoped call in an explicit
`prisma.$transaction(async (tx) => { await tx.$executeRaw\`SET LOCAL
...\`; ... })`. This is:

- **Feasible** — Neon is managed Postgres and supports RLS at the DB level.
- **Not a shortcut** — it requires touching essentially every current
  query call site (the same set of call sites that need explicit
  `WHERE organizationId = ...` filtering anyway), PLUS RLS policy DDL,
  PLUS a process to keep policies in sync with schema changes.
- **Not first-class in Prisma** — there is no built-in "current tenant"
  session API; this would be hand-rolled raw-SQL discipline layered on
  top of, not instead of, application-level scoping.

**Recommendation:** defer RLS to post-V1 hardening (§42/§44, P2). Treat it
strictly as defense-in-depth for a future phase, never as a substitute for
the explicit service-level `organizationId` filtering this audit's IDOR
inventory (§21) already shows is necessary regardless.

---

## 35. & 36. Background operations and repository scripts

**No cron/background/scheduled logic exists anywhere in the app** —
confirmed by a repo-wide grep for `cron|node-cron|setInterval|scheduled
job|background job` across `src`, `app`, and `scripts`: zero matches. The
only non-request-driven code paths are the five files in `scripts/`.

| Script | Mutates? | Scope | Classification |
|---|---|---|---|
| `bootstrap-admin.ts` | Yes (create) | Global, no org concept; hardcodes `firstName: "Hamza", lastName: "Mare"` for the very first admin | Global administration — needs an explicit target-organization param post-26 |
| `set-user-password.ts` | Yes (update) | One global `User` row, no org scoping | Development/test or admin maintenance — exactly the class of script the repo's 25F rule (never mutate real credentials for test access) targets; must require explicit organization context once multi-tenant |
| `prospect-owner-mappings.ts` | No (static data file) | Global (single tenant assumed) | Historical migration input |
| `reconcile-prospect-owners.ts` | Yes (`updateMany`) | Whole `Prospect` table, no org filter; gated by a `CONFIRM_PROSPECT_OWNER_RECONCILIATION=YES` env flag plus a "create a Neon restore point" comment | Historical migration — a real, already-existing precedent for how a future *tenant-scoped* backfill script should be gated |
| `report-unreconciled-prospect-owners.ts` | No (read-only) | Whole `Prospect`/`User` tables | Tenant-specific maintenance (reporting) — would need an org filter to stay correct per-tenant later |

`prisma/migrations/` (14 directories) is pure schema history, one per
prior ticket — no seed file exists anywhere in `prisma/`, so there are no
baked-in org/seed assumptions to unwind. No script changes are made in
26A, per the ticket's instructions; future tenant-specific scripts should
require explicit organization selection rather than silently touching
every tenant, following `reconcile-prospect-owners.ts`'s own
confirmation-flag precedent.

---

## 37. Test-fixture strategy

There is **no shared/centralized test-fixture module** anywhere in the
repo. Each `*.service-core.test.ts` file defines its own local in-memory
store and factory functions inline — e.g. `createUserStore()` and
`makeUser()` in `src/services/user.service.test.ts:358,419`, with a local
`validUserInput()` helper hardcoding fixture data ("Aminata", "Ouédraogo",
`role: "COMMERCIAL"`, etc.). This pattern repeats independently across
the roughly 140 test files listed in `package.json`'s `test` script.

**Implication for the recommended future fixture** (Organization A:
Admin/Manager/Commercial/Prospect; Organization B: Admin/Commercial/
Prospect): there is no existing shared infrastructure to extend. Building
it is net-new shared-helper work, and migrating tests to use it means
touching each test file's local fixture individually rather than
editing one central factory. This should be scoped as its own ticket
(or the first task of the ticket that introduces cross-tenant isolation
tests), not bundled invisibly into the schema-foundation ticket. No
fixture rewrite is done in 26A.

---

## 38. Cross-tenant threat matrix (future test backbone)

Expanded from the actual codebase (§21/§22 findings feed this directly):

| Actor: Tenant A member attempts | Tenant B resource | Expected | Currently reachable via |
|---|---|---|---|
| Read prospect by ID | Prospect B | Denied/not found | `getProspectById` (§21) |
| Read prospect activity | ProspectActivity B | Denied/not found | `getProspectActivities` (§21) |
| Add follow-up | Prospect B | Denied | `submitProspectFollowUp` prospect lookup (scoped today, needs org check) |
| Read/list actions on a prospect | ProspectAction B | Denied | `listProspectActionsForProspect` (§21) |
| Complete/cancel an action via ADMIN/MANAGER override | ProspectAction B | Denied | `canCompleteProspectAction`/`canCancelProspectAction` (§13, **P0**) |
| Assign an action to a foreign user | User/Membership B | Denied | `findAssignee` (§22) — active-only check today |
| View `/updates` | Org B events | Absent entirely | Four unscoped feed queries (§17, **highest-impact**) |
| View `/actions` queue | Org B actions | Absent entirely | `prospect-action-queue.service-core.ts` |
| View sales-funnel/why analytics | Org B data | Absent; filter values must be rejected, not just "yield zero rows" | Unscoped root query + unvalidated filters (§18) |
| View dashboard KPIs | Org B data | Absent | `getProspects`/`KpiCards` (§19) |
| Read daily report by ID | DailyReport B | Denied/not found | `findForManagement` (§15, §21) |
| List daily reports (management) | Org B reports | Absent | `listForManagement` (§15) |
| Read personal note | Note B | Denied/not found | Currently zero rows in prod; needs org key before any cross-user path is added (§14) |
| Read finance ledger entry | LedgerEntry B | Denied/not found | `findById`/`getLedgerEntryById` (§16, §21) |
| Reverse a ledger entry | LedgerEntry B | Denied | `reverseAtomically` originalId lookup (§16, §22) |
| Select a product in a foreign catalog | Product B | Denied | **N/A today — there is no per-tenant catalog to select from at all** (§11); this row can't even be tested until Products become tenant data |
| Query school/digital-services directory summary | Prospect B (via product directory) | Denied | `getSchoolSummaryById`/`getDigitalServicesProspectById` (§21) — intentionally company-wide today, must become org-wide-within-tenant |

This matrix should become the literal backbone of the isolation test
suite once §37's fixture infrastructure exists.

---

## 39. Migration ordering constraints

Derived from actual foreign keys (schema) and the ownership matrix (§3),
not an abstract template:

```text
1. Organization                          (new, no FK dependencies)
2. OrganizationMembership                (FK -> User, FK -> Organization)
3. RELAIS Organization + Membership backfill
     (create one Organization row; create one Membership per existing
      User, copying role/active/dailyReportTemplateType — additive only,
      User's own copies of these fields untouched, per the staged
      dual-field plan in §5/§40)
4. Tenant-owned roots gain organizationId (nullable at first):
     Prospect, LedgerEntry, DailyReport, PersonalNote
5. Backfill organizationId = RELAIS on every existing row of step 4
     (justified as historically truthful by §29 — zero anomalies found)
6. Make organizationId NOT NULL on step-4 models
7. Historical children gain organizationId, frozen/backfilled the same way:
     UserStatusActivity, UserCreationActivity
     (ProspectActivity, ProspectAction may stay derived per §31, or be
      denormalized in this same step if the query-safety recommendation
      is adopted)
8. Authorization/session layer changes:
     TenantContext construction (§32), require* helpers read from
     Membership instead of User.role
9. Per-domain service isolation, one domain at a time, following the
     dependency-free order: Prospect/Activity/Action -> DailyReport ->
     PersonalNote -> Finance -> Analytics -> /updates feed (last, since
     it depends on every source model above already being scoped)
10. IDOR closure pass over the exact §21 checklist
11. Cross-tenant isolation test suite (§37/§38), run continuously from
     step 4 onward, not only at the end
```

No circular dependency exists — `OrganizationMembership` depends only on
`User` and `Organization`; every tenant-owned model depends only on
`Organization` directly or transitively via `Prospect`. This ordering
is a straightforward topological sort of the FK graph, not a novel
structure.

---

## 40. Temporary compatibility requirements

Recommend a **staged dual-field migration**, not a destructive one, for
exactly the three fields identified in §4/§5:

- `User.role` and `OrganizationMembership.role` coexist until every
  `require*` helper and every domain check (§8's "business logic" group)
  has been moved to read from the resolved `TenantContext.role` instead
  of `session.user.role`.
- `User.active` and `OrganizationMembership.active` coexist until
  `authenticateCore` and `assertActiveAccountAccessCore`/
  `assertCommercialAccessCore` have been updated to check the resolved
  membership instead of (or in addition to, during transition) the
  global flag.
- `User.dailyReportTemplateType` and
  `OrganizationMembership.dailyReportTemplateType` coexist until
  `daily-report.service-core.ts`'s creation dependency reads from the
  membership instead.

No dual-write logic is implemented in 26A — this is a recommendation for
26B/26C's execution order, matching the ticket's own instruction not to
build dual writes yet.

---

## 41. Rollout strategy assessment

**Staged migration is strongly preferred over big-bang**, for reasons the
audit itself surfaced rather than as a generic best practice:

- The IDOR inventory (§21) is a list of ~13 independent call sites across
  5 different service files — fixing them atomically in one PR would be
  large, high-risk, and hard to review; fixing them domain-by-domain
  (Prospect → DailyReport → Finance → Analytics → Feed, per §39's step 9)
  allows each domain's isolation tests to gate the next.
- The product-catalog finding (§11) is large enough to be its own
  multi-ticket workstream, decoupled from the core Organization/
  Membership foundation — bundling it into "the tenancy migration" would
  block core tenancy on a much harder, separate problem (turning an enum
  into tenant-configurable data).
- The dual-field compatibility period (§40) only makes sense in a staged
  rollout; a big-bang migration would force role/active/template
  relocation and every call-site update to happen atomically, which is
  exactly the risk profile the ticket's own historical-preservation
  principle (§1) warns against.

Recommended compatibility boundary: keep `User.role`/`active`/
`dailyReportTemplateType` authoritative (dual-written or simply
untouched) until the **entire** §8 "organization-authorization" group has
migrated to `TenantContext`, then remove them in one clean final step —
not field-by-field, since partial migration of authorization logic is
itself a security risk (some checks reading old state, some new).

---

## 42. SaaS V1 boundary

**Required for customer #2 (P0/P1 territory):**

- `Organization` + `OrganizationMembership` models (§4)
- Tenant-scoped authorization via `TenantContext` (§32)
- Tenant-owned CRM data: Prospect/Activity/Action, DailyReport,
  PersonalNote, LedgerEntry all carrying `organizationId` (§3, §31)
- Cross-tenant isolation: the full §21 IDOR checklist closed, the §13
  ADMIN/MANAGER-override same-org constraint added, the §17 feed queries
  scoped, the §18 analytics filters validated
- Basic organization creation + first-admin provisioning (a
  generalized, repeatable version of what `bootstrap-admin.ts` does
  manually today for RELAIS alone)
- **A decision on the product-catalog problem (§11)** — even a minimal
  one (e.g., a real `Product` table scoped by organization, even without
  full UI parity with today's KARMDA/LOKARI/NIA/DIGITAL_SERVICES-specific
  screens) — because without it, customer #2 literally cannot represent
  their own offering

**Not necessarily required for V1 (§42/§44 P2-P3):**

- Stripe, self-service signup, trials, custom domains
- Dynamic RBAC (today's fixed ADMIN/MANAGER/COMMERCIAL roles, now
  per-membership, are sufficient for a second hand-onboarded customer)
- Custom terminology / white-labeling beyond swapping "RELAIS" strings
  for `organization.name` (§43's branding-only bucket)
- Module marketplace
- Complex organization-switching UX (§33 — single-active-org-per-login is
  fine for V1)
- Row-Level Security (§34 — defense-in-depth, not a launch blocker)

---

## 43. RELAIS-specific assumption inventory

27 non-test files reference "RELAIS" literally. Classified:

**Branding-only** (trivially swappable for `organization.name` later):
`app/layout.tsx:16,18` (site title/description), `app/page.tsx:22`,
`app/admin/page.tsx:54`, `component/dashboard/Sidebar.tsx:56`,
`component/auth/login-form.tsx:50`, `component/users/user-table.tsx:31`,
`app/updates/page.tsx:55`, `app/finances/page.tsx:64`,
`app/finances/new/page.tsx:55-56`,
`component/propects/prospect-form-input.tsx:155` (`alt="RELAIS"`).

**Domain assumption** (blocks generic SaaS use — the serious bucket):
`src/lib/validations/prospect.schema.ts:69,164` (validation copy and
logic branching on literal `RelaisProduct` values), the entire
`school-directory.service*`/`school-duplicate.service*`/
`school-directory-navigation.ts` family (exists solely because
"KARMDA = school" is assumed), `src/lib/product-directory.ts:25,31`
(hardcoded per-product descriptions). This bucket is really one finding
(§11) expressed across many files, not many independent findings.

**Configuration** (needs organization-level data, not code, once it
exists): `src/lib/personal-note-options.ts:11-12` (`RELAIS_IDEA` — a
RELAIS-specific taxonomy value baked into the otherwise-generic
`PersonalNoteCategory` enum), `component/dashboard/BusinessStats.tsx:55`
("Répartition par produit RELAIS" label).

**Harmless default** (fine as RELAIS tenant #1's configuration, but must
become a real organization setting for any other tenant):
`src/lib/financial-report-period.ts:4,8` and
`src/lib/daily-report-date.ts:12` both hardcode the Africa/Ouagadougou
(UTC+0) business timezone — correct for RELAIS, wrong for a tenant
elsewhere.

**Answering the user's original concern** ("have we added too much
RELAIS-specific behavior to productize this?"): mostly no for
*branding* (that bucket is trivial), but **yes for the product/finance/
report-template catalogs being compiled enums rather than data** (§11) —
that is a real domain assumption, not cosmetic, and it is the one item
in this inventory that actually blocks onboarding a differently-shaped
customer.

---

## 44. SaaS productization blockers, ranked

**P0 — cross-tenant security/data correctness (must close before
customer #2's data coexists with RELAIS's):**

- `/updates` feed: all four source queries unscoped (§17)
- `getProspectById`, `getProspectActivities`,
  `listProspectActionsForProspect` bare-ID lookups (§21)
- ADMIN/MANAGER `ProspectAction` complete/cancel override with no
  same-org constraint (§13)
- `DailyReport.findForManagement`/`listForManagement` unscoped (§15, §21)
- `LedgerEntry.findById`/`reverseAtomically` originalId lookup unscoped
  (§16, §21, §22)
- Analytics `ownerUserId`/`product` filters accepted without provenance
  validation (§18)
- Admin dashboard/KPI queries organization-wide by construction with no
  filter to add one to yet (§19)
- `school-directory`/`digital-services-directory` summary-by-ID lookups,
  intentionally company-wide today (§21)
- Any future organization-scoped script (§36) run against a multi-tenant
  database without an explicit organization parameter

**P1 — required organization configuration (blocks onboarding a
differently-shaped customer even with perfect isolation):**

- Product catalog is a hardcoded enum, not data (§11) — the single
  largest item in this list
- `LedgerEntryCategory` (chart of accounts) hardcoded enum
- `DailyReportTemplateType` hardcoded enum
- `PersonalNoteCategory.RELAIS_IDEA` baked into a shared enum
- Business timezone hardcoded (Africa/Ouagadougou) in two files
- `User` → `OrganizationMembership` split itself (foundational; without
  it, none of the above can be organization-scoped)
- Repeatable organization + first-admin creation flow

**P2 — usability/customization:**

- KARMDA/LOKARI/NIA/DIGITAL_SERVICES-specific wide-table fields on
  `Prospect` (works, if awkwardly, short-term)
- Remaining branding strings (§43's branding-only bucket)
- Shared test-fixture infrastructure for multi-org testing (§37)
- Row-Level Security as defense-in-depth (§34)

**P3 — future SaaS sophistication (explicitly deferred per §42):**

- Multi-organization membership UX / organization switcher
- Self-service signup, Stripe billing, trials, custom domains
- Dynamic/configurable RBAC
- Module marketplace

The user's framing is correct and worth stating plainly: "this says
RELAIS in the header" (P2/branding) and "Tenant B can query Tenant A's
prospects" (P0) are not the same kind of problem, and this audit found
real, specific instances of both — plus a third kind neither framing
anticipated: "Tenant B literally cannot represent what they sell" (P1,
§11), which is arguably the most expensive single item on this list.

---

## 45. Revised Phase 26 ticket estimate

Pre-audit estimate: ~22 tickets, plausible range 18-28.

Having read the actual schema, auth stack, and every relevant service,
this audit revises that estimate **upward**, primarily because of two
things the pre-audit estimate couldn't have known: (a) the product
catalog is a compiled enum, not data — a whole separate workstream from
core tenancy — and (b) the IDOR inventory (§21) is ~13 independent call
sites across 5 service files, each needing individual remediation and
tests, not one central fix.

| Bucket | Estimate |
|---|---|
| **Minimum safe conversion** (Organization + Membership models, RELAIS backfill, TenantContext + authorization migration, isolation fixes for the P0 list in §44, basic isolation tests) | ~16-18 tickets |
| **Recommended conversion** (adds: Finance/Notes/DailyReport uniqueness migration §23, index rollout §24, script guardrails §36, test-fixture infrastructure §37, a first pass at making Product organization-scoped data) | ~24-28 tickets |
| **Optional, post-first-customer** (RLS §34, full org-switcher UX, dynamic RBAC, remaining product/finance-category/report-template genericization beyond the minimum needed for customer #2, self-service signup/billing) | ~8-12 tickets |

**Total plausible range for the full journey to a comfortably
productized SaaS: 24-38 tickets** depending how much of the "optional"
bucket gets pulled forward for customer #2 specifically versus deferred.
This is wider than the pre-audit estimate mainly because of the product-
catalog discovery — treat that as its own explicit sub-phase (see §46)
rather than folding it into "tenancy foundation" tickets, since the two
problems have almost no code overlap.

---

## 46. Recommended shape of Ticket 26B

Given §39's migration ordering and §41's staged-rollout preference, 26B
should be **narrow and additive**, matching this repo's existing ticket
discipline (every prior ticket in `prisma/migrations/` is a single
focused schema addition):

1. Add `Organization` model (id, name, timestamps — nothing else yet).
2. Add `OrganizationMembership` model (`organizationId`, `userId`, `role`,
   `active`, `dailyReportTemplateType`, timestamps; `@@unique([organizationId,
   userId])`) — purely additive, no FK from any existing tenant-owned
   model yet, no removal of `User.role`/`active`/`dailyReportTemplateType`.
3. Backfill: create one `Organization` row ("RELAIS"), and one
   `OrganizationMembership` per existing `User`, copying current
   `role`/`active`/`dailyReportTemplateType` verbatim — justified as
   100% historically truthful per §29's read-only audit (zero anomalies,
   zero non-RELAIS records).
4. No service, authorization, or route changes in 26B — `User.role` etc.
   remain authoritative and unchanged; the new tables exist but nothing
   reads from them yet.
5. Migration tests (matching this repo's existing
   `prisma/*.migration.test.ts` convention) proving: every `User` gets
   exactly one `OrganizationMembership`, every membership's fields exactly
   match the source `User`'s fields at backfill time, and no existing
   table/column is altered.

This keeps 26B reversible, reviewable in one sitting, and — critically —
leaves 26A's finding that "no historical row needs reinterpretation, only
a frozen `organizationId`" fully honored: 26B only ever *adds* rows, it
never rewrites the meaning of an existing one. Tenant-context wiring
(§32), authorization migration (§8/§40), and the P0 isolation fixes
(§44) should be separate tickets after 26B, each scoped to one domain
per §39's dependency order.
