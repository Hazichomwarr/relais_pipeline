import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialNav from "@/component/commercial/CommercialNav";
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
      <div className="min-h-screen bg-[#f5f7fb]">
        <CommercialNav firstName={user.firstName} lastName={user.lastName} />
        <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    );
  }

  return <AdminShell activeItem="notes">{children}</AdminShell>;
}
