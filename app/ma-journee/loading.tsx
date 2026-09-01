export default function MaJourneeLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-40 rounded-xl bg-slate-200" />
        <div className="mt-3 h-5 w-56 rounded bg-slate-200" />
      </div>

      <div className="mb-8 h-56 rounded-4xl bg-white ring-1 ring-slate-100" />

      <div className="mb-3 flex items-baseline justify-between">
        <div className="h-6 w-32 rounded bg-slate-200" />
        <div className="h-5 w-20 rounded bg-slate-200" />
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-20 border-b border-slate-100 last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
