import { SearchX } from "lucide-react";
import Link from "next/link";

import {
  Badge,
  formatDateTime,
  getInterestLabel,
  getInterestStyles,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import { followUpActionOptions } from "@/src/lib/constants/prospect-options";
import type { InterestLevel, ProspectStatus } from "@prisma/client";

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export type DigitalServicesDirectoryCardItem = {
  id: string;
  name: string;
  businessCategory: string | null;
  status: ProspectStatus;
  interest: InterestLevel;
  commercialName: string;
  nextAction: string | null;
  createdAt: Date;
  detailHref: string | null;
};

type DigitalServicesDirectoryCardsProps = {
  items: DigitalServicesDirectoryCardItem[];
};

export default function DigitalServicesDirectoryCards({
  items,
}: DigitalServicesDirectoryCardsProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center">
        <SearchX className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-slate-800">
          Aucune entreprise trouvée.
        </p>
        <p className="mt-2 text-slate-500">
          Cette entreprise n&apos;a pas encore été prospectée.
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

          {item.businessCategory && (
            <p className="mt-1 text-sm text-slate-500">
              {item.businessCategory}
            </p>
          )}

          <p className="mt-2 text-sm text-slate-500">
            Commercial :{" "}
            <span className="font-medium">{item.commercialName}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-100 text-slate-700">
              {getStatusLabel(item.status)}
            </Badge>
            <Badge className={getInterestStyles(item.interest)}>
              {getInterestLabel(item.interest)}
            </Badge>
          </div>

          {item.nextAction && (
            <p className="mt-3 text-sm text-slate-500">
              Prochaine action :{" "}
              <span className="font-medium text-slate-700">
                {labelFor(followUpActionOptions, item.nextAction)}
              </span>
            </p>
          )}

          <p className="mt-1 text-sm text-slate-400">
            {formatDateTime(item.createdAt)}
          </p>

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
