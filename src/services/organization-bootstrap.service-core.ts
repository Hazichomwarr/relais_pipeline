import { RELAIS_ORGANIZATION_SLUG } from "@/src/lib/organization";

/**
 * Structurally satisfied by both `prisma` and a `prisma.$transaction`
 * callback's transaction client, so the same lookup can run inside an
 * atomic user-creation/role-sync transaction (Ticket 26B §44/§47) or
 * standalone.
 */
export type OrganizationLookupClient = {
  organization: {
    findUnique: (args: {
      where: { slug: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

/**
 * Resolves the canonical RELAIS organization id via its stable slug — never
 * a hardcoded id, since ids differ across environments/databases (Ticket
 * 26B §51). The migration owns creating this row; a missing RELAIS
 * organization after migration is a data-integrity failure, so this throws
 * loudly rather than silently upserting one at runtime (§50).
 */
export async function resolveRelaisOrganizationIdCore(
  client: OrganizationLookupClient,
): Promise<string> {
  const organization = await client.organization.findUnique({
    where: { slug: RELAIS_ORGANIZATION_SLUG },
    select: { id: true },
  });

  if (!organization) {
    throw new Error(
      `Canonical RELAIS organization (slug="${RELAIS_ORGANIZATION_SLUG}") is missing. This is a data-integrity failure — it must be created by migration, never silently created at runtime.`,
    );
  }

  return organization.id;
}
