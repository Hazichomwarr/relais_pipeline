import type { UserRole } from "@prisma/client";

import { canOwnProspect } from "@/src/services/prospect-creation.service-core";
import { PROSPECT_REASSIGNMENT_ROLES } from "@/src/services/authorization.service-core";
import type { ValidatedReassignProspectInput } from "@/src/lib/validations/prospect-assignment-transfer.schema";

/**
 * Ticket 28B §14 — reuses PROSPECT_OWNER_ROLES (via canOwnProspect)
 * rather than defining a competing eligibility list: the audit found
 * ADMIN and MANAGER can already own a prospect through creation, so
 * narrowing reassignment targets to COMMERCIAL-only would be a
 * regression, not a tightening.
 */
export function canReceiveProspectAssignment(target: {
  role: UserRole;
  active: boolean;
}): boolean {
  return target.active && canOwnProspect(target.role);
}

export type ReassignProspectActorLookup = {
  id: string;
  active: boolean;
  role: UserRole;
};

export type ReassignProspectTargetLookup = {
  id: string;
  active: boolean;
  role: UserRole;
};

export type ReassignProspectLookup = {
  id: string;
  assignedUserId: string | null;
};

export type ReassignProspectErrorCode =
  | "ACTOR_NOT_FOUND"
  | "ACTOR_INACTIVE"
  | "ACTOR_NOT_AUTHORIZED"
  | "PROSPECT_NOT_FOUND"
  | "TARGET_NOT_FOUND"
  | "TARGET_INACTIVE"
  | "TARGET_ROLE_NOT_ELIGIBLE"
  | "SAME_ASSIGNEE"
  | "INVALID_REASON"
  | "CONCURRENTLY_REASSIGNED"
  | "REASSIGN_FAILED";

export type ReassignProspectResult =
  | { success: true }
  | { success: false; code: ReassignProspectErrorCode; message: string };

export type ReassignProspectDependencies = {
  /**
   * Ticket 28A §13/§51 — resolved fresh from the database inside this
   * operation, never trusted from the caller's session/JWT. An ADMIN or
   * MANAGER whose account was deactivated after their session was issued
   * must be rejected here, not merely by a coarser route-level role check.
   */
  findActor: (actorId: string) => Promise<ReassignProspectActorLookup | null>;
  findProspect: (prospectId: string) => Promise<ReassignProspectLookup | null>;
  /** Ticket 28B §49/§50 — resolved fresh, same reasoning as findActor. */
  findTarget: (userId: string) => Promise<ReassignProspectTargetLookup | null>;
  /**
   * Ticket 28B §28-30 — the concurrency guard: must only succeed if
   * `assignedUserId` still equals `expectedCurrentOwnerId` at write time
   * (e.g. `updateMany({ where: { id, assignedUserId: expectedCurrentOwnerId
   * }, data: { assignedUserId: newAssignedUserId } })`). `count: 0` means
   * someone else changed it first — the caller must report a conflict,
   * never silently retry against the newly-discovered value.
   */
  reassignAtomically: (
    prospectId: string,
    expectedCurrentOwnerId: string | null,
    newAssignedUserId: string,
  ) => Promise<{ count: number }>;
  /**
   * Ticket 28B §27 — must run in the same transaction as
   * reassignAtomically's write; the caller is responsible for that
   * transactional wiring (see prospect-assignment-transfer.service.ts).
   */
  recordTransfer: (fields: {
    prospectId: string;
    fromUserId: string | null;
    toUserId: string;
    changedByUserId: string;
    reason: string;
  }) => Promise<{ id: string }>;
};

/**
 * Ticket 28B — the single authoritative operation for changing a
 * prospect's current responsible user. Every fact this writes is
 * server-derived: `fromUserId` is read from the prospect itself inside
 * this operation, `changedByUserId` is the freshly-resolved actor, and
 * `occurredAt` is left to the persistence layer's server default — none
 * of these are ever accepted from `input` (28B §22/§72).
 *
 * Deliberately unaware of prospect status, ProspectAction, ProspectActivity,
 * or any historical/credit field — Prospect.status/interest/followUpDate/
 * nextAction are untouched by construction (this function never reads or
 * writes them), and no dependency here can reach ProspectAction or
 * ProspectActivity at all. Terminal (WON/LOST) prospects are reassignable
 * for the same structural reason: nothing here gates on status (28B §18).
 */
export async function reassignProspectCore(
  actorId: string,
  input: ValidatedReassignProspectInput,
  dependencies: ReassignProspectDependencies,
): Promise<ReassignProspectResult> {
  // Defense in depth: prospectFollowUpWorkflowSchema-style trimming and
  // non-blank enforcement already happens in reassignProspectSchema, but
  // this core must not trust a caller that bypassed that schema either.
  const reason = input.reason.trim();
  if (!reason) {
    return {
      success: false,
      code: "INVALID_REASON",
      message: "La raison de la réaffectation est requise.",
    };
  }

  const actor = await dependencies.findActor(actorId);

  if (!actor) {
    return {
      success: false,
      code: "ACTOR_NOT_FOUND",
      message: "Votre compte est introuvable.",
    };
  }

  if (!actor.active) {
    return {
      success: false,
      code: "ACTOR_INACTIVE",
      message: "Votre compte est désactivé.",
    };
  }

  if (!PROSPECT_REASSIGNMENT_ROLES.includes(actor.role)) {
    return {
      success: false,
      code: "ACTOR_NOT_AUTHORIZED",
      message: "Vous n’avez pas le droit de réaffecter un prospect.",
    };
  }

  const prospect = await dependencies.findProspect(input.prospectId);

  if (!prospect) {
    return {
      success: false,
      code: "PROSPECT_NOT_FOUND",
      message: "Ce prospect n’existe pas.",
    };
  }

  const target = await dependencies.findTarget(input.newAssignedUserId);

  if (!target) {
    return {
      success: false,
      code: "TARGET_NOT_FOUND",
      message: "Ce nouveau responsable est introuvable.",
    };
  }

  // Ticket 28B §15/§17 — target eligibility is checked, current-owner
  // eligibility never is: an inactive or role-ineligible current owner
  // must still be transferable away from, but an ineligible target must
  // never receive new responsibility.
  if (!target.active) {
    return {
      success: false,
      code: "TARGET_INACTIVE",
      message: "Ce nouveau responsable est désactivé.",
    };
  }

  if (!canReceiveProspectAssignment(target)) {
    return {
      success: false,
      code: "TARGET_ROLE_NOT_ELIGIBLE",
      message: "Ce nouveau responsable ne peut pas recevoir de prospect.",
    };
  }

  // Ticket 28B §25 — an explicit no-op, never a silent success, never a
  // history row for a non-change.
  if (prospect.assignedUserId === target.id) {
    return {
      success: false,
      code: "SAME_ASSIGNEE",
      message: "Ce prospect est déjà assigné à cet utilisateur.",
    };
  }

  try {
    const update = await dependencies.reassignAtomically(
      prospect.id,
      prospect.assignedUserId,
      target.id,
    );

    if (update.count === 0) {
      return {
        success: false,
        code: "CONCURRENTLY_REASSIGNED",
        message:
          "Ce prospect vient d’être réaffecté par quelqu’un d’autre. Veuillez réessayer.",
      };
    }

    await dependencies.recordTransfer({
      prospectId: prospect.id,
      fromUserId: prospect.assignedUserId,
      toUserId: target.id,
      changedByUserId: actor.id,
      reason,
    });

    return { success: true };
  } catch (error) {
    console.error("Unable to reassign prospect:", error);
    return {
      success: false,
      code: "REASSIGN_FAILED",
      message: "La réaffectation n’a pas pu être enregistrée. Veuillez réessayer.",
    };
  }
}
