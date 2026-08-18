import { Eye } from "lucide-react";
import Link from "next/link";

import LedgerEntryCard from "@/component/finances/LedgerEntryCard";
import LedgerEntryCategoryBadge from "@/component/finances/LedgerEntryCategoryBadge";
import LedgerEntryStatusBadge from "@/component/finances/LedgerEntryStatusBadge";
import {
  formatSignedXofAmount,
  getLedgerTypeLabel,
} from "@/component/finances/LedgerTypeBadge";
import {
  formatLedgerOccurredDate,
  getRelaisProductLabel,
} from "@/component/finances/ledger-presentation";
import { getPaymentMethodLabel } from "@/src/lib/financial-ledger-options";
import type { LedgerEntryListItem } from "@/src/services/financial-ledger.service";

/**
 * Order is whatever `entries` arrives in — the Ticket 17A service already
 * sorts occurredAt/createdAt/id DESC, so this component never re-sorts.
 */
export default function LedgerEntryTable({
  entries,
}: {
  entries: LedgerEntryListItem[];
}) {
  return (
    <div className="overflow-hidden rounded-4xl border border-slate-200 bg-white">
      {/* Mobile / tablet: transaction cards */}
      <div className="flex flex-col gap-4 p-4 lg:hidden">
        {entries.map((entry) => (
          <LedgerEntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {/* Desktop: full history table. table-fixed + colgroup gives every
          column a deliberate share of the available width instead of
          letting long content force the table past the viewport (Ticket
          24B) — columns wrap rather than pushing the table wider. */}
      <div className="hidden overflow-x-auto p-6 lg:block">
        <table className="w-full table-fixed border-separate border-spacing-y-3">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[5%]" />
            <col className="w-[19%]" />
            <col className="w-[11%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="text-left text-sm font-medium text-slate-500">
              <th className="pb-2">Date</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Montant</th>
              <th className="pb-2">Catégorie</th>
              <th className="pb-2">Produit</th>
              <th className="pb-2">Tiers</th>
              <th className="pb-2">Mode</th>
              <th className="pb-2">Statut</th>
              <th className="pb-2">Enregistré par</th>
              <th className="pb-2 text-center">Voir</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="bg-[#fafbff] shadow-sm">
                <td className="rounded-l-2xl px-3 py-4">
                  {formatLedgerOccurredDate(entry.occurredAt)}
                </td>
                <td className="px-3 py-4">
                  <span className="sr-only">
                    {getLedgerTypeLabel(entry.type)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${entry.type === "INFLOW" ? "text-emerald-700" : "text-red-700"}`}
                    aria-hidden="true"
                  >
                    {getLedgerTypeLabel(entry.type)}
                  </span>
                </td>
                <td
                  className={`px-3 py-4 font-semibold whitespace-nowrap ${entry.type === "INFLOW" ? "text-emerald-700" : "text-red-700"}`}
                >
                  {formatSignedXofAmount(entry.type, entry.amount)}
                </td>
                <td className="px-3 py-4">
                  <LedgerEntryCategoryBadge category={entry.category} />
                </td>
                <td className="px-3 py-4">
                  {entry.product ? getRelaisProductLabel(entry.product) : "—"}
                </td>
                <td className="px-3 py-4 break-words">
                  {entry.counterpartyName}
                </td>
                <td className="px-3 py-4 break-words">
                  {getPaymentMethodLabel(entry.paymentMethod)}
                </td>
                <td className="px-3 py-4">
                  <LedgerEntryStatusBadge status={entry.status} />
                </td>
                <td className="px-3 py-4 break-words">
                  {entry.createdByUserDisplayName}
                </td>
                <td className="rounded-r-2xl px-3 py-4">
                  <div className="flex justify-center">
                    <Link
                      href={`/finances/ledger/${entry.id}`}
                      aria-label={`Voir l’écriture du ${formatLedgerOccurredDate(entry.occurredAt)}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"
                    >
                      <Eye className="h-5 w-5 text-slate-600" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
        {entries.length} écriture{entries.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}
