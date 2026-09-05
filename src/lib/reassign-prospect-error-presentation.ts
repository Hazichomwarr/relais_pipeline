import type { ReassignProspectErrorCode } from "@/src/services/prospect-assignment-transfer.service-core";

/**
 * Ticket 28C §62 — maps 28B's stable domain error codes to deliberate UI
 * behavior. Pure and independently testable so the mapping can be proven
 * without a live dialog/DOM. `refreshCurrentState` marks the outcomes
 * where the dialog's known state (current owner, target options) may
 * already be stale — the caller should revalidate (e.g. router.refresh())
 * and must never silently retry with a different target on the caller's
 * behalf.
 */
export type ReassignProspectErrorPresentation = {
  message: string;
  refreshCurrentState: boolean;
};

const CONCURRENTLY_REASSIGNED_MESSAGE =
  "Ce prospect a été réassigné pendant que vous le consultiez. Les informations ont été actualisées. Vérifiez le responsable actuel avant de recommencer.";

const TARGET_NO_LONGER_ELIGIBLE_MESSAGE =
  "Cette personne ne peut plus recevoir ce prospect. Choisissez un autre responsable.";

const SAME_ASSIGNEE_MESSAGE = "Cette personne est déjà responsable de ce prospect.";

export function resolveReassignProspectErrorPresentation(
  code: ReassignProspectErrorCode | undefined,
  fallbackMessage: string,
): ReassignProspectErrorPresentation {
  switch (code) {
    case "CONCURRENTLY_REASSIGNED":
      return { message: CONCURRENTLY_REASSIGNED_MESSAGE, refreshCurrentState: true };

    case "TARGET_NOT_FOUND":
    case "TARGET_INACTIVE":
    case "TARGET_ROLE_NOT_ELIGIBLE":
      return { message: TARGET_NO_LONGER_ELIGIBLE_MESSAGE, refreshCurrentState: true };

    case "SAME_ASSIGNEE":
      return { message: SAME_ASSIGNEE_MESSAGE, refreshCurrentState: false };

    default:
      // PROSPECT_NOT_FOUND, ACTOR_NOT_FOUND, ACTOR_INACTIVE,
      // ACTOR_NOT_AUTHORIZED, INVALID_REASON, REASSIGN_FAILED, and an
      // authorization/validation failure caught before the core ever ran
      // (code undefined) — the core's own message is already a truthful,
      // French, non-technical description; no Prisma/transaction detail
      // ever reaches this far (28B never leaks that).
      return { message: fallbackMessage, refreshCurrentState: false };
  }
}
