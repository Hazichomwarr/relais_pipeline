"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  updateProspectFollowUpAction,
  type UpdateProspectFollowUpActionResult,
} from "@/src/actions/prospect.actions";
import {
  followUpActionOptions,
  interestOptions,
  prospectStatusOptions,
} from "@/src/lib/constants/prospect-options";
import {
  prospectFollowUpSchema,
  type ProspectFollowUpInput,
  type ValidatedProspectFollowUpInput,
} from "@/src/lib/validations/prospect.schema";

type ProspectFollowUpFormProps = {
  prospectId: string;
  initialValues: {
    interest: ValidatedProspectFollowUpInput["interest"];
    status: ValidatedProspectFollowUpInput["status"];
    nextAction: ValidatedProspectFollowUpInput["nextAction"];
    followUpDate: string;
  };
  /** Defaults to the admin action; the commercial detail page passes its own ownership-scoped action. */
  action?: (values: unknown) => Promise<UpdateProspectFollowUpActionResult>;
};

const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function ProspectFollowUpForm({
  prospectId,
  initialValues,
  action = updateProspectFollowUpAction,
}: ProspectFollowUpFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<
    ProspectFollowUpInput,
    unknown,
    ValidatedProspectFollowUpInput
  >({
    resolver: zodResolver(prospectFollowUpSchema),
    defaultValues: {
      prospectId,
      interest: initialValues.interest,
      status: initialValues.status,
      nextAction: initialValues.nextAction ?? "",
      followUpDate: initialValues.followUpDate,
    },
  });

  async function onSubmit(values: ValidatedProspectFollowUpInput) {
    setFeedback(null);

    const result = await action(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];

          if (message) {
            setError(field as keyof ProspectFollowUpInput, {
              type: "server",
              message,
            });
          }
        }
      }

      setFeedback({ type: "error", message: result.message });
      return;
    }

    setFeedback({ type: "success", message: result.message });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <input type="hidden" {...register("prospectId")} />

      <FormField label="Niveau d’intérêt" error={errors.interest?.message}>
        <select className={fieldClassName} {...register("interest")}>
          {interestOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Statut commercial" error={errors.status?.message}>
        <select className={fieldClassName} {...register("status")}>
          {prospectStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Prochaine action" error={errors.nextAction?.message}>
        <select className={fieldClassName} {...register("nextAction")}>
          <option value="">Aucune action planifiée</option>
          {followUpActionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Date de suivi" error={errors.followUpDate?.message}>
        <input
          type="date"
          className={fieldClassName}
          {...register("followUpDate")}
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-4 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {isSubmitting ? "Enregistrement..." : "Enregistrer le suivi"}
      </button>
    </form>
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
