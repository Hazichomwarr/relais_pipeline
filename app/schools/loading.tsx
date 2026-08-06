export default function SchoolsLoading() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="h-10 w-64 animate-pulse rounded-2xl bg-slate-200" />
      <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-200" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>
    </main>
  );
}
