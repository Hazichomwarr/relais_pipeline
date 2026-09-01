# Ticket 27A — Ma journée & Tâches du jour Domain Audit

Audit date: 2026-09-01. **Audit-only.** No Prisma schema changes, no
migration, no UI implementation, no runtime behavior changes, no
production writes, no Performance integration. This document designs the
domain before any of that exists.

The operational principle this whole audit is built around:

> **Ma journée should help RELAIS coordinate work, not turn RELAIS CRM
> into employee-surveillance software.**

And the central historical question it answers:

> **What did the employee declare about their workday, what did
> management actually confirm, and what work had management actually
> assigned to that employee for that date?**

These are three separate facts. Every recommendation below keeps them
separate rather than deriving one from another.

---

## Non-goals, restated up front (ticket §94)

Nothing below introduces: Prisma models, a migration, `Workday`,
`DailyTask`, schedule management, absence management, leave management,
a holiday calendar, uniform/GPS/time tracking, screenshots, login
monitoring, automatic lateness sanctions, performance scoring,
task-derived performance points, notifications, a formal team hierarchy,
Phase 26 continuation, organization switching, membership-role
authority, or any production write. This document is the design; 27B+
builds it.

---

## 1. Current-state inventory (ticket §88, required)

### 1.1 Existing relevant models

No model in this domain exists yet. The closest existing precedents,
read in full or in relevant part this session:

- **`ProspectAction`** (`prisma/schema.prisma:667-711`) — the schema's
  own comment already frames it as "durable, assignable, deadline-bearing
  work: what must happen, who must do it, by when." Fields:
  `prospectId`, `assignedToUserId`, `createdByUserId`, `status`
  (`OPEN`/`COMPLETED`/`CANCELED`), `title`, `description?`, `dueAt`,
  `completedAt?`/`completedByUserId?`, `canceledAt?`/`canceledByUserId?`/
  `cancellationReason?`. Terminal states are immutable ("no reopen, no
  edit, no changing who completed/canceled it or when" — schema comment).
  Zero role snapshots anywhere on this model despite having four
  independent `User` relations — strong existing precedent that identity
  alone (not role-at-event) is sufficient provenance for an
  assignment/completion domain like this.
- **`DailyReport`** (`prisma/schema.prisma:467-504`) — `ownerUserId`,
  `reportDate` (business-calendar day, **not** `createdAt`, normalized to
  business midnight — `@@unique([ownerUserId, reportDate])`),
  `templateType` (snapshotted from `User.dailyReportTemplateType` at
  creation, never re-derived), `status` (`DRAFT`/`SUBMITTED`),
  `accomplishedToday`/`plannedTomorrow` (free text — the employee's own
  narrative), `submittedAt?`. This is the **existing precedent for "one
  record per employee per business day," unique-constraint shape, and
  business-date normalization** — directly reusable for `Workday`.
- **`UserStatusActivity`** — a separate append-only historical-fact
  model for a boolean-flip event (`active`), not embedded as columns on
  `User`. Precedent for treating a lifecycle transition as its own
  durable fact.

### 1.2 Role helpers

`src/services/authorization.service-core.ts` (read in full this
session, unaffected by any later ticket): every existing capability is a
named `UserRole[]` constant (`SHARED_FEED_ROLES`,
`DAILY_REPORT_MANAGEMENT_ROLES`, `COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES`,
`FINANCE_ACCESS_ROLES`, `DASHBOARD_ACCESS_ROLES`, twelve total), each
paired with a `require*` wrapper in `authorization.service.ts` that calls
`requireRoleCore(session, ROLES)`. Every constant's own comment
explicitly documents *why* it's a separate constant even when identical
to another today ("kept separate so they can diverge independently
later") — this is the established idiom this audit recommends Workday/
DailyTask follow exactly, not a new pattern.

**Finer, subject-dependent authority** (not just "can this actor open
the door at all") already has its own established pattern:
`src/lib/employee-assessment-authorization.ts`'s
`canAssessEmployeeInStructuredEvaluation` — a coarse role-array gate at
the route/action level, plus a separate pure function taking
`(actorRole, subjectRole)` for the real matrix. This is the exact shape
Workday/DailyTask's confirmation and assignment authority need (§4
below), and it already exists in this codebase for a structurally
identical problem (who may act on whom).

### 1.3 Active-user semantics

`authenticateCore` (`auth-credentials.service-core.ts`) rejects login
entirely if `!user.active`. No other domain in the codebase has its own
separate "active for this purpose" concept — `User.active` is the one
global gate. Every existing roster/eligibility query filters on
`active: true` (confirmed across `user.service.ts`'s five roster
functions). Workday/DailyTask eligibility should follow the identical
convention.

### 1.4 Manager hierarchy — confirmed absent

Repo-wide grep this session for `managerId|teamId|supervisorId|reportsTo|
managedBy|teamMember` across `prisma/` and `src/`: **zero matches.**
This reconfirms 26A §5/§7 and 26C §11.4's independent finding: MANAGER
authority everywhere it exists today (`ProspectAction`'s ADMIN/MANAGER
override, every Performance-domain management capability) is
**organization-wide, not team-scoped** — there is no durable
Manager→Commercial relationship anywhere in this schema, and nothing
infers one from `role`, prospect ownership, who created a user, or who
wrote an assessment. See §4 below for what this means for Workday/
DailyTask specifically.

### 1.5 DailyReport overlap

Read `daily-report.service.ts`/`daily-report.service-core.ts` in full
this session (via this session's own Ticket 26C research). `DailyReport`
is **self-authored narrative** — "what I did, what happened, what's
planned next" (`accomplishedToday`/`plannedTomorrow`, free text) —
submitted once by the employee, `DRAFT`→`SUBMITTED`, no assignment
concept, no manager instruction concept. It answers "what did the
employee report," never "what did management ask for." No overlap with
Workday's start/confirm/end declarations or with DailyTask's
assignment/completion facts — see §9 for why they must stay independent.

### 1.6 ProspectAction overlap

See §1.1. `ProspectAction` **requires** a `prospectId` — it is
structurally a CRM workflow action tied to a specific business prospect
("Call prospect X tomorrow," "Follow up with school Y"). The ticket's
own DailyTask examples ("Passer chez le comptable," "Préparer les
dossiers KARMDA," "Faire le point avec le Coordinateur") have no
prospect at all — they're general operational instructions. This is a
structural distinction, not a naming one: `DailyTask` should have no
required (or, per §8 below, even optional) relationship to `Prospect`.

### 1.7 Dashboard integration points

Confirmed this session (full nav/shell audit):

- **Two independent, hand-duplicated nav-item lists** for the shared
  ADMIN/MANAGER/ASSISTANT shell: `component/dashboard/Sidebar.tsx`
  (desktop, `hidden ... lg:flex`) and
  `component/dashboard/AdminMobileHeader.tsx`'s `getAdminNavItems`
  (mobile, `lg:hidden`, drawer-based via `MobileNavDrawer`) — each item's
  role-visibility condition is re-expressed independently in both files
  (already a known pre-existing inconsistency: the same route is labeled
  differently in the two lists for `/admin/reports`).
- **A separate, third, de-duplicated list** for COMMERCIAL:
  `component/commercial/commercialNavItems.tsx`'s `commercialNavItems`,
  consumed by both `CommercialSidebar.tsx` and `CommercialMobileHeader.tsx`
  — COMMERCIAL never touches the admin-shell components at all.
- Post-login redirect (`src/lib/dashboard-routing.ts:24-31`): COMMERCIAL
  → `/dashboard/commercial`; ADMIN/MANAGER/ASSISTANT → `/admin`.
- Route-naming convention, confirmed consistent across the whole app:
  **self-service routes carry no `/admin` prefix and are reachable
  identically from whichever shell the actor is in** (`/notes`,
  `/reports`, `/profile`) — **management routes are `/admin`-prefixed**
  (`/admin/my-prospects`, `/admin/follow-ups`, `/admin/reports` — a
  *separate* route from the self-service `/reports`, `/admin/performance`,
  `/admin/users`). This is a directly reusable, already-proven pattern
  for exactly "Ma journée" (self) vs. a management view (§13, §14).
- Closest existing "prominent card" precedent:
  `AssistantDashboardOverview`'s `ASSISTANT_SHORTCUTS` grid
  (`app/admin/page.tsx:125-193`) — a `grid gap-4 sm:grid-cols-2
  lg:grid-cols-3` of `rounded-4xl border ... shadow-sm` link-cards, each
  icon + label + one-line description, appearing prominently on the
  ASSISTANT's dashboard landing page. ADMIN/MANAGER instead see
  `KpiCards` first (`app/admin/page.tsx:112`); COMMERCIAL sees
  `CommercialKpiCards` first (`app/dashboard/commercial/page.tsx`).

### 1.8 Timezone/date utilities

`src/lib/financial-report-period.ts` (read in full this session) is
**the single centralized source of RELAIS's business timezone**:
`BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES = 0` (Africa/Ouagadougou, UTC+0, no
DST — file's own comment: "If RELAIS ever needs a different business
timezone, this is the only constant that has to change"). Exposes
`startOfBusinessDay(date)`, `businessLocalMidnight(y,m,d)`,
`formatBusinessIsoDate`, `parseIsoDateAsBusinessMidnight`.
`src/lib/daily-report-date.ts` builds `getCurrentBusinessDate`/
`resolveDailyReportDate` directly on top of these — explicitly "so this
domain never introduces a second definition of 'business day'"
(file's own comment). This is directly reusable, unmodified, for
Workday's `workDate` — see §5.

### 1.9 Existing historical-snapshot conventions

Extremely well established across the codebase:
`ProspectActivity.agentName`/`creditedUserRoleAtEvent`,
`UserCreationActivity.roleAtEvent`,
`DailyReport.templateType`, every Performance-domain
`roleAtAssignment`/`roleAtEvaluation`/`evaluatorRoleAtEvent`/catalog
snapshot — all "capture once at event time, never re-derive from a live
relation on read." **Counter-precedent, equally well established**:
`ProspectAction` (§1.1) preserves zero role snapshots across its four
User relations — identity alone is treated as sufficient provenance
there. Both conventions coexist in this codebase depending on whether
the *role itself* is ever meaningfully re-displayed or re-evaluated
later. §7/§10 below apply this distinction concretely to Workday/
DailyTask.

### 1.10 Concurrency precedent

`prospect-action.service-core.ts`'s `completeProspectActionCore` (read
in full this session): pre-check for a precise error message, then a
single **guarded conditional write** — `updateMany({where: {id,
status: "OPEN"}, ...})`, count === 0 ⇒ `CONCURRENTLY_MODIFIED`. Its own
comment: "the atomic conditional write... is the actual race-safety net
against a second, concurrent completion — see the ledger reversal core
for the same shape." This is the established, proven pattern this
codebase already uses twice (`ProspectAction`, `LedgerEntry.reverseAtomically`)
for exactly "first successful transition wins, no double-transition" —
directly reusable for every start/confirm/end/complete guard below.

### 1.11 Server-action / self-identity conventions

`src/actions/authorize-action.ts`'s `authorizeAction(() =>
requireX())` wraps every server action, converting a thrown
`AuthorizationError` into a typed `{ok:false, message}` result. Every
**self-service** mutation observed this session (`personal-note.actions.ts`'s
`createPersonalNoteAction`, etc.) calls the underlying service with
`authorization.user.id` — the server-resolved actor identity — **never**
a client-submitted `userId`. This is the established convention §13's
"server authority for timestamps" and §80's IDOR recommendations build
directly on.

---

## 2. Role/capability architecture (ticket §3)

Recommend introducing named capability constants in
`authorization.service-core.ts`, following the exact established
pattern (§1.2), rather than inline role checks scattered through new
services:

```text
WORKDAY_ELIGIBLE_ROLES        = ["MANAGER", "COMMERCIAL", "ASSISTANT"]
  → who has their own Ma journée. ADMIN excluded (§4).

DAILY_TASK_RECIPIENT_ROLES    = ["MANAGER", "COMMERCIAL"]
  → who can receive a DailyTask. ASSISTANT and ADMIN excluded (§7, §32).

WORKDAY_CONFIRMATION_ROLES    = ["ADMIN", "MANAGER"]
  → coarse gate: who may confirm *anyone's* start at all.

TASK_ASSIGNMENT_ROLES         = ["ADMIN", "MANAGER"]
  → coarse gate: who may assign a task at all.
```

Plus two **pure, subject-dependent functions**, mirroring
`canAssessEmployeeInStructuredEvaluation`'s proven shape exactly
(§1.2):

```text
canConfirmWorkdayStart(actorRole, subjectRole, isSelf) → boolean
  ADMIN    → MANAGER, COMMERCIAL, ASSISTANT   : true
  MANAGER  → COMMERCIAL, ASSISTANT            : true
  MANAGER  → MANAGER, or isSelf               : false
  anyone else                                  : false

canAssignTask(actorRole, subjectRole, isSelf) → boolean
  ADMIN    → MANAGER, COMMERCIAL              : true
  MANAGER  → COMMERCIAL                        : true
  MANAGER  → MANAGER, ASSISTANT, ADMIN, or isSelf : false
  anyone else                                  : false
```

This is the ticket's own §3/§33 question ("should these become explicit
capability constants rather than scattered role checks") answered from
direct precedent: yes, and the precedent for *both* the coarse-gate and
fine-matrix halves already exists in this codebase for a structurally
identical problem. **Not implemented in 27A** — this is the recommended
shape for 27C/27E.

---

## 3. Role matrix, decided per role (ticket §4-7)

### 3.1 ADMIN — no own Workday, management authority only

ADMIN is excluded from `WORKDAY_ELIGIBLE_ROLES`. This matches the
ticket's own framing exactly (ADMIN is organizational/administrative
authority, not a field worker in this feature) and requires no schema
accommodation — an ineligible role simply never has a `Workday` row,
there is no "N/A" state to represent. ADMIN retains confirmation
authority over every eligible role (§2) and full team-visibility (§11).

No existing Admin-shell assumption blocks this — `app/admin/layout.tsx`'s
gate (`requireDashboardAccess`, ADMIN/MANAGER/ASSISTANT) is a coarse
shell gate only (its own comment: "not authorizing anything nested"), so
ADMIN landing in the shared shell without a "Ma journée" card of their
own is exactly how the existing `AssistantDashboardOverview`-style
role-conditional dashboard content already works (§1.7) — no
architectural obstacle.

### 3.2 MANAGER — worker + coordinator, decided

MANAGER is in `WORKDAY_ELIGIBLE_ROLES` (has their own Ma journée,
receives tasks from ADMIN, starts/ends their own day like anyone else)
**and** has confirmation/assignment authority over COMMERCIAL and
ASSISTANT only — never over another MANAGER, never over themselves
(§2's matrix already encodes both restrictions). This dual role requires
no special modeling: it's simply "this User both passes
`WORKDAY_ELIGIBLE_ROLES` for their own actions and passes
`WORKDAY_CONFIRMATION_ROLES`/`TASK_ASSIGNMENT_ROLES` for others'" — the
same actor evaluated against two independent capability checks, exactly
like how a MANAGER already both files their own `DailyReport` and reads
others' via `DAILY_REPORT_MANAGEMENT_ROLES` today.

### 3.3 Manager→Commercial team relation — confirmed absent, decision made (ticket §5, §21, §58)

**Confirmed by direct grep (§1.4): no durable team relationship exists
anywhere in this codebase.** "Manager can assign to Commercial" today
can only mean **any Manager → any Commercial**, organization-wide — the
identical, already-accepted limitation the Performance domain operates
under (26C §11.4: "MANAGER/ADMIN authority across the entire Performance
domain is organization-wide, not team-scoped... there is no
manager-of-employee assignment concept anywhere").

**Recommendation: adopt the same limitation for V1, do not invent a team
model.** Building a `ManagerTeamMembership` (or similar) table solely for
this feature would be exactly the kind of unrequested new concept the
ticket's stop condition (§95) warns against inventing silently — and it
would need its own audit (who assigns team membership, does it snapshot
historically, etc.) that 27A was not asked to perform. This is
documented here as an accepted, known limitation, not silently designed
around.

### 3.4 COMMERCIAL — decided, straightforward

In both `WORKDAY_ELIGIBLE_ROLES` and `DAILY_TASK_RECIPIENT_ROLES`. May
receive tasks from ADMIN or MANAGER (§2's `canAssignTask` matrix). No
confirmation or assignment authority of their own. Matches the ticket's
§6 verbatim.

### 3.5 ASSISTANT — Workday without tasks, decided

In `WORKDAY_ELIGIBLE_ROLES`, **not** in `DAILY_TASK_RECIPIENT_ROLES`.
Start confirmable by ADMIN or MANAGER (§2's matrix already covers this —
`canConfirmWorkdayStart` admits ASSISTANT as a subject for both actor
roles).

**Static guidance copy, not a fake DailyTask** (ticket §7): the
"Appuie le Coordinateur..." message is presentation content, not
historical task data. Recommend it live as a plain constant in the
presentation layer — directly following the existing precedent of
`ASSISTANT_SHORTCUTS` (`app/admin/page.tsx`, §1.7) and
`daily-report-options.ts`/`prospect-conversion-options.ts`-style
UI-copy constant modules already used elsewhere in this codebase for
role-conditional static text. **Do not** create a `DailyTask` row, a
`SystemTask` model, or any database-backed representation for this — it
is UI copy, keyed by role, nothing else.

---

## 4. Fixed working hours & the expected-hours snapshot (ticket §8)

No `WorkSchedule`/`Shift`/`ScheduleTemplate`/`EmployeeSchedule` model —
confirmed unnecessary for V1; RELAIS operates one fixed schedule
(08:00–17:00) today with no evidence of per-employee variation anywhere
in the codebase.

**Recommendation: snapshot `expectedStartTime`/`expectedEndTime` onto
`Workday` at creation, sourced from a single hardcoded constant** (e.g.
`DEFAULT_WORKDAY_EXPECTED_START_MINUTES = 8 * 60`,
`..._END_MINUTES = 17 * 60`, mirroring `BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES`'s
"one constant to change later" shape, §1.8). Reasoning: this is a
two-field, negligible-cost addition that directly answers the ticket's
own historical question ("if RELAIS changes its official working hours
later, how do we avoid interpreting an old workday using today's
schedule?") — without it, a future hours change would silently
reinterpret every historical `Workday`'s "was this person late" question
using the *new* hours. This follows the exact discipline already
established for `DailyReport.templateType` (§1.1) — snapshot a mutable
global default at creation time, never re-derive it later. **This is a
recommendation, not a certainty** — flagged honestly as a judgment call,
since no repository evidence confirms RELAIS actually plans to change
hours; but the cost of being wrong (not snapshotting, then hours change)
is a silent historical-truth corruption, while the cost of snapshotting
unnecessarily is two extra integer columns. Asymmetric enough to
recommend doing it.

---

## 5. Timezone — canonical rule (ticket §9)

**Answer, using existing infrastructure verbatim, no new code needed
conceptually:**

```text
"Today" (workDate)  = startOfBusinessDay(serverNow), i.e. the
                       Africa/Ouagadougou (UTC+0) business-calendar day
                       containing the current server instant — computed
                       exactly like DailyReport.reportDate already is
                       (§1.8), via the same shared
                       financial-report-period.ts primitives.

Server runs in UTC?  → Irrelevant by construction: RELAIS's business
                       offset is +0, so server UTC time already IS
                       business-local wall time (this is the one case
                       where "UTC" literally is the business timezone —
                       already an explicit code comment in
                       daily-report-date.ts).

Admin in another
country?             → Irrelevant. workDate/startedAt/endedAt/confirmedAt
                       are always computed from the SERVER clock, in
                       business time — never the browser's Date(), never
                       a client-submitted timestamp (§6/§13).

07:58 means...        RELAIS local time, always — never browser-local.
                       The UI may format a stored UTC instant using the
                       viewer's browser locale for *display*, but the
                       value itself and the workDate it's grouped under
                       are computed server-side in business time.

Deriving workDate
from a timestamp      startOfBusinessDay(timestamp) — reuse, don't
                       reimplement.
```

No timezone configuration is introduced (per the ticket's own
instruction) — the single existing `BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES`
constant remains the one place this would ever change.

---

## 6. Workday identity (ticket §10)

```text
@@unique([employeeUserId, workDate])
```

directly mirroring `DailyReport.@@unique([ownerUserId, reportDate])`
(§1.1) — same shape, same reasoning, already proven sufficient for an
identical "one record per employee per business day" requirement. No
gap found requiring anything more (e.g. no evidence any employee could
legitimately have two workdays on one business date — RELAIS has one
operating location/timezone, confirmed §1.8). The database must enforce
this via the compound unique index, not application logic alone —
matching every other identity invariant in this codebase.

---

## 7. Workday creation timing — the central design decision (ticket §11-12)

**Compared explicitly, per the ticket's instruction:**

**Option A — `DailyTask` keyed independently by `(assignedToUserId,
workDate)`, no relationship to `Workday` at all.** A `Workday` row is
created lazily, only at the moment of the *first truthful declaration
about it* — i.e., inside the start-declaration mutation itself.

**Option B — a `Workday` record must be proactively created before the
employee starts** (e.g., created whenever a task is first assigned for
that date, or via some daily batch process), with `DailyTask` optionally
referencing it.

**Recommendation: Option A**, for reasons directly tied to §12's own
invariant ("Workday existence must not imply attendance"):

- Under Option B, a `Workday` row would necessarily exist *before* any
  attendance fact is known (created purely because a task was assigned)
  — precisely the "fictional workday history" risk the ticket warns
  against (§11's Sunday-evening example). Every consumer of `Workday`
  would then need to remember "existence doesn't mean attendance,"
  forever, as a caveat on every read.
- Under Option A, `Workday`'s very existence *is* meaningful — a row
  exists **if and only if** the employee has declared a start. There is
  no caveat to remember, because there is no case where a row exists
  without a real declaration behind it. This directly satisfies §63's
  request to avoid persisting a redundant "not started" state: "no
  `Workday` row for `(employee, workDate)`" already means "not started,"
  with no extra field needed.
- This also cleanly resolves §22 ("can start be confirmed before
  declaration?") **structurally, not just by policy**: confirmation
  requires a `Workday` row to attach `confirmedAt` to, and no row exists
  until start is declared — so "confirm before declare" isn't merely
  disallowed by a service check, it's *impossible to represent*.
- `DailyTask` needing to exist independently of `Workday` (§11's own
  requirement — Sunday-evening task assignment for a Monday that hasn't
  begun) falls out naturally: `DailyTask.workDate` is just a plain date
  field, no foreign key to `Workday` at all, ever. A manager assigning
  Monday tasks on Sunday evening writes a row with `workDate = Monday`,
  full stop — nothing about `Workday`'s existence is touched or implied.

**This is the single most load-bearing decision in this document** —
every subsequent lifecycle recommendation (§8-10 below) follows directly
from it.

---

## 8. Start declaration (ticket §13-18)

**Semantics, precisely** (per §13's own instruction): `startedAt` is
*the timestamp at which RELAIS CRM accepted the employee's declaration
that they were starting their workday* — not proof of physical arrival,
not a schedule computation, a pure server-accepted-declaration fact.

**Server authority** (§14): `startedAt` is always `new Date()` computed
server-side, inside the mutation that creates the `Workday` row (§7) —
never a client-submitted value. This matches the established
`authorizeAction`/self-scoped-service convention (§1.11) exactly: a
future `startMyWorkday()` server action resolves the actor via
`requireX()`, never accepts a client `startedAt`.

**Idempotency** (§15): since `Workday` creation *is* the start
declaration (§7), the database's `@@unique([employeeUserId, workDate])`
constraint is the concurrency backstop — a second concurrent
`Workday.create()` for the same employee/date fails on the unique
constraint, and the service returns "already started" (reading back the
existing row's real `startedAt`) rather than erroring or silently
succeeding twice. **The first successful create's `startedAt` never
changes** — there is no update path for this field at all, only a
create-or-detect-existing path. This satisfies §15's invariant
structurally, the same way §7's design satisfies §22 structurally.

**No clamping** (§16-17): `startedAt` is recorded exactly as declared,
before or after 08:00, with zero adjustment.

**No persisted ON_TIME/LATE status** (§17): both `startedAt` and the
snapshot `expectedStartTime` (§4) are already persisted facts; "late" is
trivially `startedAt > expectedStartTimeForThatWorkday`, computed at
read time. Persisting a third, redundant field would violate the
ticket's own "prefer objective facts over redundant classifications"
instruction — there is no historical value a persisted classification
would add that the two underlying facts don't already provide.

**No sanctions** (§18): confirmed — nothing in this design touches
Performance, blocks work, or issues warnings. See §16 for the explicit
Performance non-integration.

---

## 9. Start confirmation (ticket §19-25)

**Semantics, frozen precisely** (§20): `confirmedAt`/`confirmedByUserId`
mean *"at this timestamp, an authorized actor confirmed this employee's
presence/start during the operational control process"* — **never**
"the employee started working at this time." `startedAt` is never
rewritten by a confirmation, in either direction (§19).

**Authority**: `canConfirmWorkdayStart` (§2) — ADMIN confirms
MANAGER/COMMERCIAL/ASSISTANT; MANAGER confirms COMMERCIAL/ASSISTANT
only; nobody confirms their own start; MANAGER never confirms another
MANAGER (ticket §21's matrix, verbatim). Recommend this stay an
organization-wide capability (§3.3) rather than a team-restricted one,
for the same reason as task assignment (§3.3) — no team relation exists
to restrict it to.

**Confirm before declaration** (§22): **No — and this is structural, not
just a service check** (§7). A confirmation mutation targets a specific
employee+workDate; if no `Workday` row exists yet, there is nothing to
confirm — the mutation fails with "not started yet," not a partial or
placeholder confirmation.

**No lifecycle enum** (§22's own preference, honored): state is fully
derivable from the timestamp tuple — see §17 below for the complete
derivation.

**Idempotency** (§23): guarded conditional update
(`updateMany({where: {id, confirmedAt: null}, data: {confirmedAt: now,
confirmedByUserId: actor.id}})`, count === 0 ⇒ "already confirmed by
X"), directly reusing the proven `ProspectAction`/`LedgerEntry` pattern
(§1.10). First successful confirmation wins; `confirmedAt`/
`confirmedByUserId` are never overwritten afterward.

**Confirmation after end** (§24) — **recommend Option B: same-day
confirmation even after end, never backdated**:

```text
08:02 employee starts
17:00 employee ends
17:15 Manager confirms (confirmedAt = 17:15, real-time, not backdated)
```

Justification: because `confirmedAt` was already redefined (§20 above)
to mean "when confirmation happened," not "when the employee started," a
late-in-the-day confirmation is **still fully truthful** — it honestly
says "confirmed at 17:15," which is administratively late but not a
lie. Restricting confirmation to `workDate`'s own business calendar day
(never a *different*, older day) prevents the one thing that actually
would be dishonest: confirming a stale day long after the fact, which
would read less like "we were slow today" and more like fabricated
after-the-fact record-keeping. **Option A (only-while-active) was
rejected** because it would make a common, harmless operational lapse
(forgetting the morning check until end-of-day) permanently
unconfirmable, with no way to correct it later (§26's "no override"
rule leaves no other path). **Option C (no retrospective confirmation
at all) was rejected for the same reason.** No backdated
`confirmedAt` value is ever accepted from any input — it is always
`new Date()` at the moment the mutation runs (§14).

**Unconfirmed days are valid, truthful data** (§25): `startedAt` set,
`confirmedAt` null, `endedAt` set — a legitimate terminal state, never
auto-transformed into anything else. See §17's derived-state table.

---

## 10. End declaration (ticket §26-30)

**Actor**: only the `Workday`'s own employee. **No emergency override**
recommended for V1 — the ticket's own default ("no override... unless
existing operational requirements demand it") stands unmodified: this
audit found no existing operational requirement (no prior support
ticket, no code comment, no product-model text) demanding one.

**Requires start** (§27): structurally guaranteed by §7 — a `Workday`
row cannot exist without `startedAt` already set, so "cannot end unless
started" is automatically true; the end mutation only needs to check
that the row exists and `endedAt` is still null.

**Server-authoritative timestamp, not client-editable** (§28): same
convention as `startedAt` (§8).

**Idempotency** (§29): identical guarded-update pattern
(`where: {id, endedAt: null}`), first successful end wins.

**No Manager end confirmation** (§30): confirmed, explicitly excluded —
no `managerConfirmedEndAt`/`managerConfirmedEndBy` fields, no service
path for one. There is exactly one confirmation lifecycle in this
domain (the morning start confirmation), not two.

---

## 11. DailyTask domain (ticket §31-49)

### 11.1 Semantic freeze (§31)

**Tâche**, not **Objectif** — a `DailyTask` means "work management has
asked the employee to handle that day," never a performance
target/quota/KPI/guaranteed outcome/disciplinary obligation. No
repository naming reason to deviate from the ticket's own vocabulary —
`ProspectAction`'s `title`/`description` shape (§1.1) is already the
closest, entirely non-performance-flavored precedent.

### 11.2 Participants (§32)

Only `MANAGER` and `COMMERCIAL` are in `DAILY_TASK_RECIPIENT_ROLES`
(§2) — ASSISTANT gets static guidance instead (§3.5), ADMIN is
management-only and never a task recipient.

### 11.3 Assignment authority (§33)

`canAssignTask` (§2): ADMIN → MANAGER, COMMERCIAL; MANAGER → COMMERCIAL
only. Nobody assigns to self. MANAGER never assigns to another MANAGER
or to ASSISTANT/ADMIN. Same organization-wide-authority caveat as §3.3
(no team restriction exists to narrow this further).

### 11.4 Provenance — no role snapshot recommended (§34)

Recommend **plain identity provenance**: `assignedToUserId`,
`assignedByUserId`, `workDate`, `content`, `assignedAt` — **no**
`roleAtAssignment`/`assignedByRoleAtEvent` snapshot. Justification,
directly answering the ticket's "do not add snapshots merely because
other domains use them": `ProspectAction` (§1.1) is the closest
structural precedent — four independent `User` relations, zero role
snapshots, because *authorization is checked and enforced once, at
write time, and never re-evaluated from historical rows later*. Nothing
in this design's UI mockups (§1 of the ticket) or read paths ever
displays "assigned by a Manager" as a role-badge on a historical task —
unlike `creditedUserRoleAtEvent`, which genuinely is redisplayed. If a
future concrete UX need for "what role was the assignor at the time"
emerges, it's a cheap two-column addition then — but adding it now,
unused, is exactly the "snapshot merely because other domains do" the
ticket warns against.

### 11.5 Task content (§35)

Minimum: `content` (a single text field — the ticket's own examples are
one-line instructions; `ProspectAction`'s `title`+`description?` split
exists because it has a longer structured detail need DailyTask's
examples don't show evidence of). **Recommend a single `content String`
field for V1**, not a title/description split, unless a concrete current
RELAIS workflow is found needing the split — none was found in this
audit. No `priority`/`category`/`estimatedHours`/`tags`/`attachments`/
`comments`/`subtasks`/`recurrence` — none evidenced by any current
RELAIS workflow this audit reviewed.

### 11.6 Task date — both facts preserved (§36)

`assignedAt` (creation timestamp) and `workDate` (the date the task is
*for*) are both stored — directly mirroring `DailyReport.reportDate` vs.
`createdAt`'s already-proven distinction (§1.1).

### 11.7 Future and retrospective assignment (§37-39)

- **Future dates: allowed** — no restriction found necessary; matches
  the ticket's own "likely yes."
- **Retrospective (workDate in the past relative to the assignment
  moment's business date): not allowed for new task creation** —
  adopting the ticket's own explicit default recommendation. A new task
  claiming to have been assigned "for" a day that's already over would
  fabricate a historical expectation that was never actually
  communicated on that day.
- **Same-day assignment remains allowed after the employee started**
  (§39) — since `DailyTask` has zero dependency on `Workday`'s state
  (§7), there is no mechanism by which starting a day could "freeze" the
  task list even if we wanted it to; a 14:00 assignment is simply
  `assignedAt = 14:00, workDate = today`, truthfully preserved.

### 11.8 Completion (§40-42)

**`completedAt` timestamp, not a boolean** — per the ticket's own "likely
yes," for the same reason `submittedAt`/`occurredAt`-style timestamps
are preferred everywhere else in this codebase over booleans.

**Authority: only the assigned employee, no assignor/Admin override in
V1** — the ticket's own default ("management observes; employee
reports completion") stands; no concrete operational counter-requirement
was found.

**Un-completion — recommend: freely toggleable while the workday is
still open, frozen once the day has ended.** This directly reuses §13's
"ending closes employee-initiated actions for that date" boundary
(below) rather than inventing a separate rule — an employee who
mis-clicked "complete" at 10:00 can undo it before 17:21's
`endedAt`, but not after. This is Option B-ish from the ticket's menu
("reopen but preserve [a clear] boundary") without needing any
additional event-history machinery — the boundary is `endedAt` itself,
already persisted for an unrelated reason.

### 11.9 Editing assigned tasks (§43)

**Recommend: editable, with `updatedAt` tracked, no prior-text version
history in V1** — the ticket explicitly sanctions this as one of its two
acceptable options, and it's the simpler one. **Historical tradeoff,
documented as instructed**: a later read of an edited task cannot
recover what the employee was originally asked to do at assignment
time — if RELAIS's actual workflows turn out to need that (disputes
about "you never told me 15 schools"), a future ticket would need to add
either immutability-after-first-edit or a lightweight edit-history
table. Not built here — no current evidence this dispute pattern
actually occurs.

### 11.10 Deletion (§44)

**Recommend: `CANCELLED` status, not hard delete** — directly reusing
`ProspectActionStatus`'s exact proven shape (`OPEN`/`COMPLETED`/
`CANCELED`, optional `cancellationReason`, §1.1) rather than inventing a
new pattern. Justification matches the ticket's own reasoning precisely:
a task disappearing from a day's history (especially one already marked
complete, or already visible to the employee) distorts what actually
happened that day — cancellation preserves the fact "this was asked,
then withdrawn," which is strictly more truthful than deletion.

### 11.11 Unfinished tasks at day end (§45)

**Ending a Workday never requires task completion** — confirmed no
coupling should exist; `Workday.endedAt` and `DailyTask.completedAt` are
entirely independent facts (this falls directly out of §7's "no FK
between them" decision — there is no mechanism by which one could block
the other even accidentally).

### 11.12 Unfinished tasks tomorrow (§46)

**Recommend: never carry forward, never mutate `workDate`.** An Aug 31
unfinished task remains, permanently, an Aug 31 task. If management
wants the same work handled Sep 1, they create (or a manager
re-assigns, per §11.13) a **new** task with `workDate = Sep 1`. No
"carried from" reference field is recommended for V1 — flagged as a
plausible, low-cost future enhancement if this becomes an observed
operational annoyance, but not built without evidence it's needed.

### 11.13 Reassignment (§47)

**Recommend: prohibit mutating `assignedToUserId`.** To move work from
Mamadou to Yacouba, the assignor cancels the original (§11.10,
preserving "this was asked of Mamadou, then withdrawn") and creates a
new task assigned to Yacouba (preserving "this was asked of Yacouba,
from this moment"). This costs nothing beyond "don't expose that field
as editable" — no new mechanism, and it avoids ever silently rewriting
who was actually asked to do something.

### 11.14 ProspectAction / DailyReport separation (§48-50)

**Default to full separation, as the ticket instructs — no optional
`ProspectAction` reference on `DailyTask` in V1.** No concrete UX problem
surfaced in this audit that would require linking them (§1.6's
structural distinction — prospect-tied vs. general operational
instruction — already cleanly separates the two domains without any
cross-reference). Completing a `DailyTask` never mutates `Prospect`/
`ProspectActivity`; writing "Relancer 5 écoles" as a `DailyTask` never
fabricates five `ProspectAction` rows. `DailyReport` (self-authored
narrative) and `DailyTask` (management's instruction) are confirmed
independent axes that merely happen to share a date — no merge, no
shared model, per §1.5/§1.6.

### 11.15 Workday / DailyReport independence (§51)

**Confirmed independent lifecycles, as the ticket's own default
expects**: ending a `Workday` never auto-submits a `DailyReport`;
submitting a `DailyReport` never auto-ends a `Workday`. No existing
`DailyReport` semantics (§1.5 — self-authored, no assignment concept)
suggest otherwise.

---

## 12. Derived lifecycle — no persisted status enum (ticket §22, §63, §90-91)

### 12.1 Workday

Fully derivable from the timestamp tuple, per §7's design:

```text
NOT STARTED         no Workday row for (employee, workDate)
STARTED/UNCONFIRMED  row exists, confirmedAt = null, endedAt = null
CONFIRMED            row exists, confirmedAt set,    endedAt = null
ENDED (unconfirmed)  row exists, confirmedAt = null, endedAt set   ← valid (§25)
ENDED (confirmed)    row exists, confirmedAt set,    endedAt set
```

```text
NOT STARTED
     │
     │ employee: startMyWorkday()          — creates the Workday row
     ▼
STARTED / UNCONFIRMED ──────────────┐
     │                              │ authorized actor:
     │ employee: endMyWorkday()     │ confirmStartFor(employee)
     ▼                              ▼
   ENDED                      CONFIRMED
  (unconfirmed,             │
   terminal)                │ employee: endMyWorkday()
                             ▼
                           ENDED (confirmed, terminal)

  — confirmStartFor() also remains valid same-business-day
    after ENDED (§24), transitioning ENDED(unconfirmed) → ENDED(confirmed).
```

No `status` column recommended — every state above is a read-time
projection of `startedAt`/`confirmedAt`/`endedAt`, matching §22's own
explicit preference and this codebase's general bias toward deriving
state from facts (e.g. `ProspectActionStatus.OVERDUE` is explicitly
never persisted either, per that enum's own schema comment — direct
precedent for this exact judgment call).

### 12.2 DailyTask

```text
OPEN
  ├── assigned employee: completeMyTask()  → COMPLETED (completedAt set)
  │        └── assigned employee, only while Workday not ended (§11.8):
  │            uncompleteMyTask() → back to OPEN (completedAt cleared)
  └── assignor/authorized actor: cancelTask() → CANCELLED (cancellationReason?)
```

**This one *does* need a persisted `status` enum** (`OPEN`/`COMPLETED`/
`CANCELLED`), unlike `Workday` — because cancellation is a genuine third
outcome that isn't a pure function of timestamps (a task can be
cancelled at any point regardless of whether it was ever completed
first, so "cancelled" can't be derived from "is `completedAt` null").
This exactly mirrors why `ProspectActionStatus` itself is a persisted
enum (§1.1) despite this codebase's general derive-don't-persist bias —
same reasoning, same precedent, applied consistently.

---

## 13. Editing after Workday end (ticket §73)

**Recommend a clear boundary: ending the day freezes the employee's own
task-completion toggling for that date (§11.8), but does not freeze
anything else.**

```text
Can employee reopen task completion?     No, once endedAt is set (§11.8)
Can Manager assign another task to
  that already-ended day?                Yes — workDate = today remains
                                          assignable regardless of that
                                          day's Workday end state (§11.7,
                                          §7's no-FK design) — this is
                                          late housekeeping, not a
                                          historical fabrication
Can task be cancelled?                   Yes, at any time — cancellation
                                          is provenance-preserving, never
                                          destructive (§11.10)
Can confirmation still happen?           Yes, same business day only,
                                          never backdated (§9/§24)
```

Justification for why *task assignment/cancellation* stay open past
`endedAt` while *completion-toggling* doesn't: assignment/cancellation
are **management's** facts about what was asked, which remain legitimate
to record at any point on the same calendar day; completion-toggling is
the **employee's** fact about their own already-closed day, and freezing
it at `endedAt` gives "ending my day" a genuine, single, clear meaning
for the one lifecycle the employee fully controls.

---

## 14. Manager correction workflows (ticket §74-75)

**Recommend: no correction mechanism in V1 for any of
`startedAt`/`confirmedAt`/`endedAt`.** For "employee accidentally
starts," "employee accidentally ends," "manager confirms wrong
employee," and "task assigned to wrong person": **no fix exists in
27A/27B+** as currently scoped. This is deliberate, per §75's explicit
instruction — an Admin typing `startedAt = 08:00` directly, with no
provenance, is exactly the fabrication this domain exists to prevent.
**If this becomes operationally painful, it needs its own explicit
design ticket** (e.g. a `WorkdayCorrection` append-only audit-trail
model, analogous to how `UserStatusActivity` sits *alongside* `User`
rather than editing it in place) — flagged here as a known gap, not
silently solved.

---

## 15. Concurrency (ticket §72)

| Scenario | Handled by |
|---|---|
| Double Start (double-click, retry, two tabs) | `@@unique([employeeUserId, workDate])` — second create fails, service reads back the real existing row (§8) |
| Double End | Guarded `updateMany({where:{id, endedAt:null}})`, first wins (§10) |
| Admin + Manager simultaneous confirmation | Guarded `updateMany({where:{id, confirmedAt:null}})`, first wins, second gets "already confirmed by X" (§9) |
| Two task-completion requests | Guarded `updateMany({where:{id, status:"OPEN"}})`, same shape as `ProspectAction`'s proven pattern (§1.10) |
| Manager cancels while employee completes | Same guarded-update race — whichever transition's `where` clause still matches wins; the loser gets a friendly "already modified" message, exactly like `ProspectAction`'s existing `CONCURRENTLY_MODIFIED` code |
| Two assignors creating equivalent tasks | **Not a conflict at all** — per the ticket's own instruction, no duplicate-text detection is built; two `DailyTask` rows with identical `content` may legitimately coexist |

Every scenario reduces to the same one mechanism (§1.10's guarded
conditional write), already proven twice in this codebase. No new
concurrency primitive is needed.

---

## 16. Workday vs. Performance — explicit non-integration (ticket §52)

Potential future evidence this domain will eventually produce —
`expectedStartTime` vs. `startedAt`, `confirmedAt` presence, `endedAt`,
task completion counts — **must not automatically affect** Results
`/40`, Execution `/30`, Role Responsibilities `/20`, or Professional
Contribution `/10` in 27A or any ticket implementing this audit's
recommendations. No scoring, no deduction, no attendance score, no
task-completion score. **If RELAIS later wants operational discipline
reflected in Performance, that is an explicit, separate, later policy
ticket** — this document only maps where the future evidence *would*
live, per the ticket's own instruction, and stops there.

---

## 17. Explicitly rejected evidence sources (ticket §53-54)

Confirmed and restated, no new research needed: this domain must never
use login timestamps, session duration, last-activity time, time spent
on the CRM, page views, GPS, IP geolocation, device fingerprinting,
camera verification, screenshots, or background activity as Workday
evidence. **The employee's explicit `Commencer ma journée` action is the
only start declaration; `Terminer ma journée` is the only end
declaration.** No existing infrastructure in this codebase does any of
the rejected things today, so nothing needs to be *removed* — this
section exists purely to freeze the boundary before implementation
begins.

---

## 18. Absence, weekends, and future exceptions (ticket §55-57)

### 18.1 Absence — not built, and not inferred (§55)

**No `Absence` domain in 27A.** A person with no `Workday` row for a
given date simply has no start declaration — this must **never** be
read as "absent," because leave, weekends, holidays, and other
legitimate non-working reasons are not modeled at all yet (§18.2-18.3).
`Workday`'s own design (§7) already makes this the correct default: no
row ever silently implies anything beyond "no declaration happened."

### 18.2 Weekends — UNRESOLVED (§56)

**No repository evidence** (code, comment, or prior ticket doc) states
RELAIS's actual Saturday/Sunday operating expectations. Per the ticket's
own instruction ("if not known, mark unresolved"), this is explicitly
flagged:

```text
UNRESOLVED — weekend / non-working-day behavior
Current semantics: none — no Schedule domain exists, no evidence found
  of RELAIS's actual weekend policy anywhere in the codebase or session
  history.
Why ambiguous: nothing in the audited code, tests, or prior tickets
  states whether RELAIS operates Saturdays, whether Sunday work is
  exceptional-but-real, or whether the CRM should behave any differently
  on those days at all.
Possible options: (A) no special handling at all — Ma journée behaves
  identically every day, Start remains available; (B) hide the Start CTA
  on non-working days; (C) show a distinct "non-working day" state but
  still permit exceptional Start.
Recommendation for V1, given the lack of evidence: (A) — do the least,
  most honest thing. Inventing hidden-CTA or special-state behavior
  without a confirmed RELAIS operating policy would risk silently
  blocking a legitimate exceptional Saturday workday.
Decision needed from: RELAIS operations (an actual answer about
  Saturday/Sunday work), not inferable from code.
```

### 18.3 Holidays / leave / half-days — deferred, not designed (§57)

Not modeled, not invented. The `Workday` design (§6-7) does not
foreclose adding them later (a future `WorkdayException`-style model
could sit alongside `Workday` the same way `UserStatusActivity` sits
alongside `User`), but nothing here is built or assumed for V1.

---

## 19. Employee role changes — historical integrity (ticket §64-67)

**No `roleAtWorkday` snapshot recommended.** Reasoning, directly
answering the ticket's "only recommend it if it preserves information
that otherwise cannot be reconstructed truthfully": eligibility (§2's
`WORKDAY_ELIGIBLE_ROLES`) is checked **only at the moment a new
`Workday`/`DailyTask` is created**, never re-checked against a User's
*current* role when reading an old row. A `COMMERCIAL` who later becomes
`ADMIN` (and thus loses Workday eligibility) does not retroactively
invalidate their old `Workday` rows — those rows already exist as real,
successfully-created facts; ADMIN's current ineligibility only prevents
*new* ones. Nothing about an old row's meaning depends on knowing what
role its owner held — unlike, say, `roleAtEvaluation` on a Performance
assessment, which genuinely *is* redisplayed as "assessed as a
COMMERCIAL" (§1.9's contrast). This same reasoning applies identically
to:

- **Task role changes (§65)**: a `DailyTask` assigned to User X while
  COMMERCIAL remains X's historical task regardless of X's current role.
- **Assignor role changes (§66)**: `assignedByUserId` stays valid
  history even if that Manager later becomes COMMERCIAL — old
  authorization is never re-evaluated against current role.
- **Confirmation actor role changes (§67)**: same principle for
  `confirmedByUserId`.

This mirrors `ProspectAction`'s own zero-role-snapshot precedent (§1.1,
§1.9) exactly — not a new judgment, an application of an existing,
already-proven one.

---

## 20. User deactivation and deletion (ticket §68-69)

**Deactivation**: `User.active = false` (§1.3) should gate *new*
`Workday`/`DailyTask` creation exactly like every other eligibility
check in this codebase (`active: true` alongside the role check) —
history remains fully visible regardless of an employee's current
active state, matching the universal convention already established for
every other domain audited this session.

**Deletion**: confirmed, no `User` deletion path exists anywhere in this
codebase (26A §25, reconfirmed this session via grep — zero
`.user.delete(` call sites). Every `User` foreign key on `Workday`/
`DailyTask` should therefore use `onDelete: Restrict`, matching the
universal convention for every historical/identity-critical relation in
this schema (`ProspectAction`'s four User relations, `UserStatusActivity`,
`UserCreationActivity`, every Performance-domain model). `DailyTask.
assignedToUserId` in particular must be `Restrict`, not `SetNull` —
unlike `Prospect.assignedUserId` (deliberately reassignable, per 26A/26C),
`DailyTask` assignment is explicitly **not** reassignable in this design
(§11.13), so there is no "ownership can move on" case that would ever
justify `SetNull` here.

---

## 21. Organization ownership after 26B (ticket §70-71)

**Recommendation: no `organizationId` on `Workday` or `DailyTask` in
27B+, full stop, until Phase 26 explicitly resumes.**

This is a brand-new domain, introduced *after* 26B, so — unlike every
pre-26B model 26C had to reconcile against existing unscoped production
data — there is no existing-data pressure here at all: a
`Workday`/`DailyTask` table starts empty. Adding `organizationId` now
would provide **zero current operational value** (RELAIS remains the
sole tenant; nothing in this domain is read/written differently per
organization today) while reopening exactly the Phase 26 scope this
ticket was explicitly told to leave paused (§71's own instruction, and
26C's own "avoid a generic `organizationId` spray — decide per domain"
principle, applied here as: *this* domain's decision is "not yet,
revisit when Phase 26 resumes"). If/when Phase 26 does resume, `Workday`/
`DailyTask` will need the same model-by-model audit treatment every
other domain got in 26C — that audit is not performed here, deliberately,
per this ticket's own scope boundary.

**Authorization stays exactly as 26B left it** (§71's explicit
instruction, honored): every capability in §2 checks `User.role`
(current runtime authority), never `OrganizationMembership.role`
(synchronized shadow, zero authorization effect). Nothing in this
document proposes or implies otherwise.

---

## 22. Notification scope (ticket §76)

**Not implemented.** No existing notification infrastructure (push,
email, in-app) was found anywhere in this codebase across this session's
research or prior sessions' work. Plausible future notifications, listed
per the ticket's own suggestion but explicitly deferred: a Manager
seeing "employee started," an employee seeing "your start was
confirmed," an employee receiving "you have a new task." None of these
are trivial given the confirmed absence of any notification
infrastructure — building one is a substantial, separate workstream, not
a natural extension of 27B+.

---

## 23. Dashboard and navigation integration (ticket §77-79)

### 23.1 Placement recommendation

**A prominent card, modeled on the `AssistantDashboardOverview`
shortcut-card pattern** (§1.7) — not the `KpiCards` stat-row style —
because Ma journée's job (a status summary + one clear CTA button) is
structurally a "click through to a feature" card, not a passive metric.
Recommend it appear near the top of each eligible role's existing
landing page:

```text
MANAGER    → top of /admin (alongside/above KpiCards)
COMMERCIAL → top of /dashboard/commercial (alongside/above CommercialKpiCards)
ASSISTANT  → integrated into the existing ASSISTANT_SHORTCUTS grid area
ADMIN      → no own-Workday card (§3.1); a team-visibility entry point
             instead, if/when the management UI (27G below) exists
```

### 23.2 Route recommendation

Following the confirmed self-service-vs-management convention (§1.7)
exactly:

```text
/ma-journee            self-service — no /admin prefix, reachable
                         identically from the admin shell (MANAGER/
                         ASSISTANT) and the commercial shell (COMMERCIAL),
                         one shared page — exactly matching how /notes
                         and /reports already work today

/admin/journees-agents  (illustrative name only — see §23.3) management
                         view — ADMIN + MANAGER, following the
                         /admin/reports (management) vs. /reports (self)
                         precedent
```

### 23.3 Naming — "Journées des agents," not "de l'équipe" (ticket §59)

Directly following from §3.3's confirmed absence of any team relation:
using "équipe" (team) in the UI would **falsely imply** a Manager→team
structure that does not exist. Recommend **"Journées des agents"**
(agents/staff, not "team") — the ticket's own suggested alternative,
confirmed correct by this audit's evidence rather than merely adopted on
the ticket's say-so.

### 23.4 Known integration cost, flagged not fixed

A new nav item requires editing **three independent, hand-duplicated
locations** today (`Sidebar.tsx`, `AdminMobileHeader.tsx`'s
`getAdminNavItems`, `commercialNavItems.tsx`) — confirmed existing
pattern, not something 27A recommends refactoring; noted so 27F/27H
(§25) budget for it rather than being surprised by it.

### 23.5 Mobile (ticket §79)

Confirmed existing convention: `lg` is the desktop/mobile breakpoint
everywhere (`hidden ... lg:flex` / `lg:hidden`), mobile nav is a drawer,
not a bottom bar. No visual implementation performed here — this is
noted purely as a requirement for whoever builds the UI: the Start/End
CTA needs to work well as a single large tap target within that
existing drawer-based mobile pattern, and task checkboxes need adequate
tap-target sizing — standard mobile-usability requirements, not a new
architectural finding.

---

## 24. Security boundaries (ticket §80-84)

### 24.1 Operation matrix

| Operation | Actor | Subject | Required authority |
|---|---|---|---|
| Start workday | employee | self | `WORKDAY_ELIGIBLE_ROLES` + active |
| End workday | employee | self (must equal Workday's own employee) | same employee, `Workday.startedAt` set |
| Confirm start | ADMIN | MANAGER/COMMERCIAL/ASSISTANT | `canConfirmWorkdayStart(ADMIN, subjectRole)` |
| Confirm start | MANAGER | COMMERCIAL/ASSISTANT | `canConfirmWorkdayStart(MANAGER, subjectRole, isSelf=false)` |
| Assign task | ADMIN | MANAGER/COMMERCIAL | `canAssignTask(ADMIN, subjectRole)` |
| Assign task | MANAGER | COMMERCIAL | `canAssignTask(MANAGER, subjectRole, isSelf=false)` |
| Complete/uncomplete task | employee | self (must equal `assignedToUserId`) | assigned employee, `Workday.endedAt` null (§13) |
| Cancel task | assignor (or ADMIN, tbd in 27E) | — | `TASK_ASSIGNMENT_ROLES` — exact matrix tbd; not finalized here |
| View team workdays | ADMIN/MANAGER | agents | `WORKDAY_CONFIRMATION_ROLES` (same constant reused — both capabilities are "management authority over eligible employees," §24.4) |

### 24.2 IDOR-safe service shapes, recommended for 27C/27E

Following the established `authorizeAction`/self-identity convention
(§1.11) exactly:

```text
startMyWorkday()                          — no userId param; actor from session
endMyWorkday()                            — same
completeMyTask(taskId)                    — taskId supplied, but ownership
                                             validated server-side against
                                             {id: taskId, assignedToUserId: actor.id},
                                             matching PersonalNote's existing
                                             {id, userId} pattern
uncompleteMyTask(taskId)                  — same shape
confirmWorkdayStartFor(employeeUserId, workDate)
                                           — explicit subject supplied (this is
                                             inherently an other-person action,
                                             unlike the self-actions above); the
                                             service resolves the target Workday
                                             and validates canConfirmWorkdayStart
                                             server-side, never trusting a bare
                                             workdayId alone
assignTask({ assignedToUserId, workDate, content })
                                           — explicit subject, same reasoning
cancelTask(taskId)                        — ownership/authority validated
                                             server-side against the resolved row
```

**Avoid** `startWorkday(userId)`/`endWorkday(workdayId)`/
`confirmStart(workdayId)`-shaped APIs that accept a bare resource id with
no independent actor/subject validation — exactly the shape the ticket's
§81 warns against, and exactly the shape this codebase already avoids
for every comparable self-action (§1.11).

### 24.3 Attack scenarios, all denied by the matrix above

Manager→Manager assign/confirm, Manager→self assign/confirm,
Manager→Assistant assign (not Assistant→confirm, which IS allowed),
Manager→Admin anything, Commercial ending another Commercial's day,
Commercial completing another's task, Assistant completing a task by ID
(structurally impossible — Assistant is never `assignedToUserId` on any
task, §3.5), Commercial confirming their own start, Admin starting/
ending/completing another employee's declarations (no such service
exists — §24.2's shapes only ever act on `actor.id` for the three
employee-only mutations, with **no admin-override parameter anywhere**,
directly enforcing §84's "authority to manage ≠ authority to
impersonate" instruction).

---

## 25. Historical information checklist (ticket §85-86, required)

### 25.1 What `Workday` must preserve

```text
employeeUserId
workDate
expectedStartTime, expectedEndTime   (snapshot, §4)
startedAt                             (declaration, §8)
confirmedAt, confirmedByUserId        (confirmation, §9)
endedAt                               (declaration, §10)
```

### 25.2 What `DailyTask` must preserve

```text
content                                (task wording — mutable, §11.9)
workDate
assignedToUserId
assignedByUserId
assignedAt
status (OPEN/COMPLETED/CANCELLED)      (§12.2)
completedAt?
cancellationReason?
```

### 25.3 What must NOT be inferred historically (ticket §86)

Explicitly rejected, per the ticket's own list, all confirmed by this
audit's findings: current `User.role` (§19), a current Manager
relationship (none exists to infer from, §3.3), current working hours
(§4's whole point), current `active` state (§20), current
`OrganizationMembership.role` (§21), current mutable task text as a
stand-in for what was originally asked (§11.9's documented tradeoff —
this one genuinely IS a gap in V1, not fully closed, honestly flagged
rather than pretended away).

---

## 26. Proposed conceptual domain model (ticket §89 — illustrative, not production Prisma)

```text
Workday
  id
  employeeUserId        → User, onDelete: Restrict
  workDate               DateTime  (business-midnight normalized, like
                                     DailyReport.reportDate)
  expectedStartTime      Int       (minutes since business midnight, e.g. 480)
  expectedEndTime        Int       (e.g. 1020)
  startedAt               DateTime  (set once, at row-creation time — see §7)
  confirmedAt             DateTime?
  confirmedByUserId       String?   → User, onDelete: Restrict
  endedAt                 DateTime?
  createdAt, updatedAt

  @@unique([employeeUserId, workDate])

DailyTask
  id
  workDate                DateTime  (business-midnight normalized)
  assignedToUserId         → User, onDelete: Restrict   (immutable, §11.13)
  assignedByUserId         → User, onDelete: Restrict
  content                  String
  assignedAt               DateTime
  status                   OPEN | COMPLETED | CANCELLED
  completedAt               DateTime?
  cancellationReason         String?
  createdAt, updatedAt

  — no FK to Workday (§7)
  — no FK to Prospect/ProspectAction (§11.14)
  — no organizationId (§21)
```

This is illustrative, per the ticket's instruction — final field names/
types are a 27B schema-ticket decision, not frozen here.

---

## 27. Unresolved decisions (ticket §92, complete list)

```text
UNRESOLVED — Weekend / non-working-day behavior (§18.2)
  No repository evidence of RELAIS's actual Saturday/Sunday policy.
  V1 recommendation given the lack of evidence: no special handling.
  Needs an actual answer from RELAIS operations before any hide-CTA /
  non-working-day-state feature is built.

RESOLVED, BUT FLAGGED AS A JUDGMENT CALL (not repository-certain):
  - expectedStartTime/expectedEndTime snapshot (§4) — recommended based
    on negligible cost vs. asymmetric historical-truth risk, not on
    confirmed evidence RELAIS plans to change hours.
  - Retrospective confirmation, Option B same-day (§9/§24) — recommended
    based on operational-lapse reasoning, not on a confirmed RELAIS
    incident.

CONFIRMED, NOT MERELY ASSUMED (repository evidence found):
  - Manager→Commercial team relation does not exist (§3.3, §1.4) — grep-
    confirmed, zero matches for any team/hierarchy field.
  - No DailyReport/ProspectAction functional overlap (§1.5, §1.6,
    §11.14) — read in full, structurally distinct.
  - No existing notification infrastructure (§22) — none found.
  - No User deletion path exists (§20) — grep-confirmed, zero matches.
```

Per the ticket's own stop condition (§95): the one concept this audit
was explicitly asked to watch for — **a formal Manager→Commercial
hierarchy** — was searched for directly and confirmed absent, and is
documented here rather than silently designed around (§3.3). No other
undiscussed new concept was found necessary to complete this design.

---

## 28. Recommended implementation decomposition (ticket §93)

Narrow, evidence-derived, not a pre-committed sequence:

```text
27B  Workday schema foundation
     Workday model + migration only, matching 26B's own additive-schema
     discipline (no runtime wiring, no service layer yet). Migration
     content tests only.

27C  Workday lifecycle services
     startMyWorkday/endMyWorkday/confirmWorkdayStartFor — core + wiring,
     the capability constants + canConfirmWorkdayStart from §2, unit
     tests against the fake-dependency-store pattern already used
     throughout this codebase (user.service.test.ts's style). No UI.

27D  DailyTask schema foundation
     DailyTask model + migration — genuinely independent of 27B/27C
     (§7's no-FK design means this can be resequenced before, after, or
     in parallel with the Workday tickets without any dependency
     conflict; noted explicitly since the ticket asked not to
     pre-commit to a rigid order).

27E  DailyTask lifecycle services
     assignTask/completeMyTask/uncompleteMyTask/cancelTask — core +
     wiring, canAssignTask from §2, tests.

27F  Employee-facing "Ma journée" UI
     /ma-journee self-service page, shared across the admin shell
     (MANAGER/ASSISTANT) and commercial shell (COMMERCIAL) per §23.2.

27G  Management-facing "Journées des agents" UI
     /admin/... management route (§23.2/§23.3), confirmation actions,
     team task-assignment UI, historical/date-range views (§62's query
     shapes: employee+date, date+eligible-employees, date range —
     mirroring resolveDailyReportHistoryRange's precedent, §1.1).

27H  Dashboard integration
     The prominent card (§23.1) on each eligible landing page, plus the
     three nav-list edits (§23.4).
```

Isolation from Performance/Phase-26 (§16, §21) should be verified by a
regression test at the end of 27C/27E — "creating/mutating a Workday/
DailyTask does not touch any Performance model or read
`OrganizationMembership`" — mirroring 26B's own regression-test
discipline for its analogous non-interference invariants.

---

## 29. Validation (ticket §96)

```text
$ git status --short
?? notes/ticket-27a-ma-journee-taches-du-jour-domain-audit.md

$ git diff --check
(clean)
```

Only this document was created. No schema, service, test, or production
code was touched.

---

## Closing restatement

> **What did the employee declare about their workday, what did
> management actually confirm, and what work had management actually
> assigned to that employee for that date?**

`Workday.startedAt`/`endedAt` answer the first. `Workday.confirmedAt`/
`confirmedByUserId` answer the second, deliberately decoupled from the
first (§9). `DailyTask`, deliberately independent of `Workday`'s own
existence (§7), answers the third. Nothing in this design reconstructs
any one of these three facts from either of the other two — which was
the ticket's own acceptance test for the whole audit.
