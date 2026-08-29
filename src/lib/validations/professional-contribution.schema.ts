import { z } from "zod";

const numericField = (message: string) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      return value.trim() === "" ? undefined : Number(value);
    }
    return value;
  }, z.number({ error: message }).int());

export const createProfessionalContributionAssessmentSchema = z.object({
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

export const assessProfessionalContributionItemSchema = z.object({
  assessmentId: z.string().trim().min(1, "L’évaluation est requise."),
  itemId: z.string().trim().min(1, "Le critère est requis."),
  // Range-checked here; the exact 1-5 integer constraint is re-enforced
  // domain-side by isValidLevel in professional-contribution.service-core.ts
  // (the actual authority — never trust client-side validation alone).
  level: numericField("Sélectionnez un niveau d’évaluation.").pipe(
    z.number().min(1, "Niveau invalide.").max(5, "Niveau invalide."),
  ),
  observation: z
    .string()
    .trim()
    .max(2000, "L’observation est trop longue.")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
});

export const submitProfessionalContributionAssessmentSchema = z.object({
  assessmentId: z.string().trim().min(1, "L’évaluation est requise."),
});

export const deleteProfessionalContributionAssessmentSchema = z.object({
  assessmentId: z.string().trim().min(1, "L’évaluation est requise."),
});

export type CreateProfessionalContributionAssessmentFormInput = z.input<
  typeof createProfessionalContributionAssessmentSchema
>;
export type ValidatedCreateProfessionalContributionAssessmentInput = z.output<
  typeof createProfessionalContributionAssessmentSchema
>;
export type ValidatedAssessProfessionalContributionItemInput = z.output<
  typeof assessProfessionalContributionItemSchema
>;
