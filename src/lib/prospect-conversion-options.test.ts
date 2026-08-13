import assert from "node:assert/strict";
import test from "node:test";

import {
  conversionOutcomeOptions,
  conversionReasonOptions,
  getConversionOutcomeLabel,
  getConversionReasonLabel,
} from "./prospect-conversion-options";
import {
  conversionOutcomes,
  conversionReasons,
} from "@/src/lib/validations/prospect-follow-up.schema";

test("every conversionOutcome enum value has exactly one stable French label, in schema order", () => {
  assert.deepEqual(
    conversionOutcomeOptions.map((option) => option.value),
    conversionOutcomes,
  );
  for (const option of conversionOutcomeOptions) {
    assert.ok(option.label.length > 0, `${option.value} has an empty label`);
  }
});

test("every conversionReason enum value has exactly one stable French label, in schema order", () => {
  assert.deepEqual(
    conversionReasonOptions.map((option) => option.value),
    conversionReasons,
  );
  for (const option of conversionReasonOptions) {
    assert.ok(option.label.length > 0, `${option.value} has an empty label`);
  }
});

test("no label leaks a campaign-specific term (École Pilote, discount amount, ...) — specifics belong in the follow-up note", () => {
  const forbidden = /école pilote|5\s*000|cfa|site gratuit|promotion actuelle/i;
  for (const option of [...conversionOutcomeOptions, ...conversionReasonOptions]) {
    assert.doesNotMatch(option.label, forbidden, `${option.value}: "${option.label}"`);
  }
});

test("getConversionOutcomeLabel/getConversionReasonLabel resolve every enum value to its centralized label", () => {
  for (const option of conversionOutcomeOptions) {
    assert.equal(getConversionOutcomeLabel(option.value), option.label);
  }
  for (const option of conversionReasonOptions) {
    assert.equal(getConversionReasonLabel(option.value), option.label);
  }
});

test("OTHER is present exactly once, as the final generic escape hatch", () => {
  const otherEntries = conversionReasonOptions.filter(
    (option) => option.value === "OTHER",
  );
  assert.equal(otherEntries.length, 1);
  assert.equal(
    conversionReasonOptions[conversionReasonOptions.length - 1].value,
    "OTHER",
  );
});
