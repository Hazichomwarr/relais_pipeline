# Ticket 28A — Prospect Ownership & Transfer Domain Audit

Audit date: 2026-09-05. Read-only. No schema, migration, or runtime change made.

> **Status update (2026-09-05, Ticket 28A.1): the real blocker this audit
> found in §6/§19 — `/admin/analytics/funnel` and `/admin/analytics/why`
> deriving historical attribution from live `assignedUserId` — is
> **RESOLVED**. See `notes/ticket-28a1-historical-sales-analytics-attribution-fix.md`
> for the fix. This note's factual findings below are otherwise unchanged.
> 28B may now begin.**

## 0. Executive summary

**Central question**: when responsibility for a prospect changes, what must
stay attributed to the previous commercial, and what current authority moves
to the new one?

**Answer, in one line**: the codebase already draws this line correctly
almost everywhere. `Prospect.assignedUserId` is a single, mutable, current-
responsibility pointer with no history. Every mechanism built to survive it
changing — `ProspectActivity.creditedUserId` (WON credit, frozen at the
transition), `ProspectAction`'s own `assignedToUserId`/`createdByUserId`/
`completedByUserId`/`canceledByUserId` (per-task, frozen once terminal),
`ProspectActivity.agentName` (who performed an interaction, frozen at write
time) — is already a durable snapshot, independent of current ownership. A
prospect-reassignment feature can be built on top of these without a single
schema change to protect history.

**But two things must be resolved before 28B, not silently carried forward:**

1. **Real blocker** — `/admin/analytics/funnel` and `/admin/analytics/why`
   compute "won/lost by commercial" and "why lost, by commercial" from the
   prospect's **live** `assignedUserId`, not the frozen `creditedUserId`. A
   reassignment would silently move historical win/loss/reason attribution
   from the original commercial to the new one in these two reports only.
   This is the one place the ticket's stop condition ("performance history
   dynamically depends on current ownership") is actually true today. See
   §6 and §19.
2. **Real gap, no code today, but no bypass either** — there is currently no
   generic "edit prospect" mutation at all, and `assignedUserId` is never
   client-editable. This is good news (no bypass to close), but it also means
   28B is not "add a field to an existing edit form" — it is a wholly new,
   dedicated service, because nothing today writes `assignedUserId` except
   creation and one offline, env-gated reconciliation script. See §3 and §16.

Everything else audited — user deactivation, role changes, inactive-owner
visibility, ProspectAction/follow-up decoupling, WON credit resolution,
DailyReport, the updates feed — already behaves the way the frozen product
rule requires, and is backed by existing tests. The open, product-level
decisions this audit could not resolve unilaterally (open-action transfer
policy, transfer-reason privacy, takeover-request lifecycle) are called out
explicitly in §19 and §20 rather than assumed.

---

## 1. Current ownership source of truth

`prisma/schema.prisma:768-769`:

```prisma
assignedUserId String?
assignedUser   User?   @relation(fields: [assignedUserId], references: [id], onDelete: SetNull)
```

- **Nullable.** `String?`, no default.
- **`onDelete: SetNull`** — the *only* `SetNull` relation to `User` in the
  entire schema. Every other model's FK to `User` (13+ relations across
  `ProspectAction`, `ProspectActivity`, `DailyReport`, `Workday`, `DailyTask`,
  `OrganizationMembership`, the assessment models, `LedgerEntry`,
  `UserStatusActivity`, `UserCreationActivity`) is `onDelete: Restrict`. This
  is deliberate (schema comment, `schema.prisma:324-329`): no User-deletion
  path exists in the app at all, so `Restrict` is mostly defensive, and
  `SetNull` on `Prospect.assignedUser` is the one place the schema
  anticipates a prospect legitimately outliving its owner's row.
- **Assignment is not mandatory at the schema level**, but *is* mandatory in
  practice: the sole creation path (`src/services/prospect-creation.service-core.ts:112-131`,
  `buildProspectData`) always sets `assignedUserId: actor.id` — never null,
  never a client-supplied value, never a separately-chosen assignee. Null
  values that exist today are exclusively historical: pre-migration rows
  (`prisma/prospect-user-assignment.migration.test.ts:11-19` confirms the
  column was added additively, no backfill `UPDATE`), later reconciled by
  `scripts/reconcile-prospect-owners.ts` against `agentName` text, with
  unresolved rows explicitly reported as "unresolved."
- **Owner must currently be COMMERCIAL? No — broader.** `canOwnProspect`
  (`prospect-creation.service-core.ts:18-26`) allow-lists
  `["ADMIN", "COMMERCIAL", "MANAGER"]`. ADMIN and MANAGER can and do own
  prospects operationally today (any prospect they personally create). This
  matters for §9's eligible-target question — do not narrow reassignment
  targets to COMMERCIAL-only without breaking an existing capability.
- **Inactive users can remain assigned.** Confirmed nowhere is there a
  relational filter on `assignedUser.active` — every ownership-scoped query
  (`buildProspectWhere`, `buildAdminMyProspectsWhere`,
  `buildCommercialProspectByIdWhere`) matches on the scalar `assignedUserId`
  only. `src/lib/prospect-ownership.test.ts:7-17` explicitly tests preferring
  the linked User's name "including for an inactive historical User."
- **Role changes do not affect existing assignment.** Tested invariant,
  `src/services/role-transition-ownership.test.ts:39-43,333-345`: "a role
  transition changes authorization, never ownership… a prospect assigned to A
  remains assigned to A after A transitions to ASSISTANT, but a *new*
  assignment to A is rejected." Only future assignment attempts are blocked
  by role eligibility; existing assignment survives untouched.
- **No service silently changes ownership.** Exhaustive grep of
  `.prospect.update(`/`.prospect.updateMany(` found exactly three call
  sites, none of which write `assignedUserId` (detailed in §3/§16).
- **No user creation/deactivation flow touches prospects.**
  `deactivateUserCore` (`src/services/user.service-core.ts:187-217`) only
  writes `User.active` and a `UserStatusActivity` row. No prospect read or
  write anywhere in that path.
- **No prospect import exists.** No CSV/bulk-import route, action, or
  script was found anywhere in `src/`, `app/`, or `scripts/`.
- **No seed script exists.** `prisma/` has no `seed.ts`; `package.json` has
  no seed entry. There is no seed-vs-runtime divergence to reconcile.

**What `assignedUserId` means today, precisely**: *the user who created this
prospect, and who has never been displaced, because nothing has ever
displaced anyone.* Creator and current owner are the same value by
construction for every prospect in the database today — not because the
schema conflates them, but because no reassignment mechanism has ever
existed. This is important for §16/§17 (backfill policy): it means a
future `createdByUserId` field, if introduced, could be safely backfilled
from today's `assignedUserId` for every existing row *without guessing* —
see §17.

---

## 2. Ownership-dependent reads

Single shared primitive, `src/services/prospect-read.service-core.ts:31-33`:

```ts
if (filters.userId) {
  where.assignedUserId = filters.userId;
}
```

Nearly every "my prospects" surface funnels through this or a sibling
builder. Full inventory:

| Surface | file:line | Current use | Reassignment-affected? | Notes |
| --- | --- | --- | --- | --- |
| `/admin/my-prospects` (list + KPIs) | `admin-my-prospects.service-core.ts:15-20`, `.service.ts:46-52` | `assignedUserId = adminId`, **forced**, never client-supplied | Yes | True current-ownership view |
| `/admin/prospects/[id]` detail | `prospect.service.ts:60-71` | `where: { id }` only — **no ownership scoping** | N/A (unscoped) | Any ADMIN/MANAGER views any prospect; no read-only/edit distinction computed from ownership at all |
| `/dashboard/commercial/prospects/[id]` detail | `commercial-prospect.service-core.ts:20-25` | `{ id, assignedUserId: commercialId }`, forced — 404 if not owner | Yes | The *only* detail page enforcing ownership at the data layer |
| `/products/digital-services/[id]` summary | `digital-services-directory.service.ts:41-48` | `{ id, product }` only | Indirect | Always-read-only page; reachable by any COMMERCIAL directly, ownership only gates whether a *link* to it appears |
| `/schools/[id]` summary | `school-directory.service.ts:51-58` | `{ id, product }` only | Indirect | Same pattern, KARMDA-only |
| Commercial dashboard (KPIs/pipeline/recent/follow-ups) | `commercial-dashboard.service.ts:13-44`, `commercial-performance.service.ts:17-57` | `assignedUserId = userId` throughout, forced to session | Yes | |
| LOKARI / NIA directories | `app/products/lokari/page.tsx:18-27`, `app/products/nia/page.tsx:16-27` | `getProspects({ product })` — **no owner filter on the list query** | Indirect | Every commercial sees every other's LOKARI/NIA prospect row (name/status/interest/owner); only the per-row link is `null` for non-owners |
| KARMDA / Digital Services directories | `school-directory.service.ts`, `digital-services-directory.service.ts` | same — no owner filter on the list | Indirect | Per-row link differs: non-owner still gets a link (to the read-only summary), unlike LOKARI/NIA |
| `/admin` main dashboard | `app/admin/page.tsx:84-91` | `getProspects({ userId: params.userId })` — **optional, client-chosen query param** | Yes when filtered | ADMIN/MANAGER see everyone by default |
| `/admin/follow-ups` queue | `follow-up.service-core.ts:10-29` | `assignedUserId = filters.userId` (optional query param) | Yes when filtered | Filters by **prospect** owner |
| `/actions` queue | `prospect-action-queue.service.ts:56-60` | `ProspectAction.assignedToUserId` | Indirect, different field | Filters by **task assignee**, not prospect owner — a distinct axis (see §5) |
| `/actions` row link | `prospect-action-queue.service-core.ts:194-209,269` | `prospect.assignedUserId` | Yes | Same queue row can show an actionable task (assignee-scoped) with a `null` prospect link (owner-scoped) — two axes, confirmed independently |
| `/updates` shared feed (query) | `shared-feed.service.ts:46-93` | **no filter at all** | No | Company-wide by role, not by ownership |
| `/updates` per-item link | `shared-feed-prospect-navigation.ts:29-46` | `prospect.assignedUserId` | Yes | Link only, not visibility of the event itself |
| Sales funnel analytics | `sales-funnel-analytics.service.ts:36,42` | `assignedUserId`, live, grouped | **Yes — incorrectly** | See §6, blocker |
| Sales "why" analytics | `sales-why-analytics.service.ts:34,52` | `assignedUserId`, live, joined to dated historical rows | **Yes — incorrectly** | See §6, blocker |
| Commercial Results (WON credit) | `commercial-results.service-core.ts:75,134,147` | `ProspectActivity.creditedUserId`, frozen | No | The correct pattern the two reports above deviate from |
| Prev/next record navigation | `prospect-navigation.service-core.ts:46-71` | `assignedUserId` of the prospect currently being viewed | Yes | Non-obvious: even an ADMIN/MANAGER browsing one prospect's detail only gets prev/next within *that prospect's owner's* other prospects |

**Duplication finding**: four independent functions decide "what route, if
any, does this viewer get for this prospect" from
`(viewer.role, viewer.id, prospect.assignedUserId)` —
`resolveGenericProductDetailHref`, `resolveSchoolDetailHref`,
`resolveSharedFeedProspectHref` (re-implements both branches inline instead
of calling the other two), and `resolveProspectActionQueueProspectHref`
(composes the first two). There is **no single canonical "given a prospect +
actor, compute permission" helper**. A 28B/28C read-only recomputation (old
owner → read-only, new owner → operational) will need to touch all four, or
— better — consolidate them first. Flagging this as a design opportunity,
not doing it in 28A.

**Pre-existing product asymmetry** (relevant to stop condition #8): KARMDA
and Digital Services already give non-owners a working read-only detail
route; LOKARI and NIA give non-owners no route at all (`detailHref: null`,
dead-end). This predates any ownership-transfer work and is not something
28A should fix — but 28B/28C must decide whether "old owner becomes the same
read-only viewer as any other commercial" (the frozen product rule) is
achievable for LOKARI/NIA today, since *no other commercial* currently gets
a working read-only view of those products either. This is called out again
in §19 as an open question, not assumed away.

---

## 3. Ownership-dependent mutations

Every ownership-gated mutation follows the same shape: COMMERCIAL gets an
ownership-scoped Prisma query (`buildCommercialProspectByIdWhere(id, actor.id)`),
ADMIN/MANAGER get an unscoped query. There is no case where ADMIN/MANAGER
are *additionally* required to satisfy `assignedUserId`.

| Mutation | Requires current ownership? | Direct on `assignedUserId`? | Role-alone gate? | ADMIN/MANAGER bypass? | Historical field written |
| --- | --- | --- | --- | --- | --- |
| Create `ProspectAction` | COMMERCIAL: yes / ADMIN,MANAGER: no | Yes (via scoped find) | No | Yes | `createdByUserId` (server-derived from actor) |
| Complete `ProspectAction` | **No** — gated on the action's own `assignedToUserId`, or role | No — different field entirely | Yes (ADMIN/MANAGER, alongside assignee identity) | Yes | `completedByUserId`, `completedAt` (terminal, immutable) |
| Cancel `ProspectAction` | **No** — gated on the action's own `createdByUserId`/`assignedToUserId`, or role | No — different field | Yes | Yes | `canceledByUserId`, `canceledAt` (terminal, immutable) |
| Submit follow-up (status/interest/next-action, incl. WON transition) | COMMERCIAL: yes / ADMIN,MANAGER: no | Yes (via scoped find+update) | No | Yes | `agentName` on the new `ProspectActivity` row |
| Create prospect interaction/note (COMMERCIAL path) | Yes | Yes | No | N/A (COMMERCIAL-only entry point) | `agentName` |
| Create prospect interaction/note (ADMIN/MANAGER path) | **No** — pure role gate, unscoped `findUnique` | No | **Yes** | **Yes, starkest case** | `agentName` |
| Edit generic prospect fields | N/A | N/A | N/A | N/A | **No such mutation exists** |
| Daily report / daily task submission | N/A | N/A | N/A | N/A | No prospect coupling at all — separate domain by schema design |

**The starkest bypass**: `prospect-activity.service.ts:39-60`'s
`createProspectActivity`, reached only via `requireRole("ADMIN","MANAGER")`
in `prospect-activity.actions.ts`, runs a fully unscoped
`findUnique({ where: { id } })`. Any ADMIN or MANAGER can write an
`INTERNAL_NOTE` (or any other activity type) on **any** prospect regardless
of `assignedUserId`. This is intentional and consistent with every other
ADMIN/MANAGER bypass in this table — it is the established pattern, not a
gap unique to this mutation.

**No visibility distinction on notes.** `INTERNAL_NOTE` is one value of the
`ProspectActivity.type` enum, not a separate privacy flag. There is no
internal-vs-shared boolean anywhere on the model, and no code branches on
`type === "INTERNAL_NOTE"` for read access. Anyone who can view a prospect's
activity list sees every activity, including internal notes. This matters
for §14/§19: if 28D ever wants "internal notes stay commercial-only," that
is new work, not something transfer can lean on.

**Generic edit-prospect mutation: confirmed absent.** Exhaustive search of
every `.prospect.update(`/`.prospect.updateMany(` call site in the repo
(excluding tests) found exactly three:

1. `prospect-follow-up.service.ts:65-68` — `data` is typed to exactly
   `{ status, interest, followUpDate? }`
   (`prospect-follow-up.service-core.ts:59-63`). No `assignedUserId`.
2. `prospect-action.service.ts:120-129` — `updateMany` writing only
   `{ status: "TO_FOLLOW_UP" }` as an auto-progression side effect.
3. `scripts/reconcile-prospect-owners.ts:37-45` — the **only** place in the
   codebase that writes `assignedUserId` outside of creation. It is an
   offline CLI, gated by `process.env.CONFIRM_PROSPECT_OWNER_RECONCILIATION`,
   only ever targets rows where `assignedUserId` is currently `null`, and
   only assigns to users pre-validated as `role === "COMMERCIAL"`. Not
   reachable from any server action, API route, or authenticated web
   mutation.

`prospectSchema` (`src/lib/validations/prospect.schema.ts:65-210`) — the one
Zod schema used across the app for prospect input — has **no
`assignedUserId` field at all**. There is already a regression test guarding
this exact bypass class: `src/actions/authorization-order.test.ts:232-234`
asserts the creation function body never contains
`parsed.data.assignedUserId` or `values.assignedUserId`.

**Conclusion**: there is no bypass to close before 28B ships. But this also
means §16's recommended API shape (`reassignProspect({ prospectId,
newAssignedUserId, reason })` as a wholly new, dedicated service) is not
optional — it is the *only* way to ever change `assignedUserId` through the
live app, because nothing else does today.

---

## 4. Historical attribution inventory

| Historical fact | Field(s) | Frozen at write time? | Must reassignment change it? |
| --- | --- | --- | --- |
| `Prospect.assignedUserId` | current owner | No — this is the one mutable field | **Yes**, this is the point of the feature |
| Interaction/note actor | `ProspectActivity.agentName` | Yes, plain string set from actor at write | No |
| Follow-up actor | `ProspectActivity.agentName` (type=FOLLOW_UP) | Yes | No |
| ProspectAction creator | `ProspectAction.createdByUserId` | Yes, server-derived, never client-supplied | No |
| ProspectAction completion | `completedByUserId`, `completedAt` | Yes, terminal + immutable | No |
| ProspectAction cancellation | `canceledByUserId`, `canceledAt`, `cancellationReason` | Yes, terminal + immutable | No |
| WON sale credit | `ProspectActivity.creditedUserId` + `creditedUserNameAtEvent` + `creditedUserRoleAtEvent` | Yes — resolved *inside the same transaction* as the status write, from `assignedUserId` at that instant, never the acting user, no fallback | No |
| Commercial Results score | reads `creditedUserId` only | Yes (derivative of the above) | No |
| Execution Discipline score | reads `ProspectAction.assignedToUserId` only | Yes (derivative) | No |
| DailyReport | no relation to Prospect at all | N/A | N/A |
| `/updates` feed actor text | `ProspectActivity.agentName` | Yes | No |
| `/updates` feed link target | `prospect.assignedUserId`, read live | No (current, by design) | Yes — but this is navigation, not attribution |
| Sales funnel analytics (won/lost by commercial) | live `Prospect.assignedUserId` | **No** | **Currently yes — this is wrong**, see §6 |
| Sales "why" analytics (reason by commercial) | live `Prospect.assignedUserId`, joined to a dated `ProspectActivity` row | **No** | **Currently yes — this is wrong**, see §6 |
| Current `Mes prospects` membership | `Prospect.assignedUserId` | No | Yes — this is current state, correctly |
| Current write authority | `Prospect.assignedUserId` (COMMERCIAL) / role (ADMIN, MANAGER) | No | Yes, correctly |
| Open `ProspectAction` responsibility after transfer | `ProspectAction.assignedToUserId`, independent of `Prospect.assignedUserId` | Already independent today | **Decision required — see §5** |

`ProspectActivity` has no `updatedAt` field at all (schema, lines 808-864) —
it is append-only by construction, reinforcing that nothing on this model
was ever meant to be revised after the fact.

**Three concepts, only two currently distinguished** (per the ticket's own
framing in its §79): *creator/discoverer*, *current responsible commercial*,
and *historical event actor/credited commercial*. Today's schema
distinguishes the second and third cleanly. The first — "who originally
created/discovered this prospect" — has **no dedicated field**. It is only
recoverable today because it happens to equal `assignedUserId` for every
existing row (nothing has ever reassigned a prospect). The moment
reassignment ships, this equality breaks for every reassigned prospect,
and there is no field left to answer "who created this" for those rows
unless 28B adds one. See §17 for the backfill implication.

---

## 5. ProspectAction & follow-up analysis — the open-action decision

This is the one place the audit must make an explicit recommendation rather
than just report facts, per the ticket's instruction not to assume.

**Scenario, verified against current code**: Jean owns Prospect X and has an
OPEN `ProspectAction` assigned to him. Prospect X is reassigned to Amidou.
What happens to Jean's action?

Today, `ProspectAction.assignedToUserId` and `Prospect.assignedUserId` are
**already independent fields**, and the codebase already documents *why*:
`canCompleteProspectAction`/`canCancelProspectAction`
(`prospect-action.service-core.ts:48-73`) are gated on the action's own
`assignedToUserId`/`createdByUserId`, with an explicit comment: "deliberately
not prospect-ownership scoped, since delegated actions may live on a
prospect the assignee doesn't own" (line 45-46). In other words, the
architecture has already accepted that an action's assignee and the
prospect's owner can diverge — reassignment would just be one more way that
divergence arises, not a new kind of divergence.

**Recommendation: Policy A — preserve the action's assignee; Jean may
finish it.** This is the only option that requires zero new code and is
already consistent with a tested, documented design decision, not a new
carve-out invented for this audit. The alternatives, and why they're worse
default choices:

- **B (cancel/recreate)** would fabricate a cancellation event that never
  operationally happened, purely as a side effect of an unrelated mutation —
  violates the no-fabrication principle (§16 below).
- **C (transfer the assignee)** would silently hand Jean's outstanding
  commitment to Amidou without Amidou's knowledge or consent, and would
  misattribute a task Amidou never took on.
- **D (block reassignment until resolved)** is a legitimate product position
  — it avoids "split responsibility" confusion — but it is a UX/process
  decision with real friction cost (a common transfer trigger, like a
  departing commercial, could have several open actions), not something
  the current architecture requires. Worth an explicit product call, not a
  default.

**Recommended addition for 28B/28C, not required for correctness**: surface
Jean's still-open action to Amidou too (read-only), so the new owner has
full context. This is already possible today with no ownership check —
prospect detail pages render the full action list regardless of prospect
ownership — so it costs nothing beyond a UI decision. Prospect-level
follow-up state (`Prospect.nextAction`/`followUpDate`) is different from a
`ProspectAction` row: it lives *on* the Prospect record itself, not on a
per-assignee row, so it automatically transfers to whoever the new owner is
— no decision needed there, it already inherits correctly by construction.

---

## 6. WON attribution & performance analysis — the one real blocker

**WON transition itself: safe.**
`prospect-won-transition.service-core.ts:55-71` (`resolveWonCredit`) reads
`prospect.assignedUserId`/`assignedUser` **inside the same transaction** as
the status write, never falls back to the acting user, and returns
all-`null` credit fields if the prospect was unassigned at that instant.
Comment: "a MANAGER or ADMIN closing a deal on a COMMERCIAL's behalf must
not become the credited party." This already implements the ticket's target
rule exactly: whoever is authoritative owner *at the moment of WON* gets
credit, regardless of who clicked the button.

**Performance/Results scoring: safe.**
`commercial-results.service-core.ts` reads only the frozen `creditedUserId`;
`execution-discipline.service.ts` reads only `ProspectAction.assignedToUserId`;
`performance-summary.service.ts` composes only these two plus the assessment
models. None touch live `Prospect.assignedUserId`.

One adjacent, lower-stakes fact worth naming: `commercial-performance.service.ts`
(`getCommercialPerformance`, feeds the commercial's own live dashboard KPIs)
*does* `groupBy` live `assignedUserId` — but this is explicitly a
current-portfolio view (status counts, overdue counts, for the logged-in
commercial today), not the hardened 25H results pipeline. It is reasonable
for these numbers to change immediately on reassignment, and they should.

**The blocker: `/admin/analytics/funnel` and `/admin/analytics/why`.**

- `sales-funnel-analytics.service.ts:36,42` runs a **live** query on current
  `Prospect.assignedUserId` and groups current prospects by current owner,
  computing won/lost counts per owner
  (`sales-funnel-analytics.service-core.ts:100-185`). Rendered under "Par
  commercial" with the subtitle *"Un prospect appartient au commercial qui
  l'a prospecté, quel que soit son rôle CRM"* — a historical-sounding claim
  ("who prospected it") backed by a field that will, after 28B ships, no
  longer reliably mean that.
- `sales-why-analytics.service.ts:34,52` is the more severe case: it queries
  a **dated, historical** `ProspectActivity` row (a past `FOLLOW_UP` with a
  recorded `conversionOutcome`/`conversionReason`) and joins it to the
  prospect's **current** `assignedUserId` at query time — not any field
  stored on the activity row itself. This is the exact pattern the
  `creditedUserId` design was built to prevent everywhere else in the app,
  and it was missed here.

Both reports carry a comment (Tickets 20F/20G) noting the team deliberately
avoided sorting these breakdowns by volume "so it doesn't read as a
leaderboard/performance ranking" — evidence the team was already alert to a
performance-attribution concern here, but the mitigation addressed the
*ranking/leaderboard* framing only, not the underlying *dynamic-derivation-
from-current-ownership* correctness problem.

**This is a genuine instance of the ticket's stop condition #3** ("performance
history dynamically depends on current ownership"). It is scoped narrowly —
only these two reports, not the Results/Execution-Discipline pipeline, and
not WON credit itself — but it is real and must be resolved (switch both
reports to `creditedUserId`-based attribution for WON rows, and either add an
equivalent frozen field for LOST/STALLED reasons or explicitly relabel these
two views as "current portfolio," not "who closed/lost this") **before 28B
ships reassignment**, or every prospect reassignment will silently rewrite
two historical performance reports even though the authoritative scoring
pipeline stays correct. This is 28B/28C-adjacent remediation work, not
something to fix in this audit.

---

## 7. Role & authority matrix

Authorization is built on canonical, named role-list constants
(`authorization.service-core.ts`, 13+ constants like `MY_PROSPECTS_ROLES`,
`DASHBOARD_ACCESS_ROLES`), wrapped in async helpers
(`requireMyProspectsAccess()`, etc.) — not scattered inline role checks.
Finer actor-vs-subject matrices live in per-domain `*.service-core.ts` files
(`canCompleteProspectAction`, `canAssignTask`, etc.) when a flat list isn't
expressive enough. This audit's recommended `PROSPECT_REASSIGNMENT_ROLES`
constant fits this existing pattern directly — no new authorization
mechanism needs inventing.

| Action | ADMIN | MANAGER | COMMERCIAL | ASSISTANT |
| --- | --- | --- | --- | --- |
| View any prospect | Yes (unscoped today) | Yes (unscoped today) | Own: full · KARMDA/Digital Services non-owned: read-only · LOKARI/NIA non-owned: no route today (pre-existing gap, §2) | **No prospect visibility at all** (routed away before the query runs, tested) |
| Operate owned prospect | Yes (any prospect, bypass) | Yes (any prospect, bypass) | Yes, only if owner | No |
| Reassign prospect *(future)* | Recommend: Yes | Recommend: Yes | Recommend: No | Recommend: No |
| Request takeover *(future, 28D)* | N/A (can reassign directly) | N/A (can reassign directly) | Recommend: Yes | No |
| Approve/reject takeover *(future)* | Recommend: Yes | Recommend: Yes | No | No |
| View inactive-owner recovery queue *(future)* | Recommend: Yes | Recommend: Yes | No | No |

**Manager scope is organization-wide, not team-scoped.** Explicitly and
repeatedly documented across 6+ files as deliberate (no manager-of-employee
hierarchy exists — "Ticket 25G §6/§27... a MANAGER's authority here is
organization-wide, not team-scoped, and that limitation is deliberate and
documented, not an oversight," `authorization.service-core.ts:82-84`). No
`managerId`/`teamId`/`supervisor` model exists anywhere. **Reassignment
authority should follow this exact existing shape — organization-wide for
both ADMIN and MANAGER — rather than inventing team-scoped authority that
doesn't exist anywhere else in the app.**

**ASSISTANT is fully excluded, already.** Cannot own prospects
(`PROSPECT_OWNER_ROLES` excludes it), cannot be a `ProspectAction` assignee,
and has zero prospect visibility — even read-only — enforced by routing
ASSISTANT to a separate dashboard branch *before* any prospect query runs
(tested: `app/admin/dashboard-authorization.test.ts:26-34`, "the ASSISTANT
branch must return before the prospect query, not merely hide the data
client-side"). Nothing about reassignment changes this; ASSISTANT has no
role in any part of this feature.

**`OrganizationMembership` confirmed irrelevant.** Exists as a documented
"transitional shadow copy," never consulted for any access decision, tested
in both directions (a diverging grant or revoke via membership has zero
authorization effect). Phase 28 should continue to use `User.role` alone, as
every other feature in this codebase already does.

---

## 8. Inactive-user behavior

**Inactive owners are not hidden, orphaned, or erased — confirmed, not
assumed.** No query anywhere filters prospects (or the user filter dropdown)
by `assignedUser.active`. `src/lib/prospect-ownership.test.ts:7-17` tests
this directly ("prefers the linked User name, including for an inactive
historical User"). `listDashboardUserOptions` deliberately includes inactive
users who still have assigned prospects in its filter dropdown via an `OR`
clause, specifically so they remain selectable/visible.

**User deactivation does not touch `assignedUserId`.** `deactivateUserCore`
only flips `User.active` and writes a `UserStatusActivity` row —
confirmed, no prospect read or write in that path at all. This matches the
ticket's target principle exactly: deactivation must not silently transfer
or null ownership, and it doesn't.

**One real gap, orthogonal to this ticket but worth flagging**: NextAuth's
JWT strategy checks `active` only at login (`auth-credentials.service-core.ts:36`);
there is no `middleware.ts`, and `role`/`active` are never re-verified from
the DB for ADMIN/MANAGER routes mid-session. If an admin or manager account
is deactivated mid-session, their existing session keeps granting
`requireMyProspectsAccess`/`requireDashboardAccess` etc. until the 30-day
JWT expires or they re-authenticate. By contrast, every COMMERCIAL-scoped
surface re-verifies `active` and `role` fresh from the DB on every request
(`assertCommercialAccessCore`). This means the "old owner immediately
becomes a read-only viewer, no stale client-side authority" principle
**already holds today for COMMERCIAL** (ownership is re-derived fresh on
every mutation attempt — a stale COMMERCIAL session cannot act on a prospect
it no longer owns, confirmed by the `PROSPECT_NOT_FOUND` behavior in §3), but
does **not** fully hold for a deactivated ADMIN/MANAGER's own session. This
is pre-existing and not caused by reassignment — flagging it in §19 as
something the reassignment service should defensively account for (re-verify
actor `active` at call time) rather than something 28A needs to fix.

**"Uncovered prospects" — the correct definition, and the correct wording.**
Per the ticket's own candidate: `Prospect.assignedUserId != null AND
assignedUser.active = false`. Do not additionally fold in
`assignedUserId = null` as the same bucket — a null-assignment prospect and
an inactive-owner prospect are different failure modes (the first has never
had an owner or lost one to a historical `SetNull`; the second has an owner
who is simply no longer able to act). Recommend two distinct, clearly-named
buckets if both need surfacing, not one merged "unowned" concept. Recommend
French wording: **"Prospects assignés à un commercial inactif"** as the
precise label, with **"Prospects à réaffecter"** as the shorter UI-facing
call-to-action heading — never "non attribués" or "non assignés," which
would incorrectly imply no owner exists.

**Role-change behavior**: no automatic reassignment on any role transition
— tested invariant (§1). If a COMMERCIAL becomes ASSISTANT while still
holding assigned prospects, those prospects remain assigned to them (now an
ASSISTANT who cannot operationally act on them per §7) — this is exactly the
kind of mismatch the future inactive-owner-style recovery queue should also
surface (a role-ineligible-but-still-assigned owner), not something requiring
new schema: the same `assignedUserId != null AND` predicate style can check
role eligibility (`canOwnProspect(assignedUser.role) === false`) as easily
as `active === false`.

---

## 9. Reassignment invariants

**Eligible current owner**: any role, any active state — no restriction.
The whole point of this feature is to move a prospect *away from* an
inactive or otherwise no-longer-suitable owner.

**Eligible new owner (`toUserId`)**: recommend reusing the exact existing
`canOwnProspect` allow-list — `["ADMIN", "COMMERCIAL", "MANAGER"]` — plus
`active === true`. Do **not** narrow this to COMMERCIAL-only: ADMIN and
MANAGER can already own prospects today (self-created), and a reassignment
feature that can't target them would be a regression relative to what
creation already allows. Reject a target with `active === false` outright —
that would be a management typo importing exactly the problem this feature
exists to fix.

**Self-reassignment (`fromUserId === toUserId`)**: reject as an explicit
no-op, distinctly coded (e.g. `SAME_ASSIGNEE`), not a validation error and
not a silently-accepted transfer event. No history row should be created for
a non-change.

**Terminal prospects (WON/LOST)**: the codebase does not currently restrict
any mutation by prospect status in a way that suggests terminal states are
operationally frozen — follow-ups and activities can still be logged after
WON (`ProspectActivityType` has no gate on prior status). Recommend
**allowing** reassignment of terminal prospects (e.g. a WON school still
needs an assigned commercial for ongoing account relationship, an
implementation follow-through, etc.), since nothing in current WON credit
resolution is affected by post-WON ownership changes (§6 confirms
`creditedUserId` is frozen at the transition, permanently). This is a
recommendation, not a hard requirement — flag for product sign-off since the
ticket asks for deliberate thought here, not a default.

**Reassignment authority**: ADMIN and MANAGER, organization-wide, matching
§7's existing shape. COMMERCIAL and ASSISTANT: no.

**Reassignment reason**: recommend **required, non-blank free text** — this
matches the ticket's own reasoning (an explicit management intervention
whose reason will matter later) and there is no existing enum-shaped pattern
in this codebase for comparable "why did this change" fields (compare
`ProspectAction.cancellationReason`, also free text, also optional-but-
recommended-populated in practice). Do not introduce a reason enum without
a clear reporting need driving it — none was found.

**Reason immutability**: recommend fully immutable once written — no edit,
no delete, matching the append-only design of every other historical record
audited here (`ProspectActivity` has no `updatedAt` at all; terminal
`ProspectAction` states are documented as immutable). A correction should be
a new event, never a rewrite.

---

## 10. Concurrency model

No current code needs to solve this yet (no reassignment mutation exists),
but the invariant should be frozen now so 28B isn't improvised:

**Required pattern**: a single transaction containing (a) a conditional
update — `UPDATE Prospect SET assignedUserId = ? WHERE id = ? AND
assignedUserId = <expectedCurrentOwnerId>` — and (b) the transfer-history
insert. Zero rows affected means the precondition failed (someone else moved
it first); the caller must reject with an explicit conflict, never silently
retry with the stale value. This mirrors the existing transactional pattern
already used for WON-credit resolution (`resolveWonCredit` reads
`assignedUserId` inside the same transaction as the status write) — nothing
novel needs to be invented, just applied to a new mutation.

**Ownership change and transfer-history event are one atomic operation.**
Never allow the owner to change without a corresponding history row, or a
history row to exist without the corresponding owner change — same
transactional discipline as above.

**WON-vs-reassignment race** (Jean marks WON while Admin reassigns Jean →
Amidou concurrently): resolved automatically if both operations follow the
guard above. Whichever transaction commits first wins its own precondition;
the other's `WHERE` clause matches zero rows and must be rejected and
retried against fresh state. This cannot produce ambiguous credit, because
`resolveWonCredit` already reads `assignedUserId` inside its own transaction
— there is no window where credit could be computed against a value that
changed underneath it, provided reassignment is written with the same
discipline.

**Stale-tab / former-owner mutation attempt**: already solved today, for
COMMERCIAL, by construction — every ownership-scoped mutation re-derives
`assignedUserId` fresh from the DB at call time
(`buildCommercialProspectByIdWhere`), so a stale browser tab's next mutation
attempt fails with `PROSPECT_NOT_FOUND` immediately, with no reliance on
cached client or session state. 28B just needs to not break this existing
guarantee, not build it.

**Retrospective/backdated reassignment**: recommend rejecting this for V1.
`occurredAt` on the transfer event should be the server's own acceptance
timestamp, matching the "when RELAIS CRM accepted the change" principle —
consistent with every other timestamped historical record in this schema
(`ProspectActivity.occurredAt`, `ProspectAction.completedAt`/`canceledAt` are
all set to the moment of the actual server-side mutation, never a
client-supplied "this happened earlier" value).

---

## 11. Takeover-request domain decisions

No code exists for this yet (correctly out of 28A's implementation scope).
Domain decisions to freeze for 28D, based on this audit's findings elsewhere:

- **Requester**: COMMERCIAL only. **Decider**: ADMIN or MANAGER — same
  organization-wide authority as reassignment itself (§7); no separate
  authority model needed.
- **Requesting one's own prospect**: reject as a no-op, same treatment as
  self-reassignment (§9).
- **Requesting an inactive-owner prospect**: allow — this is a primary use
  case (§8 confirms inactive owners are visible and not orphaned; a
  colleague noticing and requesting takeover is a reasonable discovery
  path management shouldn't have to gate). Approval still requires an
  explicit management decision — never auto-approve on inactive-owner
  grounds alone.
- **Duplicate requests**: recommend at most one active `PENDING` request per
  `(requester, prospect)` pair; historical rejected/cancelled rows may
  remain (append-only, matches every other historical model here).
- **Multiple commercials requesting the same prospect**: must be supported
  concurrently — recommend no first-come locking. Once one request is
  approved (i.e., reassignment executes), every other pending request for
  that same prospect should be resolved deterministically, not left
  ambiguously pending. Recommend auto-marking the others as superseded
  (a distinct terminal state, not silently deleted) rather than
  auto-rejecting (which implies a judgment was made) or leaving them
  pending (which would misrepresent current state).
- **Approval must invoke the same reassignment operation** (§9/§10), never a
  separate ownership-writing code path — this is the same "single
  authoritative mutation" principle already enforced for prospect creation
  (`assignedUserId` is written in exactly one place) and should be preserved
  rather than reintroducing a second writer.
- **Stale approval** (request made while Jean owned; Admin reassigns Jean →
  Yacouba before approval; Manager later approves the Amidou→Jean request):
  recommend the request snapshot its `expectedOwnerUserId` at creation time,
  and approval re-validate that snapshot against the *live* current owner
  before invoking reassignment (the same conditional-update guard from
  §10). A mismatch must surface as an explicit stale/conflict state
  requiring conscious reconfirmation by the approving manager, never a
  silent Yacouba→Amidou transfer performed as if nothing had changed.
- **Rejection**: no ownership impact. Preserve requester, prospect, decider,
  decision, reason (if provided), decided-at — same minimal-provenance shape
  as every other historical event audited here.
- **Cancellation by requester**: allow, `PENDING → CANCELLED`, no ownership
  impact.
- **Current-owner consent**: not required. The ticket's own reasoning holds
  up against this audit's findings — management already has unilateral
  authority to act on any prospect regardless of ownership (every
  ADMIN/MANAGER bypass in §3 confirms this is the established pattern, not
  a new precedent being set here).

---

## 12. Inactive-owner recovery decisions

- **Definition**: `assignedUserId != null AND assignedUser.active = false`
  (§8). Do not merge with null-assignment prospects.
- **Discovery location**: recommend reusing the existing `/admin` prospect
  list surface with an added filter/indicator, not a new subsystem. The
  `/admin` list already supports an optional `userId` query filter and
  already includes inactive users in its user-picker dropdown
  (`listDashboardUserOptions`) — the missing piece is a filter predicate on
  owner-active-state and a visible badge, not new infrastructure.
- **Bulk reassignment**: defer. No existing prospect mutation in this
  codebase operates on more than one row at a time with per-row
  authorization and history implications; introducing that pattern here
  first, under the added complexity of concurrent-transfer correctness
  (§10), is unnecessary compared to shipping individual reassignment first.
- **List indicator**: recommend showing the assigned commercial's name and
  an inactive-owner badge to ADMIN/MANAGER in the surfaces that already show
  ownership (`/admin`, `/admin/my-prospects`, `/admin/follow-ups`) — do not
  add this to COMMERCIAL-facing surfaces, which have no reason to see
  another commercial's inactive-owner state.

---

## 13. Persistence recommendation

**Model shape** (28B, not built here):

```prisma
model ProspectAssignmentTransfer {
  id               String   @id @default(cuid())
  prospectId       String
  prospect         Prospect @relation(fields: [prospectId], references: [id], onDelete: Restrict)
  fromUserId       String?
  fromUser         User?    @relation("...", fields: [fromUserId], references: [id], onDelete: Restrict)
  toUserId         String
  toUser           User     @relation("...", fields: [toUserId], references: [id], onDelete: Restrict)
  changedByUserId  String
  changedByUser    User     @relation("...", fields: [changedByUserId], references: [id], onDelete: Restrict)
  reason           String
  occurredAt       DateTime @default(now())
}
```

- **Naming**: `ProspectAssignmentTransfer`, not
  `ProspectOwnershipTransfer`/`ProspectOwnershipHistory`. The schema already
  uses `assignedUserId`/`assignedUser`/`assignedToUserId` terminology
  throughout (`Prospect`, `ProspectAction`); "ownership" would introduce a
  new, business/legal-sounding vocabulary this codebase has deliberately
  never used for this concept.
- **`onDelete: Restrict`** on both the `prospect` and every `User` relation —
  matching the repo-wide convention (§1; every User FK except
  `Prospect.assignedUser` itself is `Restrict`, and `ProspectAction.prospect`
  is `Restrict` with the same "Prospect is never hard-deleted today, so this
  is future-proofing, not a live constraint" rationale that applies equally
  here).
- **`fromUserId` nullable**: legitimate for the very first transfer event on
  a prospect if 28B chooses to also record initial assignment as an event
  (see §17) — a prospect created with no prior transfer has no "from."
- **No role snapshots recommended** (`fromUserRoleAtEvent`,
  `toUserRoleAtEvent`, `changedByRoleAtEvent`). Unlike
  `ProspectActivity.creditedUserRoleAtEvent` — which exists because credited
  role feeds a *scoring* computation that must never drift — nothing about
  the future transfer-history read path depends on interpreting a role at
  the moment of transfer. Snapshots should be added only when a concrete
  read requires them, per the ticket's own instruction not to add them
  reflexively; none was found here.
- **Names are not the identity.** Anchor to `User` IDs, as above; render
  names live from the `User` relation, consistent with the fact that no
  User-deletion path exists (§1, §7) — there is no risk of a dangling
  historical name requiring a frozen snapshot, unlike WON credit's
  `creditedUserNameAtEvent`, which exists for a different, already-solved
  reason (scoring integrity, not deletion survivability).

**Hard architectural boundary to enforce going forward** (the single most
important safeguard, per the ticket's own framing): once 28B ships,
`assignedUserId` must never become editable through a generic prospect-edit
path. Since no such path exists today (§3), this is trivial to keep true —
the discipline is simply "never add it," not "go remove it from somewhere."

---

## 14. UI implications

- **Prospect detail (all four near-duplicate pages, §2)**: add a
  "Réassigner" action for ADMIN/MANAGER, and a read-only "Commercial assigné"
  display for everyone else — consistent with the fact that no page today
  computes a `canEdit` boolean from ownership (§2); this would be the first
  one to do so cleanly, and should be considered a chance to consolidate the
  four link-resolution functions rather than adding a fifth ownership check.
- **Read-only takeover CTA** (28D, not 28A): show a "Demander à reprendre le
  suivi" action to non-owner commercials — gated on current owner active
  state per §11, and only where a working read-only route already exists
  (KARMDA, Digital Services today; LOKARI/NIA need the pre-existing gap in
  §2 addressed first, or the CTA has nowhere to render).
- **Pending-request state**: "Demande de reprise envoyée," replacing the
  action button, per §11's one-active-request-per-requester rule.
- **Inactive-owner indicator**: management-facing only (§12).
- **Old owner's stale tab**: no client-side handling needed beyond normal
  server-rejection-then-revalidate — already the correct behavior today for
  COMMERCIAL mutations (§10).

---

## 15. Security implications

- **No IDOR risk introduced by existing patterns**: every audited mutation
  resolves `actor`, `prospect`, and current `assignedUserId` fresh from the
  DB/session — never trusts a client-supplied `fromUserId`, `actorRole`, or
  `targetRole`. The recommended reassignment API shape
  (`reassignProspect({ prospectId, newAssignedUserId, reason })`, deriving
  everything else server-side) follows this exact existing convention; do
  not accept `fromUserId`/`changedByUserId`/`changedByRole` from the client.
- **Defensive addition recommended**: given the JWT staleness gap in §8
  (ADMIN/MANAGER `active` not re-verified mid-session), the reassignment
  service should defensively re-check the acting user's `active` status
  fresh from the DB at call time, rather than trusting the session's role
  claim alone — a narrow, targeted mitigation for this one high-stakes
  mutation, not a broader session-architecture fix (out of scope here).
- **No new FK/deletion risk**: no User or Prospect deletion path exists
  today (§1); the recommended `Restrict` relations in §13 preserve that
  invariant rather than introducing a new one.

---

## 16. Legacy-data / backfill policy

**No fabrication, anywhere.** Explicitly reject:

- `createdAt` treated as initial-assignment time.
- Current `assignedUserId` treated as "original owner" for any prospect
  that has ever been through the (not-yet-existent) transfer mechanism.
- `updatedAt` treated as last-reassignment time.
- Any synthesized `fromUserId`/`changedByUserId` for a transfer that was
  never recorded as an event.

**One safe, evidence-based exception**: for every prospect existing at the
moment 28B ships, `assignedUserId` today equals the value set at creation,
because no reassignment mechanism has ever existed (§1). If 28B introduces
a `createdByUserId` field, backfilling it as `= assignedUserId` for all
pre-existing rows is not a guess — it is a provable fact given the complete
absence of any prior reassignment code path. This does **not** extend to
the subset of rows that went through the offline `reconcile-prospect-owners`
script (null → reconciled from `agentName` text): that reconciliation was
already documented as a best-effort historical approximation, not a
verified creator identity, and treating it as "creator" would layer a new,
stronger claim onto a value that was never asserted with that certainty.
Recommend backfilling `createdByUserId` for cleanly-created rows only, and
leaving it explicitly null for reconciled rows, rather than treating the two
populations identically.

**Initial-assignment history**: do not attempt to reconstruct a
"transfer #0" event for existing prospects. Begin recording transfer events
prospectively, from 28B's ship date forward. A legacy prospect with no
transfer history is not "inconsistent" — it predates the concept — and 28B's
read logic (§13's consistency rule: "latest transfer's `toUserId` should
equal current `assignedUserId`") should treat "no transfer rows at all" as a
valid, expected state, not an error condition.

---

## 17. Scenario analysis (required)

**A — Normal transfer (Jean → Amidou, by Admin).** Jean immediately loses:
`Mes prospects` membership (derived live), ability to submit follow-ups/
activities as owner (ownership re-derived fresh, §10), access to the
commercial-scoped detail page (404, data-layer enforced, §2). Jean's *open*
`ProspectAction` remains his to finish (§5, Policy A). Jean's *completed*
actions, interactions, and any WON credit are untouched (§4/§6). Amidou
immediately gains: `Mes prospects` membership, the commercial detail page,
full historical activity visibility (no ownership gate on activity reads,
§3), and ability to create new activities/follow-ups. Prospect status and
`nextAction`/`followUpDate` transfer automatically with the record — no
reset, no special handling needed (§9, §5).

**B — Former owner, stale tab, tries a mutation.** Rejected immediately with
`PROSPECT_NOT_FOUND`, no reliance on cached session/client state — already
true today by construction (§10).

**C — New owner continues work.** Amidou sees Jean's full history
(unfiltered by ownership at the activity-read level, §3); Amidou's new
activity gets `agentName = Amidou`; Jean's prior activities keep
`agentName = Jean` — provenance preserved per-event, no special handling
needed (§4).

**D — Inactive owner, 12 prospects.** Nothing hides or orphans them (§8).
Currently, only manual filtering (`/admin?userId=`) surfaces them; no
dedicated recovery queue exists yet (§12, correctly out of 28A's scope to
build).

**E — WON before transfer.** `creditedUserId` stays Jean forever (§6) —
Commercial Results/Execution Discipline continue crediting Jean correctly.
**But** `/admin/analytics/funnel` and `/admin/analytics/why` would
incorrectly re-attribute this WON to Amidou (§6 blocker) — must be fixed
before 28B ships, or this scenario produces visibly wrong numbers in two
specific reports while the authoritative scoring stays correct underneath.

**F — Transfer before WON.** `resolveWonCredit` reads `assignedUserId` at
the moment of the *actual* WON transition, so credit correctly goes to
Amidou (whoever is authoritative at that instant) — already matches the
ticket's target rule exactly, with zero changes needed (§6).

**G — Open action.** Resolved in §5: Policy A, Jean keeps and may complete
his own assigned action; recommend also surfacing it to Amidou read-only.

**H — Takeover request stale** (Amidou requests Jean's; Admin reassigns
Jean→Yacouba; Manager later approves Amidou's request). Resolved in §11:
require the request to snapshot its expected owner at creation, and
re-validate against the live current owner at approval time — mismatch
surfaces as an explicit conflict requiring reconfirmation, never a silent
Yacouba→Amidou transfer.

**I — Simultaneous reassignment** (two managers race Jean→Amidou vs.
Jean→Yacouba). Resolved in §10: conditional update guarded on expected
current owner, inside one transaction with the history insert; the loser
gets zero rows affected and an explicit conflict, never a silently
overwritten or duplicated history.

**J — Concurrent WON/reassignment.** Resolved in §10: both operations guard
on their own expected-state precondition within their own transaction;
whichever commits first wins cleanly, the other is rejected and must retry
against fresh state — no ambiguous credit is possible as long as
reassignment adopts the same transactional discipline `resolveWonCredit`
already uses.

---

## 18. Explicit non-goals (of this audit and of 28A generally)

No schema change, no migration, no reassignment UI, no reassignment
service, no assignment-history model, no takeover-request model or UI, no
inactive-owner dashboard, no bulk reassignment, no notifications, no shared
ownership/co-owners/team hierarchy, no automatic reassignment, no changes to
performance scoring, no tenantization. Nothing in this document was
implemented — every recommendation above is exactly that, a recommendation
for 28B–28E to adopt or explicitly override.

---

## 19. Open questions / blockers for management sign-off

1. **Blocker, must resolve before 28B**: `/admin/analytics/funnel` and
   `/admin/analytics/why` dynamically derive historical won/lost/reason
   attribution from live `assignedUserId` (§6). Needs an explicit decision:
   migrate both to `creditedUserId`-based (and an equivalent frozen field
   for non-WON outcomes), or relabel them as current-portfolio views and
   accept that a reassignment changes their numbers.
2. **Product decision, not resolved here**: open-`ProspectAction` transfer
   policy (§5) — this audit recommends Policy A on architectural-consistency
   grounds, but it is a product call, not a code fact, and deserves explicit
   sign-off given the departing-commercial use case likely has several open
   actions per prospect.
3. **Product decision, not resolved here**: terminal-prospect (WON/LOST)
   reassignment (§9) — recommended to allow, but flagged for deliberate
   product thought as the ticket requested.
4. **Pre-existing gap, not caused by this ticket**: LOKARI/NIA have no
   working read-only detail route for non-owners at all (§2), which the
   frozen product rule ("other commercials remain read-only") cannot fully
   satisfy for those two products without separate work. Needs a decision:
   fix this gap as part of 28B/28C, or explicitly scope the read-only
   guarantee to KARMDA/Digital Services only for V1.
5. **Security-adjacent, orthogonal but relevant**: ADMIN/MANAGER JWT
   sessions don't re-verify `active` mid-session (§8). Recommend the
   reassignment service defensively re-check `active` at call time (§15);
   the broader session-architecture gap is out of scope for this ticket.
6. **Takeover-request lifecycle details** (§11: duplicate handling,
   superseded-request terminal state, stale-approval reconfirmation) are
   domain recommendations, not yet product-approved decisions — 28D should
   not proceed without explicit sign-off on these, since none is dictated
   unambiguously by existing code (unlike, say, §1's ownership semantics,
   which the code already proves).

None of the ticket's ten hard stop conditions were found to hold for the
*authoritative* history/attribution/scoring pipeline — only for the two
analytics reports in item 1 above, which is why this audit concludes 28B can
proceed once that item is explicitly resolved, rather than halting entirely.

---

## 20. Frozen decisions for 28B–28E

- Current ownership = `Prospect.assignedUserId`, single mutable pointer, no
  history (§1).
- Reassignment = one new, dedicated `reassignProspect()` service; no
  generic edit path exists or should ever accept this field (§3, §13).
- Eligible targets: `ADMIN | COMMERCIAL | MANAGER`, `active = true` — same
  as creation eligibility, not narrowed (§9).
- Reassignment authority: `ADMIN`, `MANAGER`, organization-wide (§7, §9).
- Self-reassignment: explicit no-op, no history row (§9).
- Reason: required, non-blank, free text, immutable once written (§9).
- Transfer history: dedicated `ProspectAssignmentTransfer` model,
  `Restrict` FKs, no role snapshots, IDs not names (§13).
- Atomicity: ownership change + history insert, one transaction, always
  (§10).
- Concurrency: conditional update guarded on expected current owner; loser
  gets an explicit conflict, never a silent overwrite (§10).
- No retrospective/backdated transfers in V1 (§10).
- Open `ProspectAction` on transfer: preserve assignee (Policy A),
  pending explicit product sign-off (§5, §19).
- WON credit: already correctly frozen at transition; **do not touch**
  (§6). The two analytics reports that don't yet respect this **must** be
  fixed or explicitly relabeled before 28B ships (§6, §19).
- No backfilled transfer history for legacy prospects; `createdByUserId`,
  if added, may be safely backfilled from current `assignedUserId` only for
  non-reconciled rows (§16, §17).
- Takeover requests (28D) are a separate lifecycle, never a second writer
  of `assignedUserId` — approval must invoke the same `reassignProspect()`
  (§11).

---

## Final audit question

*If Jean owns a prospect for six months, leaves RELAIS, Amidou takes over,
and someone audits the CRM two years later, can the system tell the truth
about who was responsible when, who actually performed each action, who
earned any sales credit, and who is responsible now — without reconstructing
history from guesses?*

**Yes, with one asterisk.** Every durable per-event field this audit found
(`ProspectActivity.agentName`, `ProspectAction`'s four actor fields,
`ProspectActivity.creditedUserId` and its frozen snapshots) already answers
"who did this" and "who earned credit" correctly and permanently, regardless
of any future reassignment — none of that required 28A to change anything,
because it was already built correctly under the 25H hardening effort. "Who
is responsible now" will be answered by `Prospect.assignedUserId` plus the
28B `ProspectAssignmentTransfer` log, which is a new but straightforward
addition given everything else in this schema already follows the same
Restrict-FK, ID-anchored, append-only conventions.

The asterisk: **as of today**, "who received credit for a past win, broken
down by commercial" is answered correctly by the Results/Execution
Discipline pipeline, but **incorrectly** by the two analytics dashboards in
§6 — a two-year-later auditor looking at `/admin/analytics/why` today would
already get a wrong answer for any prospect ever reassigned, once
reassignment ships, even though the ground-truth data (`creditedUserId`)
sitting one table away is correct. 28B should not begin until that asterisk
is resolved — not because the domain model is unsound, but because two
specific read paths don't yet honor a distinction the rest of the codebase
already enforces.
