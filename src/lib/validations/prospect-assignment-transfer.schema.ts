import { z } from "zod";

/**
 * Ticket 28B — the only input this mutation ever accepts. No `fromUserId`,
 * `changedByUserId`, `actorRole`, `targetRole`, or `occurredAt` field
 * exists here on purpose: every authoritative fact is server-derived
 * inside reassignProspectCore, never trusted from the caller (28A §61-63,
 * 28B §22/§72).
 */
export const reassignProspectSchema = z.object({
  prospectId: z
    .string()
    .trim()
    .min(1, "Le prospect est requis.")
    .max(100, "L’identifiant du prospect est invalide."),

  newAssignedUserId: z
    .string()
    .trim()
    .min(1, "Sélectionnez un nouveau responsable.")
    .max(100, "L’identifiant du responsable est invalide."),

  // Same trim/min/max shape as ProspectAction.cancellationReason — the
  // closest existing free-text audit-reason precedent in this repo. No
  // reason enum (28B §24).
  reason: z
    .string()
    .trim()
    .min(5, "Précisez la raison de la réaffectation.")
    .max(500, "La raison est trop longue."),
});

export type ReassignProspectFormInput = z.input<typeof reassignProspectSchema>;
export type ValidatedReassignProspectInput = z.output<
  typeof reassignProspectSchema
>;
