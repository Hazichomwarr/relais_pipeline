import {
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
