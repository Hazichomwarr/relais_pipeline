import "server-only";

import { prisma } from "@/src/lib/prisma";
import {
  resolveRelaisOrganizationIdCore,
  type OrganizationLookupClient,
} from "@/src/services/organization-bootstrap.service-core";

export async function resolveRelaisOrganizationId(
  client: OrganizationLookupClient = prisma,
): Promise<string> {
  return resolveRelaisOrganizationIdCore(client);
}
