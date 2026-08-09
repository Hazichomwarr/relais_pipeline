import {
  addBusinessDays,
  formatBusinessIsoDate,
  parseIsoDateAsBusinessMidnight,
  startOfBusinessDay,
} from "@/src/lib/financial-report-period";

/**
 * `DailyReport.reportDate` represents the Burkina Faso business calendar
 * day a report concerns, not when it was created or submitted. Both
 * helpers below delegate to financial-report-period.ts — the single
 * centralized source of the RELAIS business timezone (Ticket 17A) — so
 * this domain never introduces a second definition of "business day".
 */

/** The business-local calendar day containing `referenceDate`, normalized to that day's business midnight (a stable UTC instant, so @@unique([ownerUserId, reportDate]) reliably groups same-day reports). */
export function getCurrentBusinessDate(referenceDate: Date = new Date()): Date {
  return startOfBusinessDay(referenceDate);
}

/** Parses a "YYYY-MM-DD" business date (e.g. from a form field) into the same normalized business-midnight instant used to store/query reportDate. */
export function resolveDailyReportDate(isoDate: string): Date {
  return parseIsoDateAsBusinessMidnight(isoDate);
}

export { formatBusinessIsoDate as formatDailyReportIsoDate };

/**
 * "9 août 2026" — long French date for a reportDate. Formatted against the
 * "UTC" Intl timeZone deliberately: BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES is
 * 0 (Africa/Ouagadougou has no offset from UTC), so business-local wall
 * time and UTC wall time are the same values by construction — this is not
 * a shortcut, it's the one case where "UTC" *is* the business timezone.
 */
export function formatLongDailyReportDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "16:47" — business-local time of day for an instant like submittedAt. */
export function formatDailyReportTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

/**
 * An inclusive N-business-day window ending on today's business date
 * (Ticket 19C's "7 derniers jours" / "30 derniers jours" history filters).
 * Both bounds are normalized reportDate-comparable instants, so
 * listDailyReportsForManagement's gte/lte range matches exactly — no
 * separate "exclusive end" bookkeeping is needed since reportDate values
 * are always exact business-midnight instants, not continuous time spans.
 */
export function resolveDailyReportHistoryRange(
  days: number,
  referenceDate: Date = new Date(),
): { dateFrom: Date; dateTo: Date } {
  const today = getCurrentBusinessDate(referenceDate);
  return { dateFrom: addBusinessDays(today, -(days - 1)), dateTo: today };
}
