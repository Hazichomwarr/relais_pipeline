import type { LedgerEntryCategory } from "@prisma/client";

import { getLedgerEntryCategoryLabel } from "@/src/lib/financial-ledger-options";

export default function LedgerEntryCategoryBadge({
  category,
}: {
  category: LedgerEntryCategory;
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
      {getLedgerEntryCategoryLabel(category)}
    </span>
  );
}
