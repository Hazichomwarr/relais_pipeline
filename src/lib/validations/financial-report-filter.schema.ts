import { z } from "zod";

import { formatBusinessIsoDate } from "@/src/lib/financial-report-period";

export const financialReportPeriods = [
  "today",
  "week",
  "month",
  "year",
  "custom",
] as const;

export type FinancialReportPeriodKey = (typeof financialReportPeriods)[number];

export type FinancialReportFilter =
  | { period: Exclude<FinancialReportPeriodKey, "custom"> }
  | { period: "custom"; from: string; to: string };

const rawFilterSchema = z.object({
  period: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type FinancialReportFilterInput = {
  period?: string;
  from?: string;
  to?: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoCalendarDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Never throws and never fails the page. Two distinct fallback rules:
 *
 * - An unrecognized/missing `period` falls back to the safe default
 *   ("month"), the same graceful-fallback convention the rest of the
 *   dashboard's filter parsing already uses (see
 *   src/lib/follow-up-search-params.ts callers).
 * - `period=custom` with a missing or invalid range never jumps the user
 *   to a different tab — it stays in custom mode and defaults the range
 *   to today, so the date picker always renders in a usable state
 *   instead of silently reverting (a "controlled validation behavior",
 *   which the ticket allows as an alternative to a blanket month
 *   fallback).
 */
export function parseFinancialReportFilter(
  input: FinancialReportFilterInput,
  referenceDate: Date = new Date(),
): FinancialReportFilter {
  const parsed = rawFilterSchema.safeParse(input);
  const raw = parsed.success ? parsed.data : {};

  if (
    raw.period &&
    raw.period !== "custom" &&
    (financialReportPeriods as readonly string[]).includes(raw.period)
  ) {
    return { period: raw.period as Exclude<FinancialReportPeriodKey, "custom"> };
  }

  if (raw.period === "custom") {
    if (
      raw.from &&
      raw.to &&
      isValidIsoCalendarDate(raw.from) &&
      isValidIsoCalendarDate(raw.to) &&
      raw.from <= raw.to
    ) {
      return { period: "custom", from: raw.from, to: raw.to };
    }

    const today = formatBusinessIsoDate(referenceDate);
    return { period: "custom", from: today, to: today };
  }

  return { period: "month" };
}
