import { appendReturnTo } from "@/src/lib/return-to";
import type { AdjacentProspects } from "@/src/services/prospect-navigation.service-core";

export type ProspectNavigationRole = "admin" | "commercial";

export function getProspectNavigationContextLabel(
  context: AdjacentProspects["context"],
  role: ProspectNavigationRole,
): string | null {
  if (!context.assignedUserId) {
    return null;
  }

  return role === "commercial"
    ? "Navigation parmi mes prospects"
    : `Navigation parmi les prospects de ${context.assignedUserName}`;
}

export type ProspectRecordNavigationProps = {
  previousHref: string | null;
  previousLabel: string | null;
  nextHref: string | null;
  nextLabel: string | null;
  returnHref: string;
  contextLabel: string | null;
};

export function buildProspectRecordNavigationProps(params: {
  role: ProspectNavigationRole;
  basePath: string;
  adjacent: AdjacentProspects;
  safeReturnTo: string;
}): ProspectRecordNavigationProps {
  const { role, basePath, adjacent, safeReturnTo } = params;

  return {
    previousHref: adjacent.previous
      ? appendReturnTo(`${basePath}/${adjacent.previous.id}`, safeReturnTo)
      : null,
    previousLabel: adjacent.previous?.name ?? null,
    nextHref: adjacent.next
      ? appendReturnTo(`${basePath}/${adjacent.next.id}`, safeReturnTo)
      : null,
    nextLabel: adjacent.next?.name ?? null,
    returnHref: safeReturnTo,
    contextLabel: getProspectNavigationContextLabel(adjacent.context, role),
  };
}
