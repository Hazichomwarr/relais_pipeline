import assert from "node:assert/strict";
import test from "node:test";

import {
  interestLevels,
  prospectStatuses,
} from "@/src/lib/validations/prospect.schema";
import {
  isFollowUpQueueCandidate,
  isOverdue,
} from "@/src/lib/follow-up-presentation";
import { pipelineStatuses } from "@/src/lib/commercial-dashboard-presentation";
import { isWonTransition } from "@/src/services/prospect-won-transition.service-core";
import { buildFollowUpQueueWhere } from "@/src/services/follow-up.service-core";
import { buildProspectWhere } from "@/src/services/prospect-read.service-core";

/**
 * Ticket 20A — locks the audited commercial-domain foundation in place.
 * `Prospect.status` is the CRM's one funnel/pipeline field (see the
 * domain map in prisma/schema.prisma); these tests exist so a future
 * change can't silently widen/narrow that enum, decouple the pipeline
 * presentation from it, or reintroduce role/product coupling into the
 * funnel-adjacent core functions without a test failing.
 */

test("existing status regression — the funnel enum is exactly the seven audited values", () => {
  assert.deepEqual(prospectStatuses, [
    "NEW",
    "TO_FOLLOW_UP",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "WON",
    "LOST",
  ]);
});

test("existing status regression — the Commercial dashboard pipeline stays in sync with the status enum", () => {
  assert.deepEqual([...pipelineStatuses], [...prospectStatuses]);
});

test("interest regression — the receptiveness enum is exactly the five audited values", () => {
  assert.deepEqual(interestLevels, [
    "NOT_INTERESTED",
    "MAYBE",
    "NEEDS_INFORMATION",
    "INTERESTED",
    "READY_TO_DISCUSS",
  ]);
});

test("follow-up regression — TO_FOLLOW_UP is a queue-priority flag, not a funnel stage: it queues a prospect with no scheduled date at all", () => {
  const today = new Date("2026-08-13T12:00:00");

  assert.equal(
    isFollowUpQueueCandidate({ status: "TO_FOLLOW_UP", followUpDate: null }, today),
    true,
  );
  assert.equal(
    isFollowUpQueueCandidate({ status: "NEW", followUpDate: null }, today),
    false,
  );
});

test("follow-up regression — every non-terminal status queues once its followUpDate is due, and none does before it's due", () => {
  const today = new Date("2026-08-13T12:00:00");
  const overdue = new Date("2026-08-10T12:00:00");
  const future = new Date("2026-08-20T12:00:00");

  for (const status of prospectStatuses.filter(
    (value) => value !== "WON" && value !== "LOST",
  )) {
    assert.equal(
      isFollowUpQueueCandidate({ status, followUpDate: overdue }, today),
      true,
      `${status} should queue once overdue`,
    );
    assert.equal(
      isFollowUpQueueCandidate({ status, followUpDate: future }, today),
      status === "TO_FOLLOW_UP",
      `${status} should only queue ahead of schedule via the TO_FOLLOW_UP flag`,
    );
  }
});

test("follow-up regression — WON and LOST never queue, regardless of followUpDate", () => {
  const today = new Date("2026-08-13T12:00:00");
  const overdue = new Date("2026-08-01T12:00:00");

  for (const status of ["WON", "LOST"] as const) {
    assert.equal(
      isFollowUpQueueCandidate({ status, followUpDate: overdue }, today),
      false,
    );
    assert.equal(
      isFollowUpQueueCandidate({ status, followUpDate: null }, today),
      false,
    );
  }

  assert.equal(isOverdue(overdue, today), true);
});

test("WON regression — isWonTransition still fires only on the crossing into WON, for every other status", () => {
  for (const previousStatus of prospectStatuses.filter(
    (status) => status !== "WON",
  )) {
    assert.equal(isWonTransition(previousStatus, "WON"), true);
  }
  assert.equal(isWonTransition("WON", "WON"), false);
});

test("ownership regression — the follow-up queue predicate never inspects who owns the prospect", () => {
  const where = buildFollowUpQueueWhere({ userId: "any-owner-id" });
  const andClauses = where.AND as object[];

  for (const clause of andClauses) {
    assert.equal(
      JSON.stringify(clause).includes("role"),
      false,
      "queue predicate must stay role-blind (ADMIN/MANAGER/COMMERCIAL alike)",
    );
  }
  assert.deepEqual(andClauses.at(-1), { assignedUserId: "any-owner-id" });
});

test("product regression — the prospect and follow-up filters treat every RelaisProduct identically", () => {
  const products = ["KARMDA", "LOKARI", "NIA", "DIGITAL_SERVICES"] as const;

  for (const product of products) {
    assert.deepEqual(buildProspectWhere({ product }), { product });
    assert.deepEqual(
      (buildFollowUpQueueWhere({ product }).AND as object[]).at(-1),
      { product },
    );
  }
});
