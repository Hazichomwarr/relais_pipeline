import { z } from "zod";

export const dailyReportTemplateTypes = [
  "ASSISTANT",
  "OPERATIONS_COORDINATOR",
] as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "YYYY-MM-DD" — the Burkina Faso business day the report concerns (see
 * src/lib/daily-report-date.ts, which normalizes this into the stored
 * reportDate instant one layer below). A report can never concern a day
 * that hasn't happened yet.
 */
const reportDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Sélectionnez une date valide.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day) <= Date.now() + ONE_DAY_MS;
  }, "La date du rapport ne peut pas être dans le futur.");

/**
 * Shared core content (Ticket 19A). A DRAFT may temporarily leave these
 * blank for autosave; submission enforces non-blank, meaningful text one
 * layer down, in the service (see submitOwnDailyReportCore) — never here,
 * since a schema alone can't see whether a report is a draft or a resubmit.
 */
const dailyReportContentSchema = z.object({
  accomplishedToday: z
    .string()
    .trim()
    .max(4000, "Le texte « Réalisé aujourd’hui » est trop long.")
    .optional()
    .default(""),
  plannedTomorrow: z
    .string()
    .trim()
    .max(4000, "Le texte « Prévu demain » est trop long.")
    .optional()
    .default(""),
});

/**
 * Never accepts ownerUserId, templateType, status, or submittedAt — those
 * are server/domain controlled (owner comes from the authenticated
 * session, templateType is snapshotted from User.dailyReportTemplateType,
 * status/submittedAt only ever change through the submission workflow).
 */
export const createDailyReportSchema = dailyReportContentSchema.extend({
  reportDate: reportDateSchema,
});

export const updateDailyReportSchema = dailyReportContentSchema.extend({
  reportId: z.string().trim().min(1, "Le rapport est requis.").max(100),
});

export const submitDailyReportSchema = z.object({
  reportId: z.string().trim().min(1, "Le rapport est requis.").max(100),
});

export type CreateDailyReportFormInput = z.input<typeof createDailyReportSchema>;
export type ValidatedCreateDailyReportInput = z.output<
  typeof createDailyReportSchema
>;
export type UpdateDailyReportFormInput = z.input<typeof updateDailyReportSchema>;
export type ValidatedUpdateDailyReportInput = z.output<
  typeof updateDailyReportSchema
>;
export type ValidatedSubmitDailyReportInput = z.output<
  typeof submitDailyReportSchema
>;
