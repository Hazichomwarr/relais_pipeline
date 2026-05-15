// app/admin/adminPage.tsx

import {
  Calendar,
  Utensils,
  Dumbbell,
  Scissors,
  Smartphone,
  Gem,
  MoreHorizontal,
  ChevronDown,
  LucideIcon,
} from "lucide-react";

import { Report } from "../_component/ReportForm";
import BusinessType from "../_component/dashboard/BusinessType";
import Sidebar from "../_component/dashboard/Sidebar";
import DashboardTable from "../_component/dashboard/DashboardTable";
import KpiCards from "../_component/dashboard/KpiCards";
import { getReports } from "@/lib/getReports";

// const reports: Report[] = [
//   {
//     date: "26 mai 2024",
//     time: "10:45",
//     entreprise: "Restaurant Teranga",
//     type: "Restaurant",
//     contact: "70 12 34 56",
//     platform: "WhatsApp",
//     agent: "agent Ouagadougou",
//     interest: "Intéressé",
//     notes: "Le patron veut voir des exemples de sites.",
//   },
//   {
//     date: "26 mai 2024",
//     time: "09:30",
//     entreprise: "Power Gym",
//     type: "Salle de sport",
//     contact: "78 90 12 34",
//     platform: "Appel",
//     agent: "agent Ouagadougou",
//     interest: "Veut plus d’informations",
//     notes: "Prend contact pour plus d’éclairage.",
//   },
//   {
//     date: "25 mai 2024",
//     time: "16:20",
//     entreprise: "Mèches d'Or",
//     type: "Salon de coiffure",
//     contact: "75 43 21 00",
//     platform: "Instagram",
//     agent: "Awa Traoré",
//     interest: "Peut-être",
//     notes: "Hésite encore sur le prix.",
//   },
//   {
//     date: "25 mai 2024",
//     time: "11:15",
//     entreprise: "Le Saveur Ivoirienne",
//     type: "Restaurant",
//     contact: "77 65 43 21",
//     platform: "WhatsApp",
//     agent: "Awa Traoré",
//     interest: "Intéressé",
//     notes: "Va vous contacter prochainement.",
//   },
// ];

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

export default async function AdminPage() {
  const reports = await getReports();
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

            <button className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-lg font-medium shadow-sm">
              <Calendar className="h-5 w-5 text-slate-500" />
              20 mai 2024 - 26 mai 2024
              <ChevronDown className="h-5 w-5 text-slate-400" />
            </button>
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
