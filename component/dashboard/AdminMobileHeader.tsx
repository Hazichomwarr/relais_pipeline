import type { UserRole } from "@prisma/client";
import {
  BarChart3,
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
 * route (or into a capability 25M deliberately doesn't grant yet, like
 * prospecting) is explicitly excluded for ASSISTANT rather than left
 * dangling on a route that would just reject them. Ticket 25N adds
 * exactly one item back for this role — Finances, the new real
 * capability — alongside the pre-existing role-neutral routes (Mes
 * notes, Mes rapports, Paramètres). Still a narrow, deliberately
 * incremental nav, not a final Assistant navigation design (§20): each
 * future capability grant gets its own explicit item, never a blanket
 * re-enablement of the Admin/Manager sidebar.
 */
function getAdminNavItems(role?: UserRole): MobileNavItem[] {
  const isAssistant = role === "ASSISTANT";

  return [
    ...(!isAssistant
      ? [
          {
            label: "Tableau de bord",
            href: "/admin",
            icon: <LayoutDashboard className="h-5 w-5" />,
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
