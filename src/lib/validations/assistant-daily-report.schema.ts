import { z } from "zod";

/**
 * Every field here is optional — Ticket 19B explicitly does not require
 * users to fill every textarea with "RAS". Only the shared
 * accomplishedToday/plannedTomorrow (validated in daily-report.schema.ts)
 * are ever required.
 */
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

export const assistantDailyReportDataSchema = z.object({
  documentsPrepared: optionalTemplateText(2000, "Le texte « Documents préparés ou classés »"),
  clientsFollowed: optionalTemplateText(2000, "Le texte « Clients / prospects suivis »"),
  pendingPaymentsOrSignatures: optionalTemplateText(
    2000,
    "Le texte « Paiements ou signatures en attente »",
  ),
  problemsEncountered: optionalTemplateText(2000, "Le texte « Problèmes rencontrés »"),
  managementDecisionNeeded: optionalTemplateText(
    2000,
    "Le texte « Besoin de décision de la Direction »",
  ),
});

export type AssistantDailyReportDataInput = z.input<typeof assistantDailyReportDataSchema>;
export type AssistantDailyReportData = z.output<typeof assistantDailyReportDataSchema>;
