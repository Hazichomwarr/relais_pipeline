/**
 * Derives display initials from a free-text display name (actor names in
 * the shared feed are free text — see ProspectActivity.agentName — not
 * separate first/last fields), so this works uniformly for both a
 * "Julbert Serme" actor string and a "{firstName} {lastName}" user display
 * name.
 */
export function getInitialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
