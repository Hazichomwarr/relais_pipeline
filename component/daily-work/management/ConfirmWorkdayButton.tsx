"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { confirmWorkdayStartAction } from "@/src/actions/workday.actions";
import { formatBusinessIsoDate } from "@/src/lib/financial-report-period";

type ConfirmWorkdayButtonProps = {
  employeeUserId: string;
  workDate: Date;
};

/**
 * Ticket 27G §26 — routine operational confirmation, no dialog ceremony.
 * Calls the real 27C action with the explicit subject (employeeUserId +
 * workDate) — the action independently re-resolves and re-authorizes the
 * real subject/Workday server-side; this button's mere presence (already
 * gated by the read composition's canConfirmStart hint) is never treated
 * as authority by the server.
 */
export default function ConfirmWorkdayButton({
  employeeUserId,
  workDate,
}: ConfirmWorkdayButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleConfirm() {
    setIsPending(true);
    setError(undefined);

    const result = await confirmWorkdayStartAction({
      employeeUserId,
      workDate: formatBusinessIsoDate(workDate),
    });

    setIsPending(false);

    if (!result.success) {
      setError(result.message);
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-5 text-sm font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Confirmation..." : "Confirmer le début"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
