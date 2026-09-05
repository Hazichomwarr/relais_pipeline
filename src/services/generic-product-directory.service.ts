import "server-only";

import type { RelaisProduct } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { assignedUserListSelect } from "@/src/services/prospect-read.service-core";

/**
 * Ticket 28C — the LOKARI/NIA equivalent of getDigitalServicesProspectById
 * (digital-services-directory.service.ts) and getSchoolSummaryById
 * (school-directory.service.ts): scoped to `product` so a prospect id
 * belonging to a different product resolves to null here even if it
 * exists — this route must never reveal that an id exists under a
 * different product. LOKARI and NIA have no product-specific directory
 * service of their own (unlike KARMDA/Digital Services, they still use
 * the generic getProspects() for their list page), so this one function
 * is parametrized by product rather than duplicated per product.
 */
export async function getGenericProductProspectById(
  product: RelaisProduct,
  prospectId: string,
) {
  return prisma.prospect.findFirst({
    where: { id: prospectId, product },
    include: {
      assignedUser: { select: assignedUserListSelect },
    },
  });
}

export type GenericProductProspectDetail = NonNullable<
  Awaited<ReturnType<typeof getGenericProductProspectById>>
>;

export async function getLokariProspectById(prospectId: string) {
  return getGenericProductProspectById("LOKARI", prospectId);
}

export async function getNiaProspectById(prospectId: string) {
  return getGenericProductProspectById("NIA", prospectId);
}
