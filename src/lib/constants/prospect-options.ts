export const productOptions = [
  {
    value: "KARMDA",
    label: "KARMDA — Gestion scolaire",
  },
  {
    value: "LOKARI",
    label: "LOKARI — Gestion immobilière",
  },
  {
    value: "NIA",
    label: "NIA — Épargne et tontines",
  },
  {
    value: "DIGITAL_SERVICES",
    label: "Services digitaux",
  },
] as const;

export const interestOptions = [
  {
    value: "NOT_INTERESTED",
    label: "❌ Pas intéressé",
  },
  {
    value: "MAYBE",
    label: "🤔 Peut-être",
  },
  {
    value: "NEEDS_INFORMATION",
    label: "👀 Veut plus d’informations",
  },
  {
    value: "INTERESTED",
    label: "🔥 Intéressé",
  },
  {
    value: "READY_TO_DISCUSS",
    label: "✅ Prêt à discuter",
  },
] as const;

export const onlinePresenceOptions = [
  {
    value: "NONE",
    label: "Aucune présence en ligne",
  },
  {
    value: "WHATSAPP",
    label: "WhatsApp Business",
  },
  {
    value: "SOCIAL_MEDIA",
    label: "Réseaux sociaux",
  },
  {
    value: "WEBSITE",
    label: "Site internet",
  },
  {
    value: "MULTIPLE",
    label: "Plusieurs plateformes",
  },
] as const;

export const followUpActionOptions = [
  {
    value: "CALL_BACK",
    label: "Rappeler",
  },
  {
    value: "VISIT_AGAIN",
    label: "Repasser sur place",
  },
  {
    value: "SEND_DEMO",
    label: "Envoyer une démonstration",
  },
  {
    value: "SCHEDULE_MEETING",
    label: "Organiser une rencontre",
  },
  {
    value: "NO_ACTION",
    label: "Aucune action",
  },
] as const;
