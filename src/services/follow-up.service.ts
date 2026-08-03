import "server-only";

import { prisma } from "@/src/lib/prisma";
import type { FollowUpQueueFilters } from "@/src/lib/validations/follow-up-queue.schema";
import {
  buildFollowUpQueueWhere,
  presentFollowUpQueueItem,
} from "@/src/services/follow-up.service-core";

export async function getFollowUpQueue(
  filters: FollowUpQueueFilters = {},
  today = new Date(),
) {
  const rows = await prisma.prospect.findMany({
    where: buildFollowUpQueueWhere(filters, today),
    select: {
      id: true,
      name: true,
      prospectType: true,
      product: true,
      phone: true,
      interest: true,
      nextAction: true,
      followUpDate: true,
      createdAt: true,
      agentName: true,
      assignedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          active: true,
        },
      },
      activities: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { occurredAt: true },
      },
    },
    orderBy: [
      { followUpDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  return rows.map((row) => presentFollowUpQueueItem(row, today));
}

export type FollowUpQueueItem = Awaited<
  ReturnType<typeof getFollowUpQueue>
>[number];
