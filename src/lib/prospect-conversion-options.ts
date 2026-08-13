/**
 * Ticket 20D — centralized French labels for conversion outcome/reason,
 * so forms and (later, 20F/20G) analytics never hardcode their own copy.
 * The reason list was audited against real RELAIS ProspectActivity/
 * Prospect.notes text before being frozen — see the comment on
 * `enum ProspectConversionReason` in prisma/schema.prisma for what was
 * kept, merged, or dropped and why.
 */
export const conversionOutcomeOptions = [
  { value: "ADVANCED", label: "A avancé" },
  { value: "STALLED", label: "Bloqué" },
  { value: "WON", label: "Gagné" },
  { value: "LOST", label: "Perdu" },
] as const;

export const conversionReasonOptions = [
  { value: "PROMOTIONAL_OFFER", label: "Offre promotionnelle" },
  { value: "DEMO_CONVINCED", label: "Démonstration convaincante" },
  { value: "GOOD_PRODUCT_FIT", label: "Bonne adéquation produit" },
  { value: "URGENT_NEED", label: "Besoin urgent" },
  { value: "PRICE_ACCEPTABLE", label: "Prix acceptable" },
  { value: "DECISION_MAKER_APPROVAL", label: "Accord du décideur" },
  { value: "NO_BUDGET", label: "Pas de budget" },
  { value: "PRICE_TOO_HIGH", label: "Prix trop élevé" },
  { value: "DECISION_MAKER_UNAVAILABLE", label: "Décideur indisponible" },
  { value: "ALREADY_EQUIPPED", label: "Déjà équipé" },
  { value: "NO_RESPONSE", label: "Pas de réponse" },
  { value: "NEEDS_MORE_TIME", label: "A besoin de plus de temps" },
  { value: "BAD_FIT", label: "Ne correspond pas au besoin" },
  { value: "COMPETITOR", label: "Choix d’un concurrent" },
  { value: "OTHER", label: "Autre" },
] as const;

/**
 * Lookup helpers so 20G's analytics never re-declare their own copy of
 * these labels — the follow-up form and analytics must show identical
 * French wording for the same enum value.
 */
export function getConversionOutcomeLabel(
  value: (typeof conversionOutcomeOptions)[number]["value"],
): string {
  return conversionOutcomeOptions.find((option) => option.value === value)?.label ?? value;
}

export function getConversionReasonLabel(
  value: (typeof conversionReasonOptions)[number]["value"],
): string {
  return conversionReasonOptions.find((option) => option.value === value)?.label ?? value;
}
