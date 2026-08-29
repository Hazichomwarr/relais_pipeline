import type { UserRole } from "@prisma/client";

/**
 * Ticket 25J — the frozen V1 BARS (Behaviorally Anchored Rating Scale)
 * catalog for Professional Contribution. A versioned code constant, same
 * pattern as role-responsibility-catalog.ts: snapshotted verbatim onto
 * each ProfessionalContributionAssessmentItem at creation time, never
 * re-rendered from a live, possibly-since-edited catalog.
 *
 * AUDIT VERDICT (see notes/ticket-25j-professional-contribution-bars.md
 * for the full reasoning, including rejected traits):
 *
 * - Started from 25G's five candidates (Initiative, Reliability,
 *   Collaboration, Communication, Problem Solving).
 * - Collaboration and Communication collapsed into one trait
 *   ("Coordination & Communication") — at 10 total points, scoring both
 *   separately would double-count the same interactions (§14).
 * - Reliability was dropped. Narrowed to "untracked commitment
 *   follow-through" per §4, it's conceptually distinct from Execution
 *   Discipline — but it's also the trait most likely to actually get
 *   conflated with tracked task completion by a real evaluator filling
 *   out a form, which is exactly the double-counting risk this whole
 *   ticket series has fought hardest against. The ticket's own §4
 *   explicitly offers dropping it as the safe default when the
 *   distinction "still feels too fuzzy" — it does.
 * - Result: three traits (Initiative, Coordination & Communication,
 *   Problem Solving) — matching the ticket's own §5 suggested trio,
 *   arrived at independently through the overlap audit, not copied
 *   uncritically.
 *
 * Same shared catalog across both supported roles (COMMERCIAL, MANAGER)
 * — these traits describe cross-role professional behavior, unlike Role
 * Responsibilities' role-specific duties (§6). ADMIN remains unsupported
 * for the same reason 25I found: no valid internal evaluator exists in
 * this single-tier role model (§7).
 */
export const PROFESSIONAL_CONTRIBUTION_POLICY_VERSION =
  "PROFESSIONAL_CONTRIBUTION_V1";
export const PROFESSIONAL_CONTRIBUTION_MAX_SCORE = 10;

export const professionalContributionAnchorLevels = [1, 2, 3, 4, 5] as const;
export type ProfessionalContributionAnchorLevel =
  (typeof professionalContributionAnchorLevels)[number];

/**
 * Ticket 25J §20 — level 1 and level 5 require an observation; levels
 * 2-4 don't. Same shape as 25I's extreme-level rule
 * (isExtremeRoleResponsibilityLevel), generalized from "lowest/highest
 * of four" to "lowest/highest of five" — not imported from 25I's file,
 * since the level type itself is different (number vs named enum) and
 * this is a two-line predicate, not worth coupling the two catalogs for.
 */
export function isExtremeProfessionalContributionLevel(
  level: ProfessionalContributionAnchorLevel,
): boolean {
  return level === 1 || level === 5;
}

export type ProfessionalContributionAnchor = {
  level: ProfessionalContributionAnchorLevel;
  text: string;
};

export type ProfessionalContributionTraitDefinition = {
  key: string;
  label: string;
  description: string;
  maxPoints: number;
  /** Exactly 5 anchors, levels 1-5 in order. Points are NOT stored per anchor (unlike 25I) — see computeProfessionalContributionScore's own comment on why a proportional formula is used instead of a fixed per-level table. */
  anchors: readonly ProfessionalContributionAnchor[];
};

export const PROFESSIONAL_CONTRIBUTION_CATALOG: readonly ProfessionalContributionTraitDefinition[] =
  [
    {
      key: "INITIATIVE",
      label: "Initiative",
      description:
        "L'employé identifie et entreprend des actions utiles de sa propre initiative, dans les limites de son rôle.",
      maxPoints: 4,
      anchors: [
        {
          level: 1,
          text: "Attend généralement qu'on lui indique les prochaines étapes, même lorsque des actions utiles sont clairement identifiables.",
        },
        {
          level: 2,
          text: "Prend parfois des initiatives, mais dépend encore régulièrement des instructions pour les tâches habituelles.",
        },
        {
          level: 3,
          text: "Gère ses responsabilités habituelles de manière autonome et sollicite de l'aide lorsque la situation l'exige.",
        },
        {
          level: 4,
          text: "Identifie régulièrement des prochaines étapes utiles sans attendre qu'on le lui demande.",
        },
        {
          level: 5,
          text: "Anticipe régulièrement les besoins ou les problèmes pertinents et prend des initiatives appropriées dans les limites de son rôle, en sollicitant une validation lorsque l'autorité requise dépasse son rôle.",
        },
      ],
    },
    {
      key: "COORDINATION_COMMUNICATION",
      label: "Coordination et communication",
      description:
        "L'employé partage les informations pertinentes en temps utile et coordonne son travail avec les autres.",
      maxPoints: 3,
      anchors: [
        {
          level: 1,
          text: "Ne partage pas les informations pertinentes en temps utile ; les collègues doivent régulièrement relancer pour obtenir un point de situation.",
        },
        {
          level: 2,
          text: "Partage parfois les informations utiles, mais de façon irrégulière ou tardive.",
        },
        {
          level: 3,
          text: "Partage les informations pertinentes et coordonne son travail avec les autres de manière fiable.",
        },
        {
          level: 4,
          text: "Signale les blocages de façon proactive et tient les personnes concernées informées sans qu'on ait à le demander.",
        },
        {
          level: 5,
          text: "Coordonne systématiquement son travail avec les autres, anticipe les besoins d'information des collègues et facilite le travail collectif au-delà de ses propres tâches.",
        },
      ],
    },
    {
      key: "PROBLEM_SOLVING",
      label: "Résolution de problèmes",
      description:
        "Face à un obstacle, l'employé cherche activement une solution en utilisant les informations disponibles avant de solliciter de l'aide.",
      maxPoints: 3,
      anchors: [
        {
          level: 1,
          text: "Face à un obstacle, attend généralement qu'on lui indique la marche à suivre plutôt que de chercher une solution.",
        },
        {
          level: 2,
          text: "Tente parfois de résoudre les problèmes rencontrés, mais sollicite de l'aide plus tôt que nécessaire ou abandonne rapidement.",
        },
        {
          level: 3,
          text: "Identifie le problème concret, utilise les informations disponibles et tente des solutions raisonnables avant de solliciter de l'aide.",
        },
        {
          level: 4,
          text: "Résout la plupart des problèmes courants de façon autonome et sollicite de l'aide de manière ciblée et appropriée lorsque nécessaire.",
        },
        {
          level: 5,
          text: "Anticipe les problèmes potentiels, propose des solutions pratiques et aide les autres à résoudre des difficultés similaires.",
        },
      ],
    },
  ];

/** Same shared catalog for every supported role — unlike 25I, there is no per-role filtering. */
export function isRoleSupportedForProfessionalContribution(
  role: UserRole,
): boolean {
  return role === "COMMERCIAL" || role === "MANAGER";
}

export function findProfessionalContributionTrait(
  key: string,
): ProfessionalContributionTraitDefinition | undefined {
  return PROFESSIONAL_CONTRIBUTION_CATALOG.find((item) => item.key === key);
}
