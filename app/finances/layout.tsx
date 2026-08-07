import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import {
  AuthorizationError,
  requireRole,
} from "@/src/services/authorization.service";

/**
 * Finance data is ADMIN + MANAGER only (Ticket 17B). This check runs
 * before any ledger data is fetched by nested pages, so a COMMERCIAL
 * user is redirected to their own dashboard without ever seeing partial
 * financial data. Since only three roles exist today, an ACCESS_DENIED
 * here can only mean COMMERCIAL.
 */
export default async function FinancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("ADMIN", "MANAGER");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(
        error.code === "UNAUTHENTICATED" ? "/login" : "/dashboard/commercial",
      );
    }
    throw error;
  }

  return <AdminShell activeItem="finances">{children}</AdminShell>;
}
