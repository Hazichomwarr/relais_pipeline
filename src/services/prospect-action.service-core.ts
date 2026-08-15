import type {
  ProspectActionStatus,
  ProspectStatus,
  UserRole,
} from "@prisma/client";

import type { ValidatedCreateProspectActionInput } from "@/src/lib/validations/prospect-action.schema";

export type ProspectActionActor = {
  id: string;
  role: UserRole;
};

export type ProspectActionRow = {
  id: string;
  prospectId: string;
  assignedToUserId: string;
  createdByUserId: string;
  status: ProspectActionStatus;
  title: string;
  description: string | null;
  dueAt: Date;
  completedAt: Date | null;
  completedByUserId: string | null;
  canceledAt: Date | null;
  canceledByUserId: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Overdue is derived, never persisted (Ticket 20B) — an OPEN action whose
 * dueAt has passed. Completed/canceled actions are never "overdue".
 */
export function isOverdueProspectAction(
  action: { status: ProspectActionStatus; dueAt: Date },
  now: Date = new Date(),
): boolean {
  return action.status === "OPEN" && action.dueAt.getTime() < now.getTime();
}

/**
 * Completable by the assignee, or by ADMIN/MANAGER for operational
 * management (Ticket 20B) — deliberately not prospect-ownership scoped,
 * since delegated actions may live on a prospect the assignee doesn't own.
 */
export function canCompleteProspectAction(
  actor: ProspectActionActor,
  action: { assignedToUserId: string },
): boolean {
  return (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER" ||
    actor.id === action.assignedToUserId
  );
}

/**
 * Cancelable by its creator, its assignee, or ADMIN/MANAGER (Ticket 20B).
 * Arbitrary COMMERCIAL users may not cancel each other's unrelated tasks.
 */
export function canCancelProspectAction(
  actor: ProspectActionActor,
  action: { createdByUserId: string; assignedToUserId: string },
): boolean {
  return (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER" ||
    actor.id === action.createdByUserId ||
    actor.id === action.assignedToUserId
  );
}

/**
 * OPEN first, then soonest due first, then newest-created first, then a
 * deterministic id tie-break — one total order across open and terminal
 * actions alike (Ticket 20B), so listings never depend on database
 * fetch order.
 */
export function compareProspectActionsForListing(
  left: ProspectActionRow,
  right: ProspectActionRow,
): number {
  const leftOpen = left.status === "OPEN";
  const rightOpen = right.status === "OPEN";

  if (leftOpen !== rightOpen) {
    return leftOpen ? -1 : 1;
  }

  const dueDiff = left.dueAt.getTime() - right.dueAt.getTime();
  if (dueDiff !== 0) {
    return dueDiff;
  }

  const createdDiff = right.createdAt.getTime() - left.createdAt.getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? 1 : -1;
}

export type CreateProspectActionFields = {
  prospectId: string;
  assignedToUserId: string;
  title: string;
  description?: string;
  dueAt: Date;
};

export type ProspectActionErrorCode =
  | "PROSPECT_NOT_FOUND"
  | "ASSIGNEE_NOT_AVAILABLE"
  | "CREATE_FAILED"
  | "NOT_FOUND"
  | "ACCESS_DENIED"
  | "ALREADY_COMPLETED"
  | "ALREADY_CANCELED"
  | "CONCURRENTLY_MODIFIED"
  | "COMPLETE_FAILED"
  | "CANCEL_FAILED";

export type CreateProspectActionResult =
  | { success: true; actionId: string }
  | { success: false; code: ProspectActionErrorCode; message: string };

export type CreateProspectActionDependencies = {
  findProspect: (prospectId: string) => Promise<{ id: string } | null>;
  findAssignee: (
    userId: string,
  ) => Promise<{ id: string; active: boolean } | null>;
  create: (
    createdByUserId: string,
    fields: CreateProspectActionFields,
  ) => Promise<{ id: string }>;
};

/**
 * Ownership for who may create on which prospect is enforced entirely by
 * which `findProspect` the caller injects (unscoped for ADMIN/MANAGER,
 * owner-scoped for COMMERCIAL) — mirrors createProspectActivityCore /
 * createCommercialActivity, so a foreign prospectId resolves to
 * PROSPECT_NOT_FOUND from the query itself, never a separate role check.
 */
export async function createProspectActionCore(
  createdByUserId: string,
  input: ValidatedCreateProspectActionInput,
  dependencies: CreateProspectActionDependencies,
): Promise<CreateProspectActionResult> {
  const prospect = await dependencies.findProspect(input.prospectId);

  if (!prospect) {
    return {
      success: false,
      code: "PROSPECT_NOT_FOUND",
      message: "Ce prospect n’existe pas ou n’est pas accessible.",
    };
  }

  const assignee = await dependencies.findAssignee(input.assignedToUserId);

  if (!assignee || !assignee.active) {
    return {
      success: false,
      code: "ASSIGNEE_NOT_AVAILABLE",
      message: "Sélectionnez un utilisateur actif pour cette action.",
    };
  }

  try {
    const action = await dependencies.create(createdByUserId, {
      prospectId: input.prospectId,
      assignedToUserId: input.assignedToUserId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
    });

    return { success: true, actionId: action.id };
  } catch (error) {
    console.error("Unable to create prospect action:", error);
    return {
      success: false,
      code: "CREATE_FAILED",
      message: "L’action n’a pas pu être créée. Veuillez réessayer.",
    };
  }
}

export type CreateProspectActionWithAutoProgressionDependencies = {
  findProspect: (
    prospectId: string,
  ) => Promise<{ id: string; status: ProspectStatus } | null>;
  findAssignee: CreateProspectActionDependencies["findAssignee"];
  create: CreateProspectActionDependencies["create"];
  /**
   * Ticket 22D — guarded update: must only flip a prospect that is still
   * NEW at write time (e.g. `updateMany({ where: { id, status: "NEW" },
   * data: { status: "TO_FOLLOW_UP" } })`), never a blind write based on
   * the findProspect read above, so a concurrent legitimate transition
   * away from NEW is never overwritten back to TO_FOLLOW_UP.
   */
  progressNewProspectToFollowUp: (
    prospectId: string,
  ) => Promise<{ count: number }>;
};

/**
 * Ticket 22D — successful standalone "Nouvelle action" creation may
 * additionally progress a still-NEW prospect to TO_FOLLOW_UP, atomically
 * with the action write (the caller must wire both dependencies against
 * the same transaction). The prospect is read once here and handed to
 * createProspectActionCore as an already-resolved lookup, exactly like
 * submitProspectFollowUpCore's `findProspect: async () => prospect`
 * pattern — one query, not two.
 *
 * Deliberately NOT reused by the structured follow-up workflow's internal
 * next-action creation (prospect-follow-up.service-core.ts calls
 * createProspectActionCore directly) — this inference is authorized only
 * for standalone action creation, never as a side effect of an explicit
 * follow-up that already asks the user for the resulting status.
 */
export async function createProspectActionWithAutoProgressionCore(
  createdByUserId: string,
  input: ValidatedCreateProspectActionInput,
  dependencies: CreateProspectActionWithAutoProgressionDependencies,
): Promise<CreateProspectActionResult> {
  const prospect = await dependencies.findProspect(input.prospectId);

  const creation = await createProspectActionCore(createdByUserId, input, {
    findProspect: async () => prospect,
    findAssignee: dependencies.findAssignee,
    create: dependencies.create,
  });

  if (creation.success && prospect?.status === "NEW") {
    await dependencies.progressNewProspectToFollowUp(input.prospectId);
  }

  return creation;
}

export type CompleteProspectActionResult =
  | { success: true; prospectId: string }
  | { success: false; code: ProspectActionErrorCode; message: string };

export type CompleteProspectActionDependencies = {
  findById: (actionId: string) => Promise<ProspectActionRow | null>;
  completeAtomically: (
    actionId: string,
    completedByUserId: string,
  ) => Promise<{ count: number }>;
};

/**
 * OPEN -> COMPLETED only. The permission and status checks run first for
 * a precise error message; the atomic conditional write (guarded on
 * status = OPEN alone) is the actual race-safety net against a second,
 * concurrent completion or cancellation — see the ledger reversal core
 * for the same shape.
 */
export async function completeProspectActionCore(
  actor: ProspectActionActor,
  actionId: string,
  dependencies: CompleteProspectActionDependencies,
): Promise<CompleteProspectActionResult> {
  const action = await dependencies.findById(actionId);

  if (!action) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette action est introuvable.",
    };
  }

  if (!canCompleteProspectAction(actor, action)) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Vous n’avez pas le droit de terminer cette action.",
    };
  }

  if (action.status === "COMPLETED") {
    return {
      success: false,
      code: "ALREADY_COMPLETED",
      message: "Cette action est déjà terminée.",
    };
  }

  if (action.status === "CANCELED") {
    return {
      success: false,
      code: "ALREADY_CANCELED",
      message: "Cette action a été annulée.",
    };
  }

  try {
    const result = await dependencies.completeAtomically(actionId, actor.id);

    if (result.count === 0) {
      return {
        success: false,
        code: "CONCURRENTLY_MODIFIED",
        message: "Cette action vient d’être modifiée par quelqu’un d’autre.",
      };
    }

    return { success: true, prospectId: action.prospectId };
  } catch (error) {
    console.error("Unable to complete prospect action:", error);
    return {
      success: false,
      code: "COMPLETE_FAILED",
      message: "Impossible de terminer cette action. Veuillez réessayer.",
    };
  }
}

export type CancelProspectActionResult =
  | { success: true; prospectId: string }
  | { success: false; code: ProspectActionErrorCode; message: string };

export type CancelProspectActionDependencies = {
  findById: (actionId: string) => Promise<ProspectActionRow | null>;
  cancelAtomically: (
    actionId: string,
    canceledByUserId: string,
    reason: string,
  ) => Promise<{ count: number }>;
};

/** OPEN -> CANCELED only. Same shape as completeProspectActionCore. */
export async function cancelProspectActionCore(
  actor: ProspectActionActor,
  actionId: string,
  reason: string,
  dependencies: CancelProspectActionDependencies,
): Promise<CancelProspectActionResult> {
  const action = await dependencies.findById(actionId);

  if (!action) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette action est introuvable.",
    };
  }

  if (!canCancelProspectAction(actor, action)) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Vous n’avez pas le droit d’annuler cette action.",
    };
  }

  if (action.status === "COMPLETED") {
    return {
      success: false,
      code: "ALREADY_COMPLETED",
      message: "Cette action est déjà terminée.",
    };
  }

  if (action.status === "CANCELED") {
    return {
      success: false,
      code: "ALREADY_CANCELED",
      message: "Cette action a déjà été annulée.",
    };
  }

  try {
    const result = await dependencies.cancelAtomically(
      actionId,
      actor.id,
      reason,
    );

    if (result.count === 0) {
      return {
        success: false,
        code: "CONCURRENTLY_MODIFIED",
        message: "Cette action vient d’être modifiée par quelqu’un d’autre.",
      };
    }

    return { success: true, prospectId: action.prospectId };
  } catch (error) {
    console.error("Unable to cancel prospect action:", error);
    return {
      success: false,
      code: "CANCEL_FAILED",
      message: "Impossible d’annuler cette action. Veuillez réessayer.",
    };
  }
}
