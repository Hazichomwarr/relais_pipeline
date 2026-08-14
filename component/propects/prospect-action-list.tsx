import type { UserRole } from "@prisma/client";
import { CheckCircle2, ListTodo, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { ProspectActionListItem } from "@/src/services/prospect-action.service";
import {
  canCancelProspectAction,
  canCompleteProspectAction,
  isOverdueProspectAction,
} from "@/src/services/prospect-action.service-core";

import ProspectActionRowActions from "./prospect-action-row-actions";

type ProspectActionListProps = {
  actions: ProspectActionListItem[];
  viewer: { id: string; role: UserRole };
  /** Ticket 22C — the "+ Nouvelle action" composer trigger, rendered in this section's own header instead of as a separate competing card. */
  headerAction?: ReactNode;
  /** Ticket 22C — the collapsible ProspectActionForm, rendered inside this same card below the lists when open. */
  footer?: ReactNode;
};

export default function ProspectActionList({
  actions,
  viewer,
  headerAction,
  footer,
}: ProspectActionListProps) {
  const open = actions.filter((action) => action.status === "OPEN");
  const history = actions.filter((action) => action.status !== "OPEN");

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ListTodo className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f2557]">Actions</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Ce qui doit se passer ensuite sur ce dossier, et qui s’en charge.
            </p>
          </div>
        </div>
        {headerAction}
      </div>

      {actions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-semibold text-slate-700">
            Aucune action pour ce prospect.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                À faire
              </p>
              <ul className="space-y-3">
                {open.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-2xl border border-slate-200 bg-[#fafbff] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">
                          {action.title}
                        </p>
                        {action.description && (
                          <p className="mt-1 text-sm text-slate-600">
                            {action.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          {assigneeName(action)} · Échéance{" "}
                          {formatMoment(action.dueAt)}
                          {isOverdueProspectAction(action) && (
                            <span className="ml-2 font-semibold text-red-600">
                              En retard
                            </span>
                          )}
                        </p>
                      </div>
                      <ProspectActionRowActions
                        actionId={action.id}
                        canComplete={canCompleteProspectAction(viewer, action)}
                        canCancel={canCancelProspectAction(viewer, action)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Terminées
              </p>
              <ul className="space-y-3">
                {history.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      {action.status === "COMPLETED" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-700 line-through decoration-slate-300">
                          {action.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {assigneeName(action)} ·{" "}
                          {action.status === "COMPLETED" && action.completedAt
                            ? `Terminé le ${formatMoment(action.completedAt)}`
                            : action.canceledAt
                              ? `Annulé le ${formatMoment(action.canceledAt)}`
                              : null}
                        </p>
                        {action.status === "CANCELED" &&
                          action.cancellationReason && (
                            <p className="mt-1 text-xs text-slate-500">
                              Motif : {action.cancellationReason}
                            </p>
                          )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {footer}
    </section>
  );
}

function assigneeName(action: ProspectActionListItem) {
  return `${action.assignedToUser.firstName} ${action.assignedToUser.lastName}`;
}

function formatMoment(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
