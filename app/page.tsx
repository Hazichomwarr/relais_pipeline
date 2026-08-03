import Link from "next/link";

import ProspectForm from "@/component/propects/prospect-form-input";
import { listAssignableUsers } from "@/src/services/user.service";

export default async function Home() {
  const assignableUsers = await listAssignableUsers();

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-[#0f2557]">RELAIS CRM</h1>

            <p className="text-sm text-slate-500">Prospection commerciale</p>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 px-5 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Login
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 px-5 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Dashboard
            </Link>

            <Link
              href="/admin"
              className="rounded-xl bg-[#0f2557] px-5 py-2 font-medium text-white transition hover:bg-[#14316f]"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <ProspectForm assignableUsers={assignableUsers} />
      </section>
    </main>
  );
}
