"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getInitialsFromName } from "@/src/lib/initials";

import { commercialNavItems, resolveCommercialActiveItem } from "./commercialNavItems";

type CommercialSidebarProps = {
  firstName: string;
  lastName: string;
};

export default function CommercialSidebar({
  firstName,
  lastName,
}: CommercialSidebarProps) {
  const pathname = usePathname();
  const activeItem = resolveCommercialActiveItem(pathname);

  return (
    <aside className="sticky top-0 hidden h-screen w-65 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
      <div className="mb-5 flex flex-col items-center">
        <Image
          src="/images/logo.png"
          alt="Relais"
          width={200}
          height={20}
          className="object-contain"
        />
      </div>

      <nav className="space-y-2">
        {commercialNavItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 font-medium ${
              activeItem === item.key
                ? "bg-blue-50 text-blue-600"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a8a] text-lg font-bold text-white">
            {getInitialsFromName(`${firstName} ${lastName}`)}
          </div>

          <div>
            <p className="font-semibold">
              {firstName} {lastName}
            </p>
            <p className="text-sm text-slate-500">Commercial</p>
          </div>
        </div>

        <form action="/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}
