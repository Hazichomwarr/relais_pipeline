import {
  Building2,
  GraduationCap,
  PiggyBank,
  Store,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { ProductDirectoryOverviewItem } from "@/src/services/product-directory.service-core";

/**
 * Mirrors the product icon language already established in
 * component/dashboard/BusinessStats.tsx — kept local to this presentation
 * component rather than in src/lib/product-directory.ts, which must not
 * depend on a UI icon library.
 */
const productIcons: Record<ProductDirectoryOverviewItem["product"], LucideIcon> = {
  KARMDA: GraduationCap,
  DIGITAL_SERVICES: Store,
  LOKARI: Building2,
  NIA: PiggyBank,
};

export default function ProductDirectoryCard({
  item,
}: {
  item: ProductDirectoryOverviewItem;
}) {
  const Icon = productIcons[item.product];

  return (
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <Icon className="h-7 w-7 text-blue-600" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#0f2557]">{item.label}</h2>
          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
        </div>
      </div>

      <p className="mt-5 text-sm font-medium text-slate-600">
        {item.prospectCount === 0
          ? "Aucun prospect enregistré"
          : `${item.prospectCount} prospect${item.prospectCount > 1 ? "s" : ""}`}
      </p>

      <Link
        href={item.href}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Voir le répertoire
      </Link>
    </article>
  );
}
