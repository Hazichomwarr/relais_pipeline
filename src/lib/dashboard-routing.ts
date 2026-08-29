import type { UserRole } from "@prisma/client";

/**
 * Ticket 25M §19/§20 — ASSISTANT got an explicit branch instead of the
 * previous binary "COMMERCIAL or /admin" fallback, since /admin was
 * gated to ADMIN/MANAGER only (app/admin/layout.tsx) and would otherwise
 * reject them and bounce to the public homepage. 25M's landing was
 * /profile, deliberately transitional pending real Assistant capability.
 *
 * Ticket 25N — Assistant gained a real operational workspace (Finance),
 * so the landing route changed to /finances, removing the 25M
 * transitional behavior on purpose.
 *
 * Ticket 25R §16/§17 — Assistant now has real dashboard-shell access too
 * (requireDashboardAccess, app/admin/layout.tsx), with its own
 * deliberately minimal content (app/admin/page.tsx). The landing route
 * changes again, to /admin — matching ADMIN/MANAGER's existing default —
 * removing the 25N transitional special case. /finances remains fully
 * reachable via its own nav item; this only changes the *default*
 * post-login destination. No user-record or session mutation: an
 * existing Assistant session simply starts landing on /admin the next
 * time this function runs (Ticket 25R §17/§44).
 */
export function resolveDashboardRedirect(
  role: UserRole,
): "/admin" | "/dashboard/commercial" {
  if (role === "COMMERCIAL") {
    return "/dashboard/commercial";
  }
  return "/admin";
}
