import type { Prisma } from "@prisma/client";

import {
  getFollowUpLabel,
  getOverdueDays,
  startOfNextCalendarDay,
} from "@/src/lib/follow-up-presentation";
import type { FollowUpQueueFilters } from "@/src/lib/validations/follow-up-queue.schema";

export function buildFollowUpQueueWhere(
  filters: FollowUpQueueFilters = {},
  today = new Date(),
): Prisma.ProspectWhereInput {
  return {
    AND: [
      { status: { notIn: ["WON", "LOST"] } },
      {
        OR: [
          { followUpDate: { lt: startOfNextCalendarDay(today) } },
          { status: "TO_FOLLOW_UP" },
        ],
      },
      ...(filters.userId ? [{ assignedUserId: filters.userId }] : []),
      ...(filters.product ? [{ product: filters.product }] : []),
      ...(filters.interest ? [{ interest: filters.interest }] : []),
      ...(filters.nextAction ? [{ nextAction: filters.nextAction }] : []),
    ],
  };
}

export function presentFollowUpQueueItem(
  row: {
    id: string;
    name: string;
    prospectType: string;
    product: "KARMDA" | "LOKARI" | "NIA" | "DIGITAL_SERVICES";
    phone: string;
    interest:
      | "NOT_INTERESTED"
      | "MAYBE"
      | "NEEDS_INFORMATION"
      | "INTERESTED"
      | "READY_TO_DISCUSS";
    nextAction:
      | "CALL_BACK"
      | "VISIT_AGAIN"
      | "SEND_DEMO"
      | "SCHEDULE_MEETING"
      | "NO_ACTION"
      | null;
    followUpDate: Date | null;
    createdAt: Date;
    agentName: string;
    assignedUser: {
      id: string;
      firstName: string;
      lastName: string;
      active: boolean;
    } | null;
    activities: Array<{ occurredAt: Date }>;
  },
  today = new Date(),
) {
  return {
    id: row.id,
    name: row.name,
    prospectType: row.prospectType,
    product: row.product,
    phone: row.phone,
    interest: row.interest,
    nextAction: row.nextAction,
    followUpDate: row.followUpDate,
    overdueDays: row.followUpDate
      ? getOverdueDays(row.followUpDate, today)
      : null,
    followUpLabel: getFollowUpLabel(row.followUpDate, today),
    createdAt: row.createdAt,
    latestActivityAt: row.activities[0]?.occurredAt ?? null,
    assignedUser: row.assignedUser,
    commercialName: row.assignedUser
      ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`
      : row.agentName,
  };
}
