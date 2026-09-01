# Ticket 26B — Organization & Membership Foundation

Implemented 2026-09-01. Introduces the minimum durable multi-tenant
identity model — `Organization` and `OrganizationMembership` — and safely
backfills every existing user into the canonical RELAIS tenant. This is
**foundation only**: it does not change runtime authorization behavior,
does not scope any business data to a tenant, and does not introduce any
tenant-switching or organization-administration UI. Follows the audit
findings of `notes/ticket-26a-multitenancy-domain-data-ownership-audit.md`.

## 1. Architecture before 26B

Single-tenant, implicitly. No `Organization` concept anywhere in the
schema, session, or services (confirmed by 26A). `User` mixed global
identity (`firstName`, `lastName`, `email`, `phone`, `passwordHash`) with
organization-specific state (`role`, `active`, `dailyReportTemplateType`).
Authorization (`requireRoleCore` and every named wrapper in
`authorization.service-core.ts`) read `session.user.role`, itself sourced
from `User.role` at login — no tenant resolution step existed or exists.

## 2. `Organization`

```prisma
model Organization {
  id String @id @default(cuid())

  name String
  slug String @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships OrganizationMembership[]
}
```

Deliberately minimal — no billing plan, subscription status, logo,
address, settings JSON, `ownerUserId`, or Stripe IDs. `slug` is globally
unique and is the stable business key application code resolves the
tenant by (never a raw id, since ids differ per environment/database).

## 3. `OrganizationMembership`

```prisma
model OrganizationMembership {
  id String @id @default(cuid())

  organizationId String
  userId         String

  role UserRole

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  user         User         @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([organizationId, userId])
  @@index([organizationId, role])
  @@index([userId])
}
```

- `role` reuses the existing `UserRole` enum (`ADMIN`, `ASSISTANT`,
  `COMMERCIAL`, `MANAGER`) — no second role concept.
- Uniqueness is `[organizationId, userId]`, **not** a global unique on
  `userId` alone. A `User` is a global identity that may structurally
  belong to multiple Organizations; a global unique would have forced one
  organization per user, which is explicitly wrong (ticket §33).
- No membership status (`ACTIVE`/`INVITED`/`SUSPENDED`/`REMOVED`) — mere
  row existence is enough for this foundation ticket.
- Both relations use `onDelete: Restrict`, matching the existing repo
  convention for every other User historical relation
  (`UserStatusActivity`, `UserCreationActivity`, `ProspectAction`'s four
  User relations). Neither `User` nor `Organization` has a deletion flow in
  26B, and a membership row must never be silently orphaned by a future
  deletion feature. Deleting an Organization can never silently delete a
  global User, and vice versa.

`User` gained one new relation field, `organizationMemberships
OrganizationMembership[]` — nothing else on `User` changed.

## 4. RELAIS bootstrap tenant

```text
name: RELAIS
slug: relais
```

`src/lib/organization.ts` exports `RELAIS_ORGANIZATION_SLUG = "relais"` —
the single centralized place the transitional "everyone is RELAIS"
assumption lives, so `where: { slug: "relais" }` is never scattered across
services (ticket §48/§49).

`src/services/organization-bootstrap.service-core.ts` /
`organization-bootstrap.service.ts` expose `resolveRelaisOrganizationId`,
which looks the organization up by slug and **throws loudly** if it is
missing, rather than silently upserting one at runtime. A missing RELAIS
organization after migration is a data-integrity failure, not something to
paper over (ticket §50). It accepts an injectable Prisma-like client so it
can run inside an existing `$transaction` callback or standalone.

## 5. Migration

`prisma/migrations/20260901160000_add_organization_membership_foundation/migration.sql`,
staged per ticket §13:

1. `CREATE TABLE "Organization"`
2. `CREATE TABLE "OrganizationMembership"`
3. Unique/index constraints (`Organization.slug`,
   `OrganizationMembership.[organizationId, userId]`, plus the two
   supporting indexes)
4. Foreign keys, both `ON DELETE RESTRICT`
5. Insert the canonical RELAIS organization, `ON CONFLICT ("slug") DO
   NOTHING`
6. Backfill one membership per existing `User`, role copied verbatim from
   `User.role`, `ON CONFLICT ("organizationId", "userId") DO NOTHING`

Both `INSERT` statements are idempotent against the unique constraints
created earlier in the same file — a retried/replayed deploy cannot
duplicate the RELAIS organization or any membership row, even though
Prisma migrations normally execute exactly once (ticket §12). IDs for the
inserted rows use Postgres's built-in `gen_random_uuid()` (core since
PG13, no extension required) since raw SQL can't call Prisma's client-side
`cuid()` default — the id format doesn't matter, since application code
never hardcodes it and always resolves the RELAIS organization via its
slug.

The migration touches nothing on `User` — no `ALTER TABLE "User"`, no
`UPDATE "User"`, no drops anywhere in the file. This is production
correctness owned by the migration itself, not by anyone remembering to
run `npm run seed` (ticket §16).

Content-tested by
`prisma/add-organization-membership-foundation.migration.test.ts`:
additive-only assertions, uniqueness assertions (including the negative
assertion that `userId` is *not* globally unique), `ON DELETE RESTRICT`
assertions, RELAIS-insert and backfill-idempotency assertions (including
that the backfill role comes straight from `"User"."role"` with no
`CASE`/`COALESCE`/literal-role fallback), a staging-order assertion, and
assertions that the user-creation and role-sync transactions in the
application code actually touch `organizationMembership`.

## 6. Existing-user backfill semantics

For every pre-26B `User`:

```text
membership.organizationId = RELAIS.id
membership.userId         = User.id
membership.role           = User.role   (exact — no reinterpretation, no default)
```

`membership.createdAt` is the migration's execution timestamp, **not**
backdated to `User.createdAt`. This is deliberate (ticket §36): it
truthfully records "the system began recording organization membership at
this time," not a claim about when the employee's RELAIS employment
actually started. Membership does not model `employmentStartDate` /
`employmentEndDate` — those are separate, unbuilt concepts (ticket §37).

## 7. `User.role` remains runtime authority

Nothing in `authorization.service.ts` / `authorization.service-core.ts`
changed. Every `require*` helper still reads `session.user.role`, itself
sourced from `User.role`. `OrganizationMembership.role` is a transitional
**shadow copy**, not consulted by any authorization path. Two explicit
regression tests were added to `authorization.service.test.ts` fixturing
a User.role/Membership.role divergence in both directions, proving
`requireRoleCore` decides purely from `User.role` (ticket §61-63) — see
"Ticket 26B: requireRoleCore authorizes from User.role alone …".

## 8. Keeping the membership shadow role synchronized

Two write paths mutate `User.role` or create a `User` row; both were
audited (ticket §42/§44) and updated to keep the RELAIS membership
synchronized **in the same transaction**, without changing what is
authoritative:

- **User creation** — `createUserWithCreationHistory`
  (`src/services/user-creation-history.service.ts`), the shared
  persistence boundary for both the admin "create user" form
  (`user.service.ts`'s `createUser`) and `createUserWithPassword`
  (`auth-credentials.service.ts`). Now resolves the RELAIS organization
  and creates `User` + `UserCreationActivity` + `OrganizationMembership`
  atomically — a failure at any step rolls back all three inserts
  together, so a `User` can never exist without a membership (ticket
  §44-46).
- **Role edits** — `user.service.ts`'s `dependencies.update` (used by
  `updateUserCore`, i.e. the admin "edit user" form). When the update
  includes a `role` value, the wrapping transaction now also updates the
  RELAIS membership's `role` to match, via the
  `[organizationId, userId]` compound key. `updateOwnProfileCore` (a
  commercial editing their own name/phone) never includes `role`, so it
  never triggers this path — consistent with it already being
  structurally excluded from changing role (ticket §47).
- **`scripts/bootstrap-admin.ts`** — the one user-creation path outside
  `createUserWithCreationHistory` (it deliberately skips
  `UserCreationActivity` too, since no authenticated actor exists yet for
  the very first admin). Updated to also create the RELAIS membership
  atomically, so re-running this script after 26B can never leave the
  bootstrap admin without a membership.

No new runtime code reads `OrganizationMembership.role` for anything.
Synchronization is one-directional (`User.role` → membership), matching
`User.role`'s continued authority — there is no hook keeping them synced
on every arbitrary write, only on the two mutation paths that actually
exist.

## 9. What was deliberately not built

Per the ticket, none of the following exist after 26B:

- Membership lifecycle status (ACTIVE/INVITED/SUSPENDED/REMOVED)
- Organization ownership roles (OWNER/MEMBER/STAFF) — CRM roles remain the
  only membership-role universe
- Membership mutation UI/services (add/remove member, change membership
  role, switch organization, invite member)
- An organization selector or "switch workspace" UI
- A registration/onboarding flow ("create your company," "join
  organization," "invite team")
- Any application-wide `currentOrganizationId` / `activeOrganizationId` /
  tenant-context concept
- Any `organizationId` on business models (`Prospect`, `ProspectActivity`,
  `ProspectAction`, `LedgerEntry`, `DailyReport`, `PersonalNote`, etc.) or
  any tenant filter on a business query
- Organization deletion, or any UI that could delete RELAIS

## 10. Verification (schema-level)

Structural invariants proven by test, not just asserted in prose:

- `Organization.slug` unique (§34)
- `OrganizationMembership.[organizationId, userId]` unique, and `userId`
  is explicitly **not** globally unique — schema permits one `User` to
  hold memberships in multiple Organizations (§33/§55 of the ticket; a
  fixture-level structural test, no production second organization
  needed)
- `OrganizationMembership.role : UserRole` (§6 of the ticket)
- Both relations `onDelete: Restrict` (§17)

## 11. Post-deploy verification (to run after `prisma migrate deploy`)

Read-only checks, counts/mismatch-counts only — no user credentials or
personal data in diagnostic output (ticket §67-68):

```text
total users
total RELAIS memberships
users missing a RELAIS membership   → expected 0
duplicate RELAIS memberships        → expected 0
role mismatches (User.role vs RELAIS membership.role) → expected 0
```

If any of these are non-zero: **stop and investigate** (migration bug,
concurrent role change during the deploy window, creation-flow bug, or
unexpected pre-existing data) rather than patching counts to green with an
ad hoc production update (ticket §69).

## 12. Explicit transitional limitations

> **The CRM is not yet tenant-isolated after 26B.**

26B installs the tenant *identity* model. It does not enforce tenant
*data isolation* — no business query is scoped by organization, and none
of the IDOR/cross-tenant-write risks catalogued in the 26A audit (§21/§22
of that document) are addressed here. `OrganizationMembership.role` exists
but has no authorization effect; `User.role` remains the sole runtime
authority. Do not describe this system as "multi-tenant secure,"
"tenant-ready," or "organization isolated" on the strength of 26B alone —
the accurate statement is: **the organization and membership foundation is
installed.**

The next ticket in this series should be an ownership/scoping audit
follow-through (per-domain `organizationId` design, per the model-by-model
recommendations in the 26A audit), not organization switching or SaaS
onboarding.
