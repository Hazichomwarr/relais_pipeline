import { z } from "zod";

/**
 * "YYYY-MM-DD" — the RELAIS business day the task is intended for (see
 * src/lib/workday-date.ts, which normalizes this into the same
 * business-midnight instant stored as DailyTask.workDate). Format only —
 * the authoritative "is this date allowed" rule (no past dates) is
 * enforced server-side against server time inside assignTaskCore, never
 * trusted from this shape alone.
 */
const workDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Sélectionnez une date valide.");

export const assignDailyTaskSchema = z.object({
  assignedToUserId: z
    .string()
    .trim()
    .min(1, "L’employé est requis.")
    .max(100),
  workDate: workDateSchema,
  content: z
    .string()
    .trim()
    .min(1, "Décrivez la tâche à assigner.")
    .max(500, "La description de la tâche est trop longue."),
});

export const completeDailyTaskSchema = z.object({
  taskId: z.string().trim().min(1, "La tâche est requise.").max(100),
});

export const uncompleteDailyTaskSchema = completeDailyTaskSchema;

export const cancelDailyTaskSchema = z.object({
  taskId: z.string().trim().min(1, "La tâche est requise.").max(100),
  cancellationReason: z
    .string()
    .trim()
    .min(1, "Indiquez la raison de l’annulation.")
    .max(500, "La raison de l’annulation est trop longue."),
});

export type AssignDailyTaskInput = z.input<typeof assignDailyTaskSchema>;
export type ValidatedAssignDailyTaskInput = z.output<typeof assignDailyTaskSchema>;
export type CancelDailyTaskInput = z.input<typeof cancelDailyTaskSchema>;
export type ValidatedCancelDailyTaskInput = z.output<typeof cancelDailyTaskSchema>;
