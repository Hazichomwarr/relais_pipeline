import "server-only";

import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import {
  assertCanChangePasswordCore,
  AuthorizationError,
  COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES,
  DAILY_REPORT_MANAGEMENT_ROLES,
  MY_PROSPECTS_ROLES,
  PROSPECT_ACTION_QUEUE_ROLES,
  requireAuthenticatedUserCore,
  requireRoleCore,
  ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES,
  SALES_ANALYTICS_ROLES,
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

/**
 * Read boundary for company-wide sales analytics (Ticket 20F) —
 * ADMIN/MANAGER only. COMMERCIAL never sees company-wide funnel numbers
 * in V1, even though they can see the company-wide action queue.
 */
export async function requireSalesAnalyticsAccess() {
  return requireRole(...SALES_ANALYTICS_ROLES);
}

/**
 * Read boundary for the ADMIN/MANAGER "Mes prospects" personal-ownership
 * page (Ticket 21B) — COMMERCIAL reaches the same underlying ownership
 * concept through /dashboard/commercial instead, not this boundary.
 */
export async function requireMyProspectsAccess() {
  return requireRole(...MY_PROSPECTS_ROLES);
}

/**
 * Read/write boundary for Commercial performance target management
 * (Ticket 25H.2A) — ADMIN and MANAGER only. Organization-wide, not
 * team-scoped, because no manager-of-employee hierarchy exists yet.
 */
export async function requireCommercialPerformanceTargetManagementAccess() {
  return requireRole(...COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES);
}

/**
 * Coarse gate for Role Responsibility assessment management (Ticket
 * 25I) — ADMIN and MANAGER only. The finer "may this actor assess THIS
 * employee" rule is domain-level, not authorization-level; see
 * canAssessRoleResponsibilities.
 */
export async function requireRoleResponsibilityAssessmentManagementAccess() {
  return requireRole(...ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES);
}
