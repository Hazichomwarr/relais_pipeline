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
  /** Ticket 25K.2 §9/§22 — the original evaluator, shown on both the in-progress and submitted views. */
  evaluatorName: string;
  /** Ticket 25K.2 §28/§29 — true only when this actor is the assessment's own evaluatorUserId and it's still DRAFT; mirrors 25J's own evaluator-exclusive mutation rule. */
  canEdit: boolean;
  items: AssessmentItem[];
};

const EXTREME_LEVELS = new Set([1, 5]);

type ItemState = { level: number | null; observation: string };

function initialItemState(items: AssessmentItem[]): Record<string, ItemState> {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      { level: item.selectedLevel, observation: item.observation ?? "" },
    ]),
  );
}

/**
 * Ticket 25K.2 — item state now lives here, not inside each item card, so
 * "Enregistrer le brouillon" can save every item's current selection in
 * one pass (including a level picked but not yet auto-saved because its
 * required observation hasn't been typed yet). Per-item auto-save on
 * selection/blur is unchanged; anchors, not raw points, are still all
 * that's ever shown to the evaluator.
 */
export default function ProfessionalContributionAssessmentDetail({
  assessmentId,
  status,
  score,
  maxScore,
  employeeName,
  evaluatorName,
  canEdit,
  items,
}: ProfessionalContributionAssessmentDetailProps) {
  const router = useRouter();
  const [itemState, setItemState] = useState<Record<string, ItemState>>(() =>
    initialItemState(items),
  );
  const [savingItemIds, setSavingItemIds] = useState<Record<string, boolean>>(
    {},
  );
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const locked = status === "SUBMITTED";
  const readOnly = locked || !canEdit;
  const allAssessed = items.every(
    (item) => itemState[item.id]?.level !== null,
  );

  async function saveItem(
    itemId: string,
    level: number,
    observation: string,
  ): Promise<boolean> {
    setSavingItemIds((prev) => ({ ...prev, [itemId]: true }));
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    const result = await assessProfessionalContributionItemAction({
      assessmentId,
      itemId,
      level,
      observation,
    });

    setSavingItemIds((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    if (!result.success) {
      setItemErrors((prev) => ({ ...prev, [itemId]: result.message }));
      return false;
    }
    return true;
  }

  function handleLevelChange(itemId: string, level: number) {
    if (readOnly) return;
    setDraftSaved(false);
    const observation = itemState[itemId]?.observation ?? "";
    setItemState((prev) => ({ ...prev, [itemId]: { level, observation } }));

    if (EXTREME_LEVELS.has(level) && observation.trim().length === 0) {
      // Wait for the evaluator to type the required observation.
      return;
    }
    void saveItem(itemId, level, observation);
  }

  function handleObservationChange(itemId: string, observation: string) {
    if (readOnly) return;
    setDraftSaved(false);
    setItemState((prev) => ({
      ...prev,
      [itemId]: { level: prev[itemId]?.level ?? null, observation },
    }));
  }

  function handleObservationBlur(itemId: string) {
    if (readOnly) return;
    const state = itemState[itemId];
    if (state?.level && state.observation.trim().length > 0) {
      void saveItem(itemId, state.level, state.observation);
    }
  }

  async function handleSaveDraft() {
    setDraftError(null);
    setDraftSaved(false);
    setSavingDraft(true);

    const selected = items.filter(
      (item) => itemState[item.id]?.level !== null,
    );
    const results = await Promise.all(
      selected.map((item) => {
        const state = itemState[item.id];
        return saveItem(item.id, state.level as number, state.observation);
      }),
    );

    setSavingDraft(false);

    if (results.every(Boolean)) {
      setDraftSaved(true);
    } else {
      setDraftError(
        "Certains éléments n’ont pas pu être enregistrés. Vérifiez les messages ci-dessous.",
      );
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);

    const result = await submitProfessionalContributionAssessmentAction({
      assessmentId,
    });

    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.message);
      return;
    }

    setJustSubmitted(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {locked ? (
        <div className="rounded-2xl bg-[#0f2557] p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">
            Contribution professionnelle
          </p>
          <p className="mt-2 text-3xl font-bold">
            {score} / {maxScore}
          </p>
          <p className="mt-2 text-sm text-blue-200">
            Évaluée par {evaluatorName}
          </p>
          {justSubmitted ? (
            <p className="mt-1 text-sm font-medium text-white">
              Évaluation soumise.
            </p>
          ) : null}
        </div>
      ) : !canEdit ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          Cette évaluation est en cours de rédaction par {evaluatorName}.
        </p>
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
          item={item}
          state={itemState[item.id]}
          readOnly={readOnly}
          saving={Boolean(savingItemIds[item.id])}
          error={itemErrors[item.id]}
          onLevelChange={(level) => handleLevelChange(item.id, level)}
          onObservationChange={(value) =>
            handleObservationChange(item.id, value)
          }
          onObservationBlur={() => handleObservationBlur(item.id)}
        />
      ))}

      {!readOnly ? (
        <div className="space-y-2">
          {draftError ? (
            <p className="text-sm text-red-600">{draftError}</p>
          ) : null}
          {submitError ? (
            <p className="text-sm text-red-600">{submitError}</p>
          ) : null}
          {draftSaved ? (
            <p className="text-sm font-medium text-emerald-600">
              Brouillon enregistré.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || submitting}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              {savingDraft ? "Enregistrement…" : "Enregistrer le brouillon"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || savingDraft || !allAssessed}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 text-sm font-semibold text-white transition hover:bg-[#0f2557]/90 disabled:opacity-40"
            >
              {submitting
                ? "Soumission…"
                : `Soumettre l’évaluation de ${employeeName}`}
            </button>
          </div>
        </div>
      ) : locked ? (
        <p className="text-xs text-slate-400">
          Cette évaluation a été soumise et est désormais verrouillée.
        </p>
      ) : null}
    </div>
  );
}

function ProfessionalContributionItemCard({
  item,
  state,
  readOnly,
  saving,
  error,
  onLevelChange,
  onObservationChange,
  onObservationBlur,
}: {
  item: AssessmentItem;
  state: ItemState;
  readOnly: boolean;
  saving: boolean;
  error?: string;
  onLevelChange: (level: number) => void;
  onObservationChange: (value: string) => void;
  onObservationBlur: () => void;
}) {
  const selectedLevel = state?.level ?? null;
  const observation = state?.observation ?? "";
  const requiresObservation =
    selectedLevel !== null && EXTREME_LEVELS.has(selectedLevel);

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
        {item.anchorsSnapshot.map((anchor) => {
          const inputId = `${item.id}-${anchor.level}`;
          return (
            <label
              key={anchor.level}
              htmlFor={inputId}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition ${
                selectedLevel === anchor.level
                  ? "border-[#0f2557] bg-blue-50"
                  : "border-slate-200"
              } ${readOnly ? "opacity-70" : "cursor-pointer hover:border-[#0f2557]/50"}`}
            >
              <input
                id={inputId}
                type="radio"
                name={`level-${item.id}`}
                className="mt-1"
                disabled={readOnly}
                checked={selectedLevel === anchor.level}
                onChange={() => onLevelChange(anchor.level)}
              />
              <span className="text-slate-700">{anchor.text}</span>
            </label>
          );
        })}
      </div>

      {requiresObservation || (readOnly && observation) ? (
        <div className="mt-3">
          <label
            htmlFor={`observation-${item.id}`}
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Observation{requiresObservation ? " (requise pour ce niveau)" : ""}
          </label>
          <textarea
            id={`observation-${item.id}`}
            className="w-full min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
            value={observation}
            disabled={readOnly}
            onChange={(event) => onObservationChange(event.target.value)}
            onBlur={onObservationBlur}
          />
        </div>
      ) : null}

      {saving ? (
        <p className="mt-2 text-xs text-slate-400">Enregistrement…</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
