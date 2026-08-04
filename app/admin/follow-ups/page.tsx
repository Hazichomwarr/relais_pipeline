import AdminShell from "@/component/dashboard/AdminShell";
import FollowUpFilters from "@/component/follow-ups/FollowUpFilters";
import FollowUpKpiCards from "@/component/follow-ups/FollowUpKpiCards";
import FollowUpQueueTable from "@/component/follow-ups/FollowUpQueueTable";
import { getFollowUpQueueKpis } from "@/src/lib/follow-up-presentation";
import { followUpQueueFilterSchema } from "@/src/lib/validations/follow-up-queue.schema";
import { getFollowUpQueue } from "@/src/services/follow-up.service";
import { listDashboardUserOptions } from "@/src/services/user.service";

type FollowUpSearchParams = Promise<{
  userId?: string;
  product?: string;
  interest?: string;
  nextAction?: string;
}>;

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: FollowUpSearchParams;
}) {
  const params = await searchParams;
  const parsedFilters = followUpQueueFilterSchema.safeParse(params);
  const filters = parsedFilters.success ? parsedFilters.data : {};
  const today = new Date();

  const [items, filterUsers] = await Promise.all([
    getFollowUpQueue(filters, today),
    listDashboardUserOptions(),
  ]);
  const kpis = getFollowUpQueueKpis(items, today);

  return (
    <AdminShell activeItem="followUps">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          File d’action commerciale
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl lg:text-5xl">
          Suivis à effectuer
        </h1>
        <p className="mt-2 text-base text-slate-500 lg:text-lg">
          Les prospects qui demandent l’attention de l’équipe aujourd’hui.
        </p>
      </div>

      <FollowUpKpiCards kpis={kpis} />

      <div className="my-8 rounded-3xl border border-slate-200 bg-white p-5">
        <FollowUpFilters users={filterUsers} />
      </div>

      <FollowUpQueueTable items={items} />
    </AdminShell>
  );
}
