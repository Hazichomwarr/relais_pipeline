import assert from "node:assert/strict";
import test from "node:test";

import type { CommercialResultsResult } from "./commercial-results.service-core";
import type { ExecutionDisciplineResult } from "./execution-discipline.service-core";
import { canAssessEmployeeInStructuredEvaluation } from "@/src/lib/employee-assessment-authorization";
import {
  canViewEmployeePerformance,
  composePerformanceSummary,
  type StructuredAssessmentDimensionSummary,
} from "./performance-summary.service-core";

function scoredResults(score: number): CommercialResultsResult {
  return {
    status: "SCORED",
    score,
    maxScore: 40,
    achievementRate: 1,
    targetWins: 4,
    creditedWins: 4,
    coverageStatus: "COMPLETE",
    evidence: {
      creditedWins: 4,
      rawCreditedWinEvents: 4,
      excludedIneligibleRoleWins: 0,
      legacyUnattributedWinsInPeriod: 0,
      coverageStatus: "COMPLETE",
    },
    policyVersion: "COMMERCIAL_RESULTS_V1",
  };
}

function blockedResults(
  status: Exclude<CommercialResultsResult["status"], "SCORED">,
): CommercialResultsResult {
  if (status === "NO_TARGET") {
    return {
      status,
      score: null,
      maxScore: 40,
      evidence: {
        creditedWins: 0,
        rawCreditedWinEvents: 0,
        excludedIneligibleRoleWins: 0,
        legacyUnattributedWinsInPeriod: 0,
        coverageStatus: "COMPLETE",
      },
      policyVersion: "COMMERCIAL_RESULTS_V1",
    };
  }
  if (status === "LEGACY_ATTRIBUTION_INCOMPLETE") {
    return {
      status,
      score: null,
      maxScore: 40,
      legacyUnattributedWinsInPeriod: 2,
      evidence: {
        creditedWins: 1,
        rawCreditedWinEvents: 1,
        excludedIneligibleRoleWins: 0,
        legacyUnattributedWinsInPeriod: 2,
        coverageStatus: "PARTIAL_LEGACY_ATTRIBUTION",
      },
      policyVersion: "COMMERCIAL_RESULTS_V1",
    };
  }
  return {
    status,
    score: null,
    maxScore: 40,
    evidence: null,
    policyVersion: "COMMERCIAL_RESULTS_V1",
  };
}

function scoredExecution(score: number): ExecutionDisciplineResult {
  return {
    status: "SCORED",
    score,
    maxScore: 30,
    evidence: {
      applicableActions: 8,
      completedOnTime: 5,
      completedLate: 2,
      overdueOpen: 1,
      canceled: 0,
      sampleSize: 8,
    },
    policyVersion: "EXECUTION_DISCIPLINE_V1",
  };
}

function blockedExecution(
  status: Exclude<ExecutionDisciplineResult["status"], "SCORED">,
): ExecutionDisciplineResult {
  if (status === "INSUFFICIENT_EVIDENCE") {
    return {
      status,
      score: null,
      maxScore: 30,
      evidence: {
        applicableActions: 0,
        completedOnTime: 0,
        completedLate: 0,
        overdueOpen: 0,
        canceled: 0,
        sampleSize: 0,
      },
      policyVersion: "EXECUTION_DISCIPLINE_V1",
    };
  }
  return {
    status,
    score: null,
    maxScore: 30,
    evidence: null,
    policyVersion: "EXECUTION_DISCIPLINE_V1",
  };
}

function submittedAssessment(
  score: number,
  maxScore: number,
): StructuredAssessmentDimensionSummary {
  return {
    status: "SUBMITTED",
    score,
    maxScore,
    assessmentId: "assessment-1",
    evaluatorUserId: "evaluator-1",
  };
}

function notFinalizedAssessment(
  status: "DRAFT" | "NOT_STARTED",
  maxScore: number,
): StructuredAssessmentDimensionSummary {
  return status === "DRAFT"
    ? {
        status,
        score: null,
        maxScore,
        assessmentId: "assessment-1",
        evaluatorUserId: "evaluator-1",
      }
    : { status, score: null, maxScore, assessmentId: null, evaluatorUserId: null };
}

// ---------------------------------------------------------------------------
// §74/§79: full score, maximum
// ---------------------------------------------------------------------------

test("§74: all four dimensions valid composes the exact sum, status COMPLETE, no blockers", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(32),
    executionDiscipline: scoredExecution(24),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "COMPLETE");
  assert.deepEqual(summary.overall, { score: 82, maxScore: 100 });
  assert.deepEqual(summary.blockers, []);
});

test("§79: the theoretical maximum composes to exactly 100, never beyond", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(40),
    executionDiscipline: scoredExecution(30),
    roleResponsibilities: submittedAssessment(20, 20),
    professionalContribution: submittedAssessment(10, 10),
  });

  assert.deepEqual(summary.overall, { score: 100, maxScore: 100 });
});

// ---------------------------------------------------------------------------
// §77/§78: zero is a valid score, not a missing one
// ---------------------------------------------------------------------------

test("§77: a validly SCORED zero counts as an actual zero, not a blocker", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(0),
    executionDiscipline: scoredExecution(24),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "COMPLETE");
  assert.deepEqual(summary.overall, { score: 50, maxScore: 100 });
  assert.equal(summary.blockers.length, 0);
});

test("§78: all four dimensions validly scoring zero composes to a complete, valid 0/100 — not a missing evaluation", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(0),
    executionDiscipline: scoredExecution(0),
    roleResponsibilities: submittedAssessment(0, 20),
    professionalContribution: submittedAssessment(0, 10),
  });

  assert.equal(summary.status, "COMPLETE");
  assert.deepEqual(summary.overall, { score: 0, maxScore: 100 });
  assert.deepEqual(summary.blockers, []);
});

// ---------------------------------------------------------------------------
// §75/§76: missing dimensions never become zero, never get silently normalized
// ---------------------------------------------------------------------------

test("§75: a blocked Results dimension makes overall null and INCOMPLETE — never 0/100 or a normalized value", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("NO_TARGET"),
    executionDiscipline: scoredExecution(24),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "INCOMPLETE");
  assert.equal(summary.overall, null);
  assert.deepEqual(summary.blockers, [
    { dimension: "RESULTS", sourceStatus: "NO_TARGET" },
  ]);
});

test("§76: a DRAFT (not yet submitted) Professional Contribution assessment blocks overall — a draft score never counts as finalized", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(32),
    executionDiscipline: scoredExecution(24),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: notFinalizedAssessment("DRAFT", 10),
  });

  assert.equal(summary.overall, null);
  assert.equal(summary.status, "INCOMPLETE");
  assert.deepEqual(summary.blockers, [
    { dimension: "PROFESSIONAL_CONTRIBUTION", sourceStatus: "DRAFT" },
  ]);
});

test("Ticket 25P §30/§31: a Manager with a real SCORED Results dimension but still-UNSUPPORTED_ROLE Execution Discipline composes to INCOMPLETE with overall null — a scored machine dimension is never allowed to paper over the missing one", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(30),
    executionDiscipline: blockedExecution("UNSUPPORTED_ROLE"),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "INCOMPLETE");
  assert.equal(summary.overall, null);
  assert.equal(summary.machineDerivedSubtotal, null);
  assert.deepEqual(summary.blockers, [
    { dimension: "EXECUTION_DISCIPLINE", sourceStatus: "UNSUPPORTED_ROLE" },
  ]);
});

// ---------------------------------------------------------------------------
// Ticket 25Q §52-55: the Manager full-composition regression 25P could not
// satisfy on its own — now that both machine dimensions are Manager-
// eligible, a Manager can reach a genuine /100 through the exact same
// composePerformanceSummary used for Commercial. No Manager-specific
// composition path exists or is added.
// ---------------------------------------------------------------------------

test("Ticket 25Q §52/§53: a Manager with all four dimensions SCORED/SUBMITTED composes the exact sum out of 100, via the unmodified 25K composer", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(32),
    executionDiscipline: scoredExecution(24),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "COMPLETE");
  assert.deepEqual(summary.overall, { score: 82, maxScore: 100 });
  assert.deepEqual(summary.machineDerivedSubtotal, { score: 56, maxScore: 70 });
  assert.deepEqual(summary.humanAssessedSubtotal, { score: 26, maxScore: 30 });
  assert.deepEqual(summary.blockers, []);
});

test("Ticket 25Q §54: a Manager missing any one dimension (Results NO_TARGET) still yields overall null — no normalization to /60 or /70", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("NO_TARGET"),
    executionDiscipline: scoredExecution(24),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "INCOMPLETE");
  assert.equal(summary.overall, null);
  assert.deepEqual(summary.blockers, [
    { dimension: "RESULTS", sourceStatus: "NO_TARGET" },
  ]);
});

test("Ticket 25Q §54: a Manager with Execution PERIOD_NOT_CLOSED also yields overall null — same missing-dimension rule regardless of which machine dimension is blocked", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(32),
    executionDiscipline: blockedExecution("PERIOD_NOT_CLOSED"),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "INCOMPLETE");
  assert.equal(summary.overall, null);
});

test("Ticket 25Q §55: a Manager's genuine Execution score of 0 composes into overall — zero is a real score, not a missing dimension", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(32),
    executionDiscipline: scoredExecution(0),
    roleResponsibilities: submittedAssessment(18, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "COMPLETE");
  assert.deepEqual(summary.overall, { score: 58, maxScore: 100 });
});

test("original source status is always preserved on a blocker, never collapsed to a generic MISSING", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("LEGACY_ATTRIBUTION_INCOMPLETE"),
    executionDiscipline: blockedExecution("UNSUPPORTED_ROLE"),
    roleResponsibilities: notFinalizedAssessment("NOT_STARTED", 20),
    professionalContribution: notFinalizedAssessment("DRAFT", 10),
  });

  assert.deepEqual(
    summary.blockers.map((b) => b.sourceStatus).sort(),
    ["DRAFT", "LEGACY_ATTRIBUTION_INCOMPLETE", "NOT_STARTED", "UNSUPPORTED_ROLE"].sort(),
  );
});

// ---------------------------------------------------------------------------
// §80/§82: machine-derived subtotal
// ---------------------------------------------------------------------------

test("§80: machine-derived subtotal is the sum of Results + Execution only when both are SCORED", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(30),
    executionDiscipline: scoredExecution(21),
    roleResponsibilities: notFinalizedAssessment("NOT_STARTED", 20),
    professionalContribution: notFinalizedAssessment("NOT_STARTED", 10),
  });

  assert.deepEqual(summary.machineDerivedSubtotal, { score: 51, maxScore: 70 });
});

test("§82: if Results is blocked, the machine subtotal is null — Execution alone is never normalized up to /70", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("NO_TARGET"),
    executionDiscipline: scoredExecution(21),
    roleResponsibilities: notFinalizedAssessment("NOT_STARTED", 20),
    professionalContribution: notFinalizedAssessment("NOT_STARTED", 10),
  });

  assert.equal(summary.machineDerivedSubtotal, null);
});

// ---------------------------------------------------------------------------
// §81: human-assessed subtotal
// ---------------------------------------------------------------------------

test("§81: human-assessed subtotal is the sum of Role Responsibilities + Professional Contribution only when both are SUBMITTED", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("NO_TARGET"),
    executionDiscipline: blockedExecution("UNSUPPORTED_ROLE"),
    roleResponsibilities: submittedAssessment(17, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.deepEqual(summary.humanAssessedSubtotal, { score: 25, maxScore: 30 });
});

test("a DRAFT Role Responsibilities assessment makes the human subtotal null, even with Professional Contribution submitted", () => {
  const summary = composePerformanceSummary({
    results: scoredResults(32),
    executionDiscipline: scoredExecution(24),
    roleResponsibilities: notFinalizedAssessment("DRAFT", 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.humanAssessedSubtotal, null);
});

// ---------------------------------------------------------------------------
// Full-role-support boundary: MANAGER (Results/Execution unsupported,
// human dimensions supported) still composes a partial, honest summary
// ---------------------------------------------------------------------------

test("a MANAGER employee (Results/Execution UNSUPPORTED_ROLE, human dimensions available) still reports human-assessed subtotal and status INCOMPLETE, never a fabricated overall", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("UNSUPPORTED_ROLE"),
    executionDiscipline: blockedExecution("UNSUPPORTED_ROLE"),
    roleResponsibilities: submittedAssessment(17, 20),
    professionalContribution: submittedAssessment(8, 10),
  });

  assert.equal(summary.status, "INCOMPLETE");
  assert.equal(summary.overall, null);
  assert.equal(summary.machineDerivedSubtotal, null);
  assert.deepEqual(summary.humanAssessedSubtotal, { score: 25, maxScore: 30 });
  assert.equal(summary.blockers.length, 2);
});

test("an ADMIN employee (all four dimensions unsupported) composes an entirely blocked summary — nothing fabricated", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("UNSUPPORTED_ROLE"),
    executionDiscipline: blockedExecution("UNSUPPORTED_ROLE"),
    roleResponsibilities: notFinalizedAssessment("NOT_STARTED", 20),
    professionalContribution: notFinalizedAssessment("NOT_STARTED", 10),
  });

  assert.equal(summary.status, "INCOMPLETE");
  assert.equal(summary.overall, null);
  assert.equal(summary.machineDerivedSubtotal, null);
  assert.equal(summary.humanAssessedSubtotal, null);
  assert.equal(summary.blockers.length, 4);
});

test("Ticket 25K.1 §15: an ADMIN employee's human dimensions carry the true UNSUPPORTED_ROLE status (never NOT_STARTED) — this is what the real orchestrator produces, and the composition core must block on it exactly like any other non-SUBMITTED status", () => {
  const summary = composePerformanceSummary({
    results: blockedResults("UNSUPPORTED_ROLE"),
    executionDiscipline: blockedExecution("UNSUPPORTED_ROLE"),
    roleResponsibilities: {
      status: "UNSUPPORTED_ROLE",
      score: null,
      maxScore: 20,
      assessmentId: null,
      evaluatorUserId: null,
    },
    professionalContribution: {
      status: "UNSUPPORTED_ROLE",
      score: null,
      maxScore: 10,
      assessmentId: null,
      evaluatorUserId: null,
    },
  });

  assert.equal(summary.status, "INCOMPLETE");
  assert.equal(summary.overall, null);
  assert.equal(summary.humanAssessedSubtotal, null);
  assert.deepEqual(
    summary.blockers.map((b) => b.sourceStatus),
    ["UNSUPPORTED_ROLE", "UNSUPPORTED_ROLE", "UNSUPPORTED_ROLE", "UNSUPPORTED_ROLE"],
  );
});

// ---------------------------------------------------------------------------
// §34/§35/§89: viewing authorization matrix
// ---------------------------------------------------------------------------

test("§34: ADMIN may view any employee's performance dashboard, regardless of the employee's role", () => {
  for (const employeeRole of ["COMMERCIAL", "MANAGER", "ADMIN", "ASSISTANT"] as const) {
    assert.equal(canViewEmployeePerformance("ADMIN", employeeRole), true);
  }
});

test("§34/§35: MANAGER may view only COMMERCIAL employees — not another MANAGER, not an ADMIN, not an ASSISTANT", () => {
  assert.equal(canViewEmployeePerformance("MANAGER", "COMMERCIAL"), true);
  assert.equal(canViewEmployeePerformance("MANAGER", "MANAGER"), false);
  assert.equal(canViewEmployeePerformance("MANAGER", "ADMIN"), false);
  assert.equal(canViewEmployeePerformance("MANAGER", "ASSISTANT"), false);
});

test("Ticket 25M §33/§44: ASSISTANT may never view the management performance dashboard, for any employee — adding the enum value did not accidentally grant this", () => {
  for (const employeeRole of ["COMMERCIAL", "MANAGER", "ADMIN", "ASSISTANT"] as const) {
    assert.equal(canViewEmployeePerformance("ASSISTANT", employeeRole), false);
  }
});

test("§34: COMMERCIAL may never view the management dashboard, for any employee including themself", () => {
  for (const employeeRole of ["COMMERCIAL", "MANAGER", "ADMIN"] as const) {
    assert.equal(canViewEmployeePerformance("COMMERCIAL", employeeRole), false);
  }
});

// ---------------------------------------------------------------------------
// Ticket 25O §53: viewing and mutating remain two separate authorization
// checks — narrowing evaluator authority to ADMIN must never touch who may
// view the dashboard, and a viewer's eligibility must never leak into
// assessment eligibility.
// ---------------------------------------------------------------------------

test("Ticket 25O §53: a MANAGER who is authorized to view a COMMERCIAL's performance dashboard is NOT thereby authorized to assess that COMMERCIAL's structured evaluations — viewing and evaluator authority are independent checks", () => {
  assert.equal(canViewEmployeePerformance("MANAGER", "COMMERCIAL"), true);
  assert.equal(
    canAssessEmployeeInStructuredEvaluation(
      { id: "manager-1", role: "MANAGER" },
      "COMMERCIAL",
      "commercial-1",
    ),
    false,
  );
});

test("Ticket 25O §53: ADMIN is the only role for which viewing and structured-evaluation authority coincide — this is a coincidence of both matrices independently naming ADMIN, not a shared implementation", () => {
  assert.equal(canViewEmployeePerformance("ADMIN", "COMMERCIAL"), true);
  assert.equal(
    canAssessEmployeeInStructuredEvaluation(
      { id: "admin-1", role: "ADMIN" },
      "COMMERCIAL",
      "commercial-1",
    ),
    true,
  );
});
