import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PersonalNoteCategoryBadge from "@/component/personal-notes/PersonalNoteCategoryBadge";
import PersonalNoteDeleteButton from "@/component/personal-notes/PersonalNoteDeleteButton";
import { formatPersonalNoteDate } from "@/component/personal-notes/PersonalNoteCardContent";
import PersonalNoteForm from "@/component/personal-notes/PersonalNoteForm";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";
import { getMyPersonalNoteById } from "@/src/services/personal-note.service";

type PersonalNoteDetailPageProps = {
  params: Promise<{ noteId: string }>;
};

export default async function PersonalNoteDetailPage({
  params,
}: PersonalNoteDetailPageProps) {
  const { noteId } = await params;
  let user;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login");
    }
    throw error;
  }

  const note = await getMyPersonalNoteById(user.id, noteId);

  if (!note) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/notes"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à mes notes
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <PersonalNoteCategoryBadge category={note.category} />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
        {note.title}
      </h1>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Créée le {formatPersonalNoteDate(note.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          Modifiée le {formatPersonalNoteDate(note.updatedAt)}
        </span>
      </div>

      <section className="mt-7 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <PersonalNoteForm
          mode="edit"
          noteId={note.id}
          defaultValues={{
            category: note.category,
            title: note.title,
            content: note.content ?? "",
            pinned: note.pinned,
          }}
        />
      </section>

      <div className="mt-6 flex justify-end">
        <PersonalNoteDeleteButton
          noteId={note.id}
          noteTitle={note.title}
          variant="detail"
          redirectTo="/notes"
        />
      </div>
    </div>
  );
}
