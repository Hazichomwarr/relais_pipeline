import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type DailyWorkEntryCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

/**
 * Ticket 27H §11-16 — a dashboard *entry point* into Daily Work, never a
 * duplicate of /ma-journee or /admin/journees-agents. Deliberately
 * stable/static (§13): no Workday query lives here, so this card never
 * grows into a second read architecture. The canonical live state
 * belongs on the destination route alone. Shared across the Commercial,
 * Manager, Admin, and Assistant dashboards so all four stay visually
 * and structurally identical — copy/href/icon are the only things that
 * differ per placement.
 */
export default function DailyWorkEntryCard({
  icon: Icon,
  title,
  description,
  href,
  ctaLabel,
}: DailyWorkEntryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#0f2557]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      <p className="mt-4 text-lg font-semibold text-[#0f2557]">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <Link
        href={href}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#0f2557] px-5 text-sm font-semibold text-white transition hover:bg-[#18366f]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
