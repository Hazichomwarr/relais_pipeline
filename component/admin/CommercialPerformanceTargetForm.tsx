"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createCommercialPerformanceTargetAction } from "@/src/actions/commercial-performance-target.actions";
import {
  createCommercialPerformanceTargetSchema,
  type CreateCommercialPerformanceTargetFormInput,
  type ValidatedCreateCommercialPerformanceTargetInput,
} from "@/src/lib/validations/commercial-performance-target.schema";

type EligibleEmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type CommercialPerformanceTargetFormProps = {
  /** Ticket 25P §34: COMMERCIAL and MANAGER employees — no longer Commercial-only. */
  eligibleEmployees: EligibleEmployeeOption[];
};

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function nextMonthDefaults(): { year: number; month: number } {
  const now = new Date();
  const nextMonthIndex = now.getUTCMonth() + 1;
  return {
    year: now.getUTCFullYear() + Math.floor(nextMonthIndex / 12),
    month: (nextMonthIndex % 12) + 1,
  };
}

/**
 * Ticket 25H.2A §40 — the small creation surface: select an eligible
 * employee, select an upcoming month, enter the target wins. Defaults to
 * next month, since this month (and every past one) is already locked by
 * the time this form can be used (§17/§18: no retroactive creation).
 * Ticket 25P §34: the employee list is COMMERCIAL + MANAGER, not
 * Commercial-only — server-filtered by the caller, never by this form.
 */
export default function CommercialPerformanceTargetForm({
  eligibleEmployees,
}: CommercialPerformanceTargetFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const defaults = nextMonthDefaults();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<
    CreateCommercialPerformanceTargetFormInput,
    unknown,
    ValidatedCreateCommercialPerformanceTargetInput
  >({
    resolver: zodResolver(createCommercialPerformanceTargetSchema),
    defaultValues: {
      userId: "",
      year: defaults.year,
      month: defaults.month,
      targetWins: undefined,
    },
  });

  async function onSubmit(
    values: ValidatedCreateCommercialPerformanceTargetInput,
  ) {
    setFeedback(null);

    const result = await createCommercialPerformanceTargetAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];
          if (message) {
            setError(
              field as keyof CreateCommercialPerformanceTargetFormInput,
              { type: "server", message },
            );
          }
        }
      }
      setFeedback({ type: "error", message: result.message });
      return;
    }

    reset({
      userId: "",
      year: defaults.year,
      month: defaults.month,
      targetWins: undefined,
    });
    setFeedback({ type: "success", message: "L’objectif a été créé." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Commercial ou manager
          </label>
          <select className={inputClassName} {...register("userId")}>
            <option value="">Sélectionnez un employé</option>
            {eligibleEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName}
              </option>
            ))}
          </select>
          {errors.userId ? (
            <p className="mt-1 text-xs text-red-600">
              {errors.userId.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Objectif de résultats (prospects gagnés)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClassName}
            {...register("targetWins")}
          />
          {errors.targetWins ? (
            <p className="mt-1 text-xs text-red-600">
              {errors.targetWins.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Mois
          </label>
          <select className={inputClassName} {...register("month")}>
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          {errors.month ? (
            <p className="mt-1 text-xs text-red-600">{errors.month.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Année
          </label>
          <input
            type="number"
            step={1}
            className={inputClassName}
            {...register("year")}
          />
          {errors.year ? (
            <p className="mt-1 text-xs text-red-600">{errors.year.message}</p>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <p
          className={
            feedback.type === "success"
              ? "text-sm font-medium text-emerald-600"
              : "text-sm font-medium text-red-600"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 text-sm font-semibold text-white transition hover:bg-[#0f2557]/90 disabled:opacity-60"
      >
        {isSubmitting ? "Création…" : "Créer l’objectif"}
      </button>
    </form>
  );
}
