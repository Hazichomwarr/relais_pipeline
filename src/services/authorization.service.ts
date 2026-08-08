import "server-only";

import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import {
  assertCanChangePasswordCore,
  AuthorizationError,
  requireAuthenticatedUserCore,
  requireRoleCore,
  SHARED_FEED_ROLES,
} from "@/src/services/authorization.service-core";

export { AuthorizationError };
export const assertCanChangePassword = assertCanChangePasswordCore;
export type { AuthenticatedUser } from "@/src/services/authorization.service-core";

export async function requireAuthenticatedUser() {
  const session = await auth();
  return requireAuthenticatedUserCore(session);
}

export async function requireRole(...roles: UserRole[]) {
  const session = await auth();
  return requireRoleCore(session, roles);
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}

export async function requireManager() {
  return requireRole("MANAGER");
}

/**
 * Used by a commercial user to act on their own data, e.g.:
 *   const user = await requireCommercial();
 *   getCommercialDashboard(user.id);
 */
export async function requireCommercial() {
  return requireRole("COMMERCIAL");
}

/**
 * Read boundary for the shared À la une feed (Ticket 18A) — every
 * operational role may read it, but it is never exposed publicly.
 */
export async function requireSharedFeedAccess() {
  return requireRole(...SHARED_FEED_ROLES);
}
