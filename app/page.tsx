import Link from "next/link";

import { auth } from "@/auth";
import ProspectForm from "@/component/propects/prospect-form-input";

export default async function Home() {
  const session = await auth();
  const currentUser = session?.user
    ? {
        firstName: session.user.firstName,
        lastName: session.user.lastName,
      }
    : null;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h1 className="text-xl font-bold text-[#0f2557] sm:text-2xl">
              RELAIS CRM
            </h1>

            <p className="text-sm text-slate-500">Prospection commerciale</p>
          </div>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:px-5 sm:text-base"
            >
              Connexion
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:inline-flex sm:px-5 sm:text-base"
            >
              Dashboard
            </Link>

            <Link
              href="/admin"
              className="hidden rounded-xl bg-[#0f2557] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#14316f] sm:inline-flex sm:px-5 sm:text-base"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <ProspectForm currentUser={currentUser} />
      </section>
    </main>
  );
}
