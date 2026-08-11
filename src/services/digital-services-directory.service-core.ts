import type { Prisma } from "@prisma/client";

export type DigitalServicesDirectoryFilters = {
  search?: string;
};

/**
 * Mirrors school-directory.service-core.ts's buildSchoolDirectoryWhere, but
 * for DIGITAL_SERVICES (Ticket 15G.2) — a distinct product-specific
 * where-builder, not a generalization of the school one. Search is
 * deliberately name-only (the organization/business name), never
 * contactName/phone/location, matching the school directory's own
 * "has this already been prospected?" semantics.
 */
export function buildDigitalServicesDirectoryWhere(
  filters: DigitalServicesDirectoryFilters = {},
): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = { product: "DIGITAL_SERVICES" };

  const search = filters.search?.trim();
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  return where;
}
