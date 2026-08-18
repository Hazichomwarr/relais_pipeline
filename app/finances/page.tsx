import { BarChart3, CheckCircle2, Plus, SearchX } from "lucide-react";
import Link from "next/link";

import FinancialSummaryCards from "@/component/finances/FinancialSummaryCards";
import LedgerEmptyState from "@/component/finances/LedgerEmptyState";
import LedgerEntryTable from "@/component/finances/LedgerEntryTable";
import LedgerHistoryFilters from "@/component/finances/LedgerHistoryFilters";
import { parseLedgerHistoryFilter } from "@/src/lib/ledger-history-filters";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";
import {
  getEffectiveFinancialLedgerSummary,
  listLedgerEntries,
} from "@/src/services/financial-ledger.service";

type FinancesSearchParams = Promise<{
  type?: string;
  category?: string;
  product?: string;
  created?: string;
}>;

/**
 * The layout already ran requireRole("ADMIN", "MANAGER") — this call just
 * reads the role for UI visibility (the create buttons), not a second
 * authorization check.
 */
export default async function FinancesPage({
  searchParams,
}: {
  searchParams: FinancesSearchParams;
}) {
  const params = await searchParams;
  const user = await requireAuthenticatedUser();
  const canCreate = user.role === "ADMIN";

  const filter = parseLedgerHistoryFilter(params);

  // The KPI cards always reflect the whole ledger — history filters must
  // never narrow "Solde actuel" into e.g. a "fuel balance" (Ticket 17C.1).
  // They report effective business movement, not raw ledger volume: a
  // fully reversed entry contributes 0 CFA to Entrées/Sorties even
  // though both its original and compensating rows remain visible below
  // (Ticket 23A).
  const [summary, entries] = await Promise.all([
    getEffectiveFinancialLedgerSummary(),
    listLedgerEntries(filter),
  ]);

  const flashMessage =
    params.created === "inflow"
      ? "L’entrée a été enregistrée."
      : params.created === "outflow"
        ? "La sortie a été enregistrée."
        : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
            Finances
          </h1>
          <p className="mt-2 max-w-xl text-base text-slate-500">
            Suivez les entrées, les sorties et le solde actuel de RELAIS.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/finances/reports"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <BarChart3 className="h-4 w-4" />
            Voir les rapports
          </Link>

          {canCreate && (
            <>
              <Link
                href="/finances/new?type=INFLOW"
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f]"
              >
                <Plus className="h-4 w-4" />
                Nouvelle entrée
              </Link>
              <Link
                href="/finances/new?type=OUTFLOW"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Nouvelle sortie
              </Link>
            </>
          )}
        </div>
      </div>

      {flashMessage && (
        <div
          role="status"
          className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {flashMessage}
        </div>
      )}

      <FinancialSummaryCards summary={summary} />

      <div className="mt-8 mb-4">
        <h2 className="text-xl font-bold text-[#0f2557]">
          Historique des mouvements
          {entries.length > 0 && (
            <span className="ml-2 text-sm font-medium text-slate-400">
              {entries.length} mouvement{entries.length > 1 ? "s" : ""}
            </span>
          )}
        </h2>
      </div>

      <div className="mb-6">
        <LedgerHistoryFilters
          type={filter.type}
          category={filter.category}
          product={filter.product}
        />
      </div>

      {entries.length === 0 ? (
        filter.type ? (
          <div className="rounded-4xl border border-slate-200 bg-white px-6 py-16 text-center">
            <SearchX className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
            <h3 className="mt-5 text-xl font-bold text-[#0f2557]">
              Aucun mouvement ne correspond à ces filtres.
            </h3>
            <Link
              href="/finances"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Réinitialiser les filtres
            </Link>
          </div>
        ) : (
          <LedgerEmptyState canCreate={canCreate} />
        )
      ) : (
        <LedgerEntryTable entries={entries} />
      )}
    </div>
  );
}
