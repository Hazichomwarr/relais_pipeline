import { z } from "zod";

/**
 * Ticket 25H.2A — a required, strictly positive integer (§13: `0`
 * represents "intentionally no target," expressed by the absence of a
 * row, never by a `0` value on one).
 */
const targetWinsSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : Number(value);
  }
  return value;
}, z
  .number({ error: "L’objectif est requis." })
  .int("L’objectif doit être un nombre entier.")
  .positive("L’objectif doit être supérieur à zéro."));

const yearSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : Number(value);
  }
  return value;
}, z
  .number({ error: "L’année est requise." })
  .int()
  .min(2020, "Année invalide.")
  .max(2100, "Année invalide."));

const monthSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : Number(value);
  }
  return value;
}, z
  .number({ error: "Le mois est requis." })
  .int()
  .min(1, "Mois invalide.")
  .max(12, "Mois invalide."));

export const createCommercialPerformanceTargetSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, "Sélectionnez un employé.")
    .max(100, "L’identifiant de l’employé est invalide."),
  year: yearSchema,
  month: monthSchema,
  targetWins: targetWinsSchema,
});

export const updateCommercialPerformanceTargetSchema = z.object({
  targetId: z.string().trim().min(1, "L’objectif est requis."),
  targetWins: targetWinsSchema,
});

export const deleteCommercialPerformanceTargetSchema = z.object({
  targetId: z.string().trim().min(1, "L’objectif est requis."),
});

export type CreateCommercialPerformanceTargetFormInput = z.input<
  typeof createCommercialPerformanceTargetSchema
>;
export type ValidatedCreateCommercialPerformanceTargetInput = z.output<
  typeof createCommercialPerformanceTargetSchema
>;
export type UpdateCommercialPerformanceTargetFormInput = z.input<
  typeof updateCommercialPerformanceTargetSchema
>;
export type ValidatedUpdateCommercialPerformanceTargetInput = z.output<
  typeof updateCommercialPerformanceTargetSchema
>;
