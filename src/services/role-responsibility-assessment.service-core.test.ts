import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import { getRoleResponsibilityCatalogForRole } from "@/src/lib/role-responsibility-catalog";
import {
  assessRoleResponsibilityItemCore,
  canAssessRoleResponsibilities,
  createRoleResponsibilityAssessmentCore,
  deleteRoleResponsibilityAssessmentCore,
  submitRoleResponsibilityAssessmentCore,
  type CreateRoleResponsibilityAssessmentDependencies,
  type CreateRoleResponsibilityAssessmentFields,
  type RoleResponsibilityAssessmentActor,
  type RoleResponsibilityAssessmentEmployeeRecord,
  type RoleResponsibilityAssessmentItemRow,
} from "./role-responsibility-assessment.service-core";

const CLOSED_PERIOD = {
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodEnd: new Date("2026-08-31T23:59:59.999Z"),
};
const NOW_AFTER_AUGUST = new Date("2026-09-05T00:00:00.000Z");
const NOW_MID_AUGUST = new Date("2026-08-15T00:00:00.000Z");

function actor(id: string, role: UserRole): RoleResponsibilityAssessmentActor {
  return { id, role };
}

function employee(
  overrides: Partial<RoleResponsibilityAssessmentEmployeeRecord> = {},
): RoleResponsibilityAssessmentEmployeeRecord {
  return { id: "employee-1", role: "COMMERCIAL", active: true, ...overrides };
}

function createDeps(overrides: {
  findEmployee?: () => Promise<RoleResponsibilityAssessmentEmployeeRecord | null>;
  findExisting?: () => Promise<{ id: string } | null>;
  create?: (
    fields: CreateRoleResponsibilityAssessmentFields,
  ) => Promise<{ id: string }>;
} = {}): CreateRoleResponsibilityAssessmentDependencies {
  return {
    findEmployee: overrides.findEmployee ?? (async () => employee()),
    findExisting: overrides.findExisting ?? (async () => null),
    create: overrides.create ?? (async () => ({ id: "assessment-1" })),
  };
}

// ---------------------------------------------------------------------------
// §66: double-counting boundary — structural guarantee
// ---------------------------------------------------------------------------

test("§66: the core file never imports Execution Discipline's or Results' scoring functions — only the shared period type", () => {
  const source = readFileSync(
    "src/services/role-responsibility-assessment.service-core.ts",
    "utf8",
  );
  assert.doesNotMatch(source, /computeExecutionDisciplineScore/);
  assert.doesNotMatch(source, /computeCommercialResultsScore/);
  assert.doesNotMatch(source, /collectCommercialResultsEvidence/);
  assert.match(source, /ExecutionDisciplinePeriod/); // the period type only
});

// ---------------------------------------------------------------------------
// §67: authorization matrix (narrowed to ADMIN-only by Ticket 25O)
// ---------------------------------------------------------------------------

test("§67/§21: nobody can assess themselves, regardless of role", () => {
  for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
    assert.equal(
      canAssessRoleResponsibilities(actor("same-id", role), role, "same-id"),
      false,
    );
  }
});

test("§67: a COMMERCIAL can never assess anyone", () => {
  assert.equal(
    canAssessRoleResponsibilities(
      actor("commercial-a", "COMMERCIAL"),
      "COMMERCIAL",
      "commercial-b",
    ),
    false,
  );
  assert.equal(
    canAssessRoleResponsibilities(
      actor("commercial-a", "COMMERCIAL"),
      "MANAGER",
      "manager-b",
    ),
    false,
  );
});

test("Ticket 25O §4/§44: only ADMIN may assess a COMMERCIAL — MANAGER lost this authority (was previously allowed alongside ADMIN)", () => {
  assert.equal(
    canAssessRoleResponsibilities(
      actor("admin-1", "ADMIN"),
      "COMMERCIAL",
      "commercial-b",
    ),
    true,
  );
  assert.equal(
    canAssessRoleResponsibilities(
      actor("manager-a", "MANAGER"),
      "COMMERCIAL",
      "commercial-b",
    ),
    false,
  );
});

test("§67/§20: only ADMIN may assess a MANAGER — a peer MANAGER may not", () => {
  assert.equal(
    canAssessRoleResponsibilities(
      actor("admin-1", "ADMIN"),
      "MANAGER",
      "manager-b",
    ),
    true,
  );
  assert.equal(
    canAssessRoleResponsibilities(
      actor("manager-a", "MANAGER"),
      "MANAGER",
      "manager-b",
    ),
    false,
  );
});

test("§67/§6/§20: nobody may assess an ADMIN — no supported evaluator path exists in V1", () => {
  for (const assessorRole of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
    assert.equal(
      canAssessRoleResponsibilities(
        actor("assessor-1", assessorRole),
        "ADMIN",
        "admin-b",
      ),
      false,
    );
  }
});

test("Ticket 25O §44: the complete evaluator authorization matrix — ADMIN may assess any supported subject; MANAGER, COMMERCIAL, and ASSISTANT may assess nobody, for any subject role", () => {
  for (const employeeRole of ["COMMERCIAL", "MANAGER"] as const) {
    assert.equal(
      canAssessRoleResponsibilities(
        actor("admin-1", "ADMIN"),
        employeeRole,
        `${employeeRole}-target`,
      ),
      true,
      `ADMIN should be able to assess a supported ${employeeRole}`,
    );

    for (const assessorRole of ["MANAGER", "COMMERCIAL", "ASSISTANT"] as const) {
      assert.equal(
        canAssessRoleResponsibilities(
          actor("assessor-1", assessorRole),
          employeeRole,
          `${employeeRole}-target`,
        ),
        false,
        `${assessorRole} should never be able to assess a ${employeeRole}`,
      );
    }
  }

  for (const unsupportedTargetRole of ["ADMIN", "ASSISTANT"] as const) {
    for (const assessorRole of ["ADMIN", "MANAGER", "COMMERCIAL", "ASSISTANT"] as const) {
      assert.equal(
        canAssessRoleResponsibilities(
          actor("assessor-1", assessorRole),
          unsupportedTargetRole,
          `${unsupportedTargetRole}-target`,
        ),
        false,
        `${assessorRole} should never be able to assess an unsupported ${unsupportedTargetRole} subject`,
      );
    }
  }
});

test("Ticket 25M §28/§44: an ASSISTANT can never assess anyone — adding the enum value did not accidentally make Assistant an evaluator", () => {
  assert.equal(
    canAssessRoleResponsibilities(
      actor("assistant-a", "ASSISTANT"),
      "COMMERCIAL",
      "commercial-b",
    ),
    false,
  );
  assert.equal(
    canAssessRoleResponsibilities(
      actor("assistant-a", "ASSISTANT"),
      "MANAGER",
      "manager-b",
    ),
    false,
  );
});

test("Ticket 25M §28: nobody may assess an ASSISTANT either — no Role Responsibility catalog or evaluator path exists for this role in 25M", () => {
  for (const assessorRole of ["ADMIN", "MANAGER", "COMMERCIAL", "ASSISTANT"] as const) {
    assert.equal(
      canAssessRoleResponsibilities(
        actor("assessor-1", assessorRole),
        "ASSISTANT",
        "assistant-b",
      ),
      false,
    );
  }
});

// ---------------------------------------------------------------------------
// §68: role catalog boundaries
// ---------------------------------------------------------------------------

test("§68: creating an assessment for a COMMERCIAL employee succeeds and snapshots the Commercial catalog", async () => {
  const result = await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => employee({ id: "commercial-a", role: "COMMERCIAL" }) }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(result.success, true);
});

test("§68: creating an assessment for an ADMIN employee is rejected — ADMIN has no supported catalog", async () => {
  const result = await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "admin-2", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => employee({ id: "admin-2", role: "ADMIN" }) }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ROLE_NOT_SUPPORTED");
});

test("§68: a MANAGER employee's snapshotted catalog never includes Commercial responsibility keys, and vice versa", async () => {
  const commercialKeys = getRoleResponsibilityCatalogForRole("COMMERCIAL").map(
    (item) => item.key,
  );
  const managerKeys = getRoleResponsibilityCatalogForRole("MANAGER").map(
    (item) => item.key,
  );

  assert.equal(
    commercialKeys.some((key) => managerKeys.includes(key)),
    false,
    "Commercial and Manager catalogs must not share responsibility keys",
  );
});

// ---------------------------------------------------------------------------
// §69: snapshot fidelity at creation
// ---------------------------------------------------------------------------

test("§69/§24: the items handed to the create dependency are a faithful, complete copy of the catalog at that moment", async () => {
  let capturedItems: CreateRoleResponsibilityAssessmentFields["items"] = [];

  await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({
      findEmployee: async () => employee({ id: "commercial-a", role: "COMMERCIAL" }),
      create: async (fields) => {
        capturedItems = fields.items;
        return { id: "assessment-1" };
      },
    }),
    NOW_AFTER_AUGUST,
  );

  const catalog = getRoleResponsibilityCatalogForRole("COMMERCIAL");
  assert.equal(capturedItems.length, catalog.length);
  for (const [index, definition] of catalog.entries()) {
    assert.equal(capturedItems[index].responsibilityKey, definition.key);
    assert.equal(capturedItems[index].labelAtEvaluation, definition.label);
    assert.equal(
      capturedItems[index].descriptionAtEvaluation,
      definition.description,
    );
    assert.equal(capturedItems[index].maxPoints, definition.maxPoints);
    assert.deepEqual(capturedItems[index].anchorsSnapshot, definition.anchors);
  }
});

// ---------------------------------------------------------------------------
// §77: period closure at creation
// ---------------------------------------------------------------------------

test("§77: creation is rejected for a period that has not yet closed", async () => {
  const result = await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => employee({ id: "commercial-a" }) }),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "PERIOD_NOT_CLOSED");
});

test("creation succeeds once the period has closed", async () => {
  const result = await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => employee({ id: "commercial-a" }) }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(result.success, true);
});

test("duplicate period for the same employee is rejected (service-level; DB unique constraint verified separately by the migration test)", async () => {
  const result = await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({
      findEmployee: async () => employee({ id: "commercial-a" }),
      findExisting: async () => ({ id: "existing" }),
    }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "DUPLICATE_PERIOD");
});

test("an inactive or unknown employee is rejected", async () => {
  const missing = await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "ghost", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => null }),
    NOW_AFTER_AUGUST,
  );
  const inactive = await createRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => employee({ active: false }) }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(missing.success, false);
  if (!missing.success) assert.equal(missing.code, "EMPLOYEE_NOT_FOUND");
  assert.equal(inactive.success, false);
  if (!inactive.success) assert.equal(inactive.code, "EMPLOYEE_NOT_FOUND");
});

test("access is denied when the actor is not authorized to assess this employee's role", async () => {
  const managerAssessingManager = await createRoleResponsibilityAssessmentCore(
    actor("manager-a", "MANAGER"),
    { employeeId: "manager-b", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => employee({ id: "manager-b", role: "MANAGER" }) }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(managerAssessingManager.success, false);
  if (!managerAssessingManager.success) {
    assert.equal(managerAssessingManager.code, "ACCESS_DENIED");
  }
});

// ---------------------------------------------------------------------------
// Item assessment — helpers
// ---------------------------------------------------------------------------

function itemRow(
  overrides: Partial<RoleResponsibilityAssessmentItemRow> = {},
): RoleResponsibilityAssessmentItemRow {
  const catalogItem = getRoleResponsibilityCatalogForRole("COMMERCIAL")[0];
  return {
    id: "item-1",
    assessmentId: "assessment-1",
    responsibilityKey: catalogItem.key,
    anchorsSnapshot: catalogItem.anchors,
    ...overrides,
  };
}

function draftAssessment(overrides: { evaluatorUserId?: string } = {}) {
  return {
    id: "assessment-1",
    status: "DRAFT" as const,
    evaluatorUserId: overrides.evaluatorUserId ?? "evaluator-1",
  };
}

// ---------------------------------------------------------------------------
// §70: extreme-level observation requirement
// ---------------------------------------------------------------------------

test("§70/§35: NOT_MET and EXCEEDED require a non-empty observation", async () => {
  for (const level of ["NOT_MET", "EXCEEDED"] as const) {
    const rejected = await assessRoleResponsibilityItemCore(
      actor("evaluator-1", "ADMIN"),
      "assessment-1",
      "item-1",
      level,
      null,
      {
        findAssessment: async () => draftAssessment(),
        findItem: async () => itemRow(),
        update: async () => {
          assert.fail("update must not be called without a required observation");
        },
      },
    );

    assert.equal(rejected.success, false);
    if (!rejected.success) assert.equal(rejected.code, "OBSERVATION_REQUIRED");

    const accepted = await assessRoleResponsibilityItemCore(
      actor("evaluator-1", "ADMIN"),
      "assessment-1",
      "item-1",
      level,
      "Observation concrète justifiant ce niveau.",
      {
        findAssessment: async () => draftAssessment(),
        findItem: async () => itemRow(),
        update: async () => {},
      },
    );
    assert.equal(accepted.success, true);
  }
});

test("§70: PARTIALLY_MET and MET do not require an observation", async () => {
  for (const level of ["PARTIALLY_MET", "MET"] as const) {
    const result = await assessRoleResponsibilityItemCore(
      actor("evaluator-1", "ADMIN"),
      "assessment-1",
      "item-1",
      level,
      null,
      {
        findAssessment: async () => draftAssessment(),
        findItem: async () => itemRow(),
        update: async () => {},
      },
    );
    assert.equal(result.success, true);
  }
});

test("awardedPoints is computed from the item's own frozen anchorsSnapshot, never from the live catalog", async () => {
  const result = await assessRoleResponsibilityItemCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => draftAssessment(),
      findItem: async () => itemRow(),
      update: async () => {},
    },
  );

  assert.equal(result.success, true);
  if (result.success) {
    const catalogItem = getRoleResponsibilityCatalogForRole("COMMERCIAL")[0];
    const metAnchor = catalogItem.anchors.find((a) => a.level === "MET");
    assert.equal(result.awardedPoints, metAnchor?.points);
  }
});

test("only the assessment's own evaluator may assess its items", async () => {
  const result = await assessRoleResponsibilityItemCore(
    actor("someone-else", "ADMIN"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => draftAssessment({ evaluatorUserId: "evaluator-1" }),
      findItem: async () => itemRow(),
      update: async () => {
        assert.fail("update must not be called for a non-evaluator actor");
      },
    },
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ACCESS_DENIED");
});

// ---------------------------------------------------------------------------
// §74: submitted immutability — item assessment
// ---------------------------------------------------------------------------

test("§74: a SUBMITTED assessment's items can no longer be reassessed", async () => {
  const result = await assessRoleResponsibilityItemCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => ({
        id: "assessment-1",
        status: "SUBMITTED",
        evaluatorUserId: "evaluator-1",
      }),
      findItem: async () => itemRow(),
      update: async () => {
        assert.fail("update must not be called on a submitted assessment");
      },
    },
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ASSESSMENT_LOCKED");
});

// ---------------------------------------------------------------------------
// §71/§73: submission — unassessed items block, score is a deterministic integer
// ---------------------------------------------------------------------------

test("§71: submission is rejected while any item remains UNASSESSED", async () => {
  const result = await submitRoleResponsibilityAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "evaluator-1",
        items: [
          { id: "item-1", awardedPoints: 17 },
          { id: "item-2", awardedPoints: null },
        ],
      }),
      submit: async () => {
        assert.fail("submit must not be called with an unassessed item");
      },
    },
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "UNASSESSED_ITEMS");
});

test("§73: the submitted score is the exact integer sum of awardedPoints — deterministic, no rounding involved", async () => {
  const result = await submitRoleResponsibilityAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "evaluator-1",
        items: [{ id: "item-1", awardedPoints: 17 }],
      }),
      submit: async (id, score) => {
        assert.equal(id, "assessment-1");
        assert.equal(score, 17);
      },
    },
  );

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.score, 17);
});

test("the Commercial catalog's MET response scores 17/20 and EXCEEDED scores exactly 20/20", () => {
  const catalogItem = getRoleResponsibilityCatalogForRole("COMMERCIAL")[0];
  const met = catalogItem.anchors.find((a) => a.level === "MET");
  const exceeded = catalogItem.anchors.find((a) => a.level === "EXCEEDED");

  assert.equal(met?.points, 17);
  assert.equal(exceeded?.points, 20);
});

// ---------------------------------------------------------------------------
// §74: submitted immutability — submit and delete
// ---------------------------------------------------------------------------

test("§74: submitting an already-SUBMITTED assessment is rejected", async () => {
  const result = await submitRoleResponsibilityAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "SUBMITTED",
        evaluatorUserId: "evaluator-1",
        items: [{ id: "item-1", awardedPoints: 17 }],
      }),
      submit: async () => {
        assert.fail("submit must not be called twice");
      },
    },
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ASSESSMENT_LOCKED");
});

test("§74: deleting a SUBMITTED assessment is rejected; a DRAFT may be deleted by its evaluator", async () => {
  const submittedDelete = await deleteRoleResponsibilityAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessment: async () => ({
        id: "assessment-1",
        status: "SUBMITTED",
        evaluatorUserId: "evaluator-1",
      }),
      delete: async () => {
        assert.fail("delete must not be called on a submitted assessment");
      },
    },
  );
  const draftDelete = await deleteRoleResponsibilityAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessment: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "evaluator-1",
      }),
      delete: async () => {},
    },
  );

  assert.equal(submittedDelete.success, false);
  if (!submittedDelete.success) assert.equal(submittedDelete.code, "ASSESSMENT_LOCKED");
  assert.equal(draftDelete.success, true);
});

// ---------------------------------------------------------------------------
// §72: N/A is not implemented in V1 — a deliberate, documented scope decision
// ---------------------------------------------------------------------------

test("§72/§14/§15: no N/A concept exists on the item — only UNASSESSED (null level) or one of the four defined levels", () => {
  // Structural guarantee: RoleResponsibilityAssessmentLevel (schema enum)
  // has exactly four values, none of them "N/A" — confirmed already by
  // the migration test's exact-enum-value assertion. This test locks the
  // *reason* in the same file the behavior lives in: the audited catalog
  // has exactly one responsibility per supported role, so there is no
  // partial-applicability scenario to normalize (see the catalog file's
  // own audit-verdict comment).
  const commercialCatalog = getRoleResponsibilityCatalogForRole("COMMERCIAL");
  const managerCatalog = getRoleResponsibilityCatalogForRole("MANAGER");
  assert.equal(commercialCatalog.length, 1);
  assert.equal(managerCatalog.length, 1);
});

// ---------------------------------------------------------------------------
// §75/§76: role-at-evaluation and evaluator-role-at-event stay frozen —
// structural guarantee, not a live re-check
// ---------------------------------------------------------------------------

test("§75/§76: assessing, submitting, and deleting never re-fetch the employee — Ticket 25O's actor.role re-check (§7) uses the already-passed actor parameter, not a new lookup", () => {
  const source = readFileSync(
    "src/services/role-responsibility-assessment.service-core.ts",
    "utf8",
  );
  const afterCreate = source.slice(source.indexOf("// Assess one item"));

  assert.doesNotMatch(afterCreate, /findEmployee/);
  assert.doesNotMatch(afterCreate, /\.role\s*!==\s*"COMMERCIAL"/);
});

// ---------------------------------------------------------------------------
// Ticket 25O §46-51: mutation-layer role re-check — closing the 25L gap
// ---------------------------------------------------------------------------

test("Ticket 25O §46: a legacy MANAGER-owned DRAFT can no longer be edited or submitted by that same MANAGER — this is the most important regression in 25O", async () => {
  const legacyManagerDraft = draftAssessment({ evaluatorUserId: "manager-1" });

  const assessResult = await assessRoleResponsibilityItemCore(
    actor("manager-1", "MANAGER"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => legacyManagerDraft,
      findItem: async () => itemRow(),
      update: async () => {
        assert.fail("update must not be called for a MANAGER, even the recorded evaluator");
      },
    },
  );
  assert.equal(assessResult.success, false);
  if (!assessResult.success) assert.equal(assessResult.code, "ACCESS_DENIED");

  const submitResult = await submitRoleResponsibilityAssessmentCore(
    actor("manager-1", "MANAGER"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "manager-1",
        items: [{ id: "item-1", awardedPoints: 17 }],
      }),
      submit: async () => {
        assert.fail("submit must not be called for a MANAGER, even the recorded evaluator");
      },
    },
  );
  assert.equal(submitResult.success, false);
  if (!submitResult.success) assert.equal(submitResult.code, "ACCESS_DENIED");
});

test("Ticket 25O §47: an ADMIN who is not the recorded evaluator may not edit or submit someone else's draft — mutating it would silently transfer authorship", async () => {
  const otherEvaluatorsDraft = draftAssessment({ evaluatorUserId: "manager-1" });

  const assessResult = await assessRoleResponsibilityItemCore(
    actor("admin-2", "ADMIN"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => otherEvaluatorsDraft,
      findItem: async () => itemRow(),
      update: async () => {
        assert.fail("update must not be called for a non-recorded-evaluator ADMIN");
      },
    },
  );
  assert.equal(assessResult.success, false);
  if (!assessResult.success) assert.equal(assessResult.code, "ACCESS_DENIED");

  const submitResult = await submitRoleResponsibilityAssessmentCore(
    actor("admin-2", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "manager-1",
        items: [{ id: "item-1", awardedPoints: 17 }],
      }),
      submit: async () => {
        assert.fail("submit must not be called for a non-recorded-evaluator ADMIN");
      },
    },
  );
  assert.equal(submitResult.success, false);
  if (!submitResult.success) assert.equal(submitResult.code, "ACCESS_DENIED");
});

test("Ticket 25O §48: delete is deliberately NOT ownership-gated — an ADMIN may clean up a stranded MANAGER-owned DRAFT, but the MANAGER themself may not delete it, and nobody may delete a SUBMITTED assessment", async () => {
  const adminCleanup = await deleteRoleResponsibilityAssessmentCore(
    actor("admin-2", "ADMIN"),
    "assessment-1",
    {
      findAssessment: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "manager-1",
      }),
      delete: async () => {},
    },
  );
  assert.equal(adminCleanup.success, true);

  const managerSelfDelete = await deleteRoleResponsibilityAssessmentCore(
    actor("manager-1", "MANAGER"),
    "assessment-1",
    {
      findAssessment: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "manager-1",
      }),
      delete: async () => {
        assert.fail("delete must not be called for a MANAGER, even the recorded evaluator");
      },
    },
  );
  assert.equal(managerSelfDelete.success, false);
  if (!managerSelfDelete.success) assert.equal(managerSelfDelete.code, "ACCESS_DENIED");

  const submittedDelete = await deleteRoleResponsibilityAssessmentCore(
    actor("admin-2", "ADMIN"),
    "assessment-1",
    {
      findAssessment: async () => ({
        id: "assessment-1",
        status: "SUBMITTED",
        evaluatorUserId: "manager-1",
      }),
      delete: async () => {
        assert.fail("delete must not be called on a SUBMITTED assessment, regardless of actor");
      },
    },
  );
  assert.equal(submittedDelete.success, false);
  if (!submittedDelete.success) assert.equal(submittedDelete.code, "ASSESSMENT_LOCKED");
});

test("Ticket 25O §49: an ADMIN-owned DRAFT's own recorded evaluator can still assess an item and submit — the happy path is unaffected by the narrowing", async () => {
  const ownDraft = draftAssessment({ evaluatorUserId: "admin-1" });

  const assessResult = await assessRoleResponsibilityItemCore(
    actor("admin-1", "ADMIN"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => ownDraft,
      findItem: async () => itemRow(),
      update: async () => {},
    },
  );
  assert.equal(assessResult.success, true);

  const submitResult = await submitRoleResponsibilityAssessmentCore(
    actor("admin-1", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "admin-1",
        items: [{ id: "item-1", awardedPoints: 17 }],
      }),
      submit: async () => {},
    },
  );
  assert.equal(submitResult.success, true);
});

test("Ticket 25O §50: a different ADMIN than the recorded evaluator may delete an abandoned Admin-authored DRAFT (cleanup policy), even though they may not edit or submit it", async () => {
  const adminADraft = draftAssessment({ evaluatorUserId: "admin-a" });

  const editByAdminB = await assessRoleResponsibilityItemCore(
    actor("admin-b", "ADMIN"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => adminADraft,
      findItem: async () => itemRow(),
      update: async () => {
        assert.fail("update must not be called for a different ADMIN than the recorded evaluator");
      },
    },
  );
  assert.equal(editByAdminB.success, false);
  if (!editByAdminB.success) assert.equal(editByAdminB.code, "ACCESS_DENIED");

  const deleteByAdminB = await deleteRoleResponsibilityAssessmentCore(
    actor("admin-b", "ADMIN"),
    "assessment-1",
    {
      findAssessment: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "admin-a",
      }),
      delete: async () => {},
    },
  );
  assert.equal(deleteByAdminB.success, true);
});

test("Ticket 25O §51: current role always wins over ownership — an evaluator who has since become MANAGER loses mutation rights on their own former-ADMIN draft, and one who has since become ADMIN gains them on their own legacy MANAGER-era draft", async () => {
  const formerAdminDraft = draftAssessment({ evaluatorUserId: "user-1" });
  const nowManager = await assessRoleResponsibilityItemCore(
    actor("user-1", "MANAGER"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => formerAdminDraft,
      findItem: async () => itemRow(),
      update: async () => {
        assert.fail("a demoted actor must lose mutation rights on their own former draft");
      },
    },
  );
  assert.equal(nowManager.success, false);
  if (!nowManager.success) assert.equal(nowManager.code, "ACCESS_DENIED");

  const legacyManagerEraDraft = draftAssessment({ evaluatorUserId: "user-2" });
  const nowAdmin = await assessRoleResponsibilityItemCore(
    actor("user-2", "ADMIN"),
    "assessment-1",
    "item-1",
    "MET",
    null,
    {
      findAssessment: async () => legacyManagerEraDraft,
      findItem: async () => itemRow(),
      update: async () => {},
    },
  );
  assert.equal(nowAdmin.success, true);
});
