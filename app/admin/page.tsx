// app/admin/adminPage.tsx

import {
  Utensils,
  Dumbbell,
  Scissors,
  Smartphone,
  Gem,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";

import BusinessType from "../_component/dashboard/BusinessType";
import Sidebar from "../_component/dashboard/Sidebar";
import DashboardTable from "../_component/dashboard/DashboardTable";
import KpiCards from "../_component/dashboard/KpiCards";
import { getReports } from "@/lib/getReports";
import ReportDateFilter from "../_component/dashboard/ReportDateFilter";

type SearchParams = Promise<{ date?: string }>;

export type BusinessStatType = {
  label: string;
  value: number;
  percent: string;
  icon: LucideIcon;
  color: string;
};
export type KpiCard = { label: string; total?: number; indicator?: string };

const businessStats: BusinessStatType[] = [
  {
    label: "Restaurant",
    value: 20,
    percent: "34%",
    icon: Utensils,
    color: "bg-blue-100 text-blue-600",
  },
  {
    label: "Salle de sport",
    value: 12,
    percent: "21%",
    icon: Dumbbell,
    color: "bg-green-100 text-green-600",
  },
  {
    label: "Salon de coiffure",
    value: 9,
    percent: "16%",
    icon: Scissors,
    color: "bg-violet-100 text-violet-600",
  },
  {
    label: "Boutique tech",
    value: 6,
    percent: "10%",
    icon: Smartphone,
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    label: "Bijouterie",
    value: 4,
    percent: "7%",
    icon: Gem,
    color: "bg-amber-100 text-amber-600",
  },
  {
    label: "Autres",
    value: 7,
    percent: "12%",
    icon: MoreHorizontal,
    color: "bg-slate-100 text-slate-600",
  },
];

const KPI_CARDS: KpiCard[] = [
  { label: "Total Rapports", total: 58, indicator: "+12 ce mois" },
  { label: "Entreprises uniques", total: 23, indicator: "+5 ce mois" },
  { label: "Commerciaux", total: 3, indicator: "Actif" },
  { label: "Intéressés", total: 17, indicator: "29% du total" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { date } = await searchParams;

  const reports = date ? await getReports(date) : await getReports();
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
          <KpiCards kpiCards={KPI_CARDS} />

          {/* BUSINESS TYPE STATS */}
          <BusinessType businessStats={businessStats} />

          {/* TABLE div */}
          <DashboardTable reports={reports} />
        </div>
      </div>
    </section>
  );
}
