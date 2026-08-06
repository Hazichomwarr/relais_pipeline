import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import type { UseFormRegisterReturn } from "react-hook-form";

import {
  Badge,
  formatDateTime,
  getInterestLabel,
  getInterestStyles,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import { normalizeSchoolName } from "@/src/lib/school-name-normalization";

import { FormError } from "./form-error";
import type { SchoolDuplicateLookupState } from "./useSchoolDuplicateLookup";

export const SCHOOL_DUPLICATE_WARNING_ID = "school-duplicate-warning";

type SchoolDuplicateWarningProps = {
  lookup: SchoolDuplicateLookupState;
  query: string;
  checkboxProps: UseFormRegisterReturn;
  checkboxError?: string;
};

function statusAnnouncement(lookup: SchoolDuplicateLookupState) {
  switch (lookup.status) {
    case "idle":
      return "";
    case "loading":
      return "Vérification des établissements existants…";
    case "error":
      return lookup.message;
    case "success": {
      const count = lookup.matches.length;
      if (count === 0) {
        return "Aucun établissement similaire trouvé.";
      }
      const plural = count > 1 ? "s" : "";
      return `${count} établissement${plural} similaire${plural} trouvé${plural}.`;
    }
  }
}

export function SchoolDuplicateWarning({
  lookup,
  query,
  checkboxProps,
  checkboxError,
}: SchoolDuplicateWarningProps) {
  const matches = lookup.status === "success" ? lookup.matches : [];
  const hasExactMatch = matches.some(
    (match) => normalizeSchoolName(match.name) === normalizeSchoolName(query),
  );

  return (
    <div>
      {/* Always present while active — carries loading/empty/error state to
          assistive tech without cluttering the visible UI ("no-match state
          behaves quietly"). */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusAnnouncement(lookup)}
      </p>

      {lookup.status === "loading" && (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Vérification des établissements existants…
        </p>
      )}

      {lookup.status === "error" && (
        <p className="mt-2 flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {lookup.message}
        </p>
      )}

      {matches.length > 0 && (
        <div
          id={SCHOOL_DUPLICATE_WARNING_ID}
          className="mt-4 space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-5"
        >
          <div>
            <h3 className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Établissements similaires déjà enregistrés
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Vérifiez qu’il ne s’agit pas d’une école déjà prospectée avant
              de continuer.
            </p>
            {hasExactMatch && (
              <p className="mt-2 text-sm font-semibold text-amber-900">
                Un établissement portant ce nom existe déjà dans RELAIS CRM.
              </p>
            )}
          </div>

          <ul className="space-y-3">
            {matches.map((match) => (
              <li
                key={match.id}
                className="rounded-2xl border border-amber-100 bg-white p-4"
              >
                <p className="font-semibold text-slate-900">{match.name}</p>
                {match.location && (
                  <p className="text-sm text-slate-500">{match.location}</p>
                )}

                <p className="mt-2 text-sm text-slate-600">
                  Commercial :{" "}
                  <span className="font-medium">
                    {match.assignedUserName}
                  </span>
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-700">
                    {getStatusLabel(match.status)}
                  </Badge>
                  <Badge className={getInterestStyles(match.interest)}>
                    {getInterestLabel(match.interest)}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Dernier contact :{" "}
                  {match.lastContactAt
                    ? formatDateTime(match.lastContactAt)
                    : "Aucun contact enregistré"}
                </p>

                <Link
                  href={`/schools/${match.id}`}
                  className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Voir cette école
                </Link>
              </li>
            ))}
          </ul>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-white p-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0"
              {...checkboxProps}
            />
            <span className="text-sm font-medium text-slate-800">
              J’ai vérifié les établissements existants et je confirme qu’il
              s’agit d’un nouveau prospect.
            </span>
          </label>

          <FormError message={checkboxError} />
        </div>
      )}
    </div>
  );
}
