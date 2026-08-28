"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  assessRoleResponsibilityItemAction,
  submitRoleResponsibilityAssessmentAction,
} from "@/src/actions/role-responsibility-assessment.actions";
import {
  isExtremeRoleResponsibilityLevel,
  type RoleResponsibilityAssessmentLevelValue,
} from "@/src/lib/role-responsibility-catalog";

type Anchor = {
  level: RoleResponsibilityAssessmentLevelValue;
  text: string;
  points: number;
};

type AssessmentItem = {
  id: string;
  labelAtEvaluation: string;
  descriptionAtEvaluation: string;
  maxPoints: number;
  anchorsSnapshot: readonly Anchor[];
  assessmentLevel: RoleResponsibilityAssessmentLevelValue | null;
  awardedPoints: number | null;
  observation: string | null;
};

type RoleResponsibilityAssessmentDetailProps = {
  assessmentId: string;
  status: "DRAFT" | "SUBMITTED";
  score: number | null;
  maxScore: number;
  employeeName: string;
  items: AssessmentItem[];
};

/**
 * Ticket 25I §59/§60/§61 — anchors, not raw numbers; save-per-item, not
 * one giant form; submission requires every item resolved (enforced
 * server-side by submitRoleResponsibilityAssessmentCore, mirrored here
 * only for immediate UI feedback, never as the actual authority).
 */
export default function RoleResponsibilityAssessmentDetail({
  assessmentId,
  status,
  score,
  maxScore,
  employeeName,
  items,
}: RoleResponsibilityAssessmentDetailProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const locked = status === "SUBMITTED";
  const allAssessed = items.every((item) => item.assessmentLevel !== null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const result = await submitRoleResponsibilityAssessmentAction({
      assessmentId,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      {status === "SUBMITTED" ? (
        <div className="rounded-2xl bg-[#0f2557] p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">
            Responsabilités de rôle
          </p>
          <p className="mt-2 text-3xl font-bold">
            {score} / {maxScore}
          </p>
        </div>
      ) : null}

      {items.map((item) => (
        <RoleResponsibilityItemCard
          key={item.id}
          assessmentId={assessmentId}
          item={item}
          locked={locked}
          onSaved={() => router.refresh()}
        />
      ))}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!locked ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !allAssessed}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 text-sm font-semibold text-white transition hover:bg-[#0f2557]/90 disabled:opacity-40"
        >
          {submitting ? "Soumission…" : `Soumettre l’évaluation de ${employeeName}`}
        </button>
      ) : (
        <p className="text-xs text-slate-400">
          Cette évaluation a été soumise et est désormais verrouillée.
        </p>
      )}
    </div>
  );
}

function RoleResponsibilityItemCard({
  assessmentId,
  item,
  locked,
  onSaved,
}: {
  assessmentId: string;
  item: AssessmentItem;
  locked: boolean;
  onSaved: () => void;
}) {
  const [selectedLevel, setSelectedLevel] = useState<
    RoleResponsibilityAssessmentLevelValue | null
  >(item.assessmentLevel);
  const [observation, setObservation] = useState(item.observation ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresObservation =
    selectedLevel !== null && isExtremeRoleResponsibilityLevel(selectedLevel);

  async function handleSelect(level: RoleResponsibilityAssessmentLevelValue) {
    if (locked) return;
    setSelectedLevel(level);
    setError(null);

    const extremeNow = isExtremeRoleResponsibilityLevel(level);
    if (extremeNow && observation.trim().length === 0) {
      // Wait for the evaluator to type an observation before saving.
      return;
    }

    await save(level, observation);
  }

  async function save(
    level: RoleResponsibilityAssessmentLevelValue,
    obs: string,
  ) {
    setSaving(true);
    const result = await assessRoleResponsibilityItemAction({
      assessmentId,
      itemId: item.id,
      level,
      observation: obs,
    });
    setSaving(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    onSaved();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-semibold text-[#0f2557]">
        {item.labelAtEvaluation}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {item.descriptionAtEvaluation}
      </p>

      <div className="mt-4 space-y-2">
        {item.anchorsSnapshot.map((anchor) => (
          <label
            key={anchor.level}
            className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition ${
              selectedLevel === anchor.level
                ? "border-[#0f2557] bg-blue-50"
                : "border-slate-200"
            } ${locked ? "opacity-70" : "cursor-pointer hover:border-[#0f2557]/50"}`}
          >
            <input
              type="radio"
              name={`level-${item.id}`}
              className="mt-1"
              disabled={locked}
              checked={selectedLevel === anchor.level}
              onChange={() => handleSelect(anchor.level)}
            />
            <span className="text-slate-700">{anchor.text}</span>
          </label>
        ))}
      </div>

      {requiresObservation ? (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Observation (requise pour ce niveau)
          </label>
          <textarea
            className="w-full min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
            value={observation}
            disabled={locked}
            onChange={(event) => setObservation(event.target.value)}
            onBlur={() => {
              if (selectedLevel && observation.trim().length > 0) {
                save(selectedLevel, observation);
              }
            }}
          />
        </div>
      ) : null}

      {saving ? <p className="mt-2 text-xs text-slate-400">Enregistrement…</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
