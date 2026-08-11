import "server-only";

import { prisma } from "@/src/lib/prisma";
import {
  buildDigitalServicesDirectoryWhere,
  type DigitalServicesDirectoryFilters,
} from "@/src/services/digital-services-directory.service-core";
import {
  assignedUserListSelect,
  prospectListOrderBy,
} from "@/src/services/prospect-read.service-core";

/**
 * Company-wide directory list (Ticket 15G.2) — no owner scope, so
 * ADMIN/MANAGER/COMMERCIAL-owned prospects all appear. Ordering reuses the
 * repository's existing prospectListOrderBy (createdAt desc) rather than
 * the school directory's alphabetical order — a deliberate, not
 * accidental, choice for this product.
 */
export async function getDigitalServicesDirectory(
  filters: DigitalServicesDirectoryFilters = {},
) {
  return prisma.prospect.findMany({
    where: buildDigitalServicesDirectoryWhere(filters),
    include: {
      assignedUser: { select: assignedUserListSelect },
    },
    orderBy: prospectListOrderBy,
  });
}

export type DigitalServicesDirectoryItem = Awaited<
  ReturnType<typeof getDigitalServicesDirectory>
>[number];

/**
 * Scoped to product: "DIGITAL_SERVICES" so a non-Digital-Services prospect
 * id resolves to null here even if it exists — this route must never
 * reveal that an id exists under a different product.
 */
export async function getDigitalServicesProspectById(prospectId: string) {
  return prisma.prospect.findFirst({
    where: { id: prospectId, product: "DIGITAL_SERVICES" },
    include: {
      assignedUser: { select: assignedUserListSelect },
    },
  });
}

export type DigitalServicesProspectDetail = NonNullable<
  Awaited<ReturnType<typeof getDigitalServicesProspectById>>
>;
