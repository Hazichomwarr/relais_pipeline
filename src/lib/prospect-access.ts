import type { RelaisProduct, UserRole } from "@prisma/client";

/**
 * Ticket 28C — the single canonical policy for "what may this viewer do
 * with this prospect, and where should they land." Consolidates four
 * independent functions the 28A audit found computing overlapping
 * decisions from the same three inputs (viewer.role, viewer.id,
 * prospect.assignedUserId), each with its own product-specific carve-out:
 * `resolveGenericProductDetailHref` (generic-product-directory-navigation.ts),
 * `resolveSchoolDetailHref` (school-directory-navigation.ts),
 * `resolveSharedFeedProspectHref` (shared-feed-prospect-navigation.ts), and
 * `resolveProspectActionQueueProspectHref` (prospect-action-queue.service-core.ts).
 * All four are now either deleted or reduced to a thin delegate to this
 * file — see each call site.
 *
 * This resolves NAVIGATION/PRESENTATION policy only — "where does this
 * viewer land, and does the UI there show operational controls." It is
 * never itself a mutation authority: every ownership-scoped Server
 * Action/service (submitProspectFollowUp, createCommercialActivity,
 * reassignProspect, ...) re-derives its own authorization independently
 * from the database, exactly as before this ticket. A route existing is
 * not permission to mutate.
 */

export type ProspectAccessViewer = {
  id: string;
  role: UserRole;
};

export type ProspectAccessTarget = {
  id: string;
  product: RelaisProduct;
  assignedUserId: string | null;
};

export type ProspectAccess =
  | {
      kind: "MANAGEMENT";
      detailHref: string;
      canOperate: true;
      canReassign: true;
    }
  | {
      kind: "OWNER";
      detailHref: string;
      canOperate: true;
      canReassign: false;
    }
  | {
      kind: "READ_ONLY";
      detailHref: string;
      canOperate: false;
      canReassign: false;
    }
  | {
      kind: "NONE";
      detailHref: null;
      canOperate: false;
      canReassign: false;
    };

/**
 * Ticket 28C closes the KARMDA/Digital-Services-only read-only parity gap
 * the 28A audit found: every product now has a safe, Commercial-authorized
 * read-only summary route, so this never needs to return null for a known
 * product. It stays a `switch` (not a config lookup) so a fifth product
 * added to the Prisma schema fails to compile here until this is updated —
 * same defensive-exhaustiveness convention as getProductFields()
 * (prospect-detail-sections.tsx) and productDirectoryEntries
 * (product-directory.ts).
 */
export function resolveReadOnlyProductHref(
  product: RelaisProduct,
  prospectId: string,
): string {
  switch (product) {
    case "KARMDA":
      return `/schools/${prospectId}`;
    case "DIGITAL_SERVICES":
      return `/products/digital-services/${prospectId}`;
    case "LOKARI":
      return `/products/lokari/${prospectId}`;
    case "NIA":
      return `/products/nia/${prospectId}`;
  }
}

/**
 * ADMIN/MANAGER always get management access to any prospect, any product
 * (28B: organization-wide, no team hierarchy). A COMMERCIAL who currently
 * owns the prospect gets full operational access. Every other COMMERCIAL
 * gets the product's read-only summary. ASSISTANT (or any other role)
 * gets none — the 28A audit found ASSISTANT has zero prospect visibility,
 * and that boundary is unchanged here.
 */
export function resolveProspectAccess(
  viewer: ProspectAccessViewer,
  prospect: ProspectAccessTarget,
): ProspectAccess {
  if (viewer.role === "ADMIN" || viewer.role === "MANAGER") {
    return {
      kind: "MANAGEMENT",
      detailHref: `/admin/prospects/${prospect.id}`,
      canOperate: true,
      canReassign: true,
    };
  }

  if (viewer.role === "COMMERCIAL") {
    if (prospect.assignedUserId === viewer.id) {
      return {
        kind: "OWNER",
        detailHref: `/dashboard/commercial/prospects/${prospect.id}`,
        canOperate: true,
        canReassign: false,
      };
    }

    return {
      kind: "READ_ONLY",
      detailHref: resolveReadOnlyProductHref(prospect.product, prospect.id),
      canOperate: false,
      canReassign: false,
    };
  }

  return { kind: "NONE", detailHref: null, canOperate: false, canReassign: false };
}
