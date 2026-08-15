"use client";

import type { UserRole } from "@prisma/client";
import { MessageSquarePlus, Plus, Save, X } from "lucide-react";
import { useState } from "react";

import type { CreateProspectActivityActionResult } from "@/src/actions/prospect-activity.actions";
import type { ProspectActionListItem } from "@/src/services/prospect-action.service";

import ProspectActionForm from "./prospect-action-form";
import ProspectActionList from "./prospect-action-list";
import ProspectActivityForm from "./prospect-activity-form";
import ProspectFollowUpMiniForm from "./prospect-follow-up-mini-form";

type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
};

type ProspectWorkflowSectionsProps = {
  prospectId: string;
  viewer: { id: string; role: UserRole };
  actions: ProspectActionListItem[];
  assignableUsers: AssignableUser[];
  followUpInitialValues: {
    status: "NEW" | "TO_FOLLOW_UP" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST";
    interest: "NOT_INTERESTED" | "MAYBE" | "NEEDS_INFORMATION" | "INTERESTED" | "READY_TO_DISCUSS";
  };
  /** Defaults to the admin activity action; the commercial detail page passes its own ownership-scoped action. */
  activityAction?: (values: unknown) => Promise<CreateProspectActivityActionResult>;
};

/** Ticket 22C — which of the three prospect-detail composers is expanded, never more than one at a time. Purely local UI state, not persisted. */
type OpenComposer = "ACTION" | "FOLLOW_UP" | "INTERACTION" | null;

const cancelButtonClassName =
  "h-8 shrink-0 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100";

const primaryCtaClassName =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-4 text-sm font-semibold text-white transition hover:bg-[#18366f] sm:w-auto";

const secondaryCtaClassName =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f2557] transition hover:bg-slate-50 sm:w-auto";

export default function ProspectWorkflowSections({
  prospectId,
  viewer,
  actions,
  assignableUsers,
  followUpInitialValues,
  activityAction,
}: ProspectWorkflowSectionsProps) {
  const [openComposer, setOpenComposer] = useState<OpenComposer>(null);

  function toggle(target: Exclude<OpenComposer, null>) {
    setOpenComposer((current) => (current === target ? null : target));
  }

  const openActions = actions
    .filter((action) => action.status === "OPEN")
    .map((action) => ({ id: action.id, title: action.title }));

  return (
    <div className="space-y-7">
      <ProspectActionList
        actions={actions}
        viewer={viewer}
        headerAction={
          <button
            type="button"
            onClick={() => toggle("ACTION")}
            aria-expanded={openComposer === "ACTION"}
            className={primaryCtaClassName}
          >
            {openComposer === "ACTION" ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Nouvelle action
          </button>
        }
        footer={
          openComposer === "ACTION" ? (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpenComposer(null)}
                  className={cancelButtonClassName}
                >
                  Annuler
                </button>
              </div>
              <ProspectActionForm
                prospectId={prospectId}
                assignableUsers={assignableUsers}
                onSuccess={() => setOpenComposer(null)}
              />
            </div>
          ) : null
        }
      />

      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#0f2557]">
            Activité commerciale
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Ce qui s’est passé sur ce dossier — un suivi structuré ou une
            note d’historique.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => toggle("FOLLOW_UP")}
            aria-expanded={openComposer === "FOLLOW_UP"}
            className={primaryCtaClassName}
          >
            {openComposer === "FOLLOW_UP" ? (
              <X className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Ajouter un suivi
          </button>
          <button
            type="button"
            onClick={() => toggle("INTERACTION")}
            aria-expanded={openComposer === "INTERACTION"}
            className={secondaryCtaClassName}
          >
            {openComposer === "INTERACTION" ? (
              <X className="h-4 w-4" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" />
            )}
            Ajouter une note d’interaction
          </button>
        </div>

        {openComposer === "FOLLOW_UP" && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenComposer(null)}
                className={cancelButtonClassName}
              >
                Annuler
              </button>
            </div>
            <ProspectFollowUpMiniForm
              prospectId={prospectId}
              initialValues={followUpInitialValues}
              openActions={openActions}
              assignableUsers={assignableUsers}
              onSuccess={() => setOpenComposer(null)}
            />
          </div>
        )}

        {openComposer === "INTERACTION" && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenComposer(null)}
                className={cancelButtonClassName}
              >
                Annuler
              </button>
            </div>
            <ProspectActivityForm
              prospectId={prospectId}
              action={activityAction}
              onSuccess={() => setOpenComposer(null)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
