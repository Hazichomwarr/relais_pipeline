import "server-only";

import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import {
  assertCanChangePasswordCore,
  AuthorizationError,
  COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES,
  DAILY_REPORT_MANAGEMENT_ROLES,
  DAILY_TASK_RECIPIENT_ROLES,
  DASHBOARD_ACCESS_ROLES,
  FINANCE_ACCESS_ROLES,
  FOLLOW_UP_QUEUE_MANAGEMENT_ROLES,
  MY_PROSPECTS_ROLES,
  PERFORMANCE_DASHBOARD_ACCESS_ROLES,
  PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES,
  PROSPECT_ACTION_QUEUE_ROLES,
  requireAuthenticatedUserCore,
  requireRoleCore,
  ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES,
  SALES_ANALYTICS_ROLES,
  SHARED_FEED_ROLES,
  TASK_ASSIGNMENT_ROLES,
  WORKDAY_CONFIRMATION_ROLES,
  WORKDAY_ELIGIBLE_ROLES,
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

/**
 * Coarse gate for Professional Contribution assessment management
 * (Ticket 25J) — ADMIN and MANAGER only. The finer "may this actor
 * assess THIS employee" rule is domain-level; see
 * canAssessProfessionalContribution.
 */
export async function requireProfessionalContributionAssessmentManagementAccess() {
  return requireRole(...PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES);
}

/**
 * Coarse gate for the performance dashboard route (Ticket 25K) — ADMIN
 * and MANAGER only. The finer "may this actor view THIS employee's
 * dashboard" rule is domain-level; see canViewEmployeePerformance.
 */
export async function requirePerformanceDashboardAccess() {
  return requireRole(...PERFORMANCE_DASHBOARD_ACCESS_ROLES);
}

/**
 * Ticket 25N — the one Finance authorization boundary: ADMIN or
 * ASSISTANT. Deliberately not requireAdmin() itself (§5 of the ticket):
 * that helper stays genuinely ADMIN-only everywhere else it's used (user
 * administration, targets, etc.) — granting Finance access must never
 * silently widen those unrelated surfaces to ASSISTANT.
 */
export async function requireFinanceAccess() {
  return requireRole(...FINANCE_ACCESS_ROLES);
}

/**
 * Ticket 25R — the coarse gate for the shared /admin shell (dashboard
 * overview route and any nested route with no narrower authorization of
 * its own). ADMIN, MANAGER, and — new in this ticket — ASSISTANT. This
 * is a *shell/view* capability, never a stand-in for `requireAdmin()`:
 * routes carrying real data must keep their own independent, narrower
 * check (see DASHBOARD_ACCESS_ROLES's own comment for the full list this
 * ticket audited).
 */
export async function requireDashboardAccess() {
  return requireRole(...DASHBOARD_ACCESS_ROLES);
}

/**
 * Ticket 25R §10/§12 — the commercial follow-up queue (/admin/follow-ups)
 * had no authorization call of its own before this ticket, relying
 * entirely on the /admin shell's own gate. Now that the shell gate
 * (requireDashboardAccess) admits ASSISTANT, this route needs its own
 * explicit, narrower boundary to keep excluding ASSISTANT and COMMERCIAL
 * from this sensitive commercial data.
 */
export async function requireFollowUpQueueManagementAccess() {
  return requireRole(...FOLLOW_UP_QUEUE_MANAGEMENT_ROLES);
}

/**
 * Ticket 27C — the coarse gate for "Ma journée" self-service actions
 * (start/end my own workday). ADMIN excluded — see WORKDAY_ELIGIBLE_ROLES.
 * This authorizes the route/action, not any specific mutation's fine
 * rules; startMyWorkday/endMyWorkday independently re-verify eligibility
 * against a fresh database read (see workday.service.ts), never trusting
 * this session-cached check alone.
 */
export async function requireWorkdayEligibility() {
  return requireRole(...WORKDAY_ELIGIBLE_ROLES);
}

/**
 * Ticket 27C — the coarse gate for workday-confirmation actions: ADMIN or
 * MANAGER may *attempt* to confirm someone's start at all. The real
 * actor/subject/self authority matrix is canConfirmWorkdayStart
 * (workday.service-core.ts), re-evaluated independently inside the
 * service — this wrapper only keeps COMMERCIAL/ASSISTANT out of the door.
 */
export async function requireWorkdayConfirmationAccess() {
  return requireRole(...WORKDAY_CONFIRMATION_ROLES);
}

/**
 * Ticket 27E — the coarse gate for "Tâches du jour" self-service actions
 * (complete/uncomplete my own task). ASSISTANT and ADMIN excluded — see
 * DAILY_TASK_RECIPIENT_ROLES. completeMyTask/uncompleteMyTask
 * independently re-verify eligibility and task ownership against a
 * fresh database read, never trusting this session-cached check alone.
 */
export async function requireDailyTaskRecipientAccess() {
  return requireRole(...DAILY_TASK_RECIPIENT_ROLES);
}

/**
 * Ticket 27E — the coarse gate for task-assignment and cancellation
 * actions: ADMIN or MANAGER may *attempt* either at all. The real
 * actor/subject authority matrices are canAssignTask/canCancelTask
 * (daily-task.service-core.ts), re-evaluated independently inside the
 * service — this wrapper only keeps COMMERCIAL/ASSISTANT out of the door.
 */
export async function requireTaskAssignmentAccess() {
  return requireRole(...TASK_ASSIGNMENT_ROLES);
}
