import { SearchX } from "lucide-react";
import Link from "next/link";

import {
  Badge,
  formatDateTime,
  getInterestLabel,
  getInterestStyles,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import type { SchoolDirectoryItem } from "@/src/services/school-directory.service";

type SchoolDirectoryCardsProps = {
  schools: SchoolDirectoryItem[];
  resolveHref: (school: SchoolDirectoryItem) => string;
};

export default function SchoolDirectoryCards({
  schools,
  resolveHref,
}: SchoolDirectoryCardsProps) {
  if (schools.length === 0) {
    return (
      <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center">
        <SearchX className="mx-auto h-10 w-10 text-slate-400" />
        <p className="mt-4 text-lg font-semibold text-slate-800">
          Aucun établissement trouvé.
        </p>
        <p className="mt-2 text-slate-500">
          Cette école n&apos;a pas encore été prospectée.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {schools.map((school) => (
        <article
          key={school.id}
          className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5"
        >
          <p className="truncate text-lg font-semibold text-slate-900">
            {school.name}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Commercial : <span className="font-medium">{school.commercialName}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-100 text-slate-700">
              {getStatusLabel(school.status)}
            </Badge>
            <Badge className={getInterestStyles(school.interest)}>
              {getInterestLabel(school.interest)}
            </Badge>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Dernière activité :{" "}
            <span className="font-medium text-slate-700">
              {school.lastActivityAt
                ? formatDateTime(school.lastActivityAt)
                : "Aucune activité enregistrée"}
            </span>
          </p>

          <Link
            href={resolveHref(school)}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
          >
            Voir le prospect
          </Link>
        </article>
      ))}
    </div>
  );
}
