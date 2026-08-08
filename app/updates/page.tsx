import Link from "next/link";
import { redirect } from "next/navigation";

import SharedFeedList from "@/component/updates/SharedFeedList";
import {
  AuthorizationError,
  requireSharedFeedAccess,
} from "@/src/services/authorization.service";
import { getSharedFeed } from "@/src/services/shared-feed.service";
import {
  MAX_SHARED_FEED_LIMIT,
  resolveSharedFeedLimit,
} from "@/src/services/shared-feed.service-core";

type UpdatesSearchParams = Promise<{ limit?: string }>;

const LOAD_MORE_STEP = 30;

/**
 * Server Component → requireSharedFeedAccess() → getSharedFeed() → render
 * (Ticket 18B). "Afficher plus" reuses Ticket 18A's existing limit param
 * rather than adding cursor pagination — see resolveSharedFeedLimit.
 */
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: UpdatesSearchParams;
}) {
  let user;

  try {
    user = await requireSharedFeedAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
    }
    throw error;
  }

  const params = await searchParams;
  const limit = resolveSharedFeedLimit(Number(params.limit));
  const referenceDate = new Date();
  const items = await getSharedFeed({ limit });

  const canLoadMore = items.length === limit && limit < MAX_SHARED_FEED_LIMIT;
  const nextLimit = Math.min(limit + LOAD_MORE_STEP, MAX_SHARED_FEED_LIMIT);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          À la une
        </h1>
        <p className="mt-2 max-w-xl text-base text-slate-500">
          Les dernières activités importantes de l’équipe RELAIS.
        </p>
      </div>

      <SharedFeedList
        items={items}
        viewer={user}
        referenceDate={referenceDate}
      />

      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <Link
            href={`/updates?limit=${nextLimit}`}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Afficher plus
          </Link>
        </div>
      )}
    </div>
  );
}
