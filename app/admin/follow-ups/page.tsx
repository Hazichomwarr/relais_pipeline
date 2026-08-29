import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import FollowUpFilters from "@/component/follow-ups/FollowUpFilters";
import FollowUpKpiCards from "@/component/follow-ups/FollowUpKpiCards";
import FollowUpQueueTable from "@/component/follow-ups/FollowUpQueueTable";
import { getFollowUpQueueKpis } from "@/src/lib/follow-up-presentation";
import { buildReturnToPath } from "@/src/lib/return-to";
import { followUpQueueFilterSchema } from "@/src/lib/validations/follow-up-queue.schema";
import {
  AuthorizationError,
  requireFollowUpQueueManagementAccess,
} from "@/src/services/authorization.service";
import { getFollowUpQueue } from "@/src/services/follow-up.service";
import { listDashboardUserOptions } from "@/src/services/user.service";

type FollowUpSearchParams = Promise<{
  userId?: string;
  product?: string;
  interest?: string;
  nextAction?: string;
}>;

/**
 * Ticket 25R §10/§12: this route had no authorization call of its own
 * before this ticket — it relied entirely on app/admin/layout.tsx's
 * then-ADMIN/MANAGER-only gate. Now that gate admits ASSISTANT
 * (requireDashboardAccess), so this sensitive commercial follow-up queue
 * needs its own explicit, narrower boundary.
 */
export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: FollowUpSearchParams;
}) {
  try {
    await requireFollowUpQueueManagementAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

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

      <FollowUpQueueTable
        items={items}
        returnTo={buildReturnToPath("/admin/follow-ups", params)}
      />
    </AdminShell>
  );
}
