import { ArrowLeft, ArrowRight, List } from "lucide-react";
import Link from "next/link";

import type { ProspectRecordNavigationProps } from "@/src/lib/prospect-record-navigation";

export function ProspectRecordNavigation({
  previousHref,
  previousLabel,
  nextHref,
  nextLabel,
  returnHref,
  contextLabel,
}: ProspectRecordNavigationProps) {
  return (
    <nav
      aria-label="Navigation entre prospects"
      className="mb-6 rounded-3xl border border-slate-200 bg-white p-4"
    >
      {contextLabel && (
        <p className="mb-3 text-sm font-medium text-slate-500">
          {contextLabel}
        </p>
      )}

      {/* Mobile: return-to-list on top, previous/next stacked below */}
      <div className="flex flex-col gap-3 sm:hidden">
        <ReturnLink returnHref={returnHref} className="w-full" />

        <div className="flex gap-3">
          <NavLink
            href={previousHref}
            label={previousLabel}
            direction="previous"
            className="min-w-0 flex-1"
          />
          <NavLink
            href={nextHref}
            label={nextLabel}
            direction="next"
            className="min-w-0 flex-1"
          />
        </div>
      </div>

      {/* Desktop: [← Précédent] [Retour à la liste] [Suivant →] */}
      <div className="hidden items-center gap-3 sm:flex">
        <NavLink
          href={previousHref}
          label={previousLabel}
          direction="previous"
          className="min-w-0 flex-1"
        />
        <ReturnLink returnHref={returnHref} className="shrink-0" />
        <NavLink
          href={nextHref}
          label={nextLabel}
          direction="next"
          className="min-w-0 flex-1"
        />
      </div>
    </nav>
  );
}

function ReturnLink({
  returnHref,
  className = "",
}: {
  returnHref: string;
  className?: string;
}) {
  return (
    <Link
      href={returnHref}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-medium text-slate-700 hover:bg-slate-50 ${className}`}
    >
      <List className="h-4 w-4 shrink-0" />
      Retour à la liste
    </Link>
  );
}

function NavLink({
  href,
  label,
  direction,
  className = "",
}: {
  href: string | null;
  label: string | null;
  direction: "previous" | "next";
  className?: string;
}) {
  const isNext = direction === "next";
  const text = isNext ? "Suivant" : "Précédent";

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-100 px-4 text-slate-300 ${className}`}
      >
        {!isNext && <ArrowLeft className="h-4 w-4 shrink-0" />}
        {text}
        {isNext && <ArrowRight className="h-4 w-4 shrink-0" />}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label ? `${text} : ${label}` : text}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 font-medium text-slate-700 hover:bg-slate-50 ${className}`}
    >
      {!isNext && <ArrowLeft className="h-4 w-4 shrink-0" />}
      <span className="truncate">
        {text}
        {label ? ` · ${label}` : ""}
      </span>
      {isNext && <ArrowRight className="h-4 w-4 shrink-0" />}
    </Link>
  );
}
