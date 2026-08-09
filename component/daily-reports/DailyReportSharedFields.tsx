import type { FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";

export const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";
export const textAreaClassName =
  "w-full min-h-32 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export function FormField({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-slate-400">(optionnel)</span>
        )}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

type DailyReportSharedContentFields = {
  accomplishedToday?: string;
  plannedTomorrow?: string;
};

/**
 * "Réalisé aujourd'hui" / "Prévu demain" — required at submission for every
 * template (Ticket 19A), rendered identically by both the Assistant and
 * Operations Coordinator forms instead of duplicating this markup twice.
 */
export default function DailyReportSharedFields<
  TFieldValues extends FieldValues & DailyReportSharedContentFields,
>({
  register,
  errors,
}: {
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
}) {
  return (
    <>
      <FormField
        label="Réalisé aujourd’hui *"
        error={errors.accomplishedToday?.message as string | undefined}
      >
        <textarea
          rows={5}
          placeholder="Ce que vous avez accompli aujourd’hui..."
          className={textAreaClassName}
          {...register("accomplishedToday" as Path<TFieldValues>)}
        />
      </FormField>

      <FormField
        label="Prévu demain *"
        error={errors.plannedTomorrow?.message as string | undefined}
      >
        <textarea
          rows={4}
          placeholder="Ce que vous prévoyez de faire demain..."
          className={textAreaClassName}
          {...register("plannedTomorrow" as Path<TFieldValues>)}
        />
      </FormField>
    </>
  );
}
