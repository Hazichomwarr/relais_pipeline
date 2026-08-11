import { redirect } from "next/navigation";

import {
  AuthorizationError,
  requireRole,
} from "@/src/services/authorization.service";

export default async function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("ADMIN", "MANAGER", "COMMERCIAL");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/");
    }
    throw error;
  }

  return <>{children}</>;
}
