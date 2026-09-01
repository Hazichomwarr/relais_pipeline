# Ticket 27B — Workday Schema Foundation

Implemented 2026-09-01. Adds the `Workday` model and its migration only.
No service layer, no server actions, no routes, no UI, no capability
constants. `notes/ticket-27a-ma-journee-taches-du-jour-domain-audit.md`
is authoritative for every decision below — this document records the
implementation, it does not re-derive the reasoning.

## Final schema

```prisma
model Workday {
  id String @id @default(cuid())

  employeeUserId String
  employee       User   @relation("EmployeeWorkdays", fields: [employeeUserId], references: [id], onDelete: Restrict)

  workDate DateTime

  expectedStartTime Int
  expectedEndTime   Int

  startedAt DateTime

  confirmedAt       DateTime?
  confirmedByUserId String?
  confirmedBy       User?     @relation("ConfirmedWorkdays", fields: [confirmedByUserId], references: [id], onDelete: Restrict)

  endedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeUserId, workDate])
  @@index([workDate])
  @@index([confirmedByUserId])
}
```

Plus, on `User`:

```prisma
workdays          Workday[] @relation("EmployeeWorkdays")
confirmedWorkdays Workday[] @relation("ConfirmedWorkdays")
```

Two supporting indexes beyond the ticket's minimum field list were
added, not new fields: `@@index([workDate])` (mirrors
`DailyReport.@@index([reportDate])`, anticipating 27A §62's future
date-range/team-day queries) and `@@index([confirmedByUserId])` (mirrors
`UserStatusActivity.@@index([actorUserId])` — every other FK in this
schema that isn't already covered by a compound index gets its own).
`employeeUserId` needs no separate index — it's the leading column of
the compound unique constraint, which Postgres can already use for
single-column lookups.

## Migration

`prisma/migrations/20260901210000_add_workday_foundation/migration.sql`
— one `CREATE TABLE`, three `CREATE INDEX` (one unique), two
`ALTER TABLE ... ADD CONSTRAINT` (both `ON DELETE RESTRICT`). No other
table is touched (confirmed by test: exactly two `ALTER TABLE`
statements in the whole file, both `"Workday"`). No `INSERT`/`UPDATE`/
`DELETE` — no backfill was possible or needed, since the domain doesn't
exist yet and no historically-truthful row could be fabricated for a day
nobody declared.

The DDL was hand-written, then verified byte-for-byte against Prisma's
own generated DDL via an offline `prisma migrate diff --from-empty
--to-schema prisma/schema.prisma --script` (no database connection
required for this comparison — same verification method used for 26B).

## Why `startedAt` is non-null

A `Workday` row exists **if and only if** the employee has declared a
start (27A §2/§7's central invariant). A nullable `startedAt` would
allow a row to exist as a placeholder — created because a task was
assigned, or because a date arrived — which is exactly the "fictional
workday history" 27A rejected. Making it required, with no default,
makes "row exists but nobody started" structurally unrepresentable
rather than merely discouraged by convention. Every future write path
(27C) must therefore create `Workday` and set `startedAt` in the same
operation — there is no "create first, start later" path this schema
permits.

## Why no Workday status enum

Every lifecycle state 27A defined is a pure projection of the timestamp
tuple (`startedAt`/`confirmedAt`/`endedAt`, plus row existence itself for
"not started") — persisting a fourth, derived field would be redundant
state that could drift from the facts it's derived from. This mirrors
`ProspectActionStatus.OVERDUE`'s own precedent in this schema (explicitly
never persisted, always derived) for the states that genuinely are pure
projections; unlike `ProspectAction`'s `status` column itself, Workday
has no third outcome (like `CANCELED`) that isn't already a timestamp —
so unlike `ProspectAction`, Workday needs no enum at all.

## Why expected hours are snapshotted

`expectedStartTime`/`expectedEndTime` (minutes since RELAIS business
midnight — 480/1020 for the current 08:00–17:00 default) are captured at
row creation, not read live from a schedule. If RELAIS's official hours
ever change, this guarantees an old `Workday`'s lateness question is
answered against the hours that actually applied that day, never
silently reinterpreted using tomorrow's schedule. No `Schedule` model is
introduced — these are two plain integers, the smallest storage that
answers 27A §8's historical question.

## Why there is no `DailyTask` relation

27A §7 is explicit and load-bearing: `DailyTask` is independently keyed
by `(assignedToUserId, workDate)`, with **no** foreign key to `Workday`
in either direction. A task assigned for a date before that day's
`Workday` exists (the Sunday-evening-for-Monday example) must not be
blocked or complicated by Workday's own lazy-creation design. This
schema does not prepare or anticipate that relationship in any way.

## Why there is no `organizationId`

Per 27A §21 and the ticket's own instruction: Phase 26 remains paused.
This is a brand-new domain with no existing production rows to
reconcile — adding tenant ownership now would provide zero current
operational value and would reopen exactly the scope this ticket was
told to leave alone. `Organization`, `OrganizationMembership`, and
membership-role authority are untouched by this ticket.

## Cross-domain safety check (ticket §28)

Confirmed via the migration content test and a full `git diff` review:
no change to `User`'s existing columns (only two new reverse-relation
fields, which are Prisma-client-only, not schema columns), no change to
`DailyReport`, `ProspectAction`, any Performance model, `LedgerEntry`,
`Organization`, or `OrganizationMembership`. The migration file itself
contains exactly one `CREATE TABLE` and no statement touching any other
table.

## Verification

```text
npx prisma format / validate     — clean
npx prisma generate              — clean
npx tsc --noEmit                 — clean, zero errors
npx eslint (new files)           — clean
npm test                         — 2146 tests, 2145 pass, 1 fail
                                    (component/dashboard/Sidebar.test.tsx
                                    — pre-existing baseline failure,
                                    confirmed present on main before any
                                    Workday-related change, unrelated to
                                    this ticket; not touched here)
npm run build                    — clean, route list unchanged (no new
                                    route exists yet, as expected)
```

## Deployment

`npx prisma migrate deploy` applied against the live database.
`prisma migrate status` confirmed the migration was pending immediately
before deploy and applied cleanly.

## Post-deploy read-only verification

```text
Workday table exists:            yes
Workday row count:                0 (expected — no runtime path creates
                                   one yet)
Unique constraint present:        Workday_employeeUserId_workDate_key,
                                   confirmed via information_schema
Both User foreign keys present:   Workday_employeeUserId_fkey,
                                   Workday_confirmedByUserId_fkey,
                                   both ON DELETE RESTRICT
Migration status:                 current, no pending migrations
```

No production data was created, mutated, or read beyond these read-only
structural checks — no fake Workday row was created for verification.

## What remains true after 27B

The database now knows what a `Workday` *is*. There is still no
application code capable of creating one — no server action, no service,
no capability constant, no route. `startMyWorkday`/`endMyWorkday`/
`confirmWorkdayStartFor` and the capability constants
(`WORKDAY_ELIGIBLE_ROLES`, `WORKDAY_CONFIRMATION_ROLES`,
`canConfirmWorkdayStart`) remain 27C's work, exactly as 27A recommended.
