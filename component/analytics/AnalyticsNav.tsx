"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/analytics/funnel", label: "Pipeline" },
  { href: "/admin/analytics/why", label: "Pourquoi ?" },
] as const;

/**
 * Local navigation shared by the two sibling analytics pages — the main
 * sidebar keeps a single "Analyses" entry (Ticket 20G).
 */
export default function AnalyticsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex-1 rounded-xl px-4 py-2 text-center text-sm font-semibold transition ${
              isActive
                ? "bg-[#0f2557] text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
