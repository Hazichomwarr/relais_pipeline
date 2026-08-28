import { z } from "zod";

import { roleResponsibilityAssessmentLevels } from "@/src/lib/role-responsibility-catalog";

/**
 * Ticket 25I §10 — reuses the same calendar-month input shape as
 * CommercialPerformanceTarget (year/month, 1-12) rather than a
 * competing period concept; the resolver itself is reused too (see
 * role-responsibility-assessment.service.ts), not re-derived.
 */
const numericField = (message: string) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      return value.trim() === "" ? undefined : Number(value);
    }
    return value;
  }, z.number({ error: message }).int());

export const createRoleResponsibilityAssessmentSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(1, "Sélectionnez un employé.")
    .max(100, "L’identifiant de l’employé est invalide."),
  year: numericField("L’année est requise.").pipe(
    z.number().min(2020, "Année invalide.").max(2100, "Année invalide."),
  ),
  month: numericField("Le mois est requis.").pipe(
    z.number().min(1, "Mois invalide.").max(12, "Mois invalide."),
  ),
});

export const assessRoleResponsibilityItemSchema = z.object({
  assessmentId: z.string().trim().min(1, "L’évaluation est requise."),
  itemId: z.string().trim().min(1, "L’élément est requis."),
  level: z.enum(roleResponsibilityAssessmentLevels, {
    error: "Sélectionnez un niveau d’évaluation.",
  }),
  observation: z
    .string()
    .trim()
    .max(2000, "L’observation est trop longue.")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
});

export const submitRoleResponsibilityAssessmentSchema = z.object({
  assessmentId: z.string().trim().min(1, "L’évaluation est requise."),
});

export const deleteRoleResponsibilityAssessmentSchema = z.object({
  assessmentId: z.string().trim().min(1, "L’évaluation est requise."),
});

export type CreateRoleResponsibilityAssessmentFormInput = z.input<
  typeof createRoleResponsibilityAssessmentSchema
>;
export type ValidatedCreateRoleResponsibilityAssessmentInput = z.output<
  typeof createRoleResponsibilityAssessmentSchema
>;
export type ValidatedAssessRoleResponsibilityItemInput = z.output<
  typeof assessRoleResponsibilityItemSchema
>;
