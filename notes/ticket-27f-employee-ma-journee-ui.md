# Ticket 27F — Employee "Ma journée" UI

Implemented 2026-09-01. Builds `/ma-journee`, the employee-facing
Workday + DailyTask experience, on top of the frozen 27C/27E domains. No
schema change, no domain-rule change, no management/navigation
integration (27G/27H).

### Design intent

"Ma journée" is designed as a calm personal workspace rather than an
attendance-monitoring dashboard. Workday state receives the strongest
hierarchy (one hero card, one visual system, state-specific content);
DailyTasks remain a lightweight operational checklist beneath it. The
whole page follows a single vertical sequence — my day, then my work —
rather than a multi-column dashboard, matching the ticket's own framing
of this as a sequential workflow, not a KPI surface.

## Route

`/ma-journee`, gated by `requireWorkdayEligibility()`
(`WORKDAY_ELIGIBLE_ROLES` — MANAGER, COMMERCIAL, ASSISTANT; 27C).
Unauthenticated visitors redirect to `/login`; ADMIN — the only role
this gate can deny — redirects to `/admin`. Both `layout.tsx` and
`page.tsx` independently call the gate (defense in depth, matching every
other route in this codebase). No permanent nav entry was added (27H's
job); direct navigation is nonetheless properly authorized.

Shell selection mirrors `/notes`/`/profile`'s existing pattern exactly:
COMMERCIAL gets `CommercialShell`, MANAGER/ASSISTANT get `AdminShell`
(with no `activeItem`, since there is no nav entry yet).

## Page composition

```text
app/ma-journee/
  layout.tsx    — auth + shell
  page.tsx      — data fetch + composition
  loading.tsx   — skeleton matching the real layout shape

component/daily-work/
  WorkdayHeroCard.tsx           — server, the primary visual element
  StartWorkdayButton.tsx        — client, calls startMyWorkdayAction
  EndWorkdayDialog.tsx          — client, confirmation dialog + endMyWorkdayAction
  DailyTaskList.tsx             — server, progress + empty state + grouping
  DailyTaskItem.tsx             — server, one row (OPEN/COMPLETED/CANCELLED)
  DailyTaskCompletionToggle.tsx — client, complete/uncomplete actions
  AssistantDailyGuidance.tsx    — server, static role guidance (no DailyTask)

src/lib/daily-work-presentation.ts   — pure display-state/formatting/sorting logic
src/services/daily-work.service.ts   — one read composition (Workday + tasks in parallel)
```

Server components are the default throughout; only the three
mutation-triggering controls (`StartWorkdayButton`,
`EndWorkdayDialog`, `DailyTaskCompletionToggle`) are client components.
No service-core function is ever called directly from a client
component — every mutation goes through the real 27C/27E server actions
(`startMyWorkdayAction`, `endMyWorkdayAction`,
`completeMyDailyTaskAction`, `uncompleteMyDailyTaskAction`).

`getMyDailyWork(actorUserId, workDate)` (`daily-work.service.ts`) is the
one read-composition boundary — it owns no mutation policy and derives
no display state, it only calls `getMyWorkdayForDate`/
`getMyDailyTasksForDate` (27C/27E) in parallel.

## Workday visual states

`resolveWorkdayDisplayState` (`daily-work-presentation.ts`) derives one
of five states purely from the timestamp tuple — mirroring 27A §12.1
exactly, since `Workday` has no persisted status:

| State | Hero content |
|---|---|
| `NOT_STARTED` | "Prêt pour aujourd'hui ?" + Start CTA + expected hours |
| `STARTED_UNCONFIRMED` | "Journée en cours" + start time + soft amber "En attente de confirmation" + End control |
| `STARTED_CONFIRMED` | Same, with a green "Présence confirmée à HH:mm" instead |
| `ENDED_UNCONFIRMED` | Muted "Journée terminée" + start–end range + neutral "Confirmation en attente" — a valid, non-alarming terminal state, never an error banner |
| `ENDED_CONFIRMED` | Same, with the green confirmed badge |

One card, one visual system — every state renders inside the same
`rounded-4xl` shell with the same expected-hours footer, never five
unrelated layouts. Expected hours use the Workday's own stored snapshot
once one exists (`expectedStartTime`/`expectedEndTime`, minutes since
business midnight, formatted via `formatMinutesAsTime`); before Start,
the current `DEFAULT_WORKDAY_EXPECTED_START/END_MINUTES` constants are
shown instead — never recomputed from today's defaults after a Workday
already has its own frozen snapshot.

**No lateness judgment, no duration arithmetic**: `startedAt`/`endedAt`
are shown as plain times only ("Début · 08:07"), never compared to
expected hours, never subtracted from each other. The confirmer's
display name is deliberately not shown — the current read model only
exposes `confirmedByUserId` (an id, not a name), and 27F does not expand
that DTO solely for cosmetic provenance (the ticket's own explicit
instruction, §9) — only the confirmation timestamp is shown.

## Task presentation

`DailyTaskList` groups tasks via `groupDailyTasksForDisplay`: active
(`OPEN`/`COMPLETED`, sorted OPEN-first then ascending `assignedAt`, with
an id tie-break so ordering never reshuffles between renders) and
`CANCELLED` (rendered separately, in a visibly subdued subsection with
its `cancellationReason`, per 27F §45 — since that reason is already
durable historical data on the existing read model, showing it cost
nothing extra). Progress ("`completed` / `total` terminées" + a thin
bar) excludes `CANCELLED` from the denominator (27A §47) — withdrawn
work is not unfinished employee work.

Completion controls (`DailyTaskCompletionToggle`) are interactive only
when `workdayState` is `STARTED_UNCONFIRMED`/`STARTED_CONFIRMED` — a
44px circular touch target, disabled (never hidden) before Start and
after End, with a small contextual hint shown only in the `NOT_STARTED`
case ("Commencez votre journée pour pouvoir terminer vos tâches.") — not
repeated after End, where it would be misleading. Tasks and their final
statuses remain fully visible in every state, including before any
Workday exists at all (27A §11/27F §23) — `DailyTaskList` never queries
or depends on `Workday`'s existence, only on the `workdayState` value
the page already computed once.

Long task content wraps (`break-words`) rather than clipping or pushing
the toggle out of reach. The empty-active-tasks state is a calm,
compact card, not a bordered empty table — explicit that the workday
"remains open to new tasks," not "you have nothing to do" in general
(DailyTask represents only management assignments).

## Assistant variant

`AssistantDailyGuidance` replaces the task list entirely for ASSISTANT
— the static guidance copy 27A froze, rendered as an intentional content
card (icon + text), never styled as an empty/error state, and never
persisted as a `DailyTask` row (27A explicitly rejects that).

## End confirmation

`EndWorkdayDialog` uses the same accessible hand-rolled dialog pattern
already established by `PersonalNoteDeleteButton` (this codebase has no
dialog library) — `role="dialog"`, `aria-modal`, focus trap, Escape to
close, body-scroll lock, focus returns to the cancel button on open. The
message is dynamic: if the employee still has open tasks, it states the
exact count and offers "Continuer ma journée" / "Terminer quand même";
otherwise a simple confirm/cancel. Ending is never blocked by open
tasks — the dialog is informational only (27A §48).

## Error handling

27C/27E's core error results already carry precise, French,
user-presentable `message` strings for every failure branch (e.g.
`ALREADY_STARTED` → "Vous avez déjà démarré votre journée
aujourd'hui.", a lost complete-vs-cancel race → "Cette tâche est déjà
terminée." / "Cette tâche a été annulée."). Every client control in
27F displays `result.message` directly — **no separate code-to-French
translation table was built**, because the domain layer already
produces presentable text; building a second mapping would have
duplicated it. On any failure, the control also calls `router.refresh()`
so the authoritative server state (a concurrently-ended Workday, a
concurrently-cancelled task) is what the employee sees next, never a
stale client guess. No raw code (`CONCURRENTLY_MODIFIED`, `P2025`,
`updateMany count = 0`) is ever shown.

## Accessibility

Semantic `h1`/`h2` headings; every control is a real `<button
type="button">`; task-completion buttons carry descriptive
`aria-label`/`title` ("Marquer « … » comme terminée" /
"…comme non terminée"), never a generic `aria-label="toggle"`;
`aria-pressed` reflects completion state; disabled state is expressed
via the native `disabled` attribute, not a visual-only style; the end
dialog has `aria-labelledby`/`aria-describedby` and traps focus. No
button strips the native focus outline (`outline-none` is never applied
to a button in this ticket) — matching this codebase's own convention
of reserving custom `focus:ring` treatment for text inputs only, never
buttons.

## Responsive behavior

Content is wrapped in `mx-auto max-w-4xl` inside the shared `Container`
gutters — a comfortable reading width, not the full dashboard width
`Container` itself deliberately leaves unconstrained for data-heavy
pages (matching the documented "a page that wants narrower content
constrains itself" convention). The hero's primary Start CTA is full-width
on small screens and auto-width from `sm:` up; the End control stays a
compact secondary button at every width. No horizontal scrolling is
introduced anywhere; the end dialog fits small viewports via its own
`max-w-md` + scrollable backdrop.

## Visual language

Every color, radius, and spacing value was matched to existing
precedent rather than invented: `#0f2557` primary navy (headings,
primary CTA), `emerald` for confirmed/completed (matching
`DailyReportStatusBadge`'s existing `SUBMITTED` treatment),
soft `amber` for the pending/unconfirmed state (matching that same
badge's `DRAFT` treatment — explicitly not red, per the ticket's own
instruction), `slate` for muted/ended and all secondary text,
`rounded-4xl` for the hero and empty states (matching
`DailyReportEmptyState`/`AssistantDashboardOverview`'s existing shortcut
cards), `rounded-3xl` for the task list container, `rounded-xl` for
buttons. No new palette, no gradient hero, no colored-circle icon
badges, no KPI-card grid — deliberately avoiding every pattern §54
calls out as generic-dashboard aesthetic.

## Verification

```text
npx tsc --noEmit                 — clean, zero errors
npx eslint (new/changed files)   — clean
npm test                         — 2323 tests, 2322 pass, 1 fail
                                    (component/dashboard/Sidebar.test.tsx
                                    — the same pre-existing baseline
                                    failure documented since 27B,
                                    confirmed present on main before any
                                    Daily Work code; not touched here)
npm run build                    — clean; /ma-journee appears in the
                                    route list as a dynamic route
git diff --check                 — clean
git diff --stat prisma/          — empty; no schema/migration change
```

22 new tests: `daily-work-presentation.test.ts` (14 — display-state
derivation for all five states, time/date formatting, sort stability,
progress-denominator exclusion of `CANCELLED`), `ma-journee-authorization.test.ts`
(8 — coarse gate, redirect targets, shell selection, server-derived
identity, business-date usage, the Assistant/task-list branch, and
absence of any management-action reference on this page).

### Visual QA — explicitly not performed live, by the user's own choice

`/ma-journee` is reachable only by MANAGER/COMMERCIAL/ASSISTANT. This
session had no authorized non-admin test credential, and per this
repo's own security rule, fabricating one or promoting/mutating a real
account's role or password to obtain one is exactly the shortcut that
rule forbids. Presented with the choice, the user opted to skip a live
authenticated browser pass entirely rather than provision a credential
or accept a temporary unauthenticated preview route. **§53/§59's
mandatory mobile/tablet/desktop visual QA was therefore not performed
in a real browser.** What was done instead: every visual value (color,
radius, spacing, icon) was matched line-for-line against existing
shipped precedent rather than invented (cited throughout this document
and in code comments); every stated design requirement (long-content
wrapping, four-plus-task layout, empty state, pending state, all five
Workday states, the Assistant variant) was implemented and traced
through the code by hand; and `npm run build` confirms the page compiles
and statically resolves with no Next.js/React errors. This is a real
gap against the ticket's own closing design bar, honestly disclosed
rather than claimed as done — a live visual pass is recommended before
or shortly after this ships to real users, once a safe way to view the
page as an eligible employee exists.

## Domain semantics — confirmed unchanged

No 27C/27E rule was touched to make the UI simpler: ADMIN still has no
personal Workday, ASSISTANT still receives no `DailyTask`, MANAGER still
cannot self-assign (irrelevant here — assignment isn't on this page at
all, per §57/§62 non-goals), completion still requires an open Workday,
uncompletion still freezes after End, and open tasks still never block
ending. `git diff --stat prisma/` confirms no schema or migration
touched this session.

## Explicit non-goals honored

No `/admin/journees-agents`, no manager assignment/confirmation UI
(27G), no employee history/weekly calendar/future task browser, no
attendance analytics/lateness/worked-hours metrics/performance scoring,
no task editing/reassignment/carry-forward, no notifications, no
navigation/dashboard integration (27H), no tenantization.
