-- Ticket 26B — organization/membership FOUNDATION only. Purely additive:
-- two new tables, their constraints/indexes, one canonical RELAIS
-- organization row, and one membership row per pre-existing User backfilled
-- from their current User.role. Nothing about User is dropped, renamed, or
-- rewritten. User.role remains runtime authorization authority; the
-- backfilled membership role is a shadow copy only (see
-- notes/ticket-26b-organization-membership-foundation.md).
--
-- Idempotency: the INSERT statements below use ON CONFLICT DO NOTHING
-- against the unique constraints created earlier in this same file, so
-- re-running this file (or a retried deploy) can never duplicate the RELAIS
-- organization or a membership row, even though Prisma migrations normally
-- execute exactly once.

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- One membership per (organization, user) pair — the mandatory invariant.
-- Deliberately NOT a global unique on "userId" alone: a User is a global
-- identity that may structurally belong to multiple Organizations.
-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "OrganizationMembership"("organizationId", "role");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bootstrap the one canonical RELAIS tenant. Stable business key is the
-- slug, never a hardcoded id (application code resolves this row via
-- RELAIS_ORGANIZATION_SLUG, src/lib/organization.ts). ON CONFLICT guards
-- against ever creating a second RELAIS organization on a retried deploy.
INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'RELAIS', 'relais', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- Backfill: every existing User gets exactly one RELAIS membership, with
-- role copied verbatim from User.role at migration time — no
-- reinterpretation, no default, no normalization. ON CONFLICT guards
-- against duplicating a membership on a retried deploy.
INSERT INTO "OrganizationMembership" ("id", "organizationId", "userId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "relais"."id", "User"."id", "User"."role", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
CROSS JOIN (SELECT "id" FROM "Organization" WHERE "slug" = 'relais') AS "relais"
ON CONFLICT ("organizationId", "userId") DO NOTHING;
