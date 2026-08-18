export default function CommercialDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-4 w-40 animate-pulse rounded-2xl bg-slate-200" />
      <div className="h-10 w-64 animate-pulse rounded-2xl bg-slate-200" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>

      <div className="h-40 animate-pulse rounded-3xl bg-white" />
      <div className="h-64 animate-pulse rounded-3xl bg-white" />
      <div className="h-80 animate-pulse rounded-3xl bg-white" />
    </div>
  );
}
