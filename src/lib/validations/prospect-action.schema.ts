import { z } from "zod";

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

const dueAtDate = z.preprocess((value) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return new Date(value);
  }

  return value;
}, z.date({ error: "Sélectionnez une date d’échéance valide." }));

export const createProspectActionSchema = z.object({
  prospectId: z
    .string()
    .trim()
    .min(1, "Le prospect est requis.")
    .max(100, "L’identifiant du prospect est invalide."),
  assignedToUserId: z
    .string()
    .trim()
    .min(1, "Sélectionnez un responsable.")
    .max(100, "L’identifiant du responsable est invalide."),
  title: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères.")
    .max(200, "Le titre ne peut pas dépasser 200 caractères."),
  description: optionalText(
    2000,
    "La description ne peut pas dépasser 2 000 caractères.",
  ),
  dueAt: dueAtDate,
});

export type ProspectActionFormInput = z.input<typeof createProspectActionSchema>;
export type ValidatedCreateProspectActionInput = z.output<
  typeof createProspectActionSchema
>;

export const completeProspectActionSchema = z.object({
  actionId: z
    .string()
    .trim()
    .min(1, "L’action est requise.")
    .max(100, "L’identifiant de l’action est invalide."),
});

export type ValidatedCompleteProspectActionInput = z.output<
  typeof completeProspectActionSchema
>;

export const cancelProspectActionSchema = z.object({
  actionId: z
    .string()
    .trim()
    .min(1, "L’action est requise.")
    .max(100, "L’identifiant de l’action est invalide."),
  cancellationReason: z
    .string()
    .trim()
    .min(5, "Précisez la raison de l’annulation.")
    .max(500, "La raison est trop longue."),
});

export type CancelProspectActionFormInput = z.input<
  typeof cancelProspectActionSchema
>;
export type ValidatedCancelProspectActionInput = z.output<
  typeof cancelProspectActionSchema
>;
