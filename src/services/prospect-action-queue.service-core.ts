import type { InterestLevel, ProspectStatus, RelaisProduct, UserRole } from "@prisma/client";

import { resolveProspectAccess } from "@/src/lib/prospect-access";
import {
  addBusinessDays,
  startOfBusinessDay,
} from "@/src/lib/financial-report-period";
import { formatLongDailyReportDate } from "@/src/lib/daily-report-date";
import {
  canCancelProspectAction,
  canCompleteProspectAction,
  compareProspectActionsForListing,
  type ProspectActionActor,
  type ProspectActionRow,
} from "@/src/services/prospect-action.service-core";

// ---------------------------------------------------------------------------
// Buckets — derived, never persisted (mirrors isOverdueProspectAction's
// "overdue is derived" principle from Ticket 20B, just three-way instead
// of boolean). Boundaries use the same centralized RELAIS business
// timezone as financial reporting/daily reports — never a second
// timezone constant.
// ---------------------------------------------------------------------------

export type ProspectActionQueueBucket = "OVERDUE" | "TODAY" | "UPCOMING";

export function getProspectActionQueueBucket(
  dueAt: Date,
  now: Date = new Date(),
): ProspectActionQueueBucket {
  const startOfToday = startOfBusinessDay(now);
  const startOfTomorrow = addBusinessDays(startOfToday, 1);

  if (dueAt.getTime() < startOfToday.getTime()) {
    return "OVERDUE";
  }
  if (dueAt.getTime() < startOfTomorrow.getTime()) {
    return "TODAY";
  }
  return "UPCOMING";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * "En retard de 2 jours" / "Aujourd’hui" / "Demain" / a formatted date for
 * anything further out — day-relative labeling for the queue row, kept
 * separate from src/lib/follow-up-presentation.ts's getFollowUpLabel
 * because that helper diffs calendar days using the JS Date object's
 * *local* getters (server-TZ-dependent), not the centralized business-day
 * boundary this ticket requires to be deterministic regardless of where
 * the app runs.
 */
export function formatProspectActionQueueDueLabel(
  dueAt: Date,
  now: Date = new Date(),
): string {
  const bucket = getProspectActionQueueBucket(dueAt, now);

  if (bucket === "TODAY") {
    return "Aujourd’hui";
  }

  const dayDiff = Math.round(
    (startOfBusinessDay(dueAt).getTime() - startOfBusinessDay(now).getTime()) /
      MS_PER_DAY,
  );

  if (bucket === "OVERDUE") {
    const daysOverdue = Math.abs(dayDiff);
    return `En retard de ${daysOverdue} jour${daysOverdue > 1 ? "s" : ""}`;
  }

  if (dayDiff === 1) {
    return "Demain";
  }

  return formatLongDailyReportDate(dueAt);
}

// ---------------------------------------------------------------------------
// Ordering — reuses Ticket 20B's compareProspectActionsForListing
// unchanged (Ticket 20E: "do not create conflicting ordering rules
// between prospect detail and /actions without a reason"). Every row here
// is already OPEN, so that function's OPEN-first tie-break is moot; its
// dueAt-ascending primary key is exactly "oldest overdue first / soonest
// today first / soonest upcoming first" — the buckets are contiguous
// dueAt ranges, so a single dueAt-ascending sort already produces the
// correct order *within* each bucket with no separate bucket rank needed.
// ---------------------------------------------------------------------------

export function compareProspectActionQueueItems(
  left: ProspectActionRow,
  right: ProspectActionRow,
): number {
  return compareProspectActionsForListing(left, right);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type ProspectActionQueueScope = "ALL" | "MINE";
export type ProspectActionQueueBucketFilter = "ALL" | ProspectActionQueueBucket;

export type ProspectActionQueueFilters = {
  scope: ProspectActionQueueScope;
  bucket: ProspectActionQueueBucketFilter;
  assignedToUserId?: string;
  product?: RelaisProduct;
  search?: string;
};

/**
 * scope=MINE always wins over any assignee filter carried in the URL —
 * otherwise a stale `?assignee=` from a copied link could silently widen
 * "Mes actions" to someone else's queue.
 */
export function resolveEffectiveAssignee(
  actor: { id: string },
  filters: ProspectActionQueueFilters,
): string | undefined {
  return filters.scope === "MINE" ? actor.id : filters.assignedToUserId;
}

// ---------------------------------------------------------------------------
// Summary counts — derived from the same bounded result set the list
// renders from (Ticket 20E: "avoid one query per bucket row"), scoped by
// scope/assignee/product/search but deliberately NOT narrowed by the
// bucket filter itself, so the strip always shows the full breakdown for
// the current ownership/product scope regardless of which bucket tab is
// selected.
// ---------------------------------------------------------------------------

export type ProspectActionQueueSummary = {
  overdue: number;
  today: number;
  upcoming: number;
  totalOpen: number;
};

export function summarizeProspectActionQueue(
  rows: ProspectActionRow[],
  now: Date = new Date(),
): ProspectActionQueueSummary {
  let overdue = 0;
  let today = 0;
  let upcoming = 0;

  for (const row of rows) {
    const bucket = getProspectActionQueueBucket(row.dueAt, now);
    if (bucket === "OVERDUE") overdue += 1;
    else if (bucket === "TODAY") today += 1;
    else upcoming += 1;
  }

  return { overdue, today, upcoming, totalOpen: rows.length };
}

export function filterProspectActionQueueByBucket<T extends { dueAt: Date }>(
  rows: T[],
  bucket: ProspectActionQueueBucketFilter,
  now: Date = new Date(),
): T[] {
  if (bucket === "ALL") {
    return rows;
  }
  return rows.filter((row) => getProspectActionQueueBucket(row.dueAt, now) === bucket);
}

// ---------------------------------------------------------------------------
// Role-safe prospect navigation — composes the two Product Directory
// resolvers (Ticket 15G.2) instead of reimplementing per-product routing.
// KARMDA always resolves (the shared /schools summary always exists);
// DIGITAL_SERVICES resolves to its shared summary for a foreign viewer;
// LOKARI/NIA have no shared read-only route yet, so a foreign COMMERCIAL
// gets no link at all rather than a fabricated/unauthorized one.
// ---------------------------------------------------------------------------

export type ProspectActionQueueNavigationViewer = {
  id: string;
  role: UserRole;
};

export type ProspectActionQueueNavigationTarget = {
  id: string;
  product: RelaisProduct;
  assignedUserId: string | null;
};

/**
 * Ticket 28C — delegates entirely to the canonical resolveProspectAccess;
 * no product-specific branching remains here. This matters especially for
 * this queue: a ProspectAction's assignee is independent of the
 * prospect's own owner (Ticket 20B/28A §19), so a Commercial can
 * legitimately keep an actionable queue entry for a prospect they no
 * longer own — the link must still resolve (to the read-only summary),
 * never disappear just because they're not the current owner.
 */
export function resolveProspectActionQueueProspectHref(
  viewer: ProspectActionQueueNavigationViewer,
  prospect: ProspectActionQueueNavigationTarget,
): string | null {
  return resolveProspectAccess(viewer, prospect).detailHref;
}

// ---------------------------------------------------------------------------
// Queue item DTO
// ---------------------------------------------------------------------------

export type ProspectActionQueueItem = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date;
  createdAt: Date;
  bucket: ProspectActionQueueBucket;

  prospect: {
    id: string;
    name: string;
    product: RelaisProduct;
    status: ProspectStatus;
  };

  assignedTo: {
    id: string;
    name: string;
    active: boolean;
  };

  prospectHref: string | null;
  canComplete: boolean;
  canCancel: boolean;
};

export type ProspectActionQueueRow = ProspectActionRow & {
  prospect: ProspectActionQueueNavigationTarget & { name: string; status: ProspectStatus };
  assignedToUser: { id: string; firstName: string; lastName: string; active: boolean };
};

export function toProspectActionQueueItem(
  viewer: ProspectActionQueueNavigationViewer & ProspectActionActor,
  row: ProspectActionQueueRow,
  now: Date = new Date(),
): ProspectActionQueueItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    bucket: getProspectActionQueueBucket(row.dueAt, now),
    prospect: {
      id: row.prospect.id,
      name: row.prospect.name,
      product: row.prospect.product,
      status: row.prospect.status,
    },
    assignedTo: {
      id: row.assignedToUser.id,
      name: `${row.assignedToUser.firstName} ${row.assignedToUser.lastName}`,
      active: row.assignedToUser.active,
    },
    prospectHref: resolveProspectActionQueueProspectHref(viewer, row.prospect),
    canComplete: canCompleteProspectAction(viewer, row),
    canCancel: canCancelProspectAction(viewer, row),
  };
}

// ---------------------------------------------------------------------------
// Crack detection — "active prospect without an OPEN action" (Ticket
// 20E). A derived integrity read, not a persisted state. Ordering: real
// InterestLevel enum values are declared NOT_INTERESTED < MAYBE <
// NEEDS_INFORMATION < INTERESTED < READY_TO_DISCUSS in schema.prisma —
// Postgres orders enum comparisons by declaration sequence, so `ORDER BY
// interest DESC` already yields "strongest interest first" without a
// fabricated lead-score field. This depends on that declaration order
// never being reshuffled without re-checking this comment.
// ---------------------------------------------------------------------------

export type ProspectWithoutOpenActionItem = {
  id: string;
  name: string;
  product: RelaisProduct;
  status: ProspectStatus;
  interest: InterestLevel;
  href: string | null;
};

export function toProspectWithoutOpenActionItem(
  viewer: ProspectActionQueueNavigationViewer,
  prospect: {
    id: string;
    name: string;
    product: RelaisProduct;
    status: ProspectStatus;
    interest: InterestLevel;
    assignedUserId: string | null;
  },
): ProspectWithoutOpenActionItem {
  return {
    id: prospect.id,
    name: prospect.name,
    product: prospect.product,
    status: prospect.status,
    interest: prospect.interest,
    href: resolveProspectActionQueueProspectHref(viewer, prospect),
  };
}
