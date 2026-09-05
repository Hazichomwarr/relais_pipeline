import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import { isScorableForCommercialResults } from "./commercial-results.service-core";
import { isScorableForExecutionDiscipline } from "./execution-discipline.service-core";
import {
  assertCanChangePasswordCore,
  AuthorizationError,
  COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES,
  DAILY_REPORT_MANAGEMENT_ROLES,
  DASHBOARD_ACCESS_ROLES,
  FINANCE_ACCESS_ROLES,
  FOLLOW_UP_QUEUE_MANAGEMENT_ROLES,
  PERFORMANCE_DASHBOARD_ACCESS_ROLES,
  PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES,
  DAILY_TASK_RECIPIENT_ROLES,
  DAILY_WORK_MANAGEMENT_ROLES,
  PROSPECT_REASSIGNMENT_ROLES,
  requireAuthenticatedUserCore,
  requireRoleCore,
  ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES,
  SHARED_FEED_ROLES,
  TASK_ASSIGNMENT_ROLES,
  WORKDAY_CONFIRMATION_ROLES,
  WORKDAY_ELIGIBLE_ROLES,
  type AuthenticatedUser,
} from "./authorization.service-core";

test("requireAuthenticatedUserCore rejects an anonymous session", () => {
  assert.throws(
    () => requireAuthenticatedUserCore(null),
    hasCode("UNAUTHENTICATED"),
  );
});

test("requireAuthenticatedUserCore rejects a session with no user", () => {
  assert.throws(
    () => requireAuthenticatedUserCore({ user: null }),
    hasCode("UNAUTHENTICATED"),
  );
});

test("requireAuthenticatedUserCore returns the user, never the raw session", () => {
  const session = { user: makeUser("ADMIN") };
  const user = requireAuthenticatedUserCore(session);

  assert.equal(user, session.user);
});

test("requireRoleCore allows an ADMIN on an admin-only page", () => {
  const user = requireRoleCore({ user: makeUser("ADMIN") }, ["ADMIN", "MANAGER"]);
  assert.equal(user.role, "ADMIN");
});

test("requireRoleCore allows a MANAGER on an admin-only page", () => {
  const user = requireRoleCore({ user: makeUser("MANAGER") }, ["ADMIN", "MANAGER"]);
  assert.equal(user.role, "MANAGER");
});

test("requireRoleCore denies a COMMERCIAL on an admin-only page", () => {
  assert.throws(
    () => requireRoleCore({ user: makeUser("COMMERCIAL") }, ["ADMIN", "MANAGER"]),
    hasCode("ACCESS_DENIED"),
  );
});

test("requireRoleCore redirects (throws UNAUTHENTICATED, not ACCESS_DENIED) for an anonymous visitor", () => {
  assert.throws(
    () => requireRoleCore(null, ["ADMIN", "MANAGER"]),
    hasCode("UNAUTHENTICATED"),
  );
});

test("requireRoleCore strictly checks a single role for requireCommercial-style helpers", () => {
  assert.throws(
    () => requireRoleCore({ user: makeUser("ADMIN") }, ["COMMERCIAL"]),
    hasCode("ACCESS_DENIED"),
  );

  const user = requireRoleCore({ user: makeUser("COMMERCIAL") }, ["COMMERCIAL"]);
  assert.equal(user.role, "COMMERCIAL");
});

test("assertCanChangePasswordCore allows an ADMIN to change another user's password", () => {
  assert.doesNotThrow(() =>
    assertCanChangePasswordCore(makeUser("ADMIN"), "other-user"),
  );
});

test("assertCanChangePasswordCore denies a MANAGER changing another user's password", () => {
  assert.throws(
    () => assertCanChangePasswordCore(makeUser("MANAGER"), "other-user"),
    hasCode("ACCESS_DENIED"),
  );
});

test("assertCanChangePasswordCore allows any authenticated user to change their own password", () => {
  const user = makeUser("COMMERCIAL");
  assert.doesNotThrow(() => assertCanChangePasswordCore(user, user.id));
});

test("assertCanChangePasswordCore denies a COMMERCIAL changing another user's password", () => {
  assert.throws(
    () => assertCanChangePasswordCore(makeUser("COMMERCIAL"), "other-user"),
    hasCode("ACCESS_DENIED"),
  );
});

test("requireRoleCore allows ADMIN, MANAGER, and COMMERCIAL for the shared feed's role allow-list (Ticket 18A)", () => {
  for (const role of SHARED_FEED_ROLES) {
    const user = requireRoleCore({ user: makeUser(role) }, SHARED_FEED_ROLES);
    assert.equal(user.role, role);
  }
});

test("requireRoleCore denies an anonymous visitor to the shared feed", () => {
  assert.throws(
    () => requireRoleCore(null, SHARED_FEED_ROLES),
    hasCode("UNAUTHENTICATED"),
  );
});

test("requireRoleCore allows ADMIN and MANAGER for management-wide daily report reading (Ticket 19A)", () => {
  for (const role of DAILY_REPORT_MANAGEMENT_ROLES) {
    const user = requireRoleCore(
      { user: makeUser(role) },
      DAILY_REPORT_MANAGEMENT_ROLES,
    );
    assert.equal(user.role, role);
  }
});

test("requireRoleCore denies COMMERCIAL management-wide daily report reading, even with a report template assigned (Ticket 19A)", () => {
  assert.throws(
    () =>
      requireRoleCore({ user: makeUser("COMMERCIAL") }, DAILY_REPORT_MANAGEMENT_ROLES),
    hasCode("ACCESS_DENIED"),
  );
});

test("requireRoleCore allows ADMIN and MANAGER to manage Commercial performance targets (Ticket 25H.2A)", () => {
  for (const role of COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES) {
    const user = requireRoleCore(
      { user: makeUser(role) },
      COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES,
    );
    assert.equal(user.role, role);
  }
});

test("requireRoleCore denies COMMERCIAL managing performance targets — employees must not set their own targets (Ticket 25H.2A §9)", () => {
  assert.throws(
    () =>
      requireRoleCore(
        { user: makeUser("COMMERCIAL") },
        COMMERCIAL_PERFORMANCE_TARGET_MANAGEMENT_ROLES,
      ),
    hasCode("ACCESS_DENIED"),
  );
});

test("requireRoleCore allows ADMIN and MANAGER through the coarse prospect-reassignment gate (Ticket 28B), organization-wide with no team-scoping", () => {
  for (const role of PROSPECT_REASSIGNMENT_ROLES) {
    const user = requireRoleCore({ user: makeUser(role) }, PROSPECT_REASSIGNMENT_ROLES);
    assert.equal(user.role, role);
  }
});

test("requireRoleCore denies COMMERCIAL and ASSISTANT reassigning a prospect — this coarse gate is not the only safety net; reassignProspectCore re-resolves the actor fresh from the database independently", () => {
  for (const role of ["COMMERCIAL", "ASSISTANT"] as UserRole[]) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, PROSPECT_REASSIGNMENT_ROLES),
      hasCode("ACCESS_DENIED"),
    );
  }
});

test("requireRoleCore allows ADMIN and MANAGER through the coarse Role Responsibility assessment gate (Ticket 25I)", () => {
  for (const role of ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES) {
    const user = requireRoleCore(
      { user: makeUser(role) },
      ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES,
    );
    assert.equal(user.role, role);
  }
});

test("requireRoleCore denies COMMERCIAL the Role Responsibility assessment gate outright — the finer per-employee rule never even runs for them (Ticket 25I §21)", () => {
  assert.throws(
    () =>
      requireRoleCore(
        { user: makeUser("COMMERCIAL") },
        ROLE_RESPONSIBILITY_ASSESSMENT_MANAGEMENT_ROLES,
      ),
    hasCode("ACCESS_DENIED"),
  );
});

test("requireRoleCore allows ADMIN and MANAGER through the coarse Professional Contribution assessment gate (Ticket 25J)", () => {
  for (const role of PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES) {
    const user = requireRoleCore(
      { user: makeUser(role) },
      PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES,
    );
    assert.equal(user.role, role);
  }
});

test("requireRoleCore denies COMMERCIAL the Professional Contribution assessment gate outright — no self-assessment path (Ticket 25J §39)", () => {
  assert.throws(
    () =>
      requireRoleCore(
        { user: makeUser("COMMERCIAL") },
        PROFESSIONAL_CONTRIBUTION_ASSESSMENT_MANAGEMENT_ROLES,
      ),
    hasCode("ACCESS_DENIED"),
  );
});

test("requireRoleCore allows ADMIN and MANAGER through the coarse performance dashboard gate (Ticket 25K)", () => {
  for (const role of PERFORMANCE_DASHBOARD_ACCESS_ROLES) {
    const user = requireRoleCore(
      { user: makeUser(role) },
      PERFORMANCE_DASHBOARD_ACCESS_ROLES,
    );
    assert.equal(user.role, role);
  }
});

test("requireRoleCore denies COMMERCIAL the performance dashboard gate outright (Ticket 25K §34)", () => {
  assert.throws(
    () =>
      requireRoleCore(
        { user: makeUser("COMMERCIAL") },
        PERFORMANCE_DASHBOARD_ACCESS_ROLES,
      ),
    hasCode("ACCESS_DENIED"),
  );
});

/**
 * Ticket 25N §5/§37 — one of the most important safety tests in this
 * ticket: granting ASSISTANT the Finance capability must never widen
 * requireAdmin() itself. requireAdmin() wraps requireRole("ADMIN") — a
 * literal single-role list untouched by 25N — so ADMIN still succeeds
 * and every other role, including ASSISTANT, is still denied exactly as
 * before. This is a direct regression on the real `["ADMIN"]` shape used
 * throughout the codebase for genuine administrative boundaries (user
 * management, targets, etc.), not a simulation.
 */
test("Ticket 25N §5/§37: requireRoleCore against the real ADMIN-only shape still allows only ADMIN — ASSISTANT's new Finance capability never widened it", () => {
  const user = requireRoleCore({ user: makeUser("ADMIN") }, ["ADMIN"]);
  assert.equal(user.role, "ADMIN");

  for (const role of ["MANAGER", "COMMERCIAL", "ASSISTANT"] as const) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, ["ADMIN"]),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to still be denied genuine ADMIN-only access`,
    );
  }
});

/**
 * Ticket 25N §2/§38 — the actual Finance capability: a positive
 * allow-list, ADMIN + ASSISTANT, tested against all four roles (no
 * partial enumeration).
 */
test("Ticket 25N §38: requireRoleCore against FINANCE_ACCESS_ROLES allows ADMIN and ASSISTANT, denies MANAGER and COMMERCIAL", () => {
  for (const role of ["ADMIN", "ASSISTANT"] as const) {
    const user = requireRoleCore({ user: makeUser(role) }, FINANCE_ACCESS_ROLES);
    assert.equal(user.role, role);
  }

  for (const role of ["MANAGER", "COMMERCIAL"] as const) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, FINANCE_ACCESS_ROLES),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to be denied Finance access`,
    );
  }
});

test("Ticket 25N §46: an anonymous visitor is denied Finance access with UNAUTHENTICATED, not ACCESS_DENIED", () => {
  assert.throws(
    () => requireRoleCore(null, FINANCE_ACCESS_ROLES),
    hasCode("UNAUTHENTICATED"),
  );
});

/**
 * Ticket 25R §5-8/§47: the new /admin shell capability. ADMIN and MANAGER
 * keep their pre-existing dashboard access exactly as before; ASSISTANT
 * is newly admitted; COMMERCIAL remains denied — this route was never
 * COMMERCIAL's, and 25R does not change that (COMMERCIAL has its own
 * /dashboard/commercial instead).
 */
test("Ticket 25R §5-8/§47: requireRoleCore against DASHBOARD_ACCESS_ROLES allows ADMIN, MANAGER, and ASSISTANT; denies COMMERCIAL", () => {
  for (const role of ["ADMIN", "MANAGER", "ASSISTANT"] as const) {
    const user = requireRoleCore({ user: makeUser(role) }, DASHBOARD_ACCESS_ROLES);
    assert.equal(user.role, role);
  }

  assert.throws(
    () => requireRoleCore({ user: makeUser("COMMERCIAL") }, DASHBOARD_ACCESS_ROLES),
    hasCode("ACCESS_DENIED"),
  );
});

test("Ticket 25R §30/§55: ASSISTANT is in DASHBOARD_ACCESS_ROLES but not a Results or Execution Discipline performance subject — dashboard-shell access grants no performance eligibility, and ADMIN is exempt from both for the same reason it never gets a fabricated dashboard-driven score", () => {
  assert.ok(DASHBOARD_ACCESS_ROLES.includes("ASSISTANT"));
  assert.equal(isScorableForCommercialResults("ASSISTANT"), false);
  assert.equal(isScorableForExecutionDiscipline("ASSISTANT"), false);

  assert.ok(DASHBOARD_ACCESS_ROLES.includes("ADMIN"));
  assert.equal(isScorableForCommercialResults("ADMIN"), false);
  assert.equal(isScorableForExecutionDiscipline("ADMIN"), false);
});

test("Ticket 25R §8: requireRoleCore against the real ADMIN-only shape still allows only ADMIN — the new dashboard-shell capability never widened it, exactly like Finance in 25N", () => {
  const user = requireRoleCore({ user: makeUser("ADMIN") }, ["ADMIN"]);
  assert.equal(user.role, "ADMIN");

  for (const role of ["MANAGER", "COMMERCIAL", "ASSISTANT"] as const) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, ["ADMIN"]),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to still be denied genuine ADMIN-only access`,
    );
  }
});

/**
 * Ticket 25R §10/§12: closing the gap the dashboard-shell widening
 * opened — /admin/follow-ups had no authorization call of its own before
 * this ticket. Its new boundary keeps ASSISTANT and COMMERCIAL out,
 * exactly as the inherited shell gate did before it admitted ASSISTANT.
 */
test("Ticket 25R §10/§12: requireRoleCore against FOLLOW_UP_QUEUE_MANAGEMENT_ROLES allows ADMIN and MANAGER, denies COMMERCIAL and ASSISTANT", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) {
    const user = requireRoleCore(
      { user: makeUser(role) },
      FOLLOW_UP_QUEUE_MANAGEMENT_ROLES,
    );
    assert.equal(user.role, role);
  }

  for (const role of ["COMMERCIAL", "ASSISTANT"] as const) {
    assert.throws(
      () =>
        requireRoleCore({ user: makeUser(role) }, FOLLOW_UP_QUEUE_MANAGEMENT_ROLES),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to be denied the follow-up queue`,
    );
  }
});

/**
 * Ticket 26B §61-63: OrganizationMembership now exists (schema-level), but
 * must not yet participate in authorization. AuthenticatedUser (the shape
 * requireRoleCore actually reads) structurally carries no membership field
 * at all — only `role`, sourced from User.role. This fixture documents the
 * intentionally inconsistent transitional case the ticket calls out: even
 * if a RELAIS membership row for this same user id diverged from
 * User.role, requireRoleCore has no way to see it, so User.role alone
 * keeps deciding authority in both directions.
 */
test("Ticket 26B: requireRoleCore authorizes from User.role alone — a diverging (hypothetical) membership role cannot grant access it wouldn't otherwise have", () => {
  // Membership.role = ADMIN, User.role = COMMERCIAL, in this scenario.
  const user = makeUser("COMMERCIAL");

  assert.throws(
    () => requireRoleCore({ user }, ["ADMIN"]),
    hasCode("ACCESS_DENIED"),
  );
});

test("Ticket 26B: requireRoleCore authorizes from User.role alone — a diverging (hypothetical) membership role cannot revoke access User.role still grants", () => {
  // Membership.role = COMMERCIAL, User.role = ADMIN, in this scenario.
  const user = makeUser("ADMIN");

  const authorized = requireRoleCore({ user }, ["ADMIN"]);
  assert.equal(authorized.role, "ADMIN");
});

test("Ticket 27C: requireRoleCore against WORKDAY_ELIGIBLE_ROLES allows MANAGER, COMMERCIAL, and ASSISTANT, and denies ADMIN — ADMIN is management authority over other people's workdays, not a field worker with a workday of their own", () => {
  for (const role of ["MANAGER", "COMMERCIAL", "ASSISTANT"] as const) {
    const user = requireRoleCore({ user: makeUser(role) }, WORKDAY_ELIGIBLE_ROLES);
    assert.equal(user.role, role);
  }

  assert.throws(
    () => requireRoleCore({ user: makeUser("ADMIN") }, WORKDAY_ELIGIBLE_ROLES),
    hasCode("ACCESS_DENIED"),
  );
});

test("Ticket 27C: requireRoleCore against WORKDAY_CONFIRMATION_ROLES allows ADMIN and MANAGER, and denies COMMERCIAL and ASSISTANT", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) {
    const user = requireRoleCore(
      { user: makeUser(role) },
      WORKDAY_CONFIRMATION_ROLES,
    );
    assert.equal(user.role, role);
  }

  for (const role of ["COMMERCIAL", "ASSISTANT"] as const) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, WORKDAY_CONFIRMATION_ROLES),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to be denied workday-confirmation access`,
    );
  }
});

test("Ticket 27E: requireRoleCore against DAILY_TASK_RECIPIENT_ROLES allows MANAGER and COMMERCIAL, and denies ADMIN and ASSISTANT", () => {
  for (const role of ["MANAGER", "COMMERCIAL"] as const) {
    const user = requireRoleCore({ user: makeUser(role) }, DAILY_TASK_RECIPIENT_ROLES);
    assert.equal(user.role, role);
  }

  for (const role of ["ADMIN", "ASSISTANT"] as const) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, DAILY_TASK_RECIPIENT_ROLES),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to be denied daily-task recipient access`,
    );
  }
});

test("Ticket 27E: requireRoleCore against TASK_ASSIGNMENT_ROLES allows ADMIN and MANAGER, and denies COMMERCIAL and ASSISTANT", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) {
    const user = requireRoleCore({ user: makeUser(role) }, TASK_ASSIGNMENT_ROLES);
    assert.equal(user.role, role);
  }

  for (const role of ["COMMERCIAL", "ASSISTANT"] as const) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, TASK_ASSIGNMENT_ROLES),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to be denied task-assignment access`,
    );
  }
});

test("Ticket 27G: requireRoleCore against DAILY_WORK_MANAGEMENT_ROLES allows ADMIN and MANAGER, and denies COMMERCIAL and ASSISTANT", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) {
    const user = requireRoleCore({ user: makeUser(role) }, DAILY_WORK_MANAGEMENT_ROLES);
    assert.equal(user.role, role);
  }

  for (const role of ["COMMERCIAL", "ASSISTANT"] as const) {
    assert.throws(
      () => requireRoleCore({ user: makeUser(role) }, DAILY_WORK_MANAGEMENT_ROLES),
      hasCode("ACCESS_DENIED"),
      `expected ${role} to be denied daily-work management access`,
    );
  }
});

function hasCode(code: AuthorizationError["code"]) {
  return (error: unknown) =>
    error instanceof AuthorizationError && error.code === code;
}

function makeUser(role: UserRole): AuthenticatedUser {
  return {
    id: "user-1",
    firstName: "Awa",
    lastName: "Traoré",
    role,
  };
}
