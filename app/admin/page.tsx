// app/admin/adminPage.tsx

import { getReports } from "@/lib/getReports";
import Sidebar from "../_component/dashboard/Sidebar";
import DashboardTable from "../_component/dashboard/DashboardTable";
import KpiCards from "../_component/dashboard/KpiCards";
import ReportDateFilter from "../_component/dashboard/ReportDateFilter";
import BusinessStats from "../_component/dashboard/BusinessStats";

type SearchParams = Promise<{ date?: string }>;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { date } = await searchParams;

  const reports = date ? await getReports(date) : await getReports();

  console.log("reports:", reports);

  return (
    <section className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="flex">
        {/* SIDEBAR */}
        <Sidebar />

        {/* CONTENT */}
        <div className="flex-1 px-6 py-8 lg:px-10">
          {/* TOP BAR */}
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-5xl font-bold tracking-tight text-[#0f2557]">
                Tableau de bord
              </h1>

              <p className="mt-2 text-lg text-slate-500">
                Vue d’ensemble de vos rapports de prospection
              </p>
            </div>

            {/* Filter reports per date */}
            <ReportDateFilter />
          </div>

          {/* KPI CARDS */}
          <KpiCards />

          {/* BUSINESS TYPE STATS */}
          <BusinessStats reports={reports} />

          {/* TABLE div */}
          <DashboardTable reports={reports} />
        </div>
      </div>
    </section>
  );
}
