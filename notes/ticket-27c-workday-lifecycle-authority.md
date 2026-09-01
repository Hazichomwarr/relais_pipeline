# Ticket 27C — Workday Lifecycle & Authority

Implemented 2026-09-01. Makes `Workday` operational: `startMyWorkday()`,
`endMyWorkday()`, `confirmWorkdayStartFor()`, the capability constants,
and the fine-grained confirmation matrix. No schema change (27B already
encoded the domain), no UI. `notes/ticket-27a-ma-journee-taches-du-jour-domain-audit.md`
is authoritative for every decision; this document records the
implementation.

## Capability constants

`authorization.service-core.ts`:

```ts
WORKDAY_ELIGIBLE_ROLES: UserRole[] = ["MANAGER", "COMMERCIAL", "ASSISTANT"]
WORKDAY_CONFIRMATION_ROLES: UserRole[] = ["ADMIN", "MANAGER"]
```

Both are coarse route/action gates only, exposed via
`requireWorkdayEligibility()` / `requireWorkdayConfirmationAccess()` in
`authorization.service.ts`. Following the established
`commercial-performance-target.service-core.ts` precedent, the domain
core (`workday.service-core.ts`) does **not** import these — it defines
its own independent local role sets
(`isEligibleForOwnWorkday`/`canAttemptWorkdayConfirmation`) that must
agree with the constants above by design, not by shared code, so either
can diverge later without editing the other. This is a deliberate,
precedented repository convention, not duplication for its own sake.

## Confirmation matrix

`canConfirmWorkdayStart(actorRole, subjectRole, isSelf)`
(`workday.service-core.ts`), the exact frozen 27A matrix:

```text
ADMIN   -> MANAGER, COMMERCIAL, ASSISTANT : true
MANAGER -> COMMERCIAL, ASSISTANT          : true
MANAGER -> MANAGER, or self               : false
COMMERCIAL / ASSISTANT -> anyone          : false
self-confirmation, any actor role         : false
```

No Manager→Commercial team relation exists anywhere in this codebase
(reconfirmed by 27A's own grep, unchanged) — this is organization-wide
authority for V1, a documented limitation, not an oversight.

## Start semantics

`startMyWorkday(actorUserId)` (`workday.service.ts`) →
`startMyWorkdayCore` (`workday.service-core.ts`):

1. Resolves a **fresh** `{id, role, active}` from the database — never
   trusts the session/JWT, which carries no `active` flag at all (26A
   finding) and can carry a stale `role`.
2. Rejects `!active` (`INACTIVE_USER`) and non-eligible roles
   (`NOT_ELIGIBLE`, ADMIN included).
3. Derives `workDate = getCurrentWorkDate(now)` — RELAIS business date,
   server time only, reusing `financial-report-period.ts`'s existing
   primitives via a two-line `src/lib/workday-date.ts` (no new timezone
   constant).
4. Checks for an existing row first (`findExisting`); if found, returns
   `ALREADY_STARTED` with the real existing row — no create is attempted.
5. Otherwise creates the row: `startedAt = now` (unclamped, no lateness
   field), `expectedStartTime`/`expectedEndTime` snapshotted from
   `DEFAULT_WORKDAY_EXPECTED_START_MINUTES`/`..._END_MINUTES` (480/1020,
   the one dedicated location for these values).
6. If the create itself loses a genuine concurrent race against the
   `@@unique([employeeUserId, workDate])` constraint, the wiring layer
   catches the Prisma `P2002` error and reports `{outcome: "DUPLICATE"}`
   — no Prisma-specific knowledge leaks into the core. The core then
   re-resolves and returns the winner's real row as `ALREADY_STARTED`.
   No `upsert` is used anywhere — a second Start is never treated as an
   update.

`Workday` creation happens **only** inside this function. No
`createWorkdayForUser`/`ensureTodayWorkday`/`getOrCreateWorkday` exists
anywhere.

## End semantics

`endMyWorkday(actorUserId)` → `endMyWorkdayCore`:

- Employee-self-only: `findCurrent` is always scoped to the acting
  employee's own id, for **today's** business date only — there is no
  way to target another person's workday or an arbitrary historical
  date.
- Requires an existing row (`NOT_STARTED` otherwise) — never creates one.
- `endedAt = now`, server time, unclamped.
- Guarded conditional update
  (`updateMany({where:{id, employeeUserId, endedAt:null}, data:{endedAt}})`),
  the same shape already proven by `ProspectAction`/`LedgerEntry` — first
  successful end wins, `count === 0` ⇒ `ALREADY_ENDED`.
- Confirmation state is never inspected — an unconfirmed day ends
  normally.
- No `DailyTask` query anywhere — that domain doesn't exist yet, and
  27E's unfinished-tasks-don't-block-end rule isn't anticipated here.
- No `endWorkdayFor`/`adminCloseWorkday`/`managerEndWorkday` exists —
  verified by a test asserting these names are absent from the module's
  exports.

## Confirmation semantics

`confirmWorkdayStartFor(actorUserId, {employeeUserId, workDate})` →
`confirmWorkdayStartForCore`:

1. Fresh actor `{role, active}` check (`INACTIVE_USER`).
2. Coarse role gate (`CONFIRMATION_NOT_ALLOWED`).
3. **Date-boundary check, before any other I/O**: only the exact current
   RELAIS business date is confirmable — a target date that is not
   `getCurrentWorkDate(now)`, past or future, is rejected
   (`CONFIRMATION_DATE_NOT_ALLOWED`). This single equality check
   satisfies both "no retrospective confirmation on a later day" and "no
   future-date confirmation" — same-day confirmation after End remains
   valid, because "today" doesn't change just because the employee
   already ended.
4. Resolves the subject fresh (`SUBJECT_NOT_FOUND` collapses missing and
   inactive, mirroring `EMPLOYEE_NOT_FOUND`'s precedent).
5. Evaluates the real matrix (`canConfirmWorkdayStart`) —
   `CONFIRMATION_NOT_ALLOWED` if false.
6. Resolves the target Workday (`WORKDAY_NOT_FOUND` if none — confirming
   before a start declaration is structurally impossible, since no row
   exists to confirm).
7. `ALREADY_CONFIRMED` if already set.
8. Atomic guarded write: `confirmedAt` and `confirmedByUserId` are always
   written together, in the same `updateMany`, guarded on
   `confirmedAt: null` — no code path updates either field
   independently. First successful confirmation wins;
   `count === 0` ⇒ `ALREADY_CONFIRMED`.

`startedAt` is never referenced by any write in this function — there is
no code path capable of rewriting it, verified by a dedicated regression
test.

## Business-date rule

`src/lib/workday-date.ts`: `getCurrentWorkDate`/`resolveWorkDate`, both
two-line delegations to `financial-report-period.ts`'s
`startOfBusinessDay`/`parseIsoDateAsBusinessMidnight`. No new timezone
constant — `BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES` remains the single
centralized source of the RELAIS business timezone.

## Expected-hours constants

`DEFAULT_WORKDAY_EXPECTED_START_MINUTES = 480`,
`DEFAULT_WORKDAY_EXPECTED_END_MINUTES = 1020` — exported once from
`workday.service-core.ts`; nothing else hardcodes 480/1020.

## Concurrency strategy

Every mutation follows the same proven pattern (`ProspectAction`/
`LedgerEntry.reverseAtomically`): a cheap pre-check for a precise error
message, then one atomic guarded write as the actual race-safety net.
Start is the one addition to this codebase's vocabulary — a guarded
**create** (via the database's own `@@unique` constraint, translated to
a `DUPLICATE` outcome by the wiring layer) rather than a guarded
**update**, since there is no existing row to guard an update against
before the first success.

## IDOR protections

- `startMyWorkdayAction()` / `endMyWorkdayAction()` take **zero**
  parameters — actor identity can only come from
  `authorization.user.id`, resolved server-side from the session.
  Verified by a content test on the action source.
- `confirmWorkdayStartAction(values)` takes an explicit
  `{employeeUserId, workDate}` — this is inherently an other-person
  action, so the subject must be named — but the service independently
  re-resolves and re-validates the real subject and the real Workday
  row server-side; the client never supplies `confirmedAt`, an actor
  identity, or a bare `workdayId`.
- None of `startWorkday(userId)` / `endWorkday(workdayId)` /
  `confirmStart(workdayId)` — the shapes 27A's audit called out as
  unsafe — exist anywhere in this codebase; verified by a negative
  content test.

## Weekend behavior

None — no `isWeekend()` check exists. 27A left actual RELAIS weekend
policy unresolved for lack of evidence; per its own recommendation, the
lifecycle behaves identically on every business calendar date.

## Active-user handling

Every mutation re-resolves `active` fresh from the database (never
trusted from session/JWT, which doesn't carry it) and rejects new
actions for an inactive actor or subject. Existing Workday rows are
never mutated or hidden by a later deactivation — only new actions are
gated.

## Historical questions (ticket §63)

**What historical information must this feature preserve?**

```text
the first accepted start declaration and its exact server timestamp
the expected working hours applicable when that Workday was created
the first accepted management confirmation — exact confirmer identity
  and timestamp
the first accepted end declaration and its exact server timestamp
```

**Which later action must never rewrite an earlier fact?**

```text
confirmation must not rewrite startedAt   — no code path touches it;
                                             regression-tested
end must not rewrite startedAt            — same; endAtomically's data
                                             clause only ever sets endedAt
retry must not rewrite start/end/confirm  — every mutation is a guarded
                                             conditional write; the first
                                             success is permanent, every
                                             later attempt returns the
                                             existing state unchanged;
                                             regression-tested for all
                                             three mutations
role changes must not reinterpret old     — no role field exists on
  Workdays                                  Workday at all; eligibility
                                             is checked only at the
                                             moment of a NEW action, never
                                             re-derived when reading an
                                             existing row; regression-
                                             tested (started as
                                             COMMERCIAL, ended as
                                             MANAGER — history unchanged;
                                             and separately, an
                                             ADMIN — now ineligible —
                                             cannot act on an old row,
                                             but the row itself is left
                                             completely untouched by the
                                             rejected attempt)
```

## Non-interference with Performance / OrganizationMembership

Neither `workday.service-core.ts` nor `workday.service.ts` imports
anything from any Performance-domain file or from
`organization-bootstrap.service*`/`OrganizationMembership` — verified by
a content test scanning each file's `import` lines specifically (a
design-precedent comment that merely *names* another file, e.g. citing
`commercial-performance-target.service-core.ts` as the source of an
established pattern, is not treated as a dependency). `User.role`
remains the only authority consulted anywhere in this domain;
`OrganizationMembership.role` is never read.

## Files touched

```text
src/services/authorization.service-core.ts   (+2 constants)
src/services/authorization.service.ts        (+2 wrappers)
src/lib/workday-date.ts                      (new)
src/lib/validations/workday.schema.ts        (new)
src/services/workday.service-core.ts         (new)
src/services/workday.service.ts              (new)
src/actions/workday.actions.ts               (new)
prisma/schema.prisma                         (untouched)
prisma/migrations/*                          (untouched — no new migration)
```

## Verification

```text
npx prisma validate              — clean, no schema drift
npx tsc --noEmit                 — clean, zero errors (also fixed one
                                    latent regex-flag type error in
                                    27B's own migration test file,
                                    caught only once the incremental
                                    tsc cache was cleared — test-file-
                                    only, no behavior change)
npx eslint (new/changed files)   — clean
npm test                         — 2206 tests, 2205 pass, 1 fail
                                    (component/dashboard/Sidebar.test.tsx
                                    — the same pre-existing baseline
                                    failure documented in 27B, confirmed
                                    present on main before any Workday
                                    work; not touched here)
npm run build                    — clean
git diff --check                 — clean
```

New/changed test files: `authorization.service.test.ts` (+2 tests),
`workday.service-core.test.ts` (53 tests — full start/end/confirmation-
matrix/lifecycle/concurrency/role-transition/non-interference coverage),
`workday.actions.test.ts` (5 content tests, matching this repo's
established pattern for "use server" files that can't run directly
under `node:test`).

No schema change, no migration, no production Workday created for
verification — all coverage is unit-level against fake in-memory stores,
per 27A/27C's own recommendation, plus one read-only confirmation this
session that `prisma migrate status` remains unaffected (no pending
migrations).

## Explicit non-goals honored

No `DailyTask`, no `/ma-journee` route, no dashboard card, no
navigation, no absence/leave/holiday handling, no lateness persistence,
no Workday corrections, no Admin/Manager end override, no
DailyReport/ProspectAction coupling, no `organizationId`, no
`OrganizationMembership` authorization, no notifications. `Workday` is
now a fully operational domain; 27D can introduce `DailyTask` without
needing to alter anything built here.
