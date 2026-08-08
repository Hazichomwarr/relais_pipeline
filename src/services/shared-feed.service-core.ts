import type {
  ProspectActivityType,
  RelaisProduct,
  UserRole,
  UserStatusActivityType,
} from "@prisma/client";

/**
 * Ticket 18A — the four approved À la une event families, and nothing
 * else. In particular:
 *
 * - FOLLOW_UP_SCHEDULED is intentionally absent. Prospect.nextAction and
 *   Prospect.followUpDate are mutable current-state fields with no audit
 *   trail of prior values, and neither status-mutation path persists the
 *   scheduled date onto the ProspectActivity row that triggers it. There is
 *   no reliable historical record of "a follow-up was scheduled for X" —
 *   only of the follow-up itself having taken place (FOLLOW_UP_COMPLETED,
 *   sourced from ProspectActivity rows explicitly logged with
 *   type = "FOLLOW_UP"). Scheduling support can be added later behind a
 *   dedicated recording hook, but nothing today can back it honestly.
 * - Prospect creation, status changes in general, and interest changes are
 *   out of V1 scope by ticket instruction, not by a data limitation.
 */
export type SharedFeedItemType =
  | "PROSPECT_INTERACTION"
  | "FOLLOW_UP_COMPLETED"
  | "PROSPECT_WON"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED";

export type SharedFeedEntityRef = { kind: "PROSPECT"; id: string };

type SharedFeedItemBase = {
  id: string;
  occurredAt: string;
};

/**
 * Carried on every prospect-related item so Ticket 18B can resolve a
 * role-safe navigation target (admin detail / commercial detail / read-only
 * school summary / no link) without a second query per feed item or
 * per-role routing logic baked into this DTO — see
 * resolveSharedFeedProspectHref in src/lib/shared-feed-prospect-navigation.ts.
 * Both fields are already visible to every authorized CRM user on the
 * prospect list/detail pages, so exposing them here adds no new privacy
 * surface.
 */
type SharedFeedProspectRef = {
  prospectId: string;
  prospectName: string;
  prospectProduct: RelaisProduct;
  prospectAssignedUserId: string | null;
  entity: SharedFeedEntityRef;
};

export type ProspectInteractionFeedItem = SharedFeedItemBase &
  SharedFeedProspectRef & {
    type: "PROSPECT_INTERACTION";
    actorName: string | null;
    activityType: ProspectActivityType;
    summary: string;
    preview: string | null;
  };

export type FollowUpCompletedFeedItem = SharedFeedItemBase &
  SharedFeedProspectRef & {
    type: "FOLLOW_UP_COMPLETED";
    actorName: string | null;
    summary: string;
  };

export type ProspectWonFeedItem = SharedFeedItemBase &
  SharedFeedProspectRef & {
    type: "PROSPECT_WON";
    actorName: string | null;
  };

export type UserStatusFeedItem = SharedFeedItemBase & {
  type: "USER_ACTIVATED" | "USER_DEACTIVATED";
  userDisplayName: string;
  userRole: UserRole;
  actorName: string;
};

export type SharedFeedItem =
  | ProspectInteractionFeedItem
  | FollowUpCompletedFeedItem
  | ProspectWonFeedItem
  | UserStatusFeedItem;

export const DEFAULT_SHARED_FEED_LIMIT = 30;
export const MAX_SHARED_FEED_LIMIT = 100;

/** ProspectActivity types that belong to a dedicated family and must never
 * double up as a generic PROSPECT_INTERACTION item. */
export const NON_INTERACTION_ACTIVITY_TYPES: ProspectActivityType[] = [
  "FOLLOW_UP",
  "WON_TRANSITION",
];

const PREVIEW_MAX_LENGTH = 320;

export function resolveSharedFeedLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_SHARED_FEED_LIMIT;
  }

  return Math.min(Math.max(1, Math.trunc(limit)), MAX_SHARED_FEED_LIMIT);
}

export function buildInteractionPreview(
  details: string | null | undefined,
): string | null {
  if (!details) {
    return null;
  }

  const trimmed = details.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length <= PREVIEW_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`;
}

export type ProspectActivityFeedRow = {
  id: string;
  type: ProspectActivityType;
  summary: string;
  details: string | null;
  occurredAt: Date;
  agentName: string | null;
  prospect: {
    id: string;
    name: string;
    product: RelaisProduct;
    assignedUserId: string | null;
  };
};

function mapProspectRef(
  row: ProspectActivityFeedRow,
): SharedFeedProspectRef {
  return {
    prospectId: row.prospect.id,
    prospectName: row.prospect.name,
    prospectProduct: row.prospect.product,
    prospectAssignedUserId: row.prospect.assignedUserId,
    entity: { kind: "PROSPECT", id: row.prospect.id },
  };
}

export function mapProspectInteractionRow(
  row: ProspectActivityFeedRow,
): ProspectInteractionFeedItem {
  return {
    id: row.id,
    type: "PROSPECT_INTERACTION",
    occurredAt: row.occurredAt.toISOString(),
    actorName: row.agentName ?? null,
    activityType: row.type,
    summary: row.summary,
    preview: buildInteractionPreview(row.details),
    ...mapProspectRef(row),
  };
}

export function mapFollowUpCompletedRow(
  row: ProspectActivityFeedRow,
): FollowUpCompletedFeedItem {
  return {
    id: row.id,
    type: "FOLLOW_UP_COMPLETED",
    occurredAt: row.occurredAt.toISOString(),
    actorName: row.agentName ?? null,
    summary: row.summary,
    ...mapProspectRef(row),
  };
}

export function mapProspectWonRow(
  row: ProspectActivityFeedRow,
): ProspectWonFeedItem {
  return {
    id: row.id,
    type: "PROSPECT_WON",
    occurredAt: row.occurredAt.toISOString(),
    actorName: row.agentName ?? null,
    ...mapProspectRef(row),
  };
}

export type UserStatusActivityFeedRow = {
  id: string;
  type: UserStatusActivityType;
  occurredAt: Date;
  user: { firstName: string; lastName: string; role: UserRole };
  actorUser: { firstName: string; lastName: string };
};

export function mapUserStatusRow(
  row: UserStatusActivityFeedRow,
): UserStatusFeedItem {
  return {
    id: row.id,
    type: row.type === "ACTIVATED" ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    occurredAt: row.occurredAt.toISOString(),
    userDisplayName: `${row.user.firstName} ${row.user.lastName}`,
    userRole: row.user.role,
    actorName: `${row.actorUser.firstName} ${row.actorUser.lastName}`,
  };
}

/** occurredAt DESC, id DESC — deterministic even when two events share the
 * exact same timestamp. */
export function compareSharedFeedItems(
  left: SharedFeedItem,
  right: SharedFeedItem,
): number {
  const byDate =
    new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();

  if (byDate !== 0) {
    return byDate;
  }

  return right.id.localeCompare(left.id);
}

export function mergeSharedFeedItems(
  sources: SharedFeedItem[][],
  limit: number,
): SharedFeedItem[] {
  return sources
    .flat()
    .sort(compareSharedFeedItems)
    .slice(0, limit);
}

export type SharedFeedDependencies = {
  findRecentProspectInteractions: (
    limit: number,
  ) => Promise<ProspectActivityFeedRow[]>;
  findRecentFollowUpsCompleted: (
    limit: number,
  ) => Promise<ProspectActivityFeedRow[]>;
  findRecentProspectWonEvents: (
    limit: number,
  ) => Promise<ProspectActivityFeedRow[]>;
  findRecentUserStatusEvents: (
    limit: number,
  ) => Promise<UserStatusActivityFeedRow[]>;
};

export type GetSharedFeedParams = {
  limit?: number;
};

/**
 * Fetches up to `limit` of the newest rows from each of the four approved
 * sources (never the whole table), maps each to its DTO, merges, and takes
 * the requested limit — a standard bounded top-K fan-in: since the final
 * result needs at most `limit` items, no individual source can contribute
 * more than `limit` of them.
 */
export async function getSharedFeedCore(
  params: GetSharedFeedParams,
  dependencies: SharedFeedDependencies,
): Promise<SharedFeedItem[]> {
  const limit = resolveSharedFeedLimit(params.limit);

  const [interactions, followUps, wonEvents, userEvents] = await Promise.all([
    dependencies.findRecentProspectInteractions(limit),
    dependencies.findRecentFollowUpsCompleted(limit),
    dependencies.findRecentProspectWonEvents(limit),
    dependencies.findRecentUserStatusEvents(limit),
  ]);

  return mergeSharedFeedItems(
    [
      interactions.map(mapProspectInteractionRow),
      followUps.map(mapFollowUpCompletedRow),
      wonEvents.map(mapProspectWonRow),
      userEvents.map(mapUserStatusRow),
    ],
    limit,
  );
}
