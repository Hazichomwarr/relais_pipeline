export default function JourneesAgentsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-9 w-64 rounded-xl bg-slate-200" />
        <div className="mt-3 h-5 w-80 max-w-full rounded bg-slate-200" />
      </div>

      <div className="mb-6 h-5 w-56 rounded bg-slate-200" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="h-80 rounded-3xl bg-white ring-1 ring-slate-100" />
        <div className="h-96 rounded-3xl bg-white ring-1 ring-slate-100" />
      </div>
    </div>
  );
}
