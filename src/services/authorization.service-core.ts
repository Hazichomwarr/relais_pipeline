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

/**
 * Ticket 25I — the coarse route/action gate: ADMIN or MANAGER may
 * *attempt* to manage a Role Responsibility assessment at all; COMMERCIAL
 * never can. This is deliberately broader than the real authority
 * matrix (a MANAGER may assess a COMMERCIAL but not a MANAGER; nobody
 * may assess an ADMIN in V1; nobody may self-assess) — that finer rule
 * depends on the *target* employee's role and cannot be expressed as a
 * flat actor-role list, so it lives in
 * canAssessRoleResponsibilities (role-responsibility-assessment.service-core.ts),
 * not here. This constant only keeps a COMMERCIAL out of the door.
 */
export const ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES: UserRole[] = [
  "ADMIN",
  "MANAGER",
];

/**
 * Ticket 25J — same coarse-gate shape as
 * ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES, kept as its own
 * constant rather than reused (the two features' access lists are
 * identical today by coincidence, same reasoning documented on every
 * other constant in this file) — the fine per-employee rule lives in
 * canAssessProfessionalContribution / canAssessEmployeeInStructuredEvaluation
 * (src/lib/employee-assessment-authorization.ts), not here.
 */
export const PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES: UserRole[] =
  ["ADMIN", "MANAGER"];

/**
 * Ticket 25K — the coarse gate for the performance dashboard route
 * itself: ADMIN or MANAGER may open it at all. Identical to the two
 * assessment-management role lists today by coincidence, kept separate
 * for the same reason every other constant in this file is. The finer
 * "which specific employee may this actor view" rule is
 * canViewEmployeePerformance (performance-summary.service-core.ts) —
 * deliberately not reused from the assessment-authority rules, since
 * viewing and assessing are different permissions (see that function's
 * own comment).
 */
export const PERFORMANCE_DASHBOARD_ACCESS_ROLES: UserRole[] = [
  "ADMIN",
  "MANAGER",
];

/**
 * Ticket 25N — the single Finance capability, covering every operational
 * Finance boundary this domain actually has: the /finances layout gate,
 * ledger entry creation, and reversal. The 25L/25N mutation audit found
 * no distinct read/write/administrative-configuration policies to
 * justify splitting this into FINANCE_VIEW_ROLES/FINANCE_ENTRY_ROLES/
 * FINANCE_REVERSAL_ROLES — every Finance operation in this codebase is
 * ordinary operational accounting, so one constant governs all of it. A
 * genuine split, if a future ticket ever finds one, should add named
 * siblings here rather than special-casing role checks inline.
 *
 * Positive capability, not a role exclusion (`role !== "MANAGER" &&
 * role !== "COMMERCIAL"`): this reads as "ADMIN and ASSISTANT may access
 * Finance," not "everyone except these two roles" — the distinction the
 * ticket itself calls out as mattering once role authority moves onto
 * OrganizationMembership in Phase 26.
 *
 * Deliberately NOT reused for anything outside Finance, even where
 * ADMIN-only checks exist elsewhere in this file (e.g. user
 * administration, Section 36 of the ticket) — this constant grants
 * exactly one capability, never a blanket ADMIN-equivalence for
 * ASSISTANT.
 */
export const FINANCE_ACCESS_ROLES: UserRole[] = ["ADMIN", "ASSISTANT"];

/**
 * Ticket 25R §5-7 — the coarse gate for the shared `/admin` shell itself
 * (the dashboard overview route and everything nested under it that has
 * no narrower authorization of its own — see app/admin/layout.tsx).
 * Replaces that layout's previously inline `requireRole("ADMIN",
 * "MANAGER")` with a named capability so ASSISTANT's new dashboard grant
 * is visible here rather than buried in a route file, and so it can
 * never be confused with `requireAdmin()` (ADMIN-only, untouched).
 *
 * This is deliberately a *shell* capability, not a blanket `/admin/*`
 * grant: every route nested under `/admin` that carries real data —
 * `/admin/users`, `/admin/performance`, `/admin/my-prospects`,
 * `/admin/follow-ups`, `/admin/performance-targets`, `/admin/reports`
 * (its own nested layout), `/admin/prospects/[id]` — already has (or, for
 * the two gaps 25R closed, now has) its own independent, narrower
 * authorization call. Widening this one constant to admit ASSISTANT does
 * not widen any of those; each was individually audited (25R §10) before
 * this constant was introduced. See app/admin/page.tsx for why ASSISTANT
 * passing this gate does not mean ASSISTANT sees the same dashboard
 * content as ADMIN/MANAGER — dashboard *access* and dashboard *content*
 * are handled as two separate concerns.
 */
export const DASHBOARD_ACCESS_ROLES: UserRole[] = [
  "ADMIN",
  "MANAGER",
  "ASSISTANT",
];

/**
 * Ticket 25R §10/§12 — `/admin/follow-ups` (the commercial follow-up
 * queue: prospect names, products, interest levels) had no authorization
 * call of its own before this ticket; it relied entirely on
 * app/admin/layout.tsx's then-`requireRole("ADMIN", "MANAGER")` gate.
 * Once that gate widened to admit ASSISTANT (DASHBOARD_ACCESS_ROLES,
 * above), this page needed its own explicit, narrower boundary to keep
 * excluding ASSISTANT (and COMMERCIAL) from this sensitive commercial
 * data — this constant is that boundary, named and tested like every
 * other feature-specific policy in this file, not merely inlined.
 */
export const FOLLOW_UP_QUEUE_MANAGEMENT_ROLES: UserRole[] = [
  "ADMIN",
  "MANAGER",
];

/**
 * Ticket 27A/27C — who has their own "Ma journée" at all: MANAGER,
 * COMMERCIAL, ASSISTANT. ADMIN is deliberately excluded — ADMIN is
 * management/coordination authority over other people's workdays
 * (WORKDAY_CONFIRMATION_ROLES below), not a field worker declaring their
 * own presence (27A §4). This is the coarse gate only; the fine
 * "who may confirm whom" matrix is canConfirmWorkdayStart
 * (workday.service-core.ts), which cannot be expressed as a flat role
 * list since it depends on both actor and subject role.
 */
export const WORKDAY_ELIGIBLE_ROLES: UserRole[] = [
  "MANAGER",
  "COMMERCIAL",
  "ASSISTANT",
];

/**
 * Ticket 27A/27C — the coarse gate: ADMIN or MANAGER may *attempt* to
 * confirm someone's workday start at all; COMMERCIAL and ASSISTANT never
 * can. Deliberately broader than the real authority matrix (a MANAGER
 * may confirm a COMMERCIAL/ASSISTANT but never another MANAGER or
 * themselves) — that finer, subject-role-dependent rule lives in
 * canConfirmWorkdayStart (workday.service-core.ts), not here, exactly
 * like ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES's own coarse/fine
 * split above. Kept as its own constant rather than reused from an
 * identical-looking existing list (e.g. DAILY_REPORT_MANAGEMENT_ROLES) —
 * this feature's access list is its own deliberate decision, per this
 * file's established convention.
 */
export const WORKDAY_CONFIRMATION_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Ticket 27A/27E — who may receive a DailyTask at all: MANAGER,
 * COMMERCIAL. ASSISTANT is deliberately excluded — Assistant's Ma
 * journée shows static role guidance instead of a task list (27A §7).
 * ADMIN is excluded too — ADMIN is assignment/cancellation authority
 * only, never a recipient (27A §11). This is the coarse gate only; the
 * fine "who may assign to whom" matrix is canAssignTask
 * (daily-task.service-core.ts), which cannot be expressed as a flat role
 * list since it depends on both actor and subject role.
 */
export const DAILY_TASK_RECIPIENT_ROLES: UserRole[] = ["MANAGER", "COMMERCIAL"];

/**
 * Ticket 27A/27E — the coarse gate: ADMIN or MANAGER may *attempt* to
 * assign or cancel a DailyTask at all; COMMERCIAL and ASSISTANT never
 * can. Deliberately broader than the real authority matrices
 * (canAssignTask / canCancelTask in daily-task.service-core.ts), exactly
 * like WORKDAY_CONFIRMATION_ROLES's own coarse/fine split above.
 */
export const TASK_ASSIGNMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Ticket 27G — the coarse gate for the "Journées des agents" management
 * route itself: ADMIN or MANAGER may open it at all. Identical to
 * WORKDAY_CONFIRMATION_ROLES and TASK_ASSIGNMENT_ROLES today by
 * coincidence, kept as its own constant for the same reason every other
 * constant in this file is (e.g. PERFORMANCE_DASHBOARD_ACCESS_ROLES vs.
 * the assessment-management role lists it sits beside) — this route's
 * access list is its own deliberate decision, distinct from either
 * mutation's own authority. The individual confirm/assign/cancel
 * mutations reached from this route keep using
 * requireWorkdayConfirmationAccess()/requireTaskAssignmentAccess() and
 * their own fine-grained matrices — this constant only keeps
 * COMMERCIAL/ASSISTANT out of the door for the page itself.
 */
export const DAILY_WORK_MANAGEMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Ticket 28B — the coarse route/action gate for prospect reassignment:
 * ADMIN or MANAGER may *attempt* it at all, organization-wide (no
 * manager-of-employee hierarchy exists — same limitation as
 * COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES and every other
 * management-only constant in this file). This is deliberately not the
 * only gate: the reassignment service itself re-resolves the actor fresh
 * from the database (28A found ADMIN/MANAGER JWTs can remain stale after
 * deactivation) rather than trusting this session-role check alone for
 * this one high-impact mutation — see reassignProspectCore.
 */
export const PROSPECT_REASSIGNMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

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
