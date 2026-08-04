import Link from "next/link";

import {
  followUpActionOptions,
  interestOptions,
  productOptions,
} from "@/src/lib/constants/prospect-options";
import type { FollowUpQueueItem } from "@/src/services/follow-up.service";

const MAX_VISIBLE = 5;

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export default function CommercialFollowUpPriority({
  items,
}: {
  items: FollowUpQueueItem[];
}) {
  const visible = items.slice(0, MAX_VISIBLE);

  return (
    <section id="mes-suivis" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-[#0f2557]">
          Actions prioritaires
        </h2>
        {items.length > MAX_VISIBLE && (
          <a
            href="#mes-suivis"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Voir tous mes suivis
          </a>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center">
          <p className="font-semibold text-emerald-700">Tout est à jour.</p>
          <p className="mt-1 text-sm text-emerald-600">
            Aucun suivi ne demande votre attention aujourd’hui.
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-100 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    href={`/dashboard/commercial/prospects/${item.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {labelFor(productOptions, item.product)} ·{" "}
                    <a
                      href={`tel:${item.phone}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {item.phone}
                    </a>
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    item.overdueDays !== null && item.overdueDays > 0
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {item.followUpLabel}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>
                  {item.nextAction
                    ? labelFor(followUpActionOptions, item.nextAction)
                    : "Aucune action prévue"}
                </span>
                <span>{labelFor(interestOptions, item.interest)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
