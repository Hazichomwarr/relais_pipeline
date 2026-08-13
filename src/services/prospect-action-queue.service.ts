import "server-only";

import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import {
  compareProspectActionQueueItems,
  filterProspectActionQueueByBucket,
  resolveEffectiveAssignee,
  summarizeProspectActionQueue,
  toProspectActionQueueItem,
  toProspectWithoutOpenActionItem,
  type ProspectActionQueueFilters,
  type ProspectActionQueueItem,
  type ProspectActionQueueRow,
  type ProspectActionQueueSummary,
  type ProspectWithoutOpenActionItem,
} from "@/src/services/prospect-action-queue.service-core";

const queueRowSelect = {
  id: true,
  prospectId: true,
  assignedToUserId: true,
  createdByUserId: true,
  status: true,
  title: true,
  description: true,
  dueAt: true,
  completedAt: true,
  completedByUserId: true,
  canceledAt: true,
  canceledByUserId: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  prospect: {
    select: { id: true, name: true, product: true, status: true, assignedUserId: true },
  },
  assignedToUser: {
    select: { id: true, firstName: true, lastName: true, active: true },
  },
} satisfies Prisma.ProspectActionSelect;

/**
 * One bounded query for the whole queue (Ticket 20E: "avoid N+1") — every
 * OPEN action matching scope/assignee/product/search, with exactly the
 * relational context the DTO/UI needs and nothing more (no
 * ProspectActivity, no Prospect.notes). Bucket filtering and summary
 * counts are both derived in memory from this same result set.
 */
export async function listProspectActionQueue(
  actor: AuthenticatedUser,
  filters: ProspectActionQueueFilters,
): Promise<{ items: ProspectActionQueueItem[]; summary: ProspectActionQueueSummary }> {
  const effectiveAssignee = resolveEffectiveAssignee(actor, filters);

  const where: Prisma.ProspectActionWhereInput = {
    status: "OPEN",
    ...(effectiveAssignee ? { assignedToUserId: effectiveAssignee } : {}),
    ...(filters.product ? { prospect: { product: filters.product } } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { prospect: { name: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = (await prisma.prospectAction.findMany({
    where,
    select: queueRowSelect,
  })) as ProspectActionQueueRow[];

  const sorted = [...rows].sort(compareProspectActionQueueItems);
  const summary = summarizeProspectActionQueue(sorted);
  const bucketed = filterProspectActionQueueByBucket(sorted, filters.bucket);

  return {
    items: bucketed.map((row) => toProspectActionQueueItem(actor, row)),
    summary,
  };
}

/**
 * Ticket 20E crack detection: `actions: { none: { status: "OPEN" } }` is a
 * relation anti-join Prisma compiles to a single query — no per-prospect
 * existence check. ADMIN/MANAGER only; callers must not invoke this for a
 * COMMERCIAL viewer (see the /actions page, which only calls it on that
 * branch — Commercials get their actionable queue, not a company-wide
 * integrity backlog).
 */
export async function listActiveProspectsWithoutOpenAction(
  viewer: { id: string; role: UserRole },
): Promise<ProspectWithoutOpenActionItem[]> {
  const prospects = await prisma.prospect.findMany({
    where: {
      status: { notIn: ["WON", "LOST"] },
      actions: { none: { status: "OPEN" } },
    },
    orderBy: [{ interest: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      product: true,
      status: true,
      interest: true,
      assignedUserId: true,
    },
  });

  return prospects.map((prospect) => toProspectWithoutOpenActionItem(viewer, prospect));
}
