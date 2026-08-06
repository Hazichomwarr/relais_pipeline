import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  School,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";

import MobileNavDrawer, {
  type MobileNavItem,
} from "@/component/dashboard/MobileNavDrawer";

const adminNavItems: MobileNavItem[] = [
  {
    label: "Tableau de bord",
    href: "/admin",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Toutes les écoles",
    href: "/schools",
    icon: <School className="h-5 w-5" />,
  },
  {
    label: "Suivis",
    href: "/admin/follow-ups",
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
  {
    label: "Rapports",
    href: "/admin",
    icon: <FileText className="h-5 w-5" />,
    disabled: true,
  },
  {
    label: "Utilisateurs",
    href: "/admin/users",
    icon: <Users className="h-5 w-5" />,
  },
  {
    label: "Paramètres",
    href: "/admin",
    icon: <Settings className="h-5 w-5" />,
    disabled: true,
  },
];

export default function AdminMobileHeader() {
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
        items={adminNavItems}
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
