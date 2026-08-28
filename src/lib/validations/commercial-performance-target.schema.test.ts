import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommercialPerformanceTargetSchema,
  deleteCommercialPerformanceTargetSchema,
  updateCommercialPerformanceTargetSchema,
} from "./commercial-performance-target.schema";

function validInput() {
  return { userId: "commercial-1", year: "2026", month: "9", targetWins: "4" };
}

test("accepts a valid submission and coerces string form values to numbers", () => {
  const result = createCommercialPerformanceTargetSchema.safeParse(validInput());

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.year, 2026);
    assert.equal(result.data.month, 9);
    assert.equal(result.data.targetWins, 4);
  }
});

test("rejects an empty userId", () => {
  const result = createCommercialPerformanceTargetSchema.safeParse({
    ...validInput(),
    userId: "",
  });
  assert.equal(result.success, false);
});

for (const targetWins of ["0", "-1", "-4", "1.5"]) {
  test(`rejects targetWins = "${targetWins}"`, () => {
    const result = createCommercialPerformanceTargetSchema.safeParse({
      ...validInput(),
      targetWins,
    });
    assert.equal(result.success, false);
  });
}

test("accepts targetWins = 1", () => {
  const result = createCommercialPerformanceTargetSchema.safeParse({
    ...validInput(),
    targetWins: "1",
  });
  assert.equal(result.success, true);
});

for (const month of ["0", "13", "-1"]) {
  test(`rejects an out-of-range month "${month}"`, () => {
    const result = createCommercialPerformanceTargetSchema.safeParse({
      ...validInput(),
      month,
    });
    assert.equal(result.success, false);
  });
}

for (const month of ["1", "12"]) {
  test(`accepts month boundary "${month}"`, () => {
    const result = createCommercialPerformanceTargetSchema.safeParse({
      ...validInput(),
      month,
    });
    assert.equal(result.success, true);
  });
}

test("updateCommercialPerformanceTargetSchema requires targetId and a valid targetWins", () => {
  const missingTargetId = updateCommercialPerformanceTargetSchema.safeParse({
    targetId: "",
    targetWins: "4",
  });
  const valid = updateCommercialPerformanceTargetSchema.safeParse({
    targetId: "target-1",
    targetWins: "4",
  });

  assert.equal(missingTargetId.success, false);
  assert.equal(valid.success, true);
});

test("deleteCommercialPerformanceTargetSchema requires targetId", () => {
  const missing = deleteCommercialPerformanceTargetSchema.safeParse({ targetId: "" });
  const valid = deleteCommercialPerformanceTargetSchema.safeParse({
    targetId: "target-1",
  });

  assert.equal(missing.success, false);
  assert.equal(valid.success, true);
});
