import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectStatus } from "@prisma/client";

import { prospectFollowUpWorkflowSchema } from "./prospect-follow-up.schema";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    prospectId: "prospect-1",
    note: "Le directeur souhaite une démonstration.",
    status: "QUALIFIED",
    interest: "INTERESTED",
    conversionOutcome: "ADVANCED",
    conversionReason: "DEMO_CONVINCED",
    completedActionId: "",
    nextActionTitle: "Faire une démonstration",
    nextActionAssignedToUserId: "user-1",
    nextActionDueAt: "2026-08-14T10:00",
    ...overrides,
  };
}

test("accepts a complete active-status submission", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(baseInput());

  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(result.data.nextActionDueAt instanceof Date);
    assert.equal(result.data.completedActionId, undefined);
  }
});

test("rejects a note that is missing or too short", () => {
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(baseInput({ note: "" })).success,
    false,
  );
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(baseInput({ note: "trop court" }))
      .success,
    true, // 10 chars exactly is the minimum — sanity check the boundary itself below
  );
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(baseInput({ note: "trop" }))
      .success,
    false,
  );
});

test("rejects a missing status or interest", () => {
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(baseInput({ status: undefined }))
      .success,
    false,
  );
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(baseInput({ interest: undefined }))
      .success,
    false,
  );
});

const activeStatuses: ProspectStatus[] = [
  "NEW",
  "TO_FOLLOW_UP",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
];

for (const status of activeStatuses) {
  test(`requires a next action title, assignee, and due date for active status ${status}`, () => {
    const missingTitle = prospectFollowUpWorkflowSchema.safeParse(
      baseInput({ status, nextActionTitle: "" }),
    );
    assert.equal(missingTitle.success, false);
    if (!missingTitle.success) {
      const messages = missingTitle.error.flatten().fieldErrors;
      assert.ok(messages.nextActionTitle?.includes("Indiquez la prochaine action."));
    }

    const missingAssignee = prospectFollowUpWorkflowSchema.safeParse(
      baseInput({ status, nextActionAssignedToUserId: "" }),
    );
    assert.equal(missingAssignee.success, false);
    if (!missingAssignee.success) {
      const messages = missingAssignee.error.flatten().fieldErrors;
      assert.ok(
        messages.nextActionAssignedToUserId?.includes(
          "Attribuez la prochaine action à un membre de l’équipe.",
        ),
      );
    }

    const missingDueAt = prospectFollowUpWorkflowSchema.safeParse(
      baseInput({ status, nextActionDueAt: "" }),
    );
    assert.equal(missingDueAt.success, false);
    if (!missingDueAt.success) {
      const messages = missingDueAt.error.flatten().fieldErrors;
      assert.ok(messages.nextActionDueAt?.includes("Indiquez une échéance."));
    }
  });
}

const terminalReasonByStatus: Record<"WON" | "LOST", string> = {
  WON: "GOOD_PRODUCT_FIT",
  LOST: "PRICE_TOO_HIGH",
};

for (const status of ["WON", "LOST"] as const) {
  test(`does not require a next action for terminal status ${status}`, () => {
    const result = prospectFollowUpWorkflowSchema.safeParse(
      baseInput({
        status,
        conversionOutcome: status,
        conversionReason: terminalReasonByStatus[status],
        nextActionTitle: "",
        nextActionAssignedToUserId: "",
        nextActionDueAt: "",
      }),
    );

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.nextActionTitle, undefined);
      assert.equal(result.data.nextActionAssignedToUserId, undefined);
      assert.equal(result.data.nextActionDueAt, undefined);
    }
  });
}

test("switching from a terminal status back to active still requires the next action fields (no stale bypass)", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({
      status: "CONTACTED",
      nextActionTitle: "",
      nextActionAssignedToUserId: "",
      nextActionDueAt: "",
    }),
  );

  assert.equal(result.success, false);
});

test("accepts an optional completedActionId when provided", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({ completedActionId: "action-1" }),
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.completedActionId, "action-1");
  }
});

test("never surfaces trusted actor/lifecycle fields even if a client submits them", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({
      actorUserId: "someone-else",
      createdByUserId: "someone-else",
      completedByUserId: "someone-else",
    }),
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(Object.keys(result.data).sort(), [
      "completedActionId",
      "conversionOutcome",
      "conversionReason",
      "interest",
      "nextActionAssignedToUserId",
      "nextActionDueAt",
      "nextActionTitle",
      "note",
      "prospectId",
      "status",
    ]);
  }
});

// ---------------------------------------------------------------------------
// Ticket 20D — conversion outcome/reason
// ---------------------------------------------------------------------------

test("rejects a missing conversion outcome or reason", () => {
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(
      baseInput({ conversionOutcome: "" }),
    ).success,
    false,
  );
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(
      baseInput({ conversionReason: "" }),
    ).success,
    false,
  );
});

test("rejects a reason incompatible with the chosen outcome", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({ conversionOutcome: "ADVANCED", conversionReason: "NO_BUDGET" }),
  );

  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.flatten().fieldErrors;
    assert.ok(
      messages.conversionReason?.includes(
        "Cette raison ne correspond pas au résultat sélectionné.",
      ),
    );
  }
});

test("accepts a reason compatible with the chosen outcome", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
  );

  assert.equal(result.success, true);
});

test("OTHER requires an explanation; other reasons do not", () => {
  const missingNote = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({ conversionReason: "OTHER" }),
  );
  assert.equal(missingNote.success, false);
  if (!missingNote.success) {
    const messages = missingNote.error.flatten().fieldErrors;
    assert.ok(messages.conversionReasonNote?.includes("Précisez la raison."));
  }

  const withNote = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({
      conversionReason: "OTHER",
      conversionReasonNote: "Le responsable quitte le pays pour trois mois.",
    }),
  );
  assert.equal(withNote.success, true);

  const nonOtherWithoutNote = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({ conversionReason: "DEMO_CONVINCED" }),
  );
  assert.equal(nonOtherWithoutNote.success, true);
});

// ---------------------------------------------------------------------------
// Ticket 22D — the resulting status is mandatory and never preselected
// ---------------------------------------------------------------------------

test("rejects an empty resulting status — the employee must explicitly choose one", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({ status: "" }),
  );

  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.flatten().fieldErrors;
    assert.ok(
      messages.status?.includes("Sélectionnez le statut après ce suivi."),
    );
  }
});

test("accepts an explicit resulting status equal to the current status — a same-status confirmation is a legitimate follow-up", () => {
  const result = prospectFollowUpWorkflowSchema.safeParse(
    baseInput({
      status: "CONTACTED",
      conversionOutcome: "STALLED",
      conversionReason: "NEEDS_MORE_TIME",
    }),
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "CONTACTED");
  }
});

test("rejects status = WON paired with a non-WON outcome, and status = LOST paired with a non-LOST outcome", () => {
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(
      baseInput({
        status: "WON",
        conversionOutcome: "ADVANCED",
        nextActionTitle: "",
        nextActionAssignedToUserId: "",
        nextActionDueAt: "",
      }),
    ).success,
    false,
  );
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(
      baseInput({
        status: "LOST",
        conversionOutcome: "STALLED",
        nextActionTitle: "",
        nextActionAssignedToUserId: "",
        nextActionDueAt: "",
      }),
    ).success,
    false,
  );
});

test("rejects a WON or LOST outcome on an active resulting status", () => {
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(
      baseInput({ status: "QUALIFIED", conversionOutcome: "WON" }),
    ).success,
    false,
  );
  assert.equal(
    prospectFollowUpWorkflowSchema.safeParse(
      baseInput({
        status: "QUALIFIED",
        conversionOutcome: "LOST",
        conversionReason: "PRICE_TOO_HIGH",
      }),
    ).success,
    false,
  );
});
