import { formatBusinessIsoDate } from "@/src/lib/financial-report-period";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Business-local ("2026-08-08") calendar-day key, reusing the same
 * Africa/Ouagadougou (UTC+0, no DST) convention as financial reporting —
 * see BUSINESS_TIMEZONE_UTC_OFFSET_MINUTES in financial-report-period.ts. */
export function getFeedDateGroupKey(occurredAt: Date): string {
  return formatBusinessIsoDate(occurredAt);
}

function formatFeedGroupDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcMidnight);
}

/** "Aujourd’hui" / "Hier" / "07 août 2026" — pure and deterministic given a
 * fixed `referenceDate`, so it renders identically on server and client. */
export function getFeedDateGroupLabel(
  occurredAt: Date,
  referenceDate: Date = new Date(),
): string {
  const key = getFeedDateGroupKey(occurredAt);
  const todayKey = getFeedDateGroupKey(referenceDate);

  if (key === todayKey) {
    return "Aujourd’hui";
  }

  const yesterdayKey = getFeedDateGroupKey(
    new Date(referenceDate.getTime() - MS_PER_DAY),
  );

  if (key === yesterdayKey) {
    return "Hier";
  }

  return formatFeedGroupDateLabel(key);
}

export type SharedFeedDateGroup<T extends { occurredAt: string }> = {
  key: string;
  label: string;
  items: T[];
};

/**
 * Partitions an already-sorted (occurredAt DESC, id DESC — Ticket 18A) feed
 * into calendar-day groups without re-sorting: since the input is strictly
 * time-ordered, same-day items are always contiguous, so a single
 * left-to-right pass that starts a new group whenever the day key changes
 * is enough to keep both "same-day items stay together" and "group order
 * follows feed order" true.
 */
export function groupSharedFeedItemsByDate<T extends { occurredAt: string }>(
  items: T[],
  referenceDate: Date = new Date(),
): SharedFeedDateGroup<T>[] {
  const groups: SharedFeedDateGroup<T>[] = [];

  for (const item of items) {
    const occurredAt = new Date(item.occurredAt);
    const key = getFeedDateGroupKey(occurredAt);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.key === key) {
      lastGroup.items.push(item);
      continue;
    }

    groups.push({
      key,
      label: getFeedDateGroupLabel(occurredAt, referenceDate),
      items: [item],
    });
  }

  return groups;
}
