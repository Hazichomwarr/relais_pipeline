import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialShell from "@/component/commercial/CommercialShell";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";

/**
 * Ticket 25F: /profile is reachable by every authenticated role — ADMIN,
 * MANAGER, COMMERCIAL — since changing your own password is an
 * authenticated-user capability, not a role-gated one (unlike /actions and
 * /updates, which use a fixed role allow-list). requireAuthenticatedUser()
 * carries no role restriction at all, so there is nothing to keep in sync
 * as roles are added later. Same authorize-then-pick-a-shell pattern as
 * those two routes; the shell chosen below is purely for navigation, never
 * a second authorization check.
 */
export default async function ProfileLayout({
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

  return <AdminShell activeItem="profile">{children}</AdminShell>;
}
