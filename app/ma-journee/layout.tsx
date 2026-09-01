import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import {
  AuthorizationError,
  requireWorkdayEligibility,
} from "@/src/services/authorization.service";

/**
 * Ticket 27F §1 — /ma-journee is shared by MANAGER, COMMERCIAL, ASSISTANT
 * (WORKDAY_ELIGIBLE_ROLES, 27C) and gated exactly like every other
 * self-service route in this codebase: authorize first, then pick a
 * shell purely for navigation (never a second authorization check).
 * ADMIN has no personal Workday (27A §4) and is denied here — the only
 * role this gate can ever reject, so a fixed "/admin" redirect target is
 * accurate, not a guess (resolveDashboardRedirect's own ADMIN behavior).
 * No permanent nav entry is added yet (27H's job) — direct navigation
 * must still be properly authorized, which this layout does regardless
 * of whether any link points here.
 */
export default async function MaJourneeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;

  try {
    user = await requireWorkdayEligibility();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  if (user.role === "COMMERCIAL") {
    return (
      <CommercialShell firstName={user.firstName} lastName={user.lastName}>
        {children}
      </CommercialShell>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
