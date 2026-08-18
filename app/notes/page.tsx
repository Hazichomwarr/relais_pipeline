import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import PersonalNoteCard from "@/component/personal-notes/PersonalNoteCard";
import PersonalNotesEmptyState from "@/component/personal-notes/PersonalNotesEmptyState";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";
import { listMyPersonalNotes } from "@/src/services/personal-note.service";

export default async function NotesPage() {
  let user;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login");
    }
    throw error;
  }

  const notes = await listMyPersonalNotes(user.id);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
            Mes notes
          </h1>
          <p className="mt-2 max-w-xl text-base text-slate-500">
            Vos idées, rappels et tâches personnelles, accessibles uniquement
            par vous.
          </p>
        </div>

        <Link
          href="/notes/new"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f] sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Nouvelle note
        </Link>
      </div>

      {notes.length === 0 ? (
        <PersonalNotesEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <PersonalNoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
