import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
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
      <CommercialShell firstName={user.firstName} lastName={user.lastName}>
        {children}
      </CommercialShell>
    );
  }

  return <AdminShell activeItem="updates">{children}</AdminShell>;
}
