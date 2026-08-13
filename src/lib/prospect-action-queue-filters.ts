import type { RelaisProduct } from "@prisma/client";

import { relaisProducts } from "@/src/lib/validations/prospect.schema";
import type {
  ProspectActionQueueBucketFilter,
  ProspectActionQueueFilters,
  ProspectActionQueueScope,
} from "@/src/services/prospect-action-queue.service-core";

export type ProspectActionQueueFilterParams = {
  scope?: string;
  bucket?: string;
  assignee?: string;
  product?: string;
  search?: string;
};

const scopes = ["ALL", "MINE"] as const;
const bucketFilters = ["ALL", "OVERDUE", "TODAY", "UPCOMING"] as const;

/**
 * Never throws: a missing, unrecognized, or hand-edited query string
 * (stale link, back button, malformed value) silently falls back to the
 * nearest safe default instead of erroring the page — same convention as
 * parseLedgerHistoryFilter (Ticket 17C.1). `assignee` is passed through
 * as an opaque id: an unknown/garbage value simply matches zero
 * ProspectAction rows in the service query, which is safe on its own —
 * no existence check needed here, and none of this ever reaches Prisma
 * as anything but an exact-match filter value.
 */
export function parseProspectActionQueueFilters(
  params: ProspectActionQueueFilterParams,
): ProspectActionQueueFilters {
  const scope = (scopes as readonly string[]).includes(
    (params.scope ?? "").toUpperCase(),
  )
    ? ((params.scope ?? "").toUpperCase() as ProspectActionQueueScope)
    : "ALL";

  const bucket = (bucketFilters as readonly string[]).includes(
    (params.bucket ?? "").toUpperCase(),
  )
    ? ((params.bucket ?? "").toUpperCase() as ProspectActionQueueBucketFilter)
    : "ALL";

  const product =
    params.product &&
    (relaisProducts as readonly string[]).includes(params.product)
      ? (params.product as RelaisProduct)
      : undefined;

  const assignedToUserId = params.assignee?.trim() || undefined;
  const search = params.search?.trim() || undefined;

  return { scope, bucket, product, assignedToUserId, search };
}

/**
 * Same one-param-patch convention as buildFollowUpUrl
 * (follow-up-search-params.ts) — each filter control updates only its own
 * query param on top of whatever else is already selected, instead of
 * rebuilding the whole query string (there is no cascading-reset
 * relationship between scope/bucket/assignee/product/search).
 */
export function updateProspectActionQueueParam(
  currentSearchParams: string,
  name: string,
  value: string,
): string {
  const nextParams = new URLSearchParams(currentSearchParams);

  if (value) {
    nextParams.set(name, value);
  } else {
    nextParams.delete(name);
  }

  const query = nextParams.toString();
  return query ? `/actions?${query}` : "/actions";
}
