export default function AdminReportsLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-10">
      <div>
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-9 w-64 rounded-xl bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 rounded-2xl bg-white" />
        ))}
      </div>

      <div className="h-24 rounded-2xl bg-white" />

      <div>
        <div className="mb-4 h-7 w-56 rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-40 rounded-3xl bg-white" />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4 h-7 w-48 rounded bg-slate-200" />
        <div className="h-24 rounded-3xl bg-white" />
      </div>
    </div>
  );
}
