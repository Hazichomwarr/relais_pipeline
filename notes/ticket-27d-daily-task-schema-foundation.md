# Ticket 27D — DailyTask Schema Foundation

Implemented 2026-09-01. Adds `DailyTaskStatus` and `DailyTask` only. No
service layer, no server actions, no routes, no UI, no capability
constants, no coupling to `Workday`. `notes/ticket-27a-ma-journee-taches-du-jour-domain-audit.md`
is authoritative for every decision below — this document records the
implementation.

## Final schema

```prisma
enum DailyTaskStatus {
  OPEN
  COMPLETED
  CANCELLED
}

model DailyTask {
  id String @id @default(cuid())

  workDate DateTime

  assignedToUserId String
  assignedTo       User   @relation("DailyTasksAssignedTo", fields: [assignedToUserId], references: [id], onDelete: Restrict)

  assignedByUserId String
  assignedBy       User   @relation("DailyTasksAssignedBy", fields: [assignedByUserId], references: [id], onDelete: Restrict)

  content String

  assignedAt DateTime

  status DailyTaskStatus @default(OPEN)

  completedAt        DateTime?
  cancellationReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([assignedToUserId, workDate])
  @@index([workDate])
  @@index([assignedByUserId])
}
```

Plus, on `User`:

```prisma
dailyTasksAssignedTo DailyTask[] @relation("DailyTasksAssignedTo")
dailyTasksAssignedBy DailyTask[] @relation("DailyTasksAssignedBy")
```

## Migration

`prisma/migrations/20260901220000_add_daily_task_foundation/migration.sql`
— one `CREATE TYPE`, one `CREATE TABLE`, three `CREATE INDEX` (no
unique index), two `ALTER TABLE ... ADD CONSTRAINT` (both
`ON DELETE RESTRICT`). No existing table or type is touched (confirmed
by test: exactly two `ALTER TABLE` statements in the whole file, both
`"DailyTask"`; zero `ALTER TYPE`). No `INSERT`/`UPDATE`/`DELETE` — this
is a brand-new table, nothing to backfill.

The DDL was hand-written, then verified byte-for-byte against Prisma's
own generated DDL via an offline `prisma migrate diff --from-empty
--to-schema prisma/schema.prisma --script` (no database connection
required — same method used for 26B and 27B).

## Indexes

`[assignedToUserId, workDate]` (my-tasks-for-a-date), `[workDate]`
(all-tasks-for-a-date, the management view), `[assignedByUserId]`
(tasks-assigned-by-actor). No speculative analytics indexes — these are
exactly the three read shapes 27A's audit anticipated and nothing more.

## Why there is no Workday foreign key

Architecture, not omission (27A §7, restated in 27C's own doc): a task
may exist before the employee starts, or even if they never start at
all — assigning one must never fabricate attendance, and `Workday`'s own
"row exists iff started" invariant must never depend on anything this
table does. `DailyTask` and `Workday` share only `employeeUserId`/
`workDate` at the query layer, never a foreign key in either direction.

## Why there is no `organizationId`

Same reasoning as 27B/27C: Phase 26 remains paused, this is a brand-new
domain with no existing rows to reconcile, and adding tenant ownership
now would provide zero current operational value. `Organization`,
`OrganizationMembership`, and membership-role authority are untouched.

## Why role snapshots are absent

Identity alone (`assignedToUserId`/`assignedByUserId`) is sufficient
provenance here — directly reusing `ProspectAction`'s existing
zero-role-snapshot precedent (that model has four independent `User`
relations and no role snapshot on any of them), the same reasoning
already applied to `Workday` in 27C. Authorization is enforced once, at
assignment time; a later role change for either party never invalidates
or reinterprets old task history.

## Why the assignee is immutable by design

No reassignment field exists (`assignedToUserId` cannot be edited by any
future service, by construction of this schema). Moving work from one
person to another is "cancel the original, assign a new one" (27A §47)
— the `CANCELLED` status plus a fresh row already expresses that without
any extra machinery, and it preserves both facts ("this was asked of
Mamadou, then withdrawn" and "this was asked of Yacouba, from this
moment") rather than silently rewriting who was actually asked.

## Why duplicate task content is allowed

No `@@unique` constraint exists on `(assignedToUserId, workDate,
content)`. Two identical-text rows may legitimately represent two
separate management assignments (27A §72's own instruction: do not
build duplicate-task detection).

## Why cancellation is a status, not a deletion

`CANCELLED` is a real enum value, not a hard delete — a completed or
previously-visible task disappearing would distort the day's history.
This is the one place `DailyTask` genuinely needs a persisted enum where
`Workday` needs none: cancellation is a real third outcome that isn't a
pure function of nullable timestamps (a task can be cancelled at any
point regardless of whether it was ever completed first), unlike
`Workday`'s states, which are all fully derivable from
`startedAt`/`confirmedAt`/`endedAt` alone.

**Deliberately does not include** `cancelledAt`/`cancelledByUserId` —
27A's own conceptual model lists only `status` and `cancellationReason`
for this ticket's scope, and this implementation follows that exactly
rather than adding fields "because `ProspectAction` has them." If 27E's
cancellation-authority design reveals that timestamp/actor provenance is
genuinely needed for truthful history, that is 27E's decision to make
and document — not something to add speculatively here.

## Cross-domain safety check (ticket §33)

Confirmed via the migration content test and a full diff review: no
change to `Workday`, `User`'s existing columns (only two new
reverse-relation fields, Prisma-client-only, not schema columns),
`ProspectAction`, `DailyReport`, any Performance model, `LedgerEntry`,
`Organization`, or `OrganizationMembership`. The migration file contains
exactly one `CREATE TYPE` and one `CREATE TABLE`, and touches no other
table or type.

## Verification

```text
npx prisma format / validate     — clean
npx prisma generate              — clean
npx tsc --noEmit                 — clean, zero errors
npx eslint (new files)           — clean
npm test                         — 2217 tests, 2216 pass, 1 fail
                                    (component/dashboard/Sidebar.test.tsx
                                    — the same pre-existing baseline
                                    failure documented in 27B/27C,
                                    confirmed present on main before any
                                    of this work; not touched here)
npm run build                    — clean
git diff --check                 — clean
```

11 new migration-content tests cover: additive-only DDL, the enum's
exact three values, both `Restrict` foreign keys, every required/
nullable field, absence of a unique constraint, absence of every
prohibited relation/field (Workday, `organizationId`, Prospect,
DailyReport, Performance, role snapshots, reassignment/cancellation-
provenance beyond `cancellationReason`, and every rejected feature-creep
field from 27A §11), the exact field set with nothing extra, the two new
`User` reverse relations, and the three supporting indexes.

## Deployment

`npx prisma migrate deploy` applied against the live database.
`prisma migrate status` confirmed the migration was pending immediately
before deploy and applied cleanly.

## Post-deploy read-only verification

```text
DailyTask table exists:           yes
DailyTask row count:               0 (expected — no runtime path
                                    creates one yet)
DailyTaskStatus enum exists:       yes, with OPEN/COMPLETED/CANCELLED
Both User foreign keys present:    DailyTask_assignedToUserId_fkey,
                                    DailyTask_assignedByUserId_fkey,
                                    both ON DELETE RESTRICT
All three indexes present:         DailyTask_assignedToUserId_workDate_idx,
                                    DailyTask_workDate_idx,
                                    DailyTask_assignedByUserId_idx
Migration status:                  current, no pending migrations
```

No production data was created, mutated, or read beyond these read-only
structural checks — no fake DailyTask row was created for verification.

## What remains true after 27D

The database now knows what a `DailyTask` *is*, and that it is
structurally independent of `Workday`. There is still no application
code capable of creating, assigning, completing, or cancelling one — no
`TASK_ASSIGNMENT_ROLES`/`DAILY_TASK_RECIPIENT_ROLES`, no
`canAssignTask()`, no `assignTask()`/`completeMyTask()`/
`uncompleteMyTask()`/`cancelTask()`, no server action, no route, no UI.
That is 27E's work, exactly as 27A recommended.
