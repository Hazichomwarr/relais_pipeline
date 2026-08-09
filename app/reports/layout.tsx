import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialNav from "@/component/commercial/CommercialNav";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";

/**
 * Any authenticated user may open /reports (Ticket 19B) — behavior then
 * depends on User.dailyReportTemplateType, resolved page-by-page, never
 * here. This layout gates on authentication alone, exactly like
 * app/notes/layout.tsx, and picks a shell purely for navigation.
 */
export default async function ReportsLayout({
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

  return <AdminShell activeItem="reports">{children}</AdminShell>;
}
