import type {
  ProspectActivityType,
  ProspectStatus,
  UserRole,
} from "@prisma/client";

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

/** The authoritative Prospect fields resolveWonCredit needs — read inside the same transaction as the WON transition itself (Ticket 25H.1 §32), never outside it. */
export type WonCreditSource = {
  assignedUserId: string | null;
  assignedUser: { firstName: string; lastName: string; role: UserRole } | null;
};

export type WonCreditSnapshot = {
  creditedUserId: string | null;
  creditedUserNameAtEvent: string | null;
  creditedUserRoleAtEvent: UserRole | null;
};

/**
 * Ticket 25H.1 — commercial result credit follows the prospect's
 * authoritative assigned owner at the moment of the WON transition, never
 * the actor who happened to submit the closing follow-up. This is 25G's
 * central finding made structural: a MANAGER or ADMIN closing a deal on a
 * COMMERCIAL's behalf must not become the credited party (§18), while a
 * COMMERCIAL closing their own prospect naturally credits themself (§19)
 * simply because they're also the assigned owner — no special-casing
 * needed for either case.
 *
 * No fallback to the actor when unassigned (§12): an unassigned prospect
 * that becomes WON legitimately has no credited employee, represented as
 * null on every field, never fabricated. The credited person's role is
 * snapshotted as-is regardless of whether it's eligible for any future
 * scoring engine (§5) — attribution is a truthful historical fact,
 * independent of today's scoring policy.
 */
export function resolveWonCredit(
  prospect: WonCreditSource,
): WonCreditSnapshot {
  if (!prospect.assignedUserId || !prospect.assignedUser) {
    return {
      creditedUserId: null,
      creditedUserNameAtEvent: null,
      creditedUserRoleAtEvent: null,
    };
  }

  return {
    creditedUserId: prospect.assignedUserId,
    creditedUserNameAtEvent: `${prospect.assignedUser.firstName} ${prospect.assignedUser.lastName}`,
    creditedUserRoleAtEvent: prospect.assignedUser.role,
  };
}

export function buildWonTransitionActivityData(params: {
  prospectId: string;
  occurredAt: Date;
  agentName?: string;
  credit: WonCreditSnapshot;
}) {
  return {
    prospectId: params.prospectId,
    type: WON_TRANSITION_ACTIVITY_TYPE,
    summary: "Le prospect est devenu client (statut WON).",
    occurredAt: params.occurredAt,
    agentName: params.agentName,
    creditedUserId: params.credit.creditedUserId,
    creditedUserNameAtEvent: params.credit.creditedUserNameAtEvent,
    creditedUserRoleAtEvent: params.credit.creditedUserRoleAtEvent,
  };
}
