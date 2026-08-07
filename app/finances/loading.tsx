export default function FinancesLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="h-9 w-40 rounded-xl bg-slate-200" />
          <div className="mt-3 h-5 w-80 max-w-full rounded bg-slate-200" />
        </div>
        <div className="flex gap-3">
          <div className="h-12 w-44 rounded-xl bg-slate-200" />
          <div className="h-12 w-44 rounded-xl bg-slate-200" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-3xl bg-white" />
        ))}
      </div>

      <div className="mt-8 h-8 w-64 rounded bg-slate-200" />
      <div className="mt-4 h-80 rounded-4xl bg-white" />
    </div>
  );
}
