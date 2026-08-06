import {
  LayoutDashboard,
  ListChecks,
  LogOut,
  School,
  UserRound,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import MobileNavDrawer, {
  type MobileNavItem,
} from "@/component/dashboard/MobileNavDrawer";

type CommercialNavProps = {
  firstName: string;
  lastName: string;
};

const commercialNavItems: MobileNavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard/commercial",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Mes prospects",
    href: "/dashboard/commercial#mes-prospects",
    icon: <Users className="h-5 w-5" />,
  },
  {
    label: "Toutes les écoles",
    href: "/schools",
    icon: <School className="h-5 w-5" />,
  },
  {
    label: "Mes suivis",
    href: "/dashboard/commercial#mes-suivis",
    icon: <ListChecks className="h-5 w-5" />,
  },
  {
    label: "Mon profil",
    href: "/dashboard/commercial/profile",
    icon: <UserRound className="h-5 w-5" />,
  },
];

export default function CommercialNav({
  firstName,
  lastName,
}: CommercialNavProps) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="Relais"
            width={110}
            height={12}
            className="object-contain"
          />
          <span className="hidden text-sm text-slate-500 sm:inline">
            {firstName} {lastName}
          </span>
        </div>

        <nav className="hidden items-center gap-2 md:flex md:gap-4">
          <Link
            href="/dashboard/commercial"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Tableau de bord
          </Link>
          <Link
            href="/dashboard/commercial#mes-prospects"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mes prospects
          </Link>
          <Link
            href="/schools"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Toutes les écoles
          </Link>
          <Link
            href="/dashboard/commercial#mes-suivis"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mes suivis
          </Link>
          <Link
            href="/dashboard/commercial/profile"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mon profil
          </Link>

          <form action="/logout" method="POST">
            <button
              type="submit"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </form>
        </nav>

        <div className="md:hidden">
          <MobileNavDrawer
            items={commercialNavItems}
            triggerLabel="Ouvrir le menu"
            footer={
              <div className="space-y-3">
                <p className="px-1 text-sm font-semibold text-slate-700">
                  {firstName} {lastName}
                </p>
                <form action="/logout" method="POST">
                  <button
                    type="submit"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Déconnexion
                  </button>
                </form>
              </div>
            }
          />
        </div>
      </div>
    </header>
  );
}
