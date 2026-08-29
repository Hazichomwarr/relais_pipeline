"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteProfessionalContributionAssessmentAction } from "@/src/actions/professional-contribution.actions";

export type ProfessionalContributionAssessmentListRow = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: "DRAFT" | "SUBMITTED";
  score: number | null;
  maxScore: number;
  roleAtEvaluation: "COMMERCIAL" | "MANAGER" | "ADMIN";
  employee: { firstName: string; lastName: string };
  evaluator: { firstName: string; lastName: string };
};

type ProfessionalContributionAssessmentListProps = {
  assessments: ProfessionalContributionAssessmentListRow[];
};

const MONTH_LABELS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function formatPeriod(periodStart: Date): string {
  const start = new Date(periodStart);
  return `${MONTH_LABELS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}

export default function ProfessionalContributionAssessmentList({
  assessments,
}: ProfessionalContributionAssessmentListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(assessmentId: string) {
    setError(null);
    setPendingId(assessmentId);

    const result = await deleteProfessionalContributionAssessmentAction({
      assessmentId,
    });

    setPendingId(null);

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  if (assessments.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucune évaluation de contribution professionnelle n’a encore été
        créée.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Employé</th>
              <th className="py-2 pr-4">Période</th>
              <th className="py-2 pr-4">Statut</th>
              <th className="py-2 pr-4">Score</th>
              <th className="py-2 pr-4">Évaluateur</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {assessments.map((assessment) => (
              <tr key={assessment.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-700">
                  <Link
                    href={`/admin/performance-assessments/professional-contribution/${assessment.id}`}
                    className="hover:underline"
                  >
                    {assessment.employee.firstName}{" "}
                    {assessment.employee.lastName}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-slate-600">
                  {formatPeriod(assessment.periodStart)}
                </td>
                <td className="py-2 pr-4">
                  {assessment.status === "SUBMITTED" ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      Soumise
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      Brouillon
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-slate-600">
                  {assessment.status === "SUBMITTED"
                    ? `${assessment.score} / ${assessment.maxScore}`
                    : "—"}
                </td>
                <td className="py-2 pr-4 text-slate-500">
                  {assessment.evaluator.firstName}{" "}
                  {assessment.evaluator.lastName}
                </td>
                <td className="py-2 pr-4">
                  {assessment.status === "DRAFT" ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(assessment.id)}
                      disabled={pendingId === assessment.id}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                    >
                      {pendingId === assessment.id
                        ? "Suppression…"
                        : "Supprimer"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
