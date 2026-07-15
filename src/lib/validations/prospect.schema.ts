import { z } from "zod";

export const relaisProducts = [
  "KARMDA",
  "LOKARI",
  "NIA",
  "DIGITAL_SERVICES",
] as const;

export const interestLevels = [
  "NOT_INTERESTED",
  "MAYBE",
  "NEEDS_INFORMATION",
  "INTERESTED",
  "READY_TO_DISCUSS",
] as const;

export const prospectStatuses = [
  "NEW",
  "TO_FOLLOW_UP",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
] as const;

export const followUpActions = [
  "CALL_BACK",
  "VISIT_AGAIN",
  "SEND_DEMO",
  "SCHEDULE_MEETING",
  "NO_ACTION",
] as const;

export const onlinePresenceOptions = [
  "NONE",
  "WHATSAPP",
  "SOCIAL_MEDIA",
  "WEBSITE",
  "MULTIPLE",
] as const;

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const optionalPositiveInteger = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return Number(value);
}, z.number().int("Le nombre doit être un entier.").nonnegative("Le nombre ne peut pas être négatif.").optional());

export const prospectSchema = z
  .object({
    product: z
      .string()
      .min(1, "Sélectionnez un produit RELAIS.")
      .pipe(z.enum(relaisProducts)),

    name: z
      .string()
      .trim()
      .min(2, "Le nom du prospect est requis.")
      .max(150, "Le nom est trop long."),

    prospectType: z
      .string()
      .trim()
      .min(2, "Sélectionnez un type de prospect.")
      .max(100),

    contactName: optionalText,

    phone: z
      .string()
      .trim()
      .min(8, "Le numéro de téléphone est requis.")
      .max(30, "Le numéro de téléphone est trop long."),

    location: optionalText,

    interest: z
      .string()
      .min(1, "Sélectionnez le niveau d’intérêt.")
      .pipe(z.enum(interestLevels)),

    status: z.enum(prospectStatuses).default("NEW"),

    onlinePresence: z.enum(onlinePresenceOptions).optional(),

    nextAction: z.enum(followUpActions).optional(),

    followUpDate: z.preprocess(
      (value) => {
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
      },
      z
        .date({
          error: "Sélectionnez une date valide.",
        })
        .optional(),
    ),

    notes: z
      .string()
      .trim()
      .min(10, "Ajoutez au moins quelques détails sur la visite.")
      .max(2000, "Les notes sont trop longues."),

    agentName: z
      .string()
      .trim()
      .min(2, "Le nom du commercial est requis.")
      .max(100),

    // KARMDA
    schoolType: optionalText,
    estimatedStudentCount: optionalPositiveInteger,
    currentSchoolSystem: optionalText,
    contactRole: optionalText,

    // LOKARI
    propertyOwnerType: optionalText,
    estimatedPropertyCount: optionalPositiveInteger,
    propertyCountries: optionalText,
    currentPropertySystem: optionalText,

    // NIA
    savingsGroupType: optionalText,
    estimatedMemberCount: optionalPositiveInteger,
    contributionFrequency: optionalText,
    currentSavingsSystem: optionalText,

    // DIGITAL SERVICES
    businessCategory: optionalText,
    requestedService: optionalText,
  })
  .superRefine((data, context) => {
    if (data.product === "KARMDA" && !data.schoolType) {
      context.addIssue({
        code: "custom",
        path: ["schoolType"],
        message: "Sélectionnez le type d’établissement.",
      });
    }

    if (data.product === "LOKARI" && !data.propertyOwnerType) {
      context.addIssue({
        code: "custom",
        path: ["propertyOwnerType"],
        message: "Sélectionnez le type de prospect immobilier.",
      });
    }

    if (data.product === "NIA" && !data.savingsGroupType) {
      context.addIssue({
        code: "custom",
        path: ["savingsGroupType"],
        message: "Sélectionnez le type de groupe.",
      });
    }

    if (data.product === "DIGITAL_SERVICES" && !data.businessCategory) {
      context.addIssue({
        code: "custom",
        path: ["businessCategory"],
        message: "Sélectionnez le type d’activité.",
      });
    }
  });

export type ProspectFormInput = z.input<typeof prospectSchema>;
export type ValidatedProspectInput = z.output<typeof prospectSchema>;
