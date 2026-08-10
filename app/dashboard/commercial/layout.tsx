import { redirect } from "next/navigation";

import CommercialShell from "@/component/commercial/CommercialShell";
import {
  AuthorizationError,
  requireCommercial,
} from "@/src/services/authorization.service";

export default async function CommercialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;

  try {
    user = await requireCommercial();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/dashboard");
    }
    throw error;
  }

  return (
    <CommercialShell firstName={user.firstName} lastName={user.lastName}>
      {children}
    </CommercialShell>
  );
}
