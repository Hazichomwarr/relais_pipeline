import type { ProspectActivityType, ProspectStatus } from "@prisma/client";

/**
 * A WON feed event may only ever be derived from an explicit historical
 * ProspectActivity record (Ticket 18A) — never from Prospect.status alone,
 * since that field is silently overwritten on every follow-up update with
 * no trace of who changed it or when. This is the single place that
 * decides whether a status mutation crosses into WON, so every write path
 * (the interaction form and the follow-up modal) stays consistent about
 * what counts as "becoming a client."
 */
export function isWonTransition(
  previousStatus: ProspectStatus,
  nextStatus: ProspectStatus | undefined,
): boolean {
  return nextStatus === "WON" && previousStatus !== "WON";
}

export const WON_TRANSITION_ACTIVITY_TYPE: ProspectActivityType =
  "WON_TRANSITION";

export function buildWonTransitionActivityData(params: {
  prospectId: string;
  occurredAt: Date;
  agentName?: string;
}) {
  return {
    prospectId: params.prospectId,
    type: WON_TRANSITION_ACTIVITY_TYPE,
    summary: "Le prospect est devenu client (statut WON).",
    occurredAt: params.occurredAt,
    agentName: params.agentName,
  };
}
