import { Pin } from "lucide-react";

import PersonalNoteCategoryBadge from "@/component/personal-notes/PersonalNoteCategoryBadge";
import type { PersonalNoteCategory } from "@prisma/client";

export type PersonalNoteCardContentNote = {
  category: PersonalNoteCategory;
  title: string;
  content: string | null;
  pinned: boolean;
  updatedAt: Date;
};

export function formatPersonalNoteDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

/**
 * The read-only half of a note card — category, pinned indicator, title,
 * content preview, and updated date — kept free of "use client" action
 * buttons so it stays plain-render testable (see PersonalNoteCard, which
 * wraps this with the pin/delete controls that pull in Server Actions).
 */
export default function PersonalNoteCardContent({
  note,
}: {
  note: PersonalNoteCardContentNote;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <PersonalNoteCategoryBadge category={note.category} />
        {note.pinned && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
            Épinglée
          </span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-slate-900">
        {note.title}
      </h3>

      {note.content && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">
          {note.content}
        </p>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Modifiée le {formatPersonalNoteDate(note.updatedAt)}
      </p>
    </>
  );
}
