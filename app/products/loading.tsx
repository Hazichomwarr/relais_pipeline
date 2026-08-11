export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div>
          <div className="h-9 w-56 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-5 w-96 max-w-full rounded bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-44 rounded-3xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
