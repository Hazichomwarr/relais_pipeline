import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialNav from "@/component/commercial/CommercialNav";
import {
  AuthorizationError,
  requireSharedFeedAccess,
} from "@/src/services/authorization.service";

/**
 * À la une is shared CRM history for every operational role (Ticket 18B) —
 * requireSharedFeedAccess() is the same ADMIN/MANAGER/COMMERCIAL allow-list
 * Ticket 18A built as the feed's read boundary. The shell chosen below is
 * purely for navigation, never a second authorization check.
 */
export default async function UpdatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;

  try {
    user = await requireSharedFeedAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
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

  return <AdminShell activeItem="updates">{children}</AdminShell>;
}
