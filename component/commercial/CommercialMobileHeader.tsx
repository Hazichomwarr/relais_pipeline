import { LogOut } from "lucide-react";
import Image from "next/image";

import MobileNavDrawer, {
  type MobileNavItem,
} from "@/component/dashboard/MobileNavDrawer";

import { commercialNavItems } from "./commercialNavItems";

const mobileNavItems: MobileNavItem[] = commercialNavItems.map(
  ({ label, href, icon }) => ({ label, href, icon }),
);

type CommercialMobileHeaderProps = {
  firstName: string;
  lastName: string;
};

export default function CommercialMobileHeader({
  firstName,
  lastName,
}: CommercialMobileHeaderProps) {
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
        items={mobileNavItems}
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
    </header>
  );
}
