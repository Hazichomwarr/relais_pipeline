import { z } from "zod";

import {
  followUpActions,
  interestLevels,
  prospectStatuses,
} from "./prospect.schema";

export const prospectActivityTypes = [
  "FIELD_VISIT",
  "PHONE_CALL",
  "WHATSAPP",
  "MEETING",
  "DEMO",
  "DOCUMENT_SENT",
  "FOLLOW_UP",
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

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.enum(values).optional(),
  );

const optionalDate = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return new Date(`${value}T12:00:00`);
  }

  return value;
}, z.date({ error: "Sélectionnez une date de suivi valide." }).optional());

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
  agentName: optionalText(
    100,
    "Le nom du commercial ne peut pas dépasser 100 caractères.",
  ),
  interest: optionalEnum(interestLevels),
  status: optionalEnum(prospectStatuses),
  nextAction: optionalEnum(followUpActions),
  followUpDate: optionalDate,
});

export type ProspectActivityFormInput = z.input<
  typeof prospectActivitySchema
>;
export type ValidatedProspectActivityInput = z.output<
  typeof prospectActivitySchema
>;
