import type { LedgerEntryStatus } from "@prisma/client";
import { Ban } from "lucide-react";

/**
 * POSTED is the default lifecycle state and stays visually silent (no
 * badge) so the history isn't cluttered — only REVERSED needs a visible
 * marker, since a reversed original must remain in the list rather than
 * disappear (Ticket 17A audit trail).
 */
export default function LedgerEntryStatusBadge({
  status,
}: {
  status: LedgerEntryStatus;
}) {
  if (status !== "REVERSED") {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
      Annulée
    </span>
  );
}
