import type { UserRole } from "@prisma/client";

/**
 * Ticket 28C §4 — "Responsable du suivi" terminology and truthful
 * null/inactive/ineligible representation. Deliberately distinct from
 * getAssignedUserName (prospect-ownership.ts): that helper falls back to
 * the legacy `agentName` text when `assignedUserId` is null, which is the
 * right behavior for the many existing list rows already relying on it.
 * This helper answers a narrower, management/ownership-specific question
 * — "is there a current assignedUserId, and if so who/what role/active
 * state" — and must never paper over a genuinely unassigned prospect with
 * agentName text, so the ownership section can say "Aucun responsable
 * actuellement" truthfully rather than displaying a historical name that
 * was never a real assignee.
 */
export type ProspectResponsibleDisplaySource = {
  assignedUserId: string | null;
  assignedUser: {
    firstName: string;
    lastName: string;
    role: UserRole;
    active: boolean;
  } | null;
};

export type ProspectResponsibleDisplay =
  | {
      assigned: true;
      userId: string;
      name: string;
      role: UserRole;
      active: boolean;
    }
  | { assigned: false };

export function getResponsibleUserDisplay(
  prospect: ProspectResponsibleDisplaySource,
): ProspectResponsibleDisplay {
  if (!prospect.assignedUserId || !prospect.assignedUser) {
    return { assigned: false };
  }

  return {
    assigned: true,
    userId: prospect.assignedUserId,
    name: `${prospect.assignedUser.firstName} ${prospect.assignedUser.lastName}`,
    role: prospect.assignedUser.role,
    active: prospect.assignedUser.active,
  };
}
