"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  createProspectActionAction,
  type CreateProspectActionActionResult,
} from "@/src/actions/prospect-action.actions";
import {
  createProspectActionSchema,
  type ProspectActionFormInput,
  type ValidatedCreateProspectActionInput,
} from "@/src/lib/validations/prospect-action.schema";

type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
};

type ProspectActionFormProps = {
  prospectId: string;
  assignableUsers: AssignableUser[];
};

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";
const textAreaClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function ProspectActionForm({
  prospectId,
  assignableUsers,
}: ProspectActionFormProps) {
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
    ProspectActionFormInput,
    unknown,
    ValidatedCreateProspectActionInput
  >({
    resolver: zodResolver(createProspectActionSchema),
    defaultValues: getDefaultValues(prospectId),
  });

  async function onSubmit(values: ValidatedCreateProspectActionInput) {
    setFeedback(null);

    const result: CreateProspectActionActionResult =
      await createProspectActionAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];

          if (message) {
            setError(field as keyof ProspectActionFormInput, {
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
    setFeedback({ type: "success", message: "L’action a été créée." });
    router.refresh();
  }

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Plus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0f2557]">Nouvelle action</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Ce qui doit se passer ensuite, qui s’en charge, et pour quand.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <input type="hidden" {...register("prospectId")} />

        <FormField label="Titre" error={errors.title?.message}>
          <input
            type="text"
            maxLength={200}
            placeholder="Ex. Faire une démonstration KARMDA"
            className={inputClassName}
            {...register("title")}
          />
        </FormField>

        <FormField
          label="Description optionnelle"
          error={errors.description?.message}
        >
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="Instructions complémentaires"
            className={textAreaClassName}
            {...register("description")}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Responsable"
            error={errors.assignedToUserId?.message}
          >
            <select className={inputClassName} {...register("assignedToUserId")}>
              <option value="">Sélectionnez un responsable</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Échéance" error={errors.dueAt?.message}>
            <input
              type="datetime-local"
              className={inputClassName}
              {...register("dueAt")}
            />
          </FormField>
        </div>

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
          {isSubmitting ? "Création..." : "Créer l’action"}
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

function getDefaultValues(prospectId: string): ProspectActionFormInput {
  return {
    prospectId,
    assignedToUserId: "",
    title: "",
    description: "",
    dueAt: defaultDueAt(),
  };
}

function defaultDueAt() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return formatDateTimeLocal(date);
}

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
