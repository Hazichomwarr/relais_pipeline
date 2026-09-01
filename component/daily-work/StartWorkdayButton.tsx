"use client";

import { CirclePlay } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { startMyWorkdayAction } from "@/src/actions/workday.actions";

/**
 * Ticket 27F §42 — calls the existing 27C action directly; no start
 * logic is duplicated on the client. On success, router.refresh() re-runs
 * the server component tree so the hero transitions to its active state
 * from the authoritative Workday row, never from client-guessed state.
 */
export default function StartWorkdayButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleStart() {
    setIsPending(true);
    setError(undefined);

    const result = await startMyWorkdayAction();

    if (!result.success) {
      setIsPending(false);
      setError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleStart}
        disabled={isPending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0f2557] px-8 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        <CirclePlay className="h-5 w-5" aria-hidden="true" />
        {isPending ? "Démarrage..." : "Commencer ma journée"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
