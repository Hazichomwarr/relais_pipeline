export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-48 rounded-xl bg-slate-200" />
        <div className="mt-3 h-5 w-72 max-w-full rounded bg-slate-200" />
      </div>

      <div className="h-32 rounded-3xl bg-white" />

      <div className="mt-10">
        <div className="mb-4 h-7 w-32 rounded bg-slate-200" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-24 rounded-3xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
