import { z } from "zod";

// Ticket 22B — FOLLOW_UP deliberately excluded. That type, and every
// commercial-state mutation (status/interest/next action), belong solely to
// the structured follow-up workflow (prospectFollowUpWorkflowSchema) — see
// prospect-follow-up.service-core.ts's invariants (next action required
// while active, outcome/reason consistency), none of which this generic
// interaction path enforces or should attempt to duplicate.
export const prospectActivityTypes = [
  "FIELD_VISIT",
  "PHONE_CALL",
  "WHATSAPP",
  "MEETING",
  "DEMO",
  "DOCUMENT_SENT",
  "INTERNAL_NOTE",
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

export const prospectActivitySchema = z.object({
  prospectId: z.string().trim().min(1, "Le prospect est requis.").max(100),
  type: z
    .string()
    .min(1, "Sélectionnez un type d’interaction.")
    .pipe(
      z.enum(prospectActivityTypes, {
        error: "Sélectionnez un type d’interaction valide.",
      }),
    ),
  summary: z
    .string()
    .trim()
    .min(3, "Le résumé doit contenir au moins 3 caractères.")
    .max(200, "Le résumé ne peut pas dépasser 200 caractères."),
  details: optionalText(
    2000,
    "Les détails ne peuvent pas dépasser 2 000 caractères.",
  ),
  occurredAt: z
    .preprocess(
      (value) => {
        if (value instanceof Date) {
          return value;
        }

        if (typeof value === "string" && value.trim()) {
          return new Date(value);
        }

        return value;
      },
      z.date({ error: "Sélectionnez une date et une heure valides." }),
    )
    .refine(
      (date) => date.getTime() <= Date.now() + 24 * 60 * 60 * 1000,
      "La date de l’interaction est trop éloignée dans le futur.",
    ),
});

export type ProspectActivityFormInput = z.input<
  typeof prospectActivitySchema
>;
export type ValidatedProspectActivityInput = z.output<
  typeof prospectActivitySchema
>;
