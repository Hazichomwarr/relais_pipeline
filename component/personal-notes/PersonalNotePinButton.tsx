"use client";

import type { PersonalNoteCategory } from "@prisma/client";
import { Pin, PinOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updatePersonalNoteAction } from "@/src/actions/personal-note.actions";

type PersonalNotePinButtonProps = {
  noteId: string;
  category: PersonalNoteCategory;
  title: string;
  content: string | null;
  pinned: boolean;
};

/**
 * Sends the note's full current values with only `pinned` flipped — the
 * update action reuses the same owner-scoped service as the edit form, and
 * the current schema validates a complete note rather than a partial patch.
 */
export default function PersonalNotePinButton({
  noteId,
  category,
  title,
  content,
  pinned,
}: PersonalNotePinButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  async function togglePinned() {
    setIsPending(true);
    setError(undefined);

    const result = await updatePersonalNoteAction({
      noteId,
      category,
      title,
      content: content ?? undefined,
      pinned: !pinned,
    });

    setIsPending(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={togglePinned}
        disabled={isPending}
        aria-pressed={pinned}
        aria-label={pinned ? "Désépingler la note" : "Épingler la note"}
        title={pinned ? "Désépingler la note" : "Épingler la note"}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pinned ? (
          <PinOff className="h-4 w-4" />
        ) : (
          <Pin className="h-4 w-4" />
        )}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-[10rem] text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
