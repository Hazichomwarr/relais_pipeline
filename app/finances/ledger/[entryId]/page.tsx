import { ArrowLeft, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import LedgerEntryCategoryBadge from "@/component/finances/LedgerEntryCategoryBadge";
import LedgerEntryStatusBadge from "@/component/finances/LedgerEntryStatusBadge";
import {
  formatSignedXofAmount,
  getCounterpartyLabel,
} from "@/component/finances/LedgerTypeBadge";
import {
  formatLedgerOccurredDate,
  getRelaisProductLabel,
} from "@/component/finances/ledger-presentation";
import ReverseLedgerEntryForm from "@/component/finances/ReverseLedgerEntryForm";
import { getPaymentMethodLabel } from "@/src/lib/financial-ledger-options";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";
import { getLedgerEntryById } from "@/src/services/financial-ledger.service";

type LedgerEntryDetailPageProps = {
  params: Promise<{ entryId: string }>;
};

export default async function LedgerEntryDetailPage({
  params,
}: LedgerEntryDetailPageProps) {
  const { entryId } = await params;

  const [user, entry] = await Promise.all([
    requireAuthenticatedUser(),
    getLedgerEntryById(entryId),
  ]);

  if (!entry) {
    notFound();
  }

  // Ticket 25N: reversal is ordinary operational Finance work, same
  // capability as creation — ADMIN or ASSISTANT, never trusted here
  // alone (the reverseLedgerEntryAction Server Action re-authorizes via
  // requireFinanceAccess()).
  const canReverse =
    (user.role === "ADMIN" || user.role === "ASSISTANT") &&
    entry.status === "POSTED" &&
    entry.reversalOfId === null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/finances"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux finances
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LedgerEntryCategoryBadge category={entry.category} />
        <LedgerEntryStatusBadge status={entry.status} />
      </div>

      <p
        className={`text-4xl font-bold ${entry.type === "INFLOW" ? "text-emerald-700" : "text-red-700"}`}
      >
        {formatSignedXofAmount(entry.type, entry.amount)}
      </p>

      {entry.reversalOfId && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Annulation de l’écriture{" "}
          <Link
            href={`/finances/ledger/${entry.reversalOfId}`}
            className="font-semibold underline"
          >
            {entry.reversalOf?.id ?? entry.reversalOfId}
          </Link>
        </p>
      )}

      {entry.reversedById && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Cette écriture a été annulée par{" "}
          <Link
            href={`/finances/ledger/${entry.reversedById}`}
            className="font-semibold underline"
          >
            l’écriture de correction
          </Link>
        </p>
      )}

      <dl className="mt-7 space-y-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {entry.product && (
          <DetailRow label="Produit" value={getRelaisProductLabel(entry.product)} />
        )}
        <DetailRow
          label={getCounterpartyLabel(entry.type)}
          value={entry.counterpartyName}
        />
        <DetailRow label="Motif" value={entry.reason} />
        <DetailRow
          label="Mode de paiement"
          value={getPaymentMethodLabel(entry.paymentMethod)}
        />
        <DetailRow
          label="Date du mouvement"
          value={formatLedgerOccurredDate(entry.occurredAt)}
        />
        {entry.reference && <DetailRow label="Référence" value={entry.reference} />}
        <DetailRow
          label="Enregistré par"
          value={entry.createdByUserDisplayName}
        />
        <DetailRow
          label="Enregistrée le"
          value={formatLedgerOccurredDate(entry.createdAt)}
        />
      </dl>

      {canReverse && (
        <div className="mt-6 flex justify-end">
          <ReverseLedgerEntryForm entryId={entry.id} />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-sm font-medium text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-semibold text-slate-800 sm:text-left">
        {value}
      </dd>
    </div>
  );
}
