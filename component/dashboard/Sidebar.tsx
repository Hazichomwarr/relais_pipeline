import type { UserRole } from "@prisma/client";
import {
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Newspaper,
  School,
  Settings,
  StickyNote,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Sidebar({
  activeItem = "dashboard",
  role,
}: {
  activeItem?:
    | "dashboard"
    | "followUps"
    | "users"
    | "schools"
    | "notes"
    | "finances"
    | "updates"
    | "reports"
    | "reportsManagement";
  role?: UserRole;
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
          href="/updates"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "updates"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Newspaper className="h-5 w-5" />À la une
        </Link>

        <Link
          href="/schools"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "schools"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <School className="h-5 w-5" />
          Toutes les écoles
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

        <Link
          href="/finances"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "finances"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Wallet className="h-5 w-5" />
          Finances
        </Link>

        <Link
          href="/notes"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "notes"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <StickyNote className="h-5 w-5" />
          Mes notes
        </Link>

        <Link
          href="/reports"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "reports"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="h-5 w-5" />
          Mes rapports
        </Link>

        <Link
          href="/admin/reports"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
            activeItem === "reportsManagement"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ClipboardList className="h-5 w-5" />
          Suivi des rapports
        </Link>

        {role === "ADMIN" && (
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
        )}

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
