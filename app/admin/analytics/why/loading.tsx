export default function WhyAnalyticsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-14 rounded-2xl bg-slate-100" />

      <div className="mb-8 space-y-3">
        <div className="h-9 w-96 max-w-full rounded-xl bg-slate-200" />
        <div className="h-5 w-80 max-w-full rounded-lg bg-slate-100" />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 rounded-2xl bg-slate-100" />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 rounded-3xl bg-slate-100" />
          ))}
        </div>

        <div className="h-64 rounded-3xl bg-slate-100" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-48 rounded-3xl bg-slate-100" />
          ))}
        </div>
        <div className="h-56 rounded-3xl bg-slate-100" />
        <div className="h-56 rounded-3xl bg-slate-100" />
        <div className="h-56 rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}
