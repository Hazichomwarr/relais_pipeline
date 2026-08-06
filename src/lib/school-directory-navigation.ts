import type { UserRole } from "@prisma/client";

export type SchoolDirectoryViewer = {
  id: string;
  role: UserRole;
};

export type SchoolDirectoryOwnership = {
  id: string;
  assignedUserId: string | null;
};

/**
 * Admins/managers always land on the full admin prospect page. A commercial
 * lands on their own editable page for schools they own, and on the
 * read-only /schools summary for every other commercial's school — this is
 * what lets the directory stay ownership-preserving while still preventing
 * duplicate prospecting.
 */
export function resolveSchoolDetailHref(
  viewer: SchoolDirectoryViewer,
  school: SchoolDirectoryOwnership,
): string {
  if (viewer.role === "ADMIN" || viewer.role === "MANAGER") {
    return `/admin/prospects/${school.id}`;
  }

  if (school.assignedUserId === viewer.id) {
    return `/dashboard/commercial/prospects/${school.id}`;
  }

  return `/schools/${school.id}`;
}
