import { z } from "zod";

/**
 * The RELAIS daily prospecting objectives (Ticket 19B) — operational
 * targets, not authorization rules. A count may exceed its target; the
 * only consequence of missing one is that submission requires an explicit
 * installation/training exception with a justification.
 */
export const DIGITAL_SERVICES_PROSPECTING_TARGET = 3;
export const KARMDA_SCHOOL_PROSPECTING_TARGET = 1;

function optionalTemplateText(maxLength: number, label: string) {
  return z.preprocess((value) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      return value;
    }
    return value.trim();
  }, z.string().max(maxLength, `${label} est trop long.`).optional().default(""));
}

/**
 * Absent/blank during a draft (autosave-friendly) is represented as null —
 * distinct from 0, which means "the employee reported zero prospects".
 * Submission-time presence is enforced in validateOperationsCoordinatorSubmission,
 * not here, mirroring how accomplishedToday/plannedTomorrow are optional
 * at the schema layer and required only at submission (Ticket 19A).
 */
const prospectingCount = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}, z
  .number()
  .int("Le nombre doit être un entier.")
  .min(0, "Le nombre ne peut pas être négatif.")
  .nullable()
  .default(null));

const prospectingExceptionFlag = z.preprocess(
  (value) => (value === null || value === undefined ? false : value),
  z.boolean(),
).default(false);

export const operationsCoordinatorDailyReportDataSchema = z.object({
  digitalServicesProspects: prospectingCount,
  karmdaSchoolProspects: prospectingCount,
  prospectingException: prospectingExceptionFlag,
  prospectingExceptionReason: optionalTemplateText(2000, "La justification"),
  pendingItems: optionalTemplateText(2000, "Le texte « En attente »"),
  problemsEncountered: optionalTemplateText(2000, "Le texte « Problèmes rencontrés »"),
  managementDecisionNeeded: optionalTemplateText(
    2000,
    "Le texte « Besoin de décision de la Direction »",
  ),
});

export type OperationsCoordinatorDailyReportDataInput = z.input<
  typeof operationsCoordinatorDailyReportDataSchema
>;
export type OperationsCoordinatorDailyReportData = z.output<
  typeof operationsCoordinatorDailyReportDataSchema
>;

export function isProspectingTargetMet(
  data: Pick<
    OperationsCoordinatorDailyReportData,
    "digitalServicesProspects" | "karmdaSchoolProspects"
  >,
): boolean {
  return (
    (data.digitalServicesProspects ?? 0) >= DIGITAL_SERVICES_PROSPECTING_TARGET &&
    (data.karmdaSchoolProspects ?? 0) >= KARMDA_SCHOOL_PROSPECTING_TARGET
  );
}

export type OperationsCoordinatorSubmissionValidation =
  | { valid: true }
  | { valid: false; message: string };

/**
 * The submission-time prospecting rule (Ticket 19B): both targets met, or
 * an explicit installation/training exception with a meaningful reason.
 * Shared with the client form (for live feedback) as well as
 * daily-report.service-core.ts (the actual enforcement) — never trust a
 * client-side pass of this check as the real guard.
 */
export function validateOperationsCoordinatorSubmission(
  data: OperationsCoordinatorDailyReportData,
): OperationsCoordinatorSubmissionValidation {
  if (data.digitalServicesProspects === null) {
    return {
      valid: false,
      message: "Indiquez le nombre de prospects Services Digitaux.",
    };
  }

  if (data.karmdaSchoolProspects === null) {
    return {
      valid: false,
      message: "Indiquez le nombre d’écoles KARMDA prospectées.",
    };
  }

  if (isProspectingTargetMet(data)) {
    return { valid: true };
  }

  if (!data.prospectingException) {
    return {
      valid: false,
      message:
        "L’objectif de prospection n’est pas atteint. Ajoutez une justification si une installation ou formation a occupé la journée.",
    };
  }

  if (!data.prospectingExceptionReason.trim()) {
    return { valid: false, message: "La justification est requise." };
  }

  return { valid: true };
}
