"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  createProspectActivityAction,
  type CreateProspectActivityActionResult,
} from "@/src/actions/prospect-activity.actions";
import { prospectActivityTypeOptions } from "@/src/lib/constants/prospect-activity-options";
import {
  prospectActivitySchema,
  type ProspectActivityFormInput,
  type ValidatedProspectActivityInput,
} from "@/src/lib/validations/prospect-activity.schema";

type ProspectActivityFormProps = {
  prospectId: string;
  /** Defaults to the admin action; the commercial detail page passes its own ownership-scoped action. */
  action?: (values: unknown) => Promise<CreateProspectActivityActionResult>;
};

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";
const textAreaClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function ProspectActivityForm({
  prospectId,
  action = createProspectActivityAction,
}: ProspectActivityFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<
    ProspectActivityFormInput,
    unknown,
    ValidatedProspectActivityInput
  >({
    resolver: zodResolver(prospectActivitySchema),
    defaultValues: getDefaultValues(prospectId),
  });

  async function onSubmit(values: ValidatedProspectActivityInput) {
    setFeedback(null);

    const result = await action(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];

          if (message) {
            setError(field as keyof ProspectActivityFormInput, {
              type: "server",
              message,
            });
          }
        }
      }

      setFeedback({ type: "error", message: result.message });
      return;
    }

    reset(getDefaultValues(prospectId));
    setFeedback({
      type: "success",
      message: "L’interaction a été ajoutée à l’historique.",
    });
    router.refresh();
  }

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Plus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0f2557]">
            Ajouter une note d’interaction
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Appel, message, visite ou échange à conserver dans l’historique.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <input type="hidden" {...register("prospectId")} />

        <FormField
          label="Type d’interaction"
          error={errors.type?.message}
        >
          <select className={inputClassName} {...register("type")}>
            <option value="">Sélectionnez un type</option>
            {prospectActivityTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Résumé" error={errors.summary?.message}>
          <input
            type="text"
            maxLength={200}
            placeholder="Ex. Le directeur souhaite planifier une démonstration"
            className={inputClassName}
            {...register("summary")}
          />
        </FormField>

        <FormField
          label="Détails optionnels"
          error={errors.details?.message}
        >
          <textarea
            rows={5}
            maxLength={2000}
            placeholder="Contexte, objections, documents demandés, participants..."
            className={textAreaClassName}
            {...register("details")}
          />
        </FormField>

        <FormField
          label="Date et heure de l’interaction"
          error={errors.occurredAt?.message}
        >
          <input
            type="datetime-local"
            className={inputClassName}
            {...register("occurredAt")}
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
          <Plus className="h-4 w-4" />
          {isSubmitting ? "Enregistrement..." : "Ajouter à l’historique"}
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

function getDefaultValues(prospectId: string): ProspectActivityFormInput {
  return {
    prospectId,
    type: "",
    summary: "",
    details: "",
    occurredAt: formatDateTimeLocal(new Date()),
  };
}

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
