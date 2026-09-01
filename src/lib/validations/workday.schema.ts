import { z } from "zod";

/**
 * "YYYY-MM-DD" — the RELAIS business day being confirmed (see
 * src/lib/workday-date.ts, which normalizes this into the same
 * business-midnight instant stored as Workday.workDate). Format only —
 * the authoritative "is this actually today's business date" rule is
 * enforced server-side against server time inside
 * confirmWorkdayStartForCore, never trusted from this shape alone.
 */
const workDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Sélectionnez une date valide.");

export const confirmWorkdayStartSchema = z.object({
  employeeUserId: z
    .string()
    .trim()
    .min(1, "L’employé est requis.")
    .max(100),
  workDate: workDateSchema,
});

export type ConfirmWorkdayStartInput = z.input<typeof confirmWorkdayStartSchema>;
export type ValidatedConfirmWorkdayStartInput = z.output<
  typeof confirmWorkdayStartSchema
>;
