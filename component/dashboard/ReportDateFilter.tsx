"use client";

import { Calendar, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

export default function ReportDateFilter() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const inputRef = useRef<HTMLInputElement>(null);

  const selectedDate = searchParams.get("date") || "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    router.push(`/admin?date=${value}`);
  };

  const openPicker = () => {
    inputRef.current?.showPicker();
  };

  return (
    <button
      type="button"
      onClick={openPicker}
      className="mx-2 flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-lg font-medium shadow-sm cursor-pointer"
    >
      <Calendar className="h-5 w-5 text-slate-500" />

      <span className="text-slate-600">
        {selectedDate || "Choisir une date"}
      </span>

      <ChevronDown className="h-5 w-5 text-slate-400" />

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
