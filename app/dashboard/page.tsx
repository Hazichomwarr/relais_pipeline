import { redirect } from "next/navigation";

import { resolveDashboardRedirect } from "@/src/lib/dashboard-routing";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";

export default async function DashboardEntryPage() {
  let user;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login");
    }
    throw error;
  }

  redirect(resolveDashboardRedirect(user.role));
}
