"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { updateOwnProfileAction } from "@/src/actions/commercial-profile.actions";
import {
  commercialProfileUpdateSchema,
  type CommercialProfileUpdateInput,
  type ValidatedCommercialProfileUpdateInput,
} from "@/src/lib/validations/user.schema";

type ProfileEditFormProps = {
  initialValues: {
    firstName: string;
    lastName: string;
    phone: string | null;
  };
};

const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function ProfileEditForm({
  initialValues,
}: ProfileEditFormProps) {
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
    CommercialProfileUpdateInput,
    unknown,
    ValidatedCommercialProfileUpdateInput
  >({
    resolver: zodResolver(commercialProfileUpdateSchema),
    defaultValues: {
      firstName: initialValues.firstName,
      lastName: initialValues.lastName,
      phone: initialValues.phone ?? "",
    },
  });

  async function onSubmit(values: ValidatedCommercialProfileUpdateInput) {
    setFeedback(null);

    const result = await updateOwnProfileAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];

          if (message) {
            setError(field as keyof CommercialProfileUpdateInput, {
              type: "server",
              message,
            });
          }
        }
      }

      setFeedback({ type: "error", message: result.message });
      return;
    }

    setFeedback({ type: "success", message: "Votre profil a été mis à jour." });
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">
        Modifier mes informations
      </h2>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Prénom" error={errors.firstName?.message}>
            <input className={fieldClassName} {...register("firstName")} />
          </FormField>

          <FormField label="Nom" error={errors.lastName?.message}>
            <input className={fieldClassName} {...register("lastName")} />
          </FormField>
        </div>

        <FormField label="Téléphone" error={errors.phone?.message}>
          <input
            type="tel"
            placeholder="Optionnel"
            className={fieldClassName}
            {...register("phone")}
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
          className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-4 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
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
