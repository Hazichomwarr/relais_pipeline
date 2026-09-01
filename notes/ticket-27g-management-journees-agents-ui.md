# Ticket 27G — Management "Journées des agents" UI

Implemented 2026-09-01. Builds `/admin/journees-agents`, the
management-facing Workday + DailyTask workspace, on top of the frozen
27C/27E domains and reusing 27F's visual language. No schema change, no
domain-rule change, no navigation/dashboard integration (27H).

## Route & access

`/admin/journees-agents`, gated by a new coarse capability,
`requireDailyWorkManagementAccess()` (`DAILY_WORK_MANAGEMENT_ROLES` —
ADMIN, MANAGER), not bare `/admin` layout inheritance. Identical to
`WORKDAY_CONFIRMATION_ROLES`/`TASK_ASSIGNMENT_ROLES` today by
coincidence, kept as its own constant per this codebase's established
convention (mirroring `PERFORMANCE_DASHBOARD_ACCESS_ROLES` sitting
beside its own narrower mutation-authority constants). Both
`layout.tsx` and `page.tsx` independently call the gate. COMMERCIAL and
ASSISTANT are denied; unauthenticated redirects to `/login`, denied
roles to `/admin`. No permanent nav entry was added (27H's job).

The individual mutations reached from this page — confirmation,
assignment, cancellation — do **not** get any new authorization logic.
They call the exact same 27C/27E server actions
(`confirmWorkdayStartAction`, `assignDailyTaskAction`,
`cancelDailyTaskAction`) already shipped, which independently
re-resolve and re-authorize the real actor/subject/task server-side
every time — this page's presentation hints are never trusted as
authority.

## Read composition — avoiding N+1

`getDailyWorkManagementOverview(actor, workDate)` is thin wiring (in
`daily-work-management.service.ts`) over a new pure core,
`daily-work-management.service-core.ts` — matching this codebase's
established service/service-core split (and directly enabling the unit
tests §75-79 asked for, which a Prisma-coupled wiring file could not
have supported).

**Four bounded queries at most, never one per employee:**

1. Active roster: `role IN (MANAGER, COMMERCIAL, ASSISTANT)`, `active:
   true` — ADMIN is never queried as a roster member at all.
2. Every `Workday` for exactly `workDate` (no date range, no
   in-JavaScript filtering).
3. Every `DailyTask` for exactly `workDate`.
4. **Only if** steps 2-3 reference a User id not already covered by
   step 1 (`resolveMissingUserIds`, pure/testable) — one more bounded
   `id IN (...)` query for exactly those rows.

Step 4 is what makes 27A §8's principle concrete: **a truthful same-day
Workday/DailyTask is never dropped merely because its employee no
longer matches today's active-roster query.** A same-day deactivation,
a role change, or a task assignor who was never part of the roster at
all (an ADMIN) still resolves correctly — proven by dedicated tests, not
merely asserted.

`composeDailyWorkManagementOverview` (the core) then assembles each
agent's `canConfirmStart`/`canAssignTask`/per-task `canCancel` by
calling 27C's `canConfirmWorkdayStart` and 27E's
`canAssignTask`/`canCancelTask` directly — the exact same pure functions
those domains already ship, never a re-derived or approximated rule.

## Roster & presentation authority

| Presentation hint | Rule reused |
|---|---|
| `canConfirmStart` | Workday exists, `confirmedAt === null`, and `canConfirmWorkdayStart(actor.role, subject.role, isSelf)` — remains `true` for an eligible ended/unconfirmed Workday (27A §24/§25), since "today" doesn't change just because the employee already ended |
| `canAssignTask` (per agent) | `canAssignTask(actor.role, subject.role, isSelf)` AND (no Workday, or `endedAt === null`) — assignment is available before Start and during an open day, unavailable once the day has ended |
| `canCancel` (per task) | `task.status === "OPEN"` AND `canCancelTask({actorRole, actorUserId, assignedByUserId})` — ADMIN any OPEN task, MANAGER only their own |

No Manager→team hierarchy was invented anywhere — visibility is
organization-wide (every active MANAGER/COMMERCIAL/ASSISTANT), and
mutation authority is independently narrower per the tables above,
exactly as 27A/27C/27E already established.

## Page composition

```text
app/admin/journees-agents/
  layout.tsx   — auth
  page.tsx     — data fetch + selection + composition
  loading.tsx  — skeleton

component/daily-work/management/
  DailyWorkSummary.tsx       — compact "X commencées · Y confirmées · Z terminées" strip
  DailyWorkAgentList.tsx     — roster pane, sorted, empty state
  DailyWorkAgentRow.tsx      — one scannable row, Link-based selection
  DailyWorkAgentDetail.tsx   — selected agent's Workday + tasks + CTAs
  ManagementTaskItem.tsx     — one task row (À faire/Terminée/Annulée + provenance)
  ConfirmWorkdayButton.tsx   — client, calls confirmWorkdayStartAction
  AssignDailyTaskDialog.tsx  — client, calls assignDailyTaskAction
  CancelDailyTaskDialog.tsx  — client, calls cancelDailyTaskAction

src/lib/daily-work-management-presentation.ts   — sorting, default selection, state labels
src/services/daily-work-management.service-core.ts — pure composition + authority hints
src/services/daily-work-management.service.ts       — thin Prisma wiring
```

Server components by default; only the three mutation-triggering
controls are client components, matching 27F's discipline exactly.
`resolveWorkdayDisplayState`/`formatMinutesAsTime`/
`groupDailyTasksForDisplay`/`sortDailyTasksForDisplay`/
`computeDailyTaskProgress` are all reused directly from 27F's
`daily-work-presentation.ts` — no second interpretation of the same
timestamp tuple was written. (`groupDailyTasksForDisplay` was made
generic in this ticket, since 27G's task shape adds `canCancel`/
`assignedByName` on top of the base `DailyTaskRecord` — a small,
backward-compatible signature change, not a rewrite.)

**Selection is plain URL state** (`?agent=<id>#agent-detail`, 27G §17)
— a `<Link>` per row, no client-side selection state at all. This keeps
the entire list/detail split fully server-rendered. On desktop, a
`lg:grid-cols-[320px_1fr]` layout shows both panes side by side; below
`lg` it naturally stacks to one column (list, then detail), and the
`#agent-detail` fragment scrolls the tapped row's detail into view —
satisfying the "tap → detail" mobile pattern with zero JavaScript.
Default selection (§18): the first agent whose `canConfirmStart` is
true for the *current* actor, otherwise the first agent in the sorted
roster — simple, stable, never randomized.

**Summary strip** (§11): three plain counts, not four KPI cards.

## Task presentation

`ManagementTaskItem` shows French status wording ("À faire" / "Terminée"
/ "Annulée," never raw enum values), the assignor's resolved display
name ("Assignée par …" — management gets provenance the employee view
doesn't need, per 27G §29), and the cancel control only where
`task.canCancel` is already true. A cancelled task shows only its
durable `cancellationReason` — **never** a fabricated `cancelledAt`/
`cancelledByUserId`, which 27D's schema does not have and this ticket
does not add.

## Confirmation, assignment, cancellation interactions

- `ConfirmWorkdayButton` — no dialog ceremony (27G §26), a routine
  operational confirmation with a clear pending label.
- `AssignDailyTaskDialog` — one field (`content` — the domain has no
  title/priority/category split), today's date fixed and shown as
  "Aujourd'hui" (no date picker — 27G is a today-only workspace by
  product decision, even though the backend supports future dates).
- `CancelDailyTaskDialog` — a required reason textarea, since
  cancellation is terminal; the same accessible hand-rolled dialog
  pattern as every other dialog in this codebase (focus trap, Escape,
  body-scroll lock).

All three call the real 27C/27E actions with the explicit subject
(`employeeUserId`/`assignedToUserId`/`taskId`) — never a bare id trusted
without server-side re-verification, and never any impersonation of the
employee's own Start/End/complete/uncomplete actions, which this page
provides no controls for at all (verified by both an authorization
content test and a structural test on the composition core confirming
no such export exists).

## No impersonation — verified, not merely asserted

Management may observe and act within its own authority, but never as
the employee. Two tests directly enforce this: a content test on
`page.tsx`/`layout.tsx` confirming none of
`startMyWorkdayAction`/`endMyWorkdayAction`/`completeMyDailyTaskAction`/
`uncompleteMyDailyTaskAction` is referenced anywhere on this route, and
a structural test confirming the composition core exports no
`startWorkdayFor`/`endWorkdayFor`/`completeTaskFor`/`uncompleteTaskFor`
function.

## Cancellation-provenance limitation — carried forward honestly

Same known V1 limitation as 27E: 27D's schema has no `cancelledAt`/
`cancelledByUserId`. `ManagementTaskItem` displays only
`status`/`cancellationReason` for a cancelled task — nothing in 27G
infers or fabricates who cancelled it or when, from `updatedAt`, the
current actor, or `assignedByUserId`.

## Accessibility & responsive design

Semantic `h1`/`h2`/`h3` headings; every mutation trigger is a real
`<button type="button">`; agent selection is a real `<a>` (via `Link`),
keyboard-focusable and activatable without a mouse; Workday state is
always paired with text (`getWorkdayStateLabel`), never a colored dot
alone (§59); both dialogs have `aria-labelledby`/`aria-describedby` and
trap focus, matching 27F's `EndWorkdayDialog` pattern exactly. No
button or link strips the native focus outline anywhere in this ticket.
Mobile: single-column stack, no horizontal data table, dialogs sized to
fit small viewports, textareas remain visible above the keyboard by
virtue of the dialog's own scrollable backdrop.

## Verification

```text
npx tsc --noEmit                 — clean, zero errors
npx eslint (new/changed files)   — clean
npm test                         — 2370 tests, 2369 pass, 1 fail
                                    (component/dashboard/Sidebar.test.tsx
                                    — the same pre-existing baseline
                                    failure documented since 27B,
                                    confirmed present on main before any
                                    Daily Work code; not touched here)
npm run build                    — clean; /admin/journees-agents
                                    appears in the route list
git diff --check                 — clean
git diff --stat prisma/          — empty; no schema/migration change
```

40 new tests: `daily-work-management.service-core.test.ts` (34 —
`resolveMissingUserIds`, roster/read composition including the same-day
historical-preservation case, the full confirmation/assignment/
cancellation presentation matrices, the no-impersonation structural
check, and wiring-content checks confirming the roster query excludes
ADMIN and filters by an exact `workDate`), `daily-work-management-presentation.test.ts`
(6 — state labels, sort ordering, default-selection logic),
`journees-agents-authorization.test.ts` (6 — coarse gate, redirect
targets, server-derived actor, business-date usage, and the
no-impersonation content check), plus one addition to
`authorization.service.test.ts` for `DAILY_WORK_MANAGEMENT_ROLES`.

### Visual QA — explicitly not performed live, by the user's own choice

Unlike 27F, a legitimate credential path existed this time
(`BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD` in `.env` — pre-existing, real ADMIN
access, which can reach this route). Offered a strictly read-only login
pass (view/screenshot only, no confirm/assign/cancel clicks against real
data), the user chose to skip it. **§81's mandatory mobile/tablet/desktop
visual QA was therefore not performed in a real browser.** What was done
instead: every visual token (color, radius, spacing, dialog pattern,
icon) was reused directly from 27F's already-established, previously
committed vocabulary rather than invented; every stated layout
requirement (master/detail split, mobile stacking via a single grid with
no client state, empty roster/task states, the state-priority ordering,
long content wrapping via the same `break-words` treatment 27F already
uses) was implemented and traced by hand; and `npm run build` confirms
the page compiles and statically resolves with no Next.js/React errors.
Also worth noting: the live `Workday`/`DailyTask` tables are very likely
still empty at time of writing (no employee has used `/ma-journee` since
it shipped this session), so even a login pass would have shown mainly
the empty-roster/`NOT_STARTED` state, not the richer confirmed/ended/
cancelled states — a genuinely thorough visual pass will need seeded
dev/test fixtures regardless of credential availability. This gap is
carried forward from 27F rather than resolved, and is worth closing
before real employees rely on this page.

## Domain semantics — confirmed unchanged

No 27C/27E rule was touched: confirmation authority, assignment
authority, cancellation authority, and every lifecycle transition are
exactly as 27C/27E shipped them. `git diff --stat prisma/` confirms no
schema or migration touched this session.

## Explicit non-goals honored

No navigation/dashboard integration (27H), no date picker/history/
weekly view, no Manager hierarchy, no employee-action impersonation, no
future-task planning UI, no task editing/reassignment/carry-forward, no
notifications, no DailyReport/ProspectAction/Finance coupling, no
Performance language, no tenantization.
