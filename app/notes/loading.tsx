export default function NotesLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="h-9 w-48 rounded-xl bg-slate-200" />
          <div className="mt-3 h-5 w-72 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-12 w-full rounded-xl bg-slate-200 sm:w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-48 rounded-3xl bg-white" />
        ))}
      </div>
    </div>
  );
}
