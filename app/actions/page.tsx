import { redirect } from "next/navigation";

import ProspectActionQueueAttention from "@/component/actions/ProspectActionQueueAttention";
import ProspectActionQueueFilters from "@/component/actions/ProspectActionQueueFilters";
import ProspectActionQueueKpis from "@/component/actions/ProspectActionQueueKpis";
import ProspectActionQueueList from "@/component/actions/ProspectActionQueueList";
import { parseProspectActionQueueFilters } from "@/src/lib/prospect-action-queue-filters";
import {
  AuthorizationError,
  requireProspectActionQueueAccess,
} from "@/src/services/authorization.service";
import {
  listActiveProspectsWithoutOpenAction,
  listProspectActionQueue,
} from "@/src/services/prospect-action-queue.service";
import { listActiveUsersForTaskAssignment } from "@/src/services/user.service";

type ActionsSearchParams = Promise<{
  scope?: string;
  bucket?: string;
  assignee?: string;
  product?: string;
  search?: string;
}>;

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: ActionsSearchParams;
}) {
  let user;

  try {
    user = await requireProspectActionQueueAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
    }
    throw error;
  }

  const params = await searchParams;
  const filters = parseProspectActionQueueFilters(params);

  const [{ items, summary }, assignableUsers, attentionProspects] =
    await Promise.all([
      listProspectActionQueue(user, filters),
      listActiveUsersForTaskAssignment(),
      user.role === "COMMERCIAL"
        ? Promise.resolve([])
        : listActiveProspectsWithoutOpenAction(user),
    ]);

  const hasActiveFilters =
    filters.scope !== "ALL" ||
    filters.bucket !== "ALL" ||
    Boolean(filters.assignedToUserId) ||
    Boolean(filters.product) ||
    Boolean(filters.search);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          Actions
        </h1>
        <p className="mt-2 max-w-xl text-base text-slate-500">
          Ce qui doit être fait maintenant, par qui, et pour quel prospect.
        </p>
      </div>

      <div className="space-y-6">
        <ProspectActionQueueKpis summary={summary} />

        <ProspectActionQueueFilters assignableUsers={assignableUsers} />

        <ProspectActionQueueList items={items} hasActiveFilters={hasActiveFilters} />

        {user.role !== "COMMERCIAL" && (
          <ProspectActionQueueAttention prospects={attentionProspects} />
        )}
      </div>
    </div>
  );
}
