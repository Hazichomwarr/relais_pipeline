import type { ProspectStatus } from "@prisma/client";

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
