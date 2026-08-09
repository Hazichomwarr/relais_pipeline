"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import DailyReportSharedFields, {
  FormField,
  textAreaClassName,
} from "@/component/daily-reports/DailyReportSharedFields";
import {
  createDailyReportAction,
  submitDailyReportAction,
  updateDailyReportAction,
} from "@/src/actions/daily-report.actions";
import { formatDailyReportIsoDate } from "@/src/lib/daily-report-date";
import { assistantDailyReportDataSchema } from "@/src/lib/validations/assistant-daily-report.schema";
import { dailyReportContentSchema } from "@/src/lib/validations/daily-report.schema";

const assistantFormSchema = dailyReportContentSchema.merge(
  assistantDailyReportDataSchema,
);

type AssistantFormInput = z.input<typeof assistantFormSchema>;
type ValidatedAssistantFormInput = z.output<typeof assistantFormSchema>;

type AssistantDailyReportFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      reportId: string;
      defaultValues: ValidatedAssistantFormInput;
    };

/**
 * One shared form for save-as-draft and submit (Ticket 19B) — never two
 * separate forms. A brand-new report (mode "create") has no reportId yet;
 * the first successful save assigns one (activeReportId) and every
 * following save/submit from the same mounted form reuses it, so a
 * "submit" click that creates the draft and then fails its own
 * prospecting/required-field check never loses the just-saved content.
 */
export default function AssistantDailyReportForm(
  props: AssistantDailyReportFormProps,
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
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AssistantFormInput, unknown, ValidatedAssistantFormInput>({
    resolver: zodResolver(assistantFormSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            accomplishedToday: "",
            plannedTomorrow: "",
            documentsPrepared: "",
            clientsFollowed: "",
            pendingPaymentsOrSignatures: "",
            problemsEncountered: "",
            managementDecisionNeeded: "",
          },
  });

  function applyFieldErrors(fieldErrors?: Record<string, string[] | undefined>) {
    if (!fieldErrors) {
      return;
    }
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) {
        setError(field as keyof AssistantFormInput, { type: "server", message });
      }
    }
  }

  async function persistDraft(
    values: ValidatedAssistantFormInput,
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

  async function onSaveDraft(values: ValidatedAssistantFormInput) {
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

  async function onSubmitReport(values: ValidatedAssistantFormInput) {
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
      <DailyReportSharedFields<AssistantFormInput>
        register={register}
        errors={errors}
      />

      <FormField
        label="Documents préparés ou classés"
        error={errors.documentsPrepared?.message}
        optional
      >
        <textarea
          rows={3}
          className={textAreaClassName}
          {...register("documentsPrepared")}
        />
      </FormField>

      <FormField
        label="Clients / prospects suivis"
        error={errors.clientsFollowed?.message}
        optional
      >
        <textarea
          rows={3}
          className={textAreaClassName}
          {...register("clientsFollowed")}
        />
      </FormField>

      <FormField
        label="Paiements ou signatures en attente"
        error={errors.pendingPaymentsOrSignatures?.message}
        optional
      >
        <textarea
          rows={3}
          className={textAreaClassName}
          {...register("pendingPaymentsOrSignatures")}
        />
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
