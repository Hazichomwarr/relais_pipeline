export const personalNoteCategoryOptions = [
  {
    value: "URGENT_TODO",
    label: "À faire urgemment",
  },
  {
    value: "COMMERCIAL_DEBRIEF",
    label: "Préparer le débrief commercial",
  },
  {
    value: "RELAIS_IDEA",
    label: "Idées pour RELAIS",
  },
  {
    value: "SCHOOL_DOCUMENTS",
    label: "Documents à envoyer aux écoles",
  },
  {
    value: "OTHER",
    label: "Autres",
  },
] as const;

export type PersonalNoteCategoryValue =
  (typeof personalNoteCategoryOptions)[number]["value"];

export function getPersonalNoteCategoryLabel(
  category: PersonalNoteCategoryValue,
): string {
  return (
    personalNoteCategoryOptions.find((option) => option.value === category)
      ?.label ?? category
  );
}
