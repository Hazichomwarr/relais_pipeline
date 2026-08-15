"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { submitProspectFollowUpAction } from "@/src/actions/prospect-follow-up.actions";
import {
  conversionOutcomeOptions,
  conversionReasonOptions,
} from "@/src/lib/prospect-conversion-options";
import {
  interestOptions,
  prospectStatusOptions,
} from "@/src/lib/constants/prospect-options";
import {
  prospectFollowUpWorkflowSchema,
  type ProspectFollowUpWorkflowFormInput,
  type ValidatedProspectFollowUpWorkflowInput,
} from "@/src/lib/validations/prospect-follow-up.schema";
import {
  conversionReasonRequiresNote,
  isConversionReasonAllowedForOutcome,
  listConversionReasonsForOutcome,
} from "@/src/services/prospect-conversion.service-core";
import { isTerminalProspectStatus } from "@/src/services/prospect-status.service-core";

type OpenActionOption = {
  id: string;
  title: string;
};

type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
};

type ProspectFollowUpMiniFormProps = {
  prospectId: string;
  initialValues: {
    status: ValidatedProspectFollowUpWorkflowInput["status"];
    interest: ValidatedProspectFollowUpWorkflowInput["interest"];
  };
  openActions: OpenActionOption[];
  assignableUsers: AssignableUser[];
  /** Ticket 22C — lets the on-demand composer wrapper close itself after a successful submission. Never called on failure. */
  onSuccess?: () => void;
};

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";
const textAreaClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function ProspectFollowUpMiniForm({
  prospectId,
  initialValues,
  openActions,
  assignableUsers,
  onSuccess,
}: ProspectFollowUpMiniFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<
    ProspectFollowUpWorkflowFormInput,
    unknown,
    ValidatedProspectFollowUpWorkflowInput
  >({
    resolver: zodResolver(prospectFollowUpWorkflowSchema),
    defaultValues: getDefaultValues(prospectId, initialValues),
  });

  const selectedStatus = useWatch({ control, name: "status" });
  const isActiveStatus = !isTerminalProspectStatus(
    selectedStatus as ValidatedProspectFollowUpWorkflowInput["status"],
  );

  const currentStatusLabel =
    prospectStatusOptions.find(
      (option) => option.value === initialValues.status,
    )?.label ?? initialValues.status;

  const selectedOutcome = useWatch({ control, name: "conversionOutcome" }) as
    | ValidatedProspectFollowUpWorkflowInput["conversionOutcome"]
    | undefined;
  const selectedReason = useWatch({ control, name: "conversionReason" }) as
    | ValidatedProspectFollowUpWorkflowInput["conversionReason"]
    | undefined;
  const compatibleReasons = selectedOutcome
    ? listConversionReasonsForOutcome(selectedOutcome)
    : [];
  const reasonOptionsForOutcome = conversionReasonOptions.filter((option) =>
    compatibleReasons.includes(option.value),
  );
  const reasonRequiresNote =
    selectedReason !== undefined && conversionReasonRequiresNote(selectedReason);

  // Ticket 20D — never submit a stale, now-incompatible reason after the
  // outcome changes (same pattern as Ticket 20C's terminal next-action
  // handling: the UI must not let hidden/stale values reach the server).
  useEffect(() => {
    if (
      selectedOutcome &&
      selectedReason &&
      !isConversionReasonAllowedForOutcome(selectedOutcome, selectedReason)
    ) {
      setValue("conversionReason", "");
    }
  }, [selectedOutcome, selectedReason, setValue]);

  // Ticket 20D — a WON/LOST outcome sets the matching status for
  // convenience; server validation remains authoritative regardless.
  useEffect(() => {
    if (selectedOutcome === "WON" || selectedOutcome === "LOST") {
      setValue("status", selectedOutcome);
    }
  }, [selectedOutcome, setValue]);

  async function onSubmit(values: ValidatedProspectFollowUpWorkflowInput) {
    setFeedback(null);

    const result = await submitProspectFollowUpAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];

          if (message) {
            setError(field as keyof ProspectFollowUpWorkflowFormInput, {
              type: "server",
              message,
            });
          }
        }
      }

      setFeedback({ type: "error", message: result.message });
      return;
    }

    reset(getDefaultValues(prospectId, initialValues));
    setFeedback({ type: "success", message: "Suivi enregistré avec succès." });
    router.refresh();
    onSuccess?.();
  }

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Save className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0f2557]">
            Ajouter un suivi
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Ce qui s’est passé, l’état actuel du prospect, et ce qui doit se
            passer ensuite.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <input type="hidden" {...register("prospectId")} />

        <FormField label="Que s’est-il passé ?" error={errors.note?.message}>
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="Ex. Le directeur souhaite une démonstration."
            className={textAreaClassName}
            {...register("note")}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Résultat commercial"
            error={errors.conversionOutcome?.message}
          >
            <select
              className={inputClassName}
              {...register("conversionOutcome")}
            >
              <option value="">Sélectionnez un résultat</option>
              {conversionOutcomeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Pourquoi ?"
            error={errors.conversionReason?.message}
          >
            <select
              className={inputClassName}
              disabled={!selectedOutcome}
              {...register("conversionReason")}
            >
              <option value="">
                {selectedOutcome
                  ? "Sélectionnez une raison"
                  : "Choisissez d’abord un résultat"}
              </option>
              {reasonOptionsForOutcome.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {reasonRequiresNote && (
          <FormField
            label="Autre raison"
            error={errors.conversionReasonNote?.message}
          >
            <input
              type="text"
              maxLength={500}
              placeholder="Ex. Le responsable quitte le pays pour trois mois."
              className={inputClassName}
              {...register("conversionReasonNote")}
            />
          </FormField>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Statut après ce suivi *"
            error={errors.status?.message}
          >
            <select className={inputClassName} {...register("status")}>
              <option value="">Sélectionner le statut…</option>
              {prospectStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Statut actuel : {currentStatusLabel}
            </p>
          </FormField>

          <FormField label="Intérêt" error={errors.interest?.message}>
            <select className={inputClassName} {...register("interest")}>
              {interestOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {openActions.length > 0 && (
          <FormField
            label="Action actuelle terminée"
            error={errors.completedActionId?.message}
          >
            <select
              className={inputClassName}
              {...register("completedActionId")}
            >
              <option value="">Aucune action à terminer</option>
              {openActions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.title}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {isActiveStatus ? (
          <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Prochaine action
            </p>

            <FormField
              label="Action"
              error={errors.nextActionTitle?.message}
            >
              <input
                type="text"
                maxLength={200}
                placeholder="Ex. Faire une démonstration"
                className={inputClassName}
                {...register("nextActionTitle")}
              />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label="À faire par"
                error={errors.nextActionAssignedToUserId?.message}
              >
                <select
                  className={inputClassName}
                  {...register("nextActionAssignedToUserId")}
                >
                  <option value="">Sélectionnez un responsable</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Échéance"
                error={errors.nextActionDueAt?.message}
              >
                <input
                  type="datetime-local"
                  className={inputClassName}
                  {...register("nextActionDueAt")}
                />
              </FormField>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Aucune prochaine action n’est requise pour une opportunité
            clôturée.
          </p>
        )}

        {feedback && (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-start gap-2">
              {feedback.type === "success" && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-4 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Enregistrement..." : "Enregistrer le suivi"}
        </button>
      </form>
    </section>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function getDefaultValues(
  prospectId: string,
  initialValues: {
    status: ValidatedProspectFollowUpWorkflowInput["status"];
    interest: ValidatedProspectFollowUpWorkflowInput["interest"];
  },
): ProspectFollowUpWorkflowFormInput {
  return {
    prospectId,
    note: "",
    // Ticket 22D — deliberately never preselected: the employee must
    // consciously choose the resulting status. initialValues.status is
    // shown separately as read-only context (see "Statut actuel" above).
    status: "",
    interest: initialValues.interest,
    conversionOutcome: "",
    conversionReason: "",
    conversionReasonNote: "",
    completedActionId: "",
    nextActionTitle: "",
    nextActionAssignedToUserId: "",
    nextActionDueAt: "",
  };
}
