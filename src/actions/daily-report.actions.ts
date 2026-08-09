"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import { resolveDailyReportDate } from "@/src/lib/daily-report-date";
import {
  createDailyReportSchema,
  submitDailyReportSchema,
  updateDailyReportSchema,
} from "@/src/lib/validations/daily-report.schema";
import {
  createOwnDailyReport,
  submitOwnDailyReport,
  updateOwnDailyReport,
} from "@/src/services/daily-report.service";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";

export type DailyReportActionResult =
  | { success: true; reportId: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function createDailyReportAction(
  values: unknown,
): Promise<DailyReportActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = createDailyReportSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const result = await createOwnDailyReport(authorization.user.id, {
    reportDate: resolveDailyReportDate(parsed.data.reportDate),
    accomplishedToday: parsed.data.accomplishedToday,
    plannedTomorrow: parsed.data.plannedTomorrow,
  });

  return finishMutation(result);
}

export async function updateDailyReportAction(
  values: unknown,
): Promise<DailyReportActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = updateDailyReportSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const { reportId, ...input } = parsed.data;
  const result = await updateOwnDailyReport(authorization.user.id, reportId, input);

  return finishMutation(result);
}

export async function submitDailyReportAction(
  values: unknown,
): Promise<DailyReportActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = submitDailyReportSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const result = await submitOwnDailyReport(
    authorization.user.id,
    parsed.data.reportId,
  );

  return finishMutation(result);
}

function validationFailure(
  fieldErrors: Record<string, string[] | undefined>,
): DailyReportActionResult {
  return {
    success: false,
    message: "Certaines informations du rapport sont invalides.",
    fieldErrors,
  };
}

function finishMutation(
  result:
    | Awaited<ReturnType<typeof createOwnDailyReport>>
    | Awaited<ReturnType<typeof updateOwnDailyReport>>
    | Awaited<ReturnType<typeof submitOwnDailyReport>>,
): DailyReportActionResult {
  if (!result.success) {
    return { success: false, message: result.message };
  }

  // Ticket 19B/19C route names are not final yet — /reports (employee
  // "Mes rapports" + "Rapport du jour") and /reports/daily are the planned
  // convention; revalidating them now costs nothing ahead of those pages.
  revalidatePath("/reports");
  revalidatePath("/reports/daily");

  return result;
}
