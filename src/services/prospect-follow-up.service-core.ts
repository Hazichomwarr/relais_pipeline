import type {
  ProspectActivityType,
  ProspectConversionOutcome,
  ProspectConversionReason,
  ProspectStatus,
  UserRole,
} from "@prisma/client";

import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import type { ValidatedProspectFollowUpWorkflowInput } from "@/src/lib/validations/prospect-follow-up.schema";
import {
  buildWonTransitionActivityData,
  isWonTransition,
  resolveWonCredit,
} from "@/src/services/prospect-won-transition.service-core";
import { isTerminalProspectStatus } from "@/src/services/prospect-status.service-core";
import {
  conversionReasonRequiresNote,
  isConversionOutcomeConsistentWithStatus,
  isConversionReasonAllowedForOutcome,
} from "@/src/services/prospect-conversion.service-core";
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
  | "CONVERSION_OUTCOME_STATUS_MISMATCH"
  | "CONVERSION_REASON_NOT_ALLOWED"
  | "CONVERSION_REASON_NOTE_REQUIRED"
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
  conversionOutcome?: ProspectConversionOutcome;
  conversionReason?: ProspectConversionReason;
  conversionReasonNote?: string;
  // Ticket 25H.1 — only ever set by the WON_TRANSITION branch below; the
  // ordinary FOLLOW_UP activity created every submission never sets these.
  creditedUserId?: string | null;
  creditedUserNameAtEvent?: string | null;
  creditedUserRoleAtEvent?: UserRole | null;
  // Ticket 28A.1 — set on every activity this workflow creates (the
  // ordinary FOLLOW_UP row AND the WON_TRANSITION row), unlike
  // creditedUserId above which stays WON-only. Always the prospect's
  // assignedUserId read inside this same transaction, never the actor.
  responsibleUserIdAtEvent?: string | null;
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
  findProspect: (prospectId: string) => Promise<{
    id: string;
    status: ProspectStatus;
    // Ticket 25H.1 — the authoritative ownership state resolveWonCredit
    // needs, read inside this same transaction so credit always reflects
    // the owner observed at the transition boundary, never a stale or
    // out-of-transaction read.
    assignedUserId: string | null;
    assignedUser: {
      firstName: string;
      lastName: string;
      role: UserRole;
    } | null;
  } | null>;
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
 * Ticket 20D's status/outcome/reason consistency rules, enforced here as
 * well as by prospectFollowUpWorkflowSchema's superRefine — the same
 * "domain, not just UI" guarantee as assertNextActionPresentWhenActive.
 */
function assertConversionConsistency(
  input: ValidatedProspectFollowUpWorkflowInput,
): void {
  if (
    !isConversionOutcomeConsistentWithStatus(
      input.conversionOutcome,
      input.status,
    )
  ) {
    throw new ProspectFollowUpWorkflowFailure(
      "CONVERSION_OUTCOME_STATUS_MISMATCH",
      "Le résultat commercial ne correspond pas au statut sélectionné.",
    );
  }

  if (
    !isConversionReasonAllowedForOutcome(
      input.conversionOutcome,
      input.conversionReason,
    )
  ) {
    throw new ProspectFollowUpWorkflowFailure(
      "CONVERSION_REASON_NOT_ALLOWED",
      "Cette raison ne correspond pas au résultat sélectionné.",
    );
  }

  if (
    conversionReasonRequiresNote(input.conversionReason) &&
    !input.conversionReasonNote
  ) {
    throw new ProspectFollowUpWorkflowFailure(
      "CONVERSION_REASON_NOTE_REQUIRED",
      "Précisez la raison.",
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
    assertConversionConsistency(input);

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
        conversionOutcome: input.conversionOutcome,
        conversionReason: input.conversionReason,
        conversionReasonNote: input.conversionReasonNote,
        // Ticket 28A.1 — the same in-transaction Prospect read
        // resolveWonCredit uses below, never the acting user (agentName
        // above), so a Manager recording this on a Commercial's prospect
        // still attributes historical responsibility to that Commercial.
        responsibleUserIdAtEvent: prospect.assignedUserId,
      });

      if (isWonTransition(prospect.status, input.status)) {
        await tx.createActivity(
          buildWonTransitionActivityData({
            prospectId: input.prospectId,
            occurredAt,
            agentName,
            credit: resolveWonCredit(prospect),
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
