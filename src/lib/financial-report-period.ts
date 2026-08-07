import type { FinancialReportFilter } from "@/src/lib/validations/financial-report-filter.schema";

/**
 * RELAIS operates out of Burkina Faso (Africa/Ouagadougou, UTC+0, no DST)
 * — this is the single centralized source of the reporting timezone.
 * Every day/week/month/year boundary in this file is computed relative
 * to this offset instead of scattering raw `new Date()` UTC assumptions
 * through the report service and page. If RELAIS ever needs a different
 * business timezone, this is the only constant that has to change.
 */
export const BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES = 0;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/** Shifts a UTC instant so its UTC-getters read as business-local wall-clock fields. */
function toBusinessLocal(date: Date): Date {
  return new Date(
    date.getTime() + BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES * MS_PER_MINUTE,
  );
}

/** Inverse of toBusinessLocal: turns business-local wall-clock fields back into a UTC instant. */
function fromBusinessLocal(localDate: Date): Date {
  return new Date(
    localDate.getTime() - BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES * MS_PER_MINUTE,
  );
}

function businessLocalMidnight(year: number, month: number, day: number): Date {
  return fromBusinessLocal(new Date(Date.UTC(year, month, day)));
}

/** Start of the business-local calendar day containing `date`, as a UTC instant. */
function startOfBusinessDay(date: Date): Date {
  const local = toBusinessLocal(date);
  return businessLocalMidnight(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
}

function addBusinessDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** "2026-08-06" for the business-local calendar day containing `date`. */
export function formatBusinessIsoDate(date: Date): string {
  const local = toBusinessLocal(date);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDateAsBusinessMidnight(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return businessLocalMidnight(year, month - 1, day);
}

function formatLongFrDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toBusinessLocal(date));
}

export type ResolvedFinancialReportPeriod = {
  period: FinancialReportFilter["period"];
  label: string;
  /** Inclusive start instant (UTC) of the selected period. */
  from: Date;
  /** Exclusive end instant (UTC) of the selected period. */
  toExclusive: Date;
  /** Inclusive start instant (UTC) of the immediately preceding equivalent period. */
  previousFrom: Date;
  /** Exclusive end instant (UTC) of the immediately preceding equivalent period. */
  previousToExclusive: Date;
  /** Inclusive calendar-day labels ("2026-08-01") for the DTO's period.from/period.to. */
  fromDateLabel: string;
  toDateLabel: string;
};

function toDateLabel(toExclusive: Date): string {
  return formatBusinessIsoDate(addBusinessDays(toExclusive, -1));
}

/**
 * Resolves a validated FinancialReportFilter (see
 * financial-report-filter.schema.ts) into concrete UTC instants for the
 * selected period and its previous equivalent, relative to `referenceDate`
 * ("now" — injectable for deterministic tests).
 */
export function resolveFinancialReportPeriod(
  filter: FinancialReportFilter,
  referenceDate: Date = new Date(),
): ResolvedFinancialReportPeriod {
  switch (filter.period) {
    case "today": {
      const from = startOfBusinessDay(referenceDate);
      const toExclusive = addBusinessDays(from, 1);
      return {
        period: "today",
        label: "Aujourd’hui",
        from,
        toExclusive,
        previousFrom: addBusinessDays(from, -1),
        previousToExclusive: from,
        fromDateLabel: formatBusinessIsoDate(from),
        toDateLabel: toDateLabel(toExclusive),
      };
    }

    case "week": {
      const local = toBusinessLocal(referenceDate);
      const daysSinceMonday = (local.getUTCDay() + 6) % 7;
      const from = businessLocalMidnight(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() - daysSinceMonday,
      );
      const toExclusive = addBusinessDays(from, 7);
      return {
        period: "week",
        label: "Cette semaine",
        from,
        toExclusive,
        previousFrom: addBusinessDays(from, -7),
        previousToExclusive: from,
        fromDateLabel: formatBusinessIsoDate(from),
        toDateLabel: toDateLabel(toExclusive),
      };
    }

    case "month": {
      const local = toBusinessLocal(referenceDate);
      const year = local.getUTCFullYear();
      const month = local.getUTCMonth();
      const from = businessLocalMidnight(year, month, 1);
      const toExclusive = businessLocalMidnight(year, month + 1, 1);
      return {
        period: "month",
        label: "Ce mois",
        from,
        toExclusive,
        previousFrom: businessLocalMidnight(year, month - 1, 1),
        previousToExclusive: from,
        fromDateLabel: formatBusinessIsoDate(from),
        toDateLabel: toDateLabel(toExclusive),
      };
    }

    case "year": {
      const local = toBusinessLocal(referenceDate);
      const year = local.getUTCFullYear();
      const from = businessLocalMidnight(year, 0, 1);
      const toExclusive = businessLocalMidnight(year + 1, 0, 1);
      return {
        period: "year",
        label: "Cette année",
        from,
        toExclusive,
        previousFrom: businessLocalMidnight(year - 1, 0, 1),
        previousToExclusive: from,
        fromDateLabel: formatBusinessIsoDate(from),
        toDateLabel: toDateLabel(toExclusive),
      };
    }

    case "custom": {
      const from = parseIsoDateAsBusinessMidnight(filter.from);
      const toExclusive = addBusinessDays(
        parseIsoDateAsBusinessMidnight(filter.to),
        1,
      );
      const durationMs = toExclusive.getTime() - from.getTime();
      return {
        period: "custom",
        label: `Du ${formatLongFrDate(from)} au ${formatLongFrDate(
          addBusinessDays(toExclusive, -1),
        )}`,
        from,
        toExclusive,
        previousFrom: new Date(from.getTime() - durationMs),
        previousToExclusive: from,
        fromDateLabel: formatBusinessIsoDate(from),
        toDateLabel: toDateLabel(toExclusive),
      };
    }
  }
}
