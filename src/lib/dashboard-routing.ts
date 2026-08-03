import type { UserRole } from "@prisma/client";

export function resolveDashboardRedirect(
  role: UserRole,
): "/admin" | "/dashboard/commercial" {
  return role === "COMMERCIAL" ? "/dashboard/commercial" : "/admin";
}
