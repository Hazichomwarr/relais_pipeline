import "server-only";

import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import {
  assertCanChangePasswordCore,
  AuthorizationError,
  DAILY_REPORT_MANAGEMENT_ROLES,
  PROSPECT_ACTION_QUEUE_ROLES,
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

/**
 * Read boundary for management-wide daily report visibility (Ticket 19A/C)
 * — ADMIN and MANAGER only. COMMERCIAL never gets global read access here,
 * even once assigned a report template; they can only reach their own
 * reports through the self-service path (requireAuthenticatedUser()).
 */
export async function requireDailyReportManagementAccess() {
  return requireRole(...DAILY_REPORT_MANAGEMENT_ROLES);
}

/**
 * Read boundary for the company-wide /actions execution queue (Ticket
 * 20E) — every current operational role. Visibility only: completing or
 * canceling a specific ProspectAction is still gated separately by
 * canCompleteProspectAction/canCancelProspectAction (Ticket 20B).
 */
export async function requireProspectActionQueueAccess() {
  return requireRole(...PROSPECT_ACTION_QUEUE_ROLES);
}
