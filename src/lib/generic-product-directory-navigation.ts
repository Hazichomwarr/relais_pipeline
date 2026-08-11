import type { UserRole } from "@prisma/client";

export type GenericProductDirectoryViewer = {
  id: string;
  role: UserRole;
};

export type GenericProductDirectoryOwnership = {
  id: string;
  assignedUserId: string | null;
};

export type GenericProductDirectoryHrefOptions = {
  /**
   * Resolves the foreign-COMMERCIAL case to a product's own shared
   * read-only summary route (e.g. Digital Services' /products/digital-
   * services/[id] — Ticket 15G.2). Omit it (as LOKARI/NIA still do — no
   * such route exists for them yet) to keep the pre-15G.2 behavior of no
   * link at all rather than fabricating a route.
   */
  foreignHref?: (prospectId: string) => string;
};

/**
 * Used by the DIGITAL_SERVICES/LOKARI/NIA directories. The ADMIN/MANAGER
 * and "COMMERCIAL owns it" branches are identical across every product —
 * only the foreign-COMMERCIAL terminal case differs (Ticket 15G.2), so
 * that's the one bit made configurable rather than forking this whole
 * function per product.
 */
export function resolveGenericProductDetailHref(
  viewer: GenericProductDirectoryViewer,
  prospect: GenericProductDirectoryOwnership,
  options: GenericProductDirectoryHrefOptions = {},
): string | null {
  if (viewer.role === "ADMIN" || viewer.role === "MANAGER") {
    return `/admin/prospects/${prospect.id}`;
  }

  if (prospect.assignedUserId === viewer.id) {
    return `/dashboard/commercial/prospects/${prospect.id}`;
  }

  return options.foreignHref ? options.foreignHref(prospect.id) : null;
}
