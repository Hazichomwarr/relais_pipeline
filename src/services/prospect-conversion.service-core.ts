import type {
  ProspectConversionOutcome,
  ProspectConversionReason,
  ProspectStatus,
} from "@prisma/client";

import { isTerminalProspectStatus } from "@/src/services/prospect-status.service-core";

/**
 * Advancement/WON reasons. Kept out of STALLED/LOST — a "budget" reason
 * can't explain why an opportunity moved forward, and a "good fit" reason
 * can't explain why it stalled.
 */
const ADVANCEMENT_REASONS: readonly ProspectConversionReason[] = [
  "PROMOTIONAL_OFFER",
  "DEMO_CONVINCED",
  "GOOD_PRODUCT_FIT",
  "URGENT_NEED",
  "PRICE_ACCEPTABLE",
  "DECISION_MAKER_APPROVAL",
];

/**
 * Stall/LOST reasons. NEEDS_MORE_TIME is deliberately excluded from LOST
 * (see below) — "wants more time" describes a still-alive opportunity,
 * not a closed one.
 */
const SETBACK_REASONS: readonly ProspectConversionReason[] = [
  "NO_BUDGET",
  "PRICE_TOO_HIGH",
  "DECISION_MAKER_UNAVAILABLE",
  "ALREADY_EQUIPPED",
  "NO_RESPONSE",
  "NEEDS_MORE_TIME",
  "BAD_FIT",
  "COMPETITOR",
];

/**
 * The outcome → allowed-reasons matrix — the authoritative source of
 * "core analytics integrity" this ticket cares about. OTHER is a
 * universal escape hatch, valid for every outcome, but requires
 * conversionReasonNote (see conversionReasonRequiresNote below).
 */
const REASONS_BY_OUTCOME: Record<
  ProspectConversionOutcome,
  ReadonlySet<ProspectConversionReason>
> = {
  ADVANCED: new Set([...ADVANCEMENT_REASONS, "OTHER"]),
  WON: new Set([...ADVANCEMENT_REASONS, "OTHER"]),
  STALLED: new Set([...SETBACK_REASONS, "OTHER"]),
  LOST: new Set([
    ...SETBACK_REASONS.filter((reason) => reason !== "NEEDS_MORE_TIME"),
    "OTHER",
  ]),
};

export function isConversionReasonAllowedForOutcome(
  outcome: ProspectConversionOutcome,
  reason: ProspectConversionReason,
): boolean {
  return REASONS_BY_OUTCOME[outcome].has(reason);
}

export function listConversionReasonsForOutcome(
  outcome: ProspectConversionOutcome,
): ProspectConversionReason[] {
  return [...REASONS_BY_OUTCOME[outcome]];
}

/**
 * Ticket 20D's status/outcome consistency rules:
 * - outcome WON requires status WON, and vice versa;
 * - outcome LOST requires status LOST, and vice versa;
 * - ADVANCED/STALLED only ever apply to an active (non-terminal) status —
 *   Ticket 20A found no enforced status transition state machine, so this
 *   does not require status to numerically "move forward", only that it
 *   isn't already closed out.
 */
export function isConversionOutcomeConsistentWithStatus(
  outcome: ProspectConversionOutcome,
  status: ProspectStatus,
): boolean {
  if (outcome === "WON") {
    return status === "WON";
  }
  if (outcome === "LOST") {
    return status === "LOST";
  }
  // ADVANCED / STALLED
  return !isTerminalProspectStatus(status);
}

export function conversionReasonRequiresNote(
  reason: ProspectConversionReason,
): boolean {
  return reason === "OTHER";
}
