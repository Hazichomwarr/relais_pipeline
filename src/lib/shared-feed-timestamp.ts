const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Business timezone is Africa/Ouagadougou (UTC+0, no DST — see
 * financial-report-period.ts), so formatting with timeZone: "UTC" is exact
 * and never depends on the host machine's local timezone. */
function formatExactDatePart(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatExactTimePart(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatSharedFeedExactTimestamp(date: Date): string {
  return `${formatExactDatePart(date)} · ${formatExactTimePart(date)}`;
}

export type SharedFeedTimestamp = {
  /** The primary label shown on the card — relative for recent items,
   * exact otherwise. */
  display: string;
  /** Always available (e.g. as a `title` attribute) — "keep exact date/time
   * available where useful". */
  exact: string;
  iso: string;
};

/**
 * Computed once, server-side, from a fixed `referenceDate` — never a live
 * ticking clock — so the exact same string is sent in the initial HTML and
 * expected at hydration. No client-side re-computation, no mismatch.
 */
export function formatSharedFeedTimestamp(
  occurredAt: Date,
  referenceDate: Date = new Date(),
): SharedFeedTimestamp {
  const exact = formatSharedFeedExactTimestamp(occurredAt);
  const iso = occurredAt.toISOString();
  const diffMs = referenceDate.getTime() - occurredAt.getTime();

  if (diffMs < 0) {
    return { display: exact, exact, iso };
  }

  if (diffMs < MS_PER_MINUTE) {
    return { display: "À l’instant", exact, iso };
  }

  if (diffMs < MS_PER_HOUR) {
    const minutes = Math.floor(diffMs / MS_PER_MINUTE);
    return { display: `Il y a ${minutes} min`, exact, iso };
  }

  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR);
    return { display: `Il y a ${hours} h`, exact, iso };
  }

  return { display: exact, exact, iso };
}
