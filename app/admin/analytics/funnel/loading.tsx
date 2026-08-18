export default function FunnelAnalyticsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-9 w-72 rounded-xl bg-slate-200" />
        <div className="h-5 w-96 max-w-full rounded-lg bg-slate-100" />
      </div>

      <div className="mb-6 h-14 rounded-2xl bg-slate-100" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-12 rounded-2xl bg-slate-100" />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 rounded-3xl bg-slate-100" />
          ))}
        </div>

        <div className="h-72 rounded-3xl bg-slate-100" />
        <div className="h-56 rounded-3xl bg-slate-100" />
        <div className="h-56 rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}
