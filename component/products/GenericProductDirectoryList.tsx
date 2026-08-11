import { SearchX } from "lucide-react";
import Link from "next/link";

import {
  Badge,
  getInterestLabel,
  getInterestStyles,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import type { InterestLevel, ProspectStatus } from "@prisma/client";

export type GenericProductDirectoryItem = {
  id: string;
  name: string;
  status: ProspectStatus;
  interest: InterestLevel;
  commercialName: string;
  detailHref: string | null;
};

type GenericProductDirectoryListProps = {
  items: GenericProductDirectoryItem[];
};

/**
 * Minimal, search-less, filter-less company-wide list reused across the
 * DIGITAL_SERVICES/LOKARI/NIA foundation directories (Ticket 15G.1) — deliberately
 * lighter than SchoolDirectoryCards; a real per-product directory (search,
 * business-specific fields) is Ticket 15G.2's job.
 */
export default function GenericProductDirectoryList({
  items,
}: GenericProductDirectoryListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center">
        <SearchX className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-slate-800">
          Aucun prospect enregistré.
        </p>
        <p className="mt-2 text-slate-500">
          Aucun prospect n’a encore été enregistré pour ce produit.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5"
        >
          <p className="truncate text-lg font-semibold text-slate-900">
            {item.name}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Commercial : <span className="font-medium">{item.commercialName}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-100 text-slate-700">
              {getStatusLabel(item.status)}
            </Badge>
            <Badge className={getInterestStyles(item.interest)}>
              {getInterestLabel(item.interest)}
            </Badge>
          </div>

          {item.detailHref ? (
            <Link
              href={item.detailHref}
              className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
            >
              Voir le prospect
            </Link>
          ) : (
            <p className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border border-slate-100 text-sm text-slate-400">
              Assigné à un autre commercial
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
