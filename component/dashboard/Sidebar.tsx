import {
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Sidebar({
  activeItem = "dashboard",
}: {
  activeItem?: "dashboard" | "followUps" | "users";
}) {
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
        <Link
          href="/admin"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "dashboard"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          Tableau de bord
        </Link>

        <Link
          href="/admin/follow-ups"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "followUps"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ClipboardCheck className="h-5 w-5" />
          Suivis
        </Link>

        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium text-slate-600 hover:bg-slate-100">
          <FileText className="h-5 w-5" />
          Rapports
        </button>

        <Link
          href="/admin/users"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "users"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="h-5 w-5" />
          Utilisateurs
        </Link>

        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium text-slate-600 hover:bg-slate-100">
          <Settings className="h-5 w-5" />
          Paramètres
        </button>
      </nav>

      {/* USER */}
      <form action="/logout" method="POST" className="mt-auto">
        <button
          type="submit"
          className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a8a] text-lg font-bold text-white">
              AD
            </div>

            <div>
              <p className="font-semibold">Admin</p>
              <p className="text-sm text-slate-500">Se déconnecter</p>
            </div>
          </div>

          <ChevronDown className="h-5 w-5 text-slate-400" />
        </button>
      </form>
    </aside>
  );
}
