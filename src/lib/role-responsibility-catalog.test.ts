import assert from "node:assert/strict";
import test from "node:test";

import {
  findRoleResponsibilityDefinition,
  getRoleResponsibilityCatalogForRole,
  isRoleSupportedForRoleResponsibilityAssessment,
  ROLE_RESPONSIBILITY_CATALOG,
  ROLE_RESPONSIBILITY_MAX_SCORE,
  isExtremeRoleResponsibilityLevel,
  roleResponsibilityAssessmentLevels,
} from "./role-responsibility-catalog";

test("every definition's anchors cover exactly the four levels, in order, with no duplicates or omissions", () => {
  for (const definition of ROLE_RESPONSIBILITY_CATALOG) {
    assert.deepEqual(
      definition.anchors.map((anchor) => anchor.level),
      roleResponsibilityAssessmentLevels,
      `${definition.key} anchor levels must exactly match roleResponsibilityAssessmentLevels in order`,
    );
  }
});

test("every definition's anchor points are strictly ascending, starting at 0 and ending at maxPoints", () => {
  for (const definition of ROLE_RESPONSIBILITY_CATALOG) {
    const points = definition.anchors.map((anchor) => anchor.points);

    assert.equal(points[0], 0, `${definition.key} NOT_MET must be worth 0 points`);
    assert.equal(
      points[points.length - 1],
      definition.maxPoints,
      `${definition.key} EXCEEDED must be worth exactly maxPoints`,
    );
    for (let i = 1; i < points.length; i += 1) {
      assert.ok(
        points[i] > points[i - 1],
        `${definition.key} anchor points must be strictly ascending (got ${points})`,
      );
    }
  }
});

test("no anchor text is empty — every level has a real behavioral description", () => {
  for (const definition of ROLE_RESPONSIBILITY_CATALOG) {
    for (const anchor of definition.anchors) {
      assert.ok(
        anchor.text.trim().length > 10,
        `${definition.key} ${anchor.level} anchor text is missing or too short`,
      );
    }
  }
});

test("each role's catalog sums to exactly ROLE_RESPONSIBILITY_MAX_SCORE (20)", () => {
  const roles = new Set(ROLE_RESPONSIBILITY_CATALOG.map((item) => item.role));

  for (const role of roles) {
    const total = getRoleResponsibilityCatalogForRole(role).reduce(
      (sum, item) => sum + item.maxPoints,
      0,
    );
    assert.equal(
      total,
      ROLE_RESPONSIBILITY_MAX_SCORE,
      `${role}'s catalog must sum to ${ROLE_RESPONSIBILITY_MAX_SCORE}, got ${total}`,
    );
  }
});

test("COMMERCIAL and MANAGER are supported; ADMIN is not (Ticket 25I audit verdict)", () => {
  assert.equal(isRoleSupportedForRoleResponsibilityAssessment("COMMERCIAL"), true);
  assert.equal(isRoleSupportedForRoleResponsibilityAssessment("MANAGER"), true);
  assert.equal(isRoleSupportedForRoleResponsibilityAssessment("ADMIN"), false);
  assert.deepEqual(getRoleResponsibilityCatalogForRole("ADMIN"), []);
});

test("Ticket 25M §26/§27/§28: ASSISTANT is unsupported by default — no catalog entry exists, and none is invented in 25M", () => {
  assert.equal(isRoleSupportedForRoleResponsibilityAssessment("ASSISTANT"), false);
  assert.deepEqual(getRoleResponsibilityCatalogForRole("ASSISTANT"), []);
});

test("responsibility keys are globally unique — no two definitions collide", () => {
  const keys = ROLE_RESPONSIBILITY_CATALOG.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("findRoleResponsibilityDefinition returns the exact match or undefined, never a fuzzy fallback", () => {
  const found = findRoleResponsibilityDefinition(
    "COMMERCIAL_PORTFOLIO_STEWARDSHIP",
  );
  assert.equal(found?.role, "COMMERCIAL");
  assert.equal(findRoleResponsibilityDefinition("NOT_A_REAL_KEY"), undefined);
});

test("isExtremeRoleResponsibilityLevel is true only for NOT_MET and EXCEEDED", () => {
  assert.equal(isExtremeRoleResponsibilityLevel("NOT_MET"), true);
  assert.equal(isExtremeRoleResponsibilityLevel("EXCEEDED"), true);
  assert.equal(isExtremeRoleResponsibilityLevel("PARTIALLY_MET"), false);
  assert.equal(isExtremeRoleResponsibilityLevel("MET"), false);
});
