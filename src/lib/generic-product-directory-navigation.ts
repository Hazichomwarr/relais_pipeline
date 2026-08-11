import type { UserRole } from "@prisma/client";

export type GenericProductDirectoryViewer = {
  id: string;
  role: UserRole;
};

export type GenericProductDirectoryOwnership = {
  id: string;
  assignedUserId: string | null;
};

/**
 * Used by the DIGITAL_SERVICES/LOKARI/NIA foundation directories (Ticket
 * 15G.1) — unlike resolveSchoolDetailHref, there is no dedicated read-only
 * summary route yet for these products' foreign-owned prospects, so that
 * case resolves to null (no link) rather than fabricating a new route.
 * Ticket 15G.2 owns building real role-safe navigation for these products.
 */
export function resolveGenericProductDetailHref(
  viewer: GenericProductDirectoryViewer,
  prospect: GenericProductDirectoryOwnership,
): string | null {
  if (viewer.role === "ADMIN" || viewer.role === "MANAGER") {
    return `/admin/prospects/${prospect.id}`;
  }

  if (prospect.assignedUserId === viewer.id) {
    return `/dashboard/commercial/prospects/${prospect.id}`;
  }

  return null;
}
