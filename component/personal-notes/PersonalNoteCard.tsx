import Link from "next/link";

import PersonalNoteCardContent from "@/component/personal-notes/PersonalNoteCardContent";
import PersonalNoteDeleteButton from "@/component/personal-notes/PersonalNoteDeleteButton";
import PersonalNotePinButton from "@/component/personal-notes/PersonalNotePinButton";
import type { PersonalNoteListItem } from "@/src/services/personal-note.service";

export default function PersonalNoteCard({
  note,
}: {
  note: PersonalNoteListItem;
}) {
  return (
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5">
      <PersonalNoteCardContent note={note} />

      <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
        <Link
          href={`/notes/${note.id}`}
          className="flex h-9 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ouvrir
        </Link>
        <PersonalNotePinButton
          noteId={note.id}
          category={note.category}
          title={note.title}
          content={note.content}
          pinned={note.pinned}
        />
        <PersonalNoteDeleteButton noteId={note.id} noteTitle={note.title} />
      </div>
    </article>
  );
}
