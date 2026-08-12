// app/admin/page.tsx

import AdminShell from "@/component/dashboard/AdminShell";
import BusinessStats from "@/component/dashboard/BusinessStats";
import DashboardTable from "@/component/dashboard/DashboardTable";
import KpiCards from "@/component/dashboard/KpiCards";
import ReportDateFilter from "@/component/dashboard/ReportDateFilter";
import { buildReturnToPath } from "@/src/lib/return-to";
import { getProspects } from "@/src/services/prospect.service";
import { listDashboardUserOptions } from "@/src/services/user.service";
import type {
  InterestLevel,
  ProspectStatus,
  RelaisProduct,
} from "@prisma/client";

type AdminSearchParams = Promise<{
  search?: string;
  product?: string;
  interest?: string;
  status?: string;
  userId?: string;
  date?: string;
}>;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  const params = await searchParams;

  const [prospects, filterUsers] = await Promise.all([
    getProspects({
      search: params.search,
      product: params.product as RelaisProduct | undefined,
      interest: params.interest as InterestLevel | undefined,
      status: params.status as ProspectStatus | undefined,
      userId: params.userId,
      date: params.date,
    }),
    listDashboardUserOptions(),
  ]);

  return (
    <AdminShell activeItem="dashboard">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl lg:text-5xl">
            Tableau de bord
          </h1>

          <p className="mt-2 text-base text-slate-500 lg:text-lg">
            Vue d’ensemble de la prospection RELAIS
          </p>
        </div>

        <ReportDateFilter />
      </div>

      <KpiCards prospects={prospects} />

      <BusinessStats prospects={prospects} />

      <DashboardTable
        prospects={prospects}
        filterUsers={filterUsers}
        returnTo={buildReturnToPath("/admin", params)}
      />
    </AdminShell>
  );
}
