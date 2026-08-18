import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import {
  AuthorizationError,
  requireProspectActionQueueAccess,
} from "@/src/services/authorization.service";

/**
 * /actions is company-wide for every current operational role (Ticket
 * 20E) — same authorize-then-pick-a-shell pattern as /updates (Ticket
 * 18B). The shell chosen below is purely for navigation, never a second
 * authorization check.
 */
export default async function ActionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;

  try {
    user = await requireProspectActionQueueAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
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

  return <AdminShell activeItem="actions">{children}</AdminShell>;
}
