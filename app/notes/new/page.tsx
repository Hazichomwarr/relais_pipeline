import { redirect } from "next/navigation";

import PersonalNoteForm from "@/component/personal-notes/PersonalNoteForm";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";

export default async function NewPersonalNotePage() {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
          Mes notes
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          Nouvelle note
        </h1>
        <p className="mt-3 text-slate-500">
          Cette note reste privée : vous seul pouvez la consulter et la
          modifier.
        </p>
      </header>

      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <PersonalNoteForm mode="create" />
      </section>
    </div>
  );
}
