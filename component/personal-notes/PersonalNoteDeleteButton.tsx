"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { deletePersonalNoteAction } from "@/src/actions/personal-note.actions";

type PersonalNoteDeleteButtonProps = {
  noteId: string;
  noteTitle: string;
  /** "card" renders a compact icon-only trigger for note cards; "detail"
   * renders a full labeled button for the note page. */
  variant?: "card" | "detail";
  /** Where to go after a successful delete. Omit to stay on the current
   * page and let the Server Component list re-render (used on /notes). */
  redirectTo?: string;
};

export default function PersonalNoteDeleteButton({
  noteId,
  noteTitle,
  variant = "card",
  redirectTo,
}: PersonalNoteDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openDialog() {
    setError(undefined);
    setOpen(true);
  }

  async function confirmDelete() {
    setIsPending(true);
    setError(undefined);

    const result = await deletePersonalNoteAction({ noteId });

    if (!result.success) {
      setIsPending(false);
      setError(result.message);
      return;
    }

    setOpen(false);
    setIsPending(false);

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={openDialog}
          aria-label="Supprimer la note"
          title="Supprimer la note"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openDialog}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 px-5 font-semibold text-red-600 transition hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer la note
        </button>
      )}

      {open && (
        <div
          className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-note-dialog-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="delete-note-dialog-title"
              className="text-xl font-bold text-[#0f2557]"
            >
              Supprimer cette note ?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cette action est définitive. La note{" "}
              <span className="font-semibold text-slate-700">
                « {noteTitle} »
              </span>{" "}
              ne pourra pas être récupérée.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="h-12 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isPending}
                className="h-12 rounded-xl bg-red-600 px-5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
