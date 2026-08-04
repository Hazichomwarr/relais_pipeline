"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { changeOwnPasswordAction } from "@/src/actions/commercial-profile.actions";
import {
  changeOwnPasswordSchema,
  type ChangeOwnPasswordInput,
  type ValidatedChangeOwnPasswordInput,
} from "@/src/lib/validations/auth.schema";

const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function ChangePasswordForm() {
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
  } = useForm<ChangeOwnPasswordInput, unknown, ValidatedChangeOwnPasswordInput>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ValidatedChangeOwnPasswordInput) {
    setFeedback(null);

    const result = await changeOwnPasswordAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];

          if (message) {
            setError(field as keyof ChangeOwnPasswordInput, {
              type: "server",
              message,
            });
          }
        }
      }

      setFeedback({ type: "error", message: result.message });
      return;
    }

    reset();
    setFeedback({ type: "success", message: result.message });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-bold text-[#0f2557]">Sécurité</h2>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-5"
      >
        <FormField
          label="Mot de passe actuel"
          error={errors.currentPassword?.message}
        >
          <input
            type="password"
            autoComplete="current-password"
            className={fieldClassName}
            {...register("currentPassword")}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Nouveau mot de passe"
            error={errors.newPassword?.message}
          >
            <input
              type="password"
              autoComplete="new-password"
              className={fieldClassName}
              {...register("newPassword")}
            />
          </FormField>

          <FormField
            label="Confirmer le mot de passe"
            error={errors.confirmPassword?.message}
          >
            <input
              type="password"
              autoComplete="new-password"
              className={fieldClassName}
              {...register("confirmPassword")}
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
          className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-4 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? "Enregistrement..." : "Changer le mot de passe"}
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
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  );
}
