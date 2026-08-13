import { z } from "zod";

import { interestLevels, prospectStatuses } from "./prospect.schema";
import { isTerminalProspectStatus } from "@/src/services/prospect-status.service-core";

const optionalText = (maximum: number, message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();
      return normalized || undefined;
    },
    z.string().max(maximum, message).optional(),
  );

const optionalDate = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return new Date(value);
  }

  return value;
}, z.date({ error: "Sélectionnez une échéance valide." }).optional());

/**
 * Ticket 20C's core invariant: an active (non-terminal) resulting status
 * must leave the follow-up with a concrete next action. This is checked
 * server-side here — never only in the UI — so the rule is enforceable in
 * the domain regardless of what the client submits.
 */
export const prospectFollowUpWorkflowSchema = z
  .object({
    prospectId: z
      .string()
      .trim()
      .min(1, "Le prospect est requis.")
      .max(100, "L’identifiant du prospect est invalide."),

    note: z
      .string()
      .trim()
      .min(10, "Décrivez ce qui s’est passé lors du suivi.")
      .max(2000, "La description ne peut pas dépasser 2 000 caractères."),

    status: z.enum(prospectStatuses, {
      error: "Sélectionnez un statut valide.",
    }),
    interest: z.enum(interestLevels, {
      error: "Sélectionnez un niveau d’intérêt valide.",
    }),

    completedActionId: optionalText(
      100,
      "L’identifiant de l’action est invalide.",
    ),

    nextActionTitle: optionalText(
      200,
      "Le titre de la prochaine action ne peut pas dépasser 200 caractères.",
    ),
    nextActionAssignedToUserId: optionalText(
      100,
      "L’identifiant du responsable est invalide.",
    ),
    nextActionDueAt: optionalDate,
  })
  .superRefine((data, context) => {
    if (isTerminalProspectStatus(data.status)) {
      return;
    }

    if (!data.nextActionTitle) {
      context.addIssue({
        code: "custom",
        path: ["nextActionTitle"],
        message: "Indiquez la prochaine action.",
      });
    }

    if (!data.nextActionAssignedToUserId) {
      context.addIssue({
        code: "custom",
        path: ["nextActionAssignedToUserId"],
        message: "Attribuez la prochaine action à un membre de l’équipe.",
      });
    }

    if (!data.nextActionDueAt) {
      context.addIssue({
        code: "custom",
        path: ["nextActionDueAt"],
        message: "Indiquez une échéance.",
      });
    }
  });

export type ProspectFollowUpWorkflowFormInput = z.input<
  typeof prospectFollowUpWorkflowSchema
>;
export type ValidatedProspectFollowUpWorkflowInput = z.output<
  typeof prospectFollowUpWorkflowSchema
>;
