export type DailyReportHistoryDateGroup<T extends { reportDate: string }> = {
  reportDate: string;
  label: string;
  items: T[];
};

function formatGroupDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcMidnight);
}

/**
 * Partitions an already reportDate-DESC-sorted history list into per-day
 * groups without re-sorting — same single-pass technique as
 * groupSharedFeedItemsByDate (shared-feed-date-grouping.ts): since the
 * input is strictly date-ordered (see compareDailyReportsForManagement),
 * same-day rows are always contiguous, so a left-to-right pass that starts
 * a new group whenever reportDate changes preserves both grouping and order.
 */
export function groupDailyReportSummariesByDate<T extends { reportDate: string }>(
  items: T[],
): DailyReportHistoryDateGroup<T>[] {
  const groups: DailyReportHistoryDateGroup<T>[] = [];

  for (const item of items) {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.reportDate === item.reportDate) {
      lastGroup.items.push(item);
      continue;
    }

    groups.push({
      reportDate: item.reportDate,
      label: formatGroupDateLabel(item.reportDate),
      items: [item],
    });
  }

  return groups;
}
