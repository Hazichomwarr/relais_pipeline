import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import {
  AuthorizationError,
  requireDailyWorkManagementAccess,
} from "@/src/services/authorization.service";

/**
 * Ticket 27G §2/§3 — ADMIN/MANAGER only (DAILY_WORK_MANAGEMENT_ROLES),
 * never a bare /admin layout inheritance — this route has its own named
 * capability so direct URL access is safe regardless of what the shared
 * /admin shell's own gate happens to allow. No permanent nav entry yet
 * (27H's job); this layout authorizes the route independently of whether
 * any link points here. COMMERCIAL/ASSISTANT never reach AdminShell
 * through this route at all, so no shell-selection branch is needed —
 * unlike /ma-journee, which is shared with COMMERCIAL.
 */
export default async function JourneesAgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireDailyWorkManagementAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  return <AdminShell>{children}</AdminShell>;
}
