import type { DailyReportTemplateType } from "@prisma/client";

import {
  assistantDailyReportDataSchema,
  type AssistantDailyReportData,
} from "@/src/lib/validations/assistant-daily-report.schema";
import {
  operationsCoordinatorDailyReportDataSchema,
  type OperationsCoordinatorDailyReportData,
} from "@/src/lib/validations/operations-coordinator-daily-report.schema";

export type DailyReportTemplateData =
  | AssistantDailyReportData
  | OperationsCoordinatorDailyReportData;

function schemaForTemplate(templateType: DailyReportTemplateType) {
  return templateType === "ASSISTANT"
    ? assistantDailyReportDataSchema
    : operationsCoordinatorDailyReportDataSchema;
}

export type ParseDailyReportTemplateDataResult =
  | { success: true; data: DailyReportTemplateData }
  | { success: false; message: string };

/**
 * Validates client-submitted template payload shape against a
 * server-resolved templateType — DailyReport.templateType at update time,
 * or the authenticated User's current assignment at creation time. Never
 * dispatches on a client-claimed templateType field (there isn't one:
 * createDailyReportSchema/updateDailyReportSchema don't accept it).
 */
export function parseDailyReportTemplateData(
  templateType: DailyReportTemplateType,
  data: unknown,
): ParseDailyReportTemplateDataResult {
  const parsed = schemaForTemplate(templateType).safeParse(data ?? {});

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations du rapport sont invalides.",
    };
  }

  return { success: true, data: parsed.data };
}

/**
 * Normalizes template payload already persisted in the database (trusted —
 * previously written by parseDailyReportTemplateData, or null for a
 * pre-19B report created before this column existed) into a fully typed,
 * default-filled shape for reading/rendering.
 */
export function hydrateDailyReportTemplateData(
  templateType: DailyReportTemplateType,
  raw: unknown,
): DailyReportTemplateData {
  return schemaForTemplate(templateType).parse(raw ?? {});
}
