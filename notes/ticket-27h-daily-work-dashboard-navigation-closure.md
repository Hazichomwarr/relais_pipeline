# Ticket 27H — Daily Work Dashboard, Navigation & Phase Closure

Implemented 2026-09-01. Closes Phase 27 — Daily Work / Ma journée. No
schema change, no domain-rule change: this ticket wires the already-frozen
27B–27G domain and UI work into every role's real navigation and
dashboard, fixes the long-standing Sidebar baseline test failure, and
formally declares the phase frozen for V1.

## Navigation integration

"Ma journée" and "Journées des agents" were added as permanent nav
entries, not just direct-URL-reachable pages, matching every other
route in this codebase.

| Surface | Ma journée | Journées des agents |
|---|---|---|
| `Sidebar.tsx` (desktop, ADMIN/MANAGER/ASSISTANT shell) | `role !== "ADMIN"`, right after Tableau de bord | `role === "ADMIN" \|\| role === "MANAGER"`, right after Actions |
| `AdminMobileHeader.tsx` (mobile drawer, same roles) | same gate, same position | same gate, same position |
| `commercialNavItems.tsx` (desktop + mobile, COMMERCIAL — one shared array) | unconditional (COMMERCIAL is always Workday-eligible), right after Tableau de bord | not applicable — COMMERCIAL has no management authority |

Placement follows the ticket's own ordering: Ma journée sits beside
Tableau de bord as a high-frequency personal action; Journées des
agents sits beside the other operational-management surfaces (Actions),
not beside self-service items. `resolveCommercialActiveItem` gained a
`"maJournee"` case so `/ma-journee` highlights correctly from the
Commercial shell exactly like every other Commercial route.

ADMIN never receives a personal "Ma journée" link on any surface — ADMIN
has no personal Workday at all (27A §4), so there is nothing to link to,
not even a disabled placeholder.

## Dashboard integration

A new shared, stateless component, `DailyWorkEntryCard`
(`component/daily-work/DailyWorkEntryCard.tsx`), is the single
implementation reused across all four dashboard placements — deliberately
static (icon/title/description/href/CTA props only, no Workday query of
its own), so the dashboard never grows a second read architecture for
the same live state that already lives on the destination route.

- **Commercial** (`app/dashboard/commercial/page.tsx`): one unconditional
  card, between the header and the KPI cards.
- **Admin/Manager** (`app/admin/page.tsx`): a `MANAGER`-gated "Ma
  journée" card (Manager has a personal Workday) plus an unconditional
  "Journées des agents" card, both inside the existing ADMIN/MANAGER
  dashboard branch, before `KpiCards`.
- **Assistant** (`app/admin/page.tsx`, `ASSISTANT_SHORTCUTS`): a new
  first entry pointing at `/ma-journee` — no separate "Tâches du jour"
  shortcut, since Assistant has no DailyTask workflow (27A).

No new dashboard KPI (attendance rate, lateness, completion percentage)
was introduced anywhere — confirmed by a dedicated regression test, not
just by inspection, since a KPI here would silently reintroduce the
surveillance framing 27A explicitly rejected.

## Sidebar baseline test fix

The pre-existing `Sidebar.test.tsx` failure predates this phase.
Root-caused via `git log -S` to commit `5f5b567` ("Navbars UI refactor"),
which silently renamed the desktop label from "Rapports quotidiens" to
"Suivi des rapports" without updating the test or the mobile header
(confirmed against the original Ticket 19C commit, which established
"Rapports quotidiens" as canonical). Fixed by restoring the label in
`Sidebar.tsx` — the implementation had drifted, not the test. The Sidebar
suite is now 32/32 (27 pre-existing/fixed + 5 new Ticket 27H tests), and
the full suite is genuinely green for the first time in this phase.

## New test coverage added in 27H

- `app/admin/daily-work-dashboard-integration.test.ts` — Manager/Admin
  dashboard card gating, exactly-once placement, no attendance KPI.
- `app/dashboard/commercial/daily-work-dashboard-integration.test.ts` —
  Commercial dashboard card placement and ordering.
- `src/services/daily-work-workflow-regression.test.ts` — two end-to-end
  workflows composed at the service-core/fixture level (no production
  write): (1) assign → visible before start → start → confirm → complete
  → end → visible in management, verifying every fact server-declared
  and none inferred; (2) assign → cancel by an authority other than the
  original assignor → `assignedByUserId` is never rewritten to the
  canceller, preserving the historical fact of who actually assigned the
  task.
- 5 new tests added to `Sidebar.test.tsx`, 2 to `AdminMobileHeader.test.ts`,
  2 to `CommercialSidebar.test.tsx` for the new nav entries and active-item
  highlighting.

Route-level authorization for `/ma-journee` and `/admin/journees-agents`
(the full ADMIN/MANAGER/COMMERCIAL/ASSISTANT matrix) was re-confirmed as
still exhaustively covered by the existing 27C/27E/27F/27G tests
(`authorization.service.test.ts`'s `WORKDAY_ELIGIBLE_ROLES`/
`DAILY_WORK_MANAGEMENT_ROLES` matrices, plus the two route-authorization
test files) — no gap found, no new route-authorization test needed.

## Non-coupling regression (§39-42)

Grepped every Daily Work service/action/component file for Performance,
DailyReport, ProspectAction, and OrganizationMembership/tenant coupling:

- **Performance**: only explanatory comments citing
  `commercial-performance-target.service-core.ts` as a design precedent
  (matching role-list shape) — no import, no data coupling.
- **DailyReport**: `formatDailyReportTime` (a generic
  `Intl.DateTimeFormat` time-of-day formatter with no DailyReport-specific
  semantics) is reused as a plain utility by several Daily Work
  components — not a coupling to DailyReport's domain, data, or workflow.
- **ProspectAction**: no reference anywhere in the Daily Work domain.
- **OrganizationMembership / tenant**: no reference anywhere in the
  Daily Work domain.

Confirmed separately that no component under `component/daily-work/`
performs a direct Prisma write, and that Workday/DailyTask timestamp
fields (`startedAt`, `endedAt`, `confirmedAt`, `completedAt`,
`assignedAt`, `cancellationReason`) are only ever assigned inside their
own domain's `*.service-core.ts` files — presentation work never touches
historical fact.

## Accessibility & copy

All three hand-rolled dialogs (`EndWorkdayDialog`,
`AssignDailyTaskDialog`, `CancelDailyTaskDialog`) carry `role="dialog"`,
`aria-modal`, a focus trap, Escape-to-close, and body-scroll lock,
matching the `PersonalNoteDeleteButton` precedent established earlier in
this codebase. Nav icons pair with visible text labels and follow the
same (pre-existing, codebase-wide) convention of no `aria-hidden` on
paired icons — not a 27H regression, and not changed here.

Grepped for surveillance/attendance-terminology drift ("pointage",
"surveillance", "présent/absent", "retard", "géolocalisation",
"horodatage") across every Daily Work file — none found. The domain's
declaration-not-surveillance framing (27A) held through implementation.

## Visual acceptance pass — actual scope achieved

The ticket calls this pass mandatory. Two different constraints applied,
and they are distinct:

1. **Credentials**: per this repo's standing security rule, an
   authenticated live session cannot be created by mutating a real
   account's role or password hash, and no dedicated test identity was
   provisioned as its own task. The user was offered live-QA options
   twice before (27F, 27G) and declined both times.
2. **Tooling**: independent of (1), this session has no browser,
   screenshot, or rendering tool of any kind available — so even a
   properly-provisioned test credential could not have produced a
   rendered visual pass here.

Given (2), what was actually performed is a **structural code-level
review**, not a rendered/pixel pass: every component under
`component/daily-work/` and `component/daily-work/management/` (16
files) was read and checked for text-overflow risk on long content,
responsive-breakpoint coherence at 375/768/1280px reasoned from the
Tailwind classes themselves, empty-state render paths, long-name/
long-content wrapping in row layouts, dialog usability at 375px, design-
token consistency (navy/blue/emerald/amber/slate, never red for a
non-alarming state), and icon-only-control labeling.

**Findings and any resulting fixes are listed below** — this section
records only what was actually verified in code, not a claim of visual
confirmation in a real browser at any breakpoint.

All 16 files under `component/daily-work/` and
`component/daily-work/management/` were reviewed. Two minor, real
findings, both fixed:

1. **`CancelDailyTaskDialog.tsx`** — the description paragraph
   interpolating `taskContent` lacked `break-words`, unlike its sibling
   components (`DailyTaskItem`, `ManagementTaskItem`), which already
   guard task content against long unbroken strings (e.g. a URL). A long
   no-space token could have overflowed the `max-w-md` dialog at 375px.
   Fixed: added `break-words`.
2. **All three dialogs** (`EndWorkdayDialog`, `AssignDailyTaskDialog`,
   `CancelDailyTaskDialog`) stack their two action buttons with
   `flex-col-reverse` on mobile but never constrained button width, so
   the stacked pair rendered as two differently-sized pills sized to
   their own text rather than a clean full-width stack. Fixed: added
   `w-full sm:w-auto` to every dialog action button.

Everything else reviewed clean: text-overflow handling elsewhere
(`break-words` + `min-w-0 flex-1` in task rows, `truncate` inside
`min-w-0` for agent names — a deliberate single-line-ellipsis choice, not
a bug); responsive breakpoint coherence (no fixed-px widths risk overflow
at 375px, padding scales progressively); real empty-state renders for
both `DailyTaskList` and `DailyWorkAgentList` (icon + copy, never a blank
div); dialog sizing at 375px (`max-w-md` + `p-6` fits within the `px-4`
outer gutter); design-token consistency (the only red usage —
`CancelDailyTaskDialog`'s destructive action — is the one case red is
the correct color per the established convention); and every icon-only
control (`DailyTaskCompletionToggle`) already carries both `aria-label`
and `title`.

## Verification

- `npx prisma validate` — schema valid.
- `npx prisma migrate status` — database up to date, 21 migrations, no
  pending schema work (confirms this ticket made no schema change).
- `npx prisma generate` — clean.
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (0 errors, 0 warnings after removing one unused
  test import).
- `npm test` — **2389/2389 passing**, 0 failures — the first genuinely
  green full run in this phase, now that the Sidebar baseline is fixed.
- `npm run build` — succeeds; `/ma-journee` and `/admin/journees-agents`
  both present in the route manifest as dynamic (`ƒ`) routes.
- `git diff --check` — no whitespace errors.

No production data was read, written, or queried at any point in this
ticket. No migration was created or deployed.

## Known V1 limitations (unchanged from 27A, carried forward as-is)

No absence model, no holiday model, no correction workflow, no
`cancelledAt`/`cancelledByUserId` on DailyTask, no edit history, no
task reassignment, no carry-forward of incomplete tasks to the next
day, no Manager-to-Manager hierarchy, no attendance analytics, no
lateness policy or scoring, no automatic Performance integration, no
DailyReport coupling, no ProspectAction coupling. None of these were
introduced accidentally by 27H's navigation/dashboard work — confirmed
above.

## Phase declaration

**Phase 27 — Daily Work / Ma journée is frozen for V1.** 26B through 27H
are complete, tested, navigable from every role's real UI, and free of
the couplings this domain was explicitly designed to avoid. Any future
work on absence tracking, correction workflows, task reassignment, or
attendance analytics is a new phase, not an extension of this one.
