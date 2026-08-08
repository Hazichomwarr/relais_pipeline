import type { RelaisProduct, UserRole } from "@prisma/client";

export type SharedFeedProspectLinkViewer = {
  id: string;
  role: UserRole;
};

export type SharedFeedProspectLinkTarget = {
  id: string;
  product: RelaisProduct;
  assignedUserId: string | null;
};

/**
 * Ticket 18B — shared visibility, not shared ownership: every role can see
 * the event, but the link it produces must never grant a new edit
 * permission. Mirrors resolveSchoolDetailHref (school-directory-navigation.ts)
 * but generalized to any product, since the shared feed can reference any
 * prospect, not just KARMDA schools:
 *
 * - ADMIN/MANAGER always get the full admin detail page.
 * - A commercial viewing their own prospect gets their editable detail page.
 * - A commercial viewing another commercial's KARMDA school gets the
 *   existing read-only school summary.
 * - A commercial viewing another commercial's non-KARMDA prospect gets no
 *   link at all — there is no safe read-only route for that case, and
 *   generating an editable one would be an unauthorized permission grant.
 */
export function resolveSharedFeedProspectHref(
  viewer: SharedFeedProspectLinkViewer,
  prospect: SharedFeedProspectLinkTarget,
): string | null {
  if (viewer.role === "ADMIN" || viewer.role === "MANAGER") {
    return `/admin/prospects/${prospect.id}`;
  }

  if (prospect.assignedUserId === viewer.id) {
    return `/dashboard/commercial/prospects/${prospect.id}`;
  }

  if (prospect.product === "KARMDA") {
    return `/schools/${prospect.id}`;
  }

  return null;
}
