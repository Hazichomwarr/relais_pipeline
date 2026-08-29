import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import { PROFESSIONAL_CONTRIBUTION_CATALOG } from "@/src/lib/professional-contribution-catalog";
import {
  assessProfessionalContributionItemCore,
  canAssessProfessionalContribution,
  computeProfessionalContributionScore,
  computeProfessionalContributionTraitScore,
  createProfessionalContributionAssessmentCore,
  deleteProfessionalContributionAssessmentCore,
  submitProfessionalContributionAssessmentCore,
  type CreateProfessionalContributionAssessmentDependencies,
  type CreateProfessionalContributionAssessmentFields,
  type ProfessionalContributionAssessmentActor,
  type ProfessionalContributionAssessmentEmployeeRecord,
  type ProfessionalContributionAssessmentItemRow,
} from "./professional-contribution.service-core";

const CLOSED_PERIOD = {
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodEnd: new Date("2026-08-31T23:59:59.999Z"),
};
const NOW_AFTER_AUGUST = new Date("2026-09-05T00:00:00.000Z");
const NOW_MID_AUGUST = new Date("2026-08-15T00:00:00.000Z");

function actor(id: string, role: UserRole): ProfessionalContributionAssessmentActor {
  return { id, role };
}

function employee(
  overrides: Partial<ProfessionalContributionAssessmentEmployeeRecord> = {},
): ProfessionalContributionAssessmentEmployeeRecord {
  return { id: "employee-1", role: "COMMERCIAL", active: true, ...overrides };
}

function createDeps(overrides: {
  findEmployee?: () => Promise<ProfessionalContributionAssessmentEmployeeRecord | null>;
  findExisting?: () => Promise<{ id: string } | null>;
  create?: (
    fields: CreateProfessionalContributionAssessmentFields,
  ) => Promise<{ id: string }>;
} = {}): CreateProfessionalContributionAssessmentDependencies {
  return {
    findEmployee: overrides.findEmployee ?? (async () => employee()),
    findExisting: overrides.findExisting ?? (async () => null),
    create: overrides.create ?? (async () => ({ id: "assessment-1" })),
  };
}

// ---------------------------------------------------------------------------
// §53: overlap boundary — structural guarantee
// ---------------------------------------------------------------------------

test("§53: the core file never imports Execution Discipline's, Results', or Role Responsibility's scoring functions", () => {
  const source = readFileSync(
    "src/services/professional-contribution.service-core.ts",
    "utf8",
  );
  assert.doesNotMatch(source, /computeExecutionDisciplineScore/);
  assert.doesNotMatch(source, /computeCommercialResultsScore/);
  assert.doesNotMatch(source, /collectCommercialResultsEvidence/);
  assert.doesNotMatch(source, /computeRoleResponsibility/);
  assert.doesNotMatch(source, /role-responsibility-assessment\.service-core/);
});

test("Professional Contribution and Role Responsibilities import the same authorization primitive from a neutral shared location, not from each other", () => {
  const source = readFileSync(
    "src/services/professional-contribution.service-core.ts",
    "utf8",
  );
  assert.match(source, /from "@\/src\/lib\/employee-assessment-authorization"/);
});

// ---------------------------------------------------------------------------
// §17/§18/§19: the proportional scoring formula
// ---------------------------------------------------------------------------

test("computeProfessionalContributionTraitScore is linear: level 1 -> 0, level 5 -> maxPoints", () => {
  assert.equal(computeProfessionalContributionTraitScore(1, 4), 0);
  assert.equal(computeProfessionalContributionTraitScore(5, 4), 4);
  assert.equal(computeProfessionalContributionTraitScore(1, 3), 0);
  assert.equal(computeProfessionalContributionTraitScore(5, 3), 3);
});

test("computeProfessionalContributionTraitScore for a 4-point trait lands on clean integers at every level", () => {
  assert.equal(computeProfessionalContributionTraitScore(1, 4), 0);
  assert.equal(computeProfessionalContributionTraitScore(2, 4), 1);
  assert.equal(computeProfessionalContributionTraitScore(3, 4), 2);
  assert.equal(computeProfessionalContributionTraitScore(4, 4), 3);
  assert.equal(computeProfessionalContributionTraitScore(5, 4), 4);
});

test("computeProfessionalContributionTraitScore for a 3-point trait is fractional at the intermediate levels, by construction", () => {
  assert.equal(computeProfessionalContributionTraitScore(2, 3), 0.75);
  assert.equal(computeProfessionalContributionTraitScore(3, 3), 1.5);
  assert.equal(computeProfessionalContributionTraitScore(4, 3), 2.25);
});

// ---------------------------------------------------------------------------
// §63/§64/§65/§66: score boundary and rounding tests
// ---------------------------------------------------------------------------

test("§63: all traits at level 1 scores exactly 0", () => {
  const items = PROFESSIONAL_CONTRIBUTION_CATALOG.map((trait) => ({
    traitKey: trait.key,
    maxPoints: trait.maxPoints,
    selectedLevel: 1 as const,
  }));
  assert.equal(computeProfessionalContributionScore(items), 0);
});

test("§65: all traits at level 5 scores exactly 10 — the full catalog total, matching each trait's own maxPoints", () => {
  const items = PROFESSIONAL_CONTRIBUTION_CATALOG.map((trait) => ({
    traitKey: trait.key,
    maxPoints: trait.maxPoints,
    selectedLevel: 5 as const,
  }));
  assert.equal(computeProfessionalContributionScore(items), 10);
});

test("§64: all traits at level 3 (the midpoint) scores exactly 5 — locked expected value for 'ordinary professional expectation' on this linear scale", () => {
  const items = PROFESSIONAL_CONTRIBUTION_CATALOG.map((trait) => ({
    traitKey: trait.key,
    maxPoints: trait.maxPoints,
    selectedLevel: 3 as const,
  }));
  // Initiative(4)*2/4=2, Coordination(3)*2/4=1.5, ProblemSolving(3)*2/4=1.5 -> 5.0
  assert.equal(computeProfessionalContributionScore(items), 5);
});

test("§66: deterministic rounding at a genuine .5 boundary — all traits at level 4 sums to 7.5, rounds to 8", () => {
  const items = PROFESSIONAL_CONTRIBUTION_CATALOG.map((trait) => ({
    traitKey: trait.key,
    maxPoints: trait.maxPoints,
    selectedLevel: 4 as const,
  }));
  // Initiative(4)*3/4=3, Coordination(3)*3/4=2.25, ProblemSolving(3)*3/4=2.25 -> 7.5
  assert.equal(computeProfessionalContributionScore(items), 8);
});

test("§62: score never falls outside 0-10 for any valid level combination", () => {
  for (const level of [1, 2, 3, 4, 5] as const) {
    const items = PROFESSIONAL_CONTRIBUTION_CATALOG.map((trait) => ({
      traitKey: trait.key,
      maxPoints: trait.maxPoints,
      selectedLevel: level,
    }));
    const score = computeProfessionalContributionScore(items);
    assert.ok(score >= 0 && score <= 10, `score ${score} out of bounds for level ${level}`);
  }
});

// ---------------------------------------------------------------------------
// §54: authorization matrix — same shape as 25I's, via the shared primitive
// ---------------------------------------------------------------------------

test("§54: nobody can assess themselves, regardless of role", () => {
  for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
    assert.equal(
      canAssessProfessionalContribution(actor("same-id", role), role, "same-id"),
      false,
    );
  }
});

test("§54: a COMMERCIAL can never assess anyone", () => {
  assert.equal(
    canAssessProfessionalContribution(
      actor("commercial-a", "COMMERCIAL"),
      "COMMERCIAL",
      "commercial-b",
    ),
    false,
  );
});

test("§54: ADMIN and MANAGER may both assess a COMMERCIAL; only ADMIN may assess a MANAGER; nobody may assess an ADMIN (§7/§41)", () => {
  for (const assessorRole of ["ADMIN", "MANAGER"] as const) {
    assert.equal(
      canAssessProfessionalContribution(
        actor("assessor-1", assessorRole),
        "COMMERCIAL",
        "commercial-b",
      ),
      true,
    );
  }
  assert.equal(
    canAssessProfessionalContribution(actor("admin-1", "ADMIN"), "MANAGER", "manager-b"),
    true,
  );
  assert.equal(
    canAssessProfessionalContribution(actor("manager-a", "MANAGER"), "MANAGER", "manager-b"),
    false,
  );
  for (const assessorRole of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
    assert.equal(
      canAssessProfessionalContribution(actor("assessor-1", assessorRole), "ADMIN", "admin-b"),
      false,
    );
  }
});

// ---------------------------------------------------------------------------
// §55/§56: draft creation captures everything, snapshotted immediately
// ---------------------------------------------------------------------------

test("§55: creating a draft captures employee identity, roleAtEvaluation, evaluator identity, evaluatorRoleAtEvent, period, and policyVersion", async () => {
  let captured: CreateProfessionalContributionAssessmentFields | undefined;

  await createProfessionalContributionAssessmentCore(
    actor("manager-1", "MANAGER"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({
      findEmployee: async () => employee({ id: "commercial-a", role: "COMMERCIAL" }),
      create: async (fields) => {
        captured = fields;
        return { id: "assessment-1" };
      },
    }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(captured?.employeeUserId, "commercial-a");
  assert.equal(captured?.roleAtEvaluation, "COMMERCIAL");
  assert.equal(captured?.evaluatorUserId, "manager-1");
  assert.equal(captured?.evaluatorRoleAtEvent, "MANAGER");
  assert.deepEqual(captured?.periodStart, CLOSED_PERIOD.periodStart);
  assert.deepEqual(captured?.periodEnd, CLOSED_PERIOD.periodEnd);
  assert.equal(captured?.policyVersion, "PROFESSIONAL_CONTRIBUTION_V1");
});

test("§56/§31: every trait in the shared catalog is snapshotted at creation, with the full five-anchor set", async () => {
  let capturedItems: CreateProfessionalContributionAssessmentFields["items"] = [];

  await createProfessionalContributionAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({
      create: async (fields) => {
        capturedItems = fields.items;
        return { id: "assessment-1" };
      },
    }),
    NOW_AFTER_AUGUST,
  );

  assert.equal(capturedItems.length, PROFESSIONAL_CONTRIBUTION_CATALOG.length);
  for (const [index, trait] of PROFESSIONAL_CONTRIBUTION_CATALOG.entries()) {
    assert.equal(capturedItems[index].traitKey, trait.key);
    assert.equal(capturedItems[index].labelAtEvaluation, trait.label);
    assert.equal(capturedItems[index].maxPoints, trait.maxPoints);
    assert.equal(capturedItems[index].anchorsSnapshot.length, 5);
    assert.deepEqual(capturedItems[index].anchorsSnapshot, trait.anchors);
  }
});

// ---------------------------------------------------------------------------
// §61: period closure at creation
// ---------------------------------------------------------------------------

test("§61: creation is rejected for a period that has not yet closed", async () => {
  const result = await createProfessionalContributionAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps(),
    NOW_MID_AUGUST,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "PERIOD_NOT_CLOSED");
});

test("creation succeeds once the period has closed", async () => {
  const result = await createProfessionalContributionAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps(),
    NOW_AFTER_AUGUST,
  );
  assert.equal(result.success, true);
});

test("creating for an ADMIN employee is rejected — ADMIN has no supported catalog access", async () => {
  const result = await createProfessionalContributionAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "admin-2", period: CLOSED_PERIOD },
    createDeps({ findEmployee: async () => employee({ id: "admin-2", role: "ADMIN" }) }),
    NOW_AFTER_AUGUST,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ROLE_NOT_SUPPORTED");
});

test("duplicate period for the same employee is rejected", async () => {
  const result = await createProfessionalContributionAssessmentCore(
    actor("admin-1", "ADMIN"),
    { employeeId: "commercial-a", period: CLOSED_PERIOD },
    createDeps({ findExisting: async () => ({ id: "existing" }) }),
    NOW_AFTER_AUGUST,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "DUPLICATE_PERIOD");
});

// ---------------------------------------------------------------------------
// Item assessment — helpers
// ---------------------------------------------------------------------------

function itemRow(
  overrides: Partial<ProfessionalContributionAssessmentItemRow> = {},
): ProfessionalContributionAssessmentItemRow {
  const trait = PROFESSIONAL_CONTRIBUTION_CATALOG[0]; // Initiative, max 4
  return {
    id: "item-1",
    assessmentId: "assessment-1",
    traitKey: trait.key,
    maxPoints: trait.maxPoints,
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
// §57: anchor selection -> deterministic points; invalid level rejected
// ---------------------------------------------------------------------------

test("§57: each valid level (1-5) maps deterministically to the expected points for a 4-point trait", async () => {
  const expected = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 } as const;

  for (const [level, points] of Object.entries(expected)) {
    const result = await assessProfessionalContributionItemCore(
      actor("evaluator-1", "ADMIN"),
      "assessment-1",
      "item-1",
      Number(level),
      Number(level) === 1 || Number(level) === 5 ? "Observation détaillée." : null,
      {
        findAssessment: async () => draftAssessment(),
        findItem: async () => itemRow(),
        update: async () => {},
      },
    );
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.awardedPoints, points);
  }
});

test("an invalid level (0, 6, non-integer) is rejected", async () => {
  for (const invalid of [0, 6, 2.5, -1]) {
    const result = await assessProfessionalContributionItemCore(
      actor("evaluator-1", "ADMIN"),
      "assessment-1",
      "item-1",
      invalid,
      null,
      {
        findAssessment: async () => draftAssessment(),
        findItem: async () => itemRow(),
        update: async () => {
          assert.fail("update must not be called for an invalid level");
        },
      },
    );
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.code, "INVALID_LEVEL");
  }
});

// ---------------------------------------------------------------------------
// §58/§59: extreme-level observation requirement
// ---------------------------------------------------------------------------

test("§58: level 1 and level 5 require a non-empty observation", async () => {
  for (const level of [1, 5]) {
    const rejected = await assessProfessionalContributionItemCore(
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
  }
});

test("§58: levels 2, 3, and 4 do not require an observation", async () => {
  for (const level of [2, 3, 4]) {
    const result = await assessProfessionalContributionItemCore(
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

test("§59: a whitespace-only observation counts as missing for an extreme level", async () => {
  const result = await assessProfessionalContributionItemCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    "item-1",
    1,
    "   ",
    {
      findAssessment: async () => draftAssessment(),
      findItem: async () => itemRow(),
      update: async () => {
        assert.fail("update must not be called with a whitespace-only observation");
      },
    },
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "OBSERVATION_REQUIRED");
});

test("only the assessment's own evaluator may assess its items", async () => {
  const result = await assessProfessionalContributionItemCore(
    actor("someone-else", "ADMIN"),
    "assessment-1",
    "item-1",
    3,
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
// §67: submitted immutability — item assessment
// ---------------------------------------------------------------------------

test("§67: a SUBMITTED assessment's items can no longer be reassessed", async () => {
  const result = await assessProfessionalContributionItemCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    "item-1",
    3,
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
// §60: submission blocked while any item remains UNASSESSED
// ---------------------------------------------------------------------------

test("§60: submission is rejected while any item remains UNASSESSED — no automatic zero", async () => {
  const result = await submitProfessionalContributionAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "evaluator-1",
        items: [
          { id: "item-1", awardedPoints: 3 },
          { id: "item-2", awardedPoints: null },
          { id: "item-3", awardedPoints: 2.25 },
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

test("submission computes the final rounded integer score from all three items", async () => {
  const result = await submitProfessionalContributionAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "DRAFT",
        evaluatorUserId: "evaluator-1",
        items: [
          { id: "item-1", awardedPoints: 3 }, // Initiative level 4
          { id: "item-2", awardedPoints: 2.25 }, // Coordination level 4
          { id: "item-3", awardedPoints: 2.25 }, // Problem Solving level 4
        ],
      }),
      submit: async (id, score) => {
        assert.equal(id, "assessment-1");
        assert.equal(score, 8); // 3 + 2.25 + 2.25 = 7.5 -> 8
      },
    },
  );
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.score, 8);
});

// ---------------------------------------------------------------------------
// §67: submitted immutability — submit and delete
// ---------------------------------------------------------------------------

test("§67: submitting an already-SUBMITTED assessment is rejected", async () => {
  const result = await submitProfessionalContributionAssessmentCore(
    actor("evaluator-1", "ADMIN"),
    "assessment-1",
    {
      findAssessmentWithItems: async () => ({
        id: "assessment-1",
        status: "SUBMITTED",
        evaluatorUserId: "evaluator-1",
        items: [{ id: "item-1", awardedPoints: 3 }],
      }),
      submit: async () => {
        assert.fail("submit must not be called twice");
      },
    },
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ASSESSMENT_LOCKED");
});

test("§67: deleting a SUBMITTED assessment is rejected; a DRAFT may be deleted by its evaluator", async () => {
  const submittedDelete = await deleteProfessionalContributionAssessmentCore(
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
  const draftDelete = await deleteProfessionalContributionAssessmentCore(
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
// §68/§69: role-at-evaluation and evaluator-role-at-event stay frozen —
// structural guarantee, not a live re-check
// ---------------------------------------------------------------------------

test("§68/§69: assessing, submitting, and deleting never re-fetch the employee or re-check anyone's current role — only identity (evaluatorUserId) and status are consulted", () => {
  const source = readFileSync(
    "src/services/professional-contribution.service-core.ts",
    "utf8",
  );
  const afterCreate = source.slice(source.indexOf("// Assess one trait"));

  assert.doesNotMatch(afterCreate, /findEmployee/);
});
