import { Eye } from "lucide-react";
import Link from "next/link";

import LedgerEntryCategoryBadge from "@/component/finances/LedgerEntryCategoryBadge";
import LedgerEntryStatusBadge from "@/component/finances/LedgerEntryStatusBadge";
import {
  formatSignedXofAmount,
  getCounterpartyLabel,
  getLedgerTypeLabel,
} from "@/component/finances/LedgerTypeBadge";
import {
  formatLedgerOccurredDate,
  getRelaisProductLabel,
} from "@/component/finances/ledger-presentation";
import { getPaymentMethodLabel } from "@/src/lib/financial-ledger-options";
import type { LedgerEntryListItem } from "@/src/services/financial-ledger.service";

export default function LedgerEntryCard({
  entry,
}: {
  entry: LedgerEntryListItem;
}) {
  const isReversal = entry.reversalOfId !== null;

  return (
    <article className="rounded-3xl border border-slate-200 bg-[#fafbff] p-4">
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-xl font-bold ${entry.type === "INFLOW" ? "text-emerald-700" : "text-red-700"}`}
        >
          {formatSignedXofAmount(entry.type, entry.amount)}
        </p>
        <span className="sr-only">{getLedgerTypeLabel(entry.type)}</span>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <LedgerEntryStatusBadge status={entry.status} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <LedgerEntryCategoryBadge category={entry.category} />
        {entry.product && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {getRelaisProductLabel(entry.product)}
          </span>
        )}
      </div>

      {isReversal && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Annulation d’une écriture
        </p>
      )}

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-400">{getCounterpartyLabel(entry.type)}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-slate-700">
            {entry.counterpartyName}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-400">Mode · Date</dt>
          <dd className="text-right font-medium text-slate-700">
            {getPaymentMethodLabel(entry.paymentMethod)} ·{" "}
            {formatLedgerOccurredDate(entry.occurredAt)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/finances/ledger/${entry.id}`}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
      >
        <Eye className="h-4 w-4" />
        Voir
      </Link>
    </article>
  );
}
