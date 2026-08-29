"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  assessProfessionalContributionItemAction,
  submitProfessionalContributionAssessmentAction,
} from "@/src/actions/professional-contribution.actions";

type Anchor = { level: 1 | 2 | 3 | 4 | 5; text: string };

type AssessmentItem = {
  id: string;
  labelAtEvaluation: string;
  descriptionAtEvaluation: string;
  maxPoints: number;
  anchorsSnapshot: readonly Anchor[];
  selectedLevel: number | null;
  awardedPoints: number | null;
  observation: string | null;
};

type ProfessionalContributionAssessmentDetailProps = {
  assessmentId: string;
  status: "DRAFT" | "SUBMITTED";
  score: number | null;
  maxScore: number;
  employeeName: string;
  items: AssessmentItem[];
};

const EXTREME_LEVELS = new Set([1, 5]);

/**
 * Ticket 25J §45/§46 — anchors, not raw points, shown to the evaluator
 * (points are internal, never displayed prominently beside a choice, per
 * §45). Bias guidance is short, not a lecture (§47).
 */
export default function ProfessionalContributionAssessmentDetail({
  assessmentId,
  status,
  score,
  maxScore,
  employeeName,
  items,
}: ProfessionalContributionAssessmentDetailProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const locked = status === "SUBMITTED";
  const allAssessed = items.every((item) => item.selectedLevel !== null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const result = await submitProfessionalContributionAssessmentAction({
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
            Contribution professionnelle
          </p>
          <p className="mt-2 text-3xl font-bold">
            {score} / {maxScore}
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
          Évaluez l’ensemble de la période, pas seulement les événements
          récents. Basez-vous sur des comportements observables et évitez
          de laisser une réussite ou une difficulté isolée influencer
          toutes les dimensions.
        </p>
      )}

      {items.map((item) => (
        <ProfessionalContributionItemCard
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

function ProfessionalContributionItemCard({
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
  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    item.selectedLevel,
  );
  const [observation, setObservation] = useState(item.observation ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresObservation =
    selectedLevel !== null && EXTREME_LEVELS.has(selectedLevel);

  async function handleSelect(level: number) {
    if (locked) return;
    setSelectedLevel(level);
    setError(null);

    if (EXTREME_LEVELS.has(level) && observation.trim().length === 0) {
      // Wait for the evaluator to type an observation before saving.
      return;
    }

    await save(level, observation);
  }

  async function save(level: number, obs: string) {
    setSaving(true);
    const result = await assessProfessionalContributionItemAction({
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
      <p className="mt-1 text-xs text-slate-400">
        Choisissez la description qui correspond le mieux aux comportements
        observés pendant la période.
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
