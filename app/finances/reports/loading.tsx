export default function FinancialReportsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-5 w-40 rounded bg-slate-200" />

      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="h-9 w-64 rounded-xl bg-slate-200" />
          <div className="mt-3 h-5 w-80 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-12 w-40 rounded-xl bg-slate-200" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-9 w-28 rounded-xl bg-slate-200" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-3xl bg-white" />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-56 rounded-3xl bg-white" />
        ))}
      </div>
    </div>
  );
}
