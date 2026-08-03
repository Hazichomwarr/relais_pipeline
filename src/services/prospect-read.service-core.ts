import type { Prisma } from "@prisma/client";

import type { ProspectFilters } from "@/src/types/propect.-filters";

export const prospectListOrderBy = [
  { createdAt: "desc" },
] satisfies Prisma.ProspectOrderByWithRelationInput[];

export const assignedUserListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  active: true,
} satisfies Prisma.UserSelect;

export function buildProspectWhere(
  filters: ProspectFilters = {},
): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = {};

  if (filters.product) {
    where.product = filters.product;
  }
  if (filters.interest) {
    where.interest = filters.interest;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.userId) {
    where.assignedUserId = filters.userId;
  }
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { contactName: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search } },
      { location: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.createdAt = { gte: start, lt: end };
  }

  return where;
}
