import type { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

export type AuthorizationErrorCode = "UNAUTHENTICATED" | "ACCESS_DENIED";

export class AuthorizationError extends Error {
  constructor(
    public readonly code: AuthorizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type SessionLike = { user?: AuthenticatedUser | null } | null;

/**
 * À la une (Ticket 18A) is shared CRM history, readable by every
 * operational role — but never anonymously.
 */
export const SHARED_FEED_ROLES: UserRole[] = ["ADMIN", "MANAGER", "COMMERCIAL"];

/**
 * Ticket 19A — ADMIN and MANAGER may read daily reports across every
 * employee (Ticket 19C). This is a read-only grant: it must never be used
 * to authorize a mutation, since only the report owner may edit/submit
 * their own report in V1.
 */
export const DAILY_REPORT_MANAGEMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Ticket 20E — the /actions execution queue is visible company-wide to
 * every current operational role. Identical to SHARED_FEED_ROLES today by
 * coincidence, not by relationship — kept as its own constant so the two
 * features' access lists can diverge independently later (e.g. a future
 * role added to one on purpose, not both by accident). Visibility here
 * never implies mutation rights: completing/canceling a ProspectAction
 * still goes through canCompleteProspectAction/canCancelProspectAction
 * (Ticket 20B), unchanged.
 */
export const PROSPECT_ACTION_QUEUE_ROLES: UserRole[] = [
  "ADMIN",
  "MANAGER",
  "COMMERCIAL",
];

/**
 * Ticket 20F — company-wide sales analytics (funnel, and later 20G's
 * "why" analytics) are management-only in V1, unlike the /actions queue.
 * Identical to DAILY_REPORT_MANAGEMENT_ROLES today by coincidence, kept
 * as its own constant for the same reason PROSPECT_ACTION_QUEUE_ROLES is
 * its own constant — each feature's access list is its own deliberate
 * decision, not an accidental alias of an unrelated one.
 */
export const SALES_ANALYTICS_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Ticket 21B — "Mes prospects" (/admin/my-prospects) is the ADMIN/MANAGER
 * personal-ownership view inside the shared admin shell. COMMERCIAL has
 * an equivalent personal-ownership experience at /dashboard/commercial
 * instead of this route, so it is deliberately excluded here rather than
 * folded into a single three-role list. Identical to SALES_ANALYTICS_ROLES
 * today by coincidence, kept as its own constant for the same reason that
 * one is its own constant.
 */
export const MY_PROSPECTS_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Ticket 25H.2A — ADMIN and MANAGER may create/edit/delete (upcoming)
 * Commercial performance targets. Identical to DAILY_REPORT_MANAGEMENT_ROLES
 * and SALES_ANALYTICS_ROLES today by coincidence, kept as its own constant
 * for the same reason those are — this feature's access list is its own
 * deliberate decision. Unlike DAILY_REPORT_MANAGEMENT_ROLES, this one DOES
 * authorize a mutation: there is no per-employee ownership check beyond
 * role, because this CRM has no manager-of-employee hierarchy (25G §6/§27)
 * — a MANAGER's authority here is organization-wide, not team-scoped, and
 * that limitation is deliberate and documented, not an oversight.
 */
export const COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES: UserRole[] = [
  "ADMIN",
  "MANAGER",
];

export function requireAuthenticatedUserCore(
  session: SessionLike,
): AuthenticatedUser {
  if (!session?.user) {
    throw new AuthorizationError(
      "UNAUTHENTICATED",
      "Vous devez être connecté pour accéder à cette page.",
    );
  }

  return session.user;
}

export function requireRoleCore(
  session: SessionLike,
  roles: UserRole[],
): AuthenticatedUser {
  const user = requireAuthenticatedUserCore(session);

  if (!roles.includes(user.role)) {
    throw new AuthorizationError(
      "ACCESS_DENIED",
      "Vous n’avez pas les droits nécessaires pour accéder à cette page.",
    );
  }

  return user;
}

/**
 * A user may change their own password; only ADMIN may change anyone
 * else's (Ticket 13D.3 — user management is ADMIN-only; MANAGER keeps
 * every other operational permission but not this one). Takes an
 * already-authenticated user (no session fetch) so callers that already
 * ran requireAuthenticatedUser() don't pay for a second lookup.
 */
export function assertCanChangePasswordCore(
  user: AuthenticatedUser,
  targetUserId: string,
): void {
  const isSelf = user.id === targetUserId;
  const isElevated = user.role === "ADMIN";

  if (!isSelf && !isElevated) {
    throw new AuthorizationError(
      "ACCESS_DENIED",
      "Vous n’avez pas le droit de modifier le mot de passe de cet utilisateur.",
    );
  }
}
