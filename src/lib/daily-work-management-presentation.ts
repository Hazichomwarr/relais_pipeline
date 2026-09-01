import {
  resolveWorkdayDisplayState,
  type WorkdayDisplayState,
} from "@/src/lib/daily-work-presentation";
import type { DailyWorkAgent } from "@/src/services/daily-work-management.service";

/**
 * Ticket 27G — pure presentation logic for "Journées des agents." Reuses
 * 27F's resolveWorkdayDisplayState rather than re-deriving a second
 * interpretation of the same timestamp tuple. No authorization decisions
 * live here — DailyWorkAgent.canConfirmStart/canAssignTask/task.canCancel
 * are already resolved by the 27G read composition using the real 27C/27E
 * authority helpers; this file only orders and labels.
 */

/**
 * "Needs attention" ordering (27G §45): a started-but-unconfirmed day is
 * simply actionable, never framed as a "problem." Within a tier, stable
 * alphabetical order by last/first name so the roster doesn't reshuffle
 * unpredictably between renders.
 */
const DISPLAY_STATE_PRIORITY: Record<WorkdayDisplayState, number> = {
  STARTED_UNCONFIRMED: 0,
  STARTED_CONFIRMED: 1,
  NOT_STARTED: 2,
  ENDED_UNCONFIRMED: 3,
  ENDED_CONFIRMED: 4,
};

export function sortAgentsForManagement(agents: DailyWorkAgent[]): DailyWorkAgent[] {
  return [...agents].sort((left, right) => {
    const priorityDiff =
      DISPLAY_STATE_PRIORITY[resolveWorkdayDisplayState(left.workday)] -
      DISPLAY_STATE_PRIORITY[resolveWorkdayDisplayState(right.workday)];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const leftName = `${left.user.lastName} ${left.user.firstName}`;
    const rightName = `${right.user.lastName} ${right.user.firstName}`;
    return leftName.localeCompare(rightName, "fr", { sensitivity: "base" });
  });
}

/**
 * 27G §18: first employee awaiting an action from the current actor
 * (canConfirmStart), otherwise the first employee in the already-sorted
 * roster. A simple, stable default — never randomized, never recomputed
 * from anything but the current render's own data.
 */
/**
 * 27G §14/§59 — one short, consistent French label per state, reused by
 * both the agent row and the detail panel so the two never drift. Status
 * is never conveyed by color alone (§59) — every caller pairs this text
 * with its dot indicator, never the dot in isolation.
 */
export function getWorkdayStateLabel(state: WorkdayDisplayState): string {
  switch (state) {
    case "NOT_STARTED":
      return "Pas encore commencée";
    case "STARTED_UNCONFIRMED":
      return "En attente de confirmation";
    case "STARTED_CONFIRMED":
      return "Journée en cours";
    case "ENDED_UNCONFIRMED":
      return "Journée terminée";
    case "ENDED_CONFIRMED":
      return "Journée terminée";
  }
}

/** Tailwind classes for the small state dot — neutral/amber/emerald/muted, matching 27F's palette (§15). */
export function getWorkdayStateDotClassName(state: WorkdayDisplayState): string {
  switch (state) {
    case "NOT_STARTED":
      return "bg-slate-300";
    case "STARTED_UNCONFIRMED":
      return "bg-amber-400";
    case "STARTED_CONFIRMED":
      return "bg-emerald-500";
    case "ENDED_UNCONFIRMED":
      return "bg-slate-400";
    case "ENDED_CONFIRMED":
      return "bg-slate-400";
  }
}

export function resolveDefaultSelectedAgentId(
  sortedAgents: DailyWorkAgent[],
): string | null {
  const awaitingAction = sortedAgents.find((agent) => agent.canConfirmStart);
  if (awaitingAction) {
    return awaitingAction.user.id;
  }
  return sortedAgents[0]?.user.id ?? null;
}
