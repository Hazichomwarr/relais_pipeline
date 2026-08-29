import type { UserRole } from "@prisma/client";

export const userRoleOptions = [
  { value: "ADMIN", label: "Administrateur" },
  { value: "ASSISTANT", label: "Assistant" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "MANAGER", label: "Manager" },
] as const;

/** Centralized French role label — reused by the shared feed (Ticket 18B)
 * instead of duplicating this lookup across components. */
export function getUserRoleLabel(role: UserRole): string {
  return userRoleOptions.find((option) => option.value === role)?.label ?? role;
}
