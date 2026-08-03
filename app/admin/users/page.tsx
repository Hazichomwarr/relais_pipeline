import Sidebar from "@/component/dashboard/Sidebar";
import UserManagement from "@/component/users/user-management";
import { listUsers } from "@/src/services/user.service";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <section className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="flex">
        <Sidebar activeItem="users" />
        <main className="min-w-0 flex-1 px-5 py-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <header className="mb-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Équipe RELAIS
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#0f2557] md:text-5xl">
                Utilisateurs
              </h1>
              <p className="mt-3 max-w-2xl text-slate-500">
                Gérez les membres de l’équipe sans supprimer leur présence
                historique dans le CRM.
              </p>
            </header>

            <UserManagement users={users} />
          </div>
        </main>
      </div>
    </section>
  );
}
