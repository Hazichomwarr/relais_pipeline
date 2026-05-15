import {
  ChevronDown,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";

export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-65 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
      {/* LOGO */}
      <div className="mb-5 flex flex-col items-center">
        <Image
          src="/images/logo.png"
          alt="Relais"
          width={200}
          height={20}
          className="object-contain"
        />

        {/* <h1 className="mt-3 text-4xl tracking-[0.3em] text-[#0f2557]">
              RELAIS
            </h1> */}
      </div>

      {/* NAV */}
      <nav className="space-y-2">
        <button className="flex w-full items-center gap-3 rounded-2xl bg-blue-50 px-4 py-4 font-medium text-blue-600">
          <LayoutDashboard className="h-5 w-5" />
          Tableau de bord
        </button>

        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium text-slate-600 hover:bg-slate-100">
          <FileText className="h-5 w-5" />
          Rapports
        </button>

        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium text-slate-600 hover:bg-slate-100">
          <Users className="h-5 w-5" />
          Commerciaux
        </button>

        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium text-slate-600 hover:bg-slate-100">
          <Settings className="h-5 w-5" />
          Paramètres
        </button>
      </nav>

      {/* USER */}
      <div className="mt-auto rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a8a] text-lg font-bold text-white">
              AD
            </div>

            <div>
              <p className="font-semibold">Admin</p>
              <p className="text-sm text-slate-500">Administrateur</p>
            </div>
          </div>

          <ChevronDown className="h-5 w-5 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}
