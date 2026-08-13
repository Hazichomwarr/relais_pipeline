import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectConversionOutcome, ProspectConversionReason, ProspectStatus } from "@prisma/client";

import {
  conversionReasonRequiresNote,
  isConversionOutcomeConsistentWithStatus,
  isConversionReasonAllowedForOutcome,
  listConversionReasonsForOutcome,
} from "./prospect-conversion.service-core";

const allOutcomes: ProspectConversionOutcome[] = [
  "ADVANCED",
  "STALLED",
  "WON",
  "LOST",
];

const allReasons: ProspectConversionReason[] = [
  "PROMOTIONAL_OFFER",
  "DEMO_CONVINCED",
  "GOOD_PRODUCT_FIT",
  "URGENT_NEED",
  "PRICE_ACCEPTABLE",
  "DECISION_MAKER_APPROVAL",
  "NO_BUDGET",
  "PRICE_TOO_HIGH",
  "DECISION_MAKER_UNAVAILABLE",
  "ALREADY_EQUIPPED",
  "NO_RESPONSE",
  "NEEDS_MORE_TIME",
  "BAD_FIT",
  "COMPETITOR",
  "OTHER",
];

const advancementReasons: ProspectConversionReason[] = [
  "PROMOTIONAL_OFFER",
  "DEMO_CONVINCED",
  "GOOD_PRODUCT_FIT",
  "URGENT_NEED",
  "PRICE_ACCEPTABLE",
  "DECISION_MAKER_APPROVAL",
];

const setbackReasons: ProspectConversionReason[] = [
  "NO_BUDGET",
  "PRICE_TOO_HIGH",
  "DECISION_MAKER_UNAVAILABLE",
  "ALREADY_EQUIPPED",
  "NO_RESPONSE",
  "NEEDS_MORE_TIME",
  "BAD_FIT",
  "COMPETITOR",
];

// ---------------------------------------------------------------------------
// The full outcome × reason compatibility matrix — "the compatibility
// matrix is core analytics integrity," per Ticket 20D. Every one of the
// 4 × 15 = 60 combinations is asserted explicitly, not sampled.
// ---------------------------------------------------------------------------
for (const outcome of allOutcomes) {
  for (const reason of allReasons) {
    const expected = computeExpectedCompatibility(outcome, reason);

    test(`isConversionReasonAllowedForOutcome(${outcome}, ${reason}) === ${expected}`, () => {
      assert.equal(isConversionReasonAllowedForOutcome(outcome, reason), expected);
    });
  }
}

function computeExpectedCompatibility(
  outcome: ProspectConversionOutcome,
  reason: ProspectConversionReason,
): boolean {
  if (reason === "OTHER") {
    return true;
  }
  if (outcome === "ADVANCED" || outcome === "WON") {
    return advancementReasons.includes(reason);
  }
  if (outcome === "STALLED") {
    return setbackReasons.includes(reason);
  }
  // LOST — every setback reason except NEEDS_MORE_TIME (still-alive semantics)
  return setbackReasons.includes(reason) && reason !== "NEEDS_MORE_TIME";
}

test("OTHER is compatible with every outcome (universal escape hatch)", () => {
  for (const outcome of allOutcomes) {
    assert.equal(isConversionReasonAllowedForOutcome(outcome, "OTHER"), true);
  }
});

test("NEEDS_MORE_TIME is compatible with STALLED but not LOST — a still-alive opportunity is not a closed one", () => {
  assert.equal(
    isConversionReasonAllowedForOutcome("STALLED", "NEEDS_MORE_TIME"),
    true,
  );
  assert.equal(
    isConversionReasonAllowedForOutcome("LOST", "NEEDS_MORE_TIME"),
    false,
  );
});

test("PROMOTIONAL_OFFER supports both ADVANCED and WON", () => {
  assert.equal(
    isConversionReasonAllowedForOutcome("ADVANCED", "PROMOTIONAL_OFFER"),
    true,
  );
  assert.equal(
    isConversionReasonAllowedForOutcome("WON", "PROMOTIONAL_OFFER"),
    true,
  );
});

test("listConversionReasonsForOutcome matches isConversionReasonAllowedForOutcome exactly, for every outcome", () => {
  for (const outcome of allOutcomes) {
    const listed = new Set(listConversionReasonsForOutcome(outcome));
    for (const reason of allReasons) {
      assert.equal(
        listed.has(reason),
        isConversionReasonAllowedForOutcome(outcome, reason),
        `${outcome}/${reason} mismatch between list and predicate`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Status/outcome consistency
// ---------------------------------------------------------------------------

test("WON outcome requires WON status, and only WON status", () => {
  assert.equal(isConversionOutcomeConsistentWithStatus("WON", "WON"), true);
  for (const status of [
    "NEW",
    "TO_FOLLOW_UP",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "LOST",
  ] as ProspectStatus[]) {
    assert.equal(
      isConversionOutcomeConsistentWithStatus("WON", status),
      false,
      `WON outcome should not be consistent with status ${status}`,
    );
  }
});

test("LOST outcome requires LOST status, and only LOST status", () => {
  assert.equal(isConversionOutcomeConsistentWithStatus("LOST", "LOST"), true);
  for (const status of [
    "NEW",
    "TO_FOLLOW_UP",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "WON",
  ] as ProspectStatus[]) {
    assert.equal(
      isConversionOutcomeConsistentWithStatus("LOST", status),
      false,
      `LOST outcome should not be consistent with status ${status}`,
    );
  }
});

for (const outcome of ["ADVANCED", "STALLED"] as ProspectConversionOutcome[]) {
  test(`${outcome} is consistent with every active status, and only active statuses`, () => {
    for (const status of [
      "NEW",
      "TO_FOLLOW_UP",
      "CONTACTED",
      "QUALIFIED",
      "PROPOSAL_SENT",
    ] as ProspectStatus[]) {
      assert.equal(
        isConversionOutcomeConsistentWithStatus(outcome, status),
        true,
        `${outcome} should be consistent with active status ${status}`,
      );
    }
    assert.equal(isConversionOutcomeConsistentWithStatus(outcome, "WON"), false);
    assert.equal(isConversionOutcomeConsistentWithStatus(outcome, "LOST"), false);
  });
}

test("ADVANCED does not require status to numerically move forward (Ticket 20A found no transition state machine)", () => {
  // QUALIFIED can legitimately stay QUALIFIED with an ADVANCED outcome —
  // e.g. a verbal demo commitment that hasn't been reflected in status yet.
  assert.equal(
    isConversionOutcomeConsistentWithStatus("ADVANCED", "QUALIFIED"),
    true,
  );
});

// ---------------------------------------------------------------------------
// OTHER requires an explanation
// ---------------------------------------------------------------------------

test("conversionReasonRequiresNote is true only for OTHER", () => {
  assert.equal(conversionReasonRequiresNote("OTHER"), true);
  for (const reason of allReasons.filter((r) => r !== "OTHER")) {
    assert.equal(
      conversionReasonRequiresNote(reason),
      false,
      `${reason} should not require a note`,
    );
  }
});
