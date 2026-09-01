import type { UserRole } from "@prisma/client";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  Library,
  ListTodo,
  Newspaper,
  Settings,
  StickyNote,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";

import MobileNavDrawer, {
  type MobileNavItem,
} from "@/component/dashboard/MobileNavDrawer";

/**
 * Ticket 25M §24/§25/§43 — ASSISTANT reuses this Admin-style shell for
 * layout only, never for authority: shell choice must not imply
 * permission. Every item that leads into a still-ADMIN/MANAGER-only
 * route (or into a capability this role doesn't have) is explicitly
 * excluded for ASSISTANT rather than left dangling on a route that would
 * just reject them. Ticket 25N added Finances; Ticket 25R adds Tableau
 * de bord (now unconditional, matching Mes notes/Mes rapports/
 * Paramètres) — the dashboard-shell capability ASSISTANT now has (see
 * app/admin/layout.tsx's requireDashboardAccess() and app/admin/page.tsx's
 * own, deliberately minimal ASSISTANT content). Still a narrow,
 * deliberately incremental nav, not a blanket re-enablement of the
 * Admin/Manager sidebar: each capability grant gets its own explicit
 * item.
 */
function getAdminNavItems(role?: UserRole): MobileNavItem[] {
  const isAssistant = role === "ASSISTANT";

  return [
    {
      label: "Tableau de bord",
      href: "/admin",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    // Ticket 27H — Ma journée: MANAGER/ASSISTANT here (COMMERCIAL uses
    // CommercialMobileHeader instead). ADMIN excluded — no personal
    // Workday (27A §4). Same visibility as the desktop Sidebar item.
    ...(role !== "ADMIN"
      ? [
          {
            label: "Ma journée",
            href: "/ma-journee",
            icon: <CalendarClock className="h-5 w-5" />,
          },
        ]
      : []),
    ...(!isAssistant
      ? [
          {
            label: "À la une",
            href: "/updates",
            icon: <Newspaper className="h-5 w-5" />,
          },
        ]
      : []),
    ...(!isAssistant
      ? [
          {
            label: "Nouveau prospect",
            href: "/",
            icon: <UserPlus className="h-5 w-5" />,
          },
        ]
      : []),
    ...(!isAssistant
      ? [
          {
            label: "Actions",
            href: "/actions",
            icon: <ListTodo className="h-5 w-5" />,
          },
        ]
      : []),
    // Ticket 27H — Journées des agents: DAILY_WORK_MANAGEMENT_ROLES
    // (ADMIN, MANAGER). Same visibility/ordering as the desktop Sidebar
    // item — beside the other operational management surfaces.
    ...(role === "ADMIN" || role === "MANAGER"
      ? [
          {
            label: "Journées des agents",
            href: "/admin/journees-agents",
            icon: <CalendarCheck className="h-5 w-5" />,
          },
        ]
      : []),
    ...(role === "ADMIN" || role === "MANAGER"
      ? [
          {
            label: "Mes prospects",
            href: "/admin/my-prospects",
            icon: <UserCheck className="h-5 w-5" />,
          },
        ]
      : []),
    ...(!isAssistant
      ? [
          {
            label: "Répertoire",
            href: "/products",
            icon: <Library className="h-5 w-5" />,
          },
        ]
      : []),
    ...(!isAssistant
      ? [
          {
            label: "Suivis",
            href: "/admin/follow-ups",
            icon: <ClipboardCheck className="h-5 w-5" />,
          },
        ]
      : []),
    ...(role === "ADMIN" || role === "ASSISTANT"
      ? [
          {
            label: "Finances",
            href: "/finances",
            icon: <Wallet className="h-5 w-5" />,
          },
        ]
      : []),
    ...(!isAssistant
      ? [
          {
            label: "Analyses",
            href: "/admin/analytics/funnel",
            icon: <BarChart3 className="h-5 w-5" />,
          },
        ]
      : []),
    {
      label: "Mes notes",
      href: "/notes",
      icon: <StickyNote className="h-5 w-5" />,
    },
    {
      label: "Mes rapports",
      href: "/reports",
      icon: <FileText className="h-5 w-5" />,
    },
    ...(!isAssistant
      ? [
          {
            label: "Rapports quotidiens",
            href: "/admin/reports",
            icon: <ClipboardList className="h-5 w-5" />,
          },
        ]
      : []),
    ...(role === "ADMIN" || role === "MANAGER"
      ? [
          {
            label: "Performance",
            href: "/admin/performance",
            icon: <Gauge className="h-5 w-5" />,
          },
        ]
      : []),
    ...(role === "ADMIN"
      ? [
          {
            label: "Utilisateurs",
            href: "/admin/users",
            icon: <Users className="h-5 w-5" />,
          },
        ]
      : []),
    {
      label: "Paramètres",
      href: "/profile",
      icon: <Settings className="h-5 w-5" />,
    },
  ];
}

export default function AdminMobileHeader({ role }: { role?: UserRole }) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <Image
        src="/images/logo.png"
        alt="Relais"
        width={110}
        height={12}
        className="object-contain"
      />

      <MobileNavDrawer
        items={getAdminNavItems(role)}
        triggerLabel="Ouvrir le menu d’administration"
        footer={
          <form action="/logout" method="POST">
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Se déconnecter
            </button>
          </form>
        }
      />
    </header>
  );
}
