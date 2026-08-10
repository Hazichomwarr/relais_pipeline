export default function AdminMyProspectsLoading() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div>
          <div className="h-9 w-64 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-5 w-96 rounded bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-24 rounded-3xl bg-white" />
          ))}
        </div>

        <div className="h-12 rounded-2xl bg-white" />
        <div className="h-64 rounded-3xl bg-white" />
      </div>
    </div>
  );
}
