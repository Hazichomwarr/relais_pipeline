import {
  startOfBusinessDay,
  parseIsoDateAsBusinessMidnight,
} from "@/src/lib/financial-report-period";

/**
 * `Workday.workDate` is the RELAIS business-calendar day a declaration
 * belongs to — the same centralized business-timezone primitives
 * daily-report-date.ts already builds on, reused here rather than
 * introducing a second definition of "business day" (Ticket 27A §9/§36).
 */

/** The business-local calendar day containing `referenceDate`, normalized to that day's business midnight (a stable UTC instant, so @@unique([employeeUserId, workDate]) reliably groups same-day declarations). */
export function getCurrentWorkDate(referenceDate: Date = new Date()): Date {
  return startOfBusinessDay(referenceDate);
}

/** Parses a "YYYY-MM-DD" business date (e.g. a confirmation target date) into the same normalized business-midnight instant used to store/query workDate. */
export function resolveWorkDate(isoDate: string): Date {
  return parseIsoDateAsBusinessMidnight(isoDate);
}
