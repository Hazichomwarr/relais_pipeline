import type { ProspectStatus } from "@prisma/client";

export const pipelineStatuses = [
  "NEW",
  "TO_FOLLOW_UP",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
] as const satisfies readonly ProspectStatus[];

export type PipelineItem = {
  status: ProspectStatus;
  count: number;
  percentage: number;
};

export function conversionRate(won: number, lost: number) {
  const closedProspects = won + lost;
  return closedProspects === 0 ? null : (won / closedProspects) * 100;
}

export function pipelinePercentage(count: number, total: number) {
  return total === 0 ? 0 : (count / total) * 100;
}

export function buildPipeline(
  counts: Partial<Record<ProspectStatus, number>>,
): PipelineItem[] {
  const total = pipelineStatuses.reduce(
    (sum, status) => sum + (counts[status] ?? 0),
    0,
  );

  return pipelineStatuses.map((status) => ({
    status,
    count: counts[status] ?? 0,
    percentage: pipelinePercentage(counts[status] ?? 0, total),
  }));
}

export function performanceColor(value: number | null) {
  if (value === null) {
    return "neutral" as const;
  }
  if (value >= 60) {
    return "positive" as const;
  }
  if (value >= 30) {
    return "warning" as const;
  }
  return "critical" as const;
}

export function followUpPriority(overdueDays: number | null) {
  if (overdueDays === null) {
    return "undated" as const;
  }
  if (overdueDays > 0) {
    return "overdue" as const;
  }
  if (overdueDays === 0) {
    return "today" as const;
  }
  return "upcoming" as const;
}

export function dashboardGreeting(firstName: string, date = new Date()) {
  const hour = date.getHours();
  const greeting = hour >= 18 ? "Bonsoir" : "Bonjour";
  return `${greeting}, ${firstName.trim()}`;
}
