// app/admin/page.tsx

import BusinessStats from "@/component/dashboard/BusinessStats";
import DashboardTable from "@/component/dashboard/DashboardTable";
import KpiCards from "@/component/dashboard/KpiCards";
import ReportDateFilter from "@/component/dashboard/ReportDateFilter";
import Sidebar from "@/component/dashboard/Sidebar";
import { getProspects } from "@/src/services/prospect.service";
import { getFollowUpQueue } from "@/src/services/follow-up.service";
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

  const [prospects, filterUsers, followUps] = await Promise.all([
    getProspects({
      search: params.search,
      product: params.product as RelaisProduct | undefined,
      interest: params.interest as InterestLevel | undefined,
      status: params.status as ProspectStatus | undefined,
      userId: params.userId,
      date: params.date,
    }),
    listDashboardUserOptions(),
    getFollowUpQueue(),
  ]);

  return (
    <section className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="flex">
        <Sidebar />

        <div className="flex-1 px-6 py-8 lg:px-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-5xl font-bold tracking-tight text-[#0f2557]">
                Tableau de bord
              </h1>

              <p className="mt-2 text-lg text-slate-500">
                Vue d’ensemble de la prospection RELAIS
              </p>
            </div>

            <ReportDateFilter />
          </div>

          <KpiCards prospects={prospects} followUpCount={followUps.length} />

          <BusinessStats prospects={prospects} />

          <DashboardTable prospects={prospects} filterUsers={filterUsers} />
        </div>
      </div>
    </section>
  );
}
