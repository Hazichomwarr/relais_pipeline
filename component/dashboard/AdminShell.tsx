import AdminMobileHeader from "@/component/dashboard/AdminMobileHeader";
import Sidebar from "@/component/dashboard/Sidebar";
import Container from "@/component/layout/Container";
import { auth } from "@/auth";

type AdminShellProps = {
  activeItem?:
    | "dashboard"
    | "actions"
    | "analytics"
    | "myProspects"
    | "followUps"
    | "users"
    | "products"
    | "notes"
    | "finances"
    | "updates"
    | "reports"
    | "reportsManagement"
    | "profile";
  children: React.ReactNode;
};

/**
 * Rendered only inside /admin/**, which app/admin/layout.tsx already gates
 * to ADMIN/MANAGER — so reading the role here is purely for UI visibility
 * (hiding "Utilisateurs" from MANAGER), not a second authorization check.
 */
export default async function AdminShell({
  activeItem,
  children,
}: AdminShellProps) {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <div className="flex min-h-screen w-full bg-[#f5f7fb] text-slate-800">
      <Sidebar activeItem={activeItem} role={role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader role={role} />

        <main className="min-w-0 flex-1 py-6 sm:py-8 lg:py-8">
          <Container>{children}</Container>
        </main>
      </div>
    </div>
  );
}
