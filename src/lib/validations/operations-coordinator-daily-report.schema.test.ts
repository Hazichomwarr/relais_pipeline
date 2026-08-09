import assert from "node:assert/strict";
import test from "node:test";

import {
  isProspectingTargetMet,
  operationsCoordinatorDailyReportDataSchema,
  validateOperationsCoordinatorSubmission,
  type OperationsCoordinatorDailyReportData,
} from "./operations-coordinator-daily-report.schema";

function validData(
  overrides: Partial<OperationsCoordinatorDailyReportData> = {},
): OperationsCoordinatorDailyReportData {
  return {
    digitalServicesProspects: 3,
    karmdaSchoolProspects: 1,
    prospectingException: false,
    prospectingExceptionReason: "",
    pendingItems: "",
    problemsEncountered: "",
    managementDecisionNeeded: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------

test("digital and KARMDA counts accept integers", () => {
  const result = operationsCoordinatorDailyReportDataSchema.safeParse({
    digitalServicesProspects: 2,
    karmdaSchoolProspects: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.digitalServicesProspects, 2);
    assert.equal(result.data.karmdaSchoolProspects, 1);
  }
});

test("a negative count is rejected", () => {
  const result = operationsCoordinatorDailyReportDataSchema.safeParse({
    digitalServicesProspects: -1,
    karmdaSchoolProspects: 1,
  });

  assert.equal(result.success, false);
});

test("a decimal count is rejected", () => {
  const result = operationsCoordinatorDailyReportDataSchema.safeParse({
    digitalServicesProspects: 1.5,
    karmdaSchoolProspects: 1,
  });

  assert.equal(result.success, false);
});

test("a non-numeric count is rejected", () => {
  const result = operationsCoordinatorDailyReportDataSchema.safeParse({
    digitalServicesProspects: "abc",
    karmdaSchoolProspects: 1,
  });

  assert.equal(result.success, false);
});

test("a numeric string count (as a form field would submit) is coerced", () => {
  const result = operationsCoordinatorDailyReportDataSchema.parse({
    digitalServicesProspects: "3",
    karmdaSchoolProspects: "1",
  });

  assert.equal(result.digitalServicesProspects, 3);
  assert.equal(result.karmdaSchoolProspects, 1);
});

test("counts above the target remain valid — a user may exceed the daily objective", () => {
  const result = operationsCoordinatorDailyReportDataSchema.safeParse({
    digitalServicesProspects: 10,
    karmdaSchoolProspects: 5,
  });

  assert.equal(result.success, true);
});

test("an absent count is represented as null, not 0, for draft autosave", () => {
  const result = operationsCoordinatorDailyReportDataSchema.parse({});

  assert.equal(result.digitalServicesProspects, null);
  assert.equal(result.karmdaSchoolProspects, null);
});

test("prospectingException defaults to false and normalizes null", () => {
  const omitted = operationsCoordinatorDailyReportDataSchema.parse({});
  const nulled = operationsCoordinatorDailyReportDataSchema.parse({
    prospectingException: null,
  });

  assert.equal(omitted.prospectingException, false);
  assert.equal(nulled.prospectingException, false);
});

// ---------------------------------------------------------------------------
// isProspectingTargetMet
// ---------------------------------------------------------------------------

test("isProspectingTargetMet requires both the digital and KARMDA targets", () => {
  assert.equal(
    isProspectingTargetMet({ digitalServicesProspects: 3, karmdaSchoolProspects: 1 }),
    true,
  );
  assert.equal(
    isProspectingTargetMet({ digitalServicesProspects: 2, karmdaSchoolProspects: 1 }),
    false,
  );
  assert.equal(
    isProspectingTargetMet({ digitalServicesProspects: 3, karmdaSchoolProspects: 0 }),
    false,
  );
  assert.equal(
    isProspectingTargetMet({ digitalServicesProspects: null, karmdaSchoolProspects: null }),
    false,
  );
});

// ---------------------------------------------------------------------------
// validateOperationsCoordinatorSubmission
// ---------------------------------------------------------------------------

test("both targets met: submission allowed without an exception", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({ digitalServicesProspects: 3, karmdaSchoolProspects: 1 }),
  );

  assert.equal(result.valid, true);
});

test("one target missed, no exception: submission rejected", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({ digitalServicesProspects: 2, karmdaSchoolProspects: 1 }),
  );

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /objectif de prospection/);
  }
});

test("both targets missed, no exception: submission rejected", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({ digitalServicesProspects: 0, karmdaSchoolProspects: 0 }),
  );

  assert.equal(result.valid, false);
});

test("both targets missed, exception checked with a meaningful reason: submission allowed", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({
      digitalServicesProspects: 0,
      karmdaSchoolProspects: 0,
      prospectingException: true,
      prospectingExceptionReason: "Formation KARMDA à l’École Horizon de 08h30 à 16h00.",
    }),
  );

  assert.equal(result.valid, true);
});

test("exception checked without a reason: submission rejected", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({
      digitalServicesProspects: 0,
      karmdaSchoolProspects: 0,
      prospectingException: true,
      prospectingExceptionReason: "",
    }),
  );

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /justification/);
  }
});

test("exception checked with a whitespace-only reason: submission rejected", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({
      digitalServicesProspects: 0,
      karmdaSchoolProspects: 0,
      prospectingException: true,
      prospectingExceptionReason: "   ",
    }),
  );

  assert.equal(result.valid, false);
});

test("counts above target with the exception unchecked: still allowed (targets met takes priority)", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({ digitalServicesProspects: 5, karmdaSchoolProspects: 2 }),
  );

  assert.equal(result.valid, true);
});

test("missing digitalServicesProspects is rejected with a specific message", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({ digitalServicesProspects: null }),
  );

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /Services Digitaux/);
  }
});

test("missing karmdaSchoolProspects is rejected with a specific message", () => {
  const result = validateOperationsCoordinatorSubmission(
    validData({ karmdaSchoolProspects: null }),
  );

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /KARMDA/);
  }
});
