import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";

/**
 * Every authenticated role manages only their own personal notes (Ticket
 * 16A), so this layout gates on authentication alone — no requireRole —
 * and picks a shell purely for navigation, never for note ownership.
 */
export default async function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login");
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

  return <AdminShell activeItem="notes">{children}</AdminShell>;
}
