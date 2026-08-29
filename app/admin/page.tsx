// app/admin/page.tsx

import { redirect } from "next/navigation";
import { FileText, StickyNote, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";

import AdminShell from "@/component/dashboard/AdminShell";
import BusinessStats from "@/component/dashboard/BusinessStats";
import DashboardTable from "@/component/dashboard/DashboardTable";
import KpiCards from "@/component/dashboard/KpiCards";
import ReportDateFilter from "@/component/dashboard/ReportDateFilter";
import { buildReturnToPath } from "@/src/lib/return-to";
import { getProspects } from "@/src/services/prospect.service";
import { listDashboardUserOptions } from "@/src/services/user.service";
import {
  AuthorizationError,
  requireDashboardAccess,
} from "@/src/services/authorization.service";
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

/**
 * Ticket 25R §5-13: ASSISTANT now passes this route's authorization
 * (requireDashboardAccess — ADMIN, MANAGER, ASSISTANT), but the *content*
 * is deliberately not shared. The prospect-listing query below returns
 * every company-wide prospect with owner detail, unfiltered by role — no
 * prior ticket (25M's ownership audit, 25N's Finance grant) ever gave
 * ASSISTANT prospect visibility, and this ticket does not either. Rather
 * than loosen that query or expose it read-only, ASSISTANT gets a distinct, deliberately
 * minimal landing composed in this same file (no separate
 * AssistantDashboard.tsx — the ticket's own §9 preference, since a
 * small conditional branch is enough): a welcome header plus shortcuts
 * into capabilities ASSISTANT actually has today (Finances, Mes notes,
 * Mes rapports). No prospect count, no KPI, no company-wide data of any
 * kind — zero new read capability beyond what 25N already granted.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  let actor;

  try {
    actor = await requireDashboardAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
    }
    throw error;
  }

  if (actor.role === "ASSISTANT") {
    return (
      <AdminShell activeItem="dashboard">
        <AssistantDashboardOverview />
      </AdminShell>
    );
  }

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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-base font-medium text-slate-500 lg:text-lg">
            <span className="text-xl font-bold text-[#0f2557] lg:text-2xl">
              {prospects.length}
            </span>{" "}
            prospect{prospects.length > 1 ? "s" : ""}
          </p>

          <ReportDateFilter />
        </div>
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

type AssistantShortcut = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const ASSISTANT_SHORTCUTS: AssistantShortcut[] = [
  {
    label: "Finances",
    description: "Enregistrer et consulter les mouvements financiers.",
    href: "/finances",
    icon: Wallet,
  },
  {
    label: "Mes notes",
    description: "Retrouver vos notes personnelles.",
    href: "/notes",
    icon: StickyNote,
  },
  {
    label: "Mes rapports",
    description: "Consulter et compléter vos rapports quotidiens.",
    href: "/reports",
    icon: FileText,
  },
];

/**
 * Ticket 25R §9/§11-13: a deliberately narrow overview — no prospect data,
 * no KPI, no clickable element leading anywhere ASSISTANT isn't already
 * independently authorized to go. Each shortcut links only to a route
 * this role already has real, established authority over (25N Finance;
 * self-service notes/reports, unrestricted by role).
 */
function AssistantDashboardOverview() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl lg:text-5xl">
          Tableau de bord
        </h1>
        <p className="mt-2 text-base text-slate-500 lg:text-lg">
          Bienvenue — accédez rapidement à vos espaces de travail.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ASSISTANT_SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className="flex flex-col gap-3 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <shortcut.icon className="h-6 w-6 text-[#0f2557]" />
            <div>
              <p className="text-lg font-semibold text-[#0f2557]">
                {shortcut.label}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {shortcut.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
