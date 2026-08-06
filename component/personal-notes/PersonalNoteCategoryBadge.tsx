import {
  AlertTriangle,
  ClipboardList,
  FileText,
  Lightbulb,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

import { getPersonalNoteCategoryLabel } from "@/src/lib/personal-note-options";
import type { PersonalNoteCategory } from "@prisma/client";

/**
 * Icons are presentation-only, never persisted (Ticket 16A stores the
 * enum value alone) — this mapping is the single place a category value
 * turns into an icon + color pairing so cards never re-derive it.
 */
const categoryPresentation: Record<
  PersonalNoteCategory,
  { icon: LucideIcon; className: string }
> = {
  URGENT_TODO: { icon: AlertTriangle, className: "bg-red-100 text-red-800" },
  COMMERCIAL_DEBRIEF: {
    icon: ClipboardList,
    className: "bg-blue-100 text-blue-800",
  },
  RELAIS_IDEA: {
    icon: Lightbulb,
    className: "bg-amber-100 text-amber-800",
  },
  SCHOOL_DOCUMENTS: {
    icon: FileText,
    className: "bg-emerald-100 text-emerald-800",
  },
  OTHER: { icon: StickyNote, className: "bg-slate-100 text-slate-700" },
};

export default function PersonalNoteCategoryBadge({
  category,
}: {
  category: PersonalNoteCategory;
}) {
  const { icon: Icon, className } = categoryPresentation[category];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {getPersonalNoteCategoryLabel(category)}
    </span>
  );
}
