import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { getProductLabel, getStatusLabel } from "@/component/propects/prospect-detail-sections";
import type { ProspectWithoutOpenActionItem } from "@/src/services/prospect-action-queue.service-core";

/**
 * ADMIN/MANAGER only — the caller (app/actions/page.tsx) only fetches and
 * renders this for those roles. Purely a derived integrity read (Ticket
 * 20E): never auto-creates a placeholder ProspectAction here, only links
 * to the prospect so a human can create a truthful one.
 */
export default function ProspectActionQueueAttention({
  prospects,
}: {
  prospects: ProspectWithoutOpenActionItem[];
}) {
  if (prospects.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/40 p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#0f2557]">À vérifier</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Prospects actifs sans prochaine action — {prospects.length}
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {prospects.map((prospect) => (
          <li
            key={prospect.id}
            className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{prospect.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {getStatusLabel(prospect.status)} · {getProductLabel(prospect.product)}
              </p>
            </div>

            {prospect.href && (
              <Link
                href={prospect.href}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Voir le prospect
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
