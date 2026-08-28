import type { UserRole } from "@prisma/client";

/**
 * Ticket 25I — the frozen V1 responsibility catalog. A versioned code
 * constant, not DB rows (§10 of the ticket: "do not build a dynamic
 * responsibility-builder UI... static versioned code definitions may be
 * safer for V1"). Every field here is snapshotted verbatim onto a
 * RoleResponsibilityAssessmentItem at assessment-creation time — a
 * future edit to this file never rewrites a historical assessment,
 * exactly like 25G's BARS-snapshot requirement and 25H.1's
 * creditedUserRoleAtEvent precedent.
 *
 * AUDIT VERDICT (see notes/ticket-25i-role-responsibility-assessments.md
 * for the full reasoning, including rejected candidates):
 *
 * - COMMERCIAL: SUPPORTED — exactly one responsibility survives the
 *   audit. Every other candidate (pipeline status accuracy, "coverage
 *   completeness" / does every prospect have an open action, structured
 *   follow-up use, Daily Report compliance) either double-counts
 *   Execution Discipline/Results, or fails the same historical-
 *   denominator problem that blocked 25H.2's conversion rate: Prospect
 *   has no ownership-history model, so "who owned which prospects during
 *   a past period" cannot be reconstructed, which rules out any
 *   machine-evidenced item built on current Prospect state. The one
 *   survivor is necessarily human-assessed.
 * - MANAGER: SUPPORTED, but thin — exactly one responsibility, tied to
 *   a real CRM-surfaced concept (DailyReportAttentionItem: decisions
 *   needed / problems reported), even though *resolution* of those
 *   items isn't itself tracked (confirmed absent — no resolvedBy/
 *   resolvedAt anywhere on DailyReport). The assessment is therefore
 *   MANAGER_ASSESSED (an ADMIN's judgment, informed by the attention-
 *   item surface as reference material), not machine-derived.
 * - ADMIN: UNSUPPORTED. No non-permission-based responsibility survives
 *   audit (having /finances or /admin/users access is not evidence of
 *   good performance — §41), and no valid internal evaluator exists for
 *   an ADMIN in this single-tier role model (§20). Left unsupported
 *   rather than inventing either.
 *
 * Every survivor got the FULL 20 points for its role — not because
 * "one item = /20" was assumed going in, but because the audit found
 * exactly one defensible responsibility per supported role. Fewer
 * items at higher individual weight is the honest outcome when fewer
 * responsibilities survive scrutiny than there are points to spread —
 * the same principle 25H.2's Outcome C applied to Results.
 */
export const ROLE_RESPONSIBILITY_POLICY_VERSION = "ROLE_RESPONSIBILITY_V1";
export const ROLE_RESPONSIBILITY_MAX_SCORE = 20;

export const roleResponsibilityAssessmentLevels = [
  "NOT_MET",
  "PARTIALLY_MET",
  "MET",
  "EXCEEDED",
] as const;

export type RoleResponsibilityAssessmentLevelValue =
  (typeof roleResponsibilityAssessmentLevels)[number];

/**
 * Ticket 25I §35 — the lowest and highest level require an observation;
 * the two middle levels don't. Mirrors the bias-control philosophy
 * planned for 25J's BARS extreme-rating requirement (and 25G §15's
 * "1 → required, 2-4 → optional" policy, adapted to a 4-level scale).
 */
export function isExtremeRoleResponsibilityLevel(
  level: RoleResponsibilityAssessmentLevelValue,
): boolean {
  return level === "NOT_MET" || level === "EXCEEDED";
}

export type RoleResponsibilityAnchor = {
  level: RoleResponsibilityAssessmentLevelValue;
  text: string;
  points: number;
};

export type RoleResponsibilityEvidenceType =
  | "MANAGER_ASSESSED"
  | "MACHINE_EVIDENCED";

export type RoleResponsibilityDefinition = {
  key: string;
  role: UserRole;
  label: string;
  description: string;
  maxPoints: number;
  evidenceType: RoleResponsibilityEvidenceType;
  /** Exactly one anchor per level in roleResponsibilityAssessmentLevels order, points strictly ascending, last === maxPoints. */
  anchors: readonly RoleResponsibilityAnchor[];
};

export const ROLE_RESPONSIBILITY_CATALOG: readonly RoleResponsibilityDefinition[] =
  [
    {
      key: "COMMERCIAL_PORTFOLIO_STEWARDSHIP",
      role: "COMMERCIAL",
      label: "Tenue du portefeuille de prospects",
      description:
        "Le commercial maintient les informations de ses prospects assignés complètes, exactes et à jour, indépendamment des résultats commerciaux obtenus.",
      maxPoints: 20,
      evidenceType: "MANAGER_ASSESSED",
      anchors: [
        {
          level: "NOT_MET",
          points: 0,
          text: "Les informations requises (qualification, coordonnées, statut) sont fréquemment manquantes ou obsolètes sur le portefeuille assigné.",
        },
        {
          level: "PARTIALLY_MET",
          points: 10,
          text: "Le portefeuille est tenu de façon inégale : certains prospects sont à jour, d'autres présentent des lacunes récurrentes.",
        },
        {
          level: "MET",
          points: 17,
          text: "Les informations des prospects assignés sont globalement complètes, exactes et tenues à jour.",
        },
        {
          level: "EXCEEDED",
          points: 20,
          text: "Le portefeuille est systématiquement complet et activement tenu à jour, y compris le signalement spontané d'informations obsolètes ou incohérentes.",
        },
      ],
    },
    {
      key: "MANAGER_DAILY_REPORT_OVERSIGHT",
      role: "MANAGER",
      label: "Suivi des rapports quotidiens et des signalements",
      description:
        "Le manager examine et traite les décisions requises et les problèmes signalés dans les rapports quotidiens de l'équipe pendant la période.",
      maxPoints: 20,
      evidenceType: "MANAGER_ASSESSED",
      anchors: [
        {
          level: "NOT_MET",
          points: 0,
          text: "Les décisions requises ou les problèmes signalés dans les rapports quotidiens sont restés sans suivi ou sans accusé de réception pendant la période.",
        },
        {
          level: "PARTIALLY_MET",
          points: 10,
          text: "Certains signalements ont été traités, mais le suivi a été inégal ou tardif.",
        },
        {
          level: "MET",
          points: 17,
          text: "Les décisions requises et les problèmes signalés ont été examinés et traités de manière fiable pendant la période.",
        },
        {
          level: "EXCEEDED",
          points: 20,
          text: "Les signalements ont été traités rapidement et de façon proactive, avec un suivi clair et sans problème récurrent non résolu.",
        },
      ],
    },
  ];

export function getRoleResponsibilityCatalogForRole(
  role: UserRole,
): readonly RoleResponsibilityDefinition[] {
  return ROLE_RESPONSIBILITY_CATALOG.filter((item) => item.role === role);
}

export function isRoleSupportedForRoleResponsibilityAssessment(
  role: UserRole,
): boolean {
  return getRoleResponsibilityCatalogForRole(role).length > 0;
}

export function findRoleResponsibilityDefinition(
  key: string,
): RoleResponsibilityDefinition | undefined {
  return ROLE_RESPONSIBILITY_CATALOG.find((item) => item.key === key);
}
