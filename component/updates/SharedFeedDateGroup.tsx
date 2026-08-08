import type { UserRole } from "@prisma/client";

import SharedFeedItemCard from "@/component/updates/SharedFeedItemCard";
import type { SharedFeedDateGroup as SharedFeedDateGroupData } from "@/src/lib/shared-feed-date-grouping";
import type { SharedFeedItem } from "@/src/services/shared-feed.service-core";

type SharedFeedDateGroupProps = {
  group: SharedFeedDateGroupData<SharedFeedItem>;
  viewer: { id: string; role: UserRole };
  referenceDate: Date;
};

export default function SharedFeedDateGroup({
  group,
  viewer,
  referenceDate,
}: SharedFeedDateGroupProps) {
  return (
    <section aria-labelledby={`feed-date-${group.key}`}>
      <h2
        id={`feed-date-${group.key}`}
        className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400"
      >
        {group.label}
      </h2>

      <ol className="space-y-4">
        {group.items.map((item) => (
          <li key={item.id}>
            <SharedFeedItemCard
              item={item}
              viewer={viewer}
              referenceDate={referenceDate}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
