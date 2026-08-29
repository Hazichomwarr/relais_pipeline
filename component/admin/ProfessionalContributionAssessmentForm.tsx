"use client";

import type { UserRole } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createProfessionalContributionAssessmentAction } from "@/src/actions/professional-contribution.actions";
import {
  createProfessionalContributionAssessmentSchema,
  type CreateProfessionalContributionAssessmentFormInput,
  type ValidatedCreateProfessionalContributionAssessmentInput,
} from "@/src/lib/validations/professional-contribution.schema";

type EligibleEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

type ProfessionalContributionAssessmentFormProps = {
  employees: EligibleEmployee[];
  /** Ticket 25K.1 §7 — optional deep-link prefill from /admin/performance; falls back to the usual blank employee / last-closed-month defaults when absent. */
  initialEmployeeId?: string;
  initialYear?: number;
  initialMonth?: number;
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

/** Defaults to last month — the most recent period that's guaranteed already closed. */
function lastClosedMonthDefaults(): { year: number; month: number } {
  const now = new Date();
  const lastMonthIndex = now.getUTCMonth() - 1;
  return {
    year: now.getUTCFullYear() + (lastMonthIndex < 0 ? -1 : 0),
    month: ((lastMonthIndex + 12) % 12) + 1,
  };
}

export default function ProfessionalContributionAssessmentForm({
  employees,
  initialEmployeeId,
  initialYear,
  initialMonth,
}: ProfessionalContributionAssessmentFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const defaults = lastClosedMonthDefaults();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<
    CreateProfessionalContributionAssessmentFormInput,
    unknown,
    ValidatedCreateProfessionalContributionAssessmentInput
  >({
    resolver: zodResolver(createProfessionalContributionAssessmentSchema),
    defaultValues: {
      employeeId: initialEmployeeId ?? "",
      year: initialYear ?? defaults.year,
      month: initialMonth ?? defaults.month,
    },
  });

  async function onSubmit(
    values: ValidatedCreateProfessionalContributionAssessmentInput,
  ) {
    setFeedback(null);

    const result = await createProfessionalContributionAssessmentAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];
          if (message) {
            setError(
              field as keyof CreateProfessionalContributionAssessmentFormInput,
              { type: "server", message },
            );
          }
        }
      }
      setFeedback({ type: "error", message: result.message });
      return;
    }

    reset({ employeeId: "", year: defaults.year, month: defaults.month });
    setFeedback({ type: "success", message: "L’évaluation a été créée." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Employé
          </label>
          <select className={inputClassName} {...register("employeeId")}>
            <option value="">Sélectionnez un employé</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName} (
                {employee.role === "COMMERCIAL"
                  ? "Commercial"
                  : employee.role === "MANAGER"
                    ? "Manager"
                    : employee.role}
                )
              </option>
            ))}
          </select>
          {errors.employeeId ? (
            <p className="mt-1 text-xs text-red-600">
              {errors.employeeId.message}
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
        {isSubmitting ? "Création…" : "Créer l’évaluation"}
      </button>
    </form>
  );
}
