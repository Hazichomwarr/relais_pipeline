// src/lib/validations/report.schema.ts

import { z } from "zod";

export const prospectTypes = [
  "restaurant",
  "gym",
  "salon",
  "tech-shop",
  "store",
  "office",
  "clinic",
  "barbershop",
  "school",
  "property",
  "savings",
  "other",
] as const;

export const onlinePlatforms = [
  "appel",
  "whatsapp",
  "social-media",
  "website",
  "none",
] as const;

export const interestLevels = [
  "not-interested",
  "maybe",
  "needs-information",
  "interested",
  "ready-to-discuss",
] as const;

export const CreateReportSchema = z.object({
  entreprise: z.string().trim().min(2, "Le nom de l’entreprise est requis."),

  type: z.enum(prospectTypes, {
    error: "Sélectionnez un type de prospect.",
  }),

  contact: z.string().trim().min(5, "Le contact est requis."),

  interest: z.enum(interestLevels, {
    error: "Sélectionnez un niveau d’intérêt.",
  }),

  agent: z.string().trim().min(2, "Le nom du commercial est requis."),

  notes: z
    .string()
    .trim()
    .min(15, "Ajoutez une note d’au moins 15 caractères."),

  platform: z.enum(onlinePlatforms, {
    error: "Sélectionnez la présence actuelle en ligne.",
  }),
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;
