"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import DailyReportSharedFields, {
  FormField,
  fieldClassName,
  textAreaClassName,
} from "@/component/daily-reports/DailyReportSharedFields";
import {
  createDailyReportAction,
  submitDailyReportAction,
  updateDailyReportAction,
} from "@/src/actions/daily-report.actions";
import { formatDailyReportIsoDate } from "@/src/lib/daily-report-date";
import { dailyReportContentSchema } from "@/src/lib/validations/daily-report.schema";
import {
  DIGITAL_SERVICES_PROSPECTING_TARGET,
  KARMDA_SCHOOL_PROSPECTING_TARGET,
  operationsCoordinatorDailyReportDataSchema,
} from "@/src/lib/validations/operations-coordinator-daily-report.schema";

const operationsFormSchema = dailyReportContentSchema.merge(
  operationsCoordinatorDailyReportDataSchema,
);

type OperationsFormInput = z.input<typeof operationsFormSchema>;
type ValidatedOperationsFormInput = z.output<typeof operationsFormSchema>;

type OperationsCoordinatorDailyReportFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      reportId: string;
      defaultValues: ValidatedOperationsFormInput;
    };

/**
 * Mirrors AssistantDailyReportForm's save/submit/activeReportId flow (see
 * that file's comment) — the only differences are the prospecting-count
 * fields and the installation/training exception reveal.
 */
export default function OperationsCoordinatorDailyReportForm(
  props: OperationsCoordinatorDailyReportFormProps,
) {
  const router = useRouter();
  const [activeReportId, setActiveReportId] = useState<string | null>(
    props.mode === "edit" ? props.reportId : null,
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OperationsFormInput, unknown, ValidatedOperationsFormInput>({
    resolver: zodResolver(operationsFormSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            accomplishedToday: "",
            plannedTomorrow: "",
            digitalServicesProspects: undefined,
            karmdaSchoolProspects: undefined,
            prospectingException: false,
            prospectingExceptionReason: "",
            pendingItems: "",
            problemsEncountered: "",
            managementDecisionNeeded: "",
          },
  });

  const prospectingException = useWatch({ control, name: "prospectingException" });

  useEffect(() => {
    if (!prospectingException) {
      setValue("prospectingExceptionReason", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectingException]);

  function applyFieldErrors(fieldErrors?: Record<string, string[] | undefined>) {
    if (!fieldErrors) {
      return;
    }
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) {
        setError(field as keyof OperationsFormInput, { type: "server", message });
      }
    }
  }

  async function persistDraft(
    values: ValidatedOperationsFormInput,
  ): Promise<string | null> {
    const { accomplishedToday, plannedTomorrow, ...templateData } = values;

    const result = activeReportId
      ? await updateDailyReportAction({
          reportId: activeReportId,
          accomplishedToday,
          plannedTomorrow,
          templateData,
        })
      : await createDailyReportAction({
          reportDate: formatDailyReportIsoDate(new Date()),
          accomplishedToday,
          plannedTomorrow,
          templateData,
        });

    if (!result.success) {
      applyFieldErrors(result.fieldErrors);
      setFeedback({ type: "error", message: result.message });
      return null;
    }

    if (!activeReportId) {
      setActiveReportId(result.reportId);
    }

    return result.reportId;
  }

  async function onSaveDraft(values: ValidatedOperationsFormInput) {
    setFeedback(null);
    const wasNewlyCreated = activeReportId === null;
    const reportId = await persistDraft(values);

    if (!reportId) {
      return;
    }

    if (wasNewlyCreated) {
      router.push(`/reports/${reportId}?saved=1`);
      return;
    }

    setFeedback({ type: "success", message: "Brouillon enregistré." });
    router.refresh();
  }

  async function onSubmitReport(values: ValidatedOperationsFormInput) {
    setFeedback(null);
    const reportId = await persistDraft(values);

    if (!reportId) {
      return;
    }

    const result = await submitDailyReportAction({ reportId });

    if (!result.success) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    router.push(`/reports/${reportId}?submitted=1`);
  }

  return (
    <form
      id="rapport-du-jour-formulaire"
      onSubmit={handleSubmit(onSaveDraft)}
      noValidate
      className="space-y-5"
    >
      <DailyReportSharedFields<OperationsFormInput>
        register={register}
        errors={errors}
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="mb-4 text-sm font-semibold text-slate-700">Prospection</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={`Services Digitaux (objectif : ${DIGITAL_SERVICES_PROSPECTING_TARGET})`}
            error={errors.digitalServicesProspects?.message as string | undefined}
          >
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                className={fieldClassName}
                {...register("digitalServicesProspects")}
              />
              <span className="shrink-0 text-sm font-semibold text-slate-500">
                / {DIGITAL_SERVICES_PROSPECTING_TARGET}
              </span>
            </div>
          </FormField>

          <FormField
            label={`Écoles KARMDA (objectif : ${KARMDA_SCHOOL_PROSPECTING_TARGET})`}
            error={errors.karmdaSchoolProspects?.message as string | undefined}
          >
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                className={fieldClassName}
                {...register("karmdaSchoolProspects")}
              />
              <span className="shrink-0 text-sm font-semibold text-slate-500">
                / {KARMDA_SCHOOL_PROSPECTING_TARGET}
              </span>
            </div>
          </FormField>
        </div>

        <label className="mt-5 flex items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <span>
            <span className="block font-semibold text-slate-800">
              Journée occupée par une installation / formation
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Cochez si l’objectif de prospection n’a pas pu être atteint pour
              cette raison.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-[#0f2557]"
            {...register("prospectingException")}
          />
        </label>

        {Boolean(prospectingException) && (
          <div className="mt-4">
            <FormField
              label="Justification *"
              error={errors.prospectingExceptionReason?.message}
            >
              <textarea
                rows={3}
                placeholder="Ex : Formation KARMDA à l’École Horizon de 08h30 à 16h00."
                className={textAreaClassName}
                {...register("prospectingExceptionReason")}
              />
            </FormField>
          </div>
        )}
      </div>

      <FormField label="En attente" error={errors.pendingItems?.message} optional>
        <textarea rows={3} className={textAreaClassName} {...register("pendingItems")} />
      </FormField>

      <FormField
        label="Problèmes rencontrés"
        error={errors.problemsEncountered?.message}
        optional
      >
        <textarea
          rows={3}
          className={textAreaClassName}
          {...register("problemsEncountered")}
        />
      </FormField>

      <FormField
        label="Besoin de décision de la Direction"
        error={errors.managementDecisionNeeded?.message}
        optional
      >
        <textarea
          rows={3}
          className={textAreaClassName}
          {...register("managementDecisionNeeded")}
        />
      </FormField>

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

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Enregistrement..." : "Enregistrer le brouillon"}
        </button>
        <button
          type="button"
          onClick={handleSubmit(onSubmitReport)}
          disabled={isSubmitting}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-6 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? "Envoi..." : "Envoyer le rapport"}
        </button>
      </div>
    </form>
  );
}
