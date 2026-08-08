import type { UserRole } from "@prisma/client";

import SharedFeedDateGroup from "@/component/updates/SharedFeedDateGroup";
import SharedFeedEmptyState from "@/component/updates/SharedFeedEmptyState";
import { groupSharedFeedItemsByDate } from "@/src/lib/shared-feed-date-grouping";
import type { SharedFeedItem } from "@/src/services/shared-feed.service-core";

type SharedFeedListProps = {
  items: SharedFeedItem[];
  viewer: { id: string; role: UserRole };
  referenceDate: Date;
};

/**
 * Renders getSharedFeed()'s result as-is: groups it by calendar date
 * (a pure, order-preserving partition — see groupSharedFeedItemsByDate)
 * without ever re-sorting, so Ticket 18A's occurredAt DESC, id DESC
 * ordering is exactly what reaches the page.
 */
export default function SharedFeedList({
  items,
  viewer,
  referenceDate,
}: SharedFeedListProps) {
  if (items.length === 0) {
    return <SharedFeedEmptyState />;
  }

  const groups = groupSharedFeedItemsByDate(items, referenceDate);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <SharedFeedDateGroup
          key={group.key}
          group={group}
          viewer={viewer}
          referenceDate={referenceDate}
        />
      ))}
    </div>
  );
}
