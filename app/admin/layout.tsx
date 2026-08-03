import { redirect } from "next/navigation";

import {
  AuthorizationError,
  requireRole,
} from "@/src/services/authorization.service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("ADMIN", "MANAGER");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
    }
    throw error;
  }

  return <>{children}</>;
}
