import { redirect } from "next/navigation";

import CommercialNav from "@/component/commercial/CommercialNav";
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
    <div className="min-h-screen bg-[#f5f7fb]">
      <CommercialNav firstName={user.firstName} lastName={user.lastName} />
      {children}
    </div>
  );
}
