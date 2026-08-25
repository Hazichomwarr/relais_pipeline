import type { InterestLevel, ProspectStatus } from "@prisma/client";

/**
 * Ticket 20A named this domain fact but deliberately left it undecided
 * where to centralize it. Ticket 20C is the first consumer (the
 * mandatory-next-action rule) — this is the single source of truth so it
 * never gets reimplemented as `status === "WON" || status === "LOST"`
 * scattered across services/components.
 */
const TERMINAL_PROSPECT_STATUSES: ReadonlySet<ProspectStatus> = new Set([
  "WON",
  "LOST",
]);

export function isTerminalProspectStatus(status: ProspectStatus): boolean {
  return TERMINAL_PROSPECT_STATUSES.has(status);
}

/**
 * Ticket 15H.4 first defined "interested" for the Admin dashboard's
 * "Prospects intéressés" KPI (component/dashboard/KpiCards.tsx) as an
 * inline array-includes check. Ticket 20F needs the exact same
 * definition for funnel analytics — centralized here so the two never
 * silently drift into two different meanings of "interested".
 */
const INTERESTED_LEVELS: ReadonlySet<InterestLevel> = new Set([
  "INTERESTED",
  "READY_TO_DISCUSS",
]);

export function isInterestedProspect(interest: InterestLevel): boolean {
  return INTERESTED_LEVELS.has(interest);
}

/**
 * Ticket 25E's "Prêts à discuter" Admin dashboard KPI: the single
 * structured interest value for the strongest, immediately actionable
 * interest level — READY_TO_DISCUSS in prisma/schema.prisma, labeled
 * "✅ Prêt à discuter" in src/lib/constants/prospect-options.ts. Deliberately
 * narrower than isInterestedProspect above; the two answer different
 * questions and must not be merged.
 */
export function isReadyToDiscussProspect(interest: InterestLevel): boolean {
  return interest === "READY_TO_DISCUSS";
}

export function computeReadyToDiscussSummary(
  prospects: { interest: InterestLevel }[],
): { count: number; percentage: number } {
  const count = prospects.filter((prospect) =>
    isReadyToDiscussProspect(prospect.interest),
  ).length;

  const percentage =
    prospects.length === 0 ? 0 : Math.round((count / prospects.length) * 100);

  return { count, percentage };
}
