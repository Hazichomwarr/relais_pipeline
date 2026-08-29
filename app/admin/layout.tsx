import { redirect } from "next/navigation";

import {
  AuthorizationError,
  requireDashboardAccess,
} from "@/src/services/authorization.service";

/**
 * Ticket 25R §5-7: this is the coarse /admin *shell* gate, not proof of
 * ADMIN authority — widened from ADMIN/MANAGER-only to
 * requireDashboardAccess() (ADMIN, MANAGER, ASSISTANT) so ASSISTANT can
 * reach the dashboard overview at /admin. This does NOT authorize every
 * route nested under /admin/*: each still carries (or, for the two gaps
 * 25R closed — /admin/follow-ups and /admin/performance-targets — now
 * carries) its own independent, narrower authorization call. See
 * DASHBOARD_ACCESS_ROLES's own comment in authorization.service-core.ts
 * for the full audited list.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireDashboardAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
    }
    throw error;
  }

  return <>{children}</>;
}
