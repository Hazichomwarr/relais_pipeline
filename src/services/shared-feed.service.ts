import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  getSharedFeedCore,
  NON_INTERACTION_ACTIVITY_TYPES,
  type GetSharedFeedParams,
} from "@/src/services/shared-feed.service-core";

const prospectActivityFeedSelect = {
  id: true,
  type: true,
  summary: true,
  details: true,
  occurredAt: true,
  agentName: true,
  prospect: { select: { id: true, name: true } },
} satisfies Prisma.ProspectActivitySelect;

const prospectActivityFeedOrderBy = [
  { occurredAt: "desc" },
  { id: "desc" },
] satisfies Prisma.ProspectActivityOrderByWithRelationInput[];

const userStatusActivityFeedOrderBy = [
  { occurredAt: "desc" },
  { id: "desc" },
] satisfies Prisma.UserStatusActivityOrderByWithRelationInput[];

/**
 * Composes the shared À la une feed from the four approved historical
 * sources (Ticket 18A). Read-only, bounded, and deliberately silent on
 * authorization — the caller (an action or page) is responsible for
 * `requireSharedFeedAccess()` first, exactly like every other read
 * service in this codebase (getProspects, getFinancialReport, ...).
 */
export async function getSharedFeed(params: GetSharedFeedParams = {}) {
  return getSharedFeedCore(params, {
    findRecentProspectInteractions: (limit) =>
      prisma.prospectActivity.findMany({
        where: { type: { notIn: NON_INTERACTION_ACTIVITY_TYPES } },
        orderBy: prospectActivityFeedOrderBy,
        take: limit,
        select: prospectActivityFeedSelect,
      }),
    findRecentFollowUpsCompleted: (limit) =>
      prisma.prospectActivity.findMany({
        where: { type: "FOLLOW_UP" },
        orderBy: prospectActivityFeedOrderBy,
        take: limit,
        select: prospectActivityFeedSelect,
      }),
    findRecentProspectWonEvents: (limit) =>
      prisma.prospectActivity.findMany({
        where: { type: "WON_TRANSITION" },
        orderBy: prospectActivityFeedOrderBy,
        take: limit,
        select: prospectActivityFeedSelect,
      }),
    findRecentUserStatusEvents: (limit) =>
      prisma.userStatusActivity.findMany({
        orderBy: userStatusActivityFeedOrderBy,
        take: limit,
        select: {
          id: true,
          type: true,
          occurredAt: true,
          user: { select: { firstName: true, lastName: true, role: true } },
          actorUser: { select: { firstName: true, lastName: true } },
        },
      }),
  });
}

export type { SharedFeedItem } from "@/src/services/shared-feed.service-core";
