import type { UserRole } from "@prisma/client";

/**
 * Ticket 25M §19/§20 — ASSISTANT gets an explicit branch, not the
 * previous binary "COMMERCIAL or /admin" fallback: /admin is gated to
 * ADMIN/MANAGER only (app/admin/layout.tsx), so an Assistant falling
 * through to it would be rejected there and bounced to the public
 * homepage. /profile is the smallest role-neutral authenticated surface
 * already available (Ticket 25F) — a deliberate transitional landing
 * until 25N grants Finance access and can redirect there instead.
 */
export function resolveDashboardRedirect(
  role: UserRole,
): "/admin" | "/dashboard/commercial" | "/profile" {
  if (role === "COMMERCIAL") {
    return "/dashboard/commercial";
  }
  if (role === "ASSISTANT") {
    return "/profile";
  }
  return "/admin";
}
