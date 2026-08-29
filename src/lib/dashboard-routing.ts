import type { UserRole } from "@prisma/client";

/**
 * Ticket 25M §19/§20 — ASSISTANT got an explicit branch instead of the
 * previous binary "COMMERCIAL or /admin" fallback, since /admin is gated
 * to ADMIN/MANAGER only (app/admin/layout.tsx) and would otherwise
 * reject them and bounce to the public homepage. 25M's landing was
 * /profile, deliberately transitional pending real Assistant capability.
 *
 * Ticket 25N — Assistant now has a real operational workspace (Finance),
 * so the landing route changes to /finances, removing the 25M
 * transitional behavior on purpose. /profile remains fully reachable via
 * its own nav item; this only changes the *default* post-login
 * destination.
 */
export function resolveDashboardRedirect(
  role: UserRole,
): "/admin" | "/dashboard/commercial" | "/finances" {
  if (role === "COMMERCIAL") {
    return "/dashboard/commercial";
  }
  if (role === "ASSISTANT") {
    return "/finances";
  }
  return "/admin";
}
