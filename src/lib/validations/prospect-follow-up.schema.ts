import { z } from "zod";

import { interestLevels, prospectStatuses } from "./prospect.schema";
import { isTerminalProspectStatus } from "@/src/services/prospect-status.service-core";
import {
  conversionReasonRequiresNote,
  isConversionOutcomeConsistentWithStatus,
  isConversionReasonAllowedForOutcome,
} from "@/src/services/prospect-conversion.service-core";

export const conversionOutcomes = [
  "ADVANCED",
  "STALLED",
  "WON",
  "LOST",
] as const;

export const conversionReasons = [
  "PROMOTIONAL_OFFER",
  "DEMO_CONVINCED",
  "GOOD_PRODUCT_FIT",
  "URGENT_NEED",
  "PRICE_ACCEPTABLE",
  "DECISION_MAKER_APPROVAL",
  "NO_BUDGET",
  "PRICE_TOO_HIGH",
  "DECISION_MAKER_UNAVAILABLE",
  "ALREADY_EQUIPPED",
  "NO_RESPONSE",
  "NEEDS_MORE_TIME",
  "BAD_FIT",
  "COMPETITOR",
  "OTHER",
] as const;

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

    conversionOutcome: z
      .string()
      .min(1, "Sélectionnez un résultat commercial.")
      .pipe(z.enum(conversionOutcomes, {
        error: "Sélectionnez un résultat commercial valide.",
      })),
    conversionReason: z
      .string()
      .min(1, "Sélectionnez une raison.")
      .pipe(z.enum(conversionReasons, {
        error: "Sélectionnez une raison valide.",
      })),
    conversionReasonNote: optionalText(
      500,
      "L’explication ne peut pas dépasser 500 caractères.",
    ),

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
    // Guard: if conversionOutcome/conversionReason failed their own
    // enum validation above, `data.conversionOutcome`/`conversionReason`
    // is undefined here — the field-level "required" issue already
    // covers it, and the cross-field checks below assume a real enum
    // value (isConversionReasonAllowedForOutcome indexes a lookup table
    // keyed by outcome, which would throw on undefined).
    if (data.conversionOutcome && data.conversionReason) {
      // Ticket 20D — status/outcome consistency (WON⇄WON, LOST⇄LOST,
      // ADVANCED/STALLED only for an active status).
      if (!isConversionOutcomeConsistentWithStatus(data.conversionOutcome, data.status)) {
        context.addIssue({
          code: "custom",
          path: ["conversionOutcome"],
          message:
            data.conversionOutcome === "WON" || data.conversionOutcome === "LOST"
              ? `Un résultat « ${data.conversionOutcome === "WON" ? "Gagné" : "Perdu"} » exige que le statut soit ${data.conversionOutcome === "WON" ? "Gagné" : "Perdu"}.`
              : "Ce résultat ne s’applique qu’à un prospect encore actif.",
        });
      }

      // Ticket 20D — reason must be commercially compatible with the
      // chosen outcome (never enforced only by UI filtering).
      if (!isConversionReasonAllowedForOutcome(data.conversionOutcome, data.conversionReason)) {
        context.addIssue({
          code: "custom",
          path: ["conversionReason"],
          message: "Cette raison ne correspond pas au résultat sélectionné.",
        });
      }

      // Ticket 20D — OTHER requires a written explanation.
      if (
        conversionReasonRequiresNote(data.conversionReason) &&
        !data.conversionReasonNote
      ) {
        context.addIssue({
          code: "custom",
          path: ["conversionReasonNote"],
          message: "Précisez la raison.",
        });
      }
    }

    // Ticket 20C — an active resulting status requires a concrete next
    // action.
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
