# Ticket 27E — DailyTask Lifecycle & Authority

Implemented 2026-09-01. Makes `DailyTask` operational: `assignTask()`,
`completeMyTask()`, `uncompleteMyTask()`, `cancelTask()`, the capability
constants, and the fine-grained assignment/cancellation matrices. No
schema change (27D already encoded the domain), no UI.
`notes/ticket-27a-ma-journee-taches-du-jour-domain-audit.md` is
authoritative for every decision 27A already made; this document also
freezes the one policy 27A left open (cancellation authority) and
records the implementation.

## Cancellation authority — the one open policy question, now frozen

```text
ADMIN   -> may cancel any OPEN DailyTask
MANAGER -> may cancel an OPEN DailyTask only if that Manager originally
           assigned it (actorUserId === assignedByUserId)
COMMERCIAL / ASSISTANT -> can never cancel
```

`canCancelTask({actorRole, actorUserId, assignedByUserId})`
(`daily-task.service-core.ts`). This is an **authority override at
cancellation time**, never a rewrite of history: `assignedByUserId` is
never touched by cancellation — an ADMIN cancelling a Manager-created
task does not become its assignor. Preserves two things simultaneously:
a Manager cannot interfere with another Manager's instructions merely
because Manager authority is organization-wide elsewhere in this domain,
while ADMIN retains organizational override authority when an
assignment needs withdrawing and its Manager is unavailable.

### Known V1 historical limitation — documented, not silently fixed

27D's schema intentionally contains no `cancelledAt`/`cancelledByUserId`
— 27A's own conceptual model listed only `status` and
`cancellationReason` for this domain. **This implementation does not add
them.** V1 history therefore preserves *who assigned* a task, *what* was
assigned, *that* it was cancelled, and *why* — but not *who* performed
the cancellation or *exactly when*. `updatedAt` is persistence metadata
and must never be used to reconstruct either fact — it can change for
reasons unrelated to cancellation. If this provenance later becomes
operationally important, it needs its own additive schema ticket, not a
retrofit here. No implementation difficulty this session made those
fields "necessary for correctness" — cancellation authority is fully
enforceable without them (the guard is `status: "OPEN"`, not an actor
check), so the stop condition in §75(2) was never triggered.

## Lifecycle

```text
        complete
   OPEN ───────────→ COMPLETED
    ↑                    │
    └──── uncomplete ─────┘
    │
    │ cancel
    ▼
 CANCELLED (terminal)
```

Unlike Workday, `DailyTaskStatus` is a real persisted enum (27D's own
reasoning: cancellation is a genuine third outcome, not derivable from
timestamps alone). Completion is deliberately reversible while the
employee's workday remains open — the key difference from
`ProspectAction`, which is immutable once terminal.

## Capability constants

`authorization.service-core.ts`:

```ts
DAILY_TASK_RECIPIENT_ROLES: UserRole[] = ["MANAGER", "COMMERCIAL"]
TASK_ASSIGNMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"]
```

Coarse gates only, via `requireDailyTaskRecipientAccess()` /
`requireTaskAssignmentAccess()`. Following the established
`commercial-performance-target.service-core.ts` precedent (already used
for Workday in 27C), `daily-task.service-core.ts` does not import these
— it defines its own independent local role sets that must agree by
design, not by shared code.

## Assignment matrix

`canAssignTask(actorRole, subjectRole, isSelf)`:

```text
ADMIN   -> MANAGER, COMMERCIAL       : true
ADMIN   -> ASSISTANT, ADMIN          : false
MANAGER -> COMMERCIAL                : true
MANAGER -> MANAGER, ASSISTANT, ADMIN, or self : false
COMMERCIAL / ASSISTANT -> anyone     : false
```

No Manager→Commercial team relation exists anywhere in this codebase
(unchanged from 27A/27C's own finding) — organization-wide authority for
V1, a documented limitation, not an oversight.

## `assignTask` semantics

`assignTaskCore` (`daily-task.service-core.ts`), in order:

1. Fresh actor `{role, active}` from the database (never session/JWT) —
   `INACTIVE_USER` / coarse-gate `NOT_AUTHORIZED`.
2. Date check: `input.workDate < today` → `PAST_DATE_NOT_ALLOWED`. Today
   and every future date are allowed.
3. Fresh subject resolution — missing, inactive, or role outside
   `DAILY_TASK_RECIPIENT_ROLES` all collapse to `RECIPIENT_NOT_ELIGIBLE`
   (mirrors `EMPLOYEE_NOT_FOUND`'s established collapsing precedent).
4. The real matrix (`canAssignTask`) — `NOT_AUTHORIZED` if false.
5. **Only when `workDate` equals today**: look up the recipient's
   Workday; if it exists and `endedAt !== null`, deny with
   `WORKDAY_ALREADY_ENDED`. A **future** date never triggers this lookup
   at all — assigning tomorrow's work is unaffected by today's Workday
   state, exactly as 27A's design intends. A **missing** Workday for
   today is not a blocker either — assignment never requires one to
   exist.
6. Create: `assignedByUserId = actor.id`, `assignedAt = now`,
   `status = OPEN`, `completedAt = null`, `cancellationReason = null`.
   No uniqueness check runs first — duplicate identical assignments are
   ordinary, legitimate rows (27A §21/§72).

No `reassignTask`/`changeAssignee`/`editTask` exists anywhere —
`assignedToUserId`, `assignedByUserId`, `assignedAt`, `workDate`, and
`content` are all immutable after creation in this ticket. Verified by a
test asserting these export names are absent from the core module.

## `completeMyTask` / `uncompleteMyTask` semantics

Both require, in order: fresh actor active + eligible-role check,
`findTask` (`TASK_NOT_FOUND`), **ownership**
(`task.assignedToUserId === actor.id` → `NOT_TASK_OWNER`, checked before
any task-state branch is even reported — the primary IDOR boundary, per
27A §25/§41), a status guard (completion requires `OPEN`; uncompletion
requires `COMPLETED`; `CANCELLED` is denied for both), then the **same**
Workday boundary check:

```text
task.workDate !== today          -> TASK_NOT_FOR_TODAY
no Workday for (actor.id, today) -> WORKDAY_NOT_STARTED (completion only)
Workday.endedAt !== null         -> WORKDAY_ALREADY_ENDED
```

Completion is stricter than assignment here — it requires an *existing,
open* Workday, not merely "not yet ended." This does not couple the
schemas: it's a lifecycle query run at mutation time against
`employeeUserId + workDate`, never a stored relationship (27A §30).
Re-completion after an explicit uncompletion records a fresh
`completedAt` — no intermediate checkbox history is preserved, matching
27A's own accepted V1 simplicity.

## `cancelTask` semantics

`cancelTaskCore`, in order: fresh actor active + coarse-gate check,
non-empty (trimmed) `cancellationReason` → `INVALID_CANCELLATION_REASON`,
`findTask` (`TASK_NOT_FOUND`), the fine authority matrix
(`canCancelTask` → `CANCELLATION_NOT_ALLOWED` — checked **before** any
task-state detail is revealed, so an unauthorized actor learns nothing
about the task's current status), then status
(`COMPLETED` → `TASK_ALREADY_COMPLETED`, already `CANCELLED` →
`TASK_CANCELLED`, stable/no mutation), then the date/Workday boundary —
identical shape to assignment's own boundary check, using the **task's**
`assignedToUserId` (never the cancelling actor's id): past dates denied
(`PAST_DATE_NOT_ALLOWED`), today's task denied once that employee's
Workday has ended (`WORKDAY_ALREADY_ENDED`), future tasks unaffected by
any Workday state.

Cancellation never deletes the row and never touches
`assignedByUserId`/`assignedToUserId` — the guarded write only ever sets
`status` and `cancellationReason`.

## Concurrency

Every mutation ends in one atomic guarded `updateMany`
(`where: {id, ..., status: <required-prior-state>}`), the same proven
shape used throughout this codebase. When the guard fails
(`count === 0`), completion and cancellation both re-fetch the task and
report the *precise* winning outcome (`TASK_ALREADY_COMPLETED` vs.
`TASK_CANCELLED`) via a small shared `resolveLostRaceCode` helper — this
is what makes the complete-vs-cancel race (27A §45) resolve to an
accurate message instead of a generic conflict code. Exactly one
terminal transition ever wins; the loser's guard simply never matches.

## IDOR protections

- `completeMyDailyTaskAction`/`uncompleteMyDailyTaskAction` accept only
  a `taskId` — actor identity always comes from
  `authorization.user.id`, never client input; ownership is
  independently re-verified inside the service against the real row.
- `assignDailyTaskAction`/`cancelDailyTaskAction` are inherently
  other-person actions, so the subject (`assignedToUserId` /
  `taskId`+`cancellationReason`) is explicit input — but authority is
  independently re-evaluated server-side against the real, freshly
  resolved subject/task, never trusted from the coarse route gate alone.
- Explicit test coverage: cross-user completion attempts, cross-Manager
  cancellation attempts, Assistant attempting any mutation by id, and
  "Admin's cancellation authority does not imply completion authority
  over the same task" — management authority and employee declaration
  authority remain structurally distinct capabilities.

## Non-interference

`daily-task.service-core.ts` and `daily-task.service.ts` import nothing
from `workday.service*`, any Performance-domain file,
`organization-bootstrap.service*`/`OrganizationMembership`,
`prospect-action`/`prospect.service`, or `daily-report*` — verified by a
content test scanning each file's `import` lines. The wiring layer's
only touch on `Workday` is a single `prisma.workday.findUnique` read of
`endedAt` — verified by a test asserting no `workday.create`/`update`/
`delete` call exists anywhere in the file, and no `startedAt`/
`confirmedAt` field is ever written. `User.role` remains the only
authority consulted; `OrganizationMembership.role` is never read.

## Historical questions (ticket §72)

**What historical information must this feature preserve?**

```text
original task wording (content)
original intended business date (workDate)
original assignee (assignedToUserId)
original assignor (assignedByUserId)
original assignment time (assignedAt)
current durable lifecycle outcome (status)
current completion timestamp when completed (completedAt)
cancellation reason when cancelled (cancellationReason)
```

**Must never be silently rewritten**: `assignedToUserId`,
`assignedByUserId`, `assignedAt`, `workDate` — no code path in this
ticket's implementation touches any of the four; every guarded write's
`data` clause is limited to exactly the fields the mutation is meant to
change (`status`/`completedAt` for complete/uncomplete,
`status`/`cancellationReason` for cancel).

## Active-user handling

Every mutation re-resolves `active` fresh from the database for the
actor (and, for assignment, the recipient) — an inactive person can
receive no new task, complete/uncomplete nothing, and assign/cancel
nothing. Existing `DailyTask` history is never mutated or hidden by a
later deactivation.

## No automatic carry-forward, no Workday mutation

An unfinished/OPEN task at a business-date transition simply stays an
OPEN task for its original `workDate` — nothing in this ticket mutates
`workDate` or clones a row forward. No `DailyTask` operation creates,
starts, ends, or confirms a `Workday` — confirmed by the same content
test cited above.

## Files touched

```text
src/services/authorization.service-core.ts   (+2 constants)
src/services/authorization.service.ts        (+2 wrappers)
src/lib/validations/daily-task.schema.ts     (new)
src/services/daily-task.service-core.ts      (new)
src/services/daily-task.service.ts           (new)
src/actions/daily-task.actions.ts            (new)
prisma/schema.prisma                         (untouched)
prisma/migrations/*                          (untouched — no new migration)
```

## Verification

```text
npx tsc --noEmit                 — clean, zero errors
npx eslint (new/changed files)   — clean
npm test                         — 2301 tests, 2300 pass, 1 fail
                                    (component/dashboard/Sidebar.test.tsx
                                    — the same pre-existing baseline
                                    failure documented in 27B/27C/27D,
                                    confirmed present on main before any
                                    Daily Work code; not touched here)
npm run build                    — clean
git diff --check                 — clean
git diff --stat prisma/          — empty; no schema/migration change
```

New test files: `authorization.service.test.ts` (+2 tests for the new
constants), `daily-task.service-core.test.ts` (77 tests — full
assignment/completion/uncompletion/cancellation matrices, every date and
Workday-boundary rule, concurrency including the complete-vs-cancel
race, IDOR, historical role-change regression, and non-interference),
`daily-task.actions.test.ts` (5 content tests, matching the established
pattern for "use server" files).

No schema change, no migration, no production DailyTask created for
verification — all coverage is unit-level against fake in-memory stores.

## Explicit non-goals honored

No task UI, no `/ma-journee`, no `/admin/journees-agents`, no dashboard
cards, no navigation, no task editing, no reassignment, no automatic
carry-forward, no recurring tasks/priorities/comments/attachments/
notifications, no Workday schema or lifecycle changes, no
ProspectAction/DailyReport coupling, no Performance scoring, no
`organizationId`/`OrganizationMembership` authority.

Both backend halves of Daily Work are now operational. 27F can build the
employee-facing "Ma journée" experience over stable, tested Workday and
DailyTask semantics without either domain needing to change.
