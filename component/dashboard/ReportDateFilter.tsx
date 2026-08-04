"use client";

import { Calendar, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { buildAdminUrl } from "@/src/lib/admin-search-params";

export default function ReportDateFilter() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const inputRef = useRef<HTMLInputElement>(null);

  const selectedDate = searchParams.get("date") || "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    router.push(buildAdminUrl(searchParams.toString(), "date", value));
  };

  const openPicker = () => {
    inputRef.current?.showPicker();
  };

  return (
    <button
      type="button"
      onClick={openPicker}
      className="flex h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-lg font-medium shadow-sm cursor-pointer sm:w-auto"
    >
      <Calendar className="h-5 w-5 shrink-0 text-slate-500" />

      <span className="min-w-0 flex-1 truncate text-left text-slate-600">
        {selectedDate || "Choisir une date"}
      </span>

      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />

      <input
        ref={inputRef}
        type="date"
        value={selectedDate}
        onChange={handleChange}
        className="absolute opacity-0 pointer-events-none"
      />
    </button>
  );
}
