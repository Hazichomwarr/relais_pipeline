import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import {
  AuthorizationError,
  requireFinanceAccess,
} from "@/src/services/authorization.service";

/**
 * Ticket 20G.1: Finance data was ADMIN-only (MANAGER lost the read access
 * it had under Ticket 17B's original ADMIN+MANAGER grant — a deliberate
 * authorization change, not a role redefinition). Ticket 25N: Finance is
 * now a dedicated capability, ADMIN + ASSISTANT — still MANAGER/
 * COMMERCIAL-denied, per the same 20G.1 reasoning, just no longer
 * expressed as literal ADMIN identity. This check runs before any ledger
 * data is fetched by nested pages. A denied authenticated user is sent
 * through /dashboard's existing role-aware router (MANAGER lands on
 * /admin, COMMERCIAL on /dashboard/commercial) rather than a hardcoded
 * guess at their home — same convention as
 * app/dashboard/commercial/layout.tsx's own ACCESS_DENIED redirect.
 */
export default async function FinancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireFinanceAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/dashboard");
    }
    throw error;
  }

  return <AdminShell activeItem="finances">{children}</AdminShell>;
}
