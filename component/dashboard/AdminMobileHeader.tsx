import type { UserRole } from "@prisma/client";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FileText,
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

function getAdminNavItems(role?: UserRole): MobileNavItem[] {
  return [
    {
      label: "Tableau de bord",
      href: "/admin",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      label: "À la une",
      href: "/updates",
      icon: <Newspaper className="h-5 w-5" />,
    },
    {
      label: "Nouveau prospect",
      href: "/",
      icon: <UserPlus className="h-5 w-5" />,
    },
    {
      label: "Actions",
      href: "/actions",
      icon: <ListTodo className="h-5 w-5" />,
    },
    ...(role === "ADMIN" || role === "MANAGER"
      ? [
          {
            label: "Mes prospects",
            href: "/admin/my-prospects",
            icon: <UserCheck className="h-5 w-5" />,
          },
        ]
      : []),
    {
      label: "Répertoire",
      href: "/products",
      icon: <Library className="h-5 w-5" />,
    },
    {
      label: "Suivis",
      href: "/admin/follow-ups",
      icon: <ClipboardCheck className="h-5 w-5" />,
    },
    ...(role === "ADMIN"
      ? [
          {
            label: "Finances",
            href: "/finances",
            icon: <Wallet className="h-5 w-5" />,
          },
        ]
      : []),
    {
      label: "Analyses",
      href: "/admin/analytics/funnel",
      icon: <BarChart3 className="h-5 w-5" />,
    },
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
    {
      label: "Rapports quotidiens",
      href: "/admin/reports",
      icon: <ClipboardList className="h-5 w-5" />,
    },
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
      href: "/admin",
      icon: <Settings className="h-5 w-5" />,
      disabled: true,
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
