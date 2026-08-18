import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import UserManagement from "@/component/users/user-management";
import {
  AuthorizationError,
  requireAdmin,
} from "@/src/services/authorization.service";
import { listUsers } from "@/src/services/user.service";

export default async function UsersPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const users = await listUsers();

  return (
    <AdminShell activeItem="users">
      <div>
        <header className="mb-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Équipe RELAIS
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl md:text-5xl">
            Utilisateurs
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Gérez les membres de l’équipe sans supprimer leur présence
            historique dans le CRM.
          </p>
        </header>

        <UserManagement users={users} />
      </div>
    </AdminShell>
  );
}
