import type { ProspectActivityType, ProspectStatus } from "@prisma/client";

import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import type { ValidatedProspectFollowUpWorkflowInput } from "@/src/lib/validations/prospect-follow-up.schema";
import {
  buildWonTransitionActivityData,
  isWonTransition,
} from "@/src/services/prospect-won-transition.service-core";
import { isTerminalProspectStatus } from "@/src/services/prospect-status.service-core";
import {
  completeProspectActionCore,
  createProspectActionCore,
  type CompleteProspectActionDependencies,
  type CreateProspectActionDependencies,
  type ProspectActionErrorCode,
} from "@/src/services/prospect-action.service-core";

export type ProspectFollowUpErrorCode =
  | "PROSPECT_NOT_FOUND"
  | "NEXT_ACTION_REQUIRED"
  | "SUBMIT_FAILED"
  | ProspectActionErrorCode;

export type SubmitProspectFollowUpResult =
  | { success: true }
  | { success: false; code: ProspectFollowUpErrorCode; message: string };

type FollowUpActivityData = {
  prospectId: string;
  type: ProspectActivityType;
  summary: string;
  occurredAt: Date;
  agentName: string | undefined;
};

type ProspectFollowUpStateUpdates = {
  status: ProspectStatus;
  interest: ValidatedProspectFollowUpWorkflowInput["interest"];
  followUpDate?: Date;
};

/**
 * Everything a follow-up submission can touch, scoped to one already-open
 * transaction. `findProspect`/`updateProspect` are ownership-scoped by the
 * caller (unscoped for ADMIN/MANAGER, owner-scoped for COMMERCIAL) exactly
 * like createCommercialActivity — this core never re-derives ownership.
 */
export type ProspectFollowUpTransactionContext = {
  findProspect: (
    prospectId: string,
  ) => Promise<{ id: string; status: ProspectStatus } | null>;
  updateProspect: (
    prospectId: string,
    data: ProspectFollowUpStateUpdates,
  ) => Promise<void>;
  createActivity: (data: FollowUpActivityData) => Promise<{ id: string }>;
} & CompleteProspectActionDependencies &
  CreateProspectActionDependencies;

export type ProspectFollowUpWorkflowDependencies = {
  runTransaction: <T>(
    work: (tx: ProspectFollowUpTransactionContext) => Promise<T>,
  ) => Promise<T>;
};

/**
 * Thrown from inside the transaction callback to force a Prisma rollback —
 * returning a `{success:false}` object from an interactive transaction's
 * callback still COMMITS whatever ran before it, so every failure path
 * below must throw, never just return early. Caught once at the bottom
 * and translated back into the controlled result callers expect (same
 * shape as reverseLedgerEntryCore's concurrency-error convention).
 */
class ProspectFollowUpWorkflowFailure extends Error {
  constructor(
    public readonly code: ProspectFollowUpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProspectFollowUpWorkflowFailure";
  }
}

/**
 * Ticket 20C's core invariant, enforced here (not only by
 * prospectFollowUpWorkflowSchema's superRefine) so it holds even if a
 * future caller reaches this function without going through that schema —
 * "enforceable in the domain, not just suggested in the UI".
 */
function assertNextActionPresentWhenActive(
  input: ValidatedProspectFollowUpWorkflowInput,
): asserts input is ValidatedProspectFollowUpWorkflowInput & {
  nextActionTitle: string;
  nextActionAssignedToUserId: string;
  nextActionDueAt: Date;
} {
  if (isTerminalProspectStatus(input.status)) {
    return;
  }

  if (
    !input.nextActionTitle ||
    !input.nextActionAssignedToUserId ||
    !input.nextActionDueAt
  ) {
    throw new ProspectFollowUpWorkflowFailure(
      "NEXT_ACTION_REQUIRED",
      "Une prochaine action est requise tant que le prospect est actif.",
    );
  }
}

/**
 * One commercial follow-up, applied atomically: complete a selected
 * existing action, update status/interest (+ WON_TRANSITION if crossing
 * into WON), record the FOLLOW_UP activity, and — for an active resulting
 * status — create the next accountable ProspectAction. Any failure at any
 * step rolls back the entire submission; nothing partially persists.
 */
export async function submitProspectFollowUpCore(
  actor: AuthenticatedUser,
  input: ValidatedProspectFollowUpWorkflowInput,
  dependencies: ProspectFollowUpWorkflowDependencies,
): Promise<SubmitProspectFollowUpResult> {
  try {
    assertNextActionPresentWhenActive(input);

    await dependencies.runTransaction(async (tx) => {
      const prospect = await tx.findProspect(input.prospectId);

      if (!prospect) {
        throw new ProspectFollowUpWorkflowFailure(
          "PROSPECT_NOT_FOUND",
          "Ce prospect n’existe pas ou n’est pas accessible.",
        );
      }

      if (input.completedActionId) {
        const completion = await completeProspectActionCore(
          actor,
          input.completedActionId,
          tx,
        );

        if (!completion.success) {
          throw new ProspectFollowUpWorkflowFailure(
            completion.code,
            completion.message,
          );
        }
      }

      let nextActionDueAt: Date | undefined;

      if (!isTerminalProspectStatus(input.status)) {
        const creation = await createProspectActionCore(
          actor.id,
          {
            prospectId: input.prospectId,
            assignedToUserId: input.nextActionAssignedToUserId,
            title: input.nextActionTitle,
            dueAt: input.nextActionDueAt,
          },
          {
            findProspect: async () => prospect,
            findAssignee: tx.findAssignee,
            create: tx.create,
          },
        );

        if (!creation.success) {
          throw new ProspectFollowUpWorkflowFailure(
            creation.code,
            creation.message,
          );
        }

        // Ticket 20C compatibility projection: followUpDate keeps the
        // legacy /admin/follow-ups queue useful. Prospect.nextAction (the
        // enum) is intentionally left untouched — ProspectAction.title is
        // free text, and no truthful mapping to the legacy enum exists.
        nextActionDueAt = input.nextActionDueAt;
      }

      await tx.updateProspect(input.prospectId, {
        status: input.status,
        interest: input.interest,
        ...(nextActionDueAt ? { followUpDate: nextActionDueAt } : {}),
      });

      const agentName = `${actor.firstName} ${actor.lastName}`;
      const occurredAt = new Date();

      await tx.createActivity({
        prospectId: input.prospectId,
        type: "FOLLOW_UP",
        summary: input.note,
        occurredAt,
        agentName,
      });

      if (isWonTransition(prospect.status, input.status)) {
        await tx.createActivity(
          buildWonTransitionActivityData({
            prospectId: input.prospectId,
            occurredAt,
            agentName,
          }),
        );
      }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof ProspectFollowUpWorkflowFailure) {
      return { success: false, code: error.code, message: error.message };
    }

    console.error("Unable to submit prospect follow-up:", error);

    return {
      success: false,
      code: "SUBMIT_FAILED",
      message: "Le suivi n’a pas pu être enregistré. Veuillez réessayer.",
    };
  }
}
